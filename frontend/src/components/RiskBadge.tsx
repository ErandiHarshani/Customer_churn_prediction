import Chip from "@mui/material/Chip";
import { alpha, darken, lighten } from "@mui/material/styles";
import type { RiskLevel } from "../types";
import { RISK_COLOR } from "../utils/format";

// Soft tonal badge: a pale tint of the risk colour with deep text, so "high"
// reads as red without a saturated block. Text stays >= 4.5:1 in both themes.
export function RiskBadge({ level }: { level: RiskLevel }) {
  const color = RISK_COLOR[level];
  return (
    <Chip
      label={level.toUpperCase()}
      size="small"
      sx={(t) => {
        const main = t.palette[color].main;
        const light = t.palette.mode === "light";
        // high gets a slightly stronger tint so it stands out from the others
        const boost = level === "high" ? 0.2 : 0;
        return {
          fontWeight: 600,
          letterSpacing: "0.02em",
          bgcolor: alpha(main, (light ? 0.1 : 0.16) + boost),
          color: light ? darken(main, 0.4) : lighten(main, 0.4),
          border: `1px solid ${alpha(main, (light ? 0.24 : 0.32) + boost * 2)}`,
        };
      }}
    />
  );
}
