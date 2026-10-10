"""One-time (idempotent) database seeding: reads the training CSV plus the
out-of-fold scores written by mlpart/train_model.py (artifacts/customer_scores.csv)
and writes every customer into SQLite.

Each customer's probability and SHAP reasons come from a fold model that never saw
that customer, so the dashboard's risk distribution is an honest out-of-sample view
rather than the serving model re-scoring its own training rows.

Run with: python -m app.seed [--reset]
"""

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.ml.artifacts import get_artifacts
from app.config import settings
from app.ml.features import FEATURE_COLS, normalize_categories
from app.ml.predict import explain
from app.models.customer import Customer
from app.models.retention_message import RetentionMessage
from app.models.sms_log import SmsLog


def seed_database(db: Session, reset: bool = False) -> int:
    Base.metadata.create_all(bind=engine)

    if reset:
        # customers added via the Predict form are dropped too, so drop their
        # messages/SMS logs as well rather than leaving orphans behind
        dataset_ids = [int(i) for i in pd.read_csv(settings.RAW_CSV_PATH, usecols=["CustomerID"])["CustomerID"]]
        db.query(SmsLog).filter(SmsLog.customer_id.notin_(dataset_ids)).delete(synchronize_session=False)
        db.query(RetentionMessage).filter(RetentionMessage.customer_id.notin_(dataset_ids)).delete(
            synchronize_session=False
        )
        db.query(Customer).delete()
        db.commit()

    if db.query(Customer).count() > 0 and not reset:
        print("customers table already seeded, skipping (use --reset to force).")
        return db.query(Customer).count()

    artifacts = get_artifacts()
    df = normalize_categories(pd.read_csv(settings.RAW_CSV_PATH))
    scores = pd.read_csv(Path(settings.ML_ARTIFACT_DIR) / "customer_scores.csv").set_index("CustomerID")
    shap_cols = [f"shap_{c}" for c in FEATURE_COLS]

    count = 0
    for _, row in df.iterrows():
        score = scores.loc[int(row["CustomerID"])]
        pred = explain(
            float(score["churn_probability"]), score[shap_cols].to_numpy(dtype=np.float64), row, artifacts
        )

        customer = Customer(
            customer_id=int(row["CustomerID"]),
            tenure=row.get("Tenure"),
            city_tier=row.get("CityTier"),
            warehouse_to_home=row.get("WarehouseToHome"),
            preferred_login_device=row.get("PreferredLoginDevice"),
            preferred_payment_mode=row.get("PreferredPaymentMode"),
            gender=row.get("Gender"),
            hour_spend_on_app=row.get("HourSpendOnApp"),
            number_of_device_registered=row.get("NumberOfDeviceRegistered"),
            prefered_order_cat=row.get("PreferedOrderCat"),
            satisfaction_score=row.get("SatisfactionScore"),
            marital_status=row.get("MaritalStatus"),
            number_of_address=row.get("NumberOfAddress"),
            complain=row.get("Complain"),
            order_amount_hike_from_last_year=row.get("OrderAmountHikeFromlastYear"),
            coupon_used=row.get("CouponUsed"),
            order_count=row.get("OrderCount"),
            day_since_last_order=row.get("DaySinceLastOrder"),
            cashback_amount=row.get("CashbackAmount"),
            review_text=row.get("review_text"),
            review_rating=row.get("review_rating"),
            sentiment_score=row.get("sentiment_score"),
            sentiment_label=row.get("sentiment_label"),
            review_is_synthetic=True,
            actual_churn=row.get("Churn"),
            churn_probability=pred["churn_probability"],
            risk_level=pred["risk_level"],
            top_reasons=pred["top_reasons"],
            reason_impacts=pred["reason_impacts"],
        )
        db.add(customer)
        count += 1

        if count % 500 == 0:
            db.commit()
            print(f"  seeded {count} customers...")

    db.commit()
    print(f"Seeding complete: {count} customers.")
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="delete existing rows and reseed")
    args = parser.parse_args()

    session = SessionLocal()
    try:
        seed_database(session, reset=args.reset)
    finally:
        session.close()
