from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base


class GeminiSettings(Base):
    """Single-row table (id is always 1) holding the Gemini API key + model
    name that used to live only in .env — editable from the SMS Gateway
    settings page instead of requiring a server restart to change."""

    __tablename__ = "gemini_settings"

    id = Column(Integer, primary_key=True)
    api_key = Column(String, default="")
    model_name = Column(String, default="gemini-3.5-flash-lite")
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
