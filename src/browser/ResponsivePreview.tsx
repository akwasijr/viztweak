import React, { useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────

interface Breakpoint {
  label: string;
  width: number;
  icon: string;
}

interface ResponsivePreviewProps {
  active: boolean;
  onToggle: () => void;
}

const BREAKPOINTS: Breakpoint[] = [
  { label: "Mobile", width: 320, icon: "📱" },
  { label: "Mobile L", width: 425, icon: "📱" },
  { label: "Tablet", width: 768, icon: "📋" },
  { label: "Laptop", width: 1024, icon: "💻" },
  { label: "Desktop", width: 1440, icon: "🖥" },
  { label: "Full", width: 0, icon: "⛶" },
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
            <span style={{ fontSize: "12px", lineHeight: 1 }}>{bp.icon}</span>
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
        ✕
      </button>
    </div>
  );
}
