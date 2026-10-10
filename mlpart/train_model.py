"""Reproducible local training for the churn model (replaces the training half of
02_model_training_shap_retention.ipynb for serving purposes).

What it fixes compared with the notebook:
- Category spelling variants are merged (shared with the backend via app.ml.features).
- Rows that are exact duplicates of each other (same behaviour + label, different
  CustomerID) are kept in the same fold, so no "twin" leaks across a split.
- The model is chosen by cross-validation on the training part only; the 20%
  held-out test set is used once, for the reported metrics.
- No class re-weighting, so predicted probabilities stay calibrated; the decision
  threshold is chosen on training out-of-fold predictions instead.
- Every seeded customer gets an out-of-fold probability + SHAP explanation, so the
  dashboard never shows a prediction made on a row the model was trained on.

No Gemini calls: it reuses the sentiment_score column already in the CSV.

Run from the backend venv (so the pickles match the API's library versions):
    cd backend && .venv/bin/python ../mlpart/train_model.py
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "backend"))

from app.ml.features import CATEGORICAL_COLS, FEATURE_COLS, NUMERIC_COLS, normalize_categories  # noqa: E402

SEED = 42
N_FOLDS = 5
TARGET = "Churn"
MODEL_FILES = {"XGBoost": "xgb_churn_model.joblib", "Random Forest": "rf_churn_model.joblib"}


def make_model(name: str):
    # Same hyperparameters as the notebook, minus scale_pos_weight / class_weight.
    if name == "XGBoost":
        return XGBClassifier(
            n_estimators=300,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            eval_metric="logloss",
            random_state=SEED,
        )
    return RandomForestClassifier(n_estimators=400, max_depth=10, random_state=SEED, n_jobs=-1)


def churn_shap(explainer, X: pd.DataFrame) -> np.ndarray:
    """SHAP values for the churn class as (n_rows, n_features), whatever the shap
    version / model type returns."""
    values = explainer.shap_values(X)
    if isinstance(values, list):
        values = values[1]
    values = np.asarray(values)
    if values.ndim == 3:
        values = values[:, :, 1]
    return values


def splitter() -> StratifiedGroupKFold:
    return StratifiedGroupKFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)


def oof_predict(name: str, X: pd.DataFrame, y: pd.Series, groups: np.ndarray) -> tuple[np.ndarray, list[float]]:
    oof = np.zeros(len(X))
    fold_aucs = []
    for tr, te in splitter().split(X, y, groups):
        model = make_model(name).fit(X.iloc[tr], y.iloc[tr])
        oof[te] = model.predict_proba(X.iloc[te])[:, 1]
        fold_aucs.append(roc_auc_score(y.iloc[te], oof[te]))
    return oof, fold_aucs


def best_f1_threshold(y: pd.Series, proba: np.ndarray) -> float:
    precision, recall, thresholds = precision_recall_curve(y, proba)
    f1 = 2 * precision * recall / np.clip(precision + recall, 1e-9, None)
    return round(float(thresholds[np.argmax(f1[:-1])]), 3)


def downsample(values: np.ndarray, max_points: int = 60) -> list[float]:
    values = [round(float(v), 4) for v in values]
    if len(values) <= max_points:
        return values
    step = max(1, len(values) // max_points)
    idx = sorted(set(range(0, len(values), step)) | {len(values) - 1})
    return [values[i] for i in idx]


def test_metrics(y: pd.Series, proba: np.ndarray, threshold: float) -> dict:
    pred = (proba >= threshold).astype(int)
    fpr, tpr, _ = roc_curve(y, proba)
    tn, fp, fn, tp = confusion_matrix(y, pred).ravel()
    return {
        "roc_auc": round(float(roc_auc_score(y, proba)), 4),
        "accuracy": round(float(accuracy_score(y, pred)), 4),
        "precision": round(float(precision_score(y, pred)), 4),
        "recall": round(float(recall_score(y, pred)), 4),
        "f1": round(float(f1_score(y, pred)), 4),
        "brier": round(float(brier_score_loss(y, proba)), 4),
        "threshold": threshold,
        "mean_predicted_probability": round(float(proba.mean()), 4),
        "actual_churn_rate": round(float(y.mean()), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "roc": {"fpr": downsample(fpr), "tpr": downsample(tpr)},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(HERE / "churn_prediction_project" / "churn_with_sentiment.csv"))
    parser.add_argument("--out", default=str(HERE / "churn_prediction_project" / "artifacts"))
    args = parser.parse_args()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    # ---- data ------------------------------------------------------------
    df = normalize_categories(pd.read_csv(args.data))
    encoders = {}
    X = df[FEATURE_COLS].copy()
    for col in CATEGORICAL_COLS:
        encoders[col] = LabelEncoder().fit(X[col].astype(str))
        X[col] = encoders[col].transform(X[col].astype(str))
    X = X.astype(float)
    y = df[TARGET].astype(int)

    # Rows identical on every behavioural feature + label share a group, so they
    # always land on the same side of any split.
    behavioural = [c for c in FEATURE_COLS if c != "sentiment_score"]
    groups = df[behavioural + [TARGET]].astype(str).agg("|".join, axis=1).values
    n_duplicate_rows = int(pd.Series(groups).duplicated(keep=False).sum())

    # ---- held-out test split (used once, for reporting) -------------------
    train_idx, test_idx = next(splitter().split(X, y, groups))
    X_tr, y_tr, g_tr = X.iloc[train_idx], y.iloc[train_idx], groups[train_idx]
    X_te, y_te = X.iloc[test_idx], y.iloc[test_idx]
    assert not set(g_tr) & set(groups[test_idx]), "duplicate rows leaked across the split"

    # ---- model selection: CV on the training part only --------------------
    selection = {}
    for name in MODEL_FILES:
        oof, fold_aucs = oof_predict(name, X_tr, y_tr, g_tr)
        selection[name] = {
            "cv_auc_mean": round(float(np.mean(fold_aucs)), 4),
            "cv_auc_std": round(float(np.std(fold_aucs)), 4),
            "threshold": best_f1_threshold(y_tr, oof),
        }
        print(f"[cv] {name}: AUC {selection[name]['cv_auc_mean']} ± {selection[name]['cv_auc_std']}, "
              f"F1-optimal threshold {selection[name]['threshold']}")
    chosen = max(selection, key=lambda n: selection[n]["cv_auc_mean"])
    print(f"[cv] selected: {chosen}")

    # ---- sentiment ablation (training part, same CV) ----------------------
    no_sent = [c for c in FEATURE_COLS if c != "sentiment_score"]
    _, aucs_without = oof_predict(chosen, X_tr[no_sent], y_tr, g_tr)
    _, aucs_only = oof_predict(chosen, X_tr[["sentiment_score"]], y_tr, g_tr)
    ablation = {
        "cv_auc_with_sentiment": selection[chosen]["cv_auc_mean"],
        "cv_auc_without_sentiment": round(float(np.mean(aucs_without)), 4),
        "cv_auc_sentiment_only": round(float(np.mean(aucs_only)), 4),
    }
    print(f"[ablation] {ablation}")

    # ---- held-out test evaluation -----------------------------------------
    models_report = {}
    for name in MODEL_FILES:
        model = make_model(name).fit(X_tr, y_tr)
        proba = model.predict_proba(X_te)[:, 1]
        models_report[name] = {**test_metrics(y_te, proba, selection[name]["threshold"]), **selection[name]}
        r = models_report[name]
        print(f"[test] {name}: AUC {r['roc_auc']} acc {r['accuracy']} P {r['precision']} R {r['recall']} "
              f"F1 {r['f1']} Brier {r['brier']} mean p {r['mean_predicted_probability']} "
              f"(actual {r['actual_churn_rate']})")

    # ---- out-of-fold scores + SHAP for every customer (dashboard/seed) ----
    oof_all = np.zeros(len(X))
    shap_all = np.zeros((len(X), len(FEATURE_COLS)))
    for tr, te in splitter().split(X, y, groups):
        fold_model = make_model(chosen).fit(X.iloc[tr], y.iloc[tr])
        oof_all[te] = fold_model.predict_proba(X.iloc[te])[:, 1]
        shap_all[te] = churn_shap(shap.TreeExplainer(fold_model), X.iloc[te])
    scores = pd.DataFrame(shap_all, columns=[f"shap_{c}" for c in FEATURE_COLS])
    scores.insert(0, "churn_probability", oof_all)
    scores.insert(0, "CustomerID", df["CustomerID"].values)
    scores.to_csv(out_dir / "customer_scores.csv", index=False)
    print(f"[oof] all {len(X)} customers: AUC {roc_auc_score(y, oof_all):.4f}, mean p {oof_all.mean():.4f}")

    # ---- final serving models: refit on 100% of the data ------------------
    final_models = {name: make_model(name).fit(X, y) for name in MODEL_FILES}
    for name, model in final_models.items():
        joblib.dump(model, out_dir / MODEL_FILES[name])
    joblib.dump(encoders, out_dir / "label_encoders.joblib")
    joblib.dump(list(FEATURE_COLS), out_dir / "feature_columns.joblib")
    joblib.dump(shap.TreeExplainer(final_models[chosen]), out_dir / "shap_explainer.joblib")

    threshold_high = selection[chosen]["threshold"]
    threshold_medium = round(float(y.mean()), 3)  # above the average churn rate
    if threshold_medium >= threshold_high:
        threshold_medium = round(threshold_high / 2, 3)

    meta = {
        "model_name": chosen,
        "model_file": MODEL_FILES[chosen],
        "version": datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S"),
        "trained_on_rows": int(len(X)),
        "feature_columns": list(FEATURE_COLS),
        "threshold_high": threshold_high,
        "threshold_medium": threshold_medium,
        "training_medians": {c: round(float(df[c].median()), 4) for c in NUMERIC_COLS},
        "category_values": {c: list(map(str, encoders[c].classes_)) for c in CATEGORICAL_COLS},
    }
    (out_dir / "model_meta.json").write_text(json.dumps(meta, indent=2))

    metrics = {
        "selected_model": chosen,
        "selection_method": f"highest mean ROC-AUC, {N_FOLDS}-fold grouped stratified CV on the training split",
        "split": {
            "method": "StratifiedGroupKFold hold-out (duplicate rows kept together)",
            "n_train": int(len(train_idx)),
            "n_test": int(len(test_idx)),
            "duplicate_rows_grouped": n_duplicate_rows,
        },
        "models": models_report,
        "sentiment_ablation": ablation,
        "out_of_fold_all_customers": {
            "roc_auc": round(float(roc_auc_score(y, oof_all)), 4),
            "mean_predicted_probability": round(float(oof_all.mean()), 4),
        },
    }
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))

    comparison = [
        {k: models_report[name][k] for k in ("roc_auc", "f1", "accuracy", "precision", "recall", "threshold")}
        | {"name": name}
        for name in sorted(models_report, key=lambda n: selection[n]["cv_auc_mean"], reverse=True)
    ]
    (out_dir / "model_comparison.json").write_text(json.dumps(comparison, indent=2))

    print(f"[done] {chosen} saved to {out_dir} — risk bands: high >= {threshold_high}, "
          f"medium >= {threshold_medium}")


if __name__ == "__main__":
    main()
