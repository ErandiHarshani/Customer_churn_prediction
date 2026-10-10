import numpy as np
import pandas as pd

from app.config import settings
from app.ml.artifacts import MLArtifacts
from app.ml.features import (
    BEHAVIORAL_COLS,
    CATEGORICAL_COLS,
    FEATURE_COLS,
    FEATURE_LABELS,
    TRAINING_MEDIANS,
    VALUE_AWARE_LABELS,
)


def encode_row(row: pd.Series, encoders: dict) -> pd.Series:
    out = row.copy()
    for col in CATEGORICAL_COLS:
        le = encoders[col]
        value = str(row[col])
        if value not in le.classes_:
            # unseen category at inference time — fall back to the most common
            # training class rather than raising, so a single bad row can't 500 the API.
            value = le.classes_[0]
        out[col] = le.transform([value])[0]
    return out


def risk_level(prob: float) -> str:
    if prob >= settings.RISK_THRESHOLD_HIGH:
        return "high"
    if prob >= settings.RISK_THRESHOLD_MEDIUM:
        return "medium"
    return "low"


# SHAP values are in log-odds. Contributions below this are noise-level (the
# training set's 25th percentile of positive SHAP is ~0.06, median ~0.18), so they
# are not reported as churn reasons.
MIN_REASON_SHAP = 0.1


def _fmt(value: float) -> str:
    return f"{value:g}" if float(value).is_integer() else f"{value:.1f}"


def describe_feature(feat: str, value) -> str:
    """Human label that matches the customer's actual value, not a fixed assumption."""
    if feat in VALUE_AWARE_LABELS and value is not None and not pd.isna(value):
        low, high, unit = VALUE_AWARE_LABELS[feat]
        label = low if float(value) <= TRAINING_MEDIANS[feat] else high
        return f"{label} ({_fmt(float(value))}{unit})"
    if feat == "Complain":
        return "recent complaint filed" if value and float(value) > 0 else "no complaint filed"
    if feat == "sentiment_score" and value is not None and not pd.isna(value):
        return f"{'negative' if float(value) < 0 else 'positive'} review sentiment ({float(value):.2f})"
    if feat == "PreferedOrderCat" and value is not None:
        return f"preferred order category ({value})"
    return FEATURE_LABELS.get(feat, feat)


def reason_impacts_for_row(
    shap_row: np.ndarray, raw_row: pd.Series, n: int = 5, behavioral_only: bool = True
) -> list[dict]:
    """Top-n features meaningfully pushing this row toward churn, each with a label
    describing the customer's real value and impact_pct = that feature's share of the
    total positive (churn-pushing) SHAP weight among eligible features. Features whose
    push is below MIN_REASON_SHAP are omitted, so a very safe customer can have none."""
    eligible = set(BEHAVIORAL_COLS) if behavioral_only else set(FEATURE_COLS)
    positive = [
        (feat, float(val))
        for feat, val in zip(FEATURE_COLS, shap_row)
        if feat in eligible and val > 0
    ]
    total = sum(val for _, val in positive) or 1.0
    positive.sort(key=lambda t: t[1], reverse=True)

    return [
        {
            "label": describe_feature(feat, raw_row.get(feat)),
            "impact_pct": round((val / total) * 100, 1),
        }
        for feat, val in positive[:n]
        if val >= MIN_REASON_SHAP
    ]


def predict_and_explain(raw_row: pd.Series, artifacts: MLArtifacts) -> dict:
    encoded = encode_row(raw_row[FEATURE_COLS], artifacts.label_encoders)
    X = encoded.to_frame().T[artifacts.feature_columns].astype(float)

    prob = float(artifacts.xgb_model.predict_proba(X)[0, 1])

    shap_values = artifacts.shap_explainer.shap_values(X)
    shap_row = shap_values[0] if not isinstance(shap_values, list) else shap_values[1][0]

    impacts = reason_impacts_for_row(shap_row, raw_row, n=5, behavioral_only=True)

    return {
        "churn_probability": prob,
        "risk_level": risk_level(prob),
        "top_reasons": [r["label"] for r in impacts],
        "reason_impacts": impacts,
    }
