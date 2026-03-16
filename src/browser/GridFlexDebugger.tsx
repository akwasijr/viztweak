import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────

interface OverlayBox {
  rect: DOMRect;
  type: "flex" | "grid";
  direction?: string;
  gap?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  alignItems?: string;
  justifyContent?: string;
  childRects: DOMRect[];
}

// ─── Scan ─────────────────────────────────────────────────────

function scanLayoutContainers(): OverlayBox[] {
  const results: OverlayBox[] = [];
  const allEls = document.querySelectorAll("body *");
  const limit = Math.min(allEls.length, 1500);

  for (let i = 0; i < limit; i++) {
    const el = allEls[i] as HTMLElement;
    if (el.closest("[data-viztweak]")) continue;

    const cs = getComputedStyle(el);
    const display = cs.display;

    if (display === "flex" || display === "inline-flex") {
      const childRects: DOMRect[] = [];
      for (let c = 0; c < el.children.length; c++) {
        childRects.push((el.children[c] as HTMLElement).getBoundingClientRect());
      }
      results.push({
        rect: el.getBoundingClientRect(),
        type: "flex",
        direction: cs.flexDirection,
        gap: cs.gap,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        childRects,
      });
    } else if (display === "grid" || display === "inline-grid") {
      const childRects: DOMRect[] = [];
      for (let c = 0; c < el.children.length; c++) {
        childRects.push((el.children[c] as HTMLElement).getBoundingClientRect());
      }
      results.push({
        rect: el.getBoundingClientRect(),
        type: "grid",
        gap: cs.gap,
        gridTemplateColumns: cs.gridTemplateColumns,
        gridTemplateRows: cs.gridTemplateRows,
        childRects,
      });
    }
  }

  return results;
}

// ─── Colors ───────────────────────────────────────────────────

const FLEX_COLOR = "rgba(168, 85, 247, 0.35)";
const FLEX_BORDER = "rgba(168, 85, 247, 0.7)";
const GRID_COLOR = "rgba(20, 184, 166, 0.35)";
const GRID_BORDER = "rgba(20, 184, 166, 0.7)";
const CHILD_BORDER = "rgba(255, 255, 255, 0.6)";
const GAP_COLOR = "rgba(251, 191, 36, 0.25)";

// ─── Component ────────────────────────────────────────────────

export function GridFlexDebugger({ active }: { active: boolean }) {
  const [boxes, setBoxes] = useState<OverlayBox[]>([]);
  const rafRef = useRef<number>(0);

  const update = useCallback(() => {
    if (!active) return;
    setBoxes(scanLayoutContainers());
    rafRef.current = requestAnimationFrame(() => {
      setTimeout(() => {
        rafRef.current = requestAnimationFrame(update);
      }, 500);
    });
  }, [active]);

  useEffect(() => {
    if (active) {
      update();
    } else {
      setBoxes([]);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, update]);

  if (!active || boxes.length === 0) return null;

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  return (
    <div
      data-viztweak=""
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2147483640,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {boxes.map((box, idx) => {
          const isFlex = box.type === "flex";
          const fillColor = isFlex ? FLEX_COLOR : GRID_COLOR;
          const strokeColor = isFlex ? FLEX_BORDER : GRID_BORDER;
          const x = box.rect.left;
          const y = box.rect.top;
          const w = box.rect.width;
          const h = box.rect.height;

          return (
            <g key={idx}>
              {/* Container outline */}
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeDasharray={isFlex ? "6,3" : "none"}
                rx={2}
              />

              {/* Label */}
              <rect x={x} y={y - 16} width={isFlex ? 38 : 34} height={15} fill={strokeColor} rx={2} />
              <text x={x + 4} y={y - 4} fill="#fff" fontSize="9" fontWeight="600" fontFamily="Inter, system-ui, sans-serif">
                {isFlex ? `flex${box.direction === "column" ? "↓" : "→"}` : "grid"}
              </text>

              {/* Children outlines */}
              {box.childRects.map((cr, ci) => (
                <rect
                  key={ci}
                  x={cr.left}
                  y={cr.top}
                  width={cr.width}
                  height={cr.height}
                  fill="none"
                  stroke={CHILD_BORDER}
                  strokeWidth={1}
                  strokeDasharray="3,2"
                  rx={1}
                />
              ))}

              {/* Gap visualization (approximate) */}
              {box.gap && box.gap !== "normal" && box.gap !== "0px" && box.childRects.length > 1 && (
                <>
                  {box.childRects.slice(0, -1).map((cr, ci) => {
                    const next = box.childRects[ci + 1];
                    if (!next) return null;

                    // Detect gap between consecutive children
                    const isHorizontal = box.type === "flex" ? box.direction !== "column" : true;
                    if (isHorizontal) {
                      const gapLeft = cr.right;
                      const gapWidth = next.left - cr.right;
                      if (gapWidth > 1) {
                        return (
                          <rect
                            key={`gap-${ci}`}
                            x={gapLeft}
                            y={Math.min(cr.top, next.top)}
                            width={gapWidth}
                            height={Math.max(cr.height, next.height)}
                            fill={GAP_COLOR}
                            rx={1}
                          />
                        );
                      }
                    } else {
                      const gapTop = cr.bottom;
                      const gapHeight = next.top - cr.bottom;
                      if (gapHeight > 1) {
                        return (
                          <rect
                            key={`gap-${ci}`}
                            x={Math.min(cr.left, next.left)}
                            y={gapTop}
                            width={Math.max(cr.width, next.width)}
                            height={gapHeight}
                            fill={GAP_COLOR}
                            rx={1}
                          />
                        );
                      }
                    }
                    return null;
                  })}
                </>
              )}

              {/* Axis direction arrow for flex */}
              {isFlex && w > 40 && h > 40 && (
                <>
                  {box.direction === "column" ? (
                    <line
                      x1={x + w / 2}
                      y1={y + 4}
                      x2={x + w / 2}
                      y2={y + h - 4}
                      stroke={strokeColor}
                      strokeWidth={1}
                      markerEnd="url(#vt-arrow)"
                      opacity={0.6}
                    />
                  ) : (
                    <line
                      x1={x + 4}
                      y1={y + h / 2}
                      x2={x + w - 4}
                      y2={y + h / 2}
                      stroke={strokeColor}
                      strokeWidth={1}
                      markerEnd="url(#vt-arrow)"
                      opacity={0.6}
                    />
                  )}
                </>
              )}
            </g>
          );
        })}

        {/* Arrow marker definition */}
        <defs>
          <marker id="vt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={FLEX_BORDER} opacity={0.6} />
          </marker>
        </defs>
      </svg>

      {/* Legend */}
      <div
        style={{
          position: "fixed",
          bottom: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "12px",
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          padding: "6px 14px",
          borderRadius: "6px",
          fontSize: "10px",
          fontFamily: "Inter, system-ui, sans-serif",
          alignItems: "center",
          backdropFilter: "blur(8px)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: FLEX_BORDER }} />
          Flexbox ({boxes.filter((b) => b.type === "flex").length})
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: GRID_BORDER }} />
          Grid ({boxes.filter((b) => b.type === "grid").length})
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(251, 191, 36, 0.6)" }} />
          Gaps
        </span>
      </div>
    </div>
  );
}
