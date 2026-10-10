import axios from "axios";
import { rememberReturnPath } from "../utils/session";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 60000, // Gemini-backed calls can take a while; never hang forever
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginCall = String(error.config?.url ?? "").includes("/api/auth/login");
    if (error.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem("access_token");
      if (window.location.pathname !== "/login") {
        // come back here after signing in again, and explain why they were logged out
        rememberReturnPath(window.location.pathname + window.location.search, true);
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
