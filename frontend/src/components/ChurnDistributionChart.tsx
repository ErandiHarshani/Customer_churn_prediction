import { useTheme } from "@mui/material/styles";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ChurnDistribution } from "../types";

export function ChurnDistributionChart({ data }: { data: ChurnDistribution }) {
  const theme = useTheme();

  const chartData = [
    { name: "Churn", value: data.churn, color: theme.palette.error.main },
    { name: "Non-Churn", value: data.non_churn, color: theme.palette.success.main },
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
