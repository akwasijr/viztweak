import React, { useState } from "react";
import {
  IconUndo,
  IconRedo,
  IconReset,
  IconCopy,
  IconPaste,
  IconPanelLeft,
  IconPanelRight,
  IconBoxModel,
  IconResponsive,
  IconLayoutGrid,
} from "./icons.js";

// ─── Types ────────────────────────────────────────────────────

interface QuickActionsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onCopyStyles: () => void;
  onPasteStyles: () => void;
  panelSide: "left" | "right";
  onToggleSide: () => void;
  hasCopied: boolean;
  spacingOverlay: boolean;
  onToggleSpacing: () => void;
  responsiveMode: boolean;
  onToggleResponsive: () => void;
  layoutDebugger: boolean;
  onToggleLayout: () => void;
}

// ─── Toolbar Button ───────────────────────────────────────────

interface ToolbarBtnProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

function ToolbarBtn({ icon, tooltip, onClick, disabled = false, active = false }: ToolbarBtnProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        border: "none",
        borderRadius: "var(--vt-input-radius)",
        cursor: disabled ? "default" : "pointer",
        padding: 0,
        background: active
          ? "var(--vt-accent-bg)"
          : hovered && !disabled
            ? "var(--vt-hover)"
            : "transparent",
        color: active
          ? "var(--vt-accent)"
          : disabled
            ? "var(--vt-text-disabled)"
            : "var(--vt-text-secondary)",
        opacity: disabled ? 0.5 : 1,
        transition: "all 100ms ease",
      }}
    >
      {icon}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────

export function QuickActions({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  onCopyStyles,
  onPasteStyles,
  panelSide,
  onToggleSide,
  hasCopied,
  spacingOverlay,
  onToggleSpacing,
  responsiveMode,
  onToggleResponsive,
  layoutDebugger,
  onToggleLayout,
}: QuickActionsProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "var(--vt-toolbar-height)",
        padding: "0 8px",
        gap: "2px",
        borderBottom: "1px solid var(--vt-border)",
        flexShrink: 0,
      }}
    >
      <ToolbarBtn
        icon={<IconUndo size={14} />}
        tooltip="Undo (Ctrl+Z)"
        onClick={onUndo}
        disabled={!canUndo}
      />
      <ToolbarBtn
        icon={<IconRedo size={14} />}
        tooltip="Redo (Ctrl+Shift+Z)"
        onClick={onRedo}
        disabled={!canRedo}
      />

      {/* Separator */}
      <div
        style={{
          width: "1px",
          height: "16px",
          background: "var(--vt-border)",
          margin: "0 2px",
          flexShrink: 0,
        }}
      />

      <ToolbarBtn
        icon={<IconReset size={14} />}
        tooltip="Reset all changes"
        onClick={onReset}
      />
      <ToolbarBtn
        icon={<IconCopy size={14} />}
        tooltip="Copy styles"
        onClick={onCopyStyles}
      />
      <ToolbarBtn
        icon={<IconPaste size={14} />}
        tooltip="Paste styles"
        onClick={onPasteStyles}
        disabled={!hasCopied}
      />

      {/* Separator */}
      <div
        style={{
          width: "1px",
          height: "16px",
          background: "var(--vt-border)",
          margin: "0 2px",
          flexShrink: 0,
        }}
      />

      <ToolbarBtn
        icon={<IconBoxModel size={14} />}
        tooltip="Toggle spacing overlay"
        onClick={onToggleSpacing}
        active={spacingOverlay}
      />
      <ToolbarBtn
        icon={<IconResponsive size={14} />}
        tooltip="Responsive preview"
        onClick={onToggleResponsive}
        active={responsiveMode}
      />
      <ToolbarBtn
        icon={<IconLayoutGrid size={14} />}
        tooltip="Flex/Grid layout debugger"
        onClick={onToggleLayout}
        active={layoutDebugger}
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Panel side toggle */}
      <ToolbarBtn
        icon={panelSide === "right" ? <IconPanelLeft size={14} /> : <IconPanelRight size={14} />}
        tooltip={`Move panel to ${panelSide === "right" ? "left" : "right"}`}
        onClick={onToggleSide}
      />
    </div>
  );
}
