from pydantic import BaseModel, Field

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
    # Hard limits are what is physically/semantically valid, not the training range.
    tenure: float = Field(ge=0, le=600)
    city_tier: int = Field(ge=1, le=3)
    warehouse_to_home: float = Field(ge=0, le=1000)
    preferred_login_device: str
    preferred_payment_mode: str
    gender: str
    hour_spend_on_app: float = Field(ge=0, le=24)
    number_of_device_registered: int = Field(ge=0, le=50)
    prefered_order_cat: str
    satisfaction_score: int = Field(ge=1, le=5)
    marital_status: str
    number_of_address: int = Field(ge=0, le=100)
    complain: int = Field(ge=0, le=1)
    order_amount_hike_from_last_year: float = Field(ge=-100, le=1000)
    coupon_used: float = Field(ge=0, le=1000)
    order_count: float = Field(ge=0, le=10000)
    day_since_last_order: float = Field(ge=0, le=3650)
    cashback_amount: float = Field(ge=0, le=100000)
    review_text: str | None = Field(default=None, max_length=2000)
    phone_number: str | None = Field(default=None, max_length=20)
    last_product_purchased: str | None = Field(default=None, max_length=200)


class CustomerFieldOptions(BaseModel):
    preferred_login_device: list[str]
    preferred_payment_mode: list[str]
    gender: list[str]
    prefered_order_cat: list[str]
    marital_status: list[str]
