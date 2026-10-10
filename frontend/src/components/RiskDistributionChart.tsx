import { useTheme } from "@mui/material/styles";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { RiskDistribution } from "../types";

export function RiskDistributionChart({ data }: { data: RiskDistribution }) {
  const theme = useTheme();

  const chartData = [
    { name: "High", value: data.high, color: theme.palette.error.main },
    { name: "Medium", value: data.medium, color: theme.palette.warning.main },
    { name: "Low", value: data.low, color: theme.palette.success.main },
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          // The pie's default mount animation relies on requestAnimationFrame,
          // which does not reliably tick in an automated/headless browser tab
          // (observed: sectors stuck permanently at the animation's initial
          // zero-radius frame). Disabling it also makes the chart snappier.
          isAnimationActive={false}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
