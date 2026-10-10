import { useTheme } from "@mui/material/styles";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";
import type { ReasonImpact } from "../types";

export function ReasonImpactChart({ reasons }: { reasons: ReasonImpact[] }) {
  const theme = useTheme();

  const colors = [
    theme.palette.error.main,
    theme.palette.error.light,
    theme.palette.warning.main,
    theme.palette.warning.light,
    theme.palette.info.main,
  ];

  const data = [...reasons].reverse(); // Recharts vertical bar charts render bottom-to-top

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <XAxis type="number" domain={[0, "dataMax"]} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${value}%`, "Share of churn-raising factors (SHAP)"]} />
        <Bar dataKey="impact_pct" isAnimationActive={false} radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={entry.label} fill={colors[(data.length - 1 - i) % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
