import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import { Link as RouterLink } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

export interface Crumb {
  label: string;
  /** react-router `to` (string path, may include a query) — omit for the current page */
  to?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  /** browser-tab title when `title` is not plain text */
  documentTitle?: string;
  subtitle?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}

/** Consistent page heading: breadcrumbs, h1, subtitle, actions that wrap on small screens. */
export function PageHeader({ title, documentTitle, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  usePageTitle(documentTitle ?? (typeof title === "string" ? title : ""));

  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1, fontSize: 14 }}>
          {breadcrumbs.map((c) =>
            c.to ? (
              <Link key={c.label} component={RouterLink} to={c.to} underline="hover" color="primary">
                {c.label}
              </Link>
            ) : (
              <Typography key={c.label} color="text.secondary" sx={{ fontSize: 14 }} aria-current="page">
                {c.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      )}
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" component="h1">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>{actions}</Box>}
      </Box>
    </Box>
  );
}
