import React, { useState, useMemo } from "react";
import { SectionHeader } from "./FigmaInputs.js";

// ─── Color Parsing ────────────────────────────────────────────

function parseToRgb(raw: string): [number, number, number] | null {
  if (raw === "transparent" || raw === "rgba(0, 0, 0, 0)") return null;
  const m = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  if (raw.startsWith("#")) {
    const hex = raw.length === 4
      ? raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3]
      : raw.slice(1, 7);
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

interface ColorEntry {
  hex: string;
  rgb: [number, number, number];
  count: number;
  usage: Set<"text" | "background" | "border">;
  elements: number;
}

function scanPageColors(): ColorEntry[] {
  const colorMap = new Map<string, ColorEntry>();

  const addColor = (raw: string, usage: "text" | "background" | "border") => {
    const rgb = parseToRgb(raw);
    if (!rgb) return;
    const hex = rgbToHex(...rgb).toLowerCase();
    if (hex === "#000000" && raw.includes("rgba") && raw.includes(", 0)")) return; // skip truly transparent
    const existing = colorMap.get(hex);
    if (existing) {
      existing.count++;
      existing.usage.add(usage);
      existing.elements++;
    } else {
      colorMap.set(hex, { hex, rgb, count: 1, usage: new Set([usage]), elements: 1 });
    }
  };

  const allEls = document.querySelectorAll("body *:not([data-viztweak] *)");
  const limit = Math.min(allEls.length, 2000);

  for (let i = 0; i < limit; i++) {
    const el = allEls[i] as HTMLElement;
    if (el.closest("[data-viztweak]")) continue;
    const cs = getComputedStyle(el);
    addColor(cs.color, "text");
    addColor(cs.backgroundColor, "background");
    addColor(cs.borderColor, "border");
  }

  return Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
}

interface SimilarGroup {
  colors: ColorEntry[];
  primary: ColorEntry;
}

function findSimilarGroups(colors: ColorEntry[], threshold = 30): SimilarGroup[] {
  const groups: SimilarGroup[] = [];
  const used = new Set<string>();

  for (const c of colors) {
    if (used.has(c.hex)) continue;
    const group: ColorEntry[] = [c];
    used.add(c.hex);

    for (const other of colors) {
      if (used.has(other.hex)) continue;
      if (colorDistance(c.rgb, other.rgb) < threshold) {
        group.push(other);
        used.add(other.hex);
      }
    }

    if (group.length > 1) {
      groups.push({ colors: group, primary: group.reduce((a, b) => (a.count > b.count ? a : b)) });
    }
  }

  return groups;
}

// ─── Component ────────────────────────────────────────────────

type FilterType = "all" | "text" | "background" | "border";

export function ColorPalette() {
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [scanned, setScanned] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [copied, setCopied] = useState<string | null>(null);

  const handleScan = () => {
    setColors(scanPageColors());
    setScanned(true);
  };

  const filtered = useMemo(() => {
    if (filter === "all") return colors;
    return colors.filter((c) => c.usage.has(filter));
  }, [colors, filter]);

  const similarGroups = useMemo(() => findSimilarGroups(colors), [colors]);

  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopied(hex);
      setTimeout(() => setCopied(null), 1200);
    });
  };

  const handleExport = () => {
    const vars = colors.map((c, i) => `--color-${i + 1}: ${c.hex}; /* used ${c.count}x */`).join("\n");
    navigator.clipboard.writeText(`:root {\n${vars}\n}`);
    setCopied("all");
    setTimeout(() => setCopied(null), 1500);
  };

  const usageBadge = (usage: Set<string>) => {
    const labels: string[] = [];
    if (usage.has("text")) labels.push("T");
    if (usage.has("background")) labels.push("B");
    if (usage.has("border")) labels.push("S");
    return labels.join("");
  };

  return (
    <div data-viztweak="" style={{ flexShrink: 0 }}>
      <SectionHeader title="Color Palette" expanded={open} onToggle={() => setOpen((p) => !p)} />
      {open && (
        <div style={{ padding: "4px 12px 8px" }}>
          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
            <button
              onClick={handleScan}
              style={{
                padding: "2px 8px",
                fontSize: "10px",
                background: "var(--vt-accent)",
                color: "#fff",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                lineHeight: "16px",
              }}
            >
              {scanned ? "Rescan" : "Scan Page"}
            </button>
            {scanned && (
              <>
                {(["all", "text", "background", "border"] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: "2px 6px",
                      fontSize: "9px",
                      fontWeight: filter === f ? 600 : 400,
                      background: filter === f ? "var(--vt-text-primary)" : "transparent",
                      color: filter === f ? "var(--vt-surface)" : "var(--vt-text-secondary)",
                      border: "1px solid var(--vt-border)",
                      borderRadius: "3px",
                      cursor: "pointer",
                      lineHeight: "14px",
                      textTransform: "capitalize",
                    }}
                  >
                    {f === "all" ? "All" : f.charAt(0).toUpperCase()}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button
                  onClick={handleExport}
                  style={{
                    padding: "2px 8px",
                    fontSize: "10px",
                    background: copied === "all" ? "#22c55e" : "var(--vt-surface)",
                    color: copied === "all" ? "#fff" : "var(--vt-text-primary)",
                    border: "1px solid var(--vt-border)",
                    borderRadius: "3px",
                    cursor: "pointer",
                    lineHeight: "16px",
                  }}
                >
                  {copied === "all" ? "Copied!" : "Export"}
                </button>
              </>
            )}
          </div>

          {/* Color grid */}
          {scanned && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginBottom: "6px" }}>
                {filtered.map((c) => (
                  <div
                    key={c.hex}
                    onClick={() => handleCopyHex(c.hex)}
                    title={`${c.hex} — ${c.count} uses (${Array.from(c.usage).join(", ")})`}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "4px",
                      background: c.hex,
                      border: copied === c.hex ? "2px solid var(--vt-accent)" : "1px solid var(--vt-border)",
                      cursor: "pointer",
                      position: "relative",
                      transition: "transform 100ms ease",
                    }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = "scale(1.15)"; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "scale(1)"; }}
                  >
                    {/* Usage badge */}
                    <span
                      style={{
                        position: "absolute",
                        bottom: "-2px",
                        right: "-2px",
                        fontSize: "7px",
                        fontWeight: 700,
                        background: "var(--vt-surface)",
                        borderRadius: "2px",
                        padding: "0 2px",
                        lineHeight: "10px",
                        color: "var(--vt-text-secondary)",
                        border: "1px solid var(--vt-border)",
                      }}
                    >
                      {usageBadge(c.usage)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div style={{ fontSize: "10px", color: "var(--vt-text-secondary)", marginBottom: "4px" }}>
                {colors.length} unique colors found
                {similarGroups.length > 0 && (
                  <span style={{ color: "#f59e0b" }}> · {similarGroups.length} similar group{similarGroups.length > 1 ? "s" : ""}</span>
                )}
              </div>

              {/* Similar color warnings */}
              {similarGroups.length > 0 && (
                <div style={{ marginTop: "4px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 600, color: "#f59e0b", marginBottom: "3px" }}>
                    ⚠ Similar colors that could be consolidated:
                  </div>
                  {similarGroups.slice(0, 5).map((g, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "3px",
                        marginBottom: "3px",
                        padding: "2px 4px",
                        background: "var(--vt-panel-bg)",
                        borderRadius: "3px",
                      }}
                    >
                      {g.colors.map((c) => (
                        <div
                          key={c.hex}
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "2px",
                            background: c.hex,
                            border: "1px solid var(--vt-border)",
                          }}
                        />
                      ))}
                      <span style={{ fontSize: "9px", color: "var(--vt-text-secondary)", marginLeft: "4px" }}>
                        → suggest {g.primary.hex}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!scanned && (
            <div style={{ fontSize: "11px", color: "var(--vt-text-secondary)", padding: "8px 0", textAlign: "center" }}>
              Click Scan to analyze all colors on this page
            </div>
          )}
        </div>
      )}
    </div>
  );
}
