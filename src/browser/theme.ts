// Figma UI3 design tokens as CSS custom properties

export const THEME_ATTR = "data-viztweak";

const THEME_STYLE_ID = "viztweak-theme";

export const themeCSS = /* css */ `
[${THEME_ATTR}] {
  /* ── Surface colors (dark) ── */
  --vt-panel-bg: #1E1E1E;
  --vt-surface: #252525;
  --vt-border: #383838;
  --vt-hover: #2E2E2E;

  /* ── Text colors ── */
  --vt-text-primary: #E8E8E8;
  --vt-text-secondary: #8C8C8C;
  --vt-text-disabled: #5C5C5C;

  /* ── Accent / semantic ── */
  --vt-accent: #0C8CE9;
  --vt-accent-bg: rgba(12, 140, 233, 0.15);
  --vt-error: #F24822;
  --vt-success: #14AE5C;
  --vt-warning: #FFC700;

  /* ── Input ── */
  --vt-input-bg: #2C2C2C;
  --vt-input-border: #3A3A3A;
  --vt-input-border-focus: #0C8CE9;

  /* ── Typography ── */
  --vt-font: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --vt-font-size-label: 11px;
  --vt-font-size-value: 11px;
  --vt-font-size-section: 11px;
  --vt-line-height: 16px;
  --vt-font-weight-normal: 400;
  --vt-font-weight-medium: 500;
  --vt-font-weight-semibold: 600;

  /* ── Sizing ── */
  --vt-input-height: 28px;
  --vt-input-radius: 6px;
  --vt-panel-width: 312px;
  --vt-panel-radius: 10px;
  --vt-panel-margin: 12px;
  --vt-section-padding: 8px 12px;
  --vt-row-gap: 4px;
  --vt-icon-size: 16px;
  --vt-icon-size-sm: 12px;
  --vt-section-header-height: 32px;
  --vt-tab-height: 32px;
  --vt-toolbar-height: 32px;

  /* ── Shadows ── */
  --vt-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.2);
  --vt-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.25);
  --vt-shadow-panel: 0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15);

  /* ── Transitions ── */
  --vt-transition-fast: 120ms ease;
  --vt-transition-normal: 200ms ease;

  /* ── Base styles applied to the root ── */
  font-family: var(--vt-font);
  font-size: var(--vt-font-size-value);
  line-height: var(--vt-line-height);
  color: var(--vt-text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

[${THEME_ATTR}] *, [${THEME_ATTR}] *::before, [${THEME_ATTR}] *::after {
  box-sizing: border-box;
}
`;

/**
 * Injects the VizTweak Figma UI3 theme CSS into the document head.
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
