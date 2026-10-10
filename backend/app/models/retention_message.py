from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.database import Base


class RetentionMessage(Base):
    __tablename__ = "retention_messages"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), index=True, nullable=False)
    sms_text = Column(String(200))
    discount_percent = Column(Integer)
    source = Column(String, default="gemini")  # "gemini" | "fallback"
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
