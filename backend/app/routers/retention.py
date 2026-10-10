import threading
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models.customer import Customer
from app.models.retention_message import RetentionMessage
from app.models.sms_log import SmsLog
from app.schemas.retention import (
    BulkGenerateJobStarted,
    BulkGenerateJobStatus,
    BulkGenerateMessagesRequest,
    BulkSendSmsResponse,
    BulkTargetRequest,
    GenerateMessageRequest,
    RetentionMessageResponse,
    SendSmsRequest,
    SendSmsResponse,
)
from app.security import get_current_user
from app.services.gemini_service import GeminiService, build_gemini_service, get_gemini_service
from app.services.notify_lk_service import NotifyLkService, get_notify_lk_service, normalize_lk_phone

router = APIRouter(prefix="/api/customers", tags=["retention"])

# Real, costly SMS sends are capped and stay synchronous (the loop skips
# customers with no phone/message almost instantly, so in practice this only
# limits how many *actual* sends happen in one request).
MAX_BULK_SMS_TARGETS = 300

# Message generation is unbounded in count (a category can have thousands of
# customers) but each real Gemini call is throttled — generate_message's
# docstring warns that rapid/bulk calls previously tripped a 403
# PERMISSION_DENIED abuse-flag from Google — so it always runs as a background
# job the client polls for progress instead of one long blocking request.
BULK_GENERATE_DELAY_SECONDS = 1.2

_bulk_generate_jobs: dict[str, dict] = {}
_bulk_generate_jobs_lock = threading.Lock()


def _get_customer_or_404(db: Session, customer_id: int) -> Customer:
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


def _build_customer_facts(customer: Customer) -> list[str]:
    """Concrete, real details about this specific customer for the retention
    prompt to reference — without these, every generated message reads the same."""
    facts = []
    if customer.tenure is not None:
        facts.append(f"{int(customer.tenure)} month(s) as a customer")
    if customer.order_count is not None:
        facts.append(f"{int(customer.order_count)} orders placed in total")
    if customer.day_since_last_order is not None:
        facts.append(f"{int(customer.day_since_last_order)} days since their last order")
    if customer.complain:
        facts.append("filed a complaint recently")
    if customer.cashback_amount:
        facts.append(f"has {customer.cashback_amount:.0f} in unused cashback")
    # only reference sentiment/review content if it's genuinely this customer's own
    # input — for seeded training-data customers it's a simulated linkage, not real
    if (
        not customer.review_is_synthetic
        and customer.sentiment_label
        and customer.sentiment_label != "neutral"
    ):
        facts.append(f"their overall sentiment towards the store is {customer.sentiment_label}")
    if customer.prefered_order_cat:
        facts.append(f"usually shops in {customer.prefered_order_cat}")
    if customer.last_product_purchased:
        facts.append(f"last purchased: {customer.last_product_purchased}")
    return facts


def _resolve_target_customers(db: Session, payload: BulkTargetRequest) -> list[Customer]:
    """Turns a bulk request (explicit ids, or 'all matching a category/risk
    level') into the actual customer rows. No count cap here — callers apply
    whatever cap fits the actual cost of what they're about to do."""
    if payload.all_matching:
        q = db.query(Customer)
        if payload.risk_level:
            q = q.filter(Customer.risk_level == payload.risk_level)
        if payload.prefered_order_cat:
            q = q.filter(Customer.prefered_order_cat == payload.prefered_order_cat)
        if payload.search:
            search = payload.search.strip()
            if search.isdigit():
                q = q.filter(Customer.customer_id == int(search))
            else:
                q = q.filter(Customer.prefered_order_cat.ilike(f"%{search}%"))
        customers = q.all()
    else:
        ids = payload.customer_ids or []
        if not ids:
            raise HTTPException(status_code=422, detail="No customers selected")
        customers = db.query(Customer).filter(Customer.customer_id.in_(ids)).all()

    if not customers:
        raise HTTPException(status_code=404, detail="No matching customers found")
    return customers


def _run_bulk_generate_job(job_id: str, customer_ids: list[int], force_regenerate: bool) -> None:
    """Runs in a background thread with its own DB session + Gemini client —
    the request's own `db`/`gemini` are torn down right after the response
    that kicks this off is sent, so they can't be reused here."""
    db = SessionLocal()
    gemini = build_gemini_service(db)
    try:
        for customer_id in customer_ids:
            customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
            if not customer:
                with _bulk_generate_jobs_lock:
                    _bulk_generate_jobs[job_id]["processed"] += 1
                continue

            existing = (
                db.query(RetentionMessage)
                .filter(RetentionMessage.customer_id == customer_id)
                .order_by(RetentionMessage.generated_at.desc())
                .first()
            )
            if existing and not force_regenerate:
                with _bulk_generate_jobs_lock:
                    job = _bulk_generate_jobs[job_id]
                    job["already_had_message"] += 1
                    job["processed"] += 1
                continue

            try:
                sms_text, discount_percent, source = gemini.generate_retention_message(
                    reasons=customer.top_reasons or [],
                    prob=customer.churn_probability,
                    facts=_build_customer_facts(customer),
                )
                message = RetentionMessage(
                    customer_id=customer_id,
                    sms_text=sms_text,
                    discount_percent=discount_percent,
                    source=source,
                )
                db.add(message)
                db.commit()
                with _bulk_generate_jobs_lock:
                    _bulk_generate_jobs[job_id]["generated"] += 1
            except Exception:
                db.rollback()
                with _bulk_generate_jobs_lock:
                    _bulk_generate_jobs[job_id]["failed"] += 1

            with _bulk_generate_jobs_lock:
                _bulk_generate_jobs[job_id]["processed"] += 1

            time.sleep(BULK_GENERATE_DELAY_SECONDS)
    except Exception as e:
        with _bulk_generate_jobs_lock:
            _bulk_generate_jobs[job_id]["error"] = str(e)
    finally:
        with _bulk_generate_jobs_lock:
            _bulk_generate_jobs[job_id]["done"] = True
        db.close()


@router.post("/bulk/generate-messages", response_model=BulkGenerateJobStarted)
def bulk_generate_messages(
    payload: BulkGenerateMessagesRequest,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Kicks off the bulk variant of generate_message as a background job and
    returns immediately — a category can be thousands of customers, and at
    ~1 Gemini call/second that can take much longer than any single HTTP
    request should stay open for. Poll get_bulk_generate_job for progress."""
    customers = _resolve_target_customers(db, payload)
    customer_ids = [c.customer_id for c in customers]

    job_id = str(uuid.uuid4())
    with _bulk_generate_jobs_lock:
        _bulk_generate_jobs[job_id] = {
            "target_count": len(customer_ids),
            "processed": 0,
            "generated": 0,
            "already_had_message": 0,
            "failed": 0,
            "done": False,
            "error": None,
        }

    threading.Thread(
        target=_run_bulk_generate_job,
        args=(job_id, customer_ids, payload.force_regenerate),
        daemon=True,
    ).start()

    return BulkGenerateJobStarted(job_id=job_id, target_count=len(customer_ids))


@router.get("/bulk/generate-messages/{job_id}", response_model=BulkGenerateJobStatus)
def get_bulk_generate_job(job_id: str, _user: str = Depends(get_current_user)):
    with _bulk_generate_jobs_lock:
        job = _bulk_generate_jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return BulkGenerateJobStatus(job_id=job_id, **job)


@router.post("/bulk/send-sms", response_model=BulkSendSmsResponse)
def bulk_send_sms(
    payload: BulkTargetRequest,
    db: Session = Depends(get_db),
    notify: NotifyLkService = Depends(get_notify_lk_service),
    _user: str = Depends(get_current_user),
):
    """Bulk variant of send_sms. Skips customers with no phone on file or no
    generated message yet, and logs every attempt the same way the single-send
    endpoint does. Capped on the count that actually has a phone on file —
    matching a large category is fine as long as few of them are reachable."""
    customers = _resolve_target_customers(db, payload)

    actionable_count = sum(1 for c in customers if c.phone_number)
    if actionable_count > MAX_BULK_SMS_TARGETS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"{actionable_count} matching customers have a phone number on file — "
                f"narrow your selection to {MAX_BULK_SMS_TARGETS} or fewer reachable "
                "customers before sending in bulk."
            ),
        )

    sent = 0
    failed = 0
    skipped_no_phone = 0
    skipped_no_message = 0

    for customer in customers:
        if not customer.phone_number:
            skipped_no_phone += 1
            continue

        message = (
            db.query(RetentionMessage)
            .filter(RetentionMessage.customer_id == customer.customer_id)
            .order_by(RetentionMessage.generated_at.desc())
            .first()
        )
        if not message or not (message.sms_text or "").strip():
            skipped_no_message += 1
            continue

        phone = normalize_lk_phone(customer.phone_number)
        result = notify.send_sms(phone=phone, message=message.sms_text)
        success = result.get("status") == "success"

        log = SmsLog(
            customer_id=customer.customer_id,
            retention_message_id=message.id,
            phone_number=phone,
            provider_status=result.get("status"),
            provider_response=result.get("raw"),
            success=success,
            dry_run=notify.dry_run,
            sent_at=datetime.now(timezone.utc),
        )
        db.add(log)
        db.commit()

        if success:
            sent += 1
        else:
            failed += 1

    return BulkSendSmsResponse(
        target_count=len(customers),
        sent=sent,
        failed=failed,
        skipped_no_phone=skipped_no_phone,
        skipped_no_message=skipped_no_message,
    )


@router.post("/{customer_id}/generate-message", response_model=RetentionMessageResponse)
def generate_message(
    customer_id: int,
    payload: GenerateMessageRequest = GenerateMessageRequest(),
    db: Session = Depends(get_db),
    gemini: GeminiService = Depends(get_gemini_service),
    _user: str = Depends(get_current_user),
):
    """Single-customer, on-demand only. Never call this in a loop over many
    customers — bulk/rapid calls previously triggered a 403 PERMISSION_DENIED
    abuse-flag from Google during model development."""
    customer = _get_customer_or_404(db, customer_id)

    if not payload.force_regenerate:
        existing = (
            db.query(RetentionMessage)
            .filter(RetentionMessage.customer_id == customer_id)
            .order_by(RetentionMessage.generated_at.desc())
            .first()
        )
        if existing:
            return RetentionMessageResponse.model_validate(existing)

    sms_text, discount_percent, source = gemini.generate_retention_message(
        reasons=customer.top_reasons or [],
        prob=customer.churn_probability,
        facts=_build_customer_facts(customer),
    )

    message = RetentionMessage(
        customer_id=customer_id,
        sms_text=sms_text,
        discount_percent=discount_percent,
        source=source,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    return RetentionMessageResponse.model_validate(message)


@router.post("/{customer_id}/send-sms", response_model=SendSmsResponse)
def send_sms(
    customer_id: int,
    payload: SendSmsRequest = SendSmsRequest(),
    db: Session = Depends(get_db),
    notify: NotifyLkService = Depends(get_notify_lk_service),
    _user: str = Depends(get_current_user),
):
    customer = _get_customer_or_404(db, customer_id)

    if not customer.phone_number:
        raise HTTPException(status_code=400, detail="No phone number on file for this customer")

    if payload.retention_message_id:
        message = (
            db.query(RetentionMessage)
            .filter(
                RetentionMessage.id == payload.retention_message_id,
                RetentionMessage.customer_id == customer_id,
            )
            .first()
        )
    else:
        message = (
            db.query(RetentionMessage)
            .filter(RetentionMessage.customer_id == customer_id)
            .order_by(RetentionMessage.generated_at.desc())
            .first()
        )

    if not message or not (message.sms_text or "").strip():
        raise HTTPException(
            status_code=400, detail="Generate a retention message before sending an SMS"
        )

    phone = normalize_lk_phone(customer.phone_number)
    result = notify.send_sms(phone=phone, message=message.sms_text)
    success = result.get("status") == "success"

    log = SmsLog(
        customer_id=customer_id,
        retention_message_id=message.id,
        phone_number=phone,
        provider_status=result.get("status"),
        provider_response=result.get("raw"),
        success=success,
        dry_run=notify.dry_run,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return SendSmsResponse(
        success=success,
        provider_status=result.get("status"),
        dry_run=notify.dry_run,
        sent_at=log.sent_at,
    )
