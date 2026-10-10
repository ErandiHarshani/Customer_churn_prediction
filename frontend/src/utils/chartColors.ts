import type { Theme } from "@mui/material/styles";

/**
 * Chart tokens (dataviz reference palette). Series slots are assigned in fixed
 * order and validated for colour-vision deficiency in both modes
 * (scripts/validate_palette.js: blue↔orange ΔE 24.7 light / 26.8 dark).
 * Status colours are reserved for risk state and always ship with a text label.
 */
export function chartColors(theme: Theme) {
  const dark = theme.palette.mode === "dark";
  return {
    series: dark ? ["#3987e5", "#d95926"] : ["#2a78d6", "#eb6834"],
    status: { high: "#d03b3b", medium: "#fab219", low: "#0ca30c" },
    track: dark ? "#2c2c2a" : "#e1e0d9",
    grid: dark ? "#2c2c2a" : "#e1e0d9",
    axis: dark ? "#383835" : "#c3c2b7",
    muted: "#898781",
    textSecondary: theme.palette.text.secondary,
  };
}
