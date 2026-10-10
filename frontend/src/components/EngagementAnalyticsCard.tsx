import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import SmsIcon from "@mui/icons-material/Sms";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { EngagementAnalytics } from "../types";

function MiniStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: "50%",
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
          color,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

export function EngagementAnalyticsCard({ data }: { data: EngagementAnalytics }) {
  const { sms_stats, retention_stats, recent_sms } = data;
  // Only real sends reach the provider; dry-runs are simulated and always "succeed".
  const submissionRate =
    sms_stats.real_count > 0
      ? `${((sms_stats.real_successful / sms_stats.real_count) * 100).toFixed(0)}%`
      : "—";

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          SMS &amp; Retention Analytics
        </Typography>

        <Grid container spacing={3} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MiniStat
              icon={<SmsIcon />}
              label="SMS attempts"
              value={sms_stats.total_sent}
              color="#7c6cf6"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MiniStat
              icon={<CheckCircleIcon />}
              label={sms_stats.real_count > 0 ? "Submission success (real sends)" : "Submission success (dry-run only)"}
              value={submissionRate}
              color="#2e7d32"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <MiniStat
              icon={<AutoAwesomeIcon />}
              label="AI retention messages"
              value={`${retention_stats.gemini_generated} / ${retention_stats.total_generated}`}
              color="#22c1c3"
            />
          </Grid>
        </Grid>

        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
          <Chip size="small" label={`${sms_stats.real_count} real sends`} />
          <Chip size="small" variant="outlined" label={`${sms_stats.dry_run_count} dry-run`} />
          <Chip
            size="small"
            variant="outlined"
            label={`${retention_stats.fallback_generated} fallback messages`}
          />
        </Box>

        <Typography variant="subtitle2" gutterBottom>
          Recent SMS activity
        </Typography>
        {recent_sms.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No SMS sent yet.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell align="right">When</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recent_sms.map((entry, i) => (
                <TableRow key={i}>
                  <TableCell>#{entry.customer_id}</TableCell>
                  <TableCell>{entry.phone_number}</TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>
                    {entry.message ? (
                      <Tooltip title={entry.message}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entry.message}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={entry.dry_run ? "simulated" : entry.success ? "submitted" : "failed"}
                      color={entry.dry_run ? "default" : entry.success ? "success" : "error"}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={entry.dry_run ? "dry-run" : "real"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {new Date(entry.sent_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
