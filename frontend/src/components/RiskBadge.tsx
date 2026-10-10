import Chip from "@mui/material/Chip";
import type { RiskLevel } from "../types";

const COLOR_MAP: Record<RiskLevel, "error" | "warning" | "success"> = {
  high: "error",
  medium: "warning",
  low: "success",
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Chip label={level.toUpperCase()} color={COLOR_MAP[level]} size="small" />;
}
