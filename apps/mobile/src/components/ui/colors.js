// EastPark brand palette — derived from eastpark.jpg logo
// Token authority: DESIGN.md and src/global.css
//
// Backward-compat aliases kept for existing template UI components
// (Button, Input, Checkbox, etc.) — these will be rebuilt in Phase 2+
module.exports = {
  // ─── Gold (primary brand) ────────────────────────────────
  gold: {
    400: "#c4a07a",
    500: "#b8966a", // PRIMARY — use sparingly
    600: "#9e7d52",
    700: "#7a5e38", // Use for text on light backgrounds (WCAG AA)
    800: "#5c4628",
  },
  // ─── Dark surfaces (flagship dark mode) ─────────────────
  dark: {
    bg: "#0d0c0b",
    card: "#221f1c",
    elevated: "#2e2a26",
    border: "#3d3830",
    text: "#faf8f5",
    muted: "#a89880",
  },
  // ─── Light surfaces ───────────────────────────────────────
  light: {
    bg: "#faf8f5",
    card: "#ffffff",
    border: "#e4ceae",
    text: "#1a1714",
    muted: "#7a6e62",
  },
  // ─── Semantic ─────────────────────────────────────────────
  success: "#5A7A52",
  warning: "#C48B2F",
  error: "#B03A2E",
  info: "#4A6B8A",

  // ─── Backward-compat aliases for template UI components ───
  // These match the obytes color API used by Button, Checkbox, etc.
  white: "#faf8f5", // warm white (not pure #fff)
  black: "#0d0c0b", // warm black (not pure #000)
  primary: {
    50: "#f7f0e8",
    100: "#f0e1d1",
    200: "#dbc3a3",
    300: "#c4a07a", // gold-400
    400: "#b8966a", // gold-500 (PRIMARY)
    500: "#9e7d52", // gold-600
    600: "#7a5e38", // gold-700
    700: "#5c4628", // gold-800
    800: "#42331e",
    900: "#2a2012",
  },
  charcoal: {
    50: "#faf8f5",
    100: "#f0ece6",
    200: "#e4ddd4",
    300: "#c8bead",
    400: "#a89880", // dark-muted
    500: "#7a6e62", // light-muted
    600: "#5c5248",
    700: "#3d3830", // dark-border
    800: "#2e2a26", // dark-elevated
    850: "#221f1c", // dark-card
    900: "#0d0c0b", // dark-bg
    950: "#080706",
  },
  neutral: {
    50: "#faf8f5",
    100: "#f0ece6",
    200: "#e4ddd4",
    300: "#d4c9bc",
    400: "#b5a593",
    500: "#a89880", // dark-muted
    600: "#7a6e62", // light-muted
    700: "#5c5248",
    800: "#3d3830", // dark-border
    900: "#221f1c", // dark-card
  },
};
