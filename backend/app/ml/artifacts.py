import json
from functools import lru_cache
from pathlib import Path

import joblib

from app.config import settings
from app.ml.features import FEATURE_COLS


class MLArtifacts:
    def __init__(self):
        artifact_dir = Path(settings.ML_ARTIFACT_DIR)

        self.xgb_model = joblib.load(artifact_dir / "xgb_churn_model.joblib")
        self.rf_model = joblib.load(artifact_dir / "rf_churn_model.joblib")
        self.label_encoders: dict = joblib.load(artifact_dir / "label_encoders.joblib")
        self.feature_columns: list[str] = joblib.load(artifact_dir / "feature_columns.joblib")
        self.shap_explainer = joblib.load(artifact_dir / "shap_explainer.joblib")

        with open(artifact_dir / "model_comparison.json") as f:
            self.model_comparison = json.load(f)

        if list(self.feature_columns) != list(FEATURE_COLS):
            raise RuntimeError(
                "feature_columns.joblib does not match app.ml.features.FEATURE_COLS — "
                "the backend's feature ordering is out of sync with the trained model."
            )


@lru_cache
def get_artifacts() -> MLArtifacts:
    return MLArtifacts()
