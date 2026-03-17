import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { Inspector } from "./Inspector.js";
import { StylePanel } from "./StylePanel.js";
import { LayerTree } from "./LayerTree.js";
import { StateSelector, type PseudoState } from "./StateSelector.js";
import { DiffEngine } from "./DiffEngine.js";
import { WSClient } from "./WSClient.js";
import { resolveElement } from "./ElementResolver.js";
import { ALL_EDITABLE_PROPERTIES } from "../shared/types.js";
import type { ElementInfo, AgentStatusPayload } from "../shared/types.js";
import { injectTheme, THEME_ATTR, THEME_MODE_ATTR, getStoredTheme, setStoredTheme, type ThemeMode } from "./theme.js";
import { SpacingOverlay } from "./SpacingOverlay.js";
import { AccessibilityChecker } from "./AccessibilityChecker.js";
import { ResponsivePreview } from "./ResponsivePreview.js";
import { ClassEditor } from "./ClassEditor.js";
import { CSSVarInspector } from "./CSSVarInspector.js";
import { TokenExtractor } from "./TokenExtractor.js";
import { ColorPalette } from "./ColorPalette.js";
import { GridFlexDebugger } from "./GridFlexDebugger.js";
import { DiffReporter } from "./DiffReporter.js";
import { IconInspect, IconClose, IconSend, IconDesign, IconLayers, IconBoxModel, IconResponsive, IconUndo, IconRedo, IconReset, IconCopy, IconPanelLeft, IconPanelRight, IconLayoutGrid, IconCode, IconChat, IconPalette, IconSpacing, IconType, IconState, IconAccessibility, IconCornerRadius, IconFrame, IconSun, IconMoon, IconSpacingOverlay, IconGridOverlay } from "./icons.js";

// ─── Types ────────────────────────────────────────────────────

type PanelTab = "design" | "layers" | "inspect" | "chat";
type PanelSide = "left" | "right";

interface ChatMessage {
  id: string;
  text: string;
  from: "designer" | "agent";
  type?: "info" | "success" | "error" | "thinking";
  timestamp: number;
}

interface UndoEntry {
  element: HTMLElement;
  property: string;
  previousValue: string;
}

// ─── Public API ───────────────────────────────────────────────

interface VizTweakProps {
  force?: boolean;
}

export function VizTweak({ force = false }: VizTweakProps) {
  if (!force && process.env.NODE_ENV === "production") {
    return null;
  }
  return <VizTweakInner />;
}

// ─── Inner component ──────────────────────────────────────────

function VizTweakInner() {
  const [inspecting, setInspecting] = useState(false);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [elementInfo, setElementInfo] = useState<ElementInfo | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [activeTab, setActiveTab] = useState<PanelTab>("design");
  const [panelSide, setPanelSide] = useState<PanelSide>("right");
  const [pseudoState, setPseudoState] = useState<PseudoState>("default");
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const [showSpacingOverlay, setShowSpacingOverlay] = useState(false);
  const [showResponsive, setShowResponsive] = useState(false);
  const [showLayoutDebugger, setShowLayoutDebugger] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [colorBlindMode, setColorBlindMode] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredTheme);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const diffEngine = useMemo(() => new DiffEngine(), []);
  const wsClient = useMemo(() => new WSClient(), []);

  // Create a portal container on document.documentElement (NOT body) so VizTweak
  // is a sibling of <body>, fully isolated from body/page style changes and filters
  useEffect(() => {
    let container = document.getElementById("viztweak-portal") as HTMLDivElement | null;
    if (!container) {
      container = document.createElement("div");
      container.id = "viztweak-portal";
      container.setAttribute("data-viztweak", "");
      container.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483640;pointer-events:none;";
      document.documentElement.appendChild(container);
    }
    portalRef.current = container;
    return () => {
      // Don't remove on unmount — may remount in dev mode
    };
  }, []);

  // Inject theme on mount
  useEffect(() => {
    injectTheme();
  }, []);

  // Toggle theme on all viztweak elements
  const handleToggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      setStoredTheme(next);
      document.querySelectorAll(`[${THEME_ATTR}]`).forEach((el) => {
        (el as HTMLElement).setAttribute(THEME_MODE_ATTR, next);
      });
      return next;
    });
  }, []);

  // Track selected element bounding rect for on-screen highlight
  useEffect(() => {
    if (!selectedElement) {
      setSelectionRect(null);
      return;
    }
    const update = () => setSelectionRect(selectedElement.getBoundingClientRect());
    update();
    const raf = { id: 0 };
    const loop = () => { update(); raf.id = requestAnimationFrame(loop); };
    raf.id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.id);
  }, [selectedElement]);

  // Connect WebSocket
  useEffect(() => {
    wsClient.connect();
    const offConnect = wsClient.on("_connected", () => setWsConnected(true));
    const offDisconnect = wsClient.on("_disconnected", () => setWsConnected(false));
    const offClear = wsClient.on("changes_cleared", () => {
      diffEngine.clearAll();
    });
    const offAgentStatus = wsClient.on("agent_status", (payload: unknown) => {
      const p = payload as AgentStatusPayload;
      setMessages((prev) => [
        ...prev,
        {
          id: "agent-" + Date.now(),
          text: p.text,
          from: "agent",
          type: p.type,
          timestamp: Date.now(),
        },
      ]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      offConnect();
      offDisconnect();
      offClear();
      offAgentStatus();
      wsClient.disconnect();
    };
  }, [wsClient, diffEngine]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Apply color vision simulation filter to <body> (not <html>)
  // Portal lives on <html> as a sibling of <body>, so body filters won't affect it
  useEffect(() => {
    const body = document.body;
    if (!colorBlindMode) {
      body.style.removeProperty("filter");
      return;
    }
    const filterMap: Record<string, string> = {
      deuteranopia: "url(#vt-deuteranopia)",
      protanopia: "url(#vt-protanopia)",
      tritanopia: "url(#vt-tritanopia)",
      monochromacy: "saturate(0)",
    };
    body.style.setProperty("filter", filterMap[colorBlindMode] || "");
    return () => { body.style.removeProperty("filter"); };
  }, [colorBlindMode]);

  // Handle element selection (from inspector or layer tree)
  const handleSelect = useCallback(
    (el: HTMLElement) => {
      diffEngine.captureBaseline(el, ALL_EDITABLE_PROPERTIES);
      setSelectedElement(el);
      setElementInfo(resolveElement(el));
      setInspecting(false);
      setPseudoState("default");
      // Clear undo/redo — stacks are per-element, not global
      setUndoStack([]);
      setRedoStack([]);
    },
    [diffEngine],
  );

  const handleSelectPage = useCallback(() => {
    handleSelect(document.body);
  }, [handleSelect]);

  const handleClose = useCallback(() => {
    setSelectedElement(null);
    setElementInfo(null);
    setPseudoState("default");
  }, []);

  // ─── Quick Actions ────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    const cssName = entry.property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const currentValue = entry.element.style.getPropertyValue(cssName);
    setRedoStack((prev) => [...prev, { ...entry, previousValue: currentValue }]);
    // If previous value was empty, remove the inline override entirely
    if (!entry.previousValue) {
      entry.element.style.removeProperty(cssName);
    } else {
      entry.element.style.setProperty(cssName, entry.previousValue);
    }
    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    const cssName = entry.property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const currentValue = entry.element.style.getPropertyValue(cssName);
    setUndoStack((prev) => [...prev, { ...entry, previousValue: currentValue }]);
    if (!entry.previousValue) {
      entry.element.style.removeProperty(cssName);
    } else {
      entry.element.style.setProperty(cssName, entry.previousValue);
    }
    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack]);

  const handleReset = useCallback(() => {
    // Reset ALL tracked elements to their baselines, not just the selected one
    const count = diffEngine.resetAll(ALL_EDITABLE_PROPERTIES);
    setUndoStack([]);
    setRedoStack([]);
    if (selectedElement) {
      setElementInfo(resolveElement(selectedElement));
    }
  }, [selectedElement, diffEngine]);

  // Copy all visual changes to clipboard as formatted markdown
  const [copyFeedback, setCopyFeedback] = useState(false);
  const handleCopyChanges = useCallback(() => {
    const text = diffEngine.formatAllChangesText();
    const showFeedback = () => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    };
    navigator.clipboard.writeText(text).then(showFeedback).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showFeedback();
    });
  }, [diffEngine]);

  // Push undo entry from StylePanel's apply()
  const handlePushUndo = useCallback((entry: { element: HTMLElement; property: string; previousValue: string }) => {
    setUndoStack((prev) => [...prev, entry]);
    setRedoStack([]);
  }, []);

  // Track change count for badge display
  const [changeCount, setChangeCount] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setChangeCount(diffEngine.getChangeCount());
    }, 500);
    return () => clearInterval(interval);
  }, [diffEngine]);

  const handleToggleSide = useCallback(() => {
    setPanelSide((prev) => (prev === "right" ? "left" : "right"));
  }, []);

  // Send chat message
  const handleSendMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    const msg: ChatMessage = {
      id: "designer-" + Date.now(),
      text,
      from: "designer",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    setChatInput("");
    wsClient.send({
      type: "designer_message",
      payload: { id: msg.id, text: msg.text, timestamp: msg.timestamp },
    });
  }, [chatInput, wsClient]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "V") {
        e.preventDefault();
        if (selectedElement) {
          handleClose();
        } else {
          setInspecting((prev) => !prev);
        }
      }
      if (e.key === "v" && !e.ctrlKey && !e.metaKey && !e.altKey && !selectedElement) {
        setInspecting(true);
      }
      if (e.key === "Escape") {
        if (selectedElement) {
          handleClose();
        } else if (inspecting) {
          setInspecting(false);
        }
      }
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey && selectedElement) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z" && selectedElement) {
        e.preventDefault();
        handleRedo();
      }
      // Tab switch: 1 = Design, 2 = Layers, 3 = Inspect
      if (e.key === "1" && !e.ctrlKey && !e.metaKey && selectedElement) {
        setActiveTab("design");
      }
      if (e.key === "2" && !e.ctrlKey && !e.metaKey && selectedElement) {
        setActiveTab("layers");
      }
      if (e.key === "3" && !e.ctrlKey && !e.metaKey && selectedElement) {
        setActiveTab("inspect");
      }
      if (e.key === "4" && !e.ctrlKey && !e.metaKey && selectedElement) {
        setActiveTab("chat");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [inspecting, selectedElement, handleClose, handleUndo, handleRedo]);

  // Format time
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return h + ":" + m;
  };

  // Panel is open when we have a selected element
  const panelOpen = selectedElement !== null && elementInfo !== null;

  // Compute panel position styles
  const panelPositionStyle: React.CSSProperties = {
    position: "fixed",
    top: "var(--vt-panel-margin)",
    [panelSide]: "var(--vt-panel-margin)",
    width: "var(--vt-panel-width)",
    height: "calc(100vh - var(--vt-panel-margin) * 2 - 56px)",
    background: "var(--vt-panel-bg)",
    border: "1px solid var(--vt-border)",
    borderRadius: "var(--vt-panel-radius)",
    boxShadow: "var(--vt-shadow-panel)",
    zIndex: 2147483646,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  if (!portalRef.current) return null;

  return createPortal(
    <div style={{ pointerEvents: "auto" }}>
      {/* Inspector overlay */}
      <Inspector
        active={inspecting}
        onSelect={handleSelect}
        ignoreRefs={[panelRef, toggleRef]}
      />

      {/* Selection highlight — persistent blue outline on selected element */}
      {selectionRect && !inspecting && (
        <div
          data-viztweak=""
          style={{
            position: "fixed",
            top: selectionRect.top,
            left: selectionRect.left,
            width: selectionRect.width,
            height: selectionRect.height,
            border: "1.5px solid #0C8CE9",
            borderRadius: 0,
            pointerEvents: "none",
            zIndex: 2147483644,
            boxShadow: "0 0 0 1px rgba(12,140,233,0.15)",
          }}
        />
      )}

      {/* Spacing overlay */}
      <SpacingOverlay element={selectedElement} visible={showSpacingOverlay} />

      {/* Grid/Flex layout debugger overlay */}
      <GridFlexDebugger active={showLayoutDebugger} />

      {/* Responsive preview bar */}
      <ResponsivePreview active={showResponsive} onToggle={() => setShowResponsive(false)} themeMode={themeMode} />

      {/* Floating sidebar panel */}
      {panelOpen && (
        <div
          ref={panelRef}
          data-viztweak=""
          {...{ [THEME_MODE_ATTR]: themeMode }}
          style={panelPositionStyle}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* ─── Panel header ─── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 8px 0 12px",
              height: "36px",
              borderBottom: "1px solid var(--vt-border)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
              <span
                style={{
                  fontSize: "var(--vt-font-size-section)",
                  fontWeight: 600,
                  color: "var(--vt-text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {"<" + elementInfo.tagName + ">"}
              </span>
              {elementInfo.componentName && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--vt-accent)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {elementInfo.componentName}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "9px",
                  color: "var(--vt-text-disabled)",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: wsConnected ? "#15B467" : "#C4C4C4",
                  flexShrink: 0,
                }} />
                {wsConnected ? "Agent" : "Offline"}
              </span>
              <button
                onClick={handleToggleTheme}
                title={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--vt-text-secondary)",
                  borderRadius: "var(--vt-input-radius)",
                  padding: 0,
                  flexShrink: 0,
                }}
                aria-label="Toggle theme"
              >
                {themeMode === "dark" ? <IconSun size={13} /> : <IconMoon size={13} />}
              </button>
              <button
                onClick={handleClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--vt-text-secondary)",
                  borderRadius: "var(--vt-input-radius)",
                  padding: 0,
                  flexShrink: 0,
                }}
                aria-label="Close panel"
              >
                <IconClose size={14} />
              </button>
            </div>
          </div>

          {/* ─── Tab Switcher (Design / Layers / Inspect) ─── */}
          <TabSwitcher activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); if (tab === "chat") setUnreadCount(0); }} connected={wsConnected} unreadCount={unreadCount} />

          {/* ─── State Selector (Design tab only) ─── */}
          {activeTab === "design" && (
            <>
              <StateSelector
                value={pseudoState}
                onChange={setPseudoState}
                element={selectedElement}
              />
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0, margin: "2px 0" }} />
            </>
          )}

          {/* ─── Tab Content ─── */}
          {activeTab === "design" ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto" }}>
              <StylePanel
                element={selectedElement}
                elementInfo={elementInfo}
                diffEngine={diffEngine}
                wsClient={wsClient}
                onClose={handleClose}
                onPushUndo={handlePushUndo}
              />
            </div>
          ) : activeTab === "inspect" ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto" }}>
              {/* ─── Overlays section ─── */}
              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--vt-text-primary)" }}>Overlays</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => setShowSpacingOverlay((p) => !p)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 8px",
                      fontSize: "11px",
                      fontFamily: "var(--vt-font)",
                      color: showSpacingOverlay ? "var(--vt-accent)" : "var(--vt-text-secondary)",
                      background: showSpacingOverlay ? "var(--vt-accent-bg)" : "var(--vt-input-bg)",
                      border: "1px solid " + (showSpacingOverlay ? "var(--vt-accent)" : "var(--vt-input-border)"),
                      borderRadius: "var(--vt-input-radius)",
                      cursor: "pointer",
                    }}
                  >
                    <IconSpacingOverlay size={13} /> Spacing
                  </button>
                  <button
                    onClick={() => setShowLayoutDebugger((p) => !p)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 8px",
                      fontSize: "11px",
                      fontFamily: "var(--vt-font)",
                      color: showLayoutDebugger ? "var(--vt-accent)" : "var(--vt-text-secondary)",
                      background: showLayoutDebugger ? "var(--vt-accent-bg)" : "var(--vt-input-bg)",
                      border: "1px solid " + (showLayoutDebugger ? "var(--vt-accent)" : "var(--vt-input-border)"),
                      borderRadius: "var(--vt-input-radius)",
                      cursor: "pointer",
                    }}
                  >
                    <IconGridOverlay size={13} /> Grid
                  </button>
                </div>
              </div>
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0, margin: "2px 0" }} />

              {/* ─── Vision Simulation section ─── */}
              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--vt-text-primary)" }}>Vision Simulation</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {COLOR_VISION_MODES.map((mode) => {
                    const isActive = colorBlindMode === mode.id;
                    return (
                      <button
                        key={mode.id ?? "normal"}
                        onClick={() => setColorBlindMode(mode.id)}
                        style={{
                          fontSize: "10px",
                          fontFamily: "var(--vt-font)",
                          padding: "4px 8px",
                          borderRadius: "var(--vt-input-radius)",
                          border: "1px solid " + (isActive ? "var(--vt-accent)" : "var(--vt-input-border)"),
                          cursor: "pointer",
                          background: isActive ? "var(--vt-accent-bg)" : "var(--vt-input-bg)",
                          color: isActive ? "var(--vt-accent)" : "var(--vt-text-secondary)",
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0, margin: "2px 0" }} />

              <ClassEditor element={selectedElement} />
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0, margin: "2px 0" }} />
              <TokenExtractor element={selectedElement} />
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0, margin: "2px 0" }} />
              <DiffReporter diffEngine={diffEngine} />
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0, margin: "2px 0" }} />
              <ColorPalette />
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0, margin: "2px 0" }} />
              <AccessibilityChecker element={selectedElement} />
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0, margin: "2px 0" }} />
              <CSSVarInspector element={selectedElement} />
            </div>
          ) : activeTab === "chat" ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
              {/* Messages area */}
              <div
                ref={chatScrollRef}
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  padding: "8px 10px",
                }}
              >
                {messages.length === 0 && (() => {
                  const elTag = selectedElement ? selectedElement.tagName.toLowerCase() : null;
                  const elId = selectedElement?.id ? `#${selectedElement.id}` : "";
                  const elClass = selectedElement?.className
                    ? `.${String(selectedElement.className).split(" ").filter(Boolean)[0]}`
                    : "";
                  const elLabel = elTag ? `${elTag}${elId || elClass}` : "this element";

                  const prompts: { icon: React.ReactNode; text: string }[] = [
                    { icon: <IconPalette size={14} />, text: `Update the colors on ${elLabel}` },
                    { icon: <IconSpacing size={14} />, text: `Fix spacing and alignment of ${elLabel}` },
                    { icon: <IconType size={14} />, text: "Improve the typography in this section" },
                    { icon: <IconResponsive size={14} />, text: "Make this section work on mobile" },
                    { icon: <IconState size={14} />, text: `Add hover and focus states to ${elLabel}` },
                    { icon: <IconAccessibility size={14} />, text: `Fix accessibility issues on ${elLabel}` },
                    { icon: <IconCornerRadius size={14} />, text: `Soften the edges and round corners of ${elLabel}` },
                    { icon: <IconCode size={14} />, text: "Find and fix visual bugs on this page" },
                  ];

                  const handlePromptClick = (text: string) => {
                    const msg: ChatMessage = {
                      id: "designer-" + Date.now(),
                      text,
                      from: "designer",
                      timestamp: Date.now(),
                    };
                    setMessages((prev) => [...prev, msg]);
                    wsClient.send({
                      type: "designer_message",
                      payload: { id: msg.id, text: msg.text, timestamp: msg.timestamp },
                    });
                  };

                  return (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      padding: "12px 6px 8px",
                    }}>
                      <p style={{
                        fontSize: "11px",
                        color: "var(--vt-text-disabled)",
                        lineHeight: "15px",
                        padding: "0 4px 4px",
                      }}>
                        Ask the agent to make changes{selectedElement
                          ? <> to <span style={{ color: "var(--vt-text-secondary)", fontWeight: 500 }}>{elLabel}</span></>
                          : ""}
                      </p>
                      {prompts.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => handlePromptClick(p.text)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "7px 8px",
                            fontSize: "11px",
                            lineHeight: "14px",
                            color: "var(--vt-text-secondary)",
                            background: "transparent",
                            border: "1px solid var(--vt-border)",
                            borderRadius: "6px",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "background 0.15s ease, border-color 0.15s ease",
                            width: "100%",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "var(--vt-hover)";
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--vt-accent)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--vt-border)";
                          }}
                        >
                          <span style={{ flexShrink: 0, color: "var(--vt-text-disabled)", display: "flex" }}>{p.icon}</span>
                          <span>{p.text}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: msg.from === "designer" ? "flex-end" : "flex-start",
                      marginBottom: "6px",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "80%",
                        padding: "6px 10px",
                        borderRadius: msg.from === "designer" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                        fontSize: "11px",
                        lineHeight: "15px",
                        background: msg.from === "designer" ? "var(--vt-accent)" : "var(--vt-hover)",
                        color: msg.from === "designer" ? "#FFFFFF" : "var(--vt-text-primary)",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.text}
                    </div>
                    <span
                      style={{
                        fontSize: "9px",
                        color: "var(--vt-text-disabled)",
                        marginTop: "2px",
                        padding: msg.from === "designer" ? "0 2px 0 0" : "0 0 0 2px",
                      }}
                    >
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Input row — pinned at bottom */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "8px 10px",
                  borderTop: "1px solid var(--vt-border)",
                  flexShrink: 0,
                  background: "var(--vt-surface)",
                  borderRadius: "0 0 var(--vt-panel-radius) var(--vt-panel-radius)",
                }}
              >
                <input
                  type="text"
                  placeholder="Tell the agent..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  style={{
                    flex: 1,
                    height: "var(--vt-input-height)",
                    fontSize: "var(--vt-font-size-value)",
                    fontFamily: "var(--vt-font)",
                    color: "var(--vt-text-primary)",
                    background: "var(--vt-input-bg)",
                    border: "1px solid var(--vt-input-border)",
                    borderRadius: "var(--vt-input-radius)",
                    outline: "none",
                    padding: "0 6px",
                    minWidth: 0,
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "26px",
                    height: "26px",
                    border: "none",
                    background: chatInput.trim() ? "var(--vt-accent)" : "var(--vt-hover)",
                    color: chatInput.trim() ? "#FFFFFF" : "var(--vt-text-disabled)",
                    borderRadius: "var(--vt-input-radius)",
                    cursor: chatInput.trim() ? "pointer" : "default",
                    padding: 0,
                    flexShrink: 0,
                  }}
                  aria-label="Send message"
                >
                  <IconSend size={12} />
                </button>
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "26px",
                      height: "26px",
                      border: "none",
                      background: "transparent",
                      color: "var(--vt-text-disabled)",
                      borderRadius: "var(--vt-input-radius)",
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0,
                    }}
                    aria-label="Clear chat"
                    title="Clear chat"
                  >
                    <IconReset size={12} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <LayerTree
              selectedElement={selectedElement}
              onSelect={handleSelect}
            />
          )}
        </div>
      )}

      {/* ─── Color Blind Simulation SVG Filters (always in DOM) ─── */}
      <svg data-viztweak="" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <defs>
          <filter id="vt-deuteranopia">
            <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0" />
          </filter>
          <filter id="vt-protanopia">
            <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0" />
          </filter>
          <filter id="vt-tritanopia">
            <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0" />
          </filter>
        </defs>
      </svg>

      {/* ─── Floating pill toolbar ─── */}
      {(() => {
        const expanded = inspecting || selectedElement !== null;
        return (
          <div
            ref={toggleRef}
            data-viztweak=""
            {...{ [THEME_MODE_ATTR]: themeMode }}
            style={{
              position: "fixed",
              bottom: "16px",
              right: "16px",
              zIndex: 2147483647,
              display: "flex",
              alignItems: "center",
              gap: expanded ? "4px" : "0px",
              padding: expanded ? "6px 10px" : "0px",
              background: expanded ? "var(--vt-surface)" : "transparent",
              border: expanded ? "1px solid var(--vt-border)" : "none",
              borderRadius: "999px",
              boxShadow: expanded ? "0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)" : "none",
              fontFamily: "var(--vt-font)",
              transition: "all 200ms ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Inspect toggle — always visible */}
            <button
              onClick={() => setInspecting((prev) => !prev)}
              style={{
                width: expanded ? "32px" : "40px",
                height: expanded ? "32px" : "40px",
                borderRadius: "50%",
                border: expanded ? "none" : "1px solid var(--vt-border)",
                background: inspecting || selectedElement ? "var(--vt-accent)" : "var(--vt-surface)",
                color: inspecting || selectedElement ? "#fff" : "var(--vt-text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                position: "relative",
                flexShrink: 0,
                boxShadow: expanded ? "none" : "0 2px 8px rgba(0,0,0,0.12)",
                transition: "all 200ms ease",
              }}
              title={inspecting ? "Click element to inspect" : selectedElement ? "Inspecting" : "Start inspecting (V)"}
            >
              <IconInspect size={expanded ? 16 : 18} />
              <span
                style={{
                  position: "absolute",
                  top: expanded ? "1px" : "2px",
                  right: expanded ? "1px" : "2px",
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: wsConnected ? "var(--vt-success)" : "var(--vt-error)",
                  border: "1.5px solid " + (inspecting || selectedElement ? "var(--vt-accent)" : "var(--vt-surface)"),
                }}
              />
            </button>

            {/* ─── Expanded toolbar buttons ─── */}
            {expanded && (
              <>
                <PillBtn icon={<IconFrame size={15} />} tooltip="Select page" onClick={handleSelectPage} active={selectedElement === document.body} />

                <div style={{ width: "1px", height: "20px", background: "var(--vt-border)", flexShrink: 0 }} />

                <PillBtn icon={<IconUndo size={15} />} tooltip="Undo (Ctrl+Z)" onClick={handleUndo} disabled={undoStack.length === 0} />
                <PillBtn icon={<IconRedo size={15} />} tooltip="Redo (Ctrl+Shift+Z)" onClick={handleRedo} disabled={redoStack.length === 0} />
                <PillBtn icon={<IconReset size={15} />} tooltip="Reset all changes" onClick={handleReset} disabled={changeCount === 0} />

                <div style={{ width: "1px", height: "20px", background: "var(--vt-border)", flexShrink: 0 }} />

                {/* Copy all changes — with change count badge + copied feedback */}
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <PillBtn icon={<IconCopy size={15} />} tooltip={copyFeedback ? "Copied!" : "Copy all changes"} onClick={handleCopyChanges} disabled={changeCount === 0} />
                  {changeCount > 0 && !copyFeedback && (
                    <span
                      data-viztweak=""
                      style={{
                        position: "absolute",
                        top: "-4px",
                        right: "-4px",
                        minWidth: "16px",
                        height: "16px",
                        borderRadius: "8px",
                        background: "var(--vt-accent)",
                        color: "#fff",
                        fontSize: "9px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 4px",
                        lineHeight: 1,
                        pointerEvents: "none",
                      }}
                    >
                      {changeCount}
                    </span>
                  )}
                  {copyFeedback && (
                    <span
                      data-viztweak=""
                      style={{
                        position: "absolute",
                        top: "-4px",
                        right: "-4px",
                        minWidth: "16px",
                        height: "16px",
                        borderRadius: "8px",
                        background: "var(--vt-success)",
                        color: "#fff",
                        fontSize: "8px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 3px",
                        lineHeight: 1,
                        pointerEvents: "none",
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>

                <div style={{ width: "1px", height: "20px", background: "var(--vt-border)", flexShrink: 0 }} />

                <PillBtn icon={<IconResponsive size={15} />} tooltip="Responsive preview" onClick={() => setShowResponsive((p) => !p)} active={showResponsive} />

                <div style={{ width: "1px", height: "20px", background: "var(--vt-border)", flexShrink: 0 }} />

                <PillBtn
                  icon={panelSide === "right" ? <IconPanelLeft size={15} /> : <IconPanelRight size={15} />}
                  tooltip={`Move panel ${panelSide === "right" ? "left" : "right"}`}
                  onClick={handleToggleSide}
                />
                <PillBtn
                  icon={themeMode === "dark" ? <IconSun size={14} /> : <IconMoon size={14} />}
                  tooltip={themeMode === "dark" ? "Light mode" : "Dark mode"}
                  onClick={handleToggleTheme}
                />
              </>
            )}
          </div>
        );
      })()}
    </div>,
    portalRef.current,
  );
}

// ─── Pill Toolbar Button ──────────────────────────────────────

function PillBtn({
  icon,
  tooltip,
  onClick,
  disabled,
  active,
}: {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        border: "none",
        background: active
          ? "var(--vt-accent-bg)"
          : hov && !disabled
            ? "var(--vt-hover)"
            : "transparent",
        color: active
          ? "var(--vt-accent)"
          : disabled
            ? "var(--vt-text-disabled)"
            : "var(--vt-text-primary)",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
        transition: "background 100ms ease, color 100ms ease",
      }}
    >
      {icon}
    </button>
  );
}

// ─── Color Vision Modes ───────────────────────────────────────

const COLOR_VISION_MODES = [
  { id: null, label: "Normal" },
  { id: "deuteranopia", label: "Deuteranopia" },
  { id: "protanopia", label: "Protanopia" },
  { id: "tritanopia", label: "Tritanopia" },
  { id: "monochromacy", label: "Monochromacy" },
] as const;

// ─── Tab Switcher ─────────────────────────────────────────────

function TabSwitcher({
  activeTab,
  onTabChange,
  connected,
  unreadCount,
}: {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  connected: boolean;
  unreadCount: number;
}) {
  const tabs: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
    { id: "design", label: "Design", icon: <IconDesign size={12} /> },
    { id: "layers", label: "Layers", icon: <IconLayers size={12} /> },
    { id: "inspect", label: "Inspect", icon: <IconCode size={12} /> },
    { id: "chat", label: "Chat", icon: <IconChat size={12} /> },
  ];
  const [hovered, setHovered] = useState<PanelTab | null>(null);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "var(--vt-tab-height)",
        padding: "0 8px",
        gap: "2px",
        borderBottom: "1px solid var(--vt-border)",
        flexShrink: 0,
        background: "var(--vt-surface)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const isHov = hovered === tab.id;
        const showBadge = tab.id === "chat" && unreadCount > 0 && !isActive;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            onMouseEnter={() => setHovered(tab.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              height: "24px",
              padding: "0 8px",
              border: "none",
              borderRadius: "var(--vt-input-radius)",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "var(--vt-font)",
              fontWeight: isActive ? 600 : 400,
              background: isActive
                ? "var(--vt-accent-bg)"
                : isHov
                  ? "var(--vt-hover)"
                  : "transparent",
              color: isActive
                ? "var(--vt-accent)"
                : "var(--vt-text-secondary)",
              transition: "all 100ms ease",
              whiteSpace: "nowrap",
              position: "relative",
            }}
          >
            {tab.icon}
            {tab.label}
            {showBadge && (
              <span style={{
                position: "absolute",
                top: "2px",
                right: "2px",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--vt-accent)",
              }} />
            )}
          </button>
        );
      })}

      {/* Connection status as tiny dot on right */}
    </div>
  );
}

export default VizTweak;
