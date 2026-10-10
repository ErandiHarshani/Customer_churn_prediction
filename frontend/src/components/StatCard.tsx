import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  subtitle?: string;
  valueColor?: string;
}

/** Indigo-tinted icon disc shared by stat tiles. */
export function IconDisc({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        bgcolor: "primary.light",
        color: "primary.main",
        "& svg": { fontSize: 22 },
      }}
    >
      {children}
    </Box>
  );
}

export function StatCard({ title, value, icon, subtitle, valueColor }: StatCardProps) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 0.5 }}>
            {title}
          </Typography>
          {icon && <IconDisc>{icon}</IconDisc>}
        </Box>
        <Typography variant="h4" component="p" sx={{ mt: 0.5, color: valueColor }}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
