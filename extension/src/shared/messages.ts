// Message types between content script, side panel, and background worker

export type MessageType =
  | "ACTIVATE"
  | "DEACTIVATE"
  | "ELEMENT_SELECTED"
  | "APPLY_STYLE"
  | "STYLE_APPLIED"
  | "UNDO"
  | "REDO"
  | "RESET_ALL"
  | "COPY_CHANGES"
  | "CHANGES_COPIED"
  | "GET_DOM_TREE"
  | "DOM_TREE"
  | "TOGGLE_OVERLAY"
  | "OVERLAY_TOGGLED"
  | "RUN_ACCESSIBILITY"
  | "ACCESSIBILITY_RESULT"
  | "COLOR_VISION"
  | "PING"
  | "PONG";

export interface Message {
  type: MessageType;
  payload?: any;
}

// Element info passed from content script to side panel
export interface ElementInfo {
  selector: string;
  tagName: string;
  textContent: string;
  componentName: string;
  classList: string[];
  cssApproach: string;
}

export interface StyleChange {
  property: string;
  value: string;
}

export interface SelectedElementData {
  element: ElementInfo;
  computedStyles: Record<string, string>;
}

// Send message to content script in active tab
export async function sendToContent(msg: Message): Promise<any> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  return chrome.tabs.sendMessage(tab.id, msg);
}

// Send message to side panel / background
export function sendToRuntime(msg: Message): Promise<any> {
  return chrome.runtime.sendMessage(msg);
}
