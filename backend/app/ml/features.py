# Model inputs. Reduced from the notebook's 19 to the 12 strongest behavioural /
# account inputs plus review sentiment (Gender, login device, coupons used, hours on
# app, order count and order-amount hike were dropped: together they added ~0.008
# ROC-AUC in grouped cross-validation, but made the form much longer).
# Keep in sync with mlpart/train_model.py, which imports these lists.

CATEGORICAL_COLS = [
    "PreferredPaymentMode",
    "PreferedOrderCat",
    "MaritalStatus",
]

NUMERIC_COLS = [
    "Tenure",
    "CityTier",
    "WarehouseToHome",
    "NumberOfDeviceRegistered",
    "SatisfactionScore",
    "NumberOfAddress",
    "Complain",
    "DaySinceLastOrder",
    "CashbackAmount",
    "sentiment_score",
]

FEATURE_COLS = NUMERIC_COLS + CATEGORICAL_COLS

# The source dataset records the same value under two spellings (e.g. "CC" and
# "Credit Card"). Left as-is, the model learns the spelling rather than the
# behaviour, and an admin's arbitrary choice in the form changes the prediction.
# Applied identically in training (mlpart/train_model.py) and at inference.
CATEGORY_ALIASES = {
    "PreferredLoginDevice": {"Phone": "Mobile Phone"},
    "PreferredPaymentMode": {"CC": "Credit Card", "COD": "Cash on Delivery"},
    "PreferedOrderCat": {"Mobile": "Mobile Phone"},
}


def normalize_category(col: str, value):
    if value is None:
        return value
    value = str(value).strip()
    return CATEGORY_ALIASES.get(col, {}).get(value, value)


def normalize_categories(data):
    """Works on a single row (pd.Series / dict) or a whole DataFrame."""
    out = data.copy()
    for col in CATEGORY_ALIASES:
        if col not in out:
            continue
        if hasattr(out[col], "map"):
            out[col] = out[col].map(lambda v: normalize_category(col, v))
        else:
            out[col] = normalize_category(col, out[col])
    return out

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

# Fallback only — the live values come from model_meta.json ("training_medians"),
# written by mlpart/train_model.py. A SHAP "reason" is described as
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

# (label when value <= median, label when value > median, unit shown after the value).
# A unit given as (singular, plural) is pluralised by value, e.g. "1 month" / "9 months".
VALUE_AWARE_LABELS = {
    "Tenure": ("short customer tenure", "long customer tenure", (" month", " months")),
    "WarehouseToHome": ("short warehouse-to-home distance", "long warehouse-to-home distance", ""),
    "NumberOfDeviceRegistered": ("few registered devices", "many registered devices", ""),
    "SatisfactionScore": ("low satisfaction score", "high satisfaction score", "/5"),
    "NumberOfAddress": ("few saved addresses", "many saved addresses", ""),
    "DaySinceLastOrder": ("recent last order", "long time since last order", (" day", " days")),
    "CashbackAmount": ("low cashback earned", "high cashback earned", ""),
}

FEATURE_LABELS = {
    "Tenure": "short customer tenure",
    "CityTier": "city tier",
    "WarehouseToHome": "long warehouse-to-home distance",
    "NumberOfDeviceRegistered": "few registered devices",
    "SatisfactionScore": "low satisfaction score",
    "NumberOfAddress": "few saved addresses",
    "Complain": "recent complaint filed",
    "DaySinceLastOrder": "long time since last order",
    "CashbackAmount": "low cashback earned",
    "sentiment_score": "negative review sentiment",
    "PreferredPaymentMode": "payment mode pattern",
    "PreferedOrderCat": "preferred order category",
    "MaritalStatus": "marital status",
}
