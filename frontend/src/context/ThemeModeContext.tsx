import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ThemeProvider, createTheme, type PaletteMode } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

interface ThemeModeContextValue {
  mode: PaletteMode;
  toggleMode: () => void;
}

// v2: the app now defaults to light; a fresh key keeps old "dark" values from sticking.
const THEME_KEY = "theme_mode_v2";

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

// Strong ease-out for UI feedback (fast start = feels responsive).
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

function buildTheme(mode: PaletteMode) {
  const light = mode === "light";
  // Brand presence: indigo top bar, indigo-tinted sidebar, white cards on a pale page.
  const sidebar = light ? "#eceffd" : "#171b2b";
  return createTheme({
    palette: {
      mode,
      // Light, airy defaults; brand indigo kept but brightened. Text on primary
      // buttons stays >= 4.5:1.
      primary: light
        ? { main: "#4f5fe0", light: "#eef0fd", dark: "#3a48c4", contrastText: "#ffffff" }
        : { main: "#8b93ff", light: "#262b4a", dark: "#6e78f0", contrastText: "#0f1220" },
      secondary: { main: "#13a08a" },
      // very light brand tint behind white cards
      background: light ? { default: "#f1f3fc", paper: "#ffffff" } : { default: "#131623", paper: "#1a1e2e" },
      text: light
        ? { primary: "#1d2433", secondary: "#5d6677", disabled: "#a0a7b4" }
        : { primary: "#eceef4", secondary: "#a9b0bf", disabled: "#6c7384" },
      divider: light ? "#e7e9f0" : "#2a2f42",
      action: light ? { hover: "rgba(79,95,224,0.06)", selected: "rgba(79,95,224,0.10)" } : {},
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"Roboto", system-ui, -apple-system, "Segoe UI", sans-serif',
      h5: { fontWeight: 650, letterSpacing: "-0.01em" },
      h4: { fontWeight: 650, letterSpacing: "-0.01em" },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { WebkitFontSmoothing: "antialiased" } },
      },
      // Indigo top bar with white text (light mode); flat, no shadow.
      MuiAppBar: {
        defaultProps: { elevation: 0, color: "inherit" },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: light ? theme.palette.primary.main : "#171b2b",
            color: light ? "#ffffff" : theme.palette.text.primary,
            borderBottom: light ? "none" : `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: sidebar,
            borderRight: `1px solid ${light ? "#dadff6" : theme.palette.divider}`,
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderColor: theme.palette.divider,
            boxShadow: light ? "0 1px 2px rgba(16,24,40,0.04)" : "none",
          }),
        },
      },
      // Press feedback: a subtle scale tells the user the click registered.
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            transition: `transform 160ms ${EASE_OUT}, background-color 150ms ease, border-color 150ms ease`,
            "&:active": { transform: "scale(0.97)" },
            "@media (prefers-reduced-motion: reduce)": { "&:active": { transform: "none" } },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 8,
            margin: "2px 8px",
            // active nav item: solid brand pill
            "&.Mui-selected, &.Mui-selected:hover": {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              "& .MuiListItemIcon-root": { color: theme.palette.primary.contrastText },
            },
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: ({ theme }) => ({ fontWeight: 600, color: theme.palette.text.secondary }),
        },
      },
      MuiTooltip: {
        styleOverrides: { tooltip: { fontSize: 12 } },
      },
    },
  });
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(
    () => (localStorage.getItem(THEME_KEY) as PaletteMode | null) ?? "light"
  );

  function toggleMode() {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used within a ThemeModeProvider");
  return ctx;
}
