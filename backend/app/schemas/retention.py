from datetime import datetime

from pydantic import BaseModel


class RetentionMessageResponse(BaseModel):
    id: int
    customer_id: int
    sms_text: str
    discount_percent: int
    source: str
    generated_at: datetime

    class Config:
        from_attributes = True


class GenerateMessageRequest(BaseModel):
    force_regenerate: bool = False


class SendSmsRequest(BaseModel):
    retention_message_id: int | None = None


class BulkTargetRequest(BaseModel):
    customer_ids: list[int] | None = None
    all_matching: bool = False
    search: str | None = None
    risk_level: str | None = None
    prefered_order_cat: str | None = None


class BulkGenerateMessagesRequest(BulkTargetRequest):
    force_regenerate: bool = False


class BulkGenerateJobStarted(BaseModel):
    job_id: str
    target_count: int


class BulkGenerateJobStatus(BaseModel):
    job_id: str
    target_count: int
    processed: int
    generated: int
    already_had_message: int
    failed: int
    done: bool
    error: str | None = None


class BulkSendSmsResponse(BaseModel):
    target_count: int
    sent: int
    failed: int
    skipped_no_phone: int
    skipped_no_message: int


class SmsLogEntry(BaseModel):
    id: int
    phone_number: str
    provider_status: str | None
    success: bool
    dry_run: bool
    sent_at: datetime

    class Config:
        from_attributes = True


class SendSmsResponse(BaseModel):
    success: bool
    provider_status: str | None
    dry_run: bool
    sent_at: datetime
