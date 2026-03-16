import React, { useState, useEffect, useMemo } from "react";
import { SectionHeader } from "./FigmaInputs.js";

// ─── Types ────────────────────────────────────────────────────

interface CSSVar {
  name: string;
  value: string;
  resolvedValue: string;
  source: "element" | "inherited";
}

interface CSSVarInspectorProps {
  element: HTMLElement | null;
}

// ─── Helpers ──────────────────────────────────────────────────

function extractCSSVars(el: HTMLElement): CSSVar[] {
  const vars: Map<string, CSSVar> = new Map();
  const cs = window.getComputedStyle(el);

  // Walk up the DOM to find all custom properties
  let current: HTMLElement | null = el;
  let isFirst = true;

  while (current) {
    // Check inline styles
    for (let i = 0; i < current.style.length; i++) {
      const prop = current.style[i];
      if (prop.startsWith("--")) {
        if (!vars.has(prop)) {
          vars.set(prop, {
            name: prop,
            value: current.style.getPropertyValue(prop).trim(),
            resolvedValue: cs.getPropertyValue(prop).trim(),
            source: isFirst ? "element" : "inherited",
          });
        }
      }
    }

    // Check stylesheets for matching rules
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule) {
              if (current.matches(rule.selectorText)) {
                for (let i = 0; i < rule.style.length; i++) {
                  const prop = rule.style[i];
                  if (prop.startsWith("--") && !vars.has(prop)) {
                    vars.set(prop, {
                      name: prop,
                      value: rule.style.getPropertyValue(prop).trim(),
                      resolvedValue: cs.getPropertyValue(prop).trim(),
                      source: isFirst ? "element" : "inherited",
                    });
                  }
                }
              }
            }
          }
        } catch {
          // cross-origin stylesheet, skip
        }
      }
    } catch {
      // stylesheet access error, skip
    }

    isFirst = false;
    current = current.parentElement;
  }

  return Array.from(vars.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function isColorValue(value: string): boolean {
  return /^(#[0-9a-f]{3,8}|rgb|hsl|oklch|color\()/i.test(value);
}

// ─── Component ────────────────────────────────────────────────

export function CSSVarInspector({ element }: CSSVarInspectorProps) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState("");

  const vars = useMemo(() => {
    if (!element) return [];
    return extractCSSVars(element);
  }, [element]);

  const filtered = useMemo(() => {
    if (!filter) return vars;
    const q = filter.toLowerCase();
    return vars.filter(
      (v) => v.name.toLowerCase().includes(q) || v.value.toLowerCase().includes(q),
    );
  }, [vars, filter]);

  if (!element || vars.length === 0) return null;

  return (
    <div>
      <SectionHeader
        title={`CSS Variables (${vars.length})`}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
      {expanded && (
        <div style={{ padding: "4px 12px 8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {/* Filter */}
          {vars.length > 5 && (
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter variables..."
              style={{
                height: "22px",
                fontSize: "10px",
                fontFamily: "var(--vt-font)",
                color: "var(--vt-text-primary)",
                background: "var(--vt-input-bg)",
                border: "1px solid var(--vt-input-border)",
                borderRadius: "var(--vt-input-radius)",
                outline: "none",
                padding: "0 6px",
              }}
            />
          )}

          {/* Variable list */}
          <div style={{ maxHeight: "200px", overflowY: "auto" }}>
            {filtered.map((v) => (
              <div
                key={v.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 0",
                  borderBottom: "1px solid var(--vt-hover)",
                  fontSize: "10px",
                  lineHeight: "14px",
                }}
              >
                {/* Color swatch if applicable */}
                {isColorValue(v.resolvedValue) && (
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "2px",
                      border: "1px solid var(--vt-border)",
                      background: v.resolvedValue,
                      flexShrink: 0,
                    }}
                  />
                )}

                <span
                  style={{
                    color: "var(--vt-accent)",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                  }}
                  title={v.name}
                >
                  {v.name}
                </span>

                <span
                  style={{
                    color: "var(--vt-text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "80px",
                    flexShrink: 0,
                    textAlign: "right",
                  }}
                  title={v.resolvedValue || v.value}
                >
                  {v.resolvedValue || v.value}
                </span>

                {v.source === "inherited" && (
                  <span
                    style={{
                      fontSize: "8px",
                      color: "var(--vt-text-disabled)",
                      flexShrink: 0,
                    }}
                  >
                    ↑
                  </span>
                )}
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <span style={{ fontSize: "10px", color: "var(--vt-text-disabled)" }}>
              No matching variables
            </span>
          )}
        </div>
      )}
    </div>
  );
}
