import React, { useCallback, useEffect, useRef, useState } from "react";

interface InspectorProps {
  active: boolean;
  onSelect: (element: HTMLElement) => void;
  ignoreRefs: React.RefObject<HTMLElement | null>[];
}

const BLUE = "#0C8CE9";
const RED = "#FF4081";
const Z = 2147483645;

interface SpacingGuides {
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
}

function getSpacingGuides(el: HTMLElement): SpacingGuides {
  const cs = window.getComputedStyle(el);
  return {
    marginTop: parseFloat(cs.marginTop) || 0,
    marginRight: parseFloat(cs.marginRight) || 0,
    marginBottom: parseFloat(cs.marginBottom) || 0,
    marginLeft: parseFloat(cs.marginLeft) || 0,
    paddingTop: parseFloat(cs.paddingTop) || 0,
    paddingRight: parseFloat(cs.paddingRight) || 0,
    paddingBottom: parseFloat(cs.paddingBottom) || 0,
    paddingLeft: parseFloat(cs.paddingLeft) || 0,
  };
}

function getComponentName(el: HTMLElement): string | undefined {
  const fiberKey = Object.keys(el).find(
    (k) =>
      k.startsWith("__reactFiber$") ||
      k.startsWith("__reactInternalInstance$"),
  );
  if (!fiberKey) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fiber = (el as any)[fiberKey];
    for (let i = 0; i < 15 && fiber; i++) {
      if (fiber.type && typeof fiber.type === "function") {
        const name = fiber.type.displayName || fiber.type.name;
        if (name && name !== "Fragment" && !name.startsWith("_")) return name;
      }
      if (fiber.type?.render?.displayName || fiber.type?.render?.name) {
        const name = fiber.type.render.displayName || fiber.type.render.name;
        if (name && name !== "Fragment") return name;
      }
      fiber = fiber.return;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

// Shared label style for spacing dimension pills
const spacingLabelBase: React.CSSProperties = {
  position: "absolute",
  background: RED,
  color: "#fff",
  fontSize: "9px",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  fontWeight: 500,
  padding: "1px 3px",
  borderRadius: "2px",
  pointerEvents: "none",
  whiteSpace: "nowrap",
  lineHeight: "12px",
};

export function Inspector({ active, onSelect, ignoreRefs }: InspectorProps) {
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [hoveredTag, setHoveredTag] = useState("");
  const [compName, setCompName] = useState<string | undefined>();
  const [spacing, setSpacing] = useState<SpacingGuides | null>(null);
  const hoveredEl = useRef<HTMLElement | null>(null);

  const isIgnored = useCallback(
    (target: HTMLElement) =>
      ignoreRefs.some((ref) => ref.current?.contains(target)),
    [ignoreRefs],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!active) return;
      const target = e.target as HTMLElement;
      if (isIgnored(target)) {
        setHoveredRect(null);
        return;
      }
      hoveredEl.current = target;
      setHoveredRect(target.getBoundingClientRect());
      setHoveredTag(target.tagName.toLowerCase());
      setCompName(getComponentName(target));
      setSpacing(getSpacingGuides(target));
    },
    [active, isIgnored],
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!active) return;
      const target = e.target as HTMLElement;
      if (isIgnored(target)) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect(target);
    },
    [active, isIgnored, onSelect],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && active) {
        setHoveredRect(null);
        hoveredEl.current = null;
      }
    },
    [active],
  );

  useEffect(() => {
    if (!active) {
      setHoveredRect(null);
      return;
    }
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [active, handleMouseMove, handleClick, handleKeyDown]);

  if (!active || !hoveredRect) return null;

  const w = Math.round(hoveredRect.width);
  const h = Math.round(hoveredRect.height);

  return (
    <>
      {/* Selection outline — NO fill tint, Figma-style */}
      <div
        style={{
          position: "fixed",
          top: hoveredRect.top,
          left: hoveredRect.left,
          width: hoveredRect.width,
          height: hoveredRect.height,
          background: "transparent",
          border: "2px solid " + BLUE,
          borderRadius: 0,
          pointerEvents: "none",
          zIndex: Z,
          transition: "all 60ms ease-out",
        }}
      />

      {/* Tag label — top-left blue pill */}
      <div
        style={{
          position: "fixed",
          top: Math.max(0, hoveredRect.top - 22),
          left: hoveredRect.left,
          background: BLUE,
          color: "#fff",
          fontSize: "10px",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          fontWeight: 500,
          padding: "2px 6px",
          borderRadius: "3px",
          pointerEvents: "none",
          zIndex: Z,
          whiteSpace: "nowrap",
          lineHeight: "14px",
        }}
      >
        {hoveredTag}
        {compName && (
          <span style={{ opacity: 0.8, marginLeft: "4px" }}>{compName}</span>
        )}
      </div>

      {/* Dimension label — bottom-right white pill */}
      <div
        style={{
          position: "fixed",
          top: hoveredRect.bottom + 4,
          left: hoveredRect.right - 2,
          transform: "translateX(-100%)",
          background: "#FFFFFF",
          color: BLUE,
          fontSize: "10px",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          fontWeight: 500,
          padding: "2px 5px",
          borderRadius: "3px",
          pointerEvents: "none",
          zIndex: Z,
          whiteSpace: "nowrap",
          lineHeight: "14px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      >
        {w + "\u00D7" + h}
      </div>

      {/* Spacing guides — padding (inner red lines) */}
      {spacing && (
        <>
          {/* Padding top */}
          {spacing.paddingTop > 0 && (
            <>
              <div
                style={{
                  position: "fixed",
                  top: hoveredRect.top,
                  left: hoveredRect.left,
                  width: hoveredRect.width,
                  height: spacing.paddingTop,
                  background: "rgba(255, 64, 129, 0.08)",
                  borderBottom: "1px dashed " + RED,
                  pointerEvents: "none",
                  zIndex: Z,
                }}
              />
              <div
                style={{
                  ...spacingLabelBase,
                  top: hoveredRect.top + spacing.paddingTop / 2 - 7,
                  left: hoveredRect.left + hoveredRect.width / 2 - 10,
                  zIndex: Z,
                }}
              >
                {Math.round(spacing.paddingTop)}
              </div>
            </>
          )}
          {/* Padding bottom */}
          {spacing.paddingBottom > 0 && (
            <>
              <div
                style={{
                  position: "fixed",
                  top: hoveredRect.bottom - spacing.paddingBottom,
                  left: hoveredRect.left,
                  width: hoveredRect.width,
                  height: spacing.paddingBottom,
                  background: "rgba(255, 64, 129, 0.08)",
                  borderTop: "1px dashed " + RED,
                  pointerEvents: "none",
                  zIndex: Z,
                }}
              />
              <div
                style={{
                  ...spacingLabelBase,
                  top:
                    hoveredRect.bottom -
                    spacing.paddingBottom / 2 -
                    7,
                  left: hoveredRect.left + hoveredRect.width / 2 - 10,
                  zIndex: Z,
                }}
              >
                {Math.round(spacing.paddingBottom)}
              </div>
            </>
          )}
          {/* Padding left */}
          {spacing.paddingLeft > 0 && (
            <>
              <div
                style={{
                  position: "fixed",
                  top: hoveredRect.top,
                  left: hoveredRect.left,
                  width: spacing.paddingLeft,
                  height: hoveredRect.height,
                  background: "rgba(255, 64, 129, 0.08)",
                  borderRight: "1px dashed " + RED,
                  pointerEvents: "none",
                  zIndex: Z,
                }}
              />
              <div
                style={{
                  ...spacingLabelBase,
                  top: hoveredRect.top + hoveredRect.height / 2 - 7,
                  left: hoveredRect.left + spacing.paddingLeft / 2 - 6,
                  zIndex: Z,
                }}
              >
                {Math.round(spacing.paddingLeft)}
              </div>
            </>
          )}
          {/* Padding right */}
          {spacing.paddingRight > 0 && (
            <>
              <div
                style={{
                  position: "fixed",
                  top: hoveredRect.top,
                  left: hoveredRect.right - spacing.paddingRight,
                  width: spacing.paddingRight,
                  height: hoveredRect.height,
                  background: "rgba(255, 64, 129, 0.08)",
                  borderLeft: "1px dashed " + RED,
                  pointerEvents: "none",
                  zIndex: Z,
                }}
              />
              <div
                style={{
                  ...spacingLabelBase,
                  top: hoveredRect.top + hoveredRect.height / 2 - 7,
                  left:
                    hoveredRect.right -
                    spacing.paddingRight / 2 -
                    6,
                  zIndex: Z,
                }}
              >
                {Math.round(spacing.paddingRight)}
              </div>
            </>
          )}

          {/* Margin top */}
          {spacing.marginTop > 0 && (
            <>
              <div
                style={{
                  position: "fixed",
                  top: hoveredRect.top - spacing.marginTop,
                  left: hoveredRect.left + hoveredRect.width / 2,
                  width: "1px",
                  height: spacing.marginTop,
                  background: RED,
                  pointerEvents: "none",
                  zIndex: Z,
                }}
              />
              <div
                style={{
                  ...spacingLabelBase,
                  top:
                    hoveredRect.top -
                    spacing.marginTop / 2 -
                    7,
                  left: hoveredRect.left + hoveredRect.width / 2 + 4,
                  zIndex: Z,
                }}
              >
                {Math.round(spacing.marginTop)}
              </div>
            </>
          )}
          {/* Margin bottom */}
          {spacing.marginBottom > 0 && (
            <>
              <div
                style={{
                  position: "fixed",
                  top: hoveredRect.bottom,
                  left: hoveredRect.left + hoveredRect.width / 2,
                  width: "1px",
                  height: spacing.marginBottom,
                  background: RED,
                  pointerEvents: "none",
                  zIndex: Z,
                }}
              />
              <div
                style={{
                  ...spacingLabelBase,
                  top: hoveredRect.bottom + spacing.marginBottom / 2 - 7,
                  left: hoveredRect.left + hoveredRect.width / 2 + 4,
                  zIndex: Z,
                }}
              >
                {Math.round(spacing.marginBottom)}
              </div>
            </>
          )}
          {/* Margin left */}
          {spacing.marginLeft > 0 && (
            <>
              <div
                style={{
                  position: "fixed",
                  top: hoveredRect.top + hoveredRect.height / 2,
                  left: hoveredRect.left - spacing.marginLeft,
                  width: spacing.marginLeft,
                  height: "1px",
                  background: RED,
                  pointerEvents: "none",
                  zIndex: Z,
                }}
              />
              <div
                style={{
                  ...spacingLabelBase,
                  top: hoveredRect.top + hoveredRect.height / 2 + 4,
                  left:
                    hoveredRect.left -
                    spacing.marginLeft / 2 -
                    6,
                  zIndex: Z,
                }}
              >
                {Math.round(spacing.marginLeft)}
              </div>
            </>
          )}
          {/* Margin right */}
          {spacing.marginRight > 0 && (
            <>
              <div
                style={{
                  position: "fixed",
                  top: hoveredRect.top + hoveredRect.height / 2,
                  left: hoveredRect.right,
                  width: spacing.marginRight,
                  height: "1px",
                  background: RED,
                  pointerEvents: "none",
                  zIndex: Z,
                }}
              />
              <div
                style={{
                  ...spacingLabelBase,
                  top: hoveredRect.top + hoveredRect.height / 2 + 4,
                  left: hoveredRect.right + spacing.marginRight / 2 - 6,
                  zIndex: Z,
                }}
              >
                {Math.round(spacing.marginRight)}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
