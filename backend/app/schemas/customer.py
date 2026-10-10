from pydantic import BaseModel

from app.schemas.retention import RetentionMessageResponse, SmsLogEntry


class CustomerSummary(BaseModel):
    customer_id: int
    churn_probability: float
    risk_level: str
    tenure: float | None
    prefered_order_cat: str | None
    complain: int | None
    sentiment_label: str | None

    class Config:
        from_attributes = True


class CustomerListResponse(BaseModel):
    items: list[CustomerSummary]
    total: int
    page: int
    page_size: int


class CustomerProfile(BaseModel):
    tenure: float | None
    city_tier: int | None
    warehouse_to_home: float | None
    preferred_login_device: str | None
    preferred_payment_mode: str | None
    gender: str | None
    hour_spend_on_app: float | None
    number_of_device_registered: int | None
    prefered_order_cat: str | None
    satisfaction_score: int | None
    marital_status: str | None
    number_of_address: int | None
    complain: int | None
    order_amount_hike_from_last_year: float | None
    coupon_used: float | None
    order_count: float | None
    day_since_last_order: float | None
    cashback_amount: float | None
    review_text: str | None
    review_rating: int | None
    sentiment_score: float | None
    sentiment_label: str | None
    review_is_synthetic: bool
    last_product_purchased: str | None
    last_product_purchased_is_generated: bool

    class Config:
        from_attributes = True


class ReasonImpact(BaseModel):
    label: str
    impact_pct: float


class CustomerDetail(BaseModel):
    customer_id: int
    profile: CustomerProfile
    churn_probability: float
    risk_level: str
    top_reasons: list[str]
    reason_impacts: list[ReasonImpact]
    phone_number: str | None
    latest_retention_message: RetentionMessageResponse | None
    sms_log: list[SmsLogEntry]


class UpdatePhoneRequest(BaseModel):
    phone_number: str


class CreateCustomerRequest(BaseModel):
    tenure: float
    city_tier: int
    warehouse_to_home: float
    preferred_login_device: str
    preferred_payment_mode: str
    gender: str
    hour_spend_on_app: float
    number_of_device_registered: int
    prefered_order_cat: str
    satisfaction_score: int
    marital_status: str
    number_of_address: int
    complain: int
    order_amount_hike_from_last_year: float
    coupon_used: float
    order_count: float
    day_since_last_order: float
    cashback_amount: float
    review_text: str | None = None
    phone_number: str | None = None
    last_product_purchased: str | None = None


class CustomerFieldOptions(BaseModel):
    preferred_login_device: list[str]
    preferred_payment_mode: list[str]
    gender: list[str]
    prefered_order_cat: list[str]
    marital_status: list[str]
