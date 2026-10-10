import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { generateRetentionMessage } from "../api/retention";
import type { RetentionMessage } from "../types";

interface RetentionMessagePanelProps {
  customerId: number;
  message: RetentionMessage | null;
  onGenerated: (message: RetentionMessage) => void;
}

export function RetentionMessagePanel({
  customerId,
  message,
  onGenerated,
}: RetentionMessagePanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateRetentionMessage(customerId, !!message);
      onGenerated(result);
    } catch (e) {
      setError("Could not generate a retention message. Please try again.");
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
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>
              "{message.sms_text}"
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Chip label={`${message.discount_percent}% discount`} size="small" color="primary" />
              <Chip
                label={message.source === "gemini" ? "AI-generated" : "Fallback message"}
                size="small"
                variant="outlined"
              />
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No retention message generated yet for this customer.
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={loading}
          sx={{ mt: 2 }}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {message ? "Regenerate message" : "Generate retention message"}
        </Button>
      </CardContent>
    </Card>
  );
}
