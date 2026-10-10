from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.database import Base


class SmsGatewaySettings(Base):
    """Single-row table (id is always 1) holding the Notify.lk credentials that
    used to live only in .env — editable from the SMS Gateway settings page
    instead of requiring a server restart to change."""

    __tablename__ = "sms_gateway_settings"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, default="")
    api_key = Column(String, default="")
    sender_id = Column(String, default="NotifyDEMO")
    dry_run = Column(Boolean, default=True)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
