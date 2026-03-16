import React, { useState, useMemo } from "react";
import { SectionHeader } from "./FigmaInputs.js";
import type { DiffEngine } from "./DiffEngine.js";

// ─── Types ────────────────────────────────────────────────────

interface DiffEntry {
  selector: string;
  changes: { property: string; before: string; after: string }[];
}

// ─── Selector Generator ───────────────────────────────────────

function generateSelector(el: HTMLElement): string {
  // Try ID
  if (el.id) return `#${el.id}`;

  // Try meaningful class combo
  const classes = Array.from(el.classList).filter(
    (c) => !c.startsWith("vt-") && !c.startsWith("__") && c.length < 40
  );
  if (classes.length > 0) {
    const tag = el.tagName.toLowerCase();
    return `${tag}.${classes.slice(0, 3).join(".")}`;
  }

  // Build path
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  let depth = 0;

  while (current && current !== document.body && depth < 4) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }
    const cls = Array.from(current.classList).filter(
      (c) => !c.startsWith("vt-") && c.length < 30
    );
    if (cls.length > 0) {
      part += `.${cls[0]}`;
    } else if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children).filter(
        (s) => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(part);
    current = current.parentElement;
    depth++;
  }

  return parts.join(" > ");
}

// ─── Format Outputs ───────────────────────────────────────────

type OutputFormat = "css" | "patch" | "tailwind";

function formatDiffs(diffs: DiffEntry[], fmt: OutputFormat): string {
  if (fmt === "css") {
    return diffs
      .map((d) => {
        const props = d.changes.map((c) => `  ${c.property}: ${c.after};`).join("\n");
        return `${d.selector} {\n${props}\n}`;
      })
      .join("\n\n");
  }

  if (fmt === "patch") {
    return diffs
      .map((d) => {
        const lines = d.changes
          .map((c) => `- ${c.property}: ${c.before};\n+ ${c.property}: ${c.after};`)
          .join("\n");
        return `/* ${d.selector} */\n${lines}`;
      })
      .join("\n\n");
  }

  // Tailwind approximation
  return diffs
    .map((d) => {
      const tw = d.changes.map((c) => cssToTailwindHint(c.property, c.after)).filter(Boolean);
      return `<!-- ${d.selector} -->\n${tw.join(" ")}`;
    })
    .join("\n\n");
}

function cssToTailwindHint(prop: string, value: string): string {
  const px = parseInt(value);
  const pxToTw: Record<number, string> = {
    0: "0", 1: "px", 2: "0.5", 4: "1", 6: "1.5", 8: "2", 10: "2.5",
    12: "3", 14: "3.5", 16: "4", 20: "5", 24: "6", 28: "7", 32: "8",
    36: "9", 40: "10", 44: "11", 48: "12", 56: "14", 64: "16", 80: "20",
    96: "24",
  };
  const twSize = pxToTw[px] || `[${value}]`;

  const map: Record<string, string> = {
    "padding-top": `pt-${twSize}`,
    "padding-right": `pr-${twSize}`,
    "padding-bottom": `pb-${twSize}`,
    "padding-left": `pl-${twSize}`,
    "margin-top": `mt-${twSize}`,
    "margin-right": `mr-${twSize}`,
    "margin-bottom": `mb-${twSize}`,
    "margin-left": `ml-${twSize}`,
    "border-radius": `rounded-[${value}]`,
    "font-size": `text-[${value}]`,
    "font-weight": `font-[${value}]`,
    "gap": `gap-${twSize}`,
    "width": `w-[${value}]`,
    "height": `h-[${value}]`,
    "opacity": `opacity-[${value}]`,
  };

  if (prop === "background-color" || prop === "color" || prop === "border-color") {
    return `${prop === "color" ? "text" : prop === "background-color" ? "bg" : "border"}-[${value}]`;
  }

  return map[prop] || `/* ${prop}: ${value} */`;
}

// ─── Component ────────────────────────────────────────────────

export function DiffReporter({ diffEngine }: { diffEngine: DiffEngine | null }) {
  const [open, setOpen] = useState(false);
  const [outputFmt, setOutputFmt] = useState<OutputFormat>("css");
  const [copied, setCopied] = useState(false);

  const diffs = useMemo<DiffEntry[]>(() => {
    if (!diffEngine) return [];
    const allDiffs = diffEngine.getAllDiffs();
    const entries: DiffEntry[] = [];

    for (const [el, changes] of allDiffs) {
      if (!(el instanceof HTMLElement)) continue;
      const changeList: DiffEntry["changes"] = [];

      for (const [prop, { original, current }] of Object.entries(changes)) {
        if (original !== current) {
          changeList.push({
            property: prop.replace(/([A-Z])/g, "-$1").toLowerCase(),
            before: original,
            after: current,
          });
        }
      }

      if (changeList.length > 0) {
        entries.push({
          selector: generateSelector(el),
          changes: changeList,
        });
      }
    }
    return entries;
  }, [diffEngine, open]); // re-compute when opened

  const totalChanges = diffs.reduce((sum, d) => sum + d.changes.length, 0);

  const handleCopy = () => {
    navigator.clipboard.writeText(formatDiffs(diffs, outputFmt)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div data-viztweak="" style={{ flexShrink: 0 }}>
      <SectionHeader
        label={`Changes${totalChanges > 0 ? ` (${totalChanges})` : ""}`}
        open={open}
        onToggle={() => setOpen((p) => !p)}
      />
      {open && (
        <div style={{ padding: "4px 12px 8px" }}>
          {diffs.length === 0 ? (
            <div style={{ fontSize: "11px", color: "var(--vt-text-secondary)", padding: "8px 0", textAlign: "center" }}>
              No changes yet. Edit styles to see a diff report.
            </div>
          ) : (
            <>
              {/* Format selector + copy */}
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
                {(["css", "patch", "tailwind"] as OutputFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setOutputFmt(fmt)}
                    style={{
                      padding: "2px 8px",
                      fontSize: "10px",
                      fontWeight: outputFmt === fmt ? 600 : 400,
                      background: outputFmt === fmt ? "var(--vt-accent)" : "var(--vt-panel-bg)",
                      color: outputFmt === fmt ? "#fff" : "var(--vt-text-secondary)",
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
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              {/* Diff entries */}
              {diffs.map((d, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: "6px",
                    padding: "4px 6px",
                    background: "var(--vt-panel-bg)",
                    borderRadius: "4px",
                    border: "1px solid var(--vt-border)",
                  }}
                >
                  {/* Selector */}
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "var(--vt-accent)",
                      fontFamily: "var(--vt-font-mono, monospace)",
                      marginBottom: "3px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.selector}
                  </div>

                  {/* Property changes */}
                  {d.changes.map((c, ci) => (
                    <div
                      key={ci}
                      style={{
                        display: "flex",
                        fontSize: "10px",
                        lineHeight: "15px",
                        fontFamily: "var(--vt-font-mono, monospace)",
                      }}
                    >
                      <span style={{ color: "var(--vt-text-secondary)", minWidth: "100px", flexShrink: 0 }}>
                        {c.property}
                      </span>
                      <span style={{ color: "#ef4444", textDecoration: "line-through", marginRight: "6px" }}>
                        {c.before || '""'}
                      </span>
                      <span style={{ color: "#22c55e" }}>{c.after}</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
