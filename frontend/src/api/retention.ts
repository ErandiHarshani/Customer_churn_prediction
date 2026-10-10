import { apiClient } from "./client";
import type {
  BulkGenerateJobStarted,
  BulkGenerateJobStatus,
  BulkSendSmsResponse,
  BulkTarget,
  RetentionMessage,
  SendSmsResponse,
} from "../types";

export async function generateRetentionMessage(
  customerId: number,
  forceRegenerate = false
): Promise<RetentionMessage> {
  const { data } = await apiClient.post<RetentionMessage>(
    `/api/customers/${customerId}/generate-message`,
    { force_regenerate: forceRegenerate }
  );
  return data;
}

export async function sendSms(customerId: number): Promise<SendSmsResponse> {
  const { data } = await apiClient.post<SendSmsResponse>(
    `/api/customers/${customerId}/send-sms`,
    {}
  );
  return data;
}

export async function startBulkGenerateMessages(
  target: BulkTarget,
  forceRegenerate = false
): Promise<BulkGenerateJobStarted> {
  const { data } = await apiClient.post<BulkGenerateJobStarted>(
    "/api/customers/bulk/generate-messages",
    { ...target, force_regenerate: forceRegenerate }
  );
  return data;
}

export async function getBulkGenerateJob(jobId: string): Promise<BulkGenerateJobStatus> {
  const { data } = await apiClient.get<BulkGenerateJobStatus>(
    `/api/customers/bulk/generate-messages/${jobId}`
  );
  return data;
}

export async function bulkSendSms(target: BulkTarget): Promise<BulkSendSmsResponse> {
  const { data } = await apiClient.post<BulkSendSmsResponse>(
    "/api/customers/bulk/send-sms",
    target
  );
  return data;
}
