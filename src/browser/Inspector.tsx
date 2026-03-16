import React, { useCallback, useEffect, useRef, useState } from "react";

interface InspectorProps {
  active: boolean;
  onSelect: (element: HTMLElement) => void;
  /** Elements that should not be selectable (e.g., the panel itself) */
  ignoreRefs: React.RefObject<HTMLElement | null>[];
}

/**
 * Overlay inspector that highlights elements on hover and selects on click.
 */
export function Inspector({ active, onSelect, ignoreRefs }: InspectorProps) {
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [hoveredTag, setHoveredTag] = useState("");
  const hoveredEl = useRef<HTMLElement | null>(null);

  const isIgnored = useCallback(
    (target: HTMLElement) => {
      return ignoreRefs.some(
        (ref) => ref.current?.contains(target)
      );
    },
    [ignoreRefs]
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
    },
    [active, isIgnored]
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
    [active, isIgnored, onSelect]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && active) {
        setHoveredRect(null);
        hoveredEl.current = null;
      }
    },
    [active]
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

  return (
    <>
      {/* Highlight overlay */}
      <div
        style={{
          position: "fixed",
          top: hoveredRect.top,
          left: hoveredRect.left,
          width: hoveredRect.width,
          height: hoveredRect.height,
          background: "rgba(79, 70, 229, 0.12)",
          border: "2px solid rgba(79, 70, 229, 0.6)",
          borderRadius: "2px",
          pointerEvents: "none",
          zIndex: 2147483645,
          transition: "all 80ms ease-out",
        }}
      />

      {/* Tag label */}
      <div
        style={{
          position: "fixed",
          top: Math.max(0, hoveredRect.top - 24),
          left: hoveredRect.left,
          background: "#4f46e5",
          color: "#fff",
          fontSize: "11px",
          fontFamily: "'DM Mono', monospace",
          padding: "2px 8px",
          borderRadius: "4px",
          pointerEvents: "none",
          zIndex: 2147483645,
          fontWeight: 500,
        }}
      >
        {hoveredTag}
        {hoveredRect.width > 0 && (
          <span style={{ opacity: 0.7, marginLeft: "6px" }}>
            {Math.round(hoveredRect.width)}×{Math.round(hoveredRect.height)}
          </span>
        )}
      </div>
    </>
  );
}
