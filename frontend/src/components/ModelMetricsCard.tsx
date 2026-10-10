import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableContainer from "@mui/material/TableContainer";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Box from "@mui/material/Box";
import VerifiedIcon from "@mui/icons-material/Verified";
import type { ModelMetric } from "../types";

interface ModelMetricsCardProps {
  metrics: ModelMetric[];
  bestModelName?: string;
  modelVersion?: string | null;
  thresholdHigh?: number | null;
  thresholdMedium?: number | null;
}

const pct = (v?: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

export function ModelMetricsCard({
  metrics,
  bestModelName,
  modelVersion,
  thresholdHigh,
  thresholdMedium,
}: ModelMetricsCardProps) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Model performance
        </Typography>
        <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ "& td, & th": { px: 1, whiteSpace: "nowrap" } }}>
          <TableHead>
            <TableRow>
              <TableCell>Model</TableCell>
              <TableCell align="right">Accuracy</TableCell>
              <TableCell align="right">Precision</TableCell>
              <TableCell align="right">Recall</TableCell>
              <TableCell align="right">F1 score</TableCell>
              <TableCell align="right">ROC-AUC</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {metrics.map((m) => (
              <TableRow key={m.name}>
                <TableCell>{m.name}</TableCell>
                <TableCell align="right">{pct(m.accuracy)}</TableCell>
                <TableCell align="right">{pct(m.precision)}</TableCell>
                <TableCell align="right">{pct(m.recall)}</TableCell>
                <TableCell align="right">{m.f1.toFixed(3)}</TableCell>
                <TableCell align="right">{m.roc_auc.toFixed(3)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Held-out test set (20%, duplicate rows kept on one side of the split). Accuracy, precision,
          recall and F1 at each model's decision threshold
          {metrics.some((m) => m.threshold != null) &&
            ` (${metrics.map((m) => `${m.name} ${m.threshold}`).join(", ")})`}
          .
        </Typography>

        {bestModelName && (
          <Box
            sx={{
              mt: 3,
              p: 2,
              borderRadius: 1,
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              bgcolor: (theme) =>
                theme.palette.mode === "dark" ? "rgba(46,125,50,0.12)" : "rgba(46,125,50,0.08)",
            }}
          >
            <VerifiedIcon color="success" sx={{ mt: 0.25 }} />
            <Box>
              <Typography variant="body2">
                <strong>{bestModelName}</strong> is the active model
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Chosen by 5-fold cross-validation on the training split — used for all live churn
                predictions and SHAP explanations.
                {thresholdHigh != null && thresholdMedium != null &&
                  ` Risk bands: high ≥ ${pct(thresholdHigh)}, medium ≥ ${pct(thresholdMedium)} (average churn rate).`}
                {modelVersion && ` Model version ${modelVersion}.`}
              </Typography>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
