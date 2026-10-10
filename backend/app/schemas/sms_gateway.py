from pydantic import BaseModel


class SmsGatewaySettingsResponse(BaseModel):
    user_id: str
    api_key: str
    sender_id: str
    dry_run: bool

    class Config:
        from_attributes = True


class UpdateSmsGatewaySettingsRequest(BaseModel):
    user_id: str
    api_key: str
    sender_id: str
    dry_run: bool


class SmsBalanceResponse(BaseModel):
    active: bool
    balance: float
