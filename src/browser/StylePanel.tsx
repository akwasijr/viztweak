import React, { useState, useCallback, useEffect } from "react";
import type { ElementInfo } from "../shared/types.js";
import { ALL_EDITABLE_PROPERTIES } from "../shared/types.js";
import { DiffEngine } from "./DiffEngine.js";
import { WSClient } from "./WSClient.js";
import {
  NumericInput,
  ColorInput,
  SelectInput,
  ToggleGroup,
  SectionHeader,
} from "./FigmaInputs.js";
import {
  IconTextAlignLeft,
  IconTextAlignCenter,
  IconTextAlignRight,
  IconTextAlignJustify,
  IconCornerRadius,
} from "./icons.js";

interface StylePanelProps {
  element: HTMLElement;
  elementInfo: ElementInfo;
  diffEngine: DiffEngine;
  wsClient: WSClient;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function px(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : Math.round(n);
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return "#000000";
  return (
    "#" +
    [m[1], m[2], m[3]]
      .map((c) => parseInt(c, 10).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "span", "a", "label", "button", "li", "td", "th",
  "em", "strong", "b", "i", "small", "blockquote", "figcaption",
]);

function isTextElement(el: HTMLElement): boolean {
  if (TEXT_TAGS.has(el.tagName.toLowerCase())) return true;
  // Check for direct text content
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i];
    if (n.nodeType === Node.TEXT_NODE && (n.textContent?.trim() || "").length > 0) {
      return true;
    }
  }
  return false;
}

function hasBorder(cs: CSSStyleDeclaration): boolean {
  const w = parseFloat(cs.borderTopWidth) || 0;
  return w > 0;
}

function hasFill(cs: CSSStyleDeclaration): boolean {
  const bg = cs.backgroundColor;
  if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return false;
  return true;
}

// ─── Section wrapper ──────────────────────────────────────────

const sectionBodyStyle: React.CSSProperties = {
  padding: "4px 12px 8px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

const dividerStyle: React.CSSProperties = {
  height: "1px",
  background: "var(--vt-border)",
  margin: 0,
};

// ─── Weight options for Select ────────────────────────────────

const WEIGHT_OPTIONS = [
  { value: "100", label: "Thin" },
  { value: "200", label: "Extra Light" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "SemiBold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
];

// ─── StylePanel ───────────────────────────────────────────────

export function StylePanel({
  element,
  elementInfo,
  diffEngine,
  wsClient,
  onClose,
}: StylePanelProps) {
  // Read computed styles as initial values
  const cs = window.getComputedStyle(element);

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    frame: true,
    fill: true,
    stroke: true,
    typography: true,
    spacing: true,
    effects: true,
  });

  // Editable values
  const [x, setX] = useState(() => Math.round(element.getBoundingClientRect().left));
  const [y, setY] = useState(() => Math.round(element.getBoundingClientRect().top));
  const [w, setW] = useState(() => px(cs.width));
  const [h, setH] = useState(() => px(cs.height));
  const [rotation, setRotation] = useState(0);
  const [opacity, setOpacity] = useState(() => Math.round(parseFloat(cs.opacity) * 100));

  // Fill
  const [bgColor, setBgColor] = useState(() => rgbToHex(cs.backgroundColor));
  const [showFill, setShowFill] = useState(() => hasFill(cs));

  // Stroke
  const [borderColor, setBorderColor] = useState(() => rgbToHex(cs.borderTopColor));
  const [borderWidth, setBorderWidth] = useState(() => px(cs.borderTopWidth));
  const [borderStyle, setBorderStyle] = useState(() => cs.borderTopStyle || "solid");
  const [showStroke, setShowStroke] = useState(() => hasBorder(cs));

  // Typography
  const [fontWeight, setFontWeight] = useState(() => cs.fontWeight || "400");
  const [fontSize, setFontSize] = useState(() => px(cs.fontSize));
  const [lineHeight, setLineHeight] = useState(() => px(cs.lineHeight));
  const [letterSpacing, setLetterSpacing] = useState(() => px(cs.letterSpacing));
  const [textColor, setTextColor] = useState(() => rgbToHex(cs.color));
  const [textAlign, setTextAlign] = useState(() => cs.textAlign || "left");

  // Spacing
  const [padTop, setPadTop] = useState(() => px(cs.paddingTop));
  const [padRight, setPadRight] = useState(() => px(cs.paddingRight));
  const [padBottom, setPadBottom] = useState(() => px(cs.paddingBottom));
  const [padLeft, setPadLeft] = useState(() => px(cs.paddingLeft));
  const [marTop, setMarTop] = useState(() => px(cs.marginTop));
  const [marRight, setMarRight] = useState(() => px(cs.marginRight));
  const [marBottom, setMarBottom] = useState(() => px(cs.marginBottom));
  const [marLeft, setMarLeft] = useState(() => px(cs.marginLeft));
  const [gap, setGap] = useState(() => px(cs.gap));

  // Effects
  const [borderRadius, setBorderRadius] = useState(() => px(cs.borderRadius));

  const showTypography = isTextElement(element);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Apply a CSS change live and generate diff
  const apply = useCallback(
    (cssProp: string, value: string) => {
      element.style.setProperty(cssProp, value);
      const diff = diffEngine.generateDiff(element);
      if (diff) {
        wsClient.send({ type: "changes_updated", payload: { diffs: [diff] } });
      }
    },
    [element, diffEngine, wsClient],
  );

  // Send initial selection
  useEffect(() => {
    const computed = window.getComputedStyle(element);
    const styles: Record<string, string> = {};
    for (const prop of ALL_EDITABLE_PROPERTIES) {
      const cssName = prop.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
      styles[prop] = computed.getPropertyValue(cssName) || "";
    }
    wsClient.send({
      type: "element_selected",
      payload: { element: elementInfo, computedStyles: styles },
    });
  }, [element, elementInfo, wsClient]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        flexShrink: 0,
      }}
    >
      {/* ── Frame section ── */}
      <SectionHeader
        title="Frame"
        expanded={expandedSections.frame}
        onToggle={() => toggleSection("frame")}
      />
      {expandedSections.frame && (
        <div style={sectionBodyStyle}>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <NumericInput
                label="X"
                value={x}
                onChange={(v) => {
                  setX(v);
                  apply("left", v + "px");
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <NumericInput
                label="Y"
                value={y}
                onChange={(v) => {
                  setY(v);
                  apply("top", v + "px");
                }}
              />
            </div>
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <NumericInput
                label="W"
                value={w}
                onChange={(v) => {
                  setW(v);
                  apply("width", v + "px");
                }}
                min={0}
              />
            </div>
            <div style={{ flex: 1 }}>
              <NumericInput
                label="H"
                value={h}
                onChange={(v) => {
                  setH(v);
                  apply("height", v + "px");
                }}
                min={0}
              />
            </div>
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <NumericInput
                label="R"
                value={rotation}
                suffix="\u00B0"
                onChange={(v) => {
                  setRotation(v);
                  apply("transform", "rotate(" + v + "deg)");
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <NumericInput
                label="%"
                value={opacity}
                suffix="%"
                min={0}
                max={100}
                onChange={(v) => {
                  setOpacity(v);
                  apply("opacity", String(v / 100));
                }}
              />
            </div>
          </div>
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── Fill section ── */}
      <SectionHeader
        title="Fill"
        expanded={expandedSections.fill}
        onToggle={() => toggleSection("fill")}
        onAdd={() => {
          if (!showFill) {
            setShowFill(true);
            setBgColor("#FFFFFF");
            apply("background-color", "#FFFFFF");
          }
        }}
      />
      {expandedSections.fill && showFill && (
        <div style={sectionBodyStyle}>
          <ColorInput
            value={bgColor}
            onChange={(hex) => {
              setBgColor(hex);
              apply("background-color", hex);
            }}
            opacity={opacity}
            onOpacityChange={(v) => {
              setOpacity(v);
              apply("opacity", String(v / 100));
            }}
          />
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── Stroke section ── */}
      {showStroke && (
        <>
          <SectionHeader
            title="Stroke"
            expanded={expandedSections.stroke}
            onToggle={() => toggleSection("stroke")}
          />
          {expandedSections.stroke && (
            <div style={sectionBodyStyle}>
              <ColorInput
                value={borderColor}
                onChange={(hex) => {
                  setBorderColor(hex);
                  apply("border-color", hex);
                }}
              />
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <NumericInput
                    label="W"
                    value={borderWidth}
                    suffix="px"
                    min={0}
                    onChange={(v) => {
                      setBorderWidth(v);
                      apply("border-width", v + "px");
                    }}
                  />
                </div>
                <ToggleGroup
                  value={borderStyle}
                  onChange={(v) => {
                    setBorderStyle(v);
                    apply("border-style", v);
                  }}
                  options={[
                    {
                      value: "solid",
                      icon: <span style={{ fontSize: "9px", fontWeight: 600 }}>—</span>,
                      tooltip: "Solid",
                    },
                    {
                      value: "dashed",
                      icon: <span style={{ fontSize: "9px", fontWeight: 600 }}>- -</span>,
                      tooltip: "Dashed",
                    },
                    {
                      value: "dotted",
                      icon: <span style={{ fontSize: "9px", fontWeight: 600 }}>···</span>,
                      tooltip: "Dotted",
                    },
                  ]}
                />
              </div>
            </div>
          )}
          <div style={dividerStyle} />
        </>
      )}

      {/* ── Typography section ── */}
      {showTypography && (
        <>
          <SectionHeader
            title="Typography"
            expanded={expandedSections.typography}
            onToggle={() => toggleSection("typography")}
          />
          {expandedSections.typography && (
            <div style={sectionBodyStyle}>
              <SelectInput
                label="Wt"
                value={fontWeight}
                options={WEIGHT_OPTIONS}
                onChange={(v) => {
                  setFontWeight(v);
                  apply("font-weight", v);
                }}
              />
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <NumericInput
                    label="Sz"
                    value={fontSize}
                    suffix="px"
                    min={1}
                    onChange={(v) => {
                      setFontSize(v);
                      apply("font-size", v + "px");
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <NumericInput
                    label="LH"
                    value={lineHeight}
                    suffix="px"
                    min={0}
                    onChange={(v) => {
                      setLineHeight(v);
                      apply("line-height", v + "px");
                    }}
                  />
                </div>
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <NumericInput
                    label="LS"
                    value={letterSpacing}
                    suffix="px"
                    step={0.1}
                    onChange={(v) => {
                      setLetterSpacing(v);
                      apply("letter-spacing", v + "px");
                    }}
                  />
                </div>
                <ToggleGroup
                  value={textAlign}
                  onChange={(v) => {
                    setTextAlign(v);
                    apply("text-align", v);
                  }}
                  options={[
                    { value: "left", icon: <IconTextAlignLeft size={12} />, tooltip: "Left" },
                    { value: "center", icon: <IconTextAlignCenter size={12} />, tooltip: "Center" },
                    { value: "right", icon: <IconTextAlignRight size={12} />, tooltip: "Right" },
                    { value: "justify", icon: <IconTextAlignJustify size={12} />, tooltip: "Justify" },
                  ]}
                />
              </div>
              <ColorInput
                label="Color"
                value={textColor}
                onChange={(hex) => {
                  setTextColor(hex);
                  apply("color", hex);
                }}
              />
            </div>
          )}
          <div style={dividerStyle} />
        </>
      )}

      {/* ── Spacing section ── */}
      <SectionHeader
        title="Spacing"
        expanded={expandedSections.spacing}
        onToggle={() => toggleSection("spacing")}
      />
      {expandedSections.spacing && (
        <div style={sectionBodyStyle}>
          {/* Padding box widget */}
          <div
            style={{
              fontSize: "var(--vt-font-size-label)",
              color: "var(--vt-text-secondary)",
              marginBottom: "2px",
              fontWeight: 500,
            }}
          >
            Padding
          </div>
          <div
            style={{
              border: "1px dashed var(--vt-border)",
              borderRadius: "var(--vt-input-radius)",
              padding: "4px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
            }}
          >
            {/* Top */}
            <div style={{ width: "52px" }}>
              <NumericInput
                value={padTop}
                min={0}
                onChange={(v) => {
                  setPadTop(v);
                  apply("padding-top", v + "px");
                }}
              />
            </div>
            {/* Left / Right row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div style={{ width: "52px" }}>
                <NumericInput
                  value={padLeft}
                  min={0}
                  onChange={(v) => {
                    setPadLeft(v);
                    apply("padding-left", v + "px");
                  }}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  height: "16px",
                  margin: "0 4px",
                  border: "1px solid var(--vt-border)",
                  borderRadius: "2px",
                }}
              />
              <div style={{ width: "52px" }}>
                <NumericInput
                  value={padRight}
                  min={0}
                  onChange={(v) => {
                    setPadRight(v);
                    apply("padding-right", v + "px");
                  }}
                />
              </div>
            </div>
            {/* Bottom */}
            <div style={{ width: "52px" }}>
              <NumericInput
                value={padBottom}
                min={0}
                onChange={(v) => {
                  setPadBottom(v);
                  apply("padding-bottom", v + "px");
                }}
              />
            </div>
          </div>

          {/* Margin box widget */}
          <div
            style={{
              fontSize: "var(--vt-font-size-label)",
              color: "var(--vt-text-secondary)",
              marginTop: "4px",
              marginBottom: "2px",
              fontWeight: 500,
            }}
          >
            Margin
          </div>
          <div
            style={{
              border: "1px dashed var(--vt-border)",
              borderRadius: "var(--vt-input-radius)",
              padding: "4px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
            }}
          >
            <div style={{ width: "52px" }}>
              <NumericInput
                value={marTop}
                min={0}
                onChange={(v) => {
                  setMarTop(v);
                  apply("margin-top", v + "px");
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div style={{ width: "52px" }}>
                <NumericInput
                  value={marLeft}
                  min={0}
                  onChange={(v) => {
                    setMarLeft(v);
                    apply("margin-left", v + "px");
                  }}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  height: "16px",
                  margin: "0 4px",
                  border: "1px solid var(--vt-border)",
                  borderRadius: "2px",
                }}
              />
              <div style={{ width: "52px" }}>
                <NumericInput
                  value={marRight}
                  min={0}
                  onChange={(v) => {
                    setMarRight(v);
                    apply("margin-right", v + "px");
                  }}
                />
              </div>
            </div>
            <div style={{ width: "52px" }}>
              <NumericInput
                value={marBottom}
                min={0}
                onChange={(v) => {
                  setMarBottom(v);
                  apply("margin-bottom", v + "px");
                }}
              />
            </div>
          </div>

          {/* Gap */}
          <div style={{ ...rowStyle, marginTop: "4px" }}>
            <NumericInput
              label="Gap"
              value={gap}
              suffix="px"
              min={0}
              onChange={(v) => {
                setGap(v);
                apply("gap", v + "px");
              }}
            />
          </div>
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── Effects section ── */}
      <SectionHeader
        title="Effects"
        expanded={expandedSections.effects}
        onToggle={() => toggleSection("effects")}
      />
      {expandedSections.effects && (
        <div style={sectionBodyStyle}>
          <div style={rowStyle}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                color: "var(--vt-text-secondary)",
                flexShrink: 0,
              }}
            >
              <IconCornerRadius size={12} />
            </span>
            <div style={{ flex: 1 }}>
              <NumericInput
                value={borderRadius}
                suffix="px"
                min={0}
                onChange={(v) => {
                  setBorderRadius(v);
                  apply("border-radius", v + "px");
                }}
              />
            </div>
          </div>
          <NumericInput
            label="Opacity"
            value={opacity}
            suffix="%"
            min={0}
            max={100}
            onChange={(v) => {
              setOpacity(v);
              apply("opacity", String(v / 100));
            }}
          />
        </div>
      )}
      <div style={dividerStyle} />

      {/* Footer */}
      <div
        style={{
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            color: "var(--vt-text-disabled)",
          }}
        >
          {elementInfo.stylingApproach}
        </span>
        <span
          style={{
            fontSize: "9px",
            color: "var(--vt-text-disabled)",
          }}
        >
          viztweak
        </span>
      </div>
    </div>
  );
}
