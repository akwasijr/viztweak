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
  IconAlignLeft,
  IconAlignCenterH,
  IconAlignRight,
  IconAlignTop,
  IconAlignCenterV,
  IconAlignBottom,
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
  gap: "6px",
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
    margin: true,
    size: true,
    appearance: true,
    fill: true,
    border: true,
    shadow: false,
    typography: true,
    filters: false,
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
  const [display, setDisplay] = useState(() => cs.display || "block");
  const isFlexOrGrid = display === "flex" || display === "inline-flex" || display === "grid" || display === "inline-grid";
  const [flexDirection, setFlexDirection] = useState(() => cs.flexDirection || "row");
  const [justifyContent, setJustifyContent] = useState(() => cs.justifyContent || "flex-start");
  const [alignItems, setAlignItems] = useState(() => cs.alignItems || "flex-start");
  const [flexWrap, setFlexWrap] = useState(() => cs.flexWrap || "nowrap");
  const [flexReverse, setFlexReverse] = useState(() =>
    cs.flexDirection === "row-reverse" || cs.flexDirection === "column-reverse" ? "yes" : "no"
  );

  // Position type
  const [positionType, setPositionType] = useState(() => cs.position || "static");

  // Sizing modes
  const [fillWidth, setFillWidth] = useState(false);
  const [hugWidth, setHugWidth] = useState(false);
  const [fillHeight, setFillHeight] = useState(false);
  const [hugHeight, setHugHeight] = useState(false);

  // Padding/Margin detail expand
  const [showPadDetail, setShowPadDetail] = useState(false);
  const [showMarDetail, setShowMarDetail] = useState(false);

  // Appearance extras
  const [zIndex, setZIndex] = useState(() => cs.zIndex === "auto" ? "auto" : cs.zIndex);
  const [overflow, setOverflow] = useState(() => cs.overflow || "visible");
  const [showRadiusDetail, setShowRadiusDetail] = useState(false);
  const [radiusTL, setRadiusTL] = useState(() => px(cs.borderTopLeftRadius));
  const [radiusTR, setRadiusTR] = useState(() => px(cs.borderTopRightRadius));
  const [radiusBR, setRadiusBR] = useState(() => px(cs.borderBottomRightRadius));
  const [radiusBL, setRadiusBL] = useState(() => px(cs.borderBottomLeftRadius));

  // Shadow
  const [boxShadow, setBoxShadow] = useState(() => cs.boxShadow === "none" ? "" : cs.boxShadow);

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

  // Style helpers
  const sectionLabelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--vt-text-primary)",
  };

  const subLabelStyle: React.CSSProperties = {
    fontSize: "var(--vt-font-size-label)",
    color: "var(--vt-text-secondary)",
    fontWeight: 400,
  };

  const expandBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    border: "none",
    background: "transparent",
    borderRadius: "var(--vt-input-radius)",
    cursor: "pointer",
    color: "var(--vt-text-secondary)",
    padding: 0,
    fontSize: "11px",
    flexShrink: 0,
  };

  // Width/Height select options
  const widthOptions = [
    { value: w + "px", label: w + "px" },
    { value: "100%", label: "Fill" },
    { value: "auto", label: "Auto" },
    { value: "fit-content", label: "Hug" },
  ];
  const heightOptions = [
    { value: h + "px", label: h + "px" },
    { value: "100%", label: "Fill" },
    { value: "auto", label: "Auto" },
    { value: "fit-content", label: "Hug" },
  ];

  const currentWidthValue = fillWidth ? "100%" : hugWidth ? "fit-content" : w + "px";
  const currentHeightValue = fillHeight ? "100%" : hugHeight ? "fit-content" : h + "px";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        flexShrink: 0,
      }}
    >
      {/* ── 1. Position section ── */}
      <SectionHeader
        title="Position"
        expanded={expandedSections.position}
        onToggle={() => toggleSection("position")}
      />
      {expandedSections.position && (
        <div style={sectionBodyStyle}>
          {/* Alignment pill */}
          <div style={rowStyle}>
            <ToggleGroup
              value=""
              onChange={(v) => {
                apply("text-align", v);
              }}
              options={[
                { value: "left", icon: <IconAlignLeft size={12} />, tooltip: "Align Left" },
                { value: "center", icon: <IconAlignCenterH size={12} />, tooltip: "Align Center" },
                { value: "right", icon: <IconAlignRight size={12} />, tooltip: "Align Right" },
              ]}
            />
            <div style={{ width: "4px" }} />
            <ToggleGroup
              value=""
              onChange={(v) => {
                apply("vertical-align", v);
              }}
              options={[
                { value: "top", icon: <IconAlignTop size={12} />, tooltip: "Align Top" },
                { value: "middle", icon: <IconAlignCenterV size={12} />, tooltip: "Align Middle" },
                { value: "bottom", icon: <IconAlignBottom size={12} />, tooltip: "Align Bottom" },
              ]}
            />
          </div>
          {/* Position type */}
          <div style={rowStyle}>
            <span style={subLabelStyle}>Type</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SelectInput
                value={positionType}
                onChange={(v) => {
                  setPositionType(v);
                  apply("position", v);
                }}
                options={[
                  { value: "static", label: "Static" },
                  { value: "relative", label: "Relative" },
                  { value: "absolute", label: "Absolute" },
                  { value: "fixed", label: "Fixed" },
                  { value: "sticky", label: "Sticky" },
                ]}
              />
            </div>
          </div>
          {/* X / Y */}
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
          {/* Rotation */}
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

      {/* ── 2. Layout section (always shown) ── */}
      <SectionHeader
        title="Layout"
        expanded={expandedSections.layout}
        onToggle={() => toggleSection("layout")}
      />
      {expandedSections.layout && (
        <div style={sectionBodyStyle}>
          {/* Display toggle */}
          <div style={rowStyle}>
            <span style={subLabelStyle}>Display</span>
            <ToggleGroup
              value={display}
              onChange={(v) => {
                setDisplay(v);
                apply("display", v);
              }}
              options={[
                {
                  value: "block",
                  icon: <span style={{ fontSize: "10px", fontWeight: 600, lineHeight: 1 }}>□</span>,
                  tooltip: "Block",
                },
                {
                  value: "inline-flex",
                  icon: <span style={{ fontSize: "10px", fontWeight: 600, lineHeight: 1 }}>□+</span>,
                  tooltip: "Inline Flex",
                },
                {
                  value: "flex",
                  icon: <IconLayoutRow size={12} />,
                  tooltip: "Flex",
                },
                {
                  value: "grid",
                  icon: <IconGrid size={12} />,
                  tooltip: "Grid",
                },
              ]}
            />
          </div>

          {/* Flex/Grid-specific controls */}
          {isFlexOrGrid && (
            <>
              {/* Alignment grid + Gap side by side */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <div>
                  <span style={subLabelStyle}>Alignment</span>
                  <div style={{ marginTop: "4px" }}>
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={subLabelStyle}>Gap</span>
                  <div style={{ marginTop: "4px" }}>
                    <NumericInput
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
              </div>
              {/* Direction toggle */}
              <div style={rowStyle}>
                <span style={subLabelStyle}>Direction</span>
                <ToggleGroup
                  value={flexDirection}
                  onChange={(v) => {
                    setFlexDirection(v);
                    apply("flex-direction", v);
                  }}
                  options={[
                    { value: "row", icon: <IconLayoutRow size={12} />, tooltip: "Row" },
                    { value: "column", icon: <IconLayoutColumn size={12} />, tooltip: "Column" },
                  ]}
                />
              </div>
              {/* Reverse + Wrap */}
              <div style={{ display: "flex", gap: "4px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SelectInput
                    label="Reverse"
                    value={flexReverse}
                    onChange={(v) => {
                      setFlexReverse(v);
                      const base = flexDirection.replace("-reverse", "");
                      const dir = v === "yes" ? base + "-reverse" : base;
                      setFlexDirection(dir);
                      apply("flex-direction", dir);
                    }}
                    options={[
                      { value: "no", label: "No" },
                      { value: "yes", label: "Yes" },
                    ]}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SelectInput
                    label="Wrap"
                    value={flexWrap}
                    onChange={(v) => {
                      setFlexWrap(v);
                      apply("flex-wrap", v);
                    }}
                    options={[
                      { value: "nowrap", label: "Nowrap" },
                      { value: "wrap", label: "Wrap" },
                      { value: "wrap-reverse", label: "Wrap Reverse" },
                    ]}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── 3. Padding section ── */}
      <SectionHeader
        title="Padding"
        expanded={expandedSections.padding}
        onToggle={() => toggleSection("padding")}
      />
      {expandedSections.padding && (
        <div style={sectionBodyStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DualInput
                leftLabel="|○|"
                leftValue={padLeft}
                onLeftChange={(v) => {
                  setPadLeft(v);
                  setPadRight(v);
                  apply("padding-left", v + "px");
                  apply("padding-right", v + "px");
                }}
                leftMin={0}
                rightLabel="≡"
                rightValue={padTop}
                onRightChange={(v) => {
                  setPadTop(v);
                  setPadBottom(v);
                  apply("padding-top", v + "px");
                  apply("padding-bottom", v + "px");
                }}
                rightMin={0}
              />
            </div>
            <button
              title={showPadDetail ? "Collapse" : "Expand individual sides"}
              onClick={() => setShowPadDetail(!showPadDetail)}
              style={expandBtnStyle}
            >
              ⌐⌐
            </button>
          </div>
          {showPadDetail && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
              <NumericInput
                label="T"
                value={padTop}
                min={0}
                onChange={(v) => {
                  setPadTop(v);
                  apply("padding-top", v + "px");
                }}
              />
              <NumericInput
                label="R"
                value={padRight}
                min={0}
                onChange={(v) => {
                  setPadRight(v);
                  apply("padding-right", v + "px");
                }}
              />
              <NumericInput
                label="B"
                value={padBottom}
                min={0}
                onChange={(v) => {
                  setPadBottom(v);
                  apply("padding-bottom", v + "px");
                }}
              />
              <NumericInput
                label="L"
                value={padLeft}
                min={0}
                onChange={(v) => {
                  setPadLeft(v);
                  apply("padding-left", v + "px");
                }}
              />
            </div>
          )}
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── 4. Margin section ── */}
      <SectionHeader
        title="Margin"
        expanded={expandedSections.margin}
        onToggle={() => toggleSection("margin")}
      />
      {expandedSections.margin && (
        <div style={sectionBodyStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DualInput
                leftLabel="|○|"
                leftValue={marLeft}
                onLeftChange={(v) => {
                  setMarLeft(v);
                  setMarRight(v);
                  apply("margin-left", v + "px");
                  apply("margin-right", v + "px");
                }}
                rightLabel="≡"
                rightValue={marTop}
                onRightChange={(v) => {
                  setMarTop(v);
                  setMarBottom(v);
                  apply("margin-top", v + "px");
                  apply("margin-bottom", v + "px");
                }}
              />
            </div>
            <button
              title={showMarDetail ? "Collapse" : "Expand individual sides"}
              onClick={() => setShowMarDetail(!showMarDetail)}
              style={expandBtnStyle}
            >
              ⌐⌐
            </button>
          </div>
          {showMarDetail && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
              <NumericInput
                label="T"
                value={marTop}
                min={0}
                onChange={(v) => {
                  setMarTop(v);
                  apply("margin-top", v + "px");
                }}
              />
              <NumericInput
                label="R"
                value={marRight}
                min={0}
                onChange={(v) => {
                  setMarRight(v);
                  apply("margin-right", v + "px");
                }}
              />
              <NumericInput
                label="B"
                value={marBottom}
                min={0}
                onChange={(v) => {
                  setMarBottom(v);
                  apply("margin-bottom", v + "px");
                }}
              />
              <NumericInput
                label="L"
                value={marLeft}
                min={0}
                onChange={(v) => {
                  setMarLeft(v);
                  apply("margin-left", v + "px");
                }}
              />
            </div>
          )}
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── 5. Size section ── */}
      <SectionHeader
        title="Size"
        expanded={expandedSections.size}
        onToggle={() => toggleSection("size")}
        onAdd={() => {}}
      />
      {expandedSections.size && (
        <div style={sectionBodyStyle}>
          <div style={{ display: "flex", gap: "4px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={subLabelStyle}>Width</span>
              <div style={{ marginTop: "2px" }}>
                <SelectInput
                  value={currentWidthValue}
                  onChange={(v) => {
                    if (v === "100%") {
                      setFillWidth(true);
                      setHugWidth(false);
                    } else if (v === "fit-content") {
                      setFillWidth(false);
                      setHugWidth(true);
                    } else if (v === "auto") {
                      setFillWidth(false);
                      setHugWidth(false);
                    } else {
                      setFillWidth(false);
                      setHugWidth(false);
                    }
                    apply("width", v);
                  }}
                  options={widthOptions}
                />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={subLabelStyle}>Height</span>
              <div style={{ marginTop: "2px" }}>
                <SelectInput
                  value={currentHeightValue}
                  onChange={(v) => {
                    if (v === "100%") {
                      setFillHeight(true);
                      setHugHeight(false);
                    } else if (v === "fit-content") {
                      setFillHeight(false);
                      setHugHeight(true);
                    } else if (v === "auto") {
                      setFillHeight(false);
                      setHugHeight(false);
                    } else {
                      setFillHeight(false);
                      setHugHeight(false);
                    }
                    apply("height", v);
                  }}
                  options={heightOptions}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── 6. Appearance section ── */}
      <SectionHeader
        title="Appearance"
        expanded={expandedSections.appearance}
        onToggle={() => toggleSection("appearance")}
      />
      {expandedSections.appearance && (
        <div style={sectionBodyStyle}>
          {/* Opacity + Z-index */}
          <div style={{ display: "flex", gap: "4px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={subLabelStyle}>Opacity</span>
              <div style={{ marginTop: "2px" }}>
                <NumericInput
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={subLabelStyle}>Z index</span>
              <div style={{ marginTop: "2px" }}>
                <input
                  value={zIndex}
                  onChange={(e) => {
                    const val = e.target.value;
                    setZIndex(val);
                    apply("z-index", val);
                  }}
                  style={{
                    width: "100%",
                    height: "var(--vt-input-height)",
                    background: "var(--vt-input-bg)",
                    border: "1px solid var(--vt-border)",
                    borderRadius: "var(--vt-input-radius)",
                    color: "var(--vt-text-primary)",
                    fontSize: "var(--vt-font-size-input)",
                    padding: "0 6px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>
          {/* Corner radius */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ display: "flex", alignItems: "center", color: "var(--vt-text-secondary)", flexShrink: 0 }}>
              <IconCornerRadius size={12} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <NumericInput
                value={borderRadius}
                suffix="px"
                min={0}
                onChange={(v) => {
                  setBorderRadius(v);
                  setRadiusTL(v);
                  setRadiusTR(v);
                  setRadiusBR(v);
                  setRadiusBL(v);
                  apply("border-radius", v + "px");
                }}
              />
            </div>
            <button
              title={showRadiusDetail ? "Collapse" : "Expand individual corners"}
              onClick={() => setShowRadiusDetail(!showRadiusDetail)}
              style={expandBtnStyle}
            >
              ⌐⌐
            </button>
          </div>
          {showRadiusDetail && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
              <NumericInput
                label="TL"
                value={radiusTL}
                suffix="px"
                min={0}
                onChange={(v) => {
                  setRadiusTL(v);
                  apply("border-top-left-radius", v + "px");
                }}
              />
              <NumericInput
                label="TR"
                value={radiusTR}
                suffix="px"
                min={0}
                onChange={(v) => {
                  setRadiusTR(v);
                  apply("border-top-right-radius", v + "px");
                }}
              />
              <NumericInput
                label="BR"
                value={radiusBR}
                suffix="px"
                min={0}
                onChange={(v) => {
                  setRadiusBR(v);
                  apply("border-bottom-right-radius", v + "px");
                }}
              />
              <NumericInput
                label="BL"
                value={radiusBL}
                suffix="px"
                min={0}
                onChange={(v) => {
                  setRadiusBL(v);
                  apply("border-bottom-left-radius", v + "px");
                }}
              />
            </div>
          )}
          {/* Overflow */}
          <div style={rowStyle}>
            <span style={subLabelStyle}>Overflow</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SelectInput
                value={overflow}
                onChange={(v) => {
                  setOverflow(v);
                  apply("overflow", v);
                }}
                options={[
                  { value: "visible", label: "Visible" },
                  { value: "hidden", label: "Hidden" },
                  { value: "scroll", label: "Scroll" },
                  { value: "auto", label: "Auto" },
                ]}
              />
            </div>
          </div>
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── 7. Fill section ── */}
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

      {/* ── 8. Border section ── */}
      <SectionHeader
        title="Border"
        expanded={expandedSections.border}
        onToggle={() => toggleSection("border")}
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
      {expandedSections.border && showStroke && (
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

      {/* ── 9. Shadow section ── */}
      <SectionHeader
        title="Shadow"
        expanded={expandedSections.shadow}
        onToggle={() => toggleSection("shadow")}
        onAdd={() => {
          if (!boxShadow) {
            const defaultShadow = "0px 2px 4px rgba(0,0,0,0.1)";
            setBoxShadow(defaultShadow);
            apply("box-shadow", defaultShadow);
          }
        }}
      />
      {expandedSections.shadow && (
        <div style={sectionBodyStyle}>
          {boxShadow ? (
            <div
              style={{
                fontSize: "var(--vt-font-size-input)",
                color: "var(--vt-text-primary)",
                background: "var(--vt-input-bg)",
                border: "1px solid var(--vt-border)",
                borderRadius: "var(--vt-input-radius)",
                padding: "4px 6px",
                wordBreak: "break-all",
              }}
            >
              {boxShadow}
            </div>
          ) : (
            <span style={{ fontSize: "var(--vt-font-size-label)", color: "var(--vt-text-disabled)" }}>
              No shadow
            </span>
          )}
        </div>
      )}
      <div style={dividerStyle} />

      {/* ── 10. Typography section (text elements only) ── */}
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

      {/* ── 11. Filters section ── */}
      <SectionHeader
        title="Filters"
        expanded={expandedSections.filters}
        onToggle={() => toggleSection("filters")}
        onAdd={() => {}}
      />
      {expandedSections.filters && (
        <div style={sectionBodyStyle}>
          <span style={{ fontSize: "var(--vt-font-size-label)", color: "var(--vt-text-disabled)" }}>
            No filters applied
          </span>
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
