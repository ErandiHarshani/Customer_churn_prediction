import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
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
}

export function ModelMetricsCard({ metrics, bestModelName }: ModelMetricsCardProps) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Model performance
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Model</TableCell>
              <TableCell align="right">Accuracy</TableCell>
              <TableCell align="right">F1 score</TableCell>
              <TableCell align="right">ROC-AUC</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {metrics.map((m) => (
              <TableRow key={m.name}>
                <TableCell>{m.name}</TableCell>
                <TableCell align="right">{(m.accuracy * 100).toFixed(1)}%</TableCell>
                <TableCell align="right">{m.f1.toFixed(3)}</TableCell>
                <TableCell align="right">{m.roc_auc.toFixed(3)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

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
                Highest ROC-AUC on the held-out test split — used for all live churn predictions
                and SHAP explanations.
              </Typography>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
