from datetime import datetime

from pydantic import BaseModel


class ModelMetric(BaseModel):
    name: str
    f1: float
    roc_auc: float
    accuracy: float
    precision: float | None = None
    recall: float | None = None
    threshold: float | None = None


class RiskDistribution(BaseModel):
    high: int
    medium: int
    low: int


class ChurnDistribution(BaseModel):
    churn: int
    non_churn: int


class DashboardSummary(BaseModel):
    total_customers: int
    actual_churn_rate: float
    predicted_churn_rate: float
    best_model_accuracy: float
    best_model_name: str
    model_version: str | None = None
    risk_threshold_high: float | None = None
    risk_threshold_medium: float | None = None
    risk_distribution: RiskDistribution
    churn_distribution: ChurnDistribution
    model_metrics: list[ModelMetric]


class ModelCurve(BaseModel):
    name: str
    fpr: list[float]
    tpr: list[float]
    auc: float
    accuracy: float


class RocCurveResponse(BaseModel):
    curves: list[ModelCurve]


class SmsStats(BaseModel):
    total_sent: int
    successful: int
    failed: int
    dry_run_count: int
    real_count: int


class RetentionStats(BaseModel):
    total_generated: int
    gemini_generated: int
    fallback_generated: int


class RecentSmsEntry(BaseModel):
    customer_id: int
    phone_number: str
    message: str | None
    provider_status: str | None
    success: bool
    dry_run: bool
    sent_at: datetime

    class Config:
        from_attributes = True


class EngagementAnalytics(BaseModel):
    sms_stats: SmsStats
    retention_stats: RetentionStats
    recent_sms: list[RecentSmsEntry]
