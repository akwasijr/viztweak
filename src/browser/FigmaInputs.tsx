import React, { useState, useCallback, useRef, useEffect } from "react";
import { IconChevronDown, IconChevronRight, IconPlus, IconEye, IconEyeOff, IconMinus } from "./icons.js";

// ─── Shared styles ───────────────────────────────────────────

const baseInputStyle: React.CSSProperties = {
  height: "var(--vt-input-height)",
  fontSize: "var(--vt-font-size-value)",
  lineHeight: "var(--vt-line-height)",
  fontFamily: "var(--vt-font)",
  color: "var(--vt-text-primary)",
  background: "var(--vt-input-bg)",
  border: "1px solid var(--vt-input-border)",
  borderRadius: "var(--vt-input-radius)",
  outline: "none",
  padding: "0 6px",
  transition: "border-color var(--vt-transition-fast)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--vt-font-size-label)",
  lineHeight: "var(--vt-line-height)",
  color: "var(--vt-text-secondary)",
  whiteSpace: "nowrap",
  userSelect: "none",
  flexShrink: 0,
};

// ─── 1. NumericInput ─────────────────────────────────────────

interface NumericInputProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}

export function NumericInput({
  value,
  onChange,
  label,
  suffix,
  min,
  max,
  step = 1,
}: NumericInputProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubRef = useRef<{
    startX: number;
    startValue: number;
    active: boolean;
  } | null>(null);

  // Sync when external value changes while not focused
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(String(value));
    }
  }, [value, isFocused]);

  const clamp = useCallback(
    (v: number) => {
      let clamped = v;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      return clamped;
    },
    [min, max],
  );

  const commit = useCallback(
    (raw: string) => {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        const clamped = clamp(parsed);
        onChange(clamped);
        setLocalValue(String(clamped));
      } else {
        setLocalValue(String(value));
      }
    },
    [clamp, onChange, value],
  );

  // Drag-to-scrub on label
  const handleLabelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      scrubRef.current = { startX: e.clientX, startValue: value, active: true };

      const handleMouseMove = (me: MouseEvent) => {
        if (!scrubRef.current) return;
        const dx = me.clientX - scrubRef.current.startX;
        const sensitivity = me.shiftKey ? 0.1 : 1;
        const delta = Math.round(dx * sensitivity) * step;
        const next = clamp(scrubRef.current.startValue + delta);
        onChange(next);
      };

      const handleMouseUp = () => {
        scrubRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
      };

      document.body.style.cursor = "ew-resize";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [value, step, clamp, onChange],
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        minWidth: 0,
      }}
    >
      {label && (
        <span
          style={{ ...labelStyle, cursor: "ew-resize" }}
          onMouseDown={handleLabelMouseDown}
          title={`Drag to adjust ${label}`}
        >
          {label}
        </span>
      )}
      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            requestAnimationFrame(() => inputRef.current?.select());
          }}
          onBlur={() => {
            setIsFocused(false);
            commit(localValue);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit(localValue);
              inputRef.current?.blur();
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              const next = clamp(value + step);
              onChange(next);
              setLocalValue(String(next));
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              const next = clamp(value - step);
              onChange(next);
              setLocalValue(String(next));
            }
          }}
          style={{
            ...baseInputStyle,
            width: "100%",
            fontFeatureSettings: '"tnum"',
            fontVariantNumeric: "tabular-nums",
            paddingRight: suffix ? "20px" : "6px",
            borderColor: isFocused
              ? "var(--vt-input-border-focus)"
              : "var(--vt-input-border)",
          }}
        />
        {suffix && (
          <span
            style={{
              position: "absolute",
              right: "6px",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "var(--vt-font-size-label)",
              color: "var(--vt-text-disabled)",
              pointerEvents: "none",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── 2. ColorInput ───────────────────────────────────────────

interface ColorInputProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  opacity?: number;
  onOpacityChange?: (v: number) => void;
}

// Inline checkerboard as data URI for transparency preview
const checkerboard =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">' +
      '<rect width="4" height="4" fill="#ddd"/>' +
      '<rect x="4" y="4" width="4" height="4" fill="#ddd"/>' +
      '<rect x="4" width="4" height="4" fill="#fff"/>' +
      '<rect y="4" width="4" height="4" fill="#fff"/>' +
      "</svg>",
  );

export function ColorInput({
  value,
  onChange,
  label,
  opacity,
  onOpacityChange,
}: ColorInputProps) {
  const [localHex, setLocalHex] = useState(value.replace(/^#/, ""));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setLocalHex(value.replace(/^#/, ""));
    }
  }, [value, isFocused]);

  const commitHex = useCallback(
    (raw: string) => {
      const clean = raw.replace(/^#/, "").slice(0, 6);
      if (/^[0-9a-fA-F]{6}$/.test(clean)) {
        onChange("#" + clean.toUpperCase());
        setLocalHex(clean.toUpperCase());
      } else if (/^[0-9a-fA-F]{3}$/.test(clean)) {
        const expanded = clean
          .split("")
          .map((c) => c + c)
          .join("");
        onChange("#" + expanded.toUpperCase());
        setLocalHex(expanded.toUpperCase());
      } else {
        setLocalHex(value.replace(/^#/, "").toUpperCase());
      }
    },
    [onChange, value],
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        minWidth: 0,
      }}
    >
      {label && <span style={labelStyle}>{label}</span>}

      {/* Color swatch (click opens native picker) */}
      <div
        style={{
          width: "16px",
          height: "16px",
          borderRadius: "3px",
          border: "1px solid var(--vt-border)",
          backgroundImage: `url("${checkerboard}")`,
          backgroundSize: "8px 8px",
          position: "relative",
          flexShrink: 0,
          cursor: "pointer",
          overflow: "hidden",
        }}
        onClick={() => nativeRef.current?.click()}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: value.startsWith("#") ? value : `#${value}`,
            opacity: opacity !== undefined ? opacity / 100 : 1,
          }}
        />
        <input
          ref={nativeRef}
          type="color"
          value={value.startsWith("#") ? value : `#${value}`}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
            setLocalHex(e.target.value.replace(/^#/, "").toUpperCase());
          }}
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            width: "100%",
            height: "100%",
            cursor: "pointer",
            border: "none",
            padding: 0,
          }}
        />
      </div>

      {/* Hex input */}
      <input
        ref={inputRef}
        type="text"
        value={localHex}
        maxLength={6}
        onChange={(e) =>
          setLocalHex(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))
        }
        onFocus={() => {
          setIsFocused(true);
          requestAnimationFrame(() => inputRef.current?.select());
        }}
        onBlur={() => {
          setIsFocused(false);
          commitHex(localHex);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commitHex(localHex);
            inputRef.current?.blur();
          }
        }}
        style={{
          ...baseInputStyle,
          flex: 1,
          minWidth: "48px",
          fontFeatureSettings: '"tnum"',
          fontVariantNumeric: "tabular-nums",
          textTransform: "uppercase",
          borderColor: isFocused
            ? "var(--vt-input-border-focus)"
            : "var(--vt-input-border)",
        }}
      />

      {/* Opacity input */}
      {onOpacityChange && (
        <div style={{ position: "relative", width: "42px", flexShrink: 0 }}>
          <input
            type="text"
            value={opacity !== undefined ? String(Math.round(opacity)) : "100"}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) {
                onOpacityChange(Math.max(0, Math.min(100, v)));
              }
            }}
            onFocus={(e) =>
              requestAnimationFrame(() =>
                (e.target as HTMLInputElement).select(),
              )
            }
            style={{
              ...baseInputStyle,
              width: "100%",
              fontFeatureSettings: '"tnum"',
              fontVariantNumeric: "tabular-nums",
              paddingRight: "16px",
            }}
          />
          <span
            style={{
              position: "absolute",
              right: "4px",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "var(--vt-font-size-label)",
              color: "var(--vt-text-disabled)",
              pointerEvents: "none",
            }}
          >
            %
          </span>
        </div>
      )}
    </div>
  );
}

// ─── 3. SelectInput ──────────────────────────────────────────

interface SelectInputProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
}

export function SelectInput({
  value,
  onChange,
  options,
  label,
}: SelectInputProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        minWidth: 0,
      }}
    >
      {label && <span style={labelStyle}>{label}</span>}
      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...baseInputStyle,
            width: "100%",
            paddingRight: "20px",
            appearance: "none",
            cursor: "pointer",
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span
          style={{
            position: "absolute",
            right: "4px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "var(--vt-text-secondary)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <IconChevronDown size={12} />
        </span>
      </div>
    </div>
  );
}

// ─── 4. ToggleGroup ──────────────────────────────────────────

interface ToggleGroupProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; icon: React.ReactNode; tooltip?: string }[];
}

export function ToggleGroup({ value, onChange, options }: ToggleGroupProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1px",
        background: "var(--vt-border)",
        borderRadius: "var(--vt-input-radius)",
        overflow: "hidden",
      }}
    >
      {options.map((opt, i) => {
        const isActive = opt.value === value;
        const isHovered = hoveredIdx === i;
        return (
          <button
            key={opt.value}
            title={opt.tooltip}
            onClick={() => onChange(opt.value)}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "var(--vt-input-height)",
              height: "var(--vt-input-height)",
              border: "none",
              cursor: "pointer",
              padding: 0,
              background: isActive
                ? "var(--vt-accent-bg)"
                : isHovered
                  ? "var(--vt-hover)"
                  : "var(--vt-surface)",
              color: isActive
                ? "var(--vt-accent)"
                : "var(--vt-text-secondary)",
              transition:
                "background var(--vt-transition-fast), color var(--vt-transition-fast)",
            }}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

// ─── 5. SectionHeader ────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  actionIcon?: React.ReactNode;
}

export function SectionHeader({
  title,
  expanded,
  onToggle,
  onAdd,
  actionIcon,
}: SectionHeaderProps) {
  const [hovered, setHovered] = useState(false);
  const [addHovered, setAddHovered] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "var(--vt-section-header-height)",
        padding: "0 12px 0 8px",
        cursor: "pointer",
        userSelect: "none",
        background: hovered ? "var(--vt-hover)" : "transparent",
        transition: "background var(--vt-transition-fast)",
      }}
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "16px",
          height: "16px",
          color: "var(--vt-text-secondary)",
          transition: "transform var(--vt-transition-fast)",
          transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
          flexShrink: 0,
        }}
      >
        <IconChevronDown size={12} />
      </span>

      <span
        style={{
          fontSize: "var(--vt-font-size-section)",
          fontWeight: "var(--vt-font-weight-semibold)" as unknown as number,
          color: "var(--vt-text-primary)",
          flex: 1,
          marginLeft: "4px",
        }}
      >
        {title}
      </span>

      {onAdd && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          onMouseEnter={() => setAddHovered(true)}
          onMouseLeave={() => setAddHovered(false)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "20px",
            height: "20px",
            border: "none",
            background: addHovered ? "var(--vt-hover)" : "transparent",
            borderRadius: "var(--vt-input-radius)",
            cursor: "pointer",
            color: "var(--vt-text-secondary)",
            padding: 0,
            transition: "background var(--vt-transition-fast)",
          }}
        >
          {actionIcon || <IconPlus size={12} />}
        </button>
      )}
    </div>
  );
}

// ─── 6. DualInput ────────────────────────────────────────────

interface DualInputProps {
  leftLabel: string;
  leftValue: number;
  onLeftChange: (v: number) => void;
  rightLabel: string;
  rightValue: number;
  onRightChange: (v: number) => void;
  leftSuffix?: string;
  rightSuffix?: string;
  leftMin?: number;
  leftMax?: number;
  rightMin?: number;
  rightMax?: number;
  step?: number;
}

export function DualInput({
  leftLabel,
  leftValue,
  onLeftChange,
  rightLabel,
  rightValue,
  onRightChange,
  leftSuffix,
  rightSuffix,
  leftMin,
  leftMax,
  rightMin,
  rightMax,
  step,
}: DualInputProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <NumericInput
          label={leftLabel}
          value={leftValue}
          onChange={onLeftChange}
          suffix={leftSuffix}
          min={leftMin}
          max={leftMax}
          step={step}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <NumericInput
          label={rightLabel}
          value={rightValue}
          onChange={onRightChange}
          suffix={rightSuffix}
          min={rightMin}
          max={rightMax}
          step={step}
        />
      </div>
    </div>
  );
}

// ─── 7. CheckboxRow ──────────────────────────────────────────

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckboxRow({ label, checked, onChange }: CheckboxRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        cursor: "pointer",
        padding: "2px 0",
        borderRadius: "4px",
        userSelect: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          width: "14px",
          height: "14px",
          borderRadius: "3px",
          border: `1px solid ${checked ? "var(--vt-accent)" : "var(--vt-input-border)"}`,
          background: checked ? "var(--vt-accent)" : "var(--vt-input-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all var(--vt-transition-fast)",
          flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5l2.5 2.5L8 3"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(!checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <span
        style={{
          fontSize: "var(--vt-font-size-label)",
          color: hovered ? "var(--vt-text-primary)" : "var(--vt-text-secondary)",
          transition: "color var(--vt-transition-fast)",
        }}
      >
        {label}
      </span>
    </label>
  );
}

// ─── 8. AlignmentGrid ────────────────────────────────────────

interface AlignmentGridProps {
  justify: string;
  align: string;
  onChange: (justify: string, align: string) => void;
}

const ALIGN_VALS = ["flex-start", "center", "flex-end"] as const;

export function AlignmentGrid({ justify, align, onChange }: AlignmentGridProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 12px)",
        gridTemplateRows: "repeat(3, 12px)",
        gap: "4px",
        padding: "4px",
        background: "var(--vt-input-bg)",
        borderRadius: "var(--vt-input-radius)",
        border: "1px solid var(--vt-input-border)",
      }}
    >
      {ALIGN_VALS.map((rowVal) =>
        ALIGN_VALS.map((colVal) => {
          const isActive = align === rowVal && justify === colVal;
          const cellKey = `${rowVal}-${colVal}`;
          const isHovered = hoveredCell === cellKey;
          return (
            <button
              key={cellKey}
              onClick={() => onChange(colVal, rowVal)}
              onMouseEnter={() => setHoveredCell(cellKey)}
              onMouseLeave={() => setHoveredCell(null)}
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                padding: 0,
                background: isActive
                  ? "var(--vt-accent)"
                  : isHovered
                    ? "var(--vt-text-secondary)"
                    : "var(--vt-text-disabled)",
                transition: "background var(--vt-transition-fast)",
                transform: isActive ? "scale(1.15)" : "scale(1)",
              }}
              title={`${colVal} / ${rowVal}`}
            />
          );
        }),
      )}
    </div>
  );
}

// ─── 9. FillRow ──────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "20px",
  height: "20px",
  border: "none",
  background: "transparent",
  borderRadius: "4px",
  cursor: "pointer",
  color: "var(--vt-text-secondary)",
  padding: 0,
  flexShrink: 0,
  transition: "background var(--vt-transition-fast), color var(--vt-transition-fast)",
};

interface FillRowProps {
  color: string;
  onChange: (hex: string) => void;
  visible: boolean;
  onVisibilityToggle: () => void;
  onRemove: () => void;
  opacity?: number;
  onOpacityChange?: (v: number) => void;
}

export function FillRow({
  color,
  onChange,
  visible,
  onVisibilityToggle,
  onRemove,
  opacity,
  onOpacityChange,
}: FillRowProps) {
  const [eyeHovered, setEyeHovered] = useState(false);
  const [removeHovered, setRemoveHovered] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <div style={{ flex: 1, minWidth: 0, opacity: visible ? 1 : 0.4 }}>
        <ColorInput
          value={color}
          onChange={onChange}
          opacity={opacity}
          onOpacityChange={onOpacityChange}
        />
      </div>
      <button
        onClick={onVisibilityToggle}
        onMouseEnter={() => setEyeHovered(true)}
        onMouseLeave={() => setEyeHovered(false)}
        style={{
          ...iconBtnStyle,
          background: eyeHovered ? "var(--vt-hover)" : "transparent",
          color: visible ? "var(--vt-text-secondary)" : "var(--vt-text-disabled)",
        }}
        title={visible ? "Hide fill" : "Show fill"}
      >
        {visible ? <IconEye size={12} /> : <IconEyeOff size={12} />}
      </button>
      <button
        onClick={onRemove}
        onMouseEnter={() => setRemoveHovered(true)}
        onMouseLeave={() => setRemoveHovered(false)}
        style={{
          ...iconBtnStyle,
          background: removeHovered ? "var(--vt-hover)" : "transparent",
        }}
        title="Remove fill"
      >
        <IconMinus size={12} />
      </button>
    </div>
  );
}
