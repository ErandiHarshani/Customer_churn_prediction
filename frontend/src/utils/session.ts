// Where to return after (re-)login, and why the user was sent to the login page.
const REDIRECT_KEY = "auth_redirect";
const EXPIRED_KEY = "auth_expired";

export function rememberReturnPath(path: string, expired: boolean) {
  if (path && !path.startsWith("/login")) sessionStorage.setItem(REDIRECT_KEY, path);
  if (expired) sessionStorage.setItem(EXPIRED_KEY, "1");
}

/** Flags that the user was logged out because their session expired. */
export function markSessionExpired() {
  sessionStorage.setItem(EXPIRED_KEY, "1");
}

/** Reads the stored return path + "session expired" flag (pure: safe in render/StrictMode). */
export function peekReturnState(): { path: string | null; expired: boolean } {
  return {
    path: sessionStorage.getItem(REDIRECT_KEY),
    expired: sessionStorage.getItem(EXPIRED_KEY) === "1",
  };
}

export function clearReturnState() {
  sessionStorage.removeItem(REDIRECT_KEY);
  sessionStorage.removeItem(EXPIRED_KEY);
}

/** True when the JWT is missing, malformed or past its `exp`. */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
