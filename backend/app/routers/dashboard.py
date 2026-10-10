from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.ml.artifacts import MLArtifacts, get_artifacts
from app.ml.evaluation import compute_model_curves
from app.models.customer import Customer
from app.models.retention_message import RetentionMessage
from app.models.sms_log import SmsLog
from app.schemas.dashboard import (
    ChurnDistribution,
    DashboardSummary,
    EngagementAnalytics,
    ModelCurve,
    ModelMetric,
    RecentSmsEntry,
    RetentionStats,
    RiskDistribution,
    RocCurveResponse,
    SmsStats,
)
from app.security import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(
    db: Session = Depends(get_db),
    artifacts: MLArtifacts = Depends(get_artifacts),
    _user: str = Depends(get_current_user),
):
    total = db.query(func.count(Customer.id)).scalar() or 0

    actual_churn_rate = db.query(func.avg(Customer.actual_churn)).scalar() or 0.0
    predicted_churn_rate = db.query(func.avg(Customer.churn_probability)).scalar() or 0.0

    def count_risk(level: str) -> int:
        return db.query(func.count(Customer.id)).filter(Customer.risk_level == level).scalar() or 0

    risk_distribution = RiskDistribution(
        high=count_risk("high"),
        medium=count_risk("medium"),
        low=count_risk("low"),
    )

    churned = db.query(func.count(Customer.id)).filter(Customer.actual_churn == 1).scalar() or 0
    non_churned = db.query(func.count(Customer.id)).filter(Customer.actual_churn == 0).scalar() or 0
    churn_distribution = ChurnDistribution(churn=churned, non_churn=non_churned)

    curves = compute_model_curves()
    best_model_name = max(curves, key=lambda name: curves[name]["auc"])
    best_model_accuracy = curves[best_model_name]["accuracy"]

    model_metrics = [
        ModelMetric(**m, accuracy=curves[m["name"]]["accuracy"]) for m in artifacts.model_comparison
    ]

    return DashboardSummary(
        total_customers=total,
        actual_churn_rate=float(actual_churn_rate),
        predicted_churn_rate=float(predicted_churn_rate),
        best_model_accuracy=best_model_accuracy,
        best_model_name=best_model_name,
        risk_distribution=risk_distribution,
        churn_distribution=churn_distribution,
        model_metrics=model_metrics,
    )


@router.get("/roc-curve", response_model=RocCurveResponse)
def get_roc_curve(_user: str = Depends(get_current_user)):
    curves = compute_model_curves()
    return RocCurveResponse(
        curves=[ModelCurve(name=name, **data) for name, data in curves.items()]
    )


@router.get("/engagement", response_model=EngagementAnalytics)
def get_engagement(db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    def sms_count(**filters) -> int:
        q = db.query(func.count(SmsLog.id))
        for col, val in filters.items():
            q = q.filter(getattr(SmsLog, col) == val)
        return q.scalar() or 0

    sms_stats = SmsStats(
        total_sent=sms_count(),
        successful=sms_count(success=True),
        failed=sms_count(success=False),
        dry_run_count=sms_count(dry_run=True),
        real_count=sms_count(dry_run=False),
    )

    def retention_count(**filters) -> int:
        q = db.query(func.count(RetentionMessage.id))
        for col, val in filters.items():
            q = q.filter(getattr(RetentionMessage, col) == val)
        return q.scalar() or 0

    retention_stats = RetentionStats(
        total_generated=retention_count(),
        gemini_generated=retention_count(source="gemini"),
        fallback_generated=retention_count(source="fallback"),
    )

    recent = db.query(SmsLog).order_by(SmsLog.sent_at.desc()).limit(10).all()

    message_ids = [r.retention_message_id for r in recent if r.retention_message_id]
    messages_by_id = {
        m.id: m.sms_text
        for m in db.query(RetentionMessage).filter(RetentionMessage.id.in_(message_ids)).all()
    } if message_ids else {}

    return EngagementAnalytics(
        sms_stats=sms_stats,
        retention_stats=retention_stats,
        recent_sms=[
            RecentSmsEntry(
                customer_id=r.customer_id,
                phone_number=r.phone_number,
                message=messages_by_id.get(r.retention_message_id),
                provider_status=r.provider_status,
                success=r.success,
                dry_run=r.dry_run,
                sent_at=r.sent_at,
            )
            for r in recent
        ],
    )
