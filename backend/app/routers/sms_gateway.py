from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.sms_gateway_settings import SmsGatewaySettings
from app.schemas.sms_gateway import (
    SmsBalanceResponse,
    SmsGatewaySettingsResponse,
    UpdateSmsGatewaySettingsRequest,
)
from app.security import get_current_user
from app.services.notify_lk_service import NotifyLkService

router = APIRouter(prefix="/api/settings/sms-gateway", tags=["sms-gateway"])


def _get_or_create_settings(db: Session) -> SmsGatewaySettings:
    row = db.query(SmsGatewaySettings).filter(SmsGatewaySettings.id == 1).first()
    if row:
        return row

    # Two requests can both see "no row" and race to insert id=1 (e.g. the
    # settings page loads its config and balance at the same time) — fall back
    # to whichever row won if our own insert loses that race.
    row = SmsGatewaySettings(
        id=1,
        user_id=settings.NOTIFY_LK_USER_ID,
        api_key=settings.NOTIFY_LK_API_KEY,
        sender_id=settings.NOTIFY_LK_SENDER_ID,
        dry_run=settings.DRY_RUN,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        row = db.query(SmsGatewaySettings).filter(SmsGatewaySettings.id == 1).first()
    else:
        db.refresh(row)
    return row


@router.get("", response_model=SmsGatewaySettingsResponse)
def get_sms_gateway_settings(
    db: Session = Depends(get_db), _user: str = Depends(get_current_user)
):
    return SmsGatewaySettingsResponse.model_validate(_get_or_create_settings(db))


@router.put("", response_model=SmsGatewaySettingsResponse)
def update_sms_gateway_settings(
    payload: UpdateSmsGatewaySettingsRequest,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    row = _get_or_create_settings(db)
    row.user_id = payload.user_id
    row.api_key = payload.api_key
    row.sender_id = payload.sender_id
    row.dry_run = payload.dry_run
    db.commit()
    db.refresh(row)
    return SmsGatewaySettingsResponse.model_validate(row)


@router.get("/balance", response_model=SmsBalanceResponse)
def get_sms_balance(db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    row = _get_or_create_settings(db)
    if not row.user_id or not row.api_key:
        raise HTTPException(
            status_code=400, detail="Notify.lk user ID / API key not configured yet"
        )

    notify = NotifyLkService(
        user_id=row.user_id, api_key=row.api_key, sender_id=row.sender_id, dry_run=row.dry_run
    )
    try:
        result = notify.get_balance()
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach Notify.lk to check balance")

    data = result.get("data")
    if result.get("status") != "success" or not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Notify.lk did not return a valid balance")

    return SmsBalanceResponse(
        active=bool(data.get("active", False)), balance=float(data.get("acc_balance", 0))
    )
