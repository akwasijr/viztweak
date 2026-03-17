// Background service worker for VizTweak extension

// Track the last web page tab the user interacted with
let lastWebTabId: number | null = null;

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && !tab.url.startsWith("chrome") && !tab.url.startsWith("edge")) {
      lastWebTabId = tabId;
    }
  } catch {}
});

// Also track when a tab is updated (navigated)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url &&
      !tab.url.startsWith("chrome") && !tab.url.startsWith("edge")) {
    lastWebTabId = tabId;
  }
});

// Helper to find the web page tab to send messages to
async function getTargetTabId(): Promise<number | null> {
  // First try the tracked tab
  if (lastWebTabId) {
    try {
      const tab = await chrome.tabs.get(lastWebTabId);
      if (tab.url && !tab.url.startsWith("chrome") && !tab.url.startsWith("edge")) {
        return lastWebTabId;
      }
    } catch {}
  }
  // Fallback: query for last focused window's active tab
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  for (const tab of tabs) {
    if (tab.id && tab.url && !tab.url.startsWith("chrome") && !tab.url.startsWith("edge")) {
      lastWebTabId = tab.id;
      return tab.id;
    }
  }
  // Final fallback: any active tab
  const allActive = await chrome.tabs.query({ active: true });
  for (const tab of allActive) {
    if (tab.id && tab.url && !tab.url.startsWith("chrome") && !tab.url.startsWith("edge")) {
      lastWebTabId = tab.id;
      return tab.id;
    }
  }
  return null;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.contextMenus.create({
    id: "viztweak-inspect",
    title: "Inspect with VizTweak",
    contexts: ["all"],
  });

  // Inject content script into all existing tabs
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith("chrome") && !tab.url.startsWith("edge") && !tab.url.startsWith("about:")) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        }).catch(() => {});
        chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content.css"],
        }).catch(() => {});
      }
    }
  });
});

// Track active inspect state per tab
const activeTabs = new Set<number>();

// Context menu - open side panel and activate
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "viztweak-inspect" && tab?.id) {
    lastWebTabId = tab.id;
    await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    // Small delay to let content script load if just injected
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id!, { type: "ACTIVATE" }).catch(() => {});
    }, 200);
    activeTabs.add(tab.id);
    updateBadge(tab.id);
  }
});

// Keyboard shortcut
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "toggle-inspect" && tab?.id) {
    lastWebTabId = tab.id;
    if (activeTabs.has(tab.id)) {
      chrome.tabs.sendMessage(tab.id, { type: "DEACTIVATE" }).catch(() => {});
      activeTabs.delete(tab.id);
    } else {
      await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id!, { type: "ACTIVATE" }).catch(() => {});
      }, 200);
      activeTabs.add(tab.id);
    }
    updateBadge(tab.id);
  }
});

// Message relay between side panel and content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Messages FROM content script (has sender.tab) - forward to side panel
  if (sender.tab?.id) {
    lastWebTabId = sender.tab.id;

    if (msg.type === "ELEMENT_SELECTED" || msg.type === "STYLE_APPLIED" ||
        msg.type === "DOM_TREE" || msg.type === "ACCESSIBILITY_RESULT" ||
        msg.type === "CHANGES_COPIED" || msg.type === "PONG") {
      chrome.runtime.sendMessage(msg).catch(() => {});
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

  // Messages FROM side panel (no sender.tab) - forward to content script
  const panelMessages = [
    "ACTIVATE", "DEACTIVATE", "APPLY_STYLE", "UNDO", "REDO",
    "RESET_ALL", "COPY_CHANGES", "GET_DOM_TREE", "TOGGLE_OVERLAY",
    "RUN_ACCESSIBILITY", "COLOR_VISION", "PING",
  ];

  if (panelMessages.includes(msg.type)) {
    getTargetTabId().then((tabId) => {
      if (!tabId) {
        sendResponse(null);
        return;
      }
      chrome.tabs.sendMessage(tabId, msg).then((response) => {
        sendResponse(response);
      }).catch(() => {
        sendResponse(null);
      });

      if (msg.type === "ACTIVATE") { activeTabs.add(tabId); updateBadge(tabId); }
      if (msg.type === "DEACTIVATE") { activeTabs.delete(tabId); updateBadge(tabId); }
    });
    return true; // async sendResponse
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
  if (lastWebTabId === tabId) lastWebTabId = null;
});

function updateBadge(tabId: number) {
  if (activeTabs.has(tabId)) {
    chrome.action.setBadgeText({ text: "ON", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#22C55E", tabId });
  } else {
    chrome.action.setBadgeText({ text: "", tabId });
  }
}
