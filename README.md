# VizTweak

**Visual UI inspector & editor that connects to your AI coding agent.**

Select any element in the browser, tweak its styles live, then hand the changes to GitHub Copilot CLI, Cursor, Claude Code, or any MCP-compatible tool — it writes the code for you.

![VizTweak demo](https://img.shields.io/badge/version-0.9.4-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## How It Works

```
Browser (your app)                    AI Agent (Copilot CLI / Cursor)
┌──────────────────────┐              ┌──────────────────────┐
│  <VizTweak />        │  WebSocket   │  MCP Server (stdio)  │
│                      │◄────────────►│                      │
│  1. Select element   │  localhost   │  get_formatted_changes│
│  2. Tweak styles     │   :7890      │  get_selected_element │
│  3. Copy changes     │              │  clear_changes        │
└──────────────────────┘              └──────────────────────┘
```

1. **Select** — Click any element. VizTweak identifies the React component, CSS classes, and styling approach.
2. **Tweak** — Adjust spacing, colors, typography, layout, borders, shadows — all live in the browser.
3. **Apply** — Copy changes as natural-language instructions, or let your AI agent pull them via MCP.

---

## Quick Start

### 1. Install

```bash
npm install viztweak
```

### 2. Add to Your App

Drop `<VizTweak />` into your root layout. It renders via a React portal on `<html>`, completely isolated from your page styles.

**Next.js (App Router)**
```tsx
// app/layout.tsx
import { VizTweak } from "viztweak";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <VizTweak />
      </body>
    </html>
  );
}
```

**Next.js (Pages Router)**
```tsx
// pages/_app.tsx
import { VizTweak } from "viztweak";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <VizTweak />
    </>
  );
}
```

**Vite / Create React App**
```tsx
// src/main.tsx or src/App.tsx
import { VizTweak } from "viztweak";

function App() {
  return (
    <>
      <YourApp />
      <VizTweak />
    </>
  );
}
```

> **Note:** VizTweak automatically hides in production (`NODE_ENV=production`). Use `<VizTweak force />` to show it regardless.

### 3. Connect Your AI Agent

#### GitHub Copilot CLI

Add to `.copilot/config.yml` or your project's `.mcp.json`:

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

#### Cursor

Open **Settings → MCP Servers → Add**, then:
- **Name:** `viztweak`
- **Command:** `npx -y viztweak`

#### Claude Code / VS Code (Copilot)

Add to your MCP configuration:

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

### 4. Start Editing

1. Run your dev server (`npm run dev`)
2. Open your app in the browser — you'll see the VizTweak pill in the bottom-right
3. Click **Inspect** (crosshair icon) then click any element
4. Make your tweaks in the style panel
5. Either:
   - **Copy** — Click the copy button to get natural-language instructions for your AI agent
   - **MCP** — Your agent calls `get_formatted_changes` automatically

---

## Features

### Inspect & Edit
- **Element selection** with hover highlights showing tag, dimensions, and component name
- **React component detection** — walks the fiber tree to find the nearest named component
- **41 editable CSS properties** across spacing, sizing, position, typography, borders, backgrounds, layout, and effects
- **Live preview** — every change applies instantly in the browser

### Style Panel
- **Position** — top, left, position mode, z-index
- **Layout** — display, flex-direction, justify-content, align-items, gap, flex-wrap
- **Spacing** — padding and margin (top, right, bottom, left individually)
- **Sizing** — width, height
- **Typography** — font-family (with Google Fonts picker), font-size, font-weight, color, text-align, line-height, letter-spacing, text-decoration
- **Borders** — width, style, color, border-radius (all corners individually)
- **Background** — background-color, opacity
- **Effects** — box-shadow, transform

### Workflow
- **Undo / Redo** — full undo stack per selected element, clears on selection change
- **Reset all** — reverts every modified element back to its original computed styles
- **Copy changes** — generates natural-language instructions describing all changes, ready to paste into any AI chat
- **Change counter** — badge showing total number of pending property changes

### Accessibility Tools
- **Color vision simulation** — Deuteranopia, Protanopia, Tritanopia, Achromatopsia filters applied to the page (not the plugin)
- **15 element-level checks** — contrast, alt text, labels, tap targets, focus indicators, ARIA roles, heading structure, semantic HTML
- **Page-wide audit** — "Scan page" runs 10 checks across your entire document: missing alt, heading hierarchy, lang attribute, unlabeled inputs, empty links, keyboard access, contrast, tap targets, skip nav, ARIA landmarks

### Design
- **Dark / Light mode** — toggle between themes; preference saved to localStorage
- **Responsive preview** — test your page at common breakpoints (Mobile, Tablet, Desktop)
- **Spacing overlay** — visualize padding and margins on the selected element
- **Grid debugger** — overlay grid lines to check alignment
- **Page-level selection** — select the `<body>` to edit page-wide styles; inapplicable fields grey out

### Integration
- **MCP protocol** — stdio-based server exposes tools to any MCP client
- **WebSocket bridge** — browser ↔ server communication on `localhost:7890`
- **Auto-reconnect** — WebSocket reconnects with exponential backoff (1s → 10s)
- **Chat** — send messages from the browser panel to your AI agent via MCP
- **Works offline** — all features work without the MCP server; only agent integration requires WebSocket

---

## MCP Tools Reference

| Tool | Description |
|------|-------------|
| `check_for_updates` | Check for new visual changes or designer messages (poll this) |
| `get_formatted_changes` | All pending visual changes as structured markdown with before/after values |
| `get_selected_element` | Info about the currently selected element (tag, component, classes, selector) |
| `clear_changes` | Clear all pending changes after applying them in code |
| `get_designer_messages` | Get unread chat messages from the designer in the browser |
| `acknowledge_messages` | Mark messages as read (by ID or all) |

### What Your Agent Sees

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
| padding-left  | 24px      | 32px      |
| border-radius | 8px       | 12px      |
| font-size     | 14px      | 16px      |
```

### Copy Button Output (Natural Language)

When you click the **Copy** button, VizTweak generates AI-friendly instructions:

```
I made some visual changes in the browser using VizTweak. Please update
the source code to match:

For the <button> element "Get Started" (component: HeroSection,
selector: section > div > button.btn-primary, classes: btn-primary
px-6 py-3 rounded-lg bg-blue-600):

- Change `padding-left` from `24px` to `32px`
- Change `border-radius` from `8px` to `12px`
- Change `font-size` from `14px` to `16px`

This project uses Tailwind CSS.
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` | Toggle inspect mode |
| Click (inspect mode) | Select an element |
| `Escape` | Close panel / deselect |

---

## Plugin Isolation

VizTweak is designed to never interfere with your page:

- **Portal on `<html>`** — the plugin renders as a sibling of `<body>`, not inside it. Body-level style changes don't cascade into VizTweak.
- **CSS isolation** — all inherited properties (`font-family`, `font-weight`, `color`, `line-height`, etc.) are reset with `!important` on the portal container.
- **Color vision filters** target `<body>` only, so the plugin UI stays unaffected.
- **Z-index** — the portal uses `z-index: 2147483647` to stay on top.

---

## Supported Frameworks

| Framework | Status |
|-----------|--------|
| Next.js (App Router) | ✅ Fully supported |
| Next.js (Pages Router) | ✅ Fully supported |
| Vite + React | ✅ Fully supported |
| Create React App | ✅ Fully supported |
| Remix | ✅ Should work (untested) |

| Styling | Status |
|---------|--------|
| Tailwind CSS | ✅ Detected + suggestions |
| CSS Modules | ✅ Detected |
| Plain CSS | ✅ Detected |
| styled-components | 🔲 Planned |

---

## Development

```bash
git clone https://github.com/akwasijr/viztweak.git
cd viztweak
npm install
npm run build    # Production build
npm run dev      # Watch mode (rebuilds on save)
npm run typecheck # TypeScript type checking
```

### Testing with a Local App

```bash
# In your test app directory:
npm install ../viztweak

# Or use npm link:
cd viztweak && npm link
cd ../your-app && npm link viztweak
```

---

## Architecture

```
viztweak/
├── src/
│   ├── browser/                  # React component (runs in the browser)
│   │   ├── index.tsx             # <VizTweak /> — portal, toolbar, tabs, undo/redo
│   │   ├── Inspector.tsx         # Hover overlay + click-to-select
│   │   ├── StylePanel.tsx        # Property editor (41 CSS properties)
│   │   ├── DiffEngine.ts         # Baseline capture + change diffing
│   │   ├── AccessibilityChecker.tsx  # Element + page-wide a11y audits
│   │   ├── ElementResolver.ts    # DOM → React component mapping
│   │   ├── StyleDetector.ts      # Tailwind / CSS Modules / plain CSS detection
│   │   ├── ResponsivePreview.tsx # Viewport simulation
│   │   ├── WSClient.ts           # WebSocket client with auto-reconnect
│   │   └── theme.ts              # Dark/light theme tokens + portal isolation CSS
│   ├── server/                   # MCP server (runs in Node.js via stdio)
│   │   ├── index.ts              # MCP tools + stdio transport
│   │   ├── WSBridge.ts           # WebSocket server (port 7890)
│   │   └── ChangeStore.ts        # In-memory change + message store
│   └── shared/
│       └── types.ts              # Shared types + ALL_EDITABLE_PROPERTIES list
├── bin/
│   └── viztweak.js               # CLI entry (`npx viztweak` starts MCP server)
├── tsup.config.ts                # Build config (browser CJS+ESM, server ESM)
└── package.json
```

---

## Privacy

- **No telemetry** — VizTweak sends no data anywhere. All communication is local (`localhost:7890`).
- **No persistence** — style changes, chat messages, and undo history are held in memory only. Nothing is written to disk.
- **No external requests** — the only network calls are to Google Fonts (when using the font picker) and the local WebSocket bridge.

---

## License

MIT — see [LICENSE](LICENSE) for details.
