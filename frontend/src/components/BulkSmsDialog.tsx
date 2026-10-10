import { useEffect, useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
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
import type { BulkGenerateJobStatus, BulkSendSmsResponse, BulkTarget, RiskLevel } from "../types";

const POLL_INTERVAL_MS = 1500;

interface BulkSmsDialogProps {
  open: boolean;
  onClose: () => void;
  selectedIds: number[];
  onDone: () => void;
}

export function BulkSmsDialog({ open, onClose, selectedIds, onDone }: BulkSmsDialogProps) {
  const [mode, setMode] = useState<"selected" | "filter">(
    selectedIds.length > 0 ? "selected" : "filter"
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "">("");
  const [categoryCount, setCategoryCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [starting, setStarting] = useState(false);
  const [genJob, setGenJob] = useState<BulkGenerateJobStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<BulkSendSmsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    getCustomerFieldOptions().then((opts) => {
      setCategories(opts.prefered_order_cat);
    });
  }, [open]);

  useEffect(() => {
    if (mode !== "filter") {
      setCategoryCount(null);
      return;
    }
    setCountLoading(true);
    getCustomers({
      page: 1,
      page_size: 1,
      prefered_order_cat: category || undefined,
      risk_level: riskLevel || undefined,
    })
      .then((res) => setCategoryCount(res.total))
      .finally(() => setCountLoading(false));
  }, [mode, category, riskLevel]);

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
        };

  const targetCount = mode === "selected" ? selectedIds.length : categoryCount ?? 0;
  const genInProgress = !!genJob && !genJob.done;

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function handleClose() {
    stopPolling();
    setGenJob(null);
    setSendResult(null);
    setError(null);
    onClose();
  }

  async function handleGenerate() {
    setStarting(true);
    setError(null);
    setGenJob(null);
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
          if (status.done) stopPolling();
        } catch {
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not start message generation.");
    } finally {
      setStarting(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const result = await bulkSendSms(target);
      setSendResult(result);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not send SMS.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Bulk SMS</DialogTitle>
      <DialogContent>
        <FormControl sx={{ mb: 2 }}>
          <RadioGroup
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as "selected" | "filter");
              setGenJob(null);
              setSendResult(null);
              setError(null);
            }}
          >
            <FormControlLabel
              value="selected"
              control={<Radio />}
              disabled={selectedIds.length === 0}
              label={`Selected customers (${selectedIds.length})`}
            />
            <FormControlLabel
              value="filter"
              control={<Radio />}
              label="By order category / risk level"
            />
          </RadioGroup>
        </FormControl>

        {mode === "filter" && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="bulk-sms-category-label">Order category</InputLabel>
                <Select
                  labelId="bulk-sms-category-label"
                  label="Order category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setGenJob(null);
                    setSendResult(null);
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

              <FormControl size="small" fullWidth>
                <InputLabel id="bulk-sms-risk-label">Risk level</InputLabel>
                <Select
                  labelId="bulk-sms-risk-label"
                  label="Risk level"
                  value={riskLevel}
                  onChange={(e) => {
                    setRiskLevel(e.target.value as RiskLevel | "");
                    setGenJob(null);
                    setSendResult(null);
                  }}
                >
                  <MenuItem value="">Any risk level</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {countLoading
                ? "Counting matching customers…"
                : categoryCount !== null
                ? `${categoryCount} customer(s) match`
                : ""}
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
            control={
              <Checkbox
                checked={forceRegenerate}
                onChange={(e) => setForceRegenerate(e.target.checked)}
              />
            }
            label="Regenerate messages for customers who already have one"
          />
          <Box>
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={starting || genInProgress || targetCount === 0}
              startIcon={starting ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              Generate messages
            </Button>
          </Box>
          {genJob && (
            <Box sx={{ mt: 1.5 }}>
              <LinearProgress
                variant="determinate"
                value={genJob.target_count > 0 ? (genJob.processed / genJob.target_count) * 100 : 0}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {genJob.processed} / {genJob.target_count} processed — {genJob.generated} generated,{" "}
                {genJob.already_had_message} already had a message
                {genJob.failed > 0 ? `, ${genJob.failed} failed` : ""}
                {genJob.done ? " — done." : " — this runs in the background, feel free to wait."}
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
            color="secondary"
            onClick={handleSend}
            disabled={sending || targetCount === 0}
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Send SMS
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Customers without a phone number on file or without a generated message are
            skipped automatically.
          </Typography>
          {sendResult && (
            <Alert severity={sendResult.failed > 0 ? "warning" : "success"} sx={{ mt: 1 }}>
              Sent {sendResult.sent} of {sendResult.target_count}
              {sendResult.skipped_no_phone > 0
                ? `, ${sendResult.skipped_no_phone} skipped (no phone)`
                : ""}
              {sendResult.skipped_no_message > 0
                ? `, ${sendResult.skipped_no_message} skipped (no message)`
                : ""}
              {sendResult.failed > 0 ? `, ${sendResult.failed} failed` : ""}.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
