import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";
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
import { PageHeader } from "../components/PageHeader";
import { ErrorState, PageSkeleton } from "../components/PageStates";
import { IconDisc } from "../components/StatCard";
import { apiErrorMessage } from "../utils/apiError";
import type { DashboardSummary, EngagementAnalytics, ModelCurve } from "../types";

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<{ summary: DashboardSummary; curves: ModelCurve[]; engagement: EngagementAnalytics } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let stale = false;
    Promise.all([getDashboardSummary(), getRocCurve(), getEngagementAnalytics()])
      .then(([summary, roc, engagement]) => !stale && setData({ summary, curves: roc.curves, engagement }))
      .catch((e) => !stale && setError(apiErrorMessage(e, "Could not load the dashboard.")));
    return () => {
      stale = true;
    };
  }, [retryTick]);

  if (error) {
    return (
      <Box>
        <PageHeader title="Dashboard" />
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setRetryTick((t) => t + 1);
          }}
        />
      </Box>
    );
  }

  if (!data) {
    return <PageSkeleton cards={4} tall={2} />;
  }

  const { summary, curves, engagement } = data;
  const datasetCustomers = summary.churn_distribution.churn + summary.churn_distribution.non_churn;
  const addedCustomers = summary.total_customers - datasetCustomers;
  const datasetSubtitle =
    addedCustomers > 0
      ? `${datasetCustomers.toLocaleString()} from dataset · ${addedCustomers.toLocaleString()} added`
      : "all from the dataset";

  return (
    <Box>
      <PageHeader title="Dashboard" subtitle="Live summary of churn risk across all customers." />

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
            icon={<PeopleAltIcon />}
            subtitle={datasetSubtitle}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardActionArea
              onClick={() => navigate("/customers?risk_level=high")}
              sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start" }}
            >
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  High Risk Customers
                </Typography>
                <IconDisc>
                  <WarningAmberIcon sx={{ color: "error.main" }} />
                </IconDisc>
              </Box>
              <Typography variant="h4" color="error" sx={{ mt: 1 }}>
                {summary.risk_distribution.high.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {((summary.risk_distribution.high / summary.total_customers) * 100).toFixed(1)}% of
                total — click to view
              </Typography>
            </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Average Churn Risk"
            value={`${(summary.predicted_churn_rate * 100).toFixed(1)}%`}
            icon={<TrendingUpIcon />}
            subtitle={`predicted · actual ${(summary.actual_churn_rate * 100).toFixed(1)}%`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Model Accuracy"
            value={`${(summary.best_model_accuracy * 100).toFixed(1)}%`}
            icon={<VerifiedIcon />}
            subtitle={`${summary.best_model_name} · chosen by cross-validation · test set`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Actual churn (dataset)
              </Typography>
              <ChurnDistributionChart data={summary.churn_distribution} />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                Known outcomes only — newly added customers have no outcome yet.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Predicted risk levels
              </Typography>
              <RiskDistributionChart
                data={summary.risk_distribution}
                onSelect={(level) => navigate(`/customers?risk_level=${level}`)}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Model Performance (ROC Curve)
              </Typography>
              <RocCurveChart curves={curves} />
              <Typography variant="caption" color="text.secondary">
                XGBoost vs Random Forest on the held-out 20% test split (never used for training
                or model selection).
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <ModelMetricsCard
            metrics={summary.model_metrics}
            bestModelName={summary.best_model_name}
            modelVersion={summary.model_version}
            thresholdHigh={summary.risk_threshold_high}
            thresholdMedium={summary.risk_threshold_medium}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <EngagementAnalyticsCard data={engagement} />
      </Box>
    </Box>
  );
}
