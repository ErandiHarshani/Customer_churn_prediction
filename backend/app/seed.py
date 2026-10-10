"""One-time (idempotent) database seeding: reads the training CSV, recomputes
churn_probability / risk_level / top_reasons for every customer using the live
XGBoost model + SHAP explainer, and writes it all into SQLite.

Run with: python -m app.seed [--reset]
"""

import argparse

import pandas as pd
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.ml.artifacts import get_artifacts
from app.ml.predict import predict_and_explain
from app.config import settings
from app.models.customer import Customer


def seed_database(db: Session, reset: bool = False) -> int:
    Base.metadata.create_all(bind=engine)

    if reset:
        db.query(Customer).delete()
        db.commit()

    if db.query(Customer).count() > 0 and not reset:
        print("customers table already seeded, skipping (use --reset to force).")
        return db.query(Customer).count()

    artifacts = get_artifacts()
    df = pd.read_csv(settings.RAW_CSV_PATH)

    count = 0
    for _, row in df.iterrows():
        pred = predict_and_explain(row, artifacts)

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
