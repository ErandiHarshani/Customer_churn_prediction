import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import type { ChurnDistribution } from "../types";
import { chartColors } from "../utils/chartColors";

/** One ratio, so a headline number + meter rather than a two-slice donut. */
export function ChurnDistributionChart({ data }: { data: ChurnDistribution }) {
  const theme = useTheme();
  const c = chartColors(theme);
  const total = data.churn + data.non_churn || 1;
  const rate = (data.churn / total) * 100;

  return (
    <Box sx={{ pt: 1 }}>
      <Typography variant="h3" component="p" sx={{ fontWeight: 600, lineHeight: 1.1 }}>
        {rate.toFixed(1)}%
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        of dataset customers churned
      </Typography>
      <Box
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(rate.toFixed(1))}
        aria-label="Churn rate"
        sx={{ height: 10, borderRadius: 1, bgcolor: c.track, overflow: "hidden", mb: 1.5 }}
      >
        <Box sx={{ height: "100%", width: `${rate}%`, bgcolor: c.series[0], borderRadius: 1 }} />
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">
          <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
            {data.churn.toLocaleString()}
          </Box>{" "}
          churned
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
            {data.non_churn.toLocaleString()}
          </Box>{" "}
          stayed
        </Typography>
      </Box>
    </Box>
  );
}
