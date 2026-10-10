"""Re-scores every customer already in the DB with the current model artifacts,
in place — phone numbers, products, retention messages and SMS logs are kept.
Run this after retraining (mlpart/train_model.py) instead of `app.seed --reset`.

- Seeded (dataset) customers get their out-of-fold probability + SHAP reasons from
  artifacts/customer_scores.csv, so no customer is scored by a model trained on them.
- Customers created via the Predict Customer form are re-run through the live model.
  Their review (if any) is re-scored with Gemini; without a review, or if Gemini is
  unavailable, the training median is used and sentiment is not shown as a reason.
- Category spelling variants are normalised on every row.

Run with: python -m scripts.recompute_reasons
"""

from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from app.config import settings
from app.database import SessionLocal
from app.ml.artifacts import get_artifacts
from app.ml.features import FEATURE_COLS, normalize_category
from app.ml.predict import explain, predict_and_explain
from app.models.customer import Customer
from app.services.gemini_service import build_gemini_service

COLUMN_MAP = {
    "Tenure": "tenure",
    "CityTier": "city_tier",
    "WarehouseToHome": "warehouse_to_home",
    "HourSpendOnApp": "hour_spend_on_app",
    "NumberOfDeviceRegistered": "number_of_device_registered",
    "SatisfactionScore": "satisfaction_score",
    "NumberOfAddress": "number_of_address",
    "Complain": "complain",
    "OrderAmountHikeFromlastYear": "order_amount_hike_from_last_year",
    "CouponUsed": "coupon_used",
    "OrderCount": "order_count",
    "DaySinceLastOrder": "day_since_last_order",
    "CashbackAmount": "cashback_amount",
    "sentiment_score": "sentiment_score",
    "PreferredLoginDevice": "preferred_login_device",
    "PreferredPaymentMode": "preferred_payment_mode",
    "Gender": "gender",
    "PreferedOrderCat": "prefered_order_cat",
    "MaritalStatus": "marital_status",
}
CATEGORY_COLUMNS = ["PreferredLoginDevice", "PreferredPaymentMode", "PreferedOrderCat"]


def main() -> None:
    artifacts = get_artifacts()
    scores = pd.read_csv(Path(settings.ML_ARTIFACT_DIR) / "customer_scores.csv").set_index("CustomerID")
    shap_cols = [f"shap_{c}" for c in FEATURE_COLS]

    db = SessionLocal()
    gemini = build_gemini_service(db)
    try:
        customers = db.query(Customer).all()
        for i, customer in enumerate(customers, 1):
            for feat in CATEGORY_COLUMNS:
                col = COLUMN_MAP[feat]
                setattr(customer, col, normalize_category(feat, getattr(customer, col)))

            if customer.review_is_synthetic and customer.customer_id in scores.index:
                row = pd.Series({feat: getattr(customer, col) for feat, col in COLUMN_MAP.items()})
                score = scores.loc[customer.customer_id]
                pred = explain(
                    float(score["churn_probability"]),
                    score[shap_cols].to_numpy(dtype=np.float64),
                    row,
                    artifacts,
                )
            else:
                scored = gemini.score_sentiment(customer.review_text) if customer.review_text else None
                if scored is not None:
                    customer.sentiment_score, customer.sentiment_label = scored
                    exclude = frozenset()
                else:
                    customer.sentiment_score = artifacts.training_medians["sentiment_score"]
                    customer.sentiment_label = "unavailable" if customer.review_text else "not provided"
                    exclude = frozenset({"sentiment_score"})
                row = pd.Series({feat: getattr(customer, col) for feat, col in COLUMN_MAP.items()})
                pred = predict_and_explain(row, artifacts, exclude=exclude)

            customer.churn_probability = pred["churn_probability"]
            customer.risk_level = pred["risk_level"]
            customer.top_reasons = pred["top_reasons"]
            customer.reason_impacts = pred["reason_impacts"]
            customer.predicted_at = datetime.now(timezone.utc)
            if i % 500 == 0:
                db.commit()
                print(f"  recomputed {i} customers...")
        db.commit()
        print(f"Done: {len(customers)} customers recomputed with model {artifacts.model_name} "
              f"v{artifacts.model_version}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
