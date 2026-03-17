import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ChangeStore } from "./ChangeStore.js";
import { WSBridge } from "./WSBridge.js";

const store = new ChangeStore();
const bridge = new WSBridge(store);

const server = new McpServer({
  name: "viztweak",
  version: "0.4.0",
});

// ─── Notification: new_designer_message ───
// When a designer sends a message, we update this resource so the agent gets prompted.
// MCP resource subscriptions aren't widely supported yet, so we also
// expose a tool that returns a human-readable prompt to check messages.

server.tool(
  "check_for_updates",
  "Check if there are any new designer messages or visual changes pending. Call this periodically or when the designer may have sent feedback. Returns a summary of what needs attention.",
  {},
  async () => {
    const unread = store.getUnacknowledgedMessages();
    const diffs = store.getDiffs();
    const selection = store.getSelection();

    const parts: string[] = [];

    if (unread.length > 0) {
      parts.push(`📬 ${unread.length} unread designer message(s):`);
      for (const m of unread) {
        const time = new Date(m.timestamp).toLocaleTimeString();
        parts.push(`  [${time}] "${m.text}" (id: ${m.id})`);
      }
    }

    if (diffs.length > 0) {
      parts.push(`🎨 ${diffs.length} visual change(s) pending`);
    }

    if (selection) {
      parts.push(`🔍 Selected: <${selection.element.tagName}> ${selection.element.textContent || ""}`);
    }

    if (parts.length === 0) {
      return {
        content: [{ type: "text", text: "No updates. The designer hasn't sent any messages or made visual changes." }],
      };
    }

    return {
      content: [{ type: "text", text: parts.join("\n") }],
    };
  }
);

// ─── Tool: get_formatted_changes ───
server.tool(
  "get_formatted_changes",
  "Get all pending visual changes as a structured markdown diff with before/after values, component names, selectors, and suggested Tailwind classes. Call this to see what the user changed in the browser.",
  {},
  async () => {
    const markdown = store.formatChangesMarkdown();
    return {
      content: [{ type: "text", text: markdown }],
    };
  }
);

// ─── Tool: get_selected_element ───
server.tool(
  "get_selected_element",
  "Get information about the element the user currently has selected in the browser, including its tag, component name, CSS selector, class list, and computed styles.",
  {},
  async () => {
    const selection = store.getSelection();
    if (!selection) {
      return {
        content: [
          {
            type: "text",
            text: "No element is currently selected. Ask the user to select an element in the browser.",
          },
        ],
      };
    }

    const el = selection.element;
    const lines = [
      `# Selected Element`,
      `- Tag: \`<${el.tagName}>\``,
      el.textContent ? `- Text: "${el.textContent}"` : "",
      el.componentName ? `- Component: **${el.componentName}**` : "",
      `- Selector: \`${el.selector}\``,
      `- Styling: ${el.stylingApproach}`,
      el.classList.length > 0
        ? `- Classes: \`${el.classList.join(" ")}\``
        : "",
      "",
      "## Computed Styles",
      ...Object.entries(selection.computedStyles).map(
        ([k, v]) => `- ${k}: ${v}`
      ),
    ];

    return {
      content: [{ type: "text", text: lines.filter(Boolean).join("\n") }],
    };
  }
);

// ─── Tool: clear_changes ───
server.tool(
  "clear_changes",
  "Clear all pending visual changes after they have been applied to the source code.",
  {},
  async () => {
    store.clearDiffs();
    bridge.broadcast({ type: "changes_cleared" });
    return {
      content: [{ type: "text", text: "All pending changes cleared." }],
    };
  }
);

// ─── Tool: get_designer_messages ───
server.tool(
  "get_designer_messages",
  "Get pending messages from the designer in the browser. The designer types instructions or requests in the VizTweak panel chat bar. Returns unread messages as markdown. Call this to check for new designer requests.",
  {},
  async () => {
    const markdown = store.formatMessagesMarkdown();
    return {
      content: [{ type: "text", text: markdown }],
    };
  }
);

// ─── Tool: send_status_to_browser ───
server.tool(
  "send_status_to_browser",
  "Send a status message to the designer in the browser. Use this to acknowledge their request, report progress, or confirm changes were applied. The message appears as a toast in the VizTweak panel.",
  {
    message: z.string().describe("Status message to display to the designer"),
    status: z.enum(["info", "success", "error", "thinking"]).default("info").describe("Status type: info, success, error, or thinking"),
  },
  async ({ message, status }) => {
    bridge.sendAgentStatus(message, status);
    return {
      content: [{ type: "text", text: `Status sent to browser: "${message}" (${status})` }],
    };
  }
);

// ─── Tool: acknowledge_messages ───
server.tool(
  "acknowledge_messages",
  "Mark designer messages as read/acknowledged. Call this after processing messages from get_designer_messages so they don't appear again.",
  {
    messageIds: z.array(z.string()).optional().describe("Specific message IDs to acknowledge. If omitted, acknowledges all."),
  },
  async ({ messageIds }) => {
    if (messageIds && messageIds.length > 0) {
      store.acknowledgeMessages(messageIds);
    } else {
      store.acknowledgeAll();
    }
    return {
      content: [{ type: "text", text: `Messages acknowledged.` }],
    };
  }
);

// ─── Start server ───
async function main() {
  try {
    await bridge.start();
  } catch {
    console.error("[viztweak] Could not start WebSocket bridge - continuing with MCP only");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[viztweak] MCP server v0.4.0 running on stdio (7 tools)");
}

main().catch((err) => {
  console.error("[viztweak] Fatal error:", err);
  process.exit(1);
});
