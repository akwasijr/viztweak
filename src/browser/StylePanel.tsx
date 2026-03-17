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
  DualInput,
  CheckboxRow,
  AlignmentGrid,
  FillRow,
} from "./FigmaInputs.js";
import {
  IconTextAlignLeft,
  IconTextAlignCenter,
  IconTextAlignRight,
  IconTextAlignJustify,
  IconCornerRadius,
  IconLayoutRow,
  IconLayoutColumn,
  IconGrid,
  IconGear,
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
    position: true,
    layout: true,
    padding: true,
    dimensions: true,
    sizing: false,
    appearance: true,
    fill: true,
    stroke: true,
    typography: true,
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
  const [fillVisible, setFillVisible] = useState(true);

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

  // Layout (flex/grid)
  const displayVal = cs.display;
  const isFlexOrGrid = displayVal === "flex" || displayVal === "inline-flex" || displayVal === "grid" || displayVal === "inline-grid";
  const [flexDirection, setFlexDirection] = useState(() => cs.flexDirection || "row");
  const [justifyContent, setJustifyContent] = useState(() => cs.justifyContent || "flex-start");
  const [alignItems, setAlignItems] = useState(() => cs.alignItems || "flex-start");

  // Sizing modes
  const [fillWidth, setFillWidth] = useState(false);
  const [hugWidth, setHugWidth] = useState(false);
  const [fillHeight, setFillHeight] = useState(false);
  const [hugHeight, setHugHeight] = useState(false);

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
      {/* ── Position section ── */}
      <SectionHeader
        title="Position"
        expanded={expandedSections.position}
        onToggle={() => toggleSection("position")}
      />
      {expandedSections.position && (
        <div style={sectionBodyStyle}>
          <DualInput
            leftLabel="X"
            leftValue={x}
            onLeftChange={(v) => {
              setX(v);
              apply("left", v + "px");
            }}
            rightLabel="Y"
            rightValue={y}
            onRightChange={(v) => {
              setY(v);
              apply("top", v + "px");
            }}
          />
          <NumericInput
            label="R"
            value={rotation}
            suffix={"\u00B0"}
            onChange={(v) => {
              setRotation(v);
              apply("transform", "rotate(" + v + "deg)");
            }}
          />
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── Layout section (only for flex/grid containers) ── */}
      {isFlexOrGrid && (
        <>
          <SectionHeader
            title="Layout"
            expanded={expandedSections.layout}
            onToggle={() => toggleSection("layout")}
          />
          {expandedSections.layout && (
            <div style={sectionBodyStyle}>
              <div style={rowStyle}>
                <ToggleGroup
                  value={flexDirection}
                  onChange={(v) => {
                    setFlexDirection(v);
                    apply("flex-direction", v);
                  }}
                  options={[
                    { value: "row", icon: <IconLayoutRow size={12} />, tooltip: "Row" },
                    { value: "column", icon: <IconLayoutColumn size={12} />, tooltip: "Column" },
                    { value: "wrap", icon: <IconGrid size={12} />, tooltip: "Wrap" },
                  ]}
                />
                <div style={{ marginLeft: "8px" }}>
                  <AlignmentGrid
                    justify={justifyContent}
                    align={alignItems}
                    onChange={(j, a) => {
                      setJustifyContent(j);
                      setAlignItems(a);
                      apply("justify-content", j);
                      apply("align-items", a);
                    }}
                  />
                </div>
              </div>
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
          )}
          <div style={dividerStyle} />
        </>
      )}

      {/* ── Padding section ── */}
      <SectionHeader
        title="Padding"
        expanded={expandedSections.padding}
        onToggle={() => toggleSection("padding")}
        onAdd={() => {}}
        actionIcon={<IconGear size={12} />}
      />
      {expandedSections.padding && (
        <div style={sectionBodyStyle}>
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
                value={padTop}
                min={0}
                onChange={(v) => {
                  setPadTop(v);
                  apply("padding-top", v + "px");
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
          {/* Margin */}
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
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── Dimensions section ── */}
      <SectionHeader
        title="Dimensions"
        expanded={expandedSections.dimensions}
        onToggle={() => toggleSection("dimensions")}
      />
      {expandedSections.dimensions && (
        <div style={sectionBodyStyle}>
          <DualInput
            leftLabel="W"
            leftValue={w}
            onLeftChange={(v) => {
              setW(v);
              apply("width", v + "px");
            }}
            leftMin={0}
            rightLabel="H"
            rightValue={h}
            onRightChange={(v) => {
              setH(v);
              apply("height", v + "px");
            }}
            rightMin={0}
          />
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── Sizing section ── */}
      <SectionHeader
        title="Sizing"
        expanded={expandedSections.sizing}
        onToggle={() => toggleSection("sizing")}
      />
      {expandedSections.sizing && (
        <div style={sectionBodyStyle}>
          <CheckboxRow
            label="Fill width"
            checked={fillWidth}
            onChange={(v) => {
              setFillWidth(v);
              if (v) {
                setHugWidth(false);
                apply("width", "100%");
              } else {
                apply("width", w + "px");
              }
            }}
          />
          <CheckboxRow
            label="Hug width"
            checked={hugWidth}
            onChange={(v) => {
              setHugWidth(v);
              if (v) {
                setFillWidth(false);
                apply("width", "fit-content");
              } else {
                apply("width", w + "px");
              }
            }}
          />
          <CheckboxRow
            label="Fill height"
            checked={fillHeight}
            onChange={(v) => {
              setFillHeight(v);
              if (v) {
                setHugHeight(false);
                apply("height", "100%");
              } else {
                apply("height", h + "px");
              }
            }}
          />
          <CheckboxRow
            label="Hug height"
            checked={hugHeight}
            onChange={(v) => {
              setHugHeight(v);
              if (v) {
                setFillHeight(false);
                apply("height", "auto");
              } else {
                apply("height", h + "px");
              }
            }}
          />
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── Appearance section ── */}
      <SectionHeader
        title="Appearance"
        expanded={expandedSections.appearance}
        onToggle={() => toggleSection("appearance")}
      />
      {expandedSections.appearance && (
        <div style={sectionBodyStyle}>
          <DualInput
            leftLabel="%"
            leftValue={opacity}
            onLeftChange={(v) => {
              setOpacity(v);
              apply("opacity", String(v / 100));
            }}
            leftMin={0}
            leftMax={100}
            leftSuffix="%"
            rightLabel="R"
            rightValue={borderRadius}
            onRightChange={(v) => {
              setBorderRadius(v);
              apply("border-radius", v + "px");
            }}
            rightMin={0}
            rightSuffix="px"
          />
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
            setFillVisible(true);
            setBgColor("#FFFFFF");
            apply("background-color", "#FFFFFF");
          }
        }}
      />
      {expandedSections.fill && showFill && (
        <div style={sectionBodyStyle}>
          <FillRow
            color={bgColor}
            onChange={(hex) => {
              setBgColor(hex);
              if (fillVisible) {
                apply("background-color", hex);
              }
            }}
            visible={fillVisible}
            onVisibilityToggle={() => {
              const next = !fillVisible;
              setFillVisible(next);
              if (next) {
                apply("background-color", bgColor);
              } else {
                apply("background-color", "transparent");
              }
            }}
            onRemove={() => {
              setShowFill(false);
              apply("background-color", "transparent");
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
      <SectionHeader
        title="Stroke"
        expanded={expandedSections.stroke}
        onToggle={() => toggleSection("stroke")}
        onAdd={() => {
          if (!showStroke) {
            setShowStroke(true);
            setBorderWidth(1);
            setBorderColor("#808080");
            setBorderStyle("solid");
            apply("border-width", "1px");
            apply("border-color", "#808080");
            apply("border-style", "solid");
          }
        }}
      />
      {expandedSections.stroke && showStroke && (
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
                  icon: <span style={{ fontSize: "9px", fontWeight: 600 }}>--</span>,
                  tooltip: "Solid",
                },
                {
                  value: "dashed",
                  icon: <span style={{ fontSize: "9px", fontWeight: 600 }}>- -</span>,
                  tooltip: "Dashed",
                },
                {
                  value: "dotted",
                  icon: <span style={{ fontSize: "9px", fontWeight: 600 }}>...</span>,
                  tooltip: "Dotted",
                },
              ]}
            />
          </div>
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── Typography section (text elements only) ── */}
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
              <DualInput
                leftLabel="Sz"
                leftValue={fontSize}
                onLeftChange={(v) => {
                  setFontSize(v);
                  apply("font-size", v + "px");
                }}
                leftSuffix="px"
                leftMin={1}
                rightLabel="LH"
                rightValue={lineHeight}
                onRightChange={(v) => {
                  setLineHeight(v);
                  apply("line-height", v + "px");
                }}
                rightSuffix="px"
                rightMin={0}
              />
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

      {/* ── Effects section ── */}
      <SectionHeader
        title="Effects"
        expanded={expandedSections.effects}
        onToggle={() => toggleSection("effects")}
        onAdd={() => {}}
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
          {/* Gap (non-flex/grid context) */}
          {!isFlexOrGrid && (
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
          )}
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
