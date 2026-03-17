// Background service worker for VizTweak extension

chrome.runtime.onInstalled.addListener(() => {
  // Set side panel behavior: open on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Context menu
  chrome.contextMenus.create({
    id: "viztweak-inspect",
    title: "Inspect with VizTweak",
    contexts: ["all"],
  });
});

// Track which tabs have VizTweak active
const activeTabs = new Set<number>();

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "viztweak-inspect" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE" });
    activeTabs.add(tab.id);
    updateBadge(tab.id);
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-inspect" && tab?.id) {
    if (activeTabs.has(tab.id)) {
      chrome.tabs.sendMessage(tab.id, { type: "DEACTIVATE" });
      activeTabs.delete(tab.id);
    } else {
      chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE" });
      activeTabs.add(tab.id);
    }
    updateBadge(tab.id);
  }
});

// Relay messages between side panel and content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Messages from content script (has sender.tab)
  if (sender.tab?.id) {
    if (msg.type === "ELEMENT_SELECTED" || msg.type === "STYLE_APPLIED" ||
        msg.type === "DOM_TREE" || msg.type === "ACCESSIBILITY_RESULT" ||
        msg.type === "CHANGES_COPIED" || msg.type === "PONG") {
      // Forward to side panel by broadcasting to runtime
      chrome.runtime.sendMessage(msg).catch(() => {
        // Side panel might not be open yet
      });
    }
    if (msg.type === "BADGE_UPDATE") {
      chrome.action.setBadgeText({
        text: msg.payload?.count > 0 ? String(msg.payload.count) : "",
        tabId: sender.tab.id,
      });
      chrome.action.setBadgeBackgroundColor({ color: "#4A90D9", tabId: sender.tab.id });
    }
    return false;
  }

  // Messages from side panel (no sender.tab) - forward to active tab's content script
  if (msg.type === "ACTIVATE" || msg.type === "DEACTIVATE" ||
      msg.type === "APPLY_STYLE" || msg.type === "UNDO" || msg.type === "REDO" ||
      msg.type === "RESET_ALL" || msg.type === "COPY_CHANGES" ||
      msg.type === "GET_DOM_TREE" || msg.type === "TOGGLE_OVERLAY" ||
      msg.type === "RUN_ACCESSIBILITY" || msg.type === "COLOR_VISION" ||
      msg.type === "PING") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, msg).then((response) => {
          sendResponse(response);
        }).catch(() => sendResponse(null));

        if (msg.type === "ACTIVATE") activeTabs.add(tab.id);
        if (msg.type === "DEACTIVATE") activeTabs.delete(tab.id);
        updateBadge(tab.id);
      }
    });
    return true; // async response
  }

  return false;
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

function updateBadge(tabId: number) {
  if (activeTabs.has(tabId)) {
    chrome.action.setBadgeText({ text: "ON", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#22C55E", tabId });
  } else {
    chrome.action.setBadgeText({ text: "", tabId });
  }
}
