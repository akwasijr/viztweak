import type { ElementInfo } from "../shared/types.js";
import { detectStylingApproach } from "./StyleDetector.js";

/**
 * Resolves a DOM element to a structured ElementInfo object.
 * Walks the React fiber tree (if available) to find the component name.
 */
export function resolveElement(el: HTMLElement): ElementInfo {
  return {
    selector: buildSelector(el),
    tagName: el.tagName.toLowerCase(),
    textContent: getTextContent(el),
    componentName: getReactComponentName(el),
    classList: Array.from(el.classList),
    stylingApproach: detectStylingApproach(el),
  };
}

/**
 * Builds a unique CSS selector for the element.
 */
function buildSelector(el: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current !== document.body) {
    let segment = current.tagName.toLowerCase();

    if (current.id) {
      segment = `#${current.id}`;
      parts.unshift(segment);
      break;
    }

    // Use nth-child for disambiguation
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        segment += `:nth-of-type(${index})`;
      }
    }

    // Add a significant class if present
    const significantClass = Array.from(current.classList).find(
      (c) => !c.includes("__") && !c.includes("_") && c.length > 2 && c.length < 30
    );
    if (significantClass) {
      segment += `.${significantClass}`;
    }

    parts.unshift(segment);
    current = current.parentElement;
  }

  return parts.join(" > ");
}

/**
 * Gets the direct text content of an element (not children), truncated.
 */
function getTextContent(el: HTMLElement): string {
  const text = Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent?.trim())
    .filter(Boolean)
    .join(" ");

  return text.length > 50 ? text.slice(0, 47) + "..." : text;
}

/**
 * Walks the React fiber tree to find the nearest component name.
 * Works with React 16+ (uses __reactFiber$ or __reactInternalInstance$).
 */
function getReactComponentName(el: HTMLElement): string | undefined {
  // Find the React fiber key on the element
  const fiberKey = Object.keys(el).find(
    (k) =>
      k.startsWith("__reactFiber$") ||
      k.startsWith("__reactInternalInstance$")
  );

  if (!fiberKey) return undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fiber = (el as any)[fiberKey];
    const maxDepth = 15;

    for (let i = 0; i < maxDepth && fiber; i++) {
      if (fiber.type && typeof fiber.type === "function") {
        const name = fiber.type.displayName || fiber.type.name;
        if (name && name !== "Fragment" && !name.startsWith("_")) {
          return name;
        }
      }
      // Also check for forwardRef or memo wrappers
      if (fiber.type?.render?.displayName || fiber.type?.render?.name) {
        const name = fiber.type.render.displayName || fiber.type.render.name;
        if (name && name !== "Fragment") return name;
      }
      fiber = fiber.return;
    }
  } catch {
    // Fiber walk failed — silently ignore
  }

  return undefined;
}

/**
 * Gets computed styles for editable properties.
 */
export function getComputedStyleMap(
  el: HTMLElement,
  properties: readonly string[]
): Record<string, string> {
  const computed = window.getComputedStyle(el);
  const result: Record<string, string> = {};

  for (const prop of properties) {
    const cssName = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    result[prop] = computed.getPropertyValue(cssName) || "";
  }

  return result;
}
