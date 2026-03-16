import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ChangeStore } from "./ChangeStore.js";
import { WSBridge } from "./WSBridge.js";

const store = new ChangeStore();
const bridge = new WSBridge(store);

const server = new McpServer({
  name: "viztweak",
  version: "0.1.0",
});

// ─── Tool: get_formatted_changes ───
// Returns a structured markdown diff of all pending visual changes
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
// Returns info about the currently selected element
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
// Clears all pending changes
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

// ─── Start server ───
async function main() {
  // Start the WebSocket bridge first (non-blocking)
  try {
    await bridge.start();
  } catch {
    console.error("[viztweak] Could not start WebSocket bridge — continuing with MCP only");
  }

  // Connect MCP server via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[viztweak] MCP server running on stdio");
}

main().catch((err) => {
  console.error("[viztweak] Fatal error:", err);
  process.exit(1);
});
