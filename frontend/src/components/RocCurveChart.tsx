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

const LINE_COLORS = ["#7c6cf6", "#22c1c3", "#f5a524", "#e5484d"];

export function RocCurveChart({ curves }: { curves: ModelCurve[] }) {
  const theme = useTheme();

  const diagonal = [
    { fpr: 0, tpr: 0 },
    { fpr: 1, tpr: 1 },
  ];

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        <XAxis
          type="number"
          dataKey="fpr"
          domain={[0, 1]}
          allowDuplicatedCategory={false}
          label={{ value: "False Positive Rate", position: "insideBottom", offset: -4 }}
        />
        <YAxis
          type="number"
          domain={[0, 1]}
          label={{ value: "True Positive Rate", angle: -90, position: "insideLeft" }}
        />
        <Tooltip formatter={(value: number) => value.toFixed(3)} />
        <Legend />

        {curves.map((curve, i) => (
          <Line
            key={curve.name}
            data={curve.fpr.map((fpr, idx) => ({ fpr, tpr: curve.tpr[idx] }))}
            dataKey="tpr"
            name={`${curve.name} (AUC ${curve.auc.toFixed(2)})`}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        ))}

        <Line
          data={diagonal}
          dataKey="tpr"
          name="Random guess (AUC 0.50)"
          stroke={theme.palette.text.disabled}
          strokeDasharray="4 4"
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
