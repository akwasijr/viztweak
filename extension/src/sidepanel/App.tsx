import React, { useState, useEffect, useCallback, useRef } from "react";
import type { Message, SelectedElementData, ElementInfo } from "../shared/messages";

// ---------------------------------------------------------------------------
// Theme (inline - same tokens as the original VizTweak theme)
// ---------------------------------------------------------------------------

const THEME_CSS = `
:root {
  --vt-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --vt-font-size: 11px;
  --vt-font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  --vt-radius: 6px;
  --vt-radius-sm: 4px;
  --vt-transition: 120ms ease;
}

body.vt-dark {
  --vt-bg: #2c2c2c;
  --vt-bg-secondary: #383838;
  --vt-surface: #333;
  --vt-text: #e8e8e8;
  --vt-text-secondary: #999;
  --vt-border: #444;
  --vt-border-subtle: #3a3a3a;
  --vt-accent: #4A90D9;
  --vt-accent-hover: #5BA0E9;
  --vt-hover: rgba(255,255,255,0.06);
  --vt-input-bg: #3a3a3a;
}

body.vt-light {
  --vt-bg: #f5f5f5;
  --vt-bg-secondary: #eee;
  --vt-surface: #fff;
  --vt-text: #1a1a1a;
  --vt-text-secondary: #666;
  --vt-border: #ddd;
  --vt-border-subtle: #e8e8e8;
  --vt-accent: #4A90D9;
  --vt-accent-hover: #3A80C9;
  --vt-hover: rgba(0,0,0,0.04);
  --vt-input-bg: #eee;
}

body {
  background: var(--vt-bg);
  color: var(--vt-text);
  font-family: var(--vt-font);
  font-size: var(--vt-font-size);
  line-height: 1.4;
}

.vt-panel { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.vt-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-bottom: 1px solid var(--vt-border-subtle);
  background: var(--vt-bg); flex-shrink: 0;
}
.vt-header h1 { font-size: 12px; font-weight: 600; }
.vt-toolbar {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 12px; border-bottom: 1px solid var(--vt-border-subtle);
  background: var(--vt-bg); flex-shrink: 0;
}
.vt-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 4px 8px; border: none; border-radius: var(--vt-radius-sm);
  background: transparent; color: var(--vt-text-secondary); cursor: pointer;
  font-size: 11px; font-family: var(--vt-font); gap: 4px;
  transition: background var(--vt-transition), color var(--vt-transition);
}
.vt-btn:hover { background: var(--vt-hover); color: var(--vt-text); }
.vt-btn:disabled { opacity: 0.35; cursor: default; }
.vt-btn.active { background: var(--vt-accent); color: #fff; }
.vt-btn-icon { padding: 4px; min-width: 24px; height: 24px; }

.vt-tabs {
  display: flex; border-bottom: 1px solid var(--vt-border-subtle);
  background: var(--vt-bg); flex-shrink: 0;
}
.vt-tab {
  flex: 1; padding: 6px 0; text-align: center; font-size: 11px; font-weight: 500;
  color: var(--vt-text-secondary); cursor: pointer; border: none; background: none;
  border-bottom: 2px solid transparent; transition: all var(--vt-transition);
}
.vt-tab:hover { color: var(--vt-text); }
.vt-tab.active { color: var(--vt-accent); border-bottom-color: var(--vt-accent); }

.vt-body { flex: 1; overflow-y: auto; padding: 12px; }
.vt-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; color: var(--vt-text-secondary); gap: 8px; text-align: center; padding: 24px;
}
.vt-empty svg { opacity: 0.4; }

.vt-section { margin-bottom: 16px; }
.vt-section-title {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11px; font-weight: 600; color: var(--vt-text-secondary);
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
  cursor: pointer; user-select: none;
}
.vt-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.vt-label { width: 70px; flex-shrink: 0; color: var(--vt-text-secondary); font-size: 11px; }
.vt-input {
  flex: 1; height: 26px; padding: 0 6px; border: none; border-radius: var(--vt-radius-sm);
  background: var(--vt-input-bg); color: var(--vt-text); font-size: 11px;
  font-family: var(--vt-font); outline: none;
}
.vt-input:focus { box-shadow: 0 0 0 1px var(--vt-accent); }
.vt-select {
  flex: 1; height: 26px; padding: 0 4px; border: none; border-radius: var(--vt-radius-sm);
  background: var(--vt-input-bg); color: var(--vt-text); font-size: 11px;
  font-family: var(--vt-font); outline: none; appearance: none; cursor: pointer;
}

.vt-color-swatch {
  width: 26px; height: 26px; border-radius: var(--vt-radius-sm);
  border: 1px solid var(--vt-border); cursor: pointer; padding: 0;
}
.vt-color-swatch input[type="color"] {
  opacity: 0; width: 100%; height: 100%; cursor: pointer;
}

.vt-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
  background: var(--vt-accent); color: #fff; font-size: 9px; font-weight: 600;
}

.vt-tag {
  display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px;
  background: var(--vt-bg-secondary); color: var(--vt-text-secondary);
}

.vt-copy-feedback {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
  padding: 6px 14px; border-radius: 6px; background: #22c55e; color: #fff;
  font-size: 12px; font-weight: 500; opacity: 0; transition: opacity 0.2s;
  z-index: 100; pointer-events: none;
}
.vt-copy-feedback.show { opacity: 1; }
`;

// ---------------------------------------------------------------------------
// Icons (minimal inline SVGs)
// ---------------------------------------------------------------------------

const CrosshairIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="5.5"/><line x1="8" y1="0.5" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="15.5"/>
    <line x1="0.5" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="15.5" y2="8"/>
  </svg>
);
const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 6h7a3 3 0 0 1 0 6H8"/><polyline points="5 4 3 6 5 8"/>
  </svg>
);
const RedoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M13 6H6a3 3 0 0 0 0 6h2"/><polyline points="11 4 13 6 11 8"/>
  </svg>
);
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M3 11V3a1.5 1.5 0 0 1 1.5-1.5H11"/>
  </svg>
);
const ResetIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 8a6 6 0 1 1 1.8 4.3"/><polyline points="2 12 2 8 6 8"/>
  </svg>
);
const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="15"/>
    <line x1="1" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="15" y2="8"/>
  </svg>
);
const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M13.5 8.5a5.5 5.5 0 1 1-6-6 4.5 4.5 0 0 0 6 6z"/>
  </svg>
);

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = localStorage.getItem("viztweak-theme");
    return stored === "light" ? "light" : "dark";
  });
  const [tab, setTab] = useState<"design" | "layers" | "inspect" | "a11y">("design");
  const [inspecting, setInspecting] = useState(false);
  const [selected, setSelected] = useState<SelectedElementData | null>(null);
  const [changeCount, setChangeCount] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [connected, setConnected] = useState(false);
  const [domTree, setDomTree] = useState<any[]>([]);
  const [a11yIssues, setA11yIssues] = useState<any[]>([]);
  const [styles, setStyles] = useState<Record<string, string>>({});

  // Inject theme CSS on mount
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = THEME_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Apply theme class
  useEffect(() => {
    document.body.className = `vt-${theme}`;
    localStorage.setItem("viztweak-theme", theme);
  }, [theme]);

  // Port for sending commands to content script via background
  const portRef = useRef<chrome.runtime.Port | null>(null);

  // Connect port for sending commands
  useEffect(() => {
    const port = chrome.runtime.connect({ name: "viztweak-panel" });
    portRef.current = port;

    port.onDisconnect.addListener(() => {
      portRef.current = null;
      setConnected(false);
    });

    // Ping to check if content script is alive
    port.postMessage({ type: "PING" });

    return () => {
      port.disconnect();
      portRef.current = null;
    };
  }, []);

  // Listen for data from content script via chrome.storage.session
  useEffect(() => {
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "session") return;

      if (changes.viztweak_selected?.newValue) {
        const data = changes.viztweak_selected.newValue as SelectedElementData;
        setSelected(data);
        setStyles(data.computedStyles || {});
        setInspecting(false);
        setConnected(true);
      }
      if (changes.viztweak_styles?.newValue) {
        setStyles(changes.viztweak_styles.newValue);
      }
      if (changes.viztweak_domtree?.newValue) {
        setDomTree(changes.viztweak_domtree.newValue);
      }
      if (changes.viztweak_a11y?.newValue) {
        setA11yIssues(changes.viztweak_a11y.newValue);
      }
      if (changes.viztweak_copytext?.newValue) {
        const text = changes.viztweak_copytext.newValue;
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
          });
        }
      }
    };

    chrome.storage.onChanged.addListener(handler);

    // Also check if there's already a PONG-like response (content script is alive)
    // by checking the storage for recent data
    chrome.storage.session.get("viztweak_ts").then((result) => {
      if (result.viztweak_ts) setConnected(true);
    }).catch(() => {});

    // Also listen for port responses (for PING)
    const portListener = (msg: any) => {
      if (msg.type === "PING_RESPONSE" && msg.payload) {
        setConnected(true);
        if (!msg.payload.payload?.hasSelection) {
          portRef.current?.postMessage({ type: "ACTIVATE" });
          setInspecting(true);
        }
      }
    };
    if (portRef.current) {
      portRef.current.onMessage.addListener(portListener);
    }

    return () => {
      chrome.storage.onChanged.removeListener(handler);
    };
  }, []);

  // Helper: send command to content script via port
  const send = useCallback((msg: Message) => {
    if (portRef.current) {
      portRef.current.postMessage(msg);
    }
  }, []);

  // Actions
  const toggleInspect = useCallback(() => {
    if (inspecting) {
      send({ type: "DEACTIVATE" });
      setInspecting(false);
    } else {
      send({ type: "ACTIVATE" });
      setInspecting(true);
    }
  }, [inspecting, send]);

  const handleUndo = useCallback(() => {
    send({ type: "UNDO" });
  }, [send]);

  const handleRedo = useCallback(() => {
    send({ type: "REDO" });
  }, [send]);

  const handleReset = useCallback(() => {
    send({ type: "RESET_ALL" });
    setSelected(null);
    setStyles({});
    setChangeCount(0);
  }, [send]);

  const handleCopy = useCallback(() => {
    send({ type: "COPY_CHANGES" });
  }, [send]);

  const applyStyle = useCallback((property: string, value: string) => {
    send({ type: "APPLY_STYLE", payload: { property, value } });
  }, [send]);

  const loadDomTree = useCallback(() => {
    send({ type: "GET_DOM_TREE" });
  }, [send]);

  const runA11y = useCallback(() => {
    send({ type: "RUN_ACCESSIBILITY", payload: { elementOnly: false } });
  }, [send]);

  // Load DOM tree when switching to layers tab
  useEffect(() => {
    if (tab === "layers") loadDomTree();
    if (tab === "a11y") runA11y();
  }, [tab, loadDomTree, runA11y]);

  return (
    <div className="vt-panel">
      {/* Header */}
      <div className="vt-header">
        <h1>VizTweak</h1>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="vt-btn vt-btn-icon" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Toggle theme">
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="vt-toolbar">
        <button className={`vt-btn${inspecting ? " active" : ""}`} onClick={toggleInspect} title="Inspect element">
          <CrosshairIcon /> Inspect
        </button>
        <div style={{ flex: 1 }} />
        <button className="vt-btn vt-btn-icon" onClick={handleUndo} title="Undo"><UndoIcon /></button>
        <button className="vt-btn vt-btn-icon" onClick={handleRedo} title="Redo"><RedoIcon /></button>
        <button className="vt-btn vt-btn-icon" onClick={handleReset} title="Reset all"><ResetIcon /></button>
        <button className="vt-btn" onClick={handleCopy} title="Copy changes">
          <CopyIcon /> Copy
        </button>
      </div>

      {/* Tabs */}
      <div className="vt-tabs">
        {(["design", "layers", "inspect", "a11y"] as const).map(t => (
          <button key={t} className={`vt-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "design" ? "Design" : t === "layers" ? "Layers" : t === "inspect" ? "Inspect" : "A11y"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="vt-body">
        {!connected && (
          <div className="vt-empty">
            <div style={{ fontSize: 24, marginBottom: 4 }}>!</div>
            <div><strong>Reload the page</strong> to connect VizTweak</div>
            <div style={{ fontSize: 10, marginTop: 4 }}>The content script needs to be injected into the page first</div>
          </div>
        )}

        {connected && tab === "design" && (
          selected ? (
            <StyleEditor element={selected.element} styles={styles} applyStyle={applyStyle} />
          ) : (
            <div className="vt-empty">
              <CrosshairIcon />
              {inspecting ? (
                <div>Click any element on the page</div>
              ) : (
                <div>Click <strong>Inspect</strong> then select an element on the page</div>
              )}
            </div>
          )
        )}

        {connected && tab === "layers" && (
          <LayerTree nodes={domTree} onRefresh={loadDomTree} />
        )}

        {connected && tab === "inspect" && (
          selected ? (
            <InspectPanel element={selected.element} styles={styles} />
          ) : (
            <div className="vt-empty">
              <div>Select an element to see its computed styles</div>
            </div>
          )
        )}

        {connected && tab === "a11y" && (
          <A11yPanel issues={a11yIssues} onRefresh={runA11y} />
        )}
      </div>

      {/* Copy feedback */}
      <div className={`vt-copy-feedback${copyFeedback ? " show" : ""}`}>
        Copied to clipboard
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StyleEditor - property editing panel
// ---------------------------------------------------------------------------

function StyleEditor({ element, styles, applyStyle }: {
  element: ElementInfo;
  styles: Record<string, string>;
  applyStyle: (prop: string, val: string) => void;
}) {
  return (
    <div>
      {/* Element tag */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <span className="vt-tag">&lt;{element.tagName}&gt;</span>
        {element.componentName && <span className="vt-tag">{element.componentName}</span>}
        {element.textContent && (
          <span style={{ color: "var(--vt-text-secondary)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {element.textContent}
          </span>
        )}
      </div>

      <Section title="Position">
        <PropRow label="Position" prop="position" value={styles.position} onChange={applyStyle}
          options={["static", "relative", "absolute", "fixed", "sticky"]} />
        <PropRow label="Top" prop="top" value={styles.top} onChange={applyStyle} />
        <PropRow label="Left" prop="left" value={styles.left} onChange={applyStyle} />
        <PropRow label="Z-index" prop="zIndex" value={styles.zIndex} onChange={applyStyle} />
      </Section>

      <Section title="Layout">
        <PropRow label="Display" prop="display" value={styles.display} onChange={applyStyle}
          options={["block", "flex", "grid", "inline", "inline-flex", "inline-block", "none"]} />
        <PropRow label="Direction" prop="flexDirection" value={styles.flexDirection} onChange={applyStyle}
          options={["row", "column", "row-reverse", "column-reverse"]} />
        <PropRow label="Justify" prop="justifyContent" value={styles.justifyContent} onChange={applyStyle}
          options={["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"]} />
        <PropRow label="Align" prop="alignItems" value={styles.alignItems} onChange={applyStyle}
          options={["stretch", "flex-start", "center", "flex-end", "baseline"]} />
        <PropRow label="Gap" prop="gap" value={styles.gap} onChange={applyStyle} />
        <PropRow label="Wrap" prop="flexWrap" value={styles.flexWrap} onChange={applyStyle}
          options={["nowrap", "wrap", "wrap-reverse"]} />
      </Section>

      <Section title="Size">
        <PropRow label="Width" prop="width" value={styles.width} onChange={applyStyle} />
        <PropRow label="Height" prop="height" value={styles.height} onChange={applyStyle} />
      </Section>

      <Section title="Spacing">
        <div style={{ marginBottom: 4, color: "var(--vt-text-secondary)", fontSize: 10 }}>Padding</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
          <PropRow label="Top" prop="paddingTop" value={styles.paddingTop} onChange={applyStyle} compact />
          <PropRow label="Right" prop="paddingRight" value={styles.paddingRight} onChange={applyStyle} compact />
          <PropRow label="Bottom" prop="paddingBottom" value={styles.paddingBottom} onChange={applyStyle} compact />
          <PropRow label="Left" prop="paddingLeft" value={styles.paddingLeft} onChange={applyStyle} compact />
        </div>
        <div style={{ marginBottom: 4, color: "var(--vt-text-secondary)", fontSize: 10 }}>Margin</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          <PropRow label="Top" prop="marginTop" value={styles.marginTop} onChange={applyStyle} compact />
          <PropRow label="Right" prop="marginRight" value={styles.marginRight} onChange={applyStyle} compact />
          <PropRow label="Bottom" prop="marginBottom" value={styles.marginBottom} onChange={applyStyle} compact />
          <PropRow label="Left" prop="marginLeft" value={styles.marginLeft} onChange={applyStyle} compact />
        </div>
      </Section>

      <Section title="Typography">
        <PropRow label="Font" prop="fontFamily" value={styles.fontFamily} onChange={applyStyle} />
        <PropRow label="Weight" prop="fontWeight" value={styles.fontWeight} onChange={applyStyle}
          options={["100","200","300","400","500","600","700","800","900"]} />
        <PropRow label="Size" prop="fontSize" value={styles.fontSize} onChange={applyStyle} />
        <PropRow label="Line H" prop="lineHeight" value={styles.lineHeight} onChange={applyStyle} />
        <PropRow label="Spacing" prop="letterSpacing" value={styles.letterSpacing} onChange={applyStyle} />
        <PropRow label="Align" prop="textAlign" value={styles.textAlign} onChange={applyStyle}
          options={["left", "center", "right", "justify"]} />
        <PropRow label="Color" prop="color" value={styles.color} onChange={applyStyle} isColor />
        <PropRow label="Decor" prop="textDecoration" value={styles.textDecoration} onChange={applyStyle}
          options={["none", "underline", "line-through"]} />
      </Section>

      <Section title="Appearance">
        <PropRow label="Opacity" prop="opacity" value={styles.opacity} onChange={applyStyle} />
        <PropRow label="Overflow" prop="overflow" value={styles.overflow} onChange={applyStyle}
          options={["visible", "hidden", "scroll", "auto"]} />
        <PropRow label="Radius" prop="borderRadius" value={styles.borderRadius} onChange={applyStyle} />
      </Section>

      <Section title="Fill">
        <PropRow label="Background" prop="backgroundColor" value={styles.backgroundColor} onChange={applyStyle} isColor />
      </Section>

      <Section title="Border">
        <PropRow label="Color" prop="borderColor" value={styles.borderColor} onChange={applyStyle} isColor />
        <PropRow label="Width" prop="borderWidth" value={styles.borderWidth} onChange={applyStyle} />
        <PropRow label="Style" prop="borderStyle" value={styles.borderStyle} onChange={applyStyle}
          options={["none", "solid", "dashed", "dotted", "double"]} />
      </Section>

      <Section title="Shadow">
        <PropRow label="Shadow" prop="boxShadow" value={styles.boxShadow} onChange={applyStyle} />
      </Section>

      <Section title="Filters">
        <PropRow label="Filter" prop="filter" value={styles.filter} onChange={applyStyle} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="vt-section">
      <div className="vt-section-title" onClick={() => setOpen(!open)}>
        {title}
        <span style={{ fontSize: 10 }}>{open ? "−" : "+"}</span>
      </div>
      {open && children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PropRow - single property editor
// ---------------------------------------------------------------------------

function PropRow({ label, prop, value, onChange, options, isColor, compact }: {
  label: string;
  prop: string;
  value: string;
  onChange: (prop: string, val: string) => void;
  options?: string[];
  isColor?: boolean;
  compact?: boolean;
}) {
  const [localVal, setLocalVal] = useState(value || "");

  useEffect(() => { setLocalVal(value || ""); }, [value]);

  const commit = (v: string) => {
    setLocalVal(v);
    onChange(prop, v);
  };

  if (options) {
    return (
      <div className="vt-row">
        {!compact && <span className="vt-label">{label}</span>}
        <select className="vt-select" value={localVal} onChange={e => commit(e.target.value)} title={compact ? label : undefined}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (isColor) {
    // Parse color to hex for the picker
    const hex = rgbToHex(localVal);
    return (
      <div className="vt-row">
        {!compact && <span className="vt-label">{label}</span>}
        <div className="vt-color-swatch" style={{ backgroundColor: localVal }}>
          <input type="color" value={hex} onChange={e => commit(e.target.value)} />
        </div>
        <input className="vt-input" value={localVal} onChange={e => setLocalVal(e.target.value)}
          onBlur={() => commit(localVal)} onKeyDown={e => e.key === "Enter" && commit(localVal)}
          style={{ flex: 1 }} />
      </div>
    );
  }

  return (
    <div className="vt-row">
      {!compact && <span className="vt-label">{label}</span>}
      <input className="vt-input" value={localVal} onChange={e => setLocalVal(e.target.value)}
        onBlur={() => commit(localVal)} onKeyDown={e => e.key === "Enter" && commit(localVal)}
        title={compact ? label : undefined} placeholder={compact ? label : undefined} />
    </div>
  );
}

function rgbToHex(c: string): string {
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return c.startsWith("#") ? c : "#000000";
  return "#" + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// LayerTree panel
// ---------------------------------------------------------------------------

function LayerTree({ nodes, onRefresh }: { nodes: any[]; onRefresh: () => void }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 11 }}>DOM Tree</span>
        <button className="vt-btn" onClick={onRefresh}>Refresh</button>
      </div>
      {nodes.length === 0 ? (
        <div className="vt-empty" style={{ height: "auto", padding: 24 }}>Loading...</div>
      ) : (
        nodes.map((n, i) => <TreeNode key={i} node={n} depth={0} />)
      )}
    </div>
  );
}

function TreeNode({ node, depth }: { node: any; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children?.length > 0;
  return (
    <div>
      <div
        style={{
          paddingLeft: depth * 14, display: "flex", alignItems: "center", gap: 4,
          padding: "2px 4px 2px " + (depth * 14 + 4) + "px", cursor: "pointer",
          borderRadius: 3, fontSize: 11, color: "var(--vt-text)",
        }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren && <span style={{ fontSize: 8, width: 10, opacity: 0.5 }}>{open ? "▼" : "▶"}</span>}
        {!hasChildren && <span style={{ width: 10 }} />}
        <span style={{ color: "var(--vt-accent)" }}>{node.tag}</span>
        {node.id && <span style={{ color: "#e06c75" }}>#{node.id}</span>}
        {node.text && <span style={{ color: "var(--vt-text-secondary)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{node.text}</span>}
      </div>
      {open && hasChildren && node.children.map((c: any, i: number) => (
        <TreeNode key={i} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspect panel (computed styles view)
// ---------------------------------------------------------------------------

function InspectPanel({ element, styles }: { element: ElementInfo; styles: Record<string, string> }) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <span className="vt-tag">&lt;{element.tagName}&gt;</span>
        {element.classList.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {element.classList.slice(0, 10).map(c => (
              <span key={c} className="vt-tag" style={{ fontSize: 10 }}>.{c}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontFamily: "var(--vt-font-mono)", fontSize: 10 }}>
        {Object.entries(styles).map(([prop, val]) => (
          <div key={prop} style={{ display: "flex", padding: "2px 0", borderBottom: "1px solid var(--vt-border-subtle)" }}>
            <span style={{ color: "var(--vt-accent)", minWidth: 140 }}>{prop.replace(/([A-Z])/g, "-$1").toLowerCase()}</span>
            <span style={{ color: "var(--vt-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accessibility panel
// ---------------------------------------------------------------------------

function A11yPanel({ issues, onRefresh }: { issues: any[]; onRefresh: () => void }) {
  const errors = issues.filter(i => i.type === "error");
  const warnings = issues.filter(i => i.type === "warning");
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 11 }}>Accessibility Audit</span>
        <button className="vt-btn" onClick={onRefresh}>Re-scan</button>
      </div>

      {issues.length === 0 ? (
        <div className="vt-empty" style={{ height: "auto", padding: 24 }}>No issues found</div>
      ) : (
        <>
          {errors.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", marginBottom: 6 }}>
                Errors ({errors.length})
              </div>
              {errors.map((issue, i) => <IssueRow key={i} issue={issue} />)}
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b", marginBottom: 6 }}>
                Warnings ({warnings.length})
              </div>
              {warnings.map((issue, i) => <IssueRow key={i} issue={issue} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: any }) {
  return (
    <div style={{
      padding: "6px 8px", marginBottom: 4, borderRadius: 4,
      background: "var(--vt-bg-secondary)", fontSize: 11,
      borderLeft: `3px solid ${issue.type === "error" ? "#ef4444" : "#f59e0b"}`,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{issue.label}</div>
      <div style={{ color: "var(--vt-text-secondary)" }}>{issue.detail}</div>
    </div>
  );
}
