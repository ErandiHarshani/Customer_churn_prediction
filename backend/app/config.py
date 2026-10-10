from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ML_ARTIFACT_DIR: str
    RAW_CSV_PATH: str

    DATABASE_URL: str = "sqlite:///./churn_dashboard.db"

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 12

    # Admin login is checked against the admin_users table in the DB (see app/seed_admin.py).
    # These are only used to seed that table the first time it's empty.
    ADMIN_SEED_USERNAME: str = ""
    ADMIN_SEED_PASSWORD: str = ""

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL_NAME: str = "gemini-3.5-flash-lite"

    NOTIFY_LK_USER_ID: str = ""
    NOTIFY_LK_API_KEY: str = ""
    NOTIFY_LK_SENDER_ID: str = "NotifyDEMO"

    DRY_RUN: bool = True

    RISK_THRESHOLD_HIGH: float = 0.6
    RISK_THRESHOLD_MEDIUM: float = 0.35


settings = Settings()


