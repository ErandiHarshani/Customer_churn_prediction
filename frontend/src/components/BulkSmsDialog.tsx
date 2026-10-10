import { useEffect, useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import { getBulkGenerateJob, bulkSendSms, startBulkGenerateMessages } from "../api/retention";
import { getCustomerFieldOptions, getCustomers } from "../api/customers";
import { getSmsGatewaySettings } from "../api/smsGateway";
import { useConfirm } from "./feedback/confirmContext";
import { useToast } from "./feedback/toastContext";
import { apiErrorMessage } from "../utils/apiError";
import type { BulkGenerateJobStatus, BulkSendSmsResponse, BulkTarget, RiskLevel } from "../types";

const POLL_INTERVAL_MS = 1500;

interface BulkSmsDialogProps {
  open: boolean;
  onClose: () => void;
  selectedIds: number[];
  /** the list page's current filters, used as the starting point in "filter" mode */
  initialRiskLevel: RiskLevel | null;
  search: string;
  onDone: () => void;
}

/** Remounted (via `key`) each time it opens, so every open starts from fresh state. */
export function BulkSmsDialog({ open, onClose, selectedIds, initialRiskLevel, search, onDone }: BulkSmsDialogProps) {
  const confirm = useConfirm();
  const toast = useToast();

  // Never default to "everyone": with a selection, target exactly that selection;
  // otherwise start from the filters the user is already looking at.
  const [mode, setMode] = useState<"selected" | "filter">(selectedIds.length > 0 ? "selected" : "filter");
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "">(initialRiskLevel ?? "");
  const [useSearch, setUseSearch] = useState(!!search);
  const [count, setCount] = useState<{ key: string; total: number } | null>(null);
  const [dryRun, setDryRun] = useState<boolean | null>(null);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [starting, setStarting] = useState(false);
  const [genJob, setGenJob] = useState<BulkGenerateJobStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<BulkSendSmsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    getCustomerFieldOptions()
      .then((opts) => setCategories(opts.prefered_order_cat))
      .catch(() => setCategories([]));
    getSmsGatewaySettings()
      .then((s) => setDryRun(s.dry_run))
      .catch(() => setDryRun(null));
  }, [open]);

  const activeSearch = useSearch ? search : "";
  const countKey = JSON.stringify([category, riskLevel, activeSearch]);
  useEffect(() => {
    if (!open || mode !== "filter") return;
    let stale = false;
    getCustomers({
      page: 1,
      page_size: 1,
      prefered_order_cat: category || undefined,
      risk_level: riskLevel || undefined,
      search: activeSearch || undefined,
    })
      .then((res) => !stale && setCount({ key: countKey, total: res.total }))
      .catch(() => !stale && setCount(null));
    return () => {
      stale = true;
    };
  }, [open, mode, category, riskLevel, activeSearch, countKey]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const target: BulkTarget =
    mode === "selected"
      ? { customer_ids: selectedIds }
      : {
          all_matching: true,
          prefered_order_cat: category || undefined,
          risk_level: riskLevel || undefined,
          search: activeSearch || undefined,
        };

  const countLoading = mode === "filter" && count?.key !== countKey;
  const targetCount = mode === "selected" ? selectedIds.length : count?.key === countKey ? count.total : 0;
  const genInProgress = !!genJob && !genJob.done;
  const busy = sending || starting || genInProgress;
  // filter mode with nothing narrowing it = the whole database
  const targetsEveryone = mode === "filter" && !category && !riskLevel && !activeSearch;

  function resetResults() {
    setGenJob(null);
    setSendResult(null);
    setError(null);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function handleClose() {
    if (sending) return; // a send is in flight — keep the result visible
    stopPolling();
    onClose();
  }

  async function handleGenerate() {
    if (forceRegenerate) {
      const ok = await confirm({
        title: `Regenerate messages for ${targetCount.toLocaleString()} customers?`,
        body: "Existing messages are replaced and each one uses a Gemini request.",
        confirmText: "Regenerate",
      });
      if (!ok) return;
    }
    setStarting(true);
    resetResults();
    try {
      const started = await startBulkGenerateMessages(target, forceRegenerate);
      setGenJob({
        job_id: started.job_id,
        target_count: started.target_count,
        processed: 0,
        generated: 0,
        already_had_message: 0,
        failed: 0,
        done: false,
        error: null,
      });
      pollRef.current = setInterval(async () => {
        try {
          const status = await getBulkGenerateJob(started.job_id);
          setGenJob(status);
          if (status.done) {
            stopPolling();
            toast.success(`Messages ready: ${status.generated.toLocaleString()} generated, ${status.already_had_message.toLocaleString()} already had one.`);
          }
        } catch (e) {
          stopPolling();
          setError(apiErrorMessage(e, "Lost track of the generation job. It may still be running on the server."));
        }
      }, POLL_INTERVAL_MS);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not start message generation."));
    } finally {
      setStarting(false);
    }
  }

  async function handleSend() {
    // re-check the mode at send time; unknown is treated as possibly live
    const dryRunNow = await getSmsGatewaySettings()
      .then((s) => s.dry_run)
      .catch(() => null);
    setDryRun(dryRunNow);
    const live = dryRunNow !== true;
    const everyone = dryRunNow !== null && targetsEveryone;
    const ok = await confirm({
      title: targetsEveryone
        ? `Send SMS to ALL ${targetCount.toLocaleString()} customers?`
        : `Send SMS to ${targetCount.toLocaleString()} customer${targetCount === 1 ? "" : "s"}?`,
      body: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Each customer receives their latest generated retention message. Customers without a phone number
            or a message are skipped.
          </Typography>
          {targetsEveryone && (
            <Alert severity="warning" sx={{ py: 0, mb: 1 }}>
              No filter or selection is applied — this targets every customer in the database.
            </Alert>
          )}
          <Alert severity={live ? "warning" : "info"} sx={{ py: 0 }}>
            Mode: {dryRunNow === null ? "unknown — this may send real, charged SMS" : dryRunNow ? "Dry-run (simulated, nothing is sent)" : "LIVE — real SMS, charged"}
          </Alert>
        </Box>
      ),
      confirmText: everyone && live ? "Send to everyone" : live ? "Send real SMS" : "Send",
      tone: live || targetsEveryone ? "danger" : "default",
    });
    if (!ok) return;

    setSending(true);
    setError(null);
    try {
      const result = await bulkSendSms(target);
      setSendResult(result);
      toast.success(`${result.sent.toLocaleString()} of ${result.target_count.toLocaleString()} SMS ${dryRunNow ? "simulated" : "sent"}.`);
      onDone();
    } catch (e) {
      setError(apiErrorMessage(e, "Could not send SMS."));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth aria-labelledby="bulk-sms-title">
      <DialogTitle id="bulk-sms-title" sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        Bulk SMS
        {dryRun !== null && (
          <Chip size="small" color={dryRun ? "default" : "warning"} label={dryRun ? "Dry-run" : "LIVE SMS"} />
        )}
      </DialogTitle>
      <DialogContent>
        <FormControl sx={{ mb: 2 }} disabled={busy}>
          <RadioGroup
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as "selected" | "filter");
              resetResults();
            }}
          >
            <FormControlLabel
              value="selected"
              control={<Radio />}
              disabled={selectedIds.length === 0}
              label={`Selected customers (${selectedIds.length.toLocaleString()})`}
            />
            <FormControlLabel value="filter" control={<Radio />} label="All customers matching filters" />
          </RadioGroup>
        </FormControl>

        {mode === "filter" && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <FormControl size="small" fullWidth disabled={busy}>
                <InputLabel id="bulk-sms-category-label">Order category</InputLabel>
                <Select
                  labelId="bulk-sms-category-label"
                  label="Order category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    resetResults();
                  }}
                >
                  <MenuItem value="">Any category</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth disabled={busy}>
                <InputLabel id="bulk-sms-risk-label">Risk level</InputLabel>
                <Select
                  labelId="bulk-sms-risk-label"
                  label="Risk level"
                  value={riskLevel}
                  onChange={(e) => {
                    setRiskLevel(e.target.value as RiskLevel | "");
                    resetResults();
                  }}
                >
                  <MenuItem value="">Any risk level</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {search && useSearch && (
              <Chip
                size="small"
                sx={{ mt: 1.5 }}
                label={`Search: “${search}”`}
                onDelete={busy ? undefined : () => setUseSearch(false)}
              />
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, minHeight: 20 }} aria-live="polite">
              {countLoading ? "Counting matching customers…" : `${targetCount.toLocaleString()} customer${targetCount === 1 ? "" : "s"} match`}
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Step 1 — Generate retention messages
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={forceRegenerate} onChange={(e) => setForceRegenerate(e.target.checked)} disabled={busy} />}
            label="Regenerate for customers who already have a message"
          />
          <Box>
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={busy || targetCount === 0 || countLoading}
              startIcon={starting ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              Generate messages
            </Button>
          </Box>
          {genJob && (
            <Box sx={{ mt: 1.5 }}>
              <LinearProgress
                variant="determinate"
                aria-label="Message generation progress"
                value={genJob.target_count > 0 ? (genJob.processed / genJob.target_count) * 100 : 0}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }} aria-live="polite">
                {genJob.processed.toLocaleString()} / {genJob.target_count.toLocaleString()} processed —{" "}
                {genJob.generated.toLocaleString()} generated, {genJob.already_had_message.toLocaleString()} already had a message
                {genJob.failed > 0 ? `, ${genJob.failed.toLocaleString()} failed` : ""}
                {genJob.done ? " — done." : " — about 1 per second."}
              </Typography>
              {genJob.error && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {genJob.error}
                </Alert>
              )}
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Step 2 — Send SMS
          </Typography>
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={busy || targetCount === 0 || countLoading}
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {sending ? "Sending…" : targetsEveryone ? `Send to ALL ${targetCount.toLocaleString()}` : `Send to ${targetCount.toLocaleString()}`}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {genInProgress
              ? "Wait for message generation to finish before sending."
              : "Customers without a phone number or a generated message are skipped automatically."}
          </Typography>
          {sendResult && (
            <Alert severity={sendResult.failed > 0 ? "warning" : "success"} sx={{ mt: 1 }}>
              {dryRun ? "Simulated" : "Sent"} {sendResult.sent.toLocaleString()} of {sendResult.target_count.toLocaleString()}
              {sendResult.skipped_no_phone > 0 ? `, ${sendResult.skipped_no_phone.toLocaleString()} skipped (no phone)` : ""}
              {sendResult.skipped_no_message > 0 ? `, ${sendResult.skipped_no_message.toLocaleString()} skipped (no message)` : ""}
              {sendResult.failed > 0 ? `, ${sendResult.failed.toLocaleString()} failed` : ""}.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={sending}>
          {genInProgress ? "Close (keeps generating)" : "Close"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
