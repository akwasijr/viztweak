import React, { useState, useCallback, useEffect, useRef } from "react";
import { SectionHeader } from "./FigmaInputs.js";

// ─── Types ────────────────────────────────────────────────────

interface ClassEditorProps {
  element: HTMLElement | null;
  onClassChange?: () => void;
}

// ─── Component ────────────────────────────────────────────────

export function ClassEditor({ element, onClassChange }: ClassEditorProps) {
  const [expanded, setExpanded] = useState(true);
  const [classes, setClasses] = useState<string[]>([]);
  const [newClass, setNewClass] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync classes from element
  const syncClasses = useCallback(() => {
    if (!element) {
      setClasses([]);
      return;
    }
    setClasses(Array.from(element.classList));
  }, [element]);

  useEffect(() => {
    syncClasses();
  }, [syncClasses]);

  const addClass = useCallback(
    (cls: string) => {
      const trimmed = cls.trim();
      if (!trimmed || !element) return;
      // Support space-separated multiple classes
      const parts = trimmed.split(/\s+/);
      for (const p of parts) {
        element.classList.add(p);
      }
      syncClasses();
      setNewClass("");
      onClassChange?.();
    },
    [element, syncClasses, onClassChange],
  );

  const removeClass = useCallback(
    (cls: string) => {
      if (!element) return;
      element.classList.remove(cls);
      syncClasses();
      onClassChange?.();
    },
    [element, syncClasses, onClassChange],
  );

  const toggleClass = useCallback(
    (cls: string) => {
      if (!element) return;
      element.classList.toggle(cls);
      syncClasses();
      onClassChange?.();
    },
    [element, syncClasses, onClassChange],
  );

  if (!element) return null;

  return (
    <div>
      <SectionHeader
        title={`Classes (${classes.length})`}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
      {expanded && (
        <div style={{ padding: "4px 12px 8px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {/* Class chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
            {classes.length === 0 && (
              <span style={{ fontSize: "10px", color: "var(--vt-text-disabled)", fontStyle: "italic" }}>
                No classes
              </span>
            )}
            {classes.map((cls) => (
              <span
                key={cls}
                onMouseEnter={() => setHovered(cls)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  height: "20px",
                  padding: "0 6px",
                  borderRadius: "3px",
                  fontSize: "10px",
                  fontFamily: "var(--vt-font)",
                  fontWeight: 500,
                  background: hovered === cls ? "#FEE2E2" : "var(--vt-hover)",
                  color: hovered === cls ? "#B91C1C" : "var(--vt-text-primary)",
                  cursor: "pointer",
                  transition: "all 80ms ease",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                onClick={() => removeClass(cls)}
                title={`Click to remove .${cls}`}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>.{cls}</span>
                {hovered === cls && (
                  <span style={{ fontSize: "9px", flexShrink: 0 }}>✕</span>
                )}
              </span>
            ))}
          </div>

          {/* Add class input */}
          <div style={{ display: "flex", gap: "4px" }}>
            <input
              ref={inputRef}
              type="text"
              value={newClass}
              onChange={(e) => setNewClass(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addClass(newClass);
                }
              }}
              placeholder="Add class..."
              style={{
                flex: 1,
                height: "22px",
                fontSize: "10px",
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
              onClick={() => addClass(newClass)}
              disabled={!newClass.trim()}
              style={{
                height: "22px",
                padding: "0 8px",
                fontSize: "10px",
                fontFamily: "var(--vt-font)",
                fontWeight: 500,
                border: "none",
                borderRadius: "var(--vt-input-radius)",
                cursor: newClass.trim() ? "pointer" : "default",
                background: newClass.trim() ? "var(--vt-accent)" : "var(--vt-hover)",
                color: newClass.trim() ? "#fff" : "var(--vt-text-disabled)",
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
