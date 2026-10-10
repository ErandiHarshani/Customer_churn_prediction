from fastapi import APIRouter, Depends, HTTPException
from google import genai
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.gemini_settings import GeminiSettings
from app.schemas.gemini_settings import (
    GeminiModelInfoResponse,
    GeminiSettingsResponse,
    UpdateGeminiSettingsRequest,
)
from app.security import get_current_user

router = APIRouter(prefix="/api/settings/gemini", tags=["gemini-settings"])


def _get_or_create_settings(db: Session) -> GeminiSettings:
    row = db.query(GeminiSettings).filter(GeminiSettings.id == 1).first()
    if row:
        return row

    # Same race as the SMS gateway settings row: two requests can both see "no
    # row" and race to insert id=1 — fall back to whichever row won.
    row = GeminiSettings(
        id=1,
        api_key=settings.GEMINI_API_KEY,
        model_name=settings.GEMINI_MODEL_NAME,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        row = db.query(GeminiSettings).filter(GeminiSettings.id == 1).first()
    else:
        db.refresh(row)
    return row


@router.get("", response_model=GeminiSettingsResponse)
def get_gemini_settings(db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    return GeminiSettingsResponse.model_validate(_get_or_create_settings(db))


@router.put("", response_model=GeminiSettingsResponse)
def update_gemini_settings(
    payload: UpdateGeminiSettingsRequest,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    row = _get_or_create_settings(db)
    row.api_key = payload.api_key
    row.model_name = payload.model_name
    db.commit()
    db.refresh(row)
    return GeminiSettingsResponse.model_validate(row)


@router.get("/model-info", response_model=GeminiModelInfoResponse)
def get_gemini_model_info(db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    """Gemini's API key auth has no balance/credit endpoint (billing lives in
    Google Cloud console, behind separate OAuth) — this instead confirms the
    key + model actually work by fetching the model's own metadata."""
    row = _get_or_create_settings(db)
    if not row.api_key:
        raise HTTPException(status_code=400, detail="Gemini API key not configured yet")

    try:
        client = genai.Client(api_key=row.api_key)
        model = client.models.get(model=row.model_name)
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Could not reach Gemini with this API key / model name",
        )

    return GeminiModelInfoResponse(
        name=model.name or row.model_name,
        display_name=model.display_name or row.model_name,
        input_token_limit=model.input_token_limit or 0,
        output_token_limit=model.output_token_limit or 0,
        supported_actions=list(model.supported_actions or []),
    )
