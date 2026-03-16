// ─── Element identification ───

export interface ElementInfo {
  /** CSS selector path to the element */
  selector: string;
  /** Tag name (e.g., "button", "div") */
  tagName: string;
  /** Text content (truncated) */
  textContent: string;
  /** React component name if detected */
  componentName?: string;
  /** Class list */
  classList: string[];
  /** Detected CSS approach */
  stylingApproach: "tailwind" | "css-modules" | "plain-css" | "unknown";
}

// ─── Style changes ───

export interface StyleChange {
  property: string;
  before: string;
  after: string;
}

export interface ElementDiff {
  element: ElementInfo;
  changes: StyleChange[];
  /** Suggested Tailwind classes (if Tailwind detected) */
  suggestedTailwind?: string;
  timestamp: number;
}

// ─── WebSocket message protocol ───

export type WSMessageType =
  | "element_selected"
  | "changes_updated"
  | "changes_cleared"
  | "request_changes"
  | "request_selection"
  | "ping"
  | "pong";

export interface WSMessage {
  type: WSMessageType;
  payload?: unknown;
}

export interface ElementSelectedPayload {
  element: ElementInfo;
  computedStyles: Record<string, string>;
}

export interface ChangesUpdatedPayload {
  diffs: ElementDiff[];
}

// ─── Editable style properties ───

export const EDITABLE_PROPERTIES = {
  spacing: [
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "gap",
    "rowGap",
    "columnGap",
  ],
  sizing: ["width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight"],
  typography: [
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "color",
  ],
  border: [
    "borderRadius",
    "borderWidth",
    "borderColor",
    "borderStyle",
  ],
  background: ["backgroundColor", "opacity"],
  layout: ["display", "flexDirection", "alignItems", "justifyContent"],
} as const;

export type EditableCategory = keyof typeof EDITABLE_PROPERTIES;

export const ALL_EDITABLE_PROPERTIES = Object.values(EDITABLE_PROPERTIES).flat();

// ─── Constants ───

export const WS_PORT = 7890;
export const WS_URL = `ws://localhost:${WS_PORT}`;
