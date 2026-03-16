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
import { IconInspect, IconClose, IconSend, IconDesign, IconLayers, IconBoxModel, IconResponsive, IconUndo, IconRedo, IconReset, IconCopy, IconPanelLeft, IconPanelRight, IconLayoutGrid, IconCode } from "./icons.js";

// ─── Types ────────────────────────────────────────────────────

type PanelTab = "design" | "layers" | "inspect";
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
  const [chatExpanded, setChatExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>("design");
  const [panelSide, setPanelSide] = useState<PanelSide>("right");
  const [pseudoState, setPseudoState] = useState<PseudoState>("default");
  const [copiedStyles, setCopiedStyles] = useState<Record<string, string> | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const [showSpacingOverlay, setShowSpacingOverlay] = useState(false);
  const [showResponsive, setShowResponsive] = useState(false);
  const [showLayoutDebugger, setShowLayoutDebugger] = useState(false);

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
      setChatExpanded(true);
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
    height: "calc(100vh - var(--vt-panel-margin) * 2)",
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
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: wsConnected ? "var(--vt-success)" : "var(--vt-error)",
                  flexShrink: 0,
                }}
              />
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

          {/* ─── Tab Switcher (Design / Layers / Inspect) ─── */}
          <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} connected={wsConnected} />

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
          ) : (
            <LayerTree
              selectedElement={selectedElement}
              onSelect={handleSelect}
            />
          )}

          {/* ─── Chat bar — fixed at bottom ─── */}
          <div
            style={{
              borderTop: "1px solid var(--vt-border)",
              background: "var(--vt-surface)",
              flexShrink: 0,
              borderRadius: "0 0 var(--vt-panel-radius) var(--vt-panel-radius)",
            }}
          >
            {chatExpanded && messages.length > 0 && (
              <div
                ref={chatScrollRef}
                style={{
                  maxHeight: "120px",
                  overflowY: "auto",
                  padding: "6px 8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: msg.from === "designer" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "90%",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        lineHeight: "15px",
                        background: msg.from === "designer" ? "var(--vt-accent-bg)" : "#F0F0F0",
                        color: "var(--vt-text-primary)",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.text}
                    </div>
                    <span
                      style={{
                        fontSize: "9px",
                        color: "var(--vt-text-disabled)",
                        marginTop: "1px",
                      }}
                    >
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Input row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 8px",
              }}
            >
              <input
                type="text"
                placeholder="Tell the agent..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onFocus={() => setChatExpanded(true)}
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
                  width: "24px",
                  height: "24px",
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
}: {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  connected: boolean;
}) {
  const tabs: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
    { id: "design", label: "Design", icon: <IconDesign size={12} /> },
    { id: "layers", label: "Layers", icon: <IconLayers size={12} /> },
    { id: "inspect", label: "Inspect", icon: <IconCode size={12} /> },
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
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}

      {/* Connection status as tiny text on right */}
      <div style={{ flex: 1 }} />
      <span
        style={{
          fontSize: "9px",
          color: "var(--vt-text-disabled)",
          whiteSpace: "nowrap",
        }}
      >
        {connected ? "● Agent" : "○ Offline"}
      </span>
    </div>
  );
}

export default VizTweak;
