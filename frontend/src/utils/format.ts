import type { RiskLevel } from "../types";

/**
 * Churn probability for display. Floored (not rounded) to one decimal so the shown
 * number never crosses a risk-band threshold the customer is actually below
 * (16.78% shows as 16.7%, not 16.8%, when "medium" starts at 16.8%). Extremes are
 * shown as bounds instead of a misleading "0%" or "100%".
 */
export function formatProbability(p: number): string {
  const pct = p * 100;
  if (pct < 0.1) return "<0.1%";
  if (pct > 99.9) return ">99.9%";
  return `${(Math.floor(pct * 10) / 10).toFixed(1)}%`;
}

/** MUI palette colour for each risk band, shared by badges and probability text. */
export const RISK_COLOR: Record<RiskLevel, "error" | "warning" | "success"> = {
  high: "error",
  medium: "warning",
  low: "success",
};
