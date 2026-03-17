import type { ElementDiff, StyleChange } from "../shared/types.js";
import { resolveElement } from "./ElementResolver.js";

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

    return {
      element: elementInfo,
      changes,
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

  /**
   * Resets ALL tracked elements back to their original baseline styles.
   * Removes inline overrides we applied and re-captures fresh baselines.
   */
  resetAll(properties: readonly string[]): number {
    let resetCount = 0;
    for (const [el, baseline] of this.originalStyles) {
      if (!el.isConnected) continue;
      for (const prop of Object.keys(baseline)) {
        const cssName = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
        el.style.removeProperty(cssName);
      }
      resetCount++;
    }
    // Re-capture all baselines
    const elements = [...this.originalStyles.keys()];
    this.originalStyles.clear();
    for (const el of elements) {
      if (el.isConnected) {
        this.captureBaseline(el, properties);
      }
    }
    return resetCount;
  }

  /**
   * Returns the total number of changed properties across all tracked elements.
   */
  getChangeCount(): number {
    let count = 0;
    for (const [el, baseline] of this.originalStyles) {
      if (!el.isConnected) continue;
      const computed = window.getComputedStyle(el);
      for (const [prop, originalValue] of Object.entries(baseline)) {
        const cssName = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
        const currentValue = computed.getPropertyValue(cssName) || "";
        if (currentValue !== originalValue) count++;
      }
    }
    return count;
  }

  /**
   * Formats ALL changes as natural instructions an AI coding agent can act on.
   */
  formatAllChangesText(): string {
    const allDiffs = this.getAllDiffs();
    if (allDiffs.size === 0) return "No visual changes recorded.";

    const lines: string[] = [
      "I made some visual changes in the browser using VizTweak. Please update the source code to match these changes.",
      "",
    ];

    let elemIdx = 0;
    for (const [el, changes] of allDiffs) {
      elemIdx++;
      const info = resolveElement(el);
      const tag = info.tagName;
      const changeEntries = Object.entries(changes);

      // Build a natural description of what element this is
      let elemDesc = "";
      if (info.componentName) {
        elemDesc = `the **${info.componentName}** component (\`<${tag}>\`)`;
      } else if (info.classList.length > 0) {
        elemDesc = `the \`<${tag}>\` element with class \`${info.classList[0]}\``;
      } else {
        elemDesc = `the \`<${tag}>\` element`;
      }

      // Selector hint for the agent to locate the element
      lines.push(`**${elemIdx}.** On ${elemDesc} (selector: \`${info.selector}\`):`);

      if (info.stylingApproach !== "unknown") {
        lines.push(`   Styling: ${info.stylingApproach}`);
      }

      // Group changes into natural sentences
      for (const [prop, { original, current }] of changeEntries) {
        const cssName = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
        // Make the change description readable
        const shortOriginal = truncateValue(original);
        const shortCurrent = truncateValue(current);
        lines.push(`   - Change \`${cssName}\` from \`${shortOriginal}\` to \`${shortCurrent}\``);
      }
      lines.push("");
    }

    lines.push("Find the matching elements in the source code and update their styles accordingly. Use the selector and class names to locate each element.");

    return lines.join("\n");
  }
}

/** Shorten long computed values like rgb colors or matrices for readability */
function truncateValue(val: string): string {
  if (val.length <= 60) return val;
  return val.substring(0, 57) + "...";
}
