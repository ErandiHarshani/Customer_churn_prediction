import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import { updateCustomerPhone } from "../api/customers";
import { sendSms } from "../api/retention";
import type { SmsLogEntry } from "../types";

interface SendSmsPanelProps {
  customerId: number;
  phoneNumber: string | null;
  hasMessage: boolean;
  smsLog: SmsLogEntry[];
  onPhoneUpdated: (phone: string) => void;
  onSent: () => void;
}

export function SendSmsPanel({
  customerId,
  phoneNumber,
  hasMessage,
  smsLog,
  onPhoneUpdated,
  onSent,
}: SendSmsPanelProps) {
  const [phoneInput, setPhoneInput] = useState(phoneNumber ?? "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSavePhone() {
    setSavingPhone(true);
    setError(null);
    setSuccess(null);
    try {
      await updateCustomerPhone(customerId, phoneInput);
      onPhoneUpdated(phoneInput);
      setSuccess("Phone number saved.");
    } catch {
      setError("Could not save phone number.");
    } finally {
      setSavingPhone(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await sendSms(customerId);
      setSuccess(
        result.dry_run
          ? "Dry-run mode is on (SMS Gateway Setup) — no real SMS was sent."
          : "SMS sent successfully."
      );
      onSent();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not send SMS.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          SMS
        </Typography>

        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            size="small"
            label="Phone number"
            placeholder="0771234567"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            fullWidth
          />
          <Button variant="outlined" onClick={handleSavePhone} disabled={savingPhone}>
            Save
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Button
          variant="contained"
          color="secondary"
          onClick={handleSend}
          disabled={sending || !hasMessage || !phoneNumber}
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Send SMS
        </Button>
        {!hasMessage && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Generate a retention message first.
          </Typography>
        )}

        {smsLog.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 3 }}>
              Send history
            </Typography>
            <List dense>
              {smsLog.map((entry) => (
                <ListItem key={entry.id} disableGutters>
                  <ListItemText
                    primary={`${entry.phone_number} — ${entry.provider_status ?? "unknown"}`}
                    secondary={new Date(entry.sent_at).toLocaleString()}
                  />
                  <Chip
                    label={entry.dry_run ? "dry-run" : entry.success ? "sent" : "failed"}
                    size="small"
                    color={entry.dry_run ? "default" : entry.success ? "success" : "error"}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </CardContent>
    </Card>
  );
}
