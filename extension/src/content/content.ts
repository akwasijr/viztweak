// VizTweak Content Script
// Injected into every page. Handles element selection, style application, and overlays.

import type { Message, SelectedElementData, ElementInfo } from "../shared/messages";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let active = false;
let selectedEl: HTMLElement | null = null;
let highlightEl: HTMLElement | null = null;
let inspecting = false;

// Baseline styles for undo
interface Baseline { original: Record<string, string>; current: Record<string, string>; }
const baselines = new Map<HTMLElement, Baseline>();

// Undo / redo stacks (per-element)
interface UndoEntry { el: HTMLElement; prop: string; prev: string; }
const undoStack: UndoEntry[] = [];
const redoStack: UndoEntry[] = [];

// Overlays
let spacingOverlay: HTMLElement | null = null;
let gridDebugActive = false;
let gridDebugOverlay: HTMLElement | null = null;
let colorVisionFilter: string | null = null;

// ---------------------------------------------------------------------------
// Element resolution (ported from ElementResolver.ts)
// ---------------------------------------------------------------------------

function buildSelector(el: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current !== document.documentElement) {
    let tag = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        tag += `:nth-child(${idx})`;
      }
    }
    const cls = Array.from(current.classList)
      .filter(c => !c.startsWith("_") && !c.startsWith("css-") && c.length < 30)
      .slice(0, 2);
    if (cls.length) tag += `.${cls.join(".")}`;
    parts.unshift(tag);
    current = parent;
  }
  return parts.join(" > ");
}

function getDirectText(el: HTMLElement): string {
  let text = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent || "";
  }
  return text.trim().slice(0, 60);
}

function getReactComponent(el: HTMLElement): string {
  const fiberKey = Object.keys(el).find(
    k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
  );
  if (!fiberKey) return "";
  try {
    let fiber = (el as any)[fiberKey];
    for (let i = 0; i < 15 && fiber; i++) {
      if (fiber.type && typeof fiber.type === "function") {
        return fiber.type.displayName || fiber.type.name || "";
      }
      if (fiber.type?.render) {
        return fiber.type.render.displayName || fiber.type.render.name || "";
      }
      fiber = fiber.return;
    }
  } catch { /* ignore */ }
  return "";
}

function detectCssApproach(el: HTMLElement): string {
  const classes = Array.from(el.classList);
  if (classes.some(c => /^(sm|md|lg|xl|2xl)?:?[a-z]+-/.test(c))) return "tailwind";
  if (classes.some(c => /_[a-zA-Z0-9]{5,}$/.test(c))) return "css-modules";
  return "css";
}

// Editable properties
const EDITABLE_PROPS = [
  "position", "top", "left", "zIndex", "display", "flexDirection",
  "justifyContent", "alignItems", "gap", "flexWrap",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "marginTop", "marginRight", "marginBottom", "marginLeft",
  "width", "height", "opacity", "overflow", "borderRadius",
  "borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius",
  "backgroundColor", "color", "fontFamily", "fontWeight", "fontSize",
  "lineHeight", "letterSpacing", "textAlign", "textDecoration",
  "borderColor", "borderWidth", "borderStyle",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "boxShadow", "filter", "rotate",
];

function getComputedStyles(el: HTMLElement): Record<string, string> {
  const cs = getComputedStyle(el);
  const result: Record<string, string> = {};
  for (const prop of EDITABLE_PROPS) {
    result[prop] = cs.getPropertyValue(
      prop.replace(/([A-Z])/g, "-$1").toLowerCase()
    ) || (cs as any)[prop] || "";
  }
  return result;
}

function resolveElement(el: HTMLElement): SelectedElementData {
  return {
    element: {
      selector: buildSelector(el),
      tagName: el.tagName.toLowerCase(),
      textContent: getDirectText(el),
      componentName: getReactComponent(el),
      classList: Array.from(el.classList),
      cssApproach: detectCssApproach(el),
    },
    computedStyles: getComputedStyles(el),
  };
}

// ---------------------------------------------------------------------------
// Highlight overlay
// ---------------------------------------------------------------------------

function createOverlayRoot(): HTMLElement {
  let root = document.getElementById("__viztweak-overlay-root");
  if (root) return root;
  root = document.createElement("div");
  root.id = "__viztweak-overlay-root";
  root.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483646;pointer-events:none;";
  document.documentElement.appendChild(root);
  return root;
}

function showHighlight(el: HTMLElement) {
  const root = createOverlayRoot();
  if (!highlightEl) {
    highlightEl = document.createElement("div");
    highlightEl.id = "__viztweak-highlight";
    highlightEl.style.cssText = "position:fixed;pointer-events:none;border:2px solid #4A90D9;background:rgba(74,144,217,0.08);transition:all 0.1s ease;z-index:2147483646;border-radius:2px;";
    root.appendChild(highlightEl);
  }
  const r = el.getBoundingClientRect();
  highlightEl.style.top = `${r.top}px`;
  highlightEl.style.left = `${r.left}px`;
  highlightEl.style.width = `${r.width}px`;
  highlightEl.style.height = `${r.height}px`;
  highlightEl.style.display = "block";
}

function hideHighlight() {
  if (highlightEl) highlightEl.style.display = "none";
}

// ---------------------------------------------------------------------------
// Spacing overlay
// ---------------------------------------------------------------------------

function showSpacingOverlay(el: HTMLElement) {
  removeSpacingOverlay();
  const root = createOverlayRoot();
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  spacingOverlay = document.createElement("div");
  spacingOverlay.id = "__viztweak-spacing";
  spacingOverlay.style.cssText = "position:fixed;pointer-events:none;z-index:2147483645;";
  const pt = parseFloat(cs.paddingTop) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;
  const pl = parseFloat(cs.paddingLeft) || 0;
  const mt = parseFloat(cs.marginTop) || 0;
  const mr = parseFloat(cs.marginRight) || 0;
  const mb = parseFloat(cs.marginBottom) || 0;
  const ml = parseFloat(cs.marginLeft) || 0;

  // Margin boxes (orange)
  const marginColor = "rgba(255,165,0,0.25)";
  if (mt > 0) addBox(spacingOverlay, rect.left - ml, rect.top - mt, rect.width + ml + mr, mt, marginColor);
  if (mb > 0) addBox(spacingOverlay, rect.left - ml, rect.bottom, rect.width + ml + mr, mb, marginColor);
  if (ml > 0) addBox(spacingOverlay, rect.left - ml, rect.top, ml, rect.height, marginColor);
  if (mr > 0) addBox(spacingOverlay, rect.right, rect.top, mr, rect.height, marginColor);

  // Padding boxes (green)
  const padColor = "rgba(0,180,0,0.25)";
  if (pt > 0) addBox(spacingOverlay, rect.left, rect.top, rect.width, pt, padColor);
  if (pb > 0) addBox(spacingOverlay, rect.left, rect.bottom - pb, rect.width, pb, padColor);
  if (pl > 0) addBox(spacingOverlay, rect.left, rect.top + pt, pl, rect.height - pt - pb, padColor);
  if (pr > 0) addBox(spacingOverlay, rect.right - pr, rect.top + pt, pr, rect.height - pt - pb, padColor);

  root.appendChild(spacingOverlay);
}

function addBox(parent: HTMLElement, x: number, y: number, w: number, h: number, bg: string) {
  const box = document.createElement("div");
  box.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${bg};pointer-events:none;`;
  parent.appendChild(box);
}

function removeSpacingOverlay() {
  spacingOverlay?.remove();
  spacingOverlay = null;
}

// ---------------------------------------------------------------------------
// Diff engine (change tracking)
// ---------------------------------------------------------------------------

function captureBaseline(el: HTMLElement) {
  if (baselines.has(el)) return;
  const styles = getComputedStyles(el);
  baselines.set(el, { original: { ...styles }, current: { ...styles } });
}

function applyStyle(el: HTMLElement, prop: string, value: string) {
  captureBaseline(el);
  const baseline = baselines.get(el)!;
  const prevInline = el.style.getPropertyValue(prop.replace(/([A-Z])/g, "-$1").toLowerCase());

  undoStack.push({ el, prop, prev: prevInline });
  redoStack.length = 0;

  // Apply the change
  (el.style as any)[prop] = value;
  baseline.current[prop] = value;

  updateBadge();
}

function undo() {
  const entry = undoStack.pop();
  if (!entry) return;
  const cssProp = entry.prop.replace(/([A-Z])/g, "-$1").toLowerCase();
  const currentVal = entry.el.style.getPropertyValue(cssProp);
  redoStack.push({ el: entry.el, prop: entry.prop, prev: currentVal });
  if (entry.prev === "") {
    entry.el.style.removeProperty(cssProp);
  } else {
    (entry.el.style as any)[entry.prop] = entry.prev;
  }
  updateBadge();
}

function redo() {
  const entry = redoStack.pop();
  if (!entry) return;
  const cssProp = entry.prop.replace(/([A-Z])/g, "-$1").toLowerCase();
  const currentVal = entry.el.style.getPropertyValue(cssProp);
  undoStack.push({ el: entry.el, prop: entry.prop, prev: currentVal });
  if (entry.prev === "") {
    entry.el.style.removeProperty(cssProp);
  } else {
    (entry.el.style as any)[entry.prop] = entry.prev;
  }
  updateBadge();
}

function resetAll() {
  for (const [el, baseline] of baselines) {
    for (const prop of EDITABLE_PROPS) {
      const cssProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
      el.style.removeProperty(cssProp);
    }
  }
  baselines.clear();
  undoStack.length = 0;
  redoStack.length = 0;
  updateBadge();
}

function getChangeCount(): number {
  let count = 0;
  for (const [el, baseline] of baselines) {
    const cs = getComputedStyle(el);
    for (const prop of EDITABLE_PROPS) {
      const cssProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
      const original = baseline.original[prop];
      const current = cs.getPropertyValue(cssProp) || (cs as any)[prop] || "";
      if (original !== current) count++;
    }
  }
  return count;
}

function updateBadge() {
  const count = getChangeCount();
  chrome.runtime.sendMessage({ type: "BADGE_UPDATE", payload: { count } }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Format changes for copy
// ---------------------------------------------------------------------------

function formatChanges(): string {
  const sections: string[] = [];
  for (const [el, baseline] of baselines) {
    const cs = getComputedStyle(el);
    const changes: string[] = [];
    for (const prop of EDITABLE_PROPS) {
      const cssProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
      const original = baseline.original[prop];
      const current = cs.getPropertyValue(cssProp) || (cs as any)[prop] || "";
      if (original !== current) {
        changes.push(`- Change \`${cssProp}\` from \`${shorten(original)}\` to \`${shorten(current)}\``);
      }
    }
    if (changes.length === 0) continue;

    const info = resolveElement(el);
    const tag = info.element.tagName;
    const text = info.element.textContent ? ` "${info.element.textContent}"` : "";
    const comp = info.element.componentName ? ` (component: ${info.element.componentName})` : "";
    const sel = info.element.selector;
    const approach = info.element.cssApproach;

    sections.push(
      `For the <${tag}> element${text}${comp}\n` +
      `(selector: ${sel}):\n\n` +
      changes.join("\n")
    );
  }

  if (sections.length === 0) return "No changes to copy.";

  let out = "I made some visual changes in the browser using VizTweak.\nPlease update the source code to match:\n\n";
  out += sections.join("\n\n");

  // Detect styling approach
  const approaches = new Set<string>();
  for (const [el] of baselines) approaches.add(detectCssApproach(el));
  if (approaches.has("tailwind")) out += "\n\nThis project uses Tailwind CSS.";
  else if (approaches.has("css-modules")) out += "\n\nThis project uses CSS Modules.";

  return out;
}

function shorten(v: string): string {
  if (v.length <= 40) return v;
  if (v.startsWith("rgb")) {
    const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return `#${[m[1],m[2],m[3]].map(n => (+n).toString(16).padStart(2,"0")).join("")}`;
  }
  return v.slice(0, 37) + "...";
}

// ---------------------------------------------------------------------------
// DOM tree for layer panel
// ---------------------------------------------------------------------------

function buildDomTree(root: HTMLElement, depth = 0, maxDepth = 6): any[] {
  if (depth > maxDepth) return [];
  const nodes: any[] = [];
  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.id?.startsWith("__viztweak")) continue;
    const tag = child.tagName.toLowerCase();
    const id = child.id ? `#${child.id}` : "";
    const cls = Array.from(child.classList).slice(0, 2).join(".");
    nodes.push({
      tag,
      id: child.id || "",
      label: `${tag}${id}${cls ? `.${cls}` : ""}`,
      text: getDirectText(child).slice(0, 30),
      selector: buildSelector(child),
      childCount: child.children.length,
      children: buildDomTree(child, depth + 1, maxDepth),
    });
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Accessibility checker (ported from AccessibilityChecker.tsx)
// ---------------------------------------------------------------------------

function runAccessibilityCheck(el?: HTMLElement): any[] {
  const issues: any[] = [];
  const target = el || document.body;
  const elements = el ? [el] : Array.from(document.querySelectorAll("*")).filter(e => e instanceof HTMLElement) as HTMLElement[];

  for (const node of elements.slice(0, 200)) {
    const cs = getComputedStyle(node);
    // Contrast check
    const fg = cs.color;
    const bg = cs.backgroundColor;
    if (fg && bg && bg !== "rgba(0, 0, 0, 0)") {
      const ratio = getContrastRatio(parseColor(fg), parseColor(bg));
      const size = parseFloat(cs.fontSize);
      const isLarge = size >= 18 || (size >= 14 && parseInt(cs.fontWeight) >= 700);
      const minRatio = isLarge ? 3 : 4.5;
      if (ratio < minRatio) {
        issues.push({
          type: "error",
          label: "Contrast",
          detail: `${ratio.toFixed(1)}:1 needs ${minRatio}:1`,
          selector: buildSelector(node),
        });
      }
    }

    // Missing alt text
    if (node.tagName === "IMG" && !node.getAttribute("alt") && node.getAttribute("alt") !== "") {
      issues.push({ type: "error", label: "Alt text", detail: "Image missing alt attribute", selector: buildSelector(node) });
    }

    // Tap target
    if (node.matches("a, button, input, select, textarea, [role='button']")) {
      if (node.offsetParent !== null) {
        const r = node.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) {
          issues.push({ type: "warning", label: "Tap target", detail: `${Math.round(r.width)}x${Math.round(r.height)}px, min 44x44px`, selector: buildSelector(node) });
        }
      }
    }

    // Form label
    if (node.matches("input, select, textarea") && !node.matches("[type='hidden']")) {
      const id = node.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAria = node.getAttribute("aria-label") || node.getAttribute("aria-labelledby");
      if (!hasLabel && !hasAria) {
        issues.push({ type: "error", label: "Form label", detail: "Input missing label", selector: buildSelector(node) });
      }
    }
  }

  return issues;
}

// Color utilities for contrast
function parseColor(c: string): [number, number, number] {
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(fg: [number,number,number], bg: [number,number,number]): number {
  const l1 = luminance(...fg);
  const l2 = luminance(...bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onMouseMove(e: MouseEvent) {
  if (!inspecting) return;
  const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  if (!el || el.id?.startsWith("__viztweak")) return;
  showHighlight(el);
}

function onMouseClick(e: MouseEvent) {
  if (!inspecting) return;
  e.preventDefault();
  e.stopPropagation();

  const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  if (!el || el.id?.startsWith("__viztweak")) return;

  selectedEl = el;
  inspecting = false;
  showHighlight(el);
  captureBaseline(el);

  const data = resolveElement(el);
  chrome.runtime.sendMessage({ type: "ELEMENT_SELECTED", payload: data });
}

function activate() {
  active = true;
  inspecting = true;
  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onMouseClick, true);
  document.body.style.cursor = "crosshair";
}

function deactivate() {
  active = false;
  inspecting = false;
  selectedEl = null;
  document.removeEventListener("mousemove", onMouseMove, true);
  document.removeEventListener("click", onMouseClick, true);
  document.body.style.cursor = "";
  hideHighlight();
  removeSpacingOverlay();
}

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  switch (msg.type) {
    case "ACTIVATE":
      activate();
      sendResponse({ ok: true });
      break;

    case "DEACTIVATE":
      deactivate();
      sendResponse({ ok: true });
      break;

    case "APPLY_STYLE":
      if (selectedEl && msg.payload) {
        applyStyle(selectedEl, msg.payload.property, msg.payload.value);
        // Send back updated computed styles
        sendResponse({ computedStyles: getComputedStyles(selectedEl) });
      }
      break;

    case "UNDO":
      undo();
      if (selectedEl) sendResponse({ computedStyles: getComputedStyles(selectedEl) });
      else sendResponse({ ok: true });
      break;

    case "REDO":
      redo();
      if (selectedEl) sendResponse({ computedStyles: getComputedStyles(selectedEl) });
      else sendResponse({ ok: true });
      break;

    case "RESET_ALL":
      resetAll();
      sendResponse({ ok: true });
      break;

    case "COPY_CHANGES": {
      const text = formatChanges();
      sendResponse({ text });
      break;
    }

    case "GET_DOM_TREE": {
      const tree = buildDomTree(document.body);
      sendResponse({ tree });
      break;
    }

    case "TOGGLE_OVERLAY": {
      const overlay = msg.payload?.overlay;
      if (overlay === "spacing") {
        if (spacingOverlay) removeSpacingOverlay();
        else if (selectedEl) showSpacingOverlay(selectedEl);
      }
      if (overlay === "grid") {
        gridDebugActive = !gridDebugActive;
        // Grid debug would inject CSS overlay - simplified for now
      }
      sendResponse({ ok: true });
      break;
    }

    case "RUN_ACCESSIBILITY": {
      const results = runAccessibilityCheck(msg.payload?.elementOnly ? selectedEl || undefined : undefined);
      sendResponse({ issues: results });
      break;
    }

    case "COLOR_VISION": {
      const mode = msg.payload?.mode;
      if (!mode || mode === "none") {
        document.body.style.filter = "";
        colorVisionFilter = null;
      } else {
        const filters: Record<string, string> = {
          deuteranopia: "url('#viztweak-deuteranopia')",
          protanopia: "url('#viztweak-protanopia')",
          tritanopia: "url('#viztweak-tritanopia')",
          achromatopsia: "grayscale(100%)",
        };
        document.body.style.filter = filters[mode] || "";
        colorVisionFilter = mode;
        injectSVGFilters();
      }
      sendResponse({ ok: true });
      break;
    }

    case "PING":
      sendResponse({ type: "PONG", payload: { active, hasSelection: !!selectedEl } });
      break;
  }

  return true; // keep channel open for async
});

// ---------------------------------------------------------------------------
// SVG filters for color vision simulation
// ---------------------------------------------------------------------------

function injectSVGFilters() {
  if (document.getElementById("__viztweak-svg-filters")) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "__viztweak-svg-filters";
  svg.setAttribute("style", "position:absolute;width:0;height:0;");
  svg.innerHTML = `
    <defs>
      <filter id="viztweak-deuteranopia">
        <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/>
      </filter>
      <filter id="viztweak-protanopia">
        <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/>
      </filter>
      <filter id="viztweak-tritanopia">
        <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/>
      </filter>
    </defs>
  `;
  document.body.appendChild(svg);
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

console.log("[VizTweak] Content script loaded");
