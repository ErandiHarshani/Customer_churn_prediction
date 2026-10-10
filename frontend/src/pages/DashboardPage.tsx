import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import VerifiedIcon from "@mui/icons-material/Verified";
import InsightsIcon from "@mui/icons-material/Insights";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { getDashboardSummary, getEngagementAnalytics, getRocCurve } from "../api/dashboard";
import { StatCard } from "../components/StatCard";
import { RiskDistributionChart } from "../components/RiskDistributionChart";
import { ChurnDistributionChart } from "../components/ChurnDistributionChart";
import { RocCurveChart } from "../components/RocCurveChart";
import { ModelMetricsCard } from "../components/ModelMetricsCard";
import { EngagementAnalyticsCard } from "../components/EngagementAnalyticsCard";
import type { DashboardSummary, EngagementAnalytics, ModelCurve } from "../types";

export function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [curves, setCurves] = useState<ModelCurve[] | null>(null);
  const [engagement, setEngagement] = useState<EngagementAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardSummary(), getRocCurve(), getEngagementAnalytics()])
      .then(([summaryRes, rocRes, engagementRes]) => {
        setSummary(summaryRes);
        setCurves(rocRes.curves);
        setEngagement(engagementRes);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!summary) {
    return <Typography color="error">Could not load dashboard data.</Typography>;
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Dashboard Overview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Real-time summary of the churn prediction system
      </Typography>

      <Card
        variant="outlined"
        sx={{
          mb: 3,
          background: (theme) =>
            theme.palette.mode === "dark"
              ? "linear-gradient(90deg, rgba(124,108,246,0.18), rgba(34,193,195,0.10))"
              : "linear-gradient(90deg, rgba(91,75,219,0.08), rgba(34,193,195,0.06))",
        }}
      >
        <CardContent
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <InsightsIcon color="primary" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="subtitle1">Predict a customer's churn risk</Typography>
              <Typography variant="body2" color="text.secondary">
                Run the live model on a new or hypothetical customer and get SHAP reasons + an AI
                retention message instantly.
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate("/customers/new")}
            sx={{ whiteSpace: "nowrap" }}
          >
            Predict Customer
          </Button>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Customers"
            value={summary.total_customers.toLocaleString()}
            icon={<PeopleAltIcon color="primary" />}
            subtitle="100% of dataset"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            variant="outlined"
            sx={{ height: "100%", cursor: "pointer" }}
            onClick={() => navigate("/customers?risk_level=high")}
          >
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  High Risk Customers
                </Typography>
                <WarningAmberIcon color="error" />
              </Box>
              <Typography variant="h4" color="error" sx={{ mt: 1 }}>
                {summary.risk_distribution.high.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {((summary.risk_distribution.high / summary.total_customers) * 100).toFixed(1)}% of
                total — click to view
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Average Churn Risk"
            value={`${(summary.predicted_churn_rate * 100).toFixed(1)}%`}
            icon={<TrendingUpIcon color="info" />}
            subtitle={`predicted · actual ${(summary.actual_churn_rate * 100).toFixed(1)}%`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Model Accuracy"
            value={`${(summary.best_model_accuracy * 100).toFixed(1)}%`}
            icon={<VerifiedIcon color="success" />}
            subtitle="best model, held-out test set"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Churn Distribution
              </Typography>
              <ChurnDistributionChart data={summary.churn_distribution} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Risk Level Distribution
              </Typography>
              <RiskDistributionChart data={summary.risk_distribution} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Model Performance (ROC Curve)
              </Typography>
              {curves && <RocCurveChart curves={curves} />}
              <Typography variant="caption" color="text.secondary">
                Computed live from the two trained models (XGBoost, Random Forest) against a
                held-out test split.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ModelMetricsCard metrics={summary.model_metrics} bestModelName={summary.best_model_name} />
        </Grid>
      </Grid>

      {engagement && (
        <Box sx={{ mt: 2 }}>
          <EngagementAnalyticsCard data={engagement} />
        </Box>
      )}
    </Box>
  );
}
