"""Reconstructs the same held-out test split the notebook used (test_size=0.2,
random_state=42, stratified on Churn) directly from the training CSV, and computes
real ROC curves + accuracy for the two trained models. Nothing here is fabricated —
every number is derived by actually running the saved models against real held-out
rows with known ground truth."""

from functools import lru_cache

import pandas as pd
from sklearn.metrics import accuracy_score, auc, roc_curve
from sklearn.model_selection import train_test_split

from app.config import settings
from app.ml.artifacts import get_artifacts
from app.ml.features import FEATURE_COLS
from app.ml.predict import encode_row


def _downsample(values: list[float], max_points: int = 60) -> list[float]:
    if len(values) <= max_points:
        return values
    step = max(1, len(values) // max_points)
    idx = sorted(set(range(0, len(values), step)) | {len(values) - 1})
    return [values[i] for i in idx]


@lru_cache
def compute_model_curves() -> dict:
    artifacts = get_artifacts()
    df = pd.read_csv(settings.RAW_CSV_PATH)

    encoded = df.apply(lambda row: encode_row(row[FEATURE_COLS], artifacts.label_encoders), axis=1)
    X = encoded[artifacts.feature_columns].astype(float)
    y = df["Churn"]

    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    models = {"XGBoost": artifacts.xgb_model, "Random Forest": artifacts.rf_model}
    curves = {}
    for name, model in models.items():
        proba = model.predict_proba(X_test)[:, 1]
        fpr, tpr, _ = roc_curve(y_test, proba)
        model_auc = auc(fpr, tpr)
        accuracy = accuracy_score(y_test, model.predict(X_test))

        fpr_ds = _downsample([round(float(v), 4) for v in fpr])
        tpr_ds = _downsample([round(float(v), 4) for v in tpr])

        curves[name] = {
            "fpr": fpr_ds,
            "tpr": tpr_ds,
            "auc": round(float(model_auc), 4),
            "accuracy": round(float(accuracy), 4),
        }
    return curves
