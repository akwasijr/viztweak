# VizTweak

Visual UI tweaker with MCP integration for AI coding agents. Select and tweak any element in the browser — your AI agent writes the code.

Works with **GitHub Copilot CLI**, **Cursor**, **Claude Code**, and any MCP-compatible tool.

## How it works

```
Browser (your app)                    AI Agent (Copilot CLI / Cursor)
┌──────────────────────┐              ┌──────────────────────┐
│  <VizTweak />        │  WebSocket   │  MCP Server (stdio)  │
│                      │◄────────────►│                      │
│  1. Select element   │  localhost   │  get_formatted_changes│
│  2. Tweak styles     │   :7890      │  get_selected_element │
│  3. See live preview │              │  clear_changes        │
└──────────────────────┘              └──────────────────────┘
```

1. **Select** — Click any element on your page. VizTweak identifies the component, styles, and CSS approach.
2. **Tweak** — Adjust spacing, colors, typography, border-radius in the floating panel. Changes preview live.
3. **Apply** — Your AI agent calls `get_formatted_changes` and gets a structured diff with exact before/after values.

## Install

```bash
npm install viztweak
```

## Setup

### 1. Add to your app layout

```tsx
import { VizTweak } from "viztweak";

export default function Layout({ children }) {
  return (
    <>
      {children}
      <VizTweak />
    </>
  );
}
```

The component automatically hides in production. Use `<VizTweak force />` for live demos.

### 2. Connect your AI tool

Add to your project's `.mcp.json` (GitHub Copilot CLI) or MCP settings (Cursor / VS Code):

```json
{
  "mcpServers": {
    "viztweak": {
      "command": "npx",
      "args": ["-y", "viztweak"]
    }
  }
}
```

## What your agent sees

When you call `get_formatted_changes`, the agent receives structured data like:

```markdown
# Visual Changes (1 element)

## `<button>` "Get Started"
Component: **HeroSection**
Selector: `section > div > button.btn-primary`
Styling: tailwind
Classes: `btn-primary px-6 py-3 rounded-lg bg-blue-600`

### Changes
| Property      | Before    | After     |
|---------------|-----------|-----------|
| padding       | 12px 24px | 16px 32px |
| border-radius | 8px       | 12px      |
| font-size     | 14px      | 16px      |

> Suggested Tailwind: `px-8 py-4 rounded-xl text-base`
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_formatted_changes` | Returns all pending visual changes as structured markdown |
| `get_selected_element` | Returns info about the currently selected element |
| `clear_changes` | Clears all pending changes after applying them |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` | Toggle inspect mode |
| `Click` (in inspect mode) | Select an element |
| `Escape` | Close panel / exit inspect mode |

## Features

- **Element inspection** — Hover highlights with tag name and dimensions
- **React component detection** — Walks the React fiber tree to find component names
- **CSS approach detection** — Automatically detects Tailwind, CSS Modules, or plain CSS
- **Tailwind suggestions** — Suggests Tailwind utility classes for your changes
- **Live preview** — See changes instantly before committing to code
- **Auto-reconnect** — WebSocket reconnects automatically if the MCP server restarts

## Supported Frameworks

- **React** (Next.js, Vite, Remix)
- **Styling**: Tailwind CSS, CSS Modules, plain CSS

## Development

```bash
git clone <repo-url>
cd viztweak
npm install
npm run dev      # Watch mode
npm run build    # Production build
```

## Architecture

```
viztweak/
├── src/
│   ├── browser/           # React component (client-side)
│   │   ├── index.tsx      # <VizTweak /> main component
│   │   ├── Inspector.tsx  # Element selection overlay
│   │   ├── StylePanel.tsx # Style editing panel
│   │   ├── DiffEngine.ts  # Before/after diff generator
│   │   ├── ElementResolver.ts  # DOM → component mapping
│   │   ├── StyleDetector.ts    # CSS approach detection
│   │   └── WSClient.ts   # WebSocket client
│   ├── server/            # MCP server (Node.js)
│   │   ├── index.ts       # MCP tools + stdio transport
│   │   ├── WSBridge.ts    # WebSocket server bridge
│   │   └── ChangeStore.ts # Pending changes store
│   └── shared/
│       └── types.ts       # Shared TypeScript types
└── bin/
    └── viztweak.js        # CLI entry point
```

## License

MIT
