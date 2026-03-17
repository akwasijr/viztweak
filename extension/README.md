# VizTweak Browser Extension

Visual UI inspector and style editor for Chrome and Edge. Select any element, tweak its styles, copy the changes to your AI coding agent.

## Build and package

```bash
cd extension
npm install
npm run build      # Builds to dist/
npm run package    # Builds + creates viztweak-extension.zip
```

**Load locally** (for development):
1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge)
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension/dist` folder

## Publish to stores

### Chrome Web Store
1. Run `npm run package` to create `viztweak-extension.zip`
2. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay the one-time $5 registration fee (if you haven't)
4. Click **New Item**, upload `viztweak-extension.zip`
5. Fill in the listing: description, screenshots, category (Developer Tools)
6. Submit for review (usually 1-3 business days)

### Microsoft Edge Add-ons
1. Same `viztweak-extension.zip` works for Edge (both use Manifest V3)
2. Go to [Edge Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview)
3. Sign in with a Microsoft account (free)
4. Click **Create new extension**, upload the zip
5. Fill in the listing details
6. Submit for review

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
