import { apiClient } from "./client";

export async function login(username: string, password: string): Promise<string> {
  const { data } = await apiClient.post("/api/auth/login", { username, password });
  return data.access_token as string;
}
