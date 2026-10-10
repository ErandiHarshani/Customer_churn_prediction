import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getCustomerDetail } from "../api/customers";
import { RiskBadge } from "../components/RiskBadge";
import { ReasonsSection } from "../components/ReasonsSection";
import { formatProbability, RISK_COLOR } from "../utils/format";
import { RetentionMessagePanel } from "../components/RetentionMessagePanel";
import { SendSmsPanel } from "../components/SendSmsPanel";
import type { CustomerDetail } from "../types";

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    getCustomerDetail(Number(customerId))
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!detail) {
    return <Typography color="error">Customer not found.</Typography>;
  }

  const p = detail.profile;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Back
      </Button>

      <Stack direction="row" sx={{ alignItems: "center", mb: 3, flexWrap: "wrap", gap: 1.5 }}>
        <Typography variant="h5">Customer #{detail.customer_id}</Typography>
        <RiskBadge level={detail.risk_level} />
        <Chip
          variant="outlined"
          color={RISK_COLOR[detail.risk_level]}
          label={`${formatProbability(detail.churn_probability)} churn probability`}
        />
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Why this customer is at risk (SHAP)
              </Typography>
              <ReasonsSection riskLevel={detail.risk_level} reasons={detail.reason_impacts} />
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Profile
              </Typography>
              <Grid container spacing={1}>
                <ProfileField label="Tenure (months)" value={p.tenure} />
                <ProfileField label="Order count" value={p.order_count} />
                <ProfileField label="Days since last order" value={p.day_since_last_order} />
                <ProfileField label="Complaints" value={p.complain ? "Yes" : "No"} />
                <ProfileField label="Satisfaction score" value={p.satisfaction_score} />
                <ProfileField label="Cashback amount" value={p.cashback_amount} />
                <ProfileField label="Preferred order category" value={p.prefered_order_cat} />
                <ProfileField
                  label="Last product purchased"
                  value={
                    p.last_product_purchased
                      ? `${p.last_product_purchased}${p.last_product_purchased_is_generated ? "" : ""}`
                      : null
                  }
                />
                <ProfileField label="Preferred payment mode" value={p.preferred_payment_mode} />
                <ProfileField label="Sentiment" value={p.sentiment_label} />
                <ProfileField label="Review rating" value={p.review_rating ? `${p.review_rating} / 5` : null} />
              </Grid>
              {p.review_text && (
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography variant="caption" color="text.secondary">
                      Latest review
                    </Typography>
                    {/* {p.review_is_synthetic && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color="warning"
                        label="sample review, not from this customer"
                      />
                    )} */}
                  </Stack>
                  <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                    "{p.review_text}"
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={2}>
            <RetentionMessagePanel
              customerId={detail.customer_id}
              message={detail.latest_retention_message}
              onGenerated={(message) => setDetail({ ...detail, latest_retention_message: message })}
            />
            <SendSmsPanel
              customerId={detail.customer_id}
              phoneNumber={detail.phone_number}
              hasMessage={!!detail.latest_retention_message?.sms_text?.trim()}
              smsLog={detail.sms_log}
              onPhoneUpdated={(phone) => setDetail({ ...detail, phone_number: phone })}
              onSent={() => {
                if (!customerId) return;
                getCustomerDetail(Number(customerId)).then(setDetail);
              }}
            />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

function ProfileField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <Grid size={6}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography variant="body2">{value ?? "-"}</Typography>
    </Grid>
  );
}
