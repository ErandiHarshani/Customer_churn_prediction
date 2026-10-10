from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String, Text

from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, unique=True, index=True, nullable=False)

    # raw profile, mirrors churn_with_sentiment.csv
    tenure = Column(Float)
    city_tier = Column(Integer)
    warehouse_to_home = Column(Float)
    preferred_login_device = Column(String)
    preferred_payment_mode = Column(String)
    gender = Column(String)
    hour_spend_on_app = Column(Float)
    number_of_device_registered = Column(Integer)
    prefered_order_cat = Column(String)
    satisfaction_score = Column(Integer)
    marital_status = Column(String)
    number_of_address = Column(Integer)
    complain = Column(Integer)
    order_amount_hike_from_last_year = Column(Float)
    coupon_used = Column(Float)
    order_count = Column(Float)
    day_since_last_order = Column(Float)
    cashback_amount = Column(Float)
    review_text = Column(Text)
    review_rating = Column(Integer)
    sentiment_score = Column(Float)
    sentiment_label = Column(String)
    # True for the 5,630 seeded training-set customers: their review_text/sentiment
    # came from a simulated linkage to an unrelated reviews dataset (no real dataset
    # pairs churn behaviour with review text for the same customer — documented
    # limitation from the ML training phase), NOT something that customer actually
    # wrote. False for customers created via the Predict Customer form, whose review
    # text is genuinely their own input. Retention-message generation must not treat
    # a synthetic review's sentiment as a real fact about the customer.
    review_is_synthetic = Column(Boolean, default=False, nullable=False)
    actual_churn = Column(Integer)  # ground-truth label from the training CSV, reference only

    # not present in the source dataset — filled in by an admin from the customer detail page
    phone_number = Column(String, nullable=True)
    # free-text product note. Set directly (real) when an admin types it into the
    # Predict Customer form, or filled in afterwards by scripts/generate_products.py
    # for seeded customers (plausible product name picked from their real
    # prefered_order_cat — a generated example product, not a verified purchase).
    last_product_purchased = Column(String, nullable=True)
    last_product_purchased_is_generated = Column(Boolean, default=False, nullable=False)

    # precomputed at seed time from the trained XGBoost model + SHAP explainer
    churn_probability = Column(Float, index=True)
    risk_level = Column(String, index=True)
    top_reasons = Column(JSON)
    reason_impacts = Column(JSON)  # [{"label": str, "impact_pct": float}, ...]
    predicted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
