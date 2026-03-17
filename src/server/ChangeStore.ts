import type { ElementDiff, ElementInfo, DesignerMessage } from "../shared/types.js";

/**
 * In-memory store for pending visual changes, current selection,
 * and designer messages (talk-back queue).
 */
export class ChangeStore {
  private diffs: ElementDiff[] = [];
  private selectedElement: ElementInfo | null = null;
  private computedStyles: Record<string, string> = {};
  private messages: DesignerMessage[] = [];
  private messageCounter = 0;

  // ─── Selection ───

  setSelection(element: ElementInfo, styles: Record<string, string>) {
    this.selectedElement = element;
    this.computedStyles = styles;
  }

  getSelection() {
    return this.selectedElement
      ? { element: this.selectedElement, computedStyles: this.computedStyles }
      : null;
  }

  // ─── Diffs ───

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

  // ─── Designer messages (talk-back) ───

  addMessage(text: string): DesignerMessage {
    const msg: DesignerMessage = {
      id: `msg-${++this.messageCounter}`,
      text,
      timestamp: Date.now(),
      acknowledged: false,
    };
    this.messages.push(msg);
    return msg;
  }

  getUnacknowledgedMessages(): DesignerMessage[] {
    return this.messages.filter((m) => !m.acknowledged);
  }

  getAllMessages(): DesignerMessage[] {
    return [...this.messages];
  }

  acknowledgeMessages(ids: string[]) {
    for (const msg of this.messages) {
      if (ids.includes(msg.id)) {
        msg.acknowledged = true;
      }
    }
  }

  acknowledgeAll() {
    for (const msg of this.messages) {
      msg.acknowledged = true;
    }
  }

  // ─── Markdown formatting ───

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

      return `${header}\n\n### Changes\n${table}`;
    });

    return `# Visual Changes (${this.diffs.length} element${this.diffs.length > 1 ? "s" : ""})\n\n${sections.join("\n\n---\n\n")}`;
  }

  formatMessagesMarkdown(): string {
    const pending = this.getUnacknowledgedMessages();
    if (pending.length === 0) {
      return "No new messages from the designer.";
    }

    const lines = pending.map((m) => {
      const time = new Date(m.timestamp).toLocaleTimeString();
      return `- **[${time}]** ${m.text} _(id: ${m.id})_`;
    });

    return `# Designer Messages (${pending.length} unread)\n\n${lines.join("\n")}`;
  }
}
