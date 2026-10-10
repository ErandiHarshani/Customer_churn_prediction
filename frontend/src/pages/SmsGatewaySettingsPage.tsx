import { useEffect, useState, type ReactNode, type SyntheticEvent } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SmsIcon from "@mui/icons-material/Sms";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { getSmsBalance, getSmsGatewaySettings, updateSmsGatewaySettings } from "../api/smsGateway";
import { getGeminiModelInfo, getGeminiSettings, updateGeminiSettings } from "../api/geminiSettings";
import { getEngagementAnalytics } from "../api/dashboard";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, PageSkeleton } from "../components/PageStates";
import { IconDisc } from "../components/StatCard";
import { useConfirm } from "../components/feedback/confirmContext";
import { useToast } from "../components/feedback/toastContext";
import { apiErrorMessage } from "../utils/apiError";
import { SMS_SETTINGS_CHANGED } from "../utils/events";
import type { GeminiModelInfo, GeminiSettings, RetentionStats, SmsBalance, SmsGatewaySettings } from "../types";

/** Password-style input with an accessible show/hide toggle. */
function SecretField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      label={label}
      size="small"
      type={shown ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      fullWidth
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={shown ? `Hide ${label}` : `Show ${label}`}>
                <IconButton
                  onClick={() => setShown((v) => !v)}
                  edge="end"
                  size="small"
                  aria-label={shown ? `Hide ${label}` : `Show ${label}`}
                >
                  {shown ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

/** Card title with a labelled "check again" button. */
function StatusCardHeader({ title, refreshLabel, onRefresh, busy }: { title: string; refreshLabel: string; onRefresh: () => void; busy: boolean }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Typography variant="subtitle1">{title}</Typography>
      <Tooltip title={refreshLabel}>
        <span>
          <IconButton onClick={onRefresh} disabled={busy} size="small" aria-label={refreshLabel}>
            {busy ? <CircularProgress size={18} /> : <RefreshIcon />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

function CardStatus({ loading, error, children }: { loading: boolean; error: string | null; children: ReactNode }) {
  if (loading) return <Skeleton variant="rounded" height={56} />;
  if (error) return <Alert severity="warning">{error}</Alert>;
  return <>{children}</>;
}

export function SmsGatewaySettingsPage() {
  const confirm = useConfirm();
  const toast = useToast();

  // nothing editable is shown until the real settings have loaded, so a failed
  // load can never be saved back over the stored credentials as blank defaults
  const [sms, setSms] = useState<SmsGatewaySettings | null>(null);
  const [savedDryRun, setSavedDryRun] = useState(true);
  const [gemini, setGemini] = useState<GeminiSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [geminiSaving, setGeminiSaving] = useState(false);

  const [balance, setBalance] = useState<SmsBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<GeminiModelInfo | null>(null);
  const [modelInfoLoading, setModelInfoLoading] = useState(true);
  const [modelInfoError, setModelInfoError] = useState<string | null>(null);
  const [retentionStats, setRetentionStats] = useState<RetentionStats | null>(null);

  function refreshBalance() {
    setBalanceLoading(true);
    setBalanceError(null);
    getSmsBalance()
      .then(setBalance)
      .catch((e) => {
        setBalance(null);
        setBalanceError(apiErrorMessage(e, "Could not check the SMS balance."));
      })
      .finally(() => setBalanceLoading(false));
  }

  function refreshModelInfo() {
    setModelInfoLoading(true);
    setModelInfoError(null);
    getGeminiModelInfo()
      .then(setModelInfo)
      .catch((e) => {
        setModelInfo(null);
        setModelInfoError(apiErrorMessage(e, "Could not reach Gemini."));
      })
      .finally(() => setModelInfoLoading(false));
  }

  useEffect(() => {
    let stale = false;
    Promise.all([getSmsGatewaySettings(), getGeminiSettings()])
      .then(([s, g]) => {
        if (stale) return;
        setSms(s);
        setSavedDryRun(s.dry_run);
        setGemini(g);
      })
      .catch((e) => !stale && setLoadError(apiErrorMessage(e, "Could not load the settings.")));
    getEngagementAnalytics()
      .then((d) => !stale && setRetentionStats(d.retention_stats))
      .catch(() => undefined); // optional stats; the page works without them
    return () => {
      stale = true;
    };
  }, [retryTick]);

  // first check on mount (loading flags start true; later checks use refresh*)
  useEffect(() => {
    getSmsBalance()
      .then(setBalance)
      .catch((e) => setBalanceError(apiErrorMessage(e, "Could not check the SMS balance.")))
      .finally(() => setBalanceLoading(false));
    getGeminiModelInfo()
      .then(setModelInfo)
      .catch((e) => setModelInfoError(apiErrorMessage(e, "Could not reach Gemini.")))
      .finally(() => setModelInfoLoading(false));
  }, []);

  async function handleSave(e: SyntheticEvent) {
    e.preventDefault();
    if (!sms) return;
    if (savedDryRun && !sms.dry_run) {
      const ok = await confirm({
        title: "Turn off dry-run?",
        body: "From now on, every \"Send SMS\" delivers a real message to the customer's phone and is charged to your Notify.lk balance.",
        confirmText: "Switch to live",
        tone: "danger",
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const result = await updateSmsGatewaySettings({
        ...sms,
        user_id: sms.user_id.trim(),
        api_key: sms.api_key.trim(),
        sender_id: sms.sender_id.trim(),
      });
      setSms(result);
      setSavedDryRun(result.dry_run);
      window.dispatchEvent(new Event(SMS_SETTINGS_CHANGED));
      toast.success(result.dry_run ? "SMS settings saved (dry-run on)." : "SMS settings saved — live sending is ON.");
      refreshBalance();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save the SMS settings."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveGemini(e: SyntheticEvent) {
    e.preventDefault();
    if (!gemini) return;
    setGeminiSaving(true);
    try {
      const result = await updateGeminiSettings({ api_key: gemini.api_key.trim(), model_name: gemini.model_name.trim() });
      setGemini(result);
      toast.success("Gemini settings saved.");
      refreshModelInfo();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save the Gemini settings."));
    } finally {
      setGeminiSaving(false);
    }
  }

  const header = (
    <PageHeader
      title="SMS & AI Settings"
      subtitle="Credentials for the Notify.lk SMS gateway and the Gemini model that writes retention messages."
    />
  );

  if (loadError) {
    return (
      <Box>
        {header}
        <ErrorState
          message={loadError}
          onRetry={() => {
            setLoadError(null);
            setRetryTick((t) => t + 1);
          }}
        />
      </Box>
    );
  }

  if (!sms || !gemini) {
    return <PageSkeleton cards={0} tall={2} />;
  }

  const senderTooLong = sms.sender_id.trim().length > 11;

  return (
    <Box>
      {header}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3}>
            <Card variant="outlined">
              <CardContent component="form" onSubmit={handleSave}>
                <Typography variant="subtitle1" gutterBottom>
                  Notify.lk SMS gateway
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Saved in the database, so changes apply immediately without restarting the backend.
                </Typography>

                <Stack spacing={2}>
                  <TextField
                    label="User ID"
                    size="small"
                    value={sms.user_id}
                    onChange={(e) => setSms({ ...sms, user_id: e.target.value })}
                    autoComplete="off"
                    fullWidth
                  />
                  <SecretField label="API key" value={sms.api_key} onChange={(v) => setSms({ ...sms, api_key: v })} />
                  <TextField
                    label="Sender ID"
                    size="small"
                    value={sms.sender_id}
                    onChange={(e) => setSms({ ...sms, sender_id: e.target.value })}
                    error={senderTooLong}
                    helperText={senderTooLong ? "Sender IDs are at most 11 characters" : "The name customers see, e.g. NotifyDEMO"}
                    fullWidth
                  />
                  <Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={sms.dry_run}
                          onChange={(e) => setSms({ ...sms, dry_run: e.target.checked })}
                        />
                      }
                      label={sms.dry_run ? "Dry-run — sends are simulated" : "Live — real SMS are sent and charged"}
                    />
                    {!sms.dry_run && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Live sending {savedDryRun ? "will be turned on when you save" : "is on"}: every Send SMS reaches a real phone.
                      </Alert>
                    )}
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={saving || senderTooLong}
                      startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                      {saving ? "Saving…" : "Save SMS settings"}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <StatusCardHeader
                  title="Account balance"
                  refreshLabel="Check balance again"
                  onRefresh={refreshBalance}
                  busy={balanceLoading}
                />
                <Divider sx={{ my: 1.5 }} />
                <CardStatus loading={balanceLoading} error={balanceError}>
                  {balance && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <IconDisc>
                        <SmsIcon />
                      </IconDisc>
                      <Box>
                        <Typography variant="h5" component="p">
                          LKR {balance.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Notify.lk account balance
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={balance.active ? "Account active" : "Account inactive"}
                        color={balance.active ? "success" : "error"}
                        sx={{ ml: "auto" }}
                      />
                    </Box>
                  )}
                </CardStatus>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3}>
            <Card variant="outlined">
              <CardContent component="form" onSubmit={handleSaveGemini}>
                <Typography variant="subtitle1" gutterBottom>
                  Google Gemini
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Writes the personalised retention SMS and scores review sentiment.
                </Typography>

                <Stack spacing={2}>
                  <SecretField label="Gemini API key" value={gemini.api_key} onChange={(v) => setGemini({ ...gemini, api_key: v })} />
                  <TextField
                    label="Model name"
                    size="small"
                    value={gemini.model_name}
                    onChange={(e) => setGemini({ ...gemini, model_name: e.target.value })}
                    helperText="e.g. gemini-3.5-flash-lite"
                    fullWidth
                  />
                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={geminiSaving || !gemini.model_name.trim()}
                      startIcon={geminiSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                      {geminiSaving ? "Saving…" : "Save Gemini settings"}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <StatusCardHeader
                  title="Model status"
                  refreshLabel="Check Gemini connection again"
                  onRefresh={refreshModelInfo}
                  busy={modelInfoLoading}
                />
                <Divider sx={{ my: 1.5 }} />
                <CardStatus loading={modelInfoLoading} error={modelInfoError}>
                  {modelInfo && (
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                      <IconDisc>
                        <AutoAwesomeIcon />
                      </IconDisc>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2">{modelInfo.display_name} — connected</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          Input limit {modelInfo.input_token_limit.toLocaleString()} tokens · output limit{" "}
                          {modelInfo.output_token_limit.toLocaleString()} tokens
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </CardStatus>

                {retentionStats && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 1 }}>
                      Retention messages so far
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Chip size="small" label={`${retentionStats.total_generated.toLocaleString()} generated`} />
                      <Chip size="small" color="primary" variant="outlined" label={`${retentionStats.gemini_generated.toLocaleString()} by Gemini`} />
                      <Chip size="small" variant="outlined" label={`${retentionStats.fallback_generated.toLocaleString()} standard`} />
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
