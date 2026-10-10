import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { keyframes } from "@mui/system";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { generateRetentionMessage } from "../api/retention";
import { useConfirm } from "./feedback/confirmContext";
import { useToast } from "./feedback/toastContext";
import { apiErrorMessage } from "../utils/apiError";
import type { RetentionMessage } from "../types";

// A regenerated message cross-fades in (state change made legible, 200ms, ease-out).
const messageIn = keyframes`
  from { opacity: 0; filter: blur(2px); }
  to   { opacity: 1; filter: blur(0); }
`;

interface RetentionMessagePanelProps {
  customerId: number;
  message: RetentionMessage | null;
  onGenerated: (message: RetentionMessage) => void;
}

export function RetentionMessagePanel({ customerId, message, onGenerated }: RetentionMessagePanelProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (message) {
      const ok = await confirm({
        title: "Regenerate this message?",
        body: "The current message is replaced by a new one written by Gemini.",
        confirmText: "Regenerate",
      });
      if (!ok) return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await generateRetentionMessage(customerId, !!message);
      onGenerated(result);
      toast.success(result.source === "gemini" ? "Retention message ready." : "Gemini unavailable — used the standard message.");
    } catch (e) {
      setError(apiErrorMessage(e, "Could not generate a retention message. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Retention message
        </Typography>

        {message ? (
          <Box
            key={message.id}
            sx={{
              animation: `${messageIn} 200ms cubic-bezier(0.23, 1, 0.32, 1)`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          >
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: "primary.light",
                borderLeft: (t) => `3px solid ${t.palette.primary.main}`,
                mb: 1.5,
              }}
            >
              <Typography variant="body1">“{message.sms_text}”</Typography>
              <Typography variant="caption" color="text.secondary">
                {message.sms_text.length}/160 characters
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Chip label={`${message.discount_percent}% discount`} size="small" color="primary" />
              <Chip
                icon={message.source === "gemini" ? <AutoAwesomeIcon /> : undefined}
                label={message.source === "gemini" ? "AI-generated" : "Standard message"}
                size="small"
                variant="outlined"
              />
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No retention message yet. Generate one to personalise an SMS offer for this customer.
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          variant={message ? "outlined" : "contained"}
          onClick={handleGenerate}
          disabled={loading}
          sx={{ mt: 2 }}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
        >
          {loading ? "Writing message…" : message ? "Regenerate message" : "Generate retention message"}
        </Button>
      </CardContent>
    </Card>
  );
}
