import React, { useState, useEffect, useCallback } from "react";
import { SectionHeader } from "./FigmaInputs.js";

// ─── Types ────────────────────────────────────────────────────

interface A11yIssue {
  type: "error" | "warning" | "pass";
  label: string;
  detail: string;
}

interface AccessibilityCheckerProps {
  element: HTMLElement | null;
}

// ─── Helpers ──────────────────────────────────────────────────

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function parseColor(color: string): [number, number, number] | null {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  return null;
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = getLuminance(...fg);
  const l2 = getLuminance(...bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getEffectiveBg(el: HTMLElement): [number, number, number] {
  let current: HTMLElement | null = el;
  while (current) {
    const cs = window.getComputedStyle(current);
    const bg = cs.backgroundColor;
    if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
      const parsed = parseColor(bg);
      if (parsed) return parsed;
    }
    current = current.parentElement;
  }
  return [255, 255, 255]; // assume white
}

// ─── Audit Logic ──────────────────────────────────────────────

function auditElement(el: HTMLElement): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const cs = window.getComputedStyle(el);
  const tag = el.tagName.toLowerCase();

  // 1. Color contrast
  const fg = parseColor(cs.color);
  const bg = getEffectiveBg(el);
  if (fg) {
    const ratio = contrastRatio(fg, bg);
    const fontSize = parseFloat(cs.fontSize);
    const isBold = parseInt(cs.fontWeight) >= 700;
    const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold);
    const minRatio = isLargeText ? 3 : 4.5;

    if (ratio >= minRatio) {
      issues.push({
        type: "pass",
        label: "Contrast",
        detail: `${ratio.toFixed(1)}:1 — passes ${isLargeText ? "AA (large)" : "AA"}`,
      });
    } else {
      issues.push({
        type: "error",
        label: "Contrast",
        detail: `${ratio.toFixed(1)}:1 — needs ${minRatio}:1 for ${isLargeText ? "large text" : "normal text"}`,
      });
    }
  }

  // 2. Images: alt text
  if (tag === "img") {
    const alt = el.getAttribute("alt");
    if (alt === null) {
      issues.push({ type: "error", label: "Alt text", detail: "Missing alt attribute on image" });
    } else if (alt === "") {
      issues.push({ type: "warning", label: "Alt text", detail: "Empty alt — treated as decorative. Is this intentional?" });
    } else {
      issues.push({ type: "pass", label: "Alt text", detail: `"${alt.slice(0, 40)}${alt.length > 40 ? "…" : ""}"` });
    }
  }

  // 3. Form inputs: labels
  if (tag === "input" || tag === "select" || tag === "textarea") {
    const id = el.id;
    const ariaLabel = el.getAttribute("aria-label");
    const ariaLabelledBy = el.getAttribute("aria-labelledby");
    const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : null;

    if (ariaLabel || ariaLabelledBy || hasLabel) {
      issues.push({ type: "pass", label: "Label", detail: ariaLabel ? `aria-label="${ariaLabel}"` : "Labeled correctly" });
    } else {
      issues.push({ type: "error", label: "Label", detail: "Missing label, aria-label, or aria-labelledby" });
    }
  }

  // 4. Tap target size
  const rect = el.getBoundingClientRect();
  if (tag === "button" || tag === "a" || tag === "input" || el.getAttribute("role") === "button") {
    const w = rect.width;
    const h = rect.height;
    if (w < 44 || h < 44) {
      issues.push({
        type: "warning",
        label: "Tap target",
        detail: `${Math.round(w)}×${Math.round(h)}px — recommended minimum 44×44px`,
      });
    } else {
      issues.push({ type: "pass", label: "Tap target", detail: `${Math.round(w)}×${Math.round(h)}px ✓` });
    }
  }

  // 5. Focus indicator
  if (tag === "button" || tag === "a" || tag === "input" || tag === "select" || tag === "textarea") {
    const outline = cs.outlineStyle;
    const outlineWidth = parseFloat(cs.outlineWidth) || 0;
    if (outline === "none" && outlineWidth === 0) {
      // Check if there's a :focus-visible rule (can't fully detect, but warn)
      issues.push({
        type: "warning",
        label: "Focus ring",
        detail: "No visible outline. Ensure :focus-visible styles are defined.",
      });
    } else {
      issues.push({ type: "pass", label: "Focus ring", detail: "Outline present" });
    }
  }

  // 6. Heading hierarchy check
  if (/^h[1-6]$/.test(tag)) {
    const level = parseInt(tag[1]);
    // Check for skipped levels by looking at preceding headings
    const allHeadings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"));
    const idx = allHeadings.indexOf(el);
    if (idx > 0) {
      const prevLevel = parseInt(allHeadings[idx - 1].tagName[1]);
      if (level > prevLevel + 1) {
        issues.push({
          type: "warning",
          label: "Heading",
          detail: `Skipped from <h${prevLevel}> to <h${level}>`,
        });
      } else {
        issues.push({ type: "pass", label: "Heading", detail: `<h${level}> — hierarchy OK` });
      }
    }
  }

  // 7. ARIA role check
  const role = el.getAttribute("role");
  if (role) {
    issues.push({ type: "pass", label: "ARIA Role", detail: `role="${role}"` });
  }

  // 8. Interactive divs
  const onClick = el.getAttribute("onclick") || (el as HTMLElement & { onclick: unknown }).onclick;
  if (tag === "div" && (onClick || el.getAttribute("role") === "button")) {
    if (!el.getAttribute("tabindex")) {
      issues.push({ type: "error", label: "Keyboard", detail: "Clickable <div> without tabindex — not keyboard accessible" });
    }
    if (!el.getAttribute("role")) {
      issues.push({ type: "error", label: "Semantics", detail: "Clickable <div> without role — use <button> instead" });
    }
  }

  return issues;
}

// ─── Issue badge colors ───────────────────────────────────────

const typeStyles: Record<A11yIssue["type"], { bg: string; color: string; dot: string }> = {
  error: { bg: "#FEE2E2", color: "#B91C1C", dot: "#EF4444" },
  warning: { bg: "#FEF3C7", color: "#92400E", dot: "#F59E0B" },
  pass: { bg: "#DCFCE7", color: "#166534", dot: "#22C55E" },
};

// ─── Component ────────────────────────────────────────────────

export function AccessibilityChecker({ element }: AccessibilityCheckerProps) {
  const [issues, setIssues] = useState<A11yIssue[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!element) {
      setIssues([]);
      return;
    }
    setIssues(auditElement(element));
  }, [element]);

  if (!element) return null;

  const errors = issues.filter((i) => i.type === "error").length;
  const warnings = issues.filter((i) => i.type === "warning").length;

  return (
    <div>
      <SectionHeader
        title={`Accessibility${errors > 0 ? ` (${errors} ✕)` : warnings > 0 ? ` (${warnings} !)` : " ✓"}`}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
      {expanded && (
        <div style={{ padding: "4px 12px 8px", display: "flex", flexDirection: "column", gap: "3px" }}>
          {issues.length === 0 && (
            <span style={{ fontSize: "11px", color: "var(--vt-text-secondary)" }}>
              No checks applicable for this element type.
            </span>
          )}
          {issues.map((issue, i) => {
            const style = typeStyles[issue.type];
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "6px",
                  padding: "4px 6px",
                  borderRadius: "4px",
                  background: style.bg,
                  fontSize: "10px",
                  lineHeight: "14px",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: style.dot,
                    flexShrink: 0,
                    marginTop: "4px",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: style.color }}>{issue.label}</span>
                  <span style={{ color: style.color, marginLeft: "4px" }}>{issue.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
