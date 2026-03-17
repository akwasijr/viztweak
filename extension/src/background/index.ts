// Background service worker for VizTweak extension

// Track the last web page tab the user interacted with
let lastWebTabId: number | null = null;

// Port to the side panel for push messages
let panelPort: chrome.runtime.Port | null = null;

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && !tab.url.startsWith("chrome") && !tab.url.startsWith("edge")) {
      lastWebTabId = tabId;
    }
  } catch {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url &&
      !tab.url.startsWith("chrome") && !tab.url.startsWith("edge")) {
    lastWebTabId = tabId;
  }
});

async function getTargetTabId(): Promise<number | null> {
  if (lastWebTabId) {
    try {
      const tab = await chrome.tabs.get(lastWebTabId);
      if (tab.url && !tab.url.startsWith("chrome") && !tab.url.startsWith("edge")) {
        return lastWebTabId;
      }
    } catch {}
  }
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  for (const tab of tabs) {
    if (tab.id && tab.url && !tab.url.startsWith("chrome") && !tab.url.startsWith("edge")) {
      lastWebTabId = tab.id;
      return tab.id;
    }
  }
  const allActive = await chrome.tabs.query({ active: true });
  for (const tab of allActive) {
    if (tab.id && tab.url && !tab.url.startsWith("chrome") && !tab.url.startsWith("edge")) {
      lastWebTabId = tab.id;
      return tab.id;
    }
  }
  return null;
}

// Side panel connects via long-lived port
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "viztweak-panel") {
    panelPort = port;
    console.log("[VizTweak BG] Side panel connected");

    port.onMessage.addListener(async (msg) => {
      const tabId = await getTargetTabId();
      if (!tabId) return;

      try {
        const response = await chrome.tabs.sendMessage(tabId, msg);
        // Send response back through the port
        port.postMessage({ type: msg.type + "_RESPONSE", payload: response });
      } catch {
        port.postMessage({ type: msg.type + "_RESPONSE", payload: null });
      }

      if (msg.type === "ACTIVATE") { activeTabs.add(tabId); updateBadge(tabId); }
      if (msg.type === "DEACTIVATE") { activeTabs.delete(tabId); updateBadge(tabId); }
    });

    port.onDisconnect.addListener(() => {
      panelPort = null;
      console.log("[VizTweak BG] Side panel disconnected");
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.contextMenus.create({
    id: "viztweak-inspect",
    title: "Inspect with VizTweak",
    contexts: ["all"],
  });

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

const activeTabs = new Set<number>();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "viztweak-inspect" && tab?.id) {
    lastWebTabId = tab.id;
    await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id!, { type: "ACTIVATE" }).catch(() => {});
    }, 300);
    activeTabs.add(tab.id);
    updateBadge(tab.id);
  }
});

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
      }, 300);
      activeTabs.add(tab.id);
    }
    updateBadge(tab.id);
  }
});

// Content script push messages (ELEMENT_SELECTED etc) - forward to side panel via port
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.tab?.id) {
    lastWebTabId = sender.tab.id;

    // Forward to side panel via the persistent port
    if (panelPort) {
      try {
        panelPort.postMessage(msg);
        console.log("[VizTweak BG] Forwarded", msg.type, "to panel via port");
      } catch (e) {
        console.log("[VizTweak BG] Port forward failed:", e);
      }
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
