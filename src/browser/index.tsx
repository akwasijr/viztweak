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
import type { ElementInfo } from "../shared/types.js";

interface VizTweakProps {
  /** Force the component to render even in production */
  force?: boolean;
}

/**
 * VizTweak — Visual UI tweaker component.
 *
 * Add `<VizTweak />` to your app layout. It only activates in development
 * unless the `force` prop is set.
 *
 * Usage:
 * ```tsx
 * import { VizTweak } from "viztweak";
 * <VizTweak />
 * ```
 */
export function VizTweak({ force = false }: VizTweakProps) {
  // Only render in development (or when forced)
  if (!force && process.env.NODE_ENV === "production") {
    return null;
  }

  return <VizTweakInner />;
}

function VizTweakInner() {
  const [inspecting, setInspecting] = useState(false);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(
    null
  );
  const [elementInfo, setElementInfo] = useState<ElementInfo | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const diffEngine = useMemo(() => new DiffEngine(), []);
  const wsClient = useMemo(() => new WSClient(), []);

  // Connect WebSocket on mount
  useEffect(() => {
    wsClient.connect();
    const offConnect = wsClient.on("_connected", () => setWsConnected(true));
    const offDisconnect = wsClient.on("_disconnected", () =>
      setWsConnected(false)
    );
    const offClear = wsClient.on("changes_cleared", () => {
      diffEngine.clearAll();
    });

    return () => {
      offConnect();
      offDisconnect();
      offClear();
      wsClient.disconnect();
    };
  }, [wsClient, diffEngine]);

  // Handle element selection
  const handleSelect = useCallback(
    (el: HTMLElement) => {
      // Capture baseline styles before editing
      diffEngine.captureBaseline(el, ALL_EDITABLE_PROPERTIES);

      setSelectedElement(el);
      setElementInfo(resolveElement(el));
      setInspecting(false);
    },
    [diffEngine]
  );

  // Close the style panel
  const handleClose = useCallback(() => {
    setSelectedElement(null);
    setElementInfo(null);
  }, []);

  // Toggle inspect mode with keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + V to toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "V") {
        e.preventDefault();
        if (selectedElement) {
          handleClose();
        } else {
          setInspecting((prev) => !prev);
        }
      }
      // Escape to close panel or exit inspect mode
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

  return (
    <>
      {/* Inspector overlay */}
      <Inspector
        active={inspecting}
        onSelect={handleSelect}
        ignoreRefs={[panelRef, toggleRef]}
      />

      {/* Style editing panel */}
      {selectedElement && elementInfo && (
        <div ref={panelRef}>
          <StylePanel
            element={selectedElement}
            elementInfo={elementInfo}
            diffEngine={diffEngine}
            wsClient={wsClient}
            onClose={handleClose}
          />
        </div>
      )}

      {/* Floating toggle button */}
      <button
        ref={toggleRef}
        onClick={() => {
          if (selectedElement) {
            handleClose();
          } else {
            setInspecting((prev) => !prev);
          }
        }}
        style={{
          position: "fixed",
          bottom: "16px",
          right: "16px",
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          border: "none",
          background: inspecting
            ? "#4f46e5"
            : selectedElement
              ? "#22c55e"
              : "#1a1a2e",
          color: "#fff",
          fontSize: "20px",
          cursor: "pointer",
          zIndex: 2147483647,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          transition: "all 150ms ease",
        }}
        title={
          inspecting
            ? "Click an element to inspect"
            : selectedElement
              ? "Editing — click to close"
              : "Start inspecting (Ctrl+Shift+V)"
        }
        aria-label="VizTweak toggle"
      >
        {inspecting ? "⊙" : selectedElement ? "✎" : "◎"}
        {/* WS connection dot */}
        <span
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: wsConnected ? "#22c55e" : "#ef4444",
            border: "2px solid #1a1a2e",
          }}
        />
      </button>
    </>
  );
}

export default VizTweak;
