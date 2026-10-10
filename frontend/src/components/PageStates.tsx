import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";

/** Card-shaped placeholders shown while a page loads (no layout jump when data arrives). */
export function PageSkeleton({ cards = 4, tall = 2 }: { cards?: number; tall?: number }) {
  return (
    <Box aria-busy="true" aria-label="Loading">
      <Skeleton variant="text" width={240} height={40} />
      <Skeleton variant="text" width={360} sx={{ mb: 3 }} />
      <Grid container spacing={2}>
        {Array.from({ length: cards }).map((_, i) => (
          <Grid key={`s${i}`} size={{ xs: 12, sm: 6, md: 12 / Math.min(cards, 4) }}>
            <Skeleton variant="rounded" height={120} />
          </Grid>
        ))}
        {Array.from({ length: tall }).map((_, i) => (
          <Grid key={`t${i}`} size={{ xs: 12, md: 12 / Math.max(tall, 1) }}>
            <Skeleton variant="rounded" height={280} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box sx={{ textAlign: "center", py: 6, px: 2, color: "text.secondary" }}>
      {icon && <Box sx={{ mb: 1.5, "& svg": { fontSize: 44, color: "primary.main", opacity: 0.7 } }}>{icon}</Box>}
      <Typography variant="subtitle1" color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ mt: 0.5, maxWidth: 420, mx: "auto" }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}

/** A failed load with a way out: the message, plus Retry. */
export function ErrorState({ message, onRetry, title = "Something went wrong" }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <EmptyState
          icon={<ErrorOutlineIcon sx={{ color: "error.main !important" }} />}
          title={title}
          description={message}
          action={
            onRetry && (
              <Button variant="contained" startIcon={<RefreshIcon />} onClick={onRetry}>
                Try again
              </Button>
            )
          }
        />
      </CardContent>
    </Card>
  );
}
