# VizTweak

**Tweak any UI in the browser. Copy the changes to your AI coding agent.**

A visual inspector that lives inside your React app. Select elements, adjust styles live, then paste the changes into Copilot, Cursor, or Claude Code. It writes the code for you.

![version](https://img.shields.io/badge/version-0.9.5-blue) ![license](https://img.shields.io/badge/license-MIT-green)

---

## Setup (2 steps)

### 1. Install and add to your app

```bash
npm install viztweak
```

Then drop it into your layout, one line:

```tsx
import { VizTweak } from "viztweak";

// Add anywhere in your component tree
<VizTweak />
```

<details>
<summary>Full examples for Next.js, Vite, CRA</summary>

**Next.js (App Router)** `app/layout.tsx`
```tsx
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

**Next.js (Pages Router)** `pages/_app.tsx`
```tsx
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

**Vite / CRA** `src/App.tsx`
```tsx
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
</details>

> VizTweak hides automatically in production. Use `<VizTweak force />` to show it anyway.

### 2. Connect your AI agent (optional)

This lets your agent pull changes directly instead of copy/paste. Add to your project's MCP config:

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

| Tool | Where to add it |
|------|----------------|
| **GitHub Copilot CLI** | `.copilot/config.yml` or `.mcp.json` |
| **Cursor** | Settings → MCP Servers → Add |
| **Claude Code** | MCP configuration file |
| **VS Code Copilot** | `.vscode/mcp.json` |

---

## How to use it

1. Open your app in the browser. You'll see a small pill in the bottom-right
2. Click the **crosshair** icon, then click any element on your page
3. Adjust styles in the panel (spacing, colors, fonts, sizes, shadows, etc.)
4. Click **Copy**. VizTweak generates plain-English instructions
5. Paste into your AI agent's chat. It makes the code changes

That's it. No build step, no config files, no accounts.

---

## What you can edit

| Section | Properties |
|---------|-----------|
| **Position** | position type, top, left, z-index, rotation |
| **Layout** | display, flex direction, justify, align, gap, wrap |
| **Spacing** | padding (all sides), margin (all sides, including negative) |
| **Size** | width, height with units (px, %, vh, vw, em, rem, auto) |
| **Typography** | font family (Google Fonts picker), weight, size, line-height, letter-spacing, text-align, text-decoration, color |
| **Appearance** | opacity, overflow, border-radius (all corners) |
| **Fill** | background color with opacity + visibility toggle |
| **Border** | color, width, style (solid/dashed/dotted) |
| **Shadow** | X/Y offset, blur, spread, color with opacity |
| **Filters** | blur, brightness, contrast, saturate, grayscale |

## Other tools

- **Undo / Redo / Reset** full undo stack, reset all changes at once
- **Dark / Light mode** toggle the plugin theme
- **Responsive preview** test at mobile, tablet, desktop widths
- **Spacing overlay** visualize padding and margins
- **Grid debugger** overlay grid lines for alignment
- **Accessibility checker** 15 element-level checks + full page audit
- **Color vision simulation** preview for deuteranopia, protanopia, tritanopia, achromatopsia

---

## What your AI agent receives

When you click **Copy**, VizTweak generates this:

```
I made some visual changes in the browser using VizTweak.
Please update the source code to match:

For the <button> element "Get Started" (component: HeroSection,
selector: section > div > button.btn-primary):

- Change `padding-left` from `24px` to `32px`
- Change `border-radius` from `8px` to `12px`
- Change `font-size` from `14px` to `16px`

This project uses Tailwind CSS.
```

If you connected the MCP server (step 2), your agent can also pull changes automatically via `get_formatted_changes`.

---

## MCP tools

| Tool | What it does |
|------|-------------|
| `check_for_updates` | Poll for new changes or messages |
| `get_formatted_changes` | Get all visual changes as structured markdown |
| `get_selected_element` | Get info about the currently selected element |
| `clear_changes` | Clear changes after applying them in code |

<details>
<summary>🧪 Experimental: Chat (designer messages)</summary>

The Chat tab lets you type messages to your AI agent directly from the browser panel. Your agent can read them via:

| Tool | What it does |
|------|-------------|
| `get_designer_messages` | Get unread messages from the designer |
| `acknowledge_messages` | Mark messages as read |

This feature requires the MCP server to be running. It's experimental and may change in future versions.
</details>

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` | Toggle inspect mode |
| Click (inspect) | Select element |
| `Escape` | Close / deselect |

---

## Works with

| Framework | Status |
|-----------|--------|
| Next.js | ✅ |
| Vite + React | ✅ |
| Create React App | ✅ |
| Remix | ✅ (untested) |

| Styling | Status |
|---------|--------|
| Tailwind CSS | ✅ Detected |
| CSS Modules | ✅ Detected |
| Plain CSS | ✅ Detected |
| styled-components | Planned |

---

## Privacy

- **No telemetry.** Nothing leaves your machine
- **No accounts.** No sign-up, no API keys
- **No persistence.** All changes are in-memory only
- **Runs locally.** Everything stays on your dev server

---

## Contributing

```bash
git clone https://github.com/akwasijr/viztweak.git
cd viztweak
npm install
npm run dev      # Watch mode
npm run build    # Production build
```

## License

MIT
