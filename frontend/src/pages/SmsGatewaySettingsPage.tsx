import { useEffect, useState } from "react";
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
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SmsIcon from "@mui/icons-material/Sms";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import {
  getSmsBalance,
  getSmsGatewaySettings,
  updateSmsGatewaySettings,
} from "../api/smsGateway";
import {
  getGeminiModelInfo,
  getGeminiSettings,
  updateGeminiSettings,
} from "../api/geminiSettings";
import { getEngagementAnalytics } from "../api/dashboard";
import type {
  GeminiModelInfo,
  GeminiSettings,
  RetentionStats,
  SmsBalance,
  SmsGatewaySettings,
} from "../types";

const EMPTY_SMS_SETTINGS: SmsGatewaySettings = {
  user_id: "",
  api_key: "",
  sender_id: "NotifyDEMO",
  dry_run: true,
};

const EMPTY_GEMINI_SETTINGS: GeminiSettings = {
  api_key: "",
  model_name: "gemini-3.5-flash-lite",
};

export function SmsGatewaySettingsPage() {
  const [settings, setSettings] = useState<SmsGatewaySettings>(EMPTY_SMS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [balance, setBalance] = useState<SmsBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [gemini, setGemini] = useState<GeminiSettings>(EMPTY_GEMINI_SETTINGS);
  const [geminiLoading, setGeminiLoading] = useState(true);
  const [geminiSaving, setGeminiSaving] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [geminiSaved, setGeminiSaved] = useState(false);

  const [modelInfo, setModelInfo] = useState<GeminiModelInfo | null>(null);
  const [modelInfoLoading, setModelInfoLoading] = useState(false);
  const [modelInfoError, setModelInfoError] = useState<string | null>(null);
  const [retentionStats, setRetentionStats] = useState<RetentionStats | null>(null);

  useEffect(() => {
    getSmsGatewaySettings()
      .then(setSettings)
      .finally(() => setLoading(false));
    refreshBalance();

    getGeminiSettings()
      .then(setGemini)
      .finally(() => setGeminiLoading(false));
    refreshModelInfo();

    getEngagementAnalytics().then((data) => setRetentionStats(data.retention_stats));
  }, []);

  function refreshBalance() {
    setBalanceLoading(true);
    setBalanceError(null);
    getSmsBalance()
      .then(setBalance)
      .catch((e) => {
        setBalance(null);
        setBalanceError(e?.response?.data?.detail ?? "Could not check SMS balance.");
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
        setModelInfoError(e?.response?.data?.detail ?? "Could not reach Gemini.");
      })
      .finally(() => setModelInfoLoading(false));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateSmsGatewaySettings(settings);
      setSettings(result);
      setSaved(true);
      refreshBalance();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveGemini() {
    setGeminiSaving(true);
    setGeminiError(null);
    setGeminiSaved(false);
    try {
      const result = await updateGeminiSettings(gemini);
      setGemini(result);
      setGeminiSaved(true);
      refreshModelInfo();
    } catch (e: any) {
      setGeminiError(e?.response?.data?.detail ?? "Could not save settings.");
    } finally {
      setGeminiSaving(false);
    }
  }

  if (loading || geminiLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        SMS Gateway Setup
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Notify.lk credentials
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Stored in the database so they can be changed here without restarting the
                backend or editing .env.
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="User ID"
                  size="small"
                  value={settings.user_id}
                  onChange={(e) => setSettings({ ...settings, user_id: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="API key"
                  size="small"
                  type={showApiKey ? "text" : "password"}
                  value={settings.api_key}
                  onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                  fullWidth
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowApiKey((v) => !v)}
                            edge="end"
                            size="small"
                          >
                            {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Sender ID"
                  size="small"
                  value={settings.sender_id}
                  onChange={(e) => setSettings({ ...settings, sender_id: e.target.value })}
                  helperText=''
                  fullWidth
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.dry_run}
                      onChange={(e) => setSettings({ ...settings, dry_run: e.target.checked })}
                    />
                  }
                  label={
                    settings.dry_run
                      ? "Dry-run mode (no real SMS sent)"
                      : "Live mode (real SMS will be sent)"
                  }
                />

                {error && <Alert severity="error">{error}</Alert>}
                {saved && !error && <Alert severity="success">Settings saved.</Alert>}

                <Box>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
                  >
                    Save
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="subtitle1">Account balance</Typography>
                <IconButton onClick={refreshBalance} disabled={balanceLoading} size="small">
                  <RefreshIcon />
                </IconButton>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {balanceLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : balanceError ? (
                <Alert severity="warning">{balanceError}</Alert>
              ) : balance ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <SmsIcon color="action" />
                  <Box>
                    <Typography variant="h5">{balance.balance.toFixed(2)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Notify.lk account balance
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={balance.active ? "account active" : "account inactive"}
                    color={balance.active ? "success" : "error"}
                    sx={{ ml: "auto" }}
                  />
                </Box>
              ) : null}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Google Gemini credentials
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Used to generate retention SMS text. Also stored in the database instead
                of .env.
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="API key"
                  size="small"
                  type={showGeminiKey ? "text" : "password"}
                  value={gemini.api_key}
                  onChange={(e) => setGemini({ ...gemini, api_key: e.target.value })}
                  fullWidth
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowGeminiKey((v) => !v)}
                            edge="end"
                            size="small"
                          >
                            {showGeminiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Model name"
                  size="small"
                  value={gemini.model_name}
                  onChange={(e) => setGemini({ ...gemini, model_name: e.target.value })}
                  helperText="e.g. gemini-3.5-flash-lite"
                  fullWidth
                />

                {geminiError && <Alert severity="error">{geminiError}</Alert>}
                {geminiSaved && !geminiError && <Alert severity="success">Settings saved.</Alert>}

                <Box>
                  <Button
                    variant="contained"
                    onClick={handleSaveGemini}
                    disabled={geminiSaving}
                    startIcon={
                      geminiSaving ? <CircularProgress size={16} color="inherit" /> : undefined
                    }
                  >
                    Save
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="subtitle1">Model details</Typography>
                <IconButton onClick={refreshModelInfo} disabled={modelInfoLoading} size="small">
                  <RefreshIcon />
                </IconButton>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {modelInfoLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : modelInfoError ? (
                <Alert severity="warning">{modelInfoError}</Alert>
              ) : modelInfo ? (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
                  <AutoAwesomeIcon color="action" sx={{ mt: 0.5 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">{modelInfo.display_name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Input limit: {modelInfo.input_token_limit.toLocaleString()} tokens · Output
                      limit: {modelInfo.output_token_limit.toLocaleString()} tokens
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
                      {modelInfo.supported_actions.map((action) => (
                        <Chip key={action} size="small" variant="outlined" label={action} />
                      ))}
                    </Box>
                  </Box>
                </Box>
              ) : null}

              

              {retentionStats && (
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                  <Chip
                    size="small"
                    label={`${retentionStats.total_generated} messages generated`}
                  />
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`${retentionStats.gemini_generated} via Gemini`}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${retentionStats.fallback_generated} fallback`}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
