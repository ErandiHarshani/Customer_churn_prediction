"""Serves the held-out evaluation written by mlpart/train_model.py (metrics.json).

These numbers are NOT recomputed here on purpose: the serving model is refit on
100% of the data, so scoring any slice of the CSV with it would be in-sample and
look better than reality. The training script evaluates on a held-out split the
model never saw (duplicate rows kept on one side), and those are the honest figures."""

from app.ml.artifacts import get_artifacts


def compute_model_curves() -> dict:
    artifacts = get_artifacts()
    return {
        name: {
            "fpr": report["roc"]["fpr"],
            "tpr": report["roc"]["tpr"],
            "auc": report["roc_auc"],
            "accuracy": report["accuracy"],
        }
        for name, report in artifacts.metrics["models"].items()
    }
