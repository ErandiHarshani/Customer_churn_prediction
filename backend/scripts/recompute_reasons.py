"""Recomputes churn_probability / risk_level / top_reasons / reason_impacts for the
seeded (training-set) customers with the current predict_and_explain logic.

Customers created via the Predict Customer form are skipped: their stored
sentiment_score is the churn-aware display sentiment, not the review sentiment the
model was given, so re-running the model from the DB row would not be faithful.

Run with: python -m scripts.recompute_reasons
"""

import pandas as pd

from app.database import SessionLocal
from app.ml.artifacts import get_artifacts
from app.ml.predict import predict_and_explain
from app.models.customer import Customer

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


def main() -> None:
    artifacts = get_artifacts()
    db = SessionLocal()
    try:
        customers = db.query(Customer).filter(Customer.review_is_synthetic.is_(True)).all()
        for i, customer in enumerate(customers, 1):
            row = pd.Series({feat: getattr(customer, col) for feat, col in COLUMN_MAP.items()})
            pred = predict_and_explain(row, artifacts)
            customer.churn_probability = pred["churn_probability"]
            customer.risk_level = pred["risk_level"]
            customer.top_reasons = pred["top_reasons"]
            customer.reason_impacts = pred["reason_impacts"]
            if i % 500 == 0:
                db.commit()
                print(f"  recomputed {i} customers...")
        db.commit()
        print(f"Done: {len(customers)} seeded customers recomputed.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
