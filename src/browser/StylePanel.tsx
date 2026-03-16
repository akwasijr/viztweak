import React, { useState, useRef, useCallback, useEffect } from "react";
import type { ElementInfo } from "../shared/types.js";
import { EDITABLE_PROPERTIES, ALL_EDITABLE_PROPERTIES } from "../shared/types.js";
import type { EditableCategory } from "../shared/types.js";
import { resolveElement, getComputedStyleMap } from "./ElementResolver.js";
import { DiffEngine } from "./DiffEngine.js";
import { WSClient } from "./WSClient.js";

interface StylePanelProps {
  element: HTMLElement;
  elementInfo: ElementInfo;
  diffEngine: DiffEngine;
  wsClient: WSClient;
  onClose: () => void;
}

export function StylePanel({
  element,
  elementInfo,
  diffEngine,
  wsClient,
  onClose,
}: StylePanelProps) {
  const [styles, setStyles] = useState<Record<string, string>>(() =>
    getComputedStyleMap(element, ALL_EDITABLE_PROPERTIES)
  );
  const [activeCategory, setActiveCategory] =
    useState<EditableCategory>("spacing");
  const [changeCount, setChangeCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Apply a style change with live preview
  const handleStyleChange = useCallback(
    (property: string, value: string) => {
      const cssName = property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      element.style.setProperty(cssName, value);

      setStyles((prev) => ({ ...prev, [property]: value }));

      // Generate and send diff
      const diff = diffEngine.generateDiff(element);
      if (diff) {
        setChangeCount(diff.changes.length);
        wsClient.send({
          type: "changes_updated",
          payload: { diffs: [diff] },
        });
      }
    },
    [element, diffEngine, wsClient]
  );

  // Send initial selection to MCP server
  useEffect(() => {
    wsClient.send({
      type: "element_selected",
      payload: {
        element: elementInfo,
        computedStyles: styles,
      },
    });
  }, [elementInfo, styles, wsClient]);

  const categories = Object.keys(EDITABLE_PROPERTIES) as EditableCategory[];
  const currentProperties = EDITABLE_PROPERTIES[activeCategory];

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        width: "320px",
        maxHeight: "calc(100vh - 32px)",
        background: "#1a1a2e",
        color: "#e0e0e0",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        fontFamily:
          "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: "13px",
        zIndex: 2147483646,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: "14px" }}>
            &lt;{elementInfo.tagName}&gt;
            {elementInfo.textContent && (
              <span style={{ opacity: 0.5, fontWeight: 400, marginLeft: "6px" }}>
                "{elementInfo.textContent.slice(0, 20)}"
              </span>
            )}
          </div>
          {elementInfo.componentName && (
            <div style={{ fontSize: "11px", color: "#818cf8", marginTop: "2px" }}>
              {elementInfo.componentName}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {changeCount > 0 && (
            <span
              style={{
                background: "#4f46e5",
                color: "#fff",
                borderRadius: "10px",
                padding: "1px 8px",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {changeCount}
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              cursor: "pointer",
              fontSize: "18px",
              padding: "0 4px",
              lineHeight: 1,
            }}
            aria-label="Close panel"
          >
            ×
          </button>
        </div>
      </div>

      {/* Connection status */}
      <div
        style={{
          padding: "6px 16px",
          fontSize: "11px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: wsClient.connected ? "#22c55e" : "#ef4444",
            display: "inline-block",
          }}
        />
        <span style={{ color: "#888" }}>
          {wsClient.connected ? "Connected to agent" : "Agent not connected"}
        </span>
      </div>

      {/* Category tabs */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          padding: "8px 12px",
          overflowX: "auto",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "none",
              fontSize: "12px",
              fontWeight: activeCategory === cat ? 600 : 400,
              background:
                activeCategory === cat
                  ? "rgba(79,70,229,0.2)"
                  : "transparent",
              color: activeCategory === cat ? "#818cf8" : "#888",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 150ms ease",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Properties */}
      <div
        style={{
          padding: "8px 16px 16px",
          overflowY: "auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {currentProperties.map((prop) => (
          <PropertyRow
            key={prop}
            property={prop}
            value={styles[prop] || ""}
            onChange={(val) => handleStyleChange(prop, val)}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "11px", color: "#555" }}>
          {elementInfo.stylingApproach}
        </span>
        <span style={{ fontSize: "10px", color: "#444" }}>viztweak</span>
      </div>
    </div>
  );
}

// ─── Property row input ───

function PropertyRow({
  property,
  value,
  onChange,
}: {
  property: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const isColor =
    property.toLowerCase().includes("color") ||
    property === "backgroundColor";

  const displayName = property
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
      }}
    >
      <label
        style={{
          flex: "0 0 auto",
          fontSize: "12px",
          color: "#999",
          minWidth: "90px",
        }}
      >
        {displayName}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
        {isColor && (
          <input
            type="color"
            value={rgbToHex(value) || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: "24px",
              height: "24px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              padding: 0,
              background: "none",
            }}
          />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            padding: "4px 8px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px",
            color: "#e0e0e0",
            fontSize: "12px",
            fontFamily: "'DM Mono', monospace",
            outline: "none",
            minWidth: 0,
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor =
              "rgba(79,70,229,0.5)";
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.borderColor =
              "rgba(255,255,255,0.1)";
          }}
        />
      </div>
    </div>
  );
}

/**
 * Converts rgb(r,g,b) to #hex for color inputs.
 */
function rgbToHex(rgb: string): string | null {
  const match = rgb.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
  );
  if (!match) return null;
  const [, r, g, b] = match;
  return (
    "#" +
    [r, g, b]
      .map((c) =>
        parseInt(c, 10).toString(16).padStart(2, "0")
      )
      .join("")
  );
}
