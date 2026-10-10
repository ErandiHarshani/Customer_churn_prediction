import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import SentimentDissatisfiedIcon from "@mui/icons-material/SentimentDissatisfied";
import SentimentSatisfiedIcon from "@mui/icons-material/SentimentSatisfied";
import SentimentNeutralIcon from "@mui/icons-material/SentimentNeutral";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import { createCustomer, getCustomerFieldOptions } from "../api/customers";
import { RiskBadge } from "../components/RiskBadge";
import { ReasonImpactChart } from "../components/ReasonImpactChart";
import { RetentionMessagePanel } from "../components/RetentionMessagePanel";
import type { CreateCustomerRequest, CustomerDetail, CustomerFieldOptions } from "../types";

const EMPTY_FORM: CreateCustomerRequest = {
  tenure: 0,
  city_tier: 1,
  warehouse_to_home: 0,
  preferred_login_device: "",
  preferred_payment_mode: "",
  gender: "",
  hour_spend_on_app: 0,
  number_of_device_registered: 1,
  prefered_order_cat: "",
  satisfaction_score: 3,
  marital_status: "",
  number_of_address: 1,
  complain: 0,
  order_amount_hike_from_last_year: 0,
  coupon_used: 0,
  order_count: 0,
  day_since_last_order: 0,
  cashback_amount: 0,
  review_text: "",
  phone_number: "",
  last_product_purchased: "",
};

// min/max mirror the backend's CreateCustomerRequest limits (app/schemas/customer.py)
const NUMERIC_FIELDS: { key: keyof CreateCustomerRequest; label: string; min: number; max: number }[] = [
  { key: "tenure", label: "Tenure (months)", min: 0, max: 600 },
  { key: "city_tier", label: "City tier (1-3)", min: 1, max: 3 },
  { key: "warehouse_to_home", label: "Warehouse to home distance", min: 0, max: 1000 },
  { key: "hour_spend_on_app", label: "Hours spent on app", min: 0, max: 24 },
  { key: "number_of_device_registered", label: "Devices registered", min: 0, max: 50 },
  { key: "satisfaction_score", label: "Satisfaction score (1-5)", min: 1, max: 5 },
  { key: "number_of_address", label: "Saved addresses", min: 0, max: 100 },
  { key: "order_amount_hike_from_last_year", label: "Order amount hike vs last year (%)", min: -100, max: 1000 },
  { key: "coupon_used", label: "Coupons used", min: 0, max: 1000 },
  { key: "order_count", label: "Order count", min: 0, max: 10000 },
  { key: "day_since_last_order", label: "Days since last order", min: 0, max: 3650 },
  { key: "cashback_amount", label: "Cashback amount", min: 0, max: 100000 },
];

// FastAPI returns either a string detail or a list of pydantic validation errors.
function errorMessage(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d: { loc?: (string | number)[]; msg?: string }) => `${d.loc?.slice(-1)[0] ?? "field"}: ${d.msg}`)
      .join("; ");
  }
  return fallback;
}

function SentimentIcon({ label }: { label: string | null }) {
  if (label === "negative") return <SentimentDissatisfiedIcon color="error" fontSize="large" />;
  if (label === "positive") return <SentimentSatisfiedIcon color="success" fontSize="large" />;
  return <SentimentNeutralIcon color="warning" fontSize="large" />;
}

export function NewCustomerPage() {
  const navigate = useNavigate();
  const [options, setOptions] = useState<CustomerFieldOptions | null>(null);
  const [form, setForm] = useState<CreateCustomerRequest>(EMPTY_FORM);
  const [complain, setComplain] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomerDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getCustomerFieldOptions()
      .then(setOptions)
      .catch((e) => setLoadError(errorMessage(e, "Could not load the form options from the server.")));
  }, []);

  function setField<K extends keyof CreateCustomerRequest>(key: K, value: CreateCustomerRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.preferred_login_device || !form.preferred_payment_mode || !form.gender ||
        !form.prefered_order_cat || !form.marital_status) {
      setError("Please fill in all dropdown fields.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createCustomer({ ...form, complain: complain ? 1 : 0 });
      setResult(created);
    } catch (e) {
      setError(errorMessage(e, "Could not run the prediction. Please check the values and try again."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return <Alert severity="error">{loadError}</Alert>;
  }

  if (!options) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Predict Customer Churn
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter customer details to run the live churn model — this also saves the customer to your
        records with the computed prediction.
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Customer details
              </Typography>
              <Box component="form" onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  {NUMERIC_FIELDS.map((f) => (
                    <Grid size={{ xs: 12, sm: 6 }} key={f.key}>
                      <TextField
                        label={f.label}
                        type="number"
                        fullWidth
                        size="small"
                        value={form[f.key] as number}
                        onChange={(e) => setField(f.key, Number(e.target.value) as never)}
                        slotProps={{ htmlInput: { min: f.min, max: f.max, step: "any" } }}
                      />
                    </Grid>
                  ))}

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Preferred login device"
                      fullWidth
                      size="small"
                      value={form.preferred_login_device}
                      onChange={(e) => setField("preferred_login_device", e.target.value)}
                    >
                      {options.preferred_login_device.map((v) => (
                        <MenuItem key={v} value={v}>
                          {v}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Preferred payment mode"
                      fullWidth
                      size="small"
                      value={form.preferred_payment_mode}
                      onChange={(e) => setField("preferred_payment_mode", e.target.value)}
                    >
                      {options.preferred_payment_mode.map((v) => (
                        <MenuItem key={v} value={v}>
                          {v}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Gender"
                      fullWidth
                      size="small"
                      value={form.gender}
                      onChange={(e) => setField("gender", e.target.value)}
                    >
                      {options.gender.map((v) => (
                        <MenuItem key={v} value={v}>
                          {v}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Preferred order category"
                      fullWidth
                      size="small"
                      value={form.prefered_order_cat}
                      onChange={(e) => setField("prefered_order_cat", e.target.value)}
                    >
                      {options.prefered_order_cat.map((v) => (
                        <MenuItem key={v} value={v}>
                          {v}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Marital status"
                      fullWidth
                      size="small"
                      value={form.marital_status}
                      onChange={(e) => setField("marital_status", e.target.value)}
                    >
                      {options.marital_status.map((v) => (
                        <MenuItem key={v} value={v}>
                          {v}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Has an open complaint?"
                      fullWidth
                      size="small"
                      value={complain ? "yes" : "no"}
                      onChange={(e) => setComplain(e.target.value === "yes")}
                    >
                      <MenuItem value="no">No</MenuItem>
                      <MenuItem value="yes">Yes</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Phone number (optional)"
                      placeholder="0771234567"
                      fullWidth
                      size="small"
                      value={form.phone_number}
                      onChange={(e) => setField("phone_number", e.target.value)}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Last product purchased (optional)"
                      placeholder="e.g. Wireless Earbuds X200"
                      fullWidth
                      size="small"
                      value={form.last_product_purchased}
                      onChange={(e) => setField("last_product_purchased", e.target.value)}
                    />
                  </Grid>

                  <Grid size={12}>
                    <TextField
                      label="Customer review / feedback (optional — scored for sentiment)"
                      fullWidth
                      multiline
                      minRows={2}
                      size="small"
                      value={form.review_text}
                      onChange={(e) => setField("review_text", e.target.value)}
                    />
                  </Grid>
                </Grid>

                {error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                  </Alert>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  sx={{ mt: 3 }}
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  Predict churn
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Prediction results
                </Typography>

                {!result ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      color: "text.secondary",
                      py: 4,
                    }}
                  >
                    <PersonSearchIcon sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="body2">
                      Fill in the form and click "Predict churn" to see results here.
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid size={6}>
                        <Typography variant="caption" color="text.secondary">
                          Churn probability
                        </Typography>
                        <Typography variant="h4" color="error">
                          {(result.churn_probability * 100).toFixed(0)}%
                        </Typography>
                        <RiskBadge level={result.risk_level} />
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="caption" color="text.secondary">
                          Sentiment
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.5 }}>
                          <SentimentIcon label={result.profile.sentiment_label} />
                          <Box>
                            <Typography variant="body1" sx={{ textTransform: "capitalize" }}>
                              {result.profile.sentiment_label ?? "n/a"}
                            </Typography>
                            {result.profile.sentiment_label === "not provided" ||
                            result.profile.sentiment_label === "unavailable" ? (
                              <Typography variant="caption" color="text.secondary">
                                no review scored — model used the dataset median
                              </Typography>
                            ) : (
                              result.profile.sentiment_score !== null && (
                                <Typography variant="caption" color="text.secondary">
                                  score {result.profile.sentiment_score.toFixed(2)}
                                </Typography>
                              )
                            )}
                          </Box>
                        </Stack>
                      </Grid>
                    </Grid>

                    <Divider sx={{ mb: 2 }} />

                    <Typography variant="subtitle2" gutterBottom>
                      Top reasons (SHAP explanation)
                    </Typography>
                    {result.reason_impacts.length > 0 ? (
                      <ReasonImpactChart reasons={result.reason_impacts} />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No strong churn-risk factors identified.
                      </Typography>
                    )}

                    <Button
                      size="small"
                      sx={{ mt: 2 }}
                      onClick={() => navigate(`/customers/${result.customer_id}`)}
                    >
                      View full customer record (#{result.customer_id})
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>

            {result && result.risk_level !== "low" && (
              <RetentionMessagePanel
                customerId={result.customer_id}
                message={result.latest_retention_message}
                onGenerated={(message) => setResult({ ...result, latest_retention_message: message })}
              />
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
