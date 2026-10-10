import Chip from "@mui/material/Chip";
import type { RiskLevel } from "../types";
import { RISK_COLOR } from "../utils/format";

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Chip label={level.toUpperCase()} color={RISK_COLOR[level]} size="small" />;
}
