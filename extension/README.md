# VizTweak Browser Extension

Visual UI inspector and style editor for Chrome and Edge. Select any element, tweak its styles, copy the changes to your AI coding agent.

## Quick start

```bash
cd extension
npm install
npm run build
```

Then load in your browser:

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge)
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the `extension/dist` folder

## How to use

1. Click the VizTweak icon in your browser toolbar (opens the side panel)
2. Click **Inspect**, then click any element on the page
3. Edit styles in the side panel (spacing, colors, fonts, sizes, etc.)
4. Click **Copy** to get plain-English change instructions
5. Paste into your AI agent (Copilot, Cursor, Claude Code)

## Development

```bash
npm run dev    # Watch mode - rebuilds on file changes
```

After each rebuild, go to `chrome://extensions` and click the refresh icon on the VizTweak card.

## Project structure

```
extension/
  manifest.json              Manifest V3 config
  src/
    background/index.ts      Service worker (message relay, badge, context menu)
    content/content.ts       Content script (DOM inspection, overlays, style application)
    content/content.css      Overlay styles injected into pages
    sidepanel/index.html     Side panel shell
    sidepanel/main.tsx       React entry point
    sidepanel/App.tsx        Main panel UI (style editor, layers, inspect, a11y)
    shared/messages.ts       Message types shared between all parts
  public/icons/              Extension icons
  dist/                      Built extension (load this in browser)
```

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`) | Toggle inspect mode |

You can also right-click any element and select "Inspect with VizTweak".

## Features

- Select and edit any element's styles live
- Full property editor: position, layout, spacing, size, typography, colors, borders, shadows, filters
- Undo / redo / reset all changes
- Copy formatted change instructions for AI coding agents
- Layer tree (DOM tree view)
- Accessibility audit (contrast, alt text, tap targets, form labels)
- Color vision simulation
- Dark and light theme
- Works on any website

## Privacy

- No data leaves your browser
- No accounts or API keys
- No tracking or analytics
- Changes are in-memory only (refresh to clear)
