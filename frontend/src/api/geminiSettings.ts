import { apiClient } from "./client";
import type { GeminiModelInfo, GeminiSettings } from "../types";

export async function getGeminiSettings(): Promise<GeminiSettings> {
  const { data } = await apiClient.get<GeminiSettings>("/api/settings/gemini");
  return data;
}

export async function updateGeminiSettings(settings: GeminiSettings): Promise<GeminiSettings> {
  const { data } = await apiClient.put<GeminiSettings>("/api/settings/gemini", settings);
  return data;
}

export async function getGeminiModelInfo(): Promise<GeminiModelInfo> {
  const { data } = await apiClient.get<GeminiModelInfo>("/api/settings/gemini/model-info");
  return data;
}
