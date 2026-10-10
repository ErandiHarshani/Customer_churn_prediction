import { useTheme } from "@mui/material/styles";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ModelCurve } from "../types";
import { chartColors } from "../utils/chartColors";

export function RocCurveChart({ curves }: { curves: ModelCurve[] }) {
  const theme = useTheme();
  const c = chartColors(theme);
  const tick = { fill: c.muted, fontSize: 12 };

  const diagonal = [
    { fpr: 0, tpr: 0 },
    { fpr: 1, tpr: 1 },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart margin={{ top: 4, right: 16, bottom: 24, left: 8 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis
          type="number"
          dataKey="fpr"
          domain={[0, 1]}
          allowDuplicatedCategory={false}
          ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
          tick={tick}
          stroke={c.axis}
          tickFormatter={(v) => Number(v).toFixed(1)}
          label={{ value: "False positive rate", position: "insideBottom", offset: -16, fill: c.muted, fontSize: 12 }}
        />
        <YAxis
          type="number"
          domain={[0, 1]}
          ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
          tick={tick}
          stroke={c.axis}
          tickFormatter={(v) => Number(v).toFixed(1)}
          label={{ value: "True positive rate", angle: -90, position: "insideLeft", offset: 4, fill: c.muted, fontSize: 12 }}
        />
        <Tooltip
          formatter={(value) => Number(value).toFixed(3)}
          labelFormatter={(v) => `FPR ${Number(v).toFixed(2)}`}
          contentStyle={{
            background: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        {/* legend text stays in text ink; the swatch carries the series colour */}
        <Legend
          verticalAlign="top"
          height={36}
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => <span style={{ color: c.textSecondary }}>{value}</span>}
        />

        {curves.map((curve, i) => (
          <Line
            key={curve.name}
            data={curve.fpr.map((fpr, idx) => ({ fpr, tpr: curve.tpr[idx] }))}
            dataKey="tpr"
            name={`${curve.name} (AUC ${curve.auc.toFixed(3)})`}
            stroke={c.series[i % c.series.length]}
            dot={false}
            activeDot={{ r: 4 }}
            strokeWidth={2}
            isAnimationActive={false}
          />
        ))}

        {/* reference line, not data — muted and dashed so it reads as a baseline */}
        <Line
          data={diagonal}
          dataKey="tpr"
          name="Random guess (AUC 0.50)"
          stroke={c.muted}
          strokeDasharray="4 4"
          dot={false}
          activeDot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
