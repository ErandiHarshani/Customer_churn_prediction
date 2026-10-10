import json
from functools import lru_cache
from pathlib import Path

import joblib

from app.config import settings
from app.ml.features import FEATURE_COLS, TRAINING_MEDIANS


class MLArtifacts:
    """Everything produced by mlpart/train_model.py. model_meta.json decides which
    model serves predictions and which risk thresholds apply, so retraining never
    needs a code change here."""

    def __init__(self):
        artifact_dir = Path(settings.ML_ARTIFACT_DIR)

        self.meta: dict = json.loads((artifact_dir / "model_meta.json").read_text())
        self.metrics: dict = json.loads((artifact_dir / "metrics.json").read_text())
        with open(artifact_dir / "model_comparison.json") as f:
            self.model_comparison = json.load(f)

        self.model_name: str = self.meta["model_name"]
        self.model_version: str = self.meta["version"]
        self.model = joblib.load(artifact_dir / self.meta["model_file"])
        self.label_encoders: dict = joblib.load(artifact_dir / "label_encoders.joblib")
        self.feature_columns: list[str] = joblib.load(artifact_dir / "feature_columns.joblib")
        self.shap_explainer = joblib.load(artifact_dir / "shap_explainer.joblib")

        self.threshold_high: float = float(self.meta["threshold_high"])
        self.threshold_medium: float = float(self.meta["threshold_medium"])
        self.min_reason_shap: float | None = self.meta.get("min_reason_shap")
        self.training_medians: dict = {**TRAINING_MEDIANS, **self.meta.get("training_medians", {})}

        if list(self.feature_columns) != list(FEATURE_COLS):
            raise RuntimeError(
                "feature_columns.joblib does not match app.ml.features.FEATURE_COLS — "
                "the backend's feature ordering is out of sync with the trained model."
            )


@lru_cache
def get_artifacts() -> MLArtifacts:
    return MLArtifacts()
