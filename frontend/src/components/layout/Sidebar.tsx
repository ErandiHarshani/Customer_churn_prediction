import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import InsightsIcon from "@mui/icons-material/Insights";
import SettingsIcon from "@mui/icons-material/Settings";
import { Link as RouterLink, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: <DashboardIcon /> },
  { label: "Predict Customer", path: "/customers/new", icon: <InsightsIcon /> },
  { label: "Customers", path: "/customers", icon: <PeopleIcon /> },
  { label: "SMS & AI Settings", path: "/settings/sms-gateway", icon: <SettingsIcon /> },
];

/** Prefix match so detail pages keep their section highlighted
 *  (/customers/123 → Customers), while /customers/new stays Predict Customer. */
function isActive(path: string, pathname: string): boolean {
  if (path === "/") return pathname === "/";
  if (path === "/customers") return pathname.startsWith("/customers") && pathname !== "/customers/new";
  return pathname.startsWith(path);
}

export function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { pathname } = useLocation();

  return (
    <List component="nav" aria-label="Main navigation" sx={{ pt: 1.5 }}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path, pathname);
        const button = (
          <ListItemButton
            key={item.path}
            component={RouterLink}
            to={item.path}
            selected={active}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            sx={{
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 2 : 2.5,
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: "center" }}>
              {item.icon}
            </ListItemIcon>
            {!collapsed && <ListItemText primary={item.label} />}
          </ListItemButton>
        );

        return collapsed ? (
          <Tooltip key={item.path} title={item.label} placement="right">
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </List>
  );
}
