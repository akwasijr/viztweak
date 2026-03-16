import React, { useState, useCallback, useEffect } from "react";

// ─── Inline device icons (thin stroke, 12px) ─────────────────

function DeviceMobile() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="1" width="8" height="14" rx="1.5" />
      <line x1="7" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function DeviceTablet() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="1" width="11" height="14" rx="1.5" />
      <line x1="7" y1="12.5" x2="9" y2="12.5" />
    </svg>
  );
}

function DeviceLaptop() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="9" rx="1" />
      <line x1="1" y1="13" x2="15" y2="13" />
    </svg>
  );
}

function DeviceDesktop() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1.5" width="14" height="10" rx="1" />
      <line x1="6" y1="11.5" x2="6" y2="14" />
      <line x1="10" y1="11.5" x2="10" y2="14" />
      <line x1="4" y1="14" x2="12" y2="14" />
    </svg>
  );
}

function DeviceFullscreen() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,6 2,2 6,2" />
      <polyline points="10,2 14,2 14,6" />
      <polyline points="14,10 14,14 10,14" />
      <polyline points="6,14 2,14 2,10" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────

interface Breakpoint {
  label: string;
  width: number;
  icon: React.ReactNode;
}

interface ResponsivePreviewProps {
  active: boolean;
  onToggle: () => void;
}

const BREAKPOINTS: Breakpoint[] = [
  { label: "Mobile", width: 320, icon: <DeviceMobile /> },
  { label: "Mobile L", width: 425, icon: <DeviceMobile /> },
  { label: "Tablet", width: 768, icon: <DeviceTablet /> },
  { label: "Laptop", width: 1024, icon: <DeviceLaptop /> },
  { label: "Desktop", width: 1440, icon: <DeviceDesktop /> },
  { label: "Full", width: 0, icon: <DeviceFullscreen /> },
];

// Injects a wrapper that constrains the viewport width
const WRAPPER_ID = "viztweak-responsive-wrapper";
const WRAPPER_STYLE_ID = "viztweak-responsive-style";

function applyViewportWidth(width: number) {
  let wrapper = document.getElementById(WRAPPER_ID);
  let style = document.getElementById(WRAPPER_STYLE_ID);

  if (width === 0) {
    // Full width — remove constraints
    if (wrapper) {
      // Unwrap: move children back to body
      while (wrapper.firstChild) {
        wrapper.parentNode?.insertBefore(wrapper.firstChild, wrapper);
      }
      wrapper.remove();
    }
    style?.remove();
    document.documentElement.style.removeProperty("overflow-x");
    return;
  }

  if (!style) {
    style = document.createElement("style");
    style.id = WRAPPER_STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = `
    #${WRAPPER_ID} {
      max-width: ${width}px !important;
      margin: 0 auto !important;
      overflow-x: hidden !important;
      position: relative !important;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06) !important;
      min-height: 100vh !important;
      background: inherit !important;
    }
  `;
  document.documentElement.style.overflow = "auto";

  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.id = WRAPPER_ID;

    // Wrap all body children except viztweak elements and scripts
    const children = Array.from(document.body.children).filter(
      (c) =>
        !c.hasAttribute("data-viztweak") &&
        c.tagName !== "SCRIPT" &&
        c.id !== WRAPPER_ID &&
        c.id !== WRAPPER_STYLE_ID
    );

    document.body.appendChild(wrapper);
    for (const child of children) {
      wrapper.appendChild(child);
    }
  }
}

// ─── Component ────────────────────────────────────────────────

export function ResponsivePreview({ active, onToggle }: ResponsivePreviewProps) {
  const [currentWidth, setCurrentWidth] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  const selectBreakpoint = useCallback((width: number) => {
    setCurrentWidth(width);
    applyViewportWidth(width);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      applyViewportWidth(0);
    };
  }, []);

  // Clean up when deactivated
  useEffect(() => {
    if (!active && currentWidth !== 0) {
      setCurrentWidth(0);
      applyViewportWidth(0);
    }
  }, [active, currentWidth]);

  if (!active) return null;

  return (
    <div
      data-viztweak=""
      style={{
        position: "fixed",
        top: "8px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2147483645,
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "4px 6px",
        background: "var(--vt-surface, #FFFFFF)",
        border: "1px solid var(--vt-border, #E4E4E4)",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {BREAKPOINTS.map((bp, i) => {
        const isActive = currentWidth === bp.width;
        const isHov = hovered === i;
        return (
          <button
            key={bp.width}
            onClick={() => selectBreakpoint(bp.width)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            title={`${bp.label}${bp.width ? ` (${bp.width}px)` : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              height: "24px",
              padding: "0 8px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "10px",
              fontFamily: "inherit",
              fontWeight: isActive ? 600 : 400,
              background: isActive
                ? "var(--vt-accent-bg, #E8F4FD)"
                : isHov
                  ? "var(--vt-hover, #EBEBEB)"
                  : "transparent",
              color: isActive
                ? "var(--vt-accent, #0C8CE9)"
                : "var(--vt-text-secondary, #8C8C8C)",
              transition: "all 100ms ease",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", lineHeight: 1 }}>{bp.icon}</span>
            {bp.width ? `${bp.width}` : "Full"}
          </button>
        );
      })}

      {/* Close button */}
      <div style={{ width: "1px", height: "16px", background: "var(--vt-border, #E4E4E4)", margin: "0 2px" }} />
      <button
        onClick={() => {
          selectBreakpoint(0);
          onToggle();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "20px",
          height: "20px",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          background: "transparent",
          color: "var(--vt-text-secondary, #8C8C8C)",
          fontSize: "12px",
          padding: 0,
        }}
        title="Exit responsive preview"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="3" x2="13" y2="13" />
          <line x1="13" y1="3" x2="3" y2="13" />
        </svg>
      </button>
    </div>
  );
}
