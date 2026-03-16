import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { Inspector } from "./Inspector.js";
import { StylePanel } from "./StylePanel.js";
import { DiffEngine } from "./DiffEngine.js";
import { WSClient } from "./WSClient.js";
import { resolveElement } from "./ElementResolver.js";
import { ALL_EDITABLE_PROPERTIES } from "../shared/types.js";
import type { ElementInfo, AgentStatusPayload } from "../shared/types.js";
import { injectTheme, THEME_ATTR } from "./theme.js";
import { IconInspect, IconClose, IconSend } from "./icons.js";

// ─── Types ────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  text: string;
  from: "designer" | "agent";
  type?: "info" | "success" | "error" | "thinking";
  timestamp: number;
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

  // Handle element selection
  const handleSelect = useCallback(
    (el: HTMLElement) => {
      diffEngine.captureBaseline(el, ALL_EDITABLE_PROPERTIES);
      setSelectedElement(el);
      setElementInfo(resolveElement(el));
      setInspecting(false);
    },
    [diffEngine],
  );

  const handleClose = useCallback(() => {
    setSelectedElement(null);
    setElementInfo(null);
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
      // Don't capture shortcuts when typing in an input
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
      // V to enter inspect mode (when not editing)
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
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [inspecting, selectedElement, handleClose]);

  // Format time
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return h + ":" + m;
  };

  return (
    <>
      {/* Inspector overlay */}
      <Inspector
        active={inspecting}
        onSelect={handleSelect}
        ignoreRefs={[panelRef, toggleRef]}
      />

      {/* Right sidebar panel */}
      {selectedElement && elementInfo && (
        <div
          ref={panelRef}
          data-viztweak=""
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "var(--vt-panel-width)",
            height: "100vh",
            background: "var(--vt-panel-bg)",
            borderLeft: "1px solid var(--vt-border)",
            zIndex: 2147483646,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Panel header */}
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

          {/* Connection status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderBottom: "1px solid var(--vt-border)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: wsConnected
                  ? "var(--vt-success)"
                  : "var(--vt-error)",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "10px",
                color: "var(--vt-text-secondary)",
              }}
            >
              {wsConnected ? "Connected" : "Disconnected"}
            </span>
          </div>

          {/* Scrollable StylePanel area */}
          <StylePanel
            element={selectedElement}
            elementInfo={elementInfo}
            diffEngine={diffEngine}
            wsClient={wsClient}
            onClose={handleClose}
          />

          {/* Chat bar — fixed at bottom */}
          <div
            style={{
              borderTop: "1px solid var(--vt-border)",
              background: "var(--vt-surface)",
              flexShrink: 0,
            }}
          >
            {/* Message history */}
            {chatExpanded && messages.length > 0 && (
              <div
                ref={chatScrollRef}
                style={{
                  maxHeight: "140px",
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
                      alignItems:
                        msg.from === "designer" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "90%",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        lineHeight: "15px",
                        background:
                          msg.from === "designer"
                            ? "var(--vt-accent-bg)"
                            : "#F0F0F0",
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
                  background: chatInput.trim()
                    ? "var(--vt-accent)"
                    : "var(--vt-hover)",
                  color: chatInput.trim()
                    ? "#FFFFFF"
                    : "var(--vt-text-disabled)",
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

      {/* Toggle button — bottom-right floating circle */}
      <div
        ref={toggleRef}
        data-viztweak=""
        style={{
          position: "fixed",
          bottom: "16px",
          right: selectedElement ? "276px" : "16px",
          zIndex: 2147483647,
          transition: "right 200ms ease",
        }}
      >
        <button
          onClick={() => {
            if (selectedElement) {
              handleClose();
            } else {
              setInspecting((prev) => !prev);
            }
          }}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "1px solid var(--vt-border)",
            background: "var(--vt-surface)",
            color: inspecting
              ? "var(--vt-accent)"
              : selectedElement
                ? "var(--vt-success)"
                : "var(--vt-text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--vt-shadow-md)",
            position: "relative",
            padding: 0,
          }}
          title={
            inspecting
              ? "Click an element to inspect"
              : selectedElement
                ? "Editing \u2014 click to close"
                : "Start inspecting (Ctrl+Shift+V)"
          }
          aria-label="VizTweak toggle"
        >
          <IconInspect size={18} />
          {/* Connection dot */}
          <span
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: wsConnected
                ? "var(--vt-success)"
                : "var(--vt-error)",
              border: "1.5px solid var(--vt-surface)",
            }}
          />
        </button>
      </div>
    </>
  );
}

export default VizTweak;
