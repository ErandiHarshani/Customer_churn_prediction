import numpy as np
import pandas as pd

from app.ml.artifacts import MLArtifacts
from app.ml.features import (
    BEHAVIORAL_COLS,
    CATEGORICAL_COLS,
    FEATURE_COLS,
    FEATURE_LABELS,
    TRAINING_MEDIANS,
    VALUE_AWARE_LABELS,
    normalize_categories,
)


class UnknownCategoryError(ValueError):
    pass


def encode_row(row: pd.Series, encoders: dict) -> pd.Series:
    """Merges spelling variants, then label-encodes. A value the model has never
    seen is rejected rather than silently swapped for another category, which
    would produce a confident prediction for a customer that doesn't exist."""
    out = normalize_categories(row)
    for col in CATEGORICAL_COLS:
        le = encoders[col]
        value = str(out[col])
        if value not in le.classes_:
            raise UnknownCategoryError(
                f"Unknown value '{value}' for {col}. Allowed: {', '.join(map(str, le.classes_))}"
            )
        out[col] = le.transform([value])[0]
    return out


def risk_level(prob: float, artifacts: MLArtifacts) -> str:
    # high = at/above the model's decision threshold (F1-optimal on training CV);
    # medium = above the average churn rate but below that threshold.
    if prob >= artifacts.threshold_high:
        return "high"
    if prob >= artifacts.threshold_medium:
        return "medium"
    return "low"


# Fallback only (XGBoost log-odds scale). The live cut-off is model_meta.json
# "min_reason_shap", derived from the data at training time because the SHAP scale
# depends on the model type.
MIN_REASON_SHAP = 0.1


def _fmt(value: float) -> str:
    return f"{value:g}" if float(value).is_integer() else f"{value:.1f}"


def describe_feature(feat: str, value, medians: dict | None = None) -> str:
    """Human label that matches the customer's actual value, not a fixed assumption."""
    medians = medians or TRAINING_MEDIANS
    if feat in VALUE_AWARE_LABELS and value is not None and not pd.isna(value):
        low, high, unit = VALUE_AWARE_LABELS[feat]
        label = low if float(value) <= medians[feat] else high
        if isinstance(unit, tuple):
            unit = unit[0] if float(value) == 1 else unit[1]
        return f"{label} ({_fmt(float(value))}{unit})"
    if feat == "Complain":
        return "recent complaint filed" if value and float(value) > 0 else "no complaint filed"
    if feat == "sentiment_score" and value is not None and not pd.isna(value):
        return f"{'negative' if float(value) < 0 else 'positive'} review sentiment ({float(value):.2f})"
    if feat == "PreferedOrderCat" and value is not None:
        return f"preferred order category ({value})"
    return FEATURE_LABELS.get(feat, feat)


def reason_impacts_for_row(
    shap_row: np.ndarray,
    raw_row: pd.Series,
    n: int = 5,
    behavioral_only: bool = True,
    medians: dict | None = None,
    exclude: frozenset[str] = frozenset(),
    min_shap: float | None = None,
) -> list[dict]:
    """Top-n features meaningfully pushing this row toward churn, each with a label
    describing the customer's real value and impact_pct = that feature's share of the
    total positive (churn-pushing) SHAP weight among eligible features. Features whose
    push is below MIN_REASON_SHAP are omitted, so a very safe customer can have none."""
    eligible = set(BEHAVIORAL_COLS) if behavioral_only else set(FEATURE_COLS)
    positive = [
        (feat, float(val))
        for feat, val in zip(FEATURE_COLS, shap_row)
        if feat in eligible and feat not in exclude and val > 0
    ]
    total = sum(val for _, val in positive) or 1.0
    positive.sort(key=lambda t: t[1], reverse=True)

    return [
        {
            "label": describe_feature(feat, raw_row.get(feat), medians),
            "impact_pct": round((val / total) * 100, 1),
        }
        for feat, val in positive[:n]
        if val >= (MIN_REASON_SHAP if min_shap is None else min_shap)
    ]


def explain(
    prob: float,
    shap_row: np.ndarray,
    raw_row: pd.Series,
    artifacts: MLArtifacts,
    exclude: frozenset[str] = frozenset(),
) -> dict:
    """Packages a probability + its SHAP row into the stored/returned shape. Shared
    by live prediction and by seeding (which passes out-of-fold values). `exclude`
    hides features that were imputed rather than observed (e.g. sentiment when the
    customer gave no review) so they are never presented as a reason."""
    level = risk_level(prob, artifacts)
    # A low-risk customer has no churn drivers worth acting on; listing the few
    # features nudging a 0.1% probability upward reads as "reasons to churn".
    impacts = (
        []
        if level == "low"
        else reason_impacts_for_row(
            shap_row,
            raw_row,
            n=5,
            behavioral_only=True,
            medians=artifacts.training_medians,
            exclude=exclude,
            min_shap=artifacts.min_reason_shap,
        )
    )
    return {
        "churn_probability": float(prob),
        "risk_level": level,
        "top_reasons": [r["label"] for r in impacts],
        "reason_impacts": impacts,
    }


def predict_and_explain(
    raw_row: pd.Series, artifacts: MLArtifacts, exclude: frozenset[str] = frozenset()
) -> dict:
    encoded = encode_row(raw_row[FEATURE_COLS], artifacts.label_encoders)
    X = encoded.to_frame().T[artifacts.feature_columns].astype(float)

    prob = float(artifacts.model.predict_proba(X)[0, 1])

    shap_values = artifacts.shap_explainer.shap_values(X)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    shap_values = np.asarray(shap_values)
    shap_row = shap_values[0, :, 1] if shap_values.ndim == 3 else shap_values[0]

    return explain(prob, shap_row, normalize_categories(raw_row), artifacts, exclude)
