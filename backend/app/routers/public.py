from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.ml.artifacts import MLArtifacts, get_artifacts
from app.models.customer import Customer

router = APIRouter(prefix="/api/public", tags=["public"])


class RiskExample(BaseModel):
    churn_probability: float
    risk_level: str


class LoginStats(BaseModel):
    total_customers: int
    best_model_auc: float
    model_name: str
    model_version: str
    risk_examples: list[RiskExample]
    last_scored_at: datetime | None


@router.get("/login-stats", response_model=LoginStats)
def login_stats(db: Session = Depends(get_db), artifacts: MLArtifacts = Depends(get_artifacts)):
    """Unauthenticated on purpose — this only powers the illustrative panel on the
    login screen, before anyone has a JWT. Returns aggregate stats and anonymous
    example probabilities only: no customer IDs, names or phone numbers."""
    total = db.query(func.count(Customer.id)).scalar() or 0
    best_auc = artifacts.metrics["models"][artifacts.model_name]["roc_auc"]

    def pick(risk_level: str, order_desc: bool):
        q = db.query(Customer).filter(Customer.risk_level == risk_level)
        q = q.order_by(Customer.churn_probability.desc() if order_desc else Customer.churn_probability.asc())
        return q.first()

    candidates = [
        pick("high", order_desc=True),
        pick("medium", order_desc=True),
        pick("low", order_desc=False),
    ]

    examples = [
        RiskExample(churn_probability=c.churn_probability, risk_level=c.risk_level)
        for c in candidates
        if c is not None
    ]

    last_scored_at = db.query(func.max(Customer.predicted_at)).scalar()

    return LoginStats(
        total_customers=total,
        best_model_auc=best_auc,
        model_name=artifacts.model_name,
        model_version=artifacts.model_version,
        risk_examples=examples,
        last_scored_at=last_scored_at,
    )
