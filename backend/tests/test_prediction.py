from pathlib import Path

import pandas as pd
import pytest

from app.config import settings
from app.ml.artifacts import get_artifacts
from app.ml.features import FEATURE_COLS
from app.ml.predict import UnknownCategoryError, predict_and_explain

NEW_CUSTOMER = {
    "tenure": 10,
    "city_tier": 1,
    "warehouse_to_home": 12,
    "preferred_login_device": "Mobile Phone",
    "preferred_payment_mode": "Debit Card",
    "gender": "Male",
    "hour_spend_on_app": 3,
    "number_of_device_registered": 4,
    "prefered_order_cat": "Laptop & Accessory",
    "satisfaction_score": 3,
    "marital_status": "Married",
    "number_of_address": 3,
    "complain": 0,
    "order_amount_hike_from_last_year": 15,
    "coupon_used": 1,
    "order_count": 2,
    "day_since_last_order": 3,
    "cashback_amount": 160,
}


@pytest.fixture(scope="module")
def dataset() -> pd.DataFrame:
    return pd.read_csv(settings.RAW_CSV_PATH)


@pytest.fixture(scope="module")
def scores() -> pd.DataFrame:
    return pd.read_csv(Path(settings.ML_ARTIFACT_DIR) / "customer_scores.csv").set_index("CustomerID")


def test_artifacts_are_consistent():
    a = get_artifacts()
    assert a.feature_columns == FEATURE_COLS
    assert a.meta["feature_columns"] == FEATURE_COLS
    assert a.model_name in a.metrics["models"]
    assert 0 < a.threshold_medium < a.threshold_high < 1
    # merged spellings must not exist as separate classes any more
    assert "CC" not in a.label_encoders["PreferredPaymentMode"].classes_
    assert "Phone" not in a.label_encoders["PreferredLoginDevice"].classes_
    assert "Mobile" not in a.label_encoders["PreferedOrderCat"].classes_


def test_spelling_variants_predict_identically(dataset):
    a = get_artifacts()
    row = dataset[dataset["PreferredPaymentMode"] == "Credit Card"].iloc[0]
    variant = row.copy()
    variant["PreferredPaymentMode"] = "CC"
    assert predict_and_explain(row, a)["churn_probability"] == predict_and_explain(variant, a)["churn_probability"]


def test_unknown_category_is_rejected(dataset):
    row = dataset.iloc[0].copy()
    row["PreferedOrderCat"] = "Spaceships"
    with pytest.raises(UnknownCategoryError):
        predict_and_explain(row, get_artifacts())


def test_held_out_metrics_are_sane():
    report = get_artifacts().metrics["models"][get_artifacts().model_name]
    assert report["roc_auc"] > 0.9
    # calibrated: mean predicted probability close to the real churn rate
    assert abs(report["mean_predicted_probability"] - report["actual_churn_rate"]) < 0.03


def test_live_model_separates_churners(dataset, scores):
    a = get_artifacts()
    merged = dataset.join(scores["churn_probability"], on="CustomerID")
    churner = merged[merged["Churn"] == 1].sort_values("churn_probability").iloc[-1]
    loyal = merged[merged["Churn"] == 0].sort_values("churn_probability").iloc[0]
    assert predict_and_explain(churner, a)["risk_level"] == "high"
    assert predict_and_explain(loyal, a)["risk_level"] == "low"


def test_seeded_customers_use_out_of_fold_scores(client, scores):
    items = client.get("/api/customers", params={"page_size": 5}).json()["items"]
    assert items
    for item in items:
        assert item["churn_probability"] == pytest.approx(scores.loc[item["customer_id"], "churn_probability"])


def test_dashboard_reports_held_out_metrics(client):
    summary = client.get("/api/dashboard/summary").json()
    a = get_artifacts()
    assert summary["best_model_name"] == a.model_name
    assert summary["risk_threshold_high"] == a.threshold_high
    assert all(m["precision"] is not None and m["recall"] is not None for m in summary["model_metrics"])
    assert summary["total_customers"] == 5630
    assert abs(summary["predicted_churn_rate"] - summary["actual_churn_rate"]) < 0.03
    assert client.get("/api/dashboard/roc-curve").status_code == 200


def test_create_customer_without_review_uses_training_median(client):
    resp = client.post("/api/customers", json=NEW_CUSTOMER)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    a = get_artifacts()
    assert body["profile"]["sentiment_score"] == a.training_medians["sentiment_score"]
    assert body["profile"]["sentiment_label"] == "not provided"
    assert not any("sentiment" in r for r in body["top_reasons"])
    assert body["risk_level"] in {"low", "medium", "high"}


def test_create_customer_normalises_spelling(client):
    resp = client.post("/api/customers", json={**NEW_CUSTOMER, "preferred_payment_mode": "CC"})
    assert resp.status_code == 201, resp.text
    assert resp.json()["profile"]["preferred_payment_mode"] == "Credit Card"


@pytest.mark.parametrize(
    "override",
    [{"satisfaction_score": 9}, {"complain": 2}, {"tenure": -1}, {"prefered_order_cat": "Spaceships"}],
)
def test_create_customer_rejects_invalid_input(client, override):
    assert client.post("/api/customers", json={**NEW_CUSTOMER, **override}).status_code == 422
