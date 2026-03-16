import React, { useState, useMemo } from "react";
import { SectionHeader } from "./FigmaInputs.js";

// ─── Helpers ──────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function parseColor(raw: string): string | null {
  if (raw.startsWith("#")) return raw;
  const m = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return rgbToHex(+m[1], +m[2], +m[3]);
  return null;
}

function roundTo(val: number, decimals = 1): number {
  return Math.round(val * 10 ** decimals) / 10 ** decimals;
}

interface DesignToken {
  category: string;
  property: string;
  value: string;
  cssVar?: string;
}

function extractTokens(el: HTMLElement): DesignToken[] {
  const cs = getComputedStyle(el);
  const tokens: DesignToken[] = [];

  // Colors
  const colorProps = [
    ["color", "text-color"],
    ["backgroundColor", "bg-color"],
    ["borderColor", "border-color"],
  ] as const;
  for (const [prop, name] of colorProps) {
    const val = cs.getPropertyValue(prop === "color" ? "color" : prop === "backgroundColor" ? "background-color" : "border-color");
    if (val && val !== "rgba(0, 0, 0, 0)" && val !== "transparent") {
      const hex = parseColor(val);
      tokens.push({ category: "Color", property: name, value: hex || val });
    }
  }

  // Typography
  tokens.push({ category: "Typography", property: "font-family", value: cs.fontFamily.split(",")[0].replace(/['"]/g, "").trim() });
  tokens.push({ category: "Typography", property: "font-size", value: cs.fontSize });
  tokens.push({ category: "Typography", property: "font-weight", value: cs.fontWeight });
  if (cs.lineHeight !== "normal") {
    tokens.push({ category: "Typography", property: "line-height", value: cs.lineHeight });
  }
  if (cs.letterSpacing !== "normal" && cs.letterSpacing !== "0px") {
    tokens.push({ category: "Typography", property: "letter-spacing", value: cs.letterSpacing });
  }

  // Spacing
  const spacingProps = ["padding", "margin"] as const;
  for (const base of spacingProps) {
    for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
      const val = cs.getPropertyValue(`${base}-${side.toLowerCase()}`);
      if (val && val !== "0px") {
        tokens.push({ category: "Spacing", property: `${base}-${side.toLowerCase()}`, value: val });
      }
    }
  }
  if (cs.gap && cs.gap !== "normal" && cs.gap !== "0px") {
    tokens.push({ category: "Spacing", property: "gap", value: cs.gap });
  }

  // Border & Radius
  const br = cs.borderRadius;
  if (br && br !== "0px") {
    tokens.push({ category: "Border", property: "border-radius", value: br });
  }
  const bw = cs.borderWidth;
  if (bw && bw !== "0px") {
    tokens.push({ category: "Border", property: "border-width", value: bw });
  }

  // Sizing
  tokens.push({ category: "Size", property: "width", value: `${roundTo(el.getBoundingClientRect().width)}px` });
  tokens.push({ category: "Size", property: "height", value: `${roundTo(el.getBoundingClientRect().height)}px` });

  // Shadows
  if (cs.boxShadow && cs.boxShadow !== "none") {
    tokens.push({ category: "Effects", property: "box-shadow", value: cs.boxShadow });
  }

  // Opacity
  if (cs.opacity !== "1") {
    tokens.push({ category: "Effects", property: "opacity", value: cs.opacity });
  }

  return tokens;
}

type ExportFormat = "css" | "json" | "scss";

function formatTokens(tokens: DesignToken[], fmt: ExportFormat): string {
  if (fmt === "json") {
    const obj: Record<string, Record<string, string>> = {};
    for (const t of tokens) {
      if (!obj[t.category]) obj[t.category] = {};
      obj[t.category][t.property] = t.value;
    }
    return JSON.stringify(obj, null, 2);
  }
  if (fmt === "scss") {
    return tokens.map((t) => `$${t.property}: ${t.value};`).join("\n");
  }
  // css vars
  return tokens.map((t) => `--${t.property}: ${t.value};`).join("\n");
}

// ─── Component ────────────────────────────────────────────────

export function TokenExtractor({ element }: { element: HTMLElement | null }) {
  const [open, setOpen] = useState(false);
  const [exportFmt, setExportFmt] = useState<ExportFormat>("css");
  const [copied, setCopied] = useState(false);

  const tokens = useMemo(() => (element ? extractTokens(element) : []), [element]);
  const categories = useMemo(() => {
    const cats: Record<string, DesignToken[]> = {};
    for (const t of tokens) {
      if (!cats[t.category]) cats[t.category] = [];
      cats[t.category].push(t);
    }
    return cats;
  }, [tokens]);

  if (!element) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(formatTokens(tokens, exportFmt)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div data-viztweak="" style={{ flexShrink: 0 }}>
      <SectionHeader title="Design Tokens" expanded={open} onToggle={() => setOpen((p) => !p)} />
      {open && (
        <div style={{ padding: "4px 12px 8px" }}>
          {/* Export format + copy */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
            {(["css", "json", "scss"] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setExportFmt(fmt)}
                style={{
                  padding: "2px 8px",
                  fontSize: "10px",
                  fontWeight: exportFmt === fmt ? 600 : 400,
                  background: exportFmt === fmt ? "var(--vt-accent)" : "var(--vt-panel-bg)",
                  color: exportFmt === fmt ? "#fff" : "var(--vt-text-secondary)",
                  border: "1px solid var(--vt-border)",
                  borderRadius: "3px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  lineHeight: "16px",
                }}
              >
                {fmt}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              onClick={handleCopy}
              style={{
                padding: "2px 8px",
                fontSize: "10px",
                background: copied ? "#22c55e" : "var(--vt-surface)",
                color: copied ? "#fff" : "var(--vt-text-primary)",
                border: "1px solid var(--vt-border)",
                borderRadius: "3px",
                cursor: "pointer",
                lineHeight: "16px",
              }}
            >
              {copied ? "Copied!" : "Copy All"}
            </button>
          </div>

          {/* Token list by category */}
          {Object.entries(categories).map(([cat, tks]) => (
            <div key={cat} style={{ marginBottom: "6px" }}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "var(--vt-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "2px",
                }}
              >
                {cat}
              </div>
              {tks.map((t) => (
                <div
                  key={t.property}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1px 0",
                    fontSize: "11px",
                    lineHeight: "16px",
                  }}
                >
                  <span style={{ color: "var(--vt-text-secondary)", minWidth: "90px" }}>{t.property}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {t.value.startsWith("#") && (
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "2px",
                          background: t.value,
                          border: "1px solid var(--vt-border)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span style={{ color: "var(--vt-text-primary)", fontFamily: "var(--vt-font-mono, monospace)", fontSize: "10px" }}>
                      {t.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {tokens.length === 0 && (
            <div style={{ fontSize: "11px", color: "var(--vt-text-secondary)", padding: "8px 0", textAlign: "center" }}>
              Select an element to extract tokens
            </div>
          )}
        </div>
      )}
    </div>
  );
}
