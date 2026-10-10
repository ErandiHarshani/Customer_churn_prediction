import { useEffect, useState, type ReactNode } from "react";
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
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import SentimentDissatisfiedIcon from "@mui/icons-material/SentimentDissatisfied";
import SentimentSatisfiedIcon from "@mui/icons-material/SentimentSatisfied";
import SentimentNeutralIcon from "@mui/icons-material/SentimentNeutral";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import { createCustomer, getCustomerFieldOptions } from "../api/customers";
import { RiskBadge } from "../components/RiskBadge";
import { ReasonsSection } from "../components/ReasonsSection";
import { RetentionMessagePanel } from "../components/RetentionMessagePanel";
import { formatProbability, RISK_COLOR } from "../utils/format";
import type { CreateCustomerRequest, CustomerDetail, CustomerFieldOptions } from "../types";

/* ------------------------------------------------------------------ */
/*  Field definitions                                                  */
/* ------------------------------------------------------------------ */

// The 12 model inputs. Limits mirror the backend's CreateCustomerRequest
// (app/schemas/customer.py); `integer` fields reject decimals.
type NumericKey =
  | "tenure"
  | "day_since_last_order"
  | "cashback_amount"
  | "warehouse_to_home"
  | "number_of_address"
  | "number_of_device_registered";
type SelectKey =
  | "prefered_order_cat"
  | "preferred_payment_mode"
  | "marital_status"
  | "satisfaction_score"
  | "city_tier"
  | "complain";
type OptionalKey = "phone_number" | "last_product_purchased" | "review_text";
type FieldKey = NumericKey | SelectKey;

interface NumericField {
  label: string;
  hint: string;
  placeholder: string;
  min: number;
  max: number;
  integer?: boolean;
}

const NUMERIC: Record<NumericKey, NumericField> = {
  tenure: { label: "Tenure", hint: "Months as a customer (0–600)", placeholder: "e.g. 12", min: 0, max: 600 },
  day_since_last_order: {
    label: "Days since last order",
    hint: "0–3650 days",
    placeholder: "e.g. 5",
    min: 0,
    max: 3650,
  },
  cashback_amount: {
    label: "Cashback earned",
    hint: "Total cashback received (0–100,000)",
    placeholder: "e.g. 150",
    min: 0,
    max: 100000,
  },
  warehouse_to_home: {
    label: "Warehouse-to-home distance",
    hint: "Delivery distance (0–1000)",
    placeholder: "e.g. 15",
    min: 0,
    max: 1000,
  },
  number_of_address: {
    label: "Saved addresses",
    hint: "Whole number (0–100)",
    placeholder: "e.g. 2",
    min: 0,
    max: 100,
    integer: true,
  },
  number_of_device_registered: {
    label: "Devices registered",
    hint: "Whole number (0–50)",
    placeholder: "e.g. 3",
    min: 0,
    max: 50,
    integer: true,
  },
};

const SATISFACTION_OPTIONS = [
  { value: "1", label: "1 – Very dissatisfied" },
  { value: "2", label: "2 – Dissatisfied" },
  { value: "3", label: "3 – Neutral" },
  { value: "4", label: "4 – Satisfied" },
  { value: "5", label: "5 – Very satisfied" },
];
const CITY_TIER_OPTIONS = [
  { value: "1", label: "Tier 1" },
  { value: "2", label: "Tier 2" },
  { value: "3", label: "Tier 3" },
];

// Order matters: validation focuses the first invalid field in this order.
const FIELD_ORDER: FieldKey[] = [
  "tenure",
  "day_since_last_order",
  "complain",
  "prefered_order_cat",
  "preferred_payment_mode",
  "cashback_amount",
  "satisfaction_score",
  "city_tier",
  "warehouse_to_home",
  "number_of_address",
  "number_of_device_registered",
  "marital_status",
];

type FormValues = Record<FieldKey | OptionalKey, string>;
const EMPTY_FORM = Object.fromEntries(
  [...FIELD_ORDER, "phone_number", "last_product_purchased", "review_text"].map((k) => [k, ""]),
) as FormValues;

type FieldErrors = Partial<Record<FieldKey | OptionalKey, string>>;

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of FIELD_ORDER) {
    const raw = values[key].trim();
    if (raw === "") {
      errors[key] = "Required";
      continue;
    }
    if (key in NUMERIC) {
      const f = NUMERIC[key as NumericKey];
      const n = Number(raw);
      if (Number.isNaN(n)) errors[key] = "Enter a number";
      else if (n < f.min || n > f.max) errors[key] = `Must be between ${f.min} and ${f.max.toLocaleString()}`;
      else if (f.integer && !Number.isInteger(n)) errors[key] = "Must be a whole number";
    }
  }
  if (values.phone_number.trim() && !/^\+?[0-9\s-]{9,15}$/.test(values.phone_number.trim())) {
    errors.phone_number = "Enter a valid phone number, e.g. 0771234567";
  }
  return errors;
}

function toRequest(values: FormValues): CreateCustomerRequest {
  const optional = (v: string) => v.trim() || undefined;
  return {
    tenure: Number(values.tenure),
    day_since_last_order: Number(values.day_since_last_order),
    complain: values.complain === "yes" ? 1 : 0,
    prefered_order_cat: values.prefered_order_cat,
    preferred_payment_mode: values.preferred_payment_mode,
    cashback_amount: Number(values.cashback_amount),
    satisfaction_score: Number(values.satisfaction_score),
    city_tier: Number(values.city_tier),
    warehouse_to_home: Number(values.warehouse_to_home),
    number_of_address: Number(values.number_of_address),
    number_of_device_registered: Number(values.number_of_device_registered),
    marital_status: values.marital_status,
    phone_number: optional(values.phone_number),
    last_product_purchased: optional(values.last_product_purchased),
    review_text: optional(values.review_text),
  };
}

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
  return <SentimentNeutralIcon color="disabled" fontSize="large" />;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Typography component="legend" variant="subtitle2" sx={{ p: 0 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {description}
        </Typography>
      )}
      <Grid container spacing={2} sx={{ mt: 1.5 }}>
        {children}
      </Grid>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function NewCustomerPage() {
  const navigate = useNavigate();
  const [options, setOptions] = useState<CustomerFieldOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomerDetail | null>(null);

  useEffect(() => {
    getCustomerFieldOptions()
      .then(setOptions)
      .catch((e) => setLoadError(errorMessage(e, "Could not load the form options from the server.")));
  }, []);

  function setValue(key: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleReset() {
    setValues(EMPTY_FORM);
    setErrors({});
    setSubmitError(null);
    setResult(null);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setResult(null);

    const found = validate(values);
    setErrors(found);
    const firstInvalid = [...FIELD_ORDER, "phone_number" as const].find((k) => found[k]);
    if (firstInvalid) {
      document.getElementById(`field-${firstInvalid}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      setResult(await createCustomer(toRequest(values)));
    } catch (err) {
      setSubmitError(errorMessage(err, "Could not run the prediction. Please check the values and try again."));
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

  const numberField = (key: NumericKey) => {
    const f = NUMERIC[key];
    return (
      <Grid size={{ xs: 12, sm: 6 }} key={key}>
        <TextField
          id={`field-${key}`}
          label={f.label}
          required
          type="number"
          fullWidth
          size="small"
          placeholder={f.placeholder}
          value={values[key]}
          onChange={(e) => setValue(key, e.target.value)}
          error={!!errors[key]}
          helperText={errors[key] ?? f.hint}
          slotProps={{
            htmlInput: { min: f.min, max: f.max, step: f.integer ? 1 : "any", inputMode: "decimal" },
            inputLabel: { shrink: true },
          }}
        />
      </Grid>
    );
  };

  const selectField = (
    key: SelectKey,
    label: string,
    choices: { value: string; label: string }[],
    hint?: string,
  ) => (
    <Grid size={{ xs: 12, sm: 6 }} key={key}>
      <TextField
        id={`field-${key}`}
        select
        label={label}
        required
        fullWidth
        size="small"
        value={values[key]}
        onChange={(e) => setValue(key, e.target.value)}
        error={!!errors[key]}
        helperText={errors[key] ?? hint ?? " "}
        // same floating-label + placeholder treatment as the number fields
        slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
      >
        <MenuItem value="" disabled>
          <Box component="span" sx={{ color: "text.disabled" }}>
            Select…
          </Box>
        </MenuItem>
        {choices.map((c) => (
          <MenuItem key={c.value} value={c.value}>
            {c.label}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
  );

  const asChoices = (list: string[]) => list.map((v) => ({ value: v, label: v }));
  const probabilityColor = result ? `${RISK_COLOR[result.risk_level]}.main` : undefined;
  const sentimentImputed =
    result?.profile.sentiment_label === "not provided" || result?.profile.sentiment_label === "unavailable";

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Predict Customer Churn
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Enter the customer's details to run the live churn model. The customer is saved to your records
        with the prediction.
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 3 }}>
        Fields marked * are required.
      </Typography>

      <Grid container spacing={3} sx={{ alignItems: "flex-start" }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box component="form" noValidate onSubmit={handleSubmit}>
                <Stack spacing={3} divider={<Divider flexItem />}>
                  <Section title="Customer activity">
                    {numberField("tenure")}
                    {numberField("day_since_last_order")}
                    <Grid size={12}>
                      <FormControl required error={!!errors.complain}>
                        <FormLabel id="complain-label" sx={{ typography: "body2" }}>
                          Has an open complaint?
                        </FormLabel>
                        <RadioGroup
                          row
                          aria-labelledby="complain-label"
                          value={values.complain}
                          onChange={(e) => setValue("complain", e.target.value)}
                        >
                          <FormControlLabel
                            value="no"
                            control={<Radio size="small" slotProps={{ input: { id: "field-complain" } }} />}
                            label="No"
                          />
                          <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                        </RadioGroup>
                        {errors.complain && <FormHelperText>{errors.complain}</FormHelperText>}
                      </FormControl>
                    </Grid>
                  </Section>

                  <Section title="Purchases & payment">
                    {selectField("prefered_order_cat", "Preferred order category", asChoices(options.prefered_order_cat))}
                    {selectField("preferred_payment_mode", "Preferred payment mode", asChoices(options.preferred_payment_mode))}
                    {numberField("cashback_amount")}
                    {selectField("satisfaction_score", "Satisfaction score", SATISFACTION_OPTIONS, "Latest survey score")}
                  </Section>

                  <Section title="Account & location">
                    {selectField("city_tier", "City tier", CITY_TIER_OPTIONS)}
                    {numberField("warehouse_to_home")}
                    {numberField("number_of_address")}
                    {numberField("number_of_device_registered")}
                    {selectField("marital_status", "Marital status", asChoices(options.marital_status))}
                  </Section>

                  <Section
                    title="Contact & feedback (optional)"
                    description="Not needed for the prediction, except the review, which is scored for sentiment."
                  >
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        id="field-phone_number"
                        label="Phone number (optional)"
                        placeholder="e.g. 0771234567"
                        fullWidth
                        size="small"
                        value={values.phone_number}
                        onChange={(e) => setValue("phone_number", e.target.value)}
                        error={!!errors.phone_number}
                        helperText={errors.phone_number ?? "Used for retention SMS"}
                        slotProps={{ htmlInput: { inputMode: "tel" }, inputLabel: { shrink: true } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Last product purchased (optional)"
                        placeholder="e.g. Wireless Earbuds X200"
                        fullWidth
                        size="small"
                        value={values.last_product_purchased}
                        onChange={(e) => setValue("last_product_purchased", e.target.value)}
                        helperText="Can be mentioned in the retention SMS"
                        slotProps={{ htmlInput: { maxLength: 200 }, inputLabel: { shrink: true } }}
                      />
                    </Grid>
                    <Grid size={12}>
                      <TextField
                        label="Customer review / feedback (optional)"
                        placeholder="Paste the customer's latest review, if any"
                        fullWidth
                        multiline
                        minRows={3}
                        size="small"
                        value={values.review_text}
                        onChange={(e) => setValue("review_text", e.target.value)}
                        helperText={`Scored by Gemini for sentiment; leave empty if none. ${values.review_text.length}/2000`}
                        slotProps={{ htmlInput: { maxLength: 2000 }, inputLabel: { shrink: true } }}
                      />
                    </Grid>
                  </Section>
                </Stack>

                {submitError && (
                  <Alert severity="error" sx={{ mt: 3 }}>
                    {submitError}
                  </Alert>
                )}

                <Stack
                  direction={{ xs: "column-reverse", sm: "row" }}
                  spacing={1.5}
                  sx={{ mt: 3, justifyContent: "flex-end" }}
                >
                  <Button variant="outlined" onClick={handleReset} disabled={submitting}>
                    Reset form
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
                  >
                    {submitting ? "Predicting…" : "Predict churn"}
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }} sx={{ position: { md: "sticky" }, top: { md: 24 } }}>
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Prediction results
                </Typography>

                {!result ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      color: "text.secondary",
                      py: 4,
                    }}
                  >
                    {submitting ? (
                      <CircularProgress size={32} sx={{ mb: 1 }} />
                    ) : (
                      <PersonSearchIcon sx={{ fontSize: 40, mb: 1 }} />
                    )}
                    <Typography variant="body2">
                      {submitting
                        ? "Running the churn model…"
                        : 'Fill in the required fields and click "Predict churn" to see results here.'}
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid size={6}>
                        <Typography variant="caption" color="text.secondary">
                          Churn probability
                        </Typography>
                        <Typography variant="h4" sx={{ color: probabilityColor, mb: 0.5 }}>
                          {formatProbability(result.churn_probability)}
                        </Typography>
                        <RiskBadge level={result.risk_level} />
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="caption" color="text.secondary">
                          Review sentiment
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.5 }}>
                          <SentimentIcon label={result.profile.sentiment_label} />
                          <Box>
                            <Typography variant="body1" sx={{ textTransform: "capitalize" }}>
                              {result.profile.sentiment_label ?? "n/a"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {sentimentImputed
                                ? "No review scored — model used the dataset median"
                                : result.profile.sentiment_score !== null &&
                                  `score ${result.profile.sentiment_score.toFixed(2)}`}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>
                    </Grid>

                    <Divider sx={{ mb: 2 }} />

                    <Typography variant="subtitle2" gutterBottom>
                      Top reasons (SHAP explanation)
                    </Typography>
                    <ReasonsSection riskLevel={result.risk_level} reasons={result.reason_impacts} />

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
