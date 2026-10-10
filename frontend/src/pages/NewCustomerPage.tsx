import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import useMediaQuery from "@mui/material/useMediaQuery";
import { alpha, useTheme, type SxProps, type Theme } from "@mui/material/styles";
import SentimentDissatisfiedIcon from "@mui/icons-material/SentimentDissatisfied";
import SentimentSatisfiedIcon from "@mui/icons-material/SentimentSatisfied";
import SentimentNeutralIcon from "@mui/icons-material/SentimentNeutral";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import { createCustomer, getCustomerFieldOptions } from "../api/customers";
import { RiskBadge } from "../components/RiskBadge";
import { ReasonsSection } from "../components/ReasonsSection";
import { RetentionMessagePanel } from "../components/RetentionMessagePanel";
import { formatProbability, RISK_COLOR } from "../utils/format";
import { apiErrorMessage } from "../utils/apiError";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/feedback/toastContext";
import { keyframes } from "@mui/system";
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
  /** shown inside the input, so the hint only needs the range */
  unit?: string;
}

const NUMERIC: Record<NumericKey, NumericField> = {
  tenure: {
    label: "Tenure",
    hint: "Time as a customer (0–600)",
    placeholder: "e.g. 12",
    min: 0,
    max: 600,
    unit: "months",
  },
  day_since_last_order: {
    label: "Days since last order",
    hint: "0–3,650",
    placeholder: "e.g. 5",
    min: 0,
    max: 3650,
    unit: "days",
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

function SentimentIcon({ label }: { label: string | null }) {
  if (label === "negative") return <SentimentDissatisfiedIcon color="error" fontSize="large" />;
  if (label === "positive") return <SentimentSatisfiedIcon color="success" fontSize="large" />;
  return <SentimentNeutralIcon color="disabled" fontSize="large" />;
}

// The result panel appears after submit — bridge it in instead of letting it pop
// (occasional, 220ms, strong ease-out; reduced motion keeps only the fade).
const resultIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const focusRing = (color: string) => `0 0 0 3px ${alpha(color, 0.2)}`;

// Labels live above the inputs (no floating label), so the input only needs a
// clear box, a visible focus ring and helper text aligned with the label.
const fieldSx: SxProps<Theme> = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "background.paper",
    transition: "box-shadow 150ms ease",
    "&:hover:not(.Mui-focused):not(.Mui-error) .MuiOutlinedInput-notchedOutline": { borderColor: "text.secondary" },
    "&.Mui-focused": { boxShadow: (t: Theme) => focusRing(t.palette.primary.main) },
    "&.Mui-focused.Mui-error": { boxShadow: (t: Theme) => focusRing(t.palette.error.main) },
  },
  "& .MuiOutlinedInput-input:not(.MuiInputBase-inputMultiline)": { py: 1.25 },
  "& .MuiInputBase-multiline": { py: 1.25 },
  "& .MuiFormHelperText-root": { mx: 0, mt: 0.75 },
};

// No/Yes as two bordered "radio tiles" that look like the other inputs (same
// height, border, radius and white fill). The radio dot stays visible so the
// choice reads as a standard single-select; the chosen tile turns indigo.
const choiceTilesSx = (error: boolean): SxProps<Theme> => ({
  flexWrap: "nowrap",
  gap: 1.5,
  "& .MuiFormControlLabel-root": {
    flex: 1,
    m: 0,
    minHeight: 43,
    pl: 0.5,
    pr: 1.5,
    borderRadius: 1,
    border: 1,
    borderColor: (t: Theme) => (error ? t.palette.error.main : alpha(t.palette.text.primary, 0.23)),
    bgcolor: "background.paper",
    cursor: "pointer",
    userSelect: "none",
    transition: "border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease",
    "@media (hover: hover) and (pointer: fine)": {
      "&:hover:not(:has(input:checked))": { borderColor: "text.secondary" },
    },
    "&:has(input:checked)": {
      borderColor: "primary.main",
      bgcolor: "primary.light",
      color: "primary.main",
    },
    "&:has(input:focus-visible)": { boxShadow: (t: Theme) => focusRing(t.palette.primary.main) },
  },
  "& .MuiFormControlLabel-label": { typography: "body2", fontWeight: 500 },
  "& .MuiFormControlLabel-root:has(input:checked) .MuiFormControlLabel-label": { fontWeight: 600 },
});

// Floating, translucent action bar: content scrolls under it, so the primary
// action stays in reach on a long form. Solid when transparency is reduced.
const actionBarSx: SxProps<Theme> = {
  position: "sticky",
  bottom: { xs: 12, sm: 16 },
  zIndex: 2,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 1.5,
  p: 1.5,
  borderRadius: "14px",
  border: 1,
  borderColor: "divider",
  bgcolor: (t: Theme) => alpha(t.palette.background.paper, 0.72),
  backdropFilter: "blur(20px) saturate(180%)",
  boxShadow: (t: Theme) =>
    t.palette.mode === "light"
      ? "0 8px 24px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.06)"
      : "0 8px 24px rgba(0, 0, 0, 0.4)",
  "@media (prefers-reduced-transparency: reduce)": { bgcolor: "background.paper", backdropFilter: "none" },
};

function FieldLabel({ htmlFor, id, children }: { htmlFor?: string; id?: string; children: ReactNode }) {
  return (
    <FormLabel
      component="label"
      htmlFor={htmlFor}
      id={id}
      // labels stay neutral: no "*", no focus/error tint from a parent FormControl
      required={false}
      focused={false}
      error={false}
      sx={{ display: "block", mb: 0.75, typography: "body2", fontWeight: 500, color: "text.primary" }}
    >
      {children}
    </FormLabel>
  );
}

function Section({
  title,
  description,
  icon,
  optional,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  optional?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <Card variant="outlined" role="group" aria-labelledby={headingId}>
      <CardContent sx={{ p: { xs: 2, sm: 3 }, "&:last-child": { pb: { xs: 2.5, sm: 3 } } }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Box
            aria-hidden
            sx={{
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 1,
              bgcolor: "primary.light",
              color: "primary.main",
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography
                id={headingId}
                variant="h6"
                component="h2"
                sx={{ fontSize: "1.0625rem", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3 }}
              >
                {title}
              </Typography>
              {optional && <Chip label="Optional" size="small" variant="outlined" />}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
        </Stack>
        <Grid container columnSpacing={3} rowSpacing={2.5} sx={{ mt: 2.5 }}>
          {children}
        </Grid>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function NewCustomerPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [options, setOptions] = useState<CustomerFieldOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomerDetail | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  // Below lg the results panel sits under the form, out of view after submit.
  const resultsStacked = useMediaQuery(theme.breakpoints.down("lg"));

  useEffect(() => {
    getCustomerFieldOptions()
      .then(setOptions)
      .catch((e) => setLoadError(apiErrorMessage(e, "Could not load the form options from the server.")));
  }, []);

  function setValue(key: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  // Inline validation: check a field as soon as the user leaves it. Empty
  // fields wait for submit, so tabbing past one doesn't flag it "Required".
  function handleBlur(key: NumericKey | "phone_number") {
    if (!values[key].trim()) return;
    const message = validate(values)[key];
    setErrors((prev) => ({ ...prev, [key]: message }));
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
      const created = await createCustomer(toRequest(values));
      setResult(created);
      toast.success(`Customer #${created.customer_id} saved with its prediction.`);
      if (resultsStacked) {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        resultsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Could not run the prediction. Please check the values and try again."));
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
        <FieldLabel htmlFor={`field-${key}`}>{f.label}</FieldLabel>
        <TextField
          id={`field-${key}`}
          required
          type="number"
          fullWidth
          size="small"
          sx={fieldSx}
          placeholder={f.placeholder}
          value={values[key]}
          onChange={(e) => setValue(key, e.target.value)}
          onBlur={() => handleBlur(key)}
          error={!!errors[key]}
          helperText={errors[key] ?? f.hint}
          slotProps={{
            htmlInput: { min: f.min, max: f.max, step: f.integer ? 1 : "any", inputMode: "decimal" },
            input: f.unit ? { endAdornment: <InputAdornment position="end">{f.unit}</InputAdornment> } : undefined,
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
      <FieldLabel id={`field-${key}-label`}>{label}</FieldLabel>
      <TextField
        id={`field-${key}`}
        select
        required
        fullWidth
        size="small"
        sx={fieldSx}
        value={values[key]}
        onChange={(e) => setValue(key, e.target.value)}
        error={!!errors[key]}
        helperText={errors[key] ?? hint ?? " "}
        // a <label for> can't name MUI's select, so point aria-labelledby at it
        slotProps={{ select: { displayEmpty: true, labelId: `field-${key}-label` } }}
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
      <PageHeader
        title="Predict Customer Churn"
        subtitle="Enter the customer's details to run the live churn model. The customer is saved with the prediction."
      />

      <Grid container spacing={3} sx={{ alignItems: "flex-start" }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <Section
                title="Customer activity"
                description="How long they've been a customer and how recently they ordered."
                icon={<HistoryOutlinedIcon fontSize="small" />}
              >
                {numberField("tenure")}
                {numberField("day_since_last_order")}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl required error={!!errors.complain} fullWidth>
                    <FieldLabel id="complain-label">Has an open complaint?</FieldLabel>
                    <RadioGroup
                      row
                      aria-labelledby="complain-label"
                      value={values.complain}
                      onChange={(e) => setValue("complain", e.target.value)}
                      sx={choiceTilesSx(!!errors.complain)}
                    >
                      <FormControlLabel
                        value="no"
                        control={<Radio size="small" slotProps={{ input: { id: "field-complain" } }} />}
                        label="No"
                      />
                      <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                    </RadioGroup>
                    {errors.complain && <FormHelperText sx={{ mx: 0, mt: 0.75 }}>{errors.complain}</FormHelperText>}
                  </FormControl>
                </Grid>
              </Section>

              <Section
                title="Purchases & payment"
                description="What they buy, how they pay and how satisfied they are."
                icon={<ShoppingBagOutlinedIcon fontSize="small" />}
              >
                {selectField("prefered_order_cat", "Preferred order category", asChoices(options.prefered_order_cat))}
                {selectField("preferred_payment_mode", "Preferred payment mode", asChoices(options.preferred_payment_mode))}
                {numberField("cashback_amount")}
                {selectField("satisfaction_score", "Satisfaction score", SATISFACTION_OPTIONS, "Latest survey score")}
              </Section>

              <Section
                title="Account & location"
                description="Where they live and how their account is set up."
                icon={<LocationOnOutlinedIcon fontSize="small" />}
              >
                {selectField("city_tier", "City tier", CITY_TIER_OPTIONS)}
                {numberField("warehouse_to_home")}
                {numberField("number_of_address")}
                {numberField("number_of_device_registered")}
                {selectField("marital_status", "Marital status", asChoices(options.marital_status))}
              </Section>

              <Section
                title="Contact & feedback"
                description="Not needed for the prediction, except the review, which is scored for sentiment."
                icon={<ChatBubbleOutlineOutlinedIcon fontSize="small" />}
                optional
              >
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FieldLabel htmlFor="field-phone_number">Phone number</FieldLabel>
                  <TextField
                    id="field-phone_number"
                    placeholder="e.g. 0771234567"
                    fullWidth
                    size="small"
                    sx={fieldSx}
                    value={values.phone_number}
                    onChange={(e) => setValue("phone_number", e.target.value)}
                    onBlur={() => handleBlur("phone_number")}
                    error={!!errors.phone_number}
                    helperText={errors.phone_number ?? "Used for retention SMS"}
                    slotProps={{ htmlInput: { inputMode: "tel" } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FieldLabel htmlFor="field-last_product_purchased">Last product purchased</FieldLabel>
                  <TextField
                    id="field-last_product_purchased"
                    placeholder="e.g. Wireless Earbuds X200"
                    fullWidth
                    size="small"
                    sx={fieldSx}
                    value={values.last_product_purchased}
                    onChange={(e) => setValue("last_product_purchased", e.target.value)}
                    helperText="Can be mentioned in the retention SMS"
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                  />
                </Grid>
                <Grid size={12}>
                  <FieldLabel htmlFor="field-review_text">Customer review / feedback</FieldLabel>
                  <TextField
                    id="field-review_text"
                    placeholder="Paste the customer's latest review, if any"
                    fullWidth
                    multiline
                    minRows={3}
                    size="small"
                    sx={fieldSx}
                    value={values.review_text}
                    onChange={(e) => setValue("review_text", e.target.value)}
                    helperText={`Scored by Gemini for sentiment; leave empty if none. ${values.review_text.length}/2000`}
                    slotProps={{ htmlInput: { maxLength: 2000 } }}
                  />
                </Grid>
              </Section>

              {submitError && <Alert severity="error">{submitError}</Alert>}

              <Box sx={actionBarSx}>
                {/* tonal: coloured, but quieter than the solid primary action */}
                <Button
                  size="large"
                  onClick={handleReset}
                  disabled={submitting}
                  sx={{
                    bgcolor: "primary.light",
                    color: "primary.main",
                    "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, 0.16) },
                  }}
                >
                  Reset form
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
                  sx={{ flex: { xs: 1, sm: "none" } }}
                >
                  {submitting ? "Predicting…" : "Run prediction"}
                </Button>
              </Box>
            </Stack>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }} sx={{ position: { lg: "sticky" }, top: { lg: 24 } }}>
          <Stack spacing={2}>
            <Card variant="outlined" ref={resultsRef} sx={{ scrollMarginTop: 80 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="subtitle1" component="h2" gutterBottom>
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
                        : 'Fill in the required fields and click "Run prediction" to see results here.'}
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    key={result.customer_id}
                    sx={{
                      animation: `${resultIn} 220ms cubic-bezier(0.23, 1, 0.32, 1)`,
                      "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                    }}
                  >
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
