import { apiClient } from "./client";
import type { SmsBalance, SmsGatewaySettings } from "../types";

export async function getSmsGatewaySettings(): Promise<SmsGatewaySettings> {
  const { data } = await apiClient.get<SmsGatewaySettings>("/api/settings/sms-gateway");
  return data;
}

export async function updateSmsGatewaySettings(
  settings: SmsGatewaySettings
): Promise<SmsGatewaySettings> {
  const { data } = await apiClient.put<SmsGatewaySettings>("/api/settings/sms-gateway", settings);
  return data;
}

export async function getSmsBalance(): Promise<SmsBalance> {
  const { data } = await apiClient.get<SmsBalance>("/api/settings/sms-gateway/balance");
  return data;
}
