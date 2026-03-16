import type { ElementDiff, StyleChange } from "../shared/types.js";
import { resolveElement } from "./ElementResolver.js";
import { cssPropToTailwind } from "./StyleDetector.js";

/**
 * Tracks and generates structured diffs of visual changes.
 */
export class DiffEngine {
  private originalStyles = new Map<HTMLElement, Record<string, string>>();

  /**
   * Captures the original styles of an element before editing.
   */
  captureBaseline(el: HTMLElement, properties: readonly string[]) {
    const computed = window.getComputedStyle(el);
    const baseline: Record<string, string> = {};

    for (const prop of properties) {
      const cssName = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      baseline[prop] = computed.getPropertyValue(cssName) || "";
    }

    this.originalStyles.set(el, baseline);
  }

  /**
   * Generates a diff between original and current styles.
   */
  generateDiff(el: HTMLElement): ElementDiff | null {
    const baseline = this.originalStyles.get(el);
    if (!baseline) return null;

    const computed = window.getComputedStyle(el);
    const changes: StyleChange[] = [];

    for (const [prop, originalValue] of Object.entries(baseline)) {
      const cssName = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      const currentValue = computed.getPropertyValue(cssName) || "";

      if (currentValue !== originalValue) {
        changes.push({
          property: prop,
          before: originalValue,
          after: currentValue,
        });
      }
    }

    if (changes.length === 0) return null;

    const elementInfo = resolveElement(el);

    // Generate suggested Tailwind classes if applicable
    let suggestedTailwind: string | undefined;
    if (elementInfo.stylingApproach === "tailwind") {
      const twClasses = changes
        .map((c) => cssPropToTailwind(c.property, c.after))
        .filter(Boolean);
      if (twClasses.length > 0) {
        suggestedTailwind = twClasses.join(" ");
      }
    }

    return {
      element: elementInfo,
      changes,
      suggestedTailwind,
      timestamp: Date.now(),
    };
  }

  /**
   * Returns all tracked elements with their original and current values.
   */
  getAllDiffs(): Map<HTMLElement, Record<string, { original: string; current: string }>> {
    const result = new Map<HTMLElement, Record<string, { original: string; current: string }>>();

    for (const [el, baseline] of this.originalStyles) {
      if (!el.isConnected) continue;
      const computed = window.getComputedStyle(el);
      const changes: Record<string, { original: string; current: string }> = {};

      for (const [prop, originalValue] of Object.entries(baseline)) {
        const cssName = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
        const currentValue = computed.getPropertyValue(cssName) || "";
        if (currentValue !== originalValue) {
          changes[prop] = { original: originalValue, current: currentValue };
        }
      }

      if (Object.keys(changes).length > 0) {
        result.set(el, changes);
      }
    }

    return result;
  }

  /**
   * Clears the baseline for an element.
   */
  clearBaseline(el: HTMLElement) {
    this.originalStyles.delete(el);
  }

  /**
   * Clears all baselines.
   */
  clearAll() {
    this.originalStyles.clear();
  }
}
