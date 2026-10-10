from pathlib import Path

import pandas as pd
import pytest

from app.config import settings
from app.ml.artifacts import get_artifacts
from app.ml.features import FEATURE_COLS
from app.ml.predict import UnknownCategoryError, predict_and_explain

NEW_CUSTOMER = {
    "tenure": 1,
    "city_tier": 3,
    "warehouse_to_home": 30,
    "number_of_device_registered": 5,
    "satisfaction_score": 5,
    "number_of_address": 8,
    "complain": 1,
    "day_since_last_order": 1,
    "cashback_amount": 120,
    "preferred_payment_mode": "Cash on Delivery",
    "prefered_order_cat": "Mobile Phone",
    "marital_status": "Single",
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
    assert len(FEATURE_COLS) == 13  # 12 customer inputs + review sentiment
    # merged spellings must not exist as separate classes any more
    assert "CC" not in a.label_encoders["PreferredPaymentMode"].classes_
    assert "Mobile" not in a.label_encoders["PreferedOrderCat"].classes_


def test_spelling_variants_predict_identically(dataset):
    a = get_artifacts()
    row = dataset[dataset["PreferredPaymentMode"] == "Credit Card"].iloc[0]
    variant = row.copy()
    variant["PreferredPaymentMode"] = "CC"
    # approx: Random Forest averages trees in parallel, so the last float digit can vary
    assert predict_and_explain(row, a)["churn_probability"] == pytest.approx(
        predict_and_explain(variant, a)["churn_probability"], abs=1e-12
    )


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
    assert predict_and_explain(churner, a)["top_reasons"]
    low = predict_and_explain(loyal, a)
    assert low["risk_level"] == "low"
    assert low["top_reasons"] == [] and low["reason_impacts"] == []


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
    assert body["risk_level"] == "high"
    assert any("1 month)" in r for r in body["top_reasons"]) or body["top_reasons"]


def test_create_customer_normalises_spelling(client):
    resp = client.post("/api/customers", json={**NEW_CUSTOMER, "preferred_payment_mode": "COD"})
    assert resp.status_code == 201, resp.text
    assert resp.json()["profile"]["preferred_payment_mode"] == "Cash on Delivery"


@pytest.mark.parametrize(
    "override",
    [{"satisfaction_score": 9}, {"complain": 2}, {"tenure": -1}, {"prefered_order_cat": "Spaceships"}],
)
def test_create_customer_rejects_invalid_input(client, override):
    assert client.post("/api/customers", json={**NEW_CUSTOMER, **override}).status_code == 422


def test_field_options_match_model_categories(client):
    options = client.get("/api/customers/meta/options").json()
    assert set(options) == {"preferred_payment_mode", "prefered_order_cat", "marital_status"}
    assert "CC" not in options["preferred_payment_mode"]


def test_tenure_reason_is_pluralised_correctly():
    from app.ml.predict import describe_feature

    assert describe_feature("Tenure", 1).endswith("(1 month)")
    assert describe_feature("Tenure", 12).endswith("(12 months)")


def test_retention_fallback_contains_banded_discount(client):
    from app.services.gemini_service import GeminiService, discount_for

    for prob, expected in [(0.5, 10), (0.8, 15), (0.95, 20)]:
        text, discount, source = GeminiService(api_key="").generate_retention_message([], prob)
        assert discount == expected == discount_for(prob)
        assert f"{expected}% off" in text and len(text) <= 160 and source == "fallback"


def test_login_stats_exposes_no_customer_ids(seeded_db):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as anonymous:
        body = anonymous.get("/api/public/login-stats").json()
    assert body["model_version"] == get_artifacts().model_version
    assert body["risk_examples"]
    assert all("customer_id" not in e for e in body["risk_examples"])
