import { useEffect, useState } from "react";
import { Link as RouterLink, useLocation, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import { getCustomerDetail } from "../api/customers";
import { RiskBadge } from "../components/RiskBadge";
import { ReasonsSection } from "../components/ReasonsSection";
import { formatProbability, RISK_COLOR } from "../utils/format";
import { RetentionMessagePanel } from "../components/RetentionMessagePanel";
import { SendSmsPanel } from "../components/SendSmsPanel";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "../components/PageStates";
import { apiErrorMessage, isNotFound } from "../utils/apiError";
import type { CustomerDetail } from "../types";

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const location = useLocation();
  // the list view (with its filters) the user came from, if any
  const fromList = (location.state as { from?: string } | null)?.from ?? "/customers";
  const id = Number(customerId);

  // results tagged with the customer they belong to, so navigating between
  // customers never shows the previous one's data
  const [loaded, setLoaded] = useState<{ id: number; detail: CustomerDetail } | null>(null);
  const [failure, setFailure] = useState<{ id: number; notFound: boolean; message: string } | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let stale = false;
    getCustomerDetail(id)
      .then((d) => !stale && setLoaded({ id, detail: d }))
      .catch((e) => !stale && setFailure({ id, notFound: isNotFound(e), message: apiErrorMessage(e, "Could not load this customer.") }));
    return () => {
      stale = true;
    };
  }, [id, retryTick]);

  const detail = loaded?.id === id ? loaded.detail : null;
  const setDetail = (d: CustomerDetail) => setLoaded({ id, detail: d });
  const failed = failure?.id === id ? failure : null;
  const crumbs = [{ label: "Customers", to: fromList }, { label: `#${customerId}` }];

  if (failed) {
    return (
      <Box>
        <PageHeader title={`Customer #${customerId}`} breadcrumbs={crumbs} />
        {failed.notFound ? (
          <Card variant="outlined">
            <EmptyState
              icon={<PersonOffIcon />}
              title="Customer not found"
              description={`There is no customer #${customerId}. It may have been removed when the database was reseeded.`}
              action={
                <Button variant="contained" component={RouterLink} to={fromList}>
                  Back to customers
                </Button>
              }
            />
          </Card>
        ) : (
          <ErrorState
            message={failed.message}
            onRetry={() => {
              setFailure(null);
              setRetryTick((t) => t + 1);
            }}
          />
        )}
      </Box>
    );
  }

  if (!detail) {
    return <PageSkeleton cards={0} tall={2} />;
  }

  const p = detail.profile;

  return (
    <Box>
      <PageHeader
        title={
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            Customer #{detail.customer_id}
            <RiskBadge level={detail.risk_level} />
            <Chip
              variant="outlined"
              color={RISK_COLOR[detail.risk_level]}
              label={`${formatProbability(detail.churn_probability)} churn probability`}
            />
          </Box>
        }
        documentTitle={`Customer #${detail.customer_id}`}
        breadcrumbs={crumbs}
      />

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
                getCustomerDetail(id)
                  .then(setDetail)
                  .catch(() => undefined); // the toast already confirmed the send; history refreshes next visit
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
