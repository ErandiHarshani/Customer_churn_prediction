import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import type { ReasonImpact } from "../types";
import { chartColors } from "../utils/chartColors";

/** One series, so one hue: bar length carries the magnitude, the label carries the value.
 *  Recharts' vertical layout draws categories top-down in data order and the backend
 *  sorts reasons by impact, so the strongest reason is on top. */
export function ReasonImpactChart({ reasons }: { reasons: ReasonImpact[] }) {
  const theme = useTheme();
  const c = chartColors(theme);
  // labels get less room on phones so the bars stay readable
  const narrow = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, reasons.length * 40)}>
      <BarChart data={reasons} layout="vertical" margin={{ left: 0, right: 52, top: 4, bottom: 4 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="label"
          width={narrow ? 150 : 240}
          interval={0}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: narrow ? 11 : 12, fill: theme.palette.text.primary }}
        />
        <Tooltip
          cursor={{ fill: theme.palette.action.hover }}
          formatter={(value) => [`${value}%`, "Share of churn-raising factors"]}
          contentStyle={{
            background: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar
          dataKey="impact_pct"
          fill={c.series[0]}
          barSize={14}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="impact_pct"
            position="right"
            formatter={(v) => `${v}%`}
            style={{ fill: c.textSecondary, fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
