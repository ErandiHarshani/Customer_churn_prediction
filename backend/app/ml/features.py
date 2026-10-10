# Ported verbatim from mlpart/02_model_training_shap_retention.ipynb (cells 6, 17).
# Keep these in sync with the notebook if the model is ever retrained.

CATEGORICAL_COLS = [
    "PreferredLoginDevice",
    "PreferredPaymentMode",
    "Gender",
    "PreferedOrderCat",
    "MaritalStatus",
]

NUMERIC_COLS = [
    "Tenure",
    "CityTier",
    "WarehouseToHome",
    "HourSpendOnApp",
    "NumberOfDeviceRegistered",
    "SatisfactionScore",
    "NumberOfAddress",
    "Complain",
    "OrderAmountHikeFromlastYear",
    "CouponUsed",
    "OrderCount",
    "DaySinceLastOrder",
    "CashbackAmount",
    "sentiment_score",
]

FEATURE_COLS = NUMERIC_COLS + CATEGORICAL_COLS

# Demographic/account-attribute features that are statistically valid SHAP contributors
# but make poor customer-facing retention copy ("because of your marital status").
# Excluded from top_reasons candidates; the model still sees and uses them.
DEMOGRAPHIC_COLS = {
    "Gender",
    "MaritalStatus",
    "CityTier",
    "PreferredLoginDevice",
    "PreferredPaymentMode",
}
BEHAVIORAL_COLS = [c for c in FEATURE_COLS if c not in DEMOGRAPHIC_COLS]

# Training-set medians (churn_with_sentiment.csv). A SHAP "reason" is described as
# low/high relative to these, so the wording always matches the customer's actual
# value — e.g. in this dataset a satisfaction score of 5 *raises* churn risk, and
# calling that "low satisfaction score" would be false.
TRAINING_MEDIANS = {
    "Tenure": 9.0,
    "CityTier": 1.0,
    "WarehouseToHome": 14.0,
    "HourSpendOnApp": 3.0,
    "NumberOfDeviceRegistered": 4.0,
    "SatisfactionScore": 3.0,
    "NumberOfAddress": 3.0,
    "Complain": 0.0,
    "OrderAmountHikeFromlastYear": 15.0,
    "CouponUsed": 1.0,
    "OrderCount": 2.0,
    "DaySinceLastOrder": 3.0,
    "CashbackAmount": 163.28,
    "sentiment_score": -0.4,
}

# (label when value <= median, label when value > median, unit shown after the value)
VALUE_AWARE_LABELS = {
    "Tenure": ("short customer tenure", "long customer tenure", " months"),
    "WarehouseToHome": ("short delivery distance", "long delivery distance", ""),
    "HourSpendOnApp": ("low app engagement", "high app engagement", " hrs"),
    "NumberOfDeviceRegistered": ("few registered devices", "many registered devices", ""),
    "SatisfactionScore": ("low satisfaction score", "high satisfaction score", "/5"),
    "NumberOfAddress": ("few saved addresses", "many saved addresses", ""),
    "OrderAmountHikeFromlastYear": ("small spend increase vs. last year", "large spend increase vs. last year", "%"),
    "CouponUsed": ("low coupon usage", "high coupon usage", ""),
    "OrderCount": ("few orders placed", "many orders placed", ""),
    "DaySinceLastOrder": ("recent last order", "long time since last order", " days"),
    "CashbackAmount": ("low cashback earned", "high cashback earned", ""),
}

FEATURE_LABELS = {
    "Tenure": "short customer tenure",
    "CityTier": "city tier",
    "WarehouseToHome": "long delivery distance",
    "HourSpendOnApp": "low app engagement",
    "NumberOfDeviceRegistered": "few registered devices",
    "SatisfactionScore": "low satisfaction score",
    "NumberOfAddress": "few saved addresses",
    "Complain": "recent complaint filed",
    "OrderAmountHikeFromlastYear": "reduced spend vs. last year",
    "CouponUsed": "low coupon usage",
    "OrderCount": "fewer orders placed",
    "DaySinceLastOrder": "long time since last order",
    "CashbackAmount": "low cashback earned",
    "sentiment_score": "negative review sentiment",
    "PreferredLoginDevice": "login device pattern",
    "PreferredPaymentMode": "payment mode pattern",
    "Gender": "gender",
    "PreferedOrderCat": "preferred order category",
    "MaritalStatus": "marital status",
}
