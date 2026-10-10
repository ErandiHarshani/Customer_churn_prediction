import json
import random
import time

from fastapi import Depends
from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.gemini_settings import GeminiSettings

# The app never passes tools, so automatic function calling is unused; disabling it
# also silences the SDK's "Direct use of AFC ... is not recommended" log line.
NO_AFC = types.AutomaticFunctionCallingConfig(disable=True)

# Ported verbatim from mlpart/01_data_prep_and_sentiment.ipynb (cell 18).
SENTIMENT_PROMPT = """
You are a sentiment analysis engine for e-commerce customer reviews.

Read the review below and return ONLY a compact JSON object.

{{
  "sentiment_score": <float from -1.0 to 1.0>,
  "sentiment_label": "<negative|neutral|positive>"
}}

Rules:
- -1.0 = very negative
- 0.0 = neutral
- 1.0 = very positive
- Return ONLY JSON
- No markdown
- No explanation

Review:
\"\"\"{review}\"\"\"
"""

# Extended from mlpart/02_model_training_shap_retention.ipynb (cell 22) — the original
# prompt only passed abstract reason labels + probability, which made Gemini converge
# on near-identical "We're sorry... 20% off... shop now" boilerplate across customers.
# This version forces concrete, per-customer variation instead of relying on temperature alone.
RETENTION_PROMPT = """
You are a customer retention copywriter for an e-commerce store. Write ONE SMS
(max 160 characters) for the customer described below.

Churn risk reasons (most important first): {reasons}
Churn probability: {prob:.0%}
Concrete facts about this customer you may reference: {facts}

Writing style for this message: {style}

Rules:
- Reference at least ONE concrete fact from the list above (a real number or detail),
  not just a vague acknowledgement.
- Do NOT open with "Hey!", "We're sorry", "We messed up", or any other generic apology
  opener — vary the opening line naturally based on the specific reasons given.
- Offer a discount: 10-15% if churn probability is under 70%, 15-20% if 70-90%,
  20-25% if over 90%.
- Include a clear call to action that does NOT reference a link, URL, or website.
  This is a plain SMS with no clickable link, so never write "[Link]", "[URL]",
  or any other bracketed placeholder — end on the offer itself (e.g. "come back
  and save" / "your discount is waiting"), not a click-through.
- Sound like a real, specific message about THIS customer, not a generic template.

Return ONLY compact JSON, no markdown:
{{"sms_text": "<the sms, <=160 chars>", "discount_percent": <int>}}
"""

RETENTION_STYLES = [
    "warm and personal, like a message from a small business owner",
    "concise and professional",
    "upbeat and friendly, light on exclamation points",
    "empathetic and understated, focused on listening rather than selling",
]

FALLBACK_SMS_TEXT = "We miss you! Enjoy 15% off your next order as a thank-you for being our customer."
FALLBACK_DISCOUNT = 15


class GeminiService:
    def __init__(self, api_key: str, model_name: str = "gemini-3.5-flash-lite"):
        self._api_key = api_key
        self._model = model_name
        self._client = None

    def _get_client(self):
        # constructed lazily so a missing/invalid key surfaces as a graceful
        # fallback message (below) rather than a 500 at dependency-injection time
        if self._client is None:
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    def generate_retention_message(
        self, reasons: list[str], prob: float, facts: list[str] | None = None, retries: int = 5
    ) -> tuple[str, int, str]:
        """Returns (sms_text, discount_percent, source) where source is 'gemini' or 'fallback'.

        `facts` should be concrete, customer-specific details (e.g. "8 months as a
        customer", "3 orders placed", "no order in 45 days") — without these the
        model has nothing to individuate the message with and outputs converge on
        the same generic apology+discount template for every customer."""
        if not self._api_key:
            return FALLBACK_SMS_TEXT, FALLBACK_DISCOUNT, "fallback"

        reasons_str = ", ".join(reasons) if reasons else "general disengagement"
        facts_str = "; ".join(facts) if facts else "no additional details available"
        style = random.choice(RETENTION_STYLES)

        for attempt in range(retries):
            try:
                response = self._get_client().models.generate_content(
                    model=self._model,
                    contents=RETENTION_PROMPT.format(
                        reasons=reasons_str, prob=prob, facts=facts_str, style=style
                    ),
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=1.0,
                        automatic_function_calling=NO_AFC,
                    ),
                )
                data = json.loads(response.text)
                return data["sms_text"][:160], int(data["discount_percent"]), "gemini"

            except Exception as e:
                error = str(e)

                if "403" in error or "PERMISSION_DENIED" in error:
                    # access-denial, not transient — retrying wastes calls, surface the fallback now
                    break

                if "503" in error or "UNAVAILABLE" in error:
                    time.sleep(min(60, (2 ** attempt) + random.uniform(0, 2)))
                    continue

                if "429" in error or "RESOURCE_EXHAUSTED" in error:
                    time.sleep(min(120, 5 * (2 ** attempt)))
                    continue

                if attempt == retries - 1:
                    break

                time.sleep(2)

        return FALLBACK_SMS_TEXT, FALLBACK_DISCOUNT, "fallback"

    def score_sentiment(self, review_text: str, retries: int = 3) -> tuple[float, str] | None:
        """Returns (sentiment_score, sentiment_label), or None when there is no
        review or Gemini could not score it. None is deliberately distinct from a
        genuine neutral result, so the caller can impute instead of pretending the
        customer was neutral. Used when a new customer is created with a review — a
        single, on-demand call (never called in bulk)."""
        review_text = (review_text or "").strip()
        if not review_text or not self._api_key:
            return None

        for attempt in range(retries):
            try:
                response = self._get_client().models.generate_content(
                    model=self._model,
                    contents=SENTIMENT_PROMPT.format(review=review_text[:2000]),
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json", automatic_function_calling=NO_AFC
                    ),
                )
                data = json.loads(response.text)
                score = max(-1.0, min(1.0, float(data["sentiment_score"])))
                label = str(data["sentiment_label"]).lower().strip()
                if label not in ("negative", "neutral", "positive"):
                    label = "neutral"
                return score, label

            except Exception as e:
                error = str(e)

                if "403" in error or "PERMISSION_DENIED" in error:
                    break

                if "503" in error or "UNAVAILABLE" in error:
                    time.sleep(min(60, (2 ** attempt) + random.uniform(0, 2)))
                    continue

                if "429" in error or "RESOURCE_EXHAUSTED" in error:
                    time.sleep(min(120, 5 * (2 ** attempt)))
                    continue

                if attempt == retries - 1:
                    break

                time.sleep(2)

        print("[gemini] review sentiment unavailable, model will use the training median")
        return None


def build_gemini_service(db: Session) -> GeminiService:
    """Prefers the DB-stored config from the SMS Gateway settings page (editable
    without a restart); falls back to the .env values if nothing's been saved
    yet. Plain function (no Depends) so background threads with their own
    session — e.g. the bulk-generate job — can call it directly."""
    row = db.query(GeminiSettings).filter(GeminiSettings.id == 1).first()
    if row:
        return GeminiService(
            api_key=row.api_key or "", model_name=row.model_name or "gemini-3.5-flash-lite"
        )
    return GeminiService(api_key=settings.GEMINI_API_KEY, model_name=settings.GEMINI_MODEL_NAME)


def get_gemini_service(db: Session = Depends(get_db)) -> GeminiService:
    return build_gemini_service(db)
