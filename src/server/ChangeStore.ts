import type { ElementDiff, ElementInfo } from "../shared/types.js";

/**
 * In-memory store for pending visual changes and current selection.
 * Shared between the MCP tools and the WebSocket bridge.
 */
export class ChangeStore {
  private diffs: ElementDiff[] = [];
  private selectedElement: ElementInfo | null = null;
  private computedStyles: Record<string, string> = {};

  setSelection(element: ElementInfo, styles: Record<string, string>) {
    this.selectedElement = element;
    this.computedStyles = styles;
  }

  getSelection() {
    return this.selectedElement
      ? { element: this.selectedElement, computedStyles: this.computedStyles }
      : null;
  }

  addDiff(diff: ElementDiff) {
    const existing = this.diffs.findIndex(
      (d) => d.element.selector === diff.element.selector
    );
    if (existing >= 0) {
      this.diffs[existing] = diff;
    } else {
      this.diffs.push(diff);
    }
  }

  getDiffs(): ElementDiff[] {
    return [...this.diffs];
  }

  clearDiffs() {
    this.diffs = [];
  }

  formatChangesMarkdown(): string {
    if (this.diffs.length === 0) {
      return "No pending visual changes.";
    }

    const sections = this.diffs.map((diff) => {
      const el = diff.element;
      const header = [
        `## \`<${el.tagName}>\` ${el.textContent ? `"${el.textContent}"` : ""}`,
        el.componentName ? `Component: **${el.componentName}**` : "",
        `Selector: \`${el.selector}\``,
        `Styling: ${el.stylingApproach}`,
        el.classList.length > 0
          ? `Classes: \`${el.classList.join(" ")}\``
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const table = [
        "| Property | Before | After |",
        "|----------|--------|-------|",
        ...diff.changes.map(
          (c) => `| ${c.property} | ${c.before} | ${c.after} |`
        ),
      ].join("\n");

      const tailwind = diff.suggestedTailwind
        ? `\n> Suggested Tailwind: \`${diff.suggestedTailwind}\``
        : "";

      return `${header}\n\n### Changes\n${table}${tailwind}`;
    });

    return `# Visual Changes (${this.diffs.length} element${this.diffs.length > 1 ? "s" : ""})\n\n${sections.join("\n\n---\n\n")}`;
  }
}
