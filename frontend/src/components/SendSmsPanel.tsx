import { useEffect, useState } from "react";
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
import SendIcon from "@mui/icons-material/Send";
import { updateCustomerPhone } from "../api/customers";
import { sendSms } from "../api/retention";
import { getSmsGatewaySettings } from "../api/smsGateway";
import { useConfirm } from "./feedback/confirmContext";
import { useToast } from "./feedback/toastContext";
import { apiErrorMessage } from "../utils/apiError";
import type { SmsLogEntry } from "../types";

const PHONE_PATTERN = /^\+?[0-9\s-]{9,15}$/;

interface SendSmsPanelProps {
  customerId: number;
  phoneNumber: string | null;
  hasMessage: boolean;
  smsLog: SmsLogEntry[];
  onPhoneUpdated: (phone: string) => void;
  onSent: () => void;
}

/** Same vocabulary as the dashboard's SMS activity table. */
function statusChip(entry: SmsLogEntry) {
  if (entry.dry_run) return <Chip label="simulated" size="small" />;
  return <Chip label={entry.success ? "submitted" : "failed"} size="small" color={entry.success ? "success" : "error"} />;
}

export function SendSmsPanel({ customerId, phoneNumber, hasMessage, smsLog, onPhoneUpdated, onSent }: SendSmsPanelProps) {
  const confirm = useConfirm();
  const toast = useToast();
  // the field follows the saved number until the user edits it
  const [edit, setEdit] = useState({ forPhone: phoneNumber, value: phoneNumber ?? "" });
  const phoneInput = edit.forPhone === phoneNumber ? edit.value : phoneNumber ?? "";
  const [savingPhone, setSavingPhone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<boolean | null>(null);

  useEffect(() => {
    getSmsGatewaySettings()
      .then((s) => setDryRun(s.dry_run))
      .catch(() => setDryRun(null));
  }, []);

  const trimmed = phoneInput.trim();
  const phoneChanged = trimmed !== (phoneNumber ?? "");
  const phoneInvalid = trimmed !== "" && !PHONE_PATTERN.test(trimmed);

  async function handleSavePhone() {
    setSavingPhone(true);
    setError(null);
    try {
      await updateCustomerPhone(customerId, trimmed);
      onPhoneUpdated(trimmed);
      toast.success("Phone number saved.");
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save the phone number."));
    } finally {
      setSavingPhone(false);
    }
  }

  async function handleSend() {
    // re-check the gateway mode right before confirming: it may have changed, and an
    // unknown mode must be treated as possibly live
    const dryRunNow = await getSmsGatewaySettings()
      .then((s) => s.dry_run)
      .catch(() => null);
    setDryRun(dryRunNow);
    const live = dryRunNow !== true;
    const ok = await confirm({
      title: dryRunNow === null ? "Send SMS? (mode unknown)" : live ? "Send a real SMS?" : "Send SMS (dry-run)?",
      body: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            The latest retention message goes to <strong>{phoneNumber}</strong>.
          </Typography>
          <Alert severity={live ? "warning" : "info"} sx={{ py: 0 }}>
            {dryRunNow === null
              ? "Couldn't confirm the SMS mode — this may send a real, charged SMS."
              : live
                ? "LIVE mode — the customer receives this SMS and it is charged."
                : "Dry-run mode — nothing reaches the phone."}
          </Alert>
        </Box>
      ),
      confirmText: live ? "Send real SMS" : "Send",
      tone: live ? "danger" : "default",
    });
    if (!ok) return;

    setSending(true);
    setError(null);
    try {
      const result = await sendSms(customerId);
      if (result.success) {
        toast.success(result.dry_run ? "SMS simulated (dry-run) — nothing was sent." : "SMS submitted to Notify.lk.");
      } else {
        toast.error(`The SMS provider rejected the message (${result.provider_status ?? "unknown status"}).`);
      }
      onSent();
    } catch (e) {
      setError(apiErrorMessage(e, "Could not send the SMS."));
    } finally {
      setSending(false);
    }
  }

  const sendBlockedReason = !hasMessage
    ? "Generate a retention message first."
    : !phoneNumber
      ? "Save a phone number first."
      : phoneChanged
        ? "Save the new phone number before sending."
        : null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography variant="subtitle1">SMS</Typography>
          {dryRun !== null && (
            <Chip size="small" color={dryRun ? "default" : "warning"} label={dryRun ? "Dry-run" : "LIVE SMS"} />
          )}
        </Box>

        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (phoneChanged && trimmed && !phoneInvalid) handleSavePhone();
          }}
          sx={{ display: "flex", gap: 1, mb: 2, alignItems: "flex-start" }}
        >
          <TextField
            size="small"
            label="Phone number"
            placeholder="e.g. 0771234567"
            value={phoneInput}
            onChange={(e) => setEdit({ forPhone: phoneNumber, value: e.target.value })}
            error={phoneInvalid}
            helperText={phoneInvalid ? "Enter a valid phone number" : " "}
            slotProps={{ htmlInput: { inputMode: "tel" } }}
            fullWidth
          />
          <Button
            type="submit"
            variant="outlined"
            disabled={savingPhone || !phoneChanged || !trimmed || phoneInvalid}
            startIcon={savingPhone ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ height: 40 }}
          >
            Save
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={handleSend}
          disabled={sending || !!sendBlockedReason}
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
        >
          {sending ? "Sending…" : "Send SMS"}
        </Button>
        {sendBlockedReason && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {sendBlockedReason}
          </Typography>
        )}

        <Typography variant="subtitle2" sx={{ mt: 3 }}>
          Send history
        </Typography>
        {smsLog.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            No SMS sent to this customer yet.
          </Typography>
        ) : (
          <List dense>
            {smsLog.map((entry) => (
              <ListItem key={entry.id} disableGutters secondaryAction={statusChip(entry)}>
                <ListItemText
                  primary={entry.phone_number}
                  secondary={new Date(entry.sent_at).toLocaleString()}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
