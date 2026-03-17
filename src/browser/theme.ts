// Figma UI3 design tokens as CSS custom properties — dark & light modes

export const THEME_ATTR = "data-viztweak";
export const THEME_MODE_ATTR = "data-vt-mode";
export type ThemeMode = "dark" | "light";

const THEME_STYLE_ID = "viztweak-theme";
const THEME_STORAGE_KEY = "viztweak-theme-mode";

export const themeCSS = /* css */ `
/* ─── Shared tokens (both modes) ─── */
[${THEME_ATTR}] {
  /* Typography */
  --vt-font: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --vt-font-size-label: 11px;
  --vt-font-size-value: 11px;
  --vt-font-size-section: 11px;
  --vt-line-height: 16px;
  --vt-font-weight-normal: 400;
  --vt-font-weight-medium: 500;
  --vt-font-weight-semibold: 600;

  /* Sizing */
  --vt-input-height: 28px;
  --vt-input-radius: 6px;
  --vt-panel-width: 312px;
  --vt-panel-radius: 10px;
  --vt-panel-margin: 12px;
  --vt-section-padding: 10px 12px;
  --vt-section-gap: 8px;
  --vt-row-gap: 4px;
  --vt-icon-size: 16px;
  --vt-icon-size-sm: 12px;
  --vt-section-header-height: 32px;
  --vt-tab-height: 32px;
  --vt-toolbar-height: 32px;

  /* Accent / semantic (shared) */
  --vt-accent: #0C8CE9;
  --vt-accent-bg: rgba(12, 140, 233, 0.15);
  --vt-error: #F24822;
  --vt-success: #14AE5C;
  --vt-warning: #FFC700;
  --vt-input-border-focus: #0C8CE9;

  /* Transitions */
  --vt-transition-fast: 120ms ease;
  --vt-transition-normal: 200ms ease;

  /* Base styles */
  font-family: var(--vt-font);
  font-size: var(--vt-font-size-value);
  line-height: var(--vt-line-height);
  color: var(--vt-text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ─── Dark mode (default) ─── */
[${THEME_ATTR}],
[${THEME_ATTR}][${THEME_MODE_ATTR}="dark"] {
  --vt-panel-bg: #1E1E1E;
  --vt-surface: #252525;
  --vt-border: rgba(255, 255, 255, 0.06);
  --vt-hover: #2E2E2E;
  --vt-text-primary: #E8E8E8;
  --vt-text-secondary: #8C8C8C;
  --vt-text-disabled: #5C5C5C;
  --vt-input-bg: #2A2A2A;
  --vt-input-border: transparent;
  --vt-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.2);
  --vt-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.25);
  --vt-shadow-panel: 0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* ─── Light mode ─── */
[${THEME_ATTR}][${THEME_MODE_ATTR}="light"] {
  --vt-panel-bg: #FFFFFF;
  --vt-surface: #F5F5F5;
  --vt-border: rgba(0, 0, 0, 0.06);
  --vt-hover: #EBEBEB;
  --vt-text-primary: #1E1E1E;
  --vt-text-secondary: #6B6B6B;
  --vt-text-disabled: #A0A0A0;
  --vt-input-bg: #F0F0F0;
  --vt-input-border: transparent;
  --vt-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
  --vt-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --vt-shadow-panel: 0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.04);
}

[${THEME_ATTR}] *, [${THEME_ATTR}] *::before, [${THEME_ATTR}] *::after {
  box-sizing: border-box;
}

/* ─── Isolation: prevent inherited styles from page/body leaking in ─── */
/* Portal is a direct child of <html>, sibling of <body> — fully isolated */
#viztweak-portal,
#viztweak-portal * {
  font-family: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif !important;
  font-weight: 400 !important;
  line-height: 16px !important;
  letter-spacing: normal !important;
  text-transform: none !important;
  text-indent: 0 !important;
  word-spacing: normal !important;
  direction: ltr !important;
  text-decoration: none !important;
}
#viztweak-portal {
  font-size: 11px !important;
  font-weight: 400 !important;
  font-style: normal !important;
  color: inherit !important;
  visibility: visible !important;
  opacity: 1 !important;
  filter: none !important;
  -webkit-filter: none !important;
  transform: none !important;
  cursor: default !important;
  text-align: left !important;
  white-space: normal !important;
}
`;

/** Get stored theme preference, default to dark */
export function getStoredTheme(): ThemeMode {
  if (typeof localStorage === "undefined") return "dark";
  return (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) || "dark";
}

/** Store theme preference */
export function setStoredTheme(mode: ThemeMode): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, mode);
}

/**
 * Injects the VizTweak theme CSS into the document head.
 * Safe to call multiple times — only injects once.
 */
export function injectTheme(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(THEME_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = THEME_STYLE_ID;
  style.textContent = themeCSS;
  document.head.appendChild(style);
}
