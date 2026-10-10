import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import MenuIcon from "@mui/icons-material/Menu";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../../context/AuthContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { getSmsGatewaySettings } from "../../api/smsGateway";
import { SMS_SETTINGS_CHANGED } from "../../utils/events";

const DRAWER_WIDTH_EXPANDED = 240;
const DRAWER_WIDTH_COLLAPSED = 72;

/** Always-visible reminder of whether "Send SMS" reaches real phones. */
function SmsModeChip() {
  // undefined = still loading (render nothing); null = couldn't check (warn)
  const [dryRun, setDryRun] = useState<boolean | null | undefined>(undefined);
  const { pathname } = useLocation();

  const refresh = useCallback(() => {
    getSmsGatewaySettings()
      .then((s) => setDryRun(s.dry_run))
      .catch(() => setDryRun(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    window.addEventListener(SMS_SETTINGS_CHANGED, refresh);
    return () => window.removeEventListener(SMS_SETTINGS_CHANGED, refresh);
  }, [refresh]);

  if (dryRun === undefined) return null;
  const tooltip =
    dryRun === null
      ? "Couldn't check the SMS mode — treat sends as real"
      : dryRun
        ? "SMS sends are simulated — nothing reaches a phone"
        : "Real SMS are being sent and charged";
  return (
    <Tooltip title={tooltip}>
      <Chip
        component={RouterLink}
        to="/settings/sms-gateway"
        clickable
        size="small"
        icon={dryRun ? <ScienceOutlinedIcon /> : <WarningAmberIcon />}
        label={
          <>
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              SMS:{" "}
            </Box>
            {dryRun === null ? "unknown" : dryRun ? "Dry-run" : "LIVE"}
          </>
        }
        sx={{
          mr: 1.5,
          fontWeight: 600,
          color: dryRun ? "inherit" : "#5a3a00",
          bgcolor: dryRun ? "rgba(255,255,255,0.16)" : "#fab219",
          "& .MuiChip-icon": { color: "inherit" },
          "&:hover": { bgcolor: dryRun ? "rgba(255,255,255,0.24)" : "#f3a600" },
        }}
      />
    </Tooltip>
  );
}

export function AppLayout() {
  const { logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true"
  );

  function toggleMenu() {
    if (isMobile) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  }

  const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED;

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            onClick={toggleMenu}
            sx={{ mr: 2 }}
            edge="start"
            aria-label={isMobile ? "Open navigation" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={isMobile ? mobileOpen : !collapsed}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="span" noWrap sx={{ flexGrow: 1, fontWeight: 600, minWidth: 0 }}>
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              {isMobile ? "Churn Prediction" : "AI Churn Prediction System"}
            </Box>
          </Typography>
          <SmsModeChip />
          <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton color="inherit" onClick={toggleMode} sx={{ mr: 1 }} aria-label="Toggle colour theme">
              {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Button color="inherit" onClick={logout}>
            Log out
          </Button>
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { width: DRAWER_WIDTH_EXPANDED, boxSizing: "border-box" } }}
        >
          <Toolbar />
          <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            whiteSpace: "nowrap",
            [`& .MuiDrawer-paper`]: {
              width: drawerWidth,
              boxSizing: "border-box",
              overflowX: "hidden",
              transition: (t) =>
                t.transitions.create("width", {
                  easing: t.transitions.easing.sharp,
                  duration: t.transitions.duration.enteringScreen,
                }),
            },
          }}
        >
          <Toolbar />
          <Sidebar collapsed={collapsed} />
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, minWidth: 0 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
