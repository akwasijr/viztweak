import React, { useState, useEffect, useCallback } from "react";
import { SectionHeader } from "./FigmaInputs.js";

// ─── Types ────────────────────────────────────────────────────

interface A11yIssue {
  type: "error" | "warning" | "pass";
  label: string;
  detail: string;
  element?: HTMLElement;
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
    const boxShadow = cs.boxShadow;
    const hasOutline = outline !== "none" && outlineWidth > 0;
    const hasBoxShadowFocus = boxShadow && boxShadow !== "none";
    const borderStyle = cs.borderStyle;
    const hasBorder = borderStyle !== "none" && (parseFloat(cs.borderWidth) || 0) > 0;

    if (hasOutline || hasBoxShadowFocus) {
      issues.push({ type: "pass", label: "Focus ring", detail: hasOutline ? "Outline present" : "Box-shadow focus indicator present" });
    } else if (hasBorder) {
      issues.push({ type: "pass", label: "Focus ring", detail: "Border may serve as focus indicator" });
    } else {
      issues.push({
        type: "warning",
        label: "Focus ring",
        detail: "No visible outline or box-shadow. Ensure :focus-visible styles are defined.",
      });
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

  // 9. Language attribute
  if (tag === "html" && !el.getAttribute("lang")) {
    issues.push({ type: "error", label: "Language", detail: "Missing lang attribute on <html> — screen readers need this" });
  } else if (tag === "html") {
    issues.push({ type: "pass", label: "Language", detail: `lang="${el.getAttribute("lang")}"` });
  }

  // 10. Link text quality
  if (tag === "a") {
    const text = el.textContent?.trim() || "";
    const genericLinks = ["click here", "here", "read more", "learn more", "link", "more"];
    if (!text && !el.getAttribute("aria-label")) {
      issues.push({ type: "error", label: "Link text", detail: "Empty link — no text or aria-label" });
    } else if (genericLinks.includes(text.toLowerCase())) {
      issues.push({ type: "warning", label: "Link text", detail: `"${text}" is not descriptive — use meaningful link text` });
    }
  }

  // 11. Text size readability
  if (el.textContent?.trim()) {
    const fontSize = parseFloat(cs.fontSize);
    if (fontSize < 12) {
      issues.push({ type: "warning", label: "Text size", detail: `${fontSize}px — may be hard to read, 12px minimum recommended` });
    }
  }

  // 12. Reduced motion check
  if (cs.animationName && cs.animationName !== "none") {
    issues.push({ type: "warning", label: "Motion", detail: `Animation "${cs.animationName}" — ensure prefers-reduced-motion is respected` });
  }
  if (cs.transitionDuration && cs.transitionDuration !== "0s") {
    const dur = parseFloat(cs.transitionDuration) * 1000;
    if (dur > 500) {
      issues.push({ type: "warning", label: "Motion", detail: `${dur}ms transition — animations over 500ms can cause issues` });
    }
  }

  // 13. Color-only indicators
  if (tag === "span" || tag === "div") {
    const bgColor = parseColor(cs.backgroundColor);
    const textContent = el.textContent?.trim() || "";
    if (bgColor && !textContent && !el.querySelector("svg") && !el.getAttribute("aria-label")) {
      const w = rect.width;
      const h = rect.height;
      if (w <= 20 && h <= 20) {
        issues.push({ type: "warning", label: "Color only", detail: "Small colored element with no text — may rely on color alone to convey meaning" });
      }
    }
  }

  // 14. Table accessibility
  if (tag === "table") {
    const caption = el.querySelector("caption");
    const th = el.querySelector("th");
    if (!caption && !el.getAttribute("aria-label") && !el.getAttribute("aria-describedby")) {
      issues.push({ type: "warning", label: "Table", detail: "Table without <caption> or aria-label — add a description" });
    }
    if (!th) {
      issues.push({ type: "warning", label: "Table", detail: "Table without <th> elements — use header cells for data tables" });
    } else {
      issues.push({ type: "pass", label: "Table", detail: "Table has header cells" });
    }
  }

  // 15. Autocomplete for common input types
  if (tag === "input") {
    const type = el.getAttribute("type") || "text";
    const name = (el.getAttribute("name") || "").toLowerCase();
    const autocomplete = el.getAttribute("autocomplete");
    const needsAutocomplete = ["email", "tel", "password"].includes(type) ||
      ["name", "email", "phone", "address", "city", "zip", "postal"].some((k) => name.includes(k));
    if (needsAutocomplete && !autocomplete) {
      issues.push({ type: "warning", label: "Autocomplete", detail: `Input "${name || type}" should have autocomplete attribute for accessibility` });
    }
  }

  return issues;
}

// ─── Page-wide audit ──────────────────────────────────────────

function auditPage(): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const body = document.body;

  // Skip viztweak portal elements
  const isVizTweak = (el: Element) => el.closest("[data-viztweak]") || el.id === "viztweak-portal";

  // 1. Check all images
  body.querySelectorAll("img").forEach((img) => {
    if (isVizTweak(img)) return;
    const alt = img.getAttribute("alt");
    if (alt === null) {
      issues.push({ type: "error", label: "Image", detail: `Missing alt: ${img.src.split("/").pop()?.slice(0, 30) || "image"}`, element: img as HTMLElement });
    }
  });

  // 2. Check heading hierarchy
  const headings = Array.from(body.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((h) => !isVizTweak(h));
  const h1Count = headings.filter((h) => h.tagName === "H1").length;
  if (h1Count === 0) {
    issues.push({ type: "warning", label: "Headings", detail: "No <h1> found on page" });
  } else if (h1Count > 1) {
    issues.push({ type: "warning", label: "Headings", detail: `${h1Count} <h1> elements — page should have exactly one` });
  }
  for (let i = 1; i < headings.length; i++) {
    const curr = parseInt(headings[i].tagName[1]);
    const prev = parseInt(headings[i - 1].tagName[1]);
    if (curr > prev + 1) {
      issues.push({ type: "warning", label: "Headings", detail: `Skipped from <h${prev}> to <h${curr}>`, element: headings[i] as HTMLElement });
    }
  }

  // 3. Check lang attribute
  if (!document.documentElement.getAttribute("lang")) {
    issues.push({ type: "error", label: "Language", detail: "Missing lang attribute on <html>" });
  }

  // 4. Check form inputs for labels
  body.querySelectorAll("input, select, textarea").forEach((input) => {
    if (isVizTweak(input)) return;
    const el = input as HTMLElement;
    const id = el.id;
    const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
    const ariaLabel = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    if (!hasLabel && !ariaLabel) {
      const name = el.getAttribute("name") || el.getAttribute("type") || el.tagName.toLowerCase();
      issues.push({ type: "error", label: "Label", detail: `Unlabeled ${el.tagName.toLowerCase()}[name="${name}"]`, element: el });
    }
  });

  // 5. Check links
  body.querySelectorAll("a").forEach((a) => {
    if (isVizTweak(a)) return;
    const text = a.textContent?.trim() || "";
    if (!text && !a.getAttribute("aria-label") && !a.querySelector("img")) {
      issues.push({ type: "error", label: "Link", detail: "Empty link with no text or aria-label", element: a as HTMLElement });
    }
  });

  // 6. Check interactive divs
  body.querySelectorAll("[onclick], [role='button']").forEach((el) => {
    if (isVizTweak(el)) return;
    if (el.tagName === "DIV" || el.tagName === "SPAN") {
      if (!el.getAttribute("tabindex")) {
        issues.push({ type: "error", label: "Keyboard", detail: `Clickable <${el.tagName.toLowerCase()}> not keyboard accessible`, element: el as HTMLElement });
      }
    }
  });

  // 7. Check contrast on visible text elements
  const textTags = "p, span, li, td, th, label, h1, h2, h3, h4, h5, h6, a, button";
  let contrastFails = 0;
  body.querySelectorAll(textTags).forEach((el) => {
    if (isVizTweak(el)) return;
    const htmlEl = el as HTMLElement;
    if (!htmlEl.textContent?.trim()) return;
    const cs = window.getComputedStyle(htmlEl);
    const fg = parseColor(cs.color);
    const bg = getEffectiveBg(htmlEl);
    if (fg) {
      const ratio = contrastRatio(fg, bg);
      const fontSize = parseFloat(cs.fontSize);
      const isBold = parseInt(cs.fontWeight) >= 700;
      const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold);
      const minRatio = isLargeText ? 3 : 4.5;
      if (ratio < minRatio) contrastFails++;
    }
  });
  if (contrastFails > 0) {
    issues.push({ type: "error", label: "Contrast", detail: `${contrastFails} text element${contrastFails > 1 ? "s" : ""} fail WCAG AA contrast` });
  } else {
    issues.push({ type: "pass", label: "Contrast", detail: "All visible text passes WCAG AA" });
  }

  // 8. Check tap targets
  let smallTargets = 0;
  body.querySelectorAll("button, a, input, [role='button']").forEach((el) => {
    if (isVizTweak(el)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
      smallTargets++;
    }
  });
  if (smallTargets > 0) {
    issues.push({ type: "warning", label: "Tap targets", detail: `${smallTargets} interactive element${smallTargets > 1 ? "s" : ""} smaller than 44×44px` });
  } else {
    issues.push({ type: "pass", label: "Tap targets", detail: "All interactive elements meet 44×44px minimum" });
  }

  // 9. Check for skip navigation link
  const firstLink = body.querySelector("a");
  const hasSkipLink = firstLink && (firstLink.textContent?.toLowerCase().includes("skip") || firstLink.getAttribute("href")?.startsWith("#"));
  if (!hasSkipLink) {
    issues.push({ type: "warning", label: "Skip link", detail: "No skip navigation link found — add one for keyboard users" });
  }

  // 10. Check for landmark roles
  const hasMain = body.querySelector("main") || body.querySelector("[role='main']");
  const hasNav = body.querySelector("nav") || body.querySelector("[role='navigation']");
  if (!hasMain) {
    issues.push({ type: "warning", label: "Landmarks", detail: "No <main> landmark — screen readers use these to navigate" });
  }
  if (!hasNav) {
    issues.push({ type: "warning", label: "Landmarks", detail: "No <nav> landmark found" });
  }
  if (hasMain && hasNav) {
    issues.push({ type: "pass", label: "Landmarks", detail: "Page has main and navigation landmarks" });
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
  const [pageIssues, setPageIssues] = useState<A11yIssue[] | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!element) {
      setIssues([]);
      return;
    }
    setIssues(auditElement(element));
  }, [element]);

  const handleScanPage = useCallback(() => {
    setScanning(true);
    // Run async to avoid blocking UI
    requestAnimationFrame(() => {
      setPageIssues(auditPage());
      setScanning(false);
    });
  }, []);

  if (!element) return null;

  const errors = issues.filter((i) => i.type === "error").length;
  const warnings = issues.filter((i) => i.type === "warning").length;
  const pageErrors = pageIssues?.filter((i) => i.type === "error").length || 0;
  const pageWarnings = pageIssues?.filter((i) => i.type === "warning").length || 0;

  const renderIssueList = (list: A11yIssue[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      {list.length === 0 && (
        <span style={{ fontSize: "11px", color: "var(--vt-text-secondary)" }}>
          No checks applicable for this element type.
        </span>
      )}
      {list.map((issue, i) => {
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
  );

  return (
    <div>
      <SectionHeader
        title={`Accessibility${errors > 0 ? ` (${errors} ✕)` : warnings > 0 ? ` (${warnings} !)` : " ✓"}`}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
      {expanded && (
        <div style={{ padding: "4px 12px 8px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {/* Element-level audit */}
          <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--vt-text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Selected element
          </span>
          {renderIssueList(issues)}

          {/* Page-wide audit */}
          <div style={{ borderTop: "1px solid var(--vt-border)", margin: "4px 0", paddingTop: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--vt-text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Full page audit
              </span>
              <button
                onClick={handleScanPage}
                style={{
                  padding: "2px 8px",
                  fontSize: "10px",
                  fontWeight: 500,
                  color: "var(--vt-accent)",
                  background: "var(--vt-accent-bg)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontFamily: "var(--vt-font)",
                }}
              >
                {scanning ? "Scanning…" : pageIssues ? "Rescan" : "Scan page"}
              </button>
            </div>
            {pageIssues && (
              <>
                <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                  {pageErrors > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#EF4444" }}>
                      {pageErrors} error{pageErrors !== 1 ? "s" : ""}
                    </span>
                  )}
                  {pageWarnings > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#F59E0B" }}>
                      {pageWarnings} warning{pageWarnings !== 1 ? "s" : ""}
                    </span>
                  )}
                  {pageErrors === 0 && pageWarnings === 0 && (
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#22C55E" }}>All checks pass</span>
                  )}
                </div>
                {renderIssueList(pageIssues)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
