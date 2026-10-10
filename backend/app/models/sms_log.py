from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String

from app.database import Base


class SmsLog(Base):
    __tablename__ = "sms_log"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), index=True, nullable=False)
    retention_message_id = Column(Integer, ForeignKey("retention_messages.id"), nullable=True)
    phone_number = Column(String)
    provider_status = Column(String)
    provider_response = Column(JSON)
    success = Column(Boolean, default=False)
    dry_run = Column(Boolean, default=False)
    sent_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
