import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.ml.artifacts import MLArtifacts, get_artifacts
from app.ml.features import normalize_category
from app.ml.predict import UnknownCategoryError, predict_and_explain
from app.models.customer import Customer
from app.models.retention_message import RetentionMessage
from app.models.sms_log import SmsLog
from app.schemas.customer import (
    CreateCustomerRequest,
    CustomerDetail,
    CustomerFieldOptions,
    CustomerListResponse,
    CustomerProfile,
    CustomerSummary,
    UpdatePhoneRequest,
)
from app.schemas.retention import RetentionMessageResponse, SmsLogEntry
from app.security import get_current_user
from app.services.gemini_service import GeminiService, get_gemini_service

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=CustomerListResponse)
def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: str | None = None,
    risk_level: str | None = Query(None, pattern="^(high|medium|low)$"),
    prefered_order_cat: str | None = None,
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    q = db.query(Customer)

    if risk_level:
        q = q.filter(Customer.risk_level == risk_level)

    if prefered_order_cat:
        q = q.filter(Customer.prefered_order_cat == prefered_order_cat)

    if search:
        search = search.strip()
        if search.isdigit():
            q = q.filter(Customer.customer_id == int(search))
        else:
            q = q.filter(Customer.prefered_order_cat.ilike(f"%{search}%"))

    total = q.count()

    order_col = Customer.churn_probability
    q = q.order_by(order_col.desc() if sort_dir == "desc" else order_col.asc())

    rows = q.offset((page - 1) * page_size).limit(page_size).all()

    return CustomerListResponse(
        items=[CustomerSummary.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/meta/options", response_model=CustomerFieldOptions)
def get_field_options(
    artifacts: MLArtifacts = Depends(get_artifacts), _user: str = Depends(get_current_user)
):
    """Allowed values for each categorical field, taken straight from the trained
    label encoders — the 'new customer' form must only submit values from these
    lists (the model has never seen anything else)."""
    enc = artifacts.label_encoders
    return CustomerFieldOptions(
        preferred_login_device=list(enc["PreferredLoginDevice"].classes_),
        preferred_payment_mode=list(enc["PreferredPaymentMode"].classes_),
        gender=list(enc["Gender"].classes_),
        prefered_order_cat=list(enc["PreferedOrderCat"].classes_),
        marital_status=list(enc["MaritalStatus"].classes_),
    )


def _get_customer_or_404(db: Session, customer_id: int) -> Customer:
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("/{customer_id}", response_model=CustomerDetail)
def get_customer(customer_id: int, db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    customer = _get_customer_or_404(db, customer_id)

    latest_message = (
        db.query(RetentionMessage)
        .filter(RetentionMessage.customer_id == customer_id)
        .order_by(RetentionMessage.generated_at.desc())
        .first()
    )
    sms_log = (
        db.query(SmsLog)
        .filter(SmsLog.customer_id == customer_id)
        .order_by(SmsLog.sent_at.desc())
        .all()
    )

    return CustomerDetail(
        customer_id=customer.customer_id,
        profile=CustomerProfile.model_validate(customer),
        churn_probability=customer.churn_probability,
        risk_level=customer.risk_level,
        top_reasons=customer.top_reasons or [],
        reason_impacts=customer.reason_impacts or [],
        phone_number=customer.phone_number,
        latest_retention_message=(
            RetentionMessageResponse.model_validate(latest_message) if latest_message else None
        ),
        sms_log=[SmsLogEntry.model_validate(s) for s in sms_log],
    )


@router.put("/{customer_id}/phone", response_model=CustomerDetail)
def update_phone(
    customer_id: int,
    payload: UpdatePhoneRequest,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    customer = _get_customer_or_404(db, customer_id)
    customer.phone_number = payload.phone_number
    db.commit()
    return get_customer(customer_id, db=db, _user=_user)


@router.post("", response_model=CustomerDetail, status_code=201)
def create_customer(
    payload: CreateCustomerRequest,
    db: Session = Depends(get_db),
    artifacts: MLArtifacts = Depends(get_artifacts),
    gemini: GeminiService = Depends(get_gemini_service),
    _user: str = Depends(get_current_user),
):
    """Adds a brand-new customer (not from the training dataset), runs the churn
    model + SHAP on their data immediately, and stores the result.

    Sentiment is a model input, so it is resolved *before* prediction: Gemini
    scores the review if one was given; with no review (or if Gemini is
    unavailable) the training-set median is used — the model's neutral prior —
    and sentiment is then excluded from the reasons shown, since it wasn't
    observed. The stored sentiment is exactly the value the model received."""
    next_id = (db.query(func.max(Customer.customer_id)).scalar() or 59999) + 1

    scored = gemini.score_sentiment(payload.review_text) if payload.review_text else None
    if scored is not None:
        sentiment_score, sentiment_label = scored
        exclude = frozenset()
    else:
        sentiment_score = artifacts.training_medians["sentiment_score"]
        sentiment_label = "unavailable" if payload.review_text else "not provided"
        exclude = frozenset({"sentiment_score"})

    categories = {
        "PreferredLoginDevice": normalize_category("PreferredLoginDevice", payload.preferred_login_device),
        "PreferredPaymentMode": normalize_category("PreferredPaymentMode", payload.preferred_payment_mode),
        "Gender": normalize_category("Gender", payload.gender),
        "PreferedOrderCat": normalize_category("PreferedOrderCat", payload.prefered_order_cat),
        "MaritalStatus": normalize_category("MaritalStatus", payload.marital_status),
    }

    raw_row = pd.Series(
        {
            "Tenure": payload.tenure,
            "CityTier": payload.city_tier,
            "WarehouseToHome": payload.warehouse_to_home,
            "HourSpendOnApp": payload.hour_spend_on_app,
            "NumberOfDeviceRegistered": payload.number_of_device_registered,
            "SatisfactionScore": payload.satisfaction_score,
            "NumberOfAddress": payload.number_of_address,
            "Complain": payload.complain,
            "OrderAmountHikeFromlastYear": payload.order_amount_hike_from_last_year,
            "CouponUsed": payload.coupon_used,
            "OrderCount": payload.order_count,
            "DaySinceLastOrder": payload.day_since_last_order,
            "CashbackAmount": payload.cashback_amount,
            "sentiment_score": sentiment_score,
            **categories,
        }
    )
    try:
        pred = predict_and_explain(raw_row, artifacts, exclude=exclude)
    except UnknownCategoryError as e:
        raise HTTPException(status_code=422, detail=str(e))

    customer = Customer(
        customer_id=next_id,
        tenure=payload.tenure,
        city_tier=payload.city_tier,
        warehouse_to_home=payload.warehouse_to_home,
        preferred_login_device=categories["PreferredLoginDevice"],
        preferred_payment_mode=categories["PreferredPaymentMode"],
        gender=categories["Gender"],
        hour_spend_on_app=payload.hour_spend_on_app,
        number_of_device_registered=payload.number_of_device_registered,
        prefered_order_cat=categories["PreferedOrderCat"],
        satisfaction_score=payload.satisfaction_score,
        marital_status=categories["MaritalStatus"],
        number_of_address=payload.number_of_address,
        complain=payload.complain,
        order_amount_hike_from_last_year=payload.order_amount_hike_from_last_year,
        coupon_used=payload.coupon_used,
        order_count=payload.order_count,
        day_since_last_order=payload.day_since_last_order,
        cashback_amount=payload.cashback_amount,
        review_text=(payload.review_text or '').strip() or None,
        review_rating=None,
        sentiment_score=sentiment_score,
        sentiment_label=sentiment_label,
        actual_churn=None,
        phone_number=(payload.phone_number or '').strip() or None,
        last_product_purchased=(payload.last_product_purchased or '').strip() or None,
        churn_probability=pred["churn_probability"],
        risk_level=pred["risk_level"],
        top_reasons=pred["top_reasons"],
        reason_impacts=pred["reason_impacts"],
    )
    db.add(customer)
    db.commit()

    return get_customer(next_id, db=db, _user=_user)
