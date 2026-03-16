import React, { useState, useCallback } from "react";
import { IconState } from "./icons.js";

// ─── Types ────────────────────────────────────────────────────

type PseudoState = "default" | "hover" | "focus" | "active" | "disabled";

interface StateSelectorProps {
  value: PseudoState;
  onChange: (state: PseudoState) => void;
  element: HTMLElement | null;
}

const STATES: { value: PseudoState; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "hover", label: "Hover" },
  { value: "focus", label: "Focus" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

// Track what classes we've force-applied so we can clean up
const FORCE_CLASSES: Record<PseudoState, string> = {
  default: "",
  hover: "vt-force-hover",
  focus: "vt-force-focus",
  active: "vt-force-active",
  disabled: "vt-force-disabled",
};

// CSS that simulates pseudo-states via classes
const stateSimulationCSS = `
.vt-force-hover { }
.vt-force-focus { outline: 2px solid var(--vt-accent, #0C8CE9) !important; outline-offset: 2px; }
.vt-force-active { filter: brightness(0.95); }
.vt-force-disabled { opacity: 0.5 !important; pointer-events: none !important; cursor: not-allowed !important; }
`;

let stateStyleInjected = false;

function injectStateStyles() {
  if (stateStyleInjected) return;
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.id = "viztweak-state-simulation";
  style.textContent = stateSimulationCSS;
  document.head.appendChild(style);
  stateStyleInjected = true;
}

// ─── Component ────────────────────────────────────────────────

export function StateSelector({ value, onChange, element }: StateSelectorProps) {
  const [hovered, setHovered] = useState<PseudoState | null>(null);

  const applyState = useCallback(
    (state: PseudoState) => {
      if (!element) return;
      injectStateStyles();

      // Remove all force classes
      for (const cls of Object.values(FORCE_CLASSES)) {
        if (cls) element.classList.remove(cls);
      }

      // Apply hover-specific: trigger CSS :hover rules by copying computed hover styles
      if (state === "hover") {
        element.classList.add(FORCE_CLASSES.hover);
        // Dispatch a mouseenter event to trigger CSS hover
        element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      } else if (state === "focus") {
        element.classList.add(FORCE_CLASSES.focus);
        element.focus();
      } else if (state === "active") {
        element.classList.add(FORCE_CLASSES.active);
      } else if (state === "disabled") {
        element.classList.add(FORCE_CLASSES.disabled);
      }
      // "default" = just remove all forced states

      onChange(state);
    },
    [element, onChange],
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "0 8px",
        height: "28px",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          color: "var(--vt-text-secondary)",
          marginRight: "4px",
          flexShrink: 0,
        }}
      >
        <IconState size={12} />
      </span>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1px",
          background: "var(--vt-hover)",
          borderRadius: "var(--vt-input-radius)",
          overflow: "hidden",
          flex: 1,
        }}
      >
        {STATES.map((s) => {
          const isActive = s.value === value;
          const isHov = hovered === s.value;
          return (
            <button
              key={s.value}
              onClick={() => applyState(s.value)}
              onMouseEnter={() => setHovered(s.value)}
              onMouseLeave={() => setHovered(null)}
              style={{
                flex: 1,
                height: "20px",
                border: "none",
                cursor: "pointer",
                padding: "0 2px",
                fontSize: "9px",
                fontFamily: "var(--vt-font)",
                fontWeight: isActive ? 600 : 400,
                background: isActive
                  ? "var(--vt-surface)"
                  : isHov
                    ? "var(--vt-border)"
                    : "transparent",
                color: isActive
                  ? "var(--vt-accent)"
                  : "var(--vt-text-secondary)",
                borderRadius: isActive ? "3px" : "0",
                transition: "all 100ms ease",
                whiteSpace: "nowrap",
                boxShadow: isActive ? "var(--vt-shadow-sm)" : "none",
              }}
              title={`View ${s.label} state`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { PseudoState };
