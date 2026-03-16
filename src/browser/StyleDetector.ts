import type { ElementInfo } from "../shared/types.js";

/**
 * Detects the CSS approach used by the page by analyzing stylesheets.
 */
export function detectStylingApproach(
  element: HTMLElement
): ElementInfo["stylingApproach"] {
  const classes = Array.from(element.classList);

  // Check for CSS Modules pattern (random hashes in class names)
  const cssModulePattern = /^[a-zA-Z][a-zA-Z0-9]*_[a-zA-Z][a-zA-Z0-9]*__[a-zA-Z0-9]+$/;
  const shortHashPattern = /^[a-zA-Z][a-zA-Z0-9]*_[a-zA-Z0-9]{5,8}$/;
  if (classes.some((c) => cssModulePattern.test(c) || shortHashPattern.test(c))) {
    return "css-modules";
  }

  // Check for Tailwind by analyzing stylesheet rules
  if (isTailwindProject()) {
    return "tailwind";
  }

  // Check class names for common Tailwind patterns
  const tailwindPatterns = [
    /^(m|p)(t|r|b|l|x|y)?-\d+$/,       // m-4, px-2, py-3
    /^(w|h)-\d+$/,                        // w-4, h-8
    /^(text|bg|border)-/,                 // text-sm, bg-blue-500
    /^(flex|grid|block|inline|hidden)$/,   // display utilities
    /^(rounded|shadow|opacity)-/,          // visual utilities
    /^(gap|space)-/,                       // spacing utilities
  ];
  const tailwindHits = classes.filter((c) =>
    tailwindPatterns.some((p) => p.test(c))
  ).length;
  if (tailwindHits >= 2) {
    return "tailwind";
  }

  return classes.length > 0 ? "plain-css" : "unknown";
}

/**
 * Checks if the project uses a utility-first CSS framework (like Tailwind)
 * by analyzing the document's stylesheets for single-property rules.
 */
function isTailwindProject(): boolean {
  try {
    let utilityRules = 0;
    let totalRules = 0;

    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;

        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) {
            totalRules++;
            const propCount = rule.style.length;
            // Utility classes typically have 1-2 properties
            if (propCount <= 2 && rule.selectorText.startsWith(".")) {
              utilityRules++;
            }
          }
        }
      } catch {
        // Cross-origin stylesheet — skip
      }
    }

    // If >40% of rules are utility-like, it's probably Tailwind
    return totalRules > 20 && utilityRules / totalRules > 0.4;
  } catch {
    return false;
  }
}

/**
 * Maps a CSS property + value to a Tailwind utility class.
 */
const pxToTw: Record<string, string> = {
  "0": "0",
  "1": "px",
  "2": "0.5",
  "4": "1",
  "6": "1.5",
  "8": "2",
  "10": "2.5",
  "12": "3",
  "14": "3.5",
  "16": "4",
  "20": "5",
  "24": "6",
  "28": "7",
  "32": "8",
  "36": "9",
  "40": "10",
  "44": "11",
  "48": "12",
  "56": "14",
  "64": "16",
  "80": "20",
  "96": "24",
};

export function cssPropToTailwind(
  property: string,
  value: string
): string | null {
  const px = parseFloat(value);
  const twSize = pxToTw[String(px)];

  const propMap: Record<string, string> = {
    padding: "p",
    paddingTop: "pt",
    paddingRight: "pr",
    paddingBottom: "pb",
    paddingLeft: "pl",
    margin: "m",
    marginTop: "mt",
    marginRight: "mr",
    marginBottom: "mb",
    marginLeft: "ml",
    gap: "gap",
    borderRadius: "rounded",
    fontSize: "text",
    width: "w",
    height: "h",
  };

  const prefix = propMap[property];
  if (prefix && twSize) {
    return `${prefix}-${twSize}`;
  }

  // Border radius special values
  if (property === "borderRadius") {
    if (value === "0px") return "rounded-none";
    if (px <= 2) return "rounded-sm";
    if (px <= 4) return "rounded";
    if (px <= 6) return "rounded-md";
    if (px <= 8) return "rounded-lg";
    if (px <= 12) return "rounded-xl";
    if (px <= 16) return "rounded-2xl";
    if (px <= 24) return "rounded-3xl";
    if (px >= 9999) return "rounded-full";
  }

  return null;
}
