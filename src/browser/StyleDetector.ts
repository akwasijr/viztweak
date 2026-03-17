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

  return classes.length > 0 ? "plain-css" : "unknown";
}
