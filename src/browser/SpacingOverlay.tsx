import React, { useEffect, useState, useCallback } from "react";

interface SpacingOverlayProps {
  element: HTMLElement | null;
  visible: boolean;
}

export function SpacingOverlay({ element, visible }: SpacingOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [padding, setPadding] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [margin, setMargin] = useState({ top: 0, right: 0, bottom: 0, left: 0 });

  const measure = useCallback(() => {
    if (!element || !visible) return;
    const r = element.getBoundingClientRect();
    const cs = window.getComputedStyle(element);
    setRect(r);
    setPadding({
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    });
    setMargin({
      top: parseFloat(cs.marginTop) || 0,
      right: parseFloat(cs.marginRight) || 0,
      bottom: parseFloat(cs.marginBottom) || 0,
      left: parseFloat(cs.marginLeft) || 0,
    });
  }, [element, visible]);

  useEffect(() => {
    measure();
    if (!visible) return;
    const id = setInterval(measure, 300);
    return () => clearInterval(id);
  }, [measure, visible]);

  if (!visible || !element || !rect) return null;

  const MARGIN_COLOR = "rgba(246, 178, 107, 0.35)";
  const PADDING_COLOR = "rgba(147, 196, 125, 0.40)";
  const CONTENT_COLOR = "rgba(147, 196, 243, 0.25)";
  const LABEL_BG = "rgba(0,0,0,0.65)";
  const LABEL_COLOR = "#fff";

  // Margin box
  const mTop = rect.top - margin.top;
  const mLeft = rect.left - margin.left;
  const mWidth = rect.width + margin.left + margin.right;
  const mHeight = rect.height + margin.top + margin.bottom;

  const labelStyle: React.CSSProperties = {
    position: "absolute",
    fontSize: "9px",
    fontFamily: "Inter, system-ui, sans-serif",
    fontWeight: 600,
    color: LABEL_COLOR,
    background: LABEL_BG,
    padding: "1px 3px",
    borderRadius: "2px",
    lineHeight: "12px",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    zIndex: 10,
  };

  return (
    <div
      data-viztweak=""
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 2147483644,
      }}
    >
      {/* Margin overlay (orange) - top */}
      {margin.top > 2 && (
        <div
          style={{
            position: "absolute",
            top: mTop,
            left: rect.left,
            width: rect.width,
            height: margin.top,
            background: MARGIN_COLOR,
          }}
        >
          <span style={{ ...labelStyle, left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
            {Math.round(margin.top)}
          </span>
        </div>
      )}
      {/* Margin - bottom */}
      {margin.bottom > 2 && (
        <div
          style={{
            position: "absolute",
            top: rect.bottom,
            left: rect.left,
            width: rect.width,
            height: margin.bottom,
            background: MARGIN_COLOR,
          }}
        >
          <span style={{ ...labelStyle, left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
            {Math.round(margin.bottom)}
          </span>
        </div>
      )}
      {/* Margin - left */}
      {margin.left > 2 && (
        <div
          style={{
            position: "absolute",
            top: mTop,
            left: mLeft,
            width: margin.left,
            height: mHeight,
            background: MARGIN_COLOR,
          }}
        >
          <span style={{ ...labelStyle, left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
            {Math.round(margin.left)}
          </span>
        </div>
      )}
      {/* Margin - right */}
      {margin.right > 2 && (
        <div
          style={{
            position: "absolute",
            top: mTop,
            left: rect.right,
            width: margin.right,
            height: mHeight,
            background: MARGIN_COLOR,
          }}
        >
          <span style={{ ...labelStyle, left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
            {Math.round(margin.right)}
          </span>
        </div>
      )}

      {/* Padding overlay (green) - top */}
      {padding.top > 2 && (
        <div
          style={{
            position: "absolute",
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: padding.top,
            background: PADDING_COLOR,
          }}
        >
          <span style={{ ...labelStyle, left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
            {Math.round(padding.top)}
          </span>
        </div>
      )}
      {/* Padding - bottom */}
      {padding.bottom > 2 && (
        <div
          style={{
            position: "absolute",
            top: rect.bottom - padding.bottom,
            left: rect.left,
            width: rect.width,
            height: padding.bottom,
            background: PADDING_COLOR,
          }}
        >
          <span style={{ ...labelStyle, left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
            {Math.round(padding.bottom)}
          </span>
        </div>
      )}
      {/* Padding - left */}
      {padding.left > 2 && (
        <div
          style={{
            position: "absolute",
            top: rect.top + padding.top,
            left: rect.left,
            width: padding.left,
            height: rect.height - padding.top - padding.bottom,
            background: PADDING_COLOR,
          }}
        >
          <span style={{ ...labelStyle, left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
            {Math.round(padding.left)}
          </span>
        </div>
      )}
      {/* Padding - right */}
      {padding.right > 2 && (
        <div
          style={{
            position: "absolute",
            top: rect.top + padding.top,
            left: rect.right - padding.right,
            width: padding.right,
            height: rect.height - padding.top - padding.bottom,
            background: PADDING_COLOR,
          }}
        >
          <span style={{ ...labelStyle, left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
            {Math.round(padding.right)}
          </span>
        </div>
      )}

      {/* Content area (blue tint) */}
      <div
        style={{
          position: "absolute",
          top: rect.top + padding.top,
          left: rect.left + padding.left,
          width: rect.width - padding.left - padding.right,
          height: rect.height - padding.top - padding.bottom,
          background: CONTENT_COLOR,
        }}
      />
    </div>
  );
}
