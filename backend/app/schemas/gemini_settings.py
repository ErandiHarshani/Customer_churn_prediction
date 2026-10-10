from pydantic import BaseModel


class GeminiSettingsResponse(BaseModel):
    api_key: str
    model_name: str

    class Config:
        from_attributes = True


class UpdateGeminiSettingsRequest(BaseModel):
    api_key: str
    model_name: str


class GeminiModelInfoResponse(BaseModel):
    name: str
    display_name: str
    input_token_limit: int
    output_token_limit: int
    supported_actions: list[str]
