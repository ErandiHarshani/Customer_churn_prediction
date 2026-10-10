import Typography from "@mui/material/Typography";
import { ReasonImpactChart } from "./ReasonImpactChart";
import type { ReasonImpact, RiskLevel } from "../types";

/** SHAP churn drivers, or an explanation of why none are listed. Shared by the
 *  Predict page and the customer detail page so both read the same way. */
export function ReasonsSection({ riskLevel, reasons }: { riskLevel: RiskLevel; reasons: ReasonImpact[] }) {
  if (riskLevel === "low") {
    return (
      <Typography variant="body2" color="text.secondary">
        Low risk — no factor pushes this customer meaningfully towards churn.
      </Typography>
    );
  }
  if (reasons.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No single strong churn driver — the risk comes from many small factors combined.
      </Typography>
    );
  }
  return (
    <>
      <ReasonImpactChart reasons={reasons} />
      <Typography variant="caption" color="text.secondary">
        Bar length = each factor's share of everything raising this customer's risk (SHAP).
      </Typography>
    </>
  );
}
