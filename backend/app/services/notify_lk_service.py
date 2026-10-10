import re

import httpx
from fastapi import Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.sms_gateway_settings import SmsGatewaySettings

BASE_URL = "https://app.notify.lk/api/v1/send"
STATUS_URL = "https://app.notify.lk/api/v1/status"


def normalize_lk_phone(raw: str) -> str:
    """Accepts local formats like '0771234567' or '+94771234567' and normalizes
    to the '9471234567' shape Notify.lk expects (94 country code, no +, no leading 0)."""
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("94"):
        return digits
    if digits.startswith("0"):
        return "94" + digits[1:]
    return "94" + digits


class NotifyLkService:
    def __init__(self, user_id: str, api_key: str, sender_id: str, dry_run: bool = True):
        self._user_id = user_id
        self._api_key = api_key
        self._sender_id = sender_id
        self._dry_run = dry_run

    @property
    def dry_run(self) -> bool:
        return self._dry_run

    def send_sms(self, phone: str, message: str) -> dict:
        """phone should already be normalized via normalize_lk_phone().
        Returns a dict with at least {"status": ..., "raw": {...}}.
        In dry-run mode, no real request is sent."""
        if self._dry_run:
            return {
                "status": "success",
                "raw": {"status": "success", "data": "Sent (dry-run, no real SMS sent)"},
            }

        params = {
            "user_id": self._user_id,
            "api_key": self._api_key,
            "sender_id": self._sender_id,
            "to": phone,
            "message": message,
        }
        response = httpx.get(BASE_URL, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        return {"status": data.get("status", "unknown"), "raw": data}

    def get_balance(self) -> dict:
        """Hits Notify.lk's account-status endpoint. Real network call regardless
        of dry_run — checking the balance doesn't send an SMS, so there's nothing
        to simulate."""
        params = {"user_id": self._user_id, "api_key": self._api_key}
        response = httpx.get(STATUS_URL, params=params, timeout=15)
        response.raise_for_status()
        return response.json()


def get_notify_lk_service(db: Session = Depends(get_db)) -> NotifyLkService:
    """Prefers the DB-stored config from the SMS Gateway settings page (editable
    without a restart); falls back to the .env values if nothing's been saved yet."""
    row = db.query(SmsGatewaySettings).filter(SmsGatewaySettings.id == 1).first()
    if row:
        return NotifyLkService(
            user_id=row.user_id or "",
            api_key=row.api_key or "",
            sender_id=row.sender_id or "NotifyDEMO",
            dry_run=row.dry_run,
        )
    return NotifyLkService(
        user_id=settings.NOTIFY_LK_USER_ID,
        api_key=settings.NOTIFY_LK_API_KEY,
        sender_id=settings.NOTIFY_LK_SENDER_ID,
        dry_run=settings.DRY_RUN,
    )
