/**
 * Human-readable message from an API error. FastAPI returns `detail` either as
 * a string or (for 422 validation errors) as an array of {loc, msg} objects —
 * rendering that array directly would crash React.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: { detail?: unknown } }; code?: string };
  if (!e?.response) {
    return e?.code === "ECONNABORTED"
      ? "The server took too long to respond. Please try again."
      : "Can't reach the server. Check that the backend is running and try again.";
  }
  const detail = e.response.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d: { loc?: (string | number)[]; msg?: string }) => {
        const field = String(d.loc?.slice(-1)[0] ?? "field").replace(/_/g, " ");
        return `${field}: ${d.msg ?? "invalid value"}`;
      })
      .join("; ");
  }
  return fallback;
}

/** True when the error is an HTTP 404 from the API. */
export function isNotFound(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 404;
}
