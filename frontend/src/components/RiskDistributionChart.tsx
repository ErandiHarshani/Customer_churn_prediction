import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import type { RiskDistribution, RiskLevel } from "../types";
import { chartColors } from "../utils/chartColors";

const ROWS: { level: RiskLevel; label: string }[] = [
  { level: "high", label: "High risk" },
  { level: "medium", label: "Medium risk" },
  { level: "low", label: "Low risk" },
];

/** Three labelled bars instead of a donut: counts this unequal (≈ 4,100 vs 650)
 *  are read off a common baseline, and every bar carries its own label + value,
 *  so the status colour never has to carry meaning alone. */
export function RiskDistributionChart({
  data,
  onSelect,
}: {
  data: RiskDistribution;
  onSelect?: (level: RiskLevel) => void;
}) {
  const theme = useTheme();
  const c = chartColors(theme);
  const total = data.high + data.medium + data.low || 1;
  const max = Math.max(data.high, data.medium, data.low) || 1;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 1 }}>
      {ROWS.map(({ level, label }) => {
        const value = data[level];
        return (
          <ButtonBase
            key={level}
            onClick={() => onSelect?.(level)}
            disabled={!onSelect}
            aria-label={`${label}: ${value.toLocaleString()} customers. Show list`}
            sx={{
              display: "block",
              textAlign: "left",
              borderRadius: 1,
              px: 1,
              py: 0.75,
              transition: "background-color 150ms ease",
              "@media (hover: hover) and (pointer: fine)": {
                "&:hover": { bgcolor: "action.hover" },
              },
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.75 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: c.status[level] }} />
                <Typography variant="body2">{label}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
                  {value.toLocaleString()}
                </Box>{" "}
                · {((value / total) * 100).toFixed(1)}%
              </Typography>
            </Box>
            <Box sx={{ height: 10, borderRadius: 1, bgcolor: c.track, overflow: "hidden" }}>
              <Box
                sx={{ height: "100%", width: `${(value / max) * 100}%`, bgcolor: c.status[level], borderRadius: 1 }}
              />
            </Box>
          </ButtonBase>
        );
      })}
      {onSelect && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
          Click a row to open those customers.
        </Typography>
      )}
    </Box>
  );
}
