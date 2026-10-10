import { createContext, useContext, useState, type ReactNode } from "react";
import { login as loginRequest } from "../api/auth";
import { isTokenExpired, markSessionExpired } from "../utils/session";

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // an expired token counts as logged out, so the app never flashes before a 401
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = localStorage.getItem("access_token");
    if (token && isTokenExpired(token)) {
      localStorage.removeItem("access_token");
      markSessionExpired(); // idempotent, so StrictMode's double call is harmless
    }
    return !!token && !isTokenExpired(token);
  });

  async function login(username: string, password: string) {
    const token = await loginRequest(username, password);
    localStorage.setItem("access_token", token);
    setIsAuthenticated(true);
  }

  function logout() {
    localStorage.removeItem("access_token");
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
