import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { Inspector } from "./Inspector.js";
import { StylePanel } from "./StylePanel.js";
import { LayerTree } from "./LayerTree.js";
import { StateSelector, type PseudoState } from "./StateSelector.js";
import { DiffEngine } from "./DiffEngine.js";
import { WSClient } from "./WSClient.js";
import { resolveElement } from "./ElementResolver.js";
import { ALL_EDITABLE_PROPERTIES } from "../shared/types.js";
import type { ElementInfo, AgentStatusPayload } from "../shared/types.js";
import { injectTheme, THEME_ATTR } from "./theme.js";
import { SpacingOverlay } from "./SpacingOverlay.js";
import { AccessibilityChecker } from "./AccessibilityChecker.js";
import { ResponsivePreview } from "./ResponsivePreview.js";
import { ClassEditor } from "./ClassEditor.js";
import { CSSVarInspector } from "./CSSVarInspector.js";
import { TokenExtractor } from "./TokenExtractor.js";
import { ColorPalette } from "./ColorPalette.js";
import { GridFlexDebugger } from "./GridFlexDebugger.js";
import { DiffReporter } from "./DiffReporter.js";
import { IconInspect, IconClose, IconSend, IconDesign, IconLayers, IconBoxModel, IconResponsive, IconUndo, IconRedo, IconReset, IconCopy, IconPanelLeft, IconPanelRight, IconLayoutGrid, IconCode, IconChat, IconPalette, IconSpacing, IconType, IconState, IconAccessibility, IconCornerRadius } from "./icons.js";

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
  const [copiedStyles, setCopiedStyles] = useState<Record<string, string> | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const [showSpacingOverlay, setShowSpacingOverlay] = useState(false);
  const [showResponsive, setShowResponsive] = useState(false);
  const [showLayoutDebugger, setShowLayoutDebugger] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [colorBlindMode, setColorBlindMode] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const diffEngine = useMemo(() => new DiffEngine(), []);
  const wsClient = useMemo(() => new WSClient(), []);

  // Inject theme on mount
  useEffect(() => {
    injectTheme();
  }, []);

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

  // Handle element selection (from inspector or layer tree)
  const handleSelect = useCallback(
    (el: HTMLElement) => {
      diffEngine.captureBaseline(el, ALL_EDITABLE_PROPERTIES);
      setSelectedElement(el);
      setElementInfo(resolveElement(el));
      setInspecting(false);
      setPseudoState("default");
    },
    [diffEngine],
  );

  const handleClose = useCallback(() => {
    setSelectedElement(null);
    setElementInfo(null);
    setPseudoState("default");
  }, []);

  // ─── Quick Actions ────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    const currentValue = entry.element.style.getPropertyValue(
      entry.property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    );
    setRedoStack((prev) => [...prev, { ...entry, previousValue: currentValue }]);
    entry.element.style.setProperty(
      entry.property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
      entry.previousValue
    );
    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    const currentValue = entry.element.style.getPropertyValue(
      entry.property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    );
    setUndoStack((prev) => [...prev, { ...entry, previousValue: currentValue }]);
    entry.element.style.setProperty(
      entry.property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
      entry.previousValue
    );
    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack]);

  const handleReset = useCallback(() => {
    if (!selectedElement) return;
    diffEngine.clearBaseline(selectedElement);
    // Remove all inline styles we may have set
    for (const prop of ALL_EDITABLE_PROPERTIES) {
      selectedElement.style.removeProperty(
        prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
      );
    }
    setUndoStack([]);
    setRedoStack([]);
    // Re-capture baseline
    diffEngine.captureBaseline(selectedElement, ALL_EDITABLE_PROPERTIES);
    setElementInfo(resolveElement(selectedElement));
  }, [selectedElement, diffEngine]);

  const handleCopyStyles = useCallback(() => {
    if (!selectedElement) return;
    const computed = window.getComputedStyle(selectedElement);
    const styles: Record<string, string> = {};
    for (const prop of ALL_EDITABLE_PROPERTIES) {
      const cssName = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      styles[prop] = computed.getPropertyValue(cssName);
    }
    setCopiedStyles(styles);
  }, [selectedElement]);

  const handlePasteStyles = useCallback(() => {
    if (!selectedElement || !copiedStyles) return;
    for (const [prop, val] of Object.entries(copiedStyles)) {
      if (!val) continue;
      const cssName = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      const currentValue = selectedElement.style.getPropertyValue(cssName);
      setUndoStack((prev) => [...prev, { element: selectedElement, property: prop, previousValue: currentValue || "" }]);
      selectedElement.style.setProperty(cssName, val);
    }
    setRedoStack([]);
    setElementInfo(resolveElement(selectedElement));
  }, [selectedElement, copiedStyles]);

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
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
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
    height: "calc(100vh - var(--vt-panel-margin) * 2 - 52px)",
    background: "var(--vt-panel-bg)",
    border: "1px solid var(--vt-border)",
    borderRadius: "var(--vt-panel-radius)",
    boxShadow: "var(--vt-shadow-panel)",
    zIndex: 2147483646,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  return (
    <>
      {/* Inspector overlay */}
      <Inspector
        active={inspecting}
        onSelect={handleSelect}
        ignoreRefs={[panelRef, toggleRef]}
      />

      {/* Spacing overlay */}
      <SpacingOverlay element={selectedElement} visible={showSpacingOverlay} />

      {/* Grid/Flex layout debugger overlay */}
      <GridFlexDebugger active={showLayoutDebugger} />

      {/* Responsive preview bar */}
      <ResponsivePreview active={showResponsive} onToggle={() => setShowResponsive(false)} />

      {/* Floating sidebar panel */}
      {panelOpen && (
        <div
          ref={panelRef}
          data-viztweak=""
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
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0 }} />
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
              />
            </div>
          ) : activeTab === "inspect" ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto" }}>
              <ClassEditor element={selectedElement} />
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0 }} />
              <TokenExtractor element={selectedElement} />
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0 }} />
              <DiffReporter diffEngine={diffEngine} />
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0 }} />
              <ColorPalette />
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0 }} />
              <AccessibilityChecker element={selectedElement} />
              <div style={{ height: "1px", background: "var(--vt-border)", flexShrink: 0 }} />
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
                        maxWidth: "90%",
                        padding: "6px 10px",
                        borderRadius: msg.from === "designer" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                        fontSize: "11px",
                        lineHeight: "16px",
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

      {/* ─── Color Blind Simulation Overlay ─── */}
      {colorBlindMode && (
        <div
          data-viztweak=""
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483640,
            pointerEvents: "none",
            filter: colorBlindMode === "deuteranopia"
              ? "url(#vt-deuteranopia)"
              : colorBlindMode === "protanopia"
                ? "url(#vt-protanopia)"
                : colorBlindMode === "tritanopia"
                  ? "url(#vt-tritanopia)"
                  : "saturate(0)",
            mixBlendMode: "color",
          }}
        />
      )}
      {colorBlindMode && (
        <svg data-viztweak="" style={{ position: "absolute", width: 0, height: 0 }}>
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
      )}

      {/* ─── Keyboard Shortcuts Help ─── */}
      {showShortcuts && (
        <div
          data-viztweak=""
          onClick={() => setShowShortcuts(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483646,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(2px)",
            fontFamily: "var(--vt-font)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--vt-panel-bg)",
              border: "1px solid var(--vt-border)",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
              width: "320px",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--vt-text-primary)" }}>Keyboard Shortcuts</span>
              <button onClick={() => setShowShortcuts(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--vt-text-secondary)", padding: "2px" }}>
                <IconClose size={14} />
              </button>
            </div>
            {[
              ["V", "Start inspecting"],
              ["Escape", "Deselect / stop inspecting"],
              ["⌘ Shift V", "Toggle inspector"],
              ["⌘ Z", "Undo"],
              ["⌘ Shift Z", "Redo"],
              ["1", "Design tab"],
              ["2", "Layers tab"],
              ["3", "Inspect tab"],
              ["4", "Chat tab"],
              ["?", "Show shortcuts"],
            ].map(([key, desc]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: "11px", color: "var(--vt-text-secondary)" }}>{desc}</span>
                <kbd style={{
                  fontSize: "10px",
                  fontFamily: "var(--vt-font-mono, monospace)",
                  background: "var(--vt-hover)",
                  border: "1px solid var(--vt-border)",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  color: "var(--vt-text-primary)",
                  whiteSpace: "nowrap",
                }}>
                  {key}
                </kbd>
              </div>
            ))}

            {/* Color blind simulation section */}
            <div style={{ height: "1px", background: "var(--vt-border)", margin: "12px 0" }} />
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--vt-text-primary)", marginBottom: "8px", display: "block" }}>Color Vision Simulation</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {[
                { id: null, label: "Normal" },
                { id: "deuteranopia", label: "Deuteranopia" },
                { id: "protanopia", label: "Protanopia" },
                { id: "tritanopia", label: "Tritanopia" },
                { id: "monochromacy", label: "Monochromacy" },
              ].map((mode) => (
                <button
                  key={mode.id ?? "normal"}
                  onClick={() => setColorBlindMode(mode.id)}
                  style={{
                    fontSize: "10px",
                    fontFamily: "var(--vt-font)",
                    padding: "3px 8px",
                    borderRadius: "var(--vt-input-radius)",
                    border: "1px solid var(--vt-border)",
                    cursor: "pointer",
                    background: colorBlindMode === mode.id ? "var(--vt-accent-bg)" : "var(--vt-surface)",
                    color: colorBlindMode === mode.id ? "var(--vt-accent)" : "var(--vt-text-secondary)",
                    fontWeight: colorBlindMode === mode.id ? 600 : 400,
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Floating pill toolbar ─── */}
      {(() => {
        const expanded = inspecting || selectedElement !== null;
        return (
          <div
            ref={toggleRef}
            data-viztweak=""
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
                <div style={{ width: "1px", height: "20px", background: "var(--vt-border)", flexShrink: 0 }} />

                <PillBtn icon={<IconCopy size={15} />} tooltip="Copy styles" onClick={handleCopyStyles} disabled={!selectedElement} />
                <PillBtn icon={<IconUndo size={15} />} tooltip="Undo (Ctrl+Z)" onClick={handleUndo} disabled={undoStack.length === 0} />
                <PillBtn icon={<IconRedo size={15} />} tooltip="Redo (Ctrl+Shift+Z)" onClick={handleRedo} disabled={redoStack.length === 0} />
                <PillBtn icon={<IconReset size={15} />} tooltip="Reset all changes" onClick={handleReset} disabled={!selectedElement} />

                <div style={{ width: "1px", height: "20px", background: "var(--vt-border)", flexShrink: 0 }} />

                <PillBtn icon={<IconBoxModel size={15} />} tooltip="Spacing overlay" onClick={() => setShowSpacingOverlay((p) => !p)} active={showSpacingOverlay} />
                <PillBtn icon={<IconLayoutGrid size={15} />} tooltip="Flex/Grid debugger" onClick={() => setShowLayoutDebugger((p) => !p)} active={showLayoutDebugger} />
                <PillBtn icon={<IconResponsive size={15} />} tooltip="Responsive preview" onClick={() => setShowResponsive((p) => !p)} active={showResponsive} />

                <div style={{ width: "1px", height: "20px", background: "var(--vt-border)", flexShrink: 0 }} />

                <PillBtn
                  icon={panelSide === "right" ? <IconPanelLeft size={15} /> : <IconPanelRight size={15} />}
                  tooltip={`Move panel ${panelSide === "right" ? "left" : "right"}`}
                  onClick={handleToggleSide}
                />
                <PillBtn
                  icon={<span style={{ fontSize: "14px", fontWeight: 700, lineHeight: 1 }}>?</span>}
                  tooltip="Keyboard shortcuts"
                  onClick={() => setShowShortcuts(true)}
                />
                {selectedElement && (
                  <PillBtn icon={<IconClose size={14} />} tooltip="Close panel (Esc)" onClick={handleClose} />
                )}
              </>
            )}
          </div>
        );
      })()}
    </>
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
