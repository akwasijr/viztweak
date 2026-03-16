import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

// ─── Shared SVG wrapper ──────────────────────────────────────

function Svg({
  size = 16,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

// ─── Horizontal alignment ────────────────────────────────────

export function IconAlignLeft({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="3" y1="3" x2="3" y2="13" />
      <rect x="5" y="5" width="6" height="6" rx="1" />
    </Svg>
  );
}

export function IconAlignCenterH({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="8" y1="3" x2="8" y2="13" />
      <rect x="5" y="5" width="6" height="6" rx="1" />
    </Svg>
  );
}

export function IconAlignRight({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="13" y1="3" x2="13" y2="13" />
      <rect x="5" y="5" width="6" height="6" rx="1" />
    </Svg>
  );
}

// ─── Vertical alignment ──────────────────────────────────────

export function IconAlignTop({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="3" y1="3" x2="13" y2="3" />
      <rect x="5" y="5" width="6" height="6" rx="1" />
    </Svg>
  );
}

export function IconAlignCenterV({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="3" y1="8" x2="13" y2="8" />
      <rect x="5" y="5" width="6" height="6" rx="1" />
    </Svg>
  );
}

export function IconAlignBottom({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="3" y1="13" x2="13" y2="13" />
      <rect x="5" y="5" width="6" height="6" rx="1" />
    </Svg>
  );
}

// ─── Text alignment ──────────────────────────────────────────

export function IconTextAlignLeft({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="3" y1="4" x2="13" y2="4" />
      <line x1="3" y1="7" x2="10" y2="7" />
      <line x1="3" y1="10" x2="12" y2="10" />
      <line x1="3" y1="13" x2="9" y2="13" />
    </Svg>
  );
}

export function IconTextAlignCenter({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="3" y1="4" x2="13" y2="4" />
      <line x1="4.5" y1="7" x2="11.5" y2="7" />
      <line x1="3.5" y1="10" x2="12.5" y2="10" />
      <line x1="5" y1="13" x2="11" y2="13" />
    </Svg>
  );
}

export function IconTextAlignRight({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="3" y1="4" x2="13" y2="4" />
      <line x1="6" y1="7" x2="13" y2="7" />
      <line x1="4" y1="10" x2="13" y2="10" />
      <line x1="7" y1="13" x2="13" y2="13" />
    </Svg>
  );
}

export function IconTextAlignJustify({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="3" y1="4" x2="13" y2="4" />
      <line x1="3" y1="7" x2="13" y2="7" />
      <line x1="3" y1="10" x2="13" y2="10" />
      <line x1="3" y1="13" x2="13" y2="13" />
    </Svg>
  );
}

// ─── Layout direction ────────────────────────────────────────

export function IconLayoutRow({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="2" y="4" width="5" height="8" rx="1" />
      <rect x="9" y="4" width="5" height="8" rx="1" />
    </Svg>
  );
}

export function IconLayoutColumn({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="4" y="2" width="8" height="5" rx="1" />
      <rect x="4" y="9" width="8" height="5" rx="1" />
    </Svg>
  );
}

// ─── Stroke alignment ────────────────────────────────────────

export function IconStrokeInside({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="3" width="10" height="10" rx="1.5" strokeWidth="1" />
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" strokeWidth="1.5" />
    </Svg>
  );
}

export function IconStrokeCenter({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="3" width="10" height="10" rx="1.5" strokeWidth="2" />
    </Svg>
  );
}

export function IconStrokeOutside({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" strokeWidth="1" />
      <rect x="3" y="3" width="10" height="10" rx="1.5" strokeWidth="1.5" />
    </Svg>
  );
}

// ─── Chevrons ────────────────────────────────────────────────

export function IconChevronDown({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polyline points="4,6 8,10 12,6" />
    </Svg>
  );
}

export function IconChevronRight({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polyline points="6,4 10,8 6,12" />
    </Svg>
  );
}

// ─── Add / Remove ────────────────────────────────────────────

export function IconPlus({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </Svg>
  );
}

export function IconMinus({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="3" y1="8" x2="13" y2="8" />
    </Svg>
  );
}

// ─── Visibility ──────────────────────────────────────────────

export function IconEye({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
      <circle cx="8" cy="8" r="2" />
    </Svg>
  );
}

export function IconEyeOff({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
      <line x1="3" y1="13" x2="13" y2="3" />
    </Svg>
  );
}

// ─── Grid ────────────────────────────────────────────────────

export function IconGrid({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="3" width="4" height="4" rx="0.5" />
      <rect x="9" y="3" width="4" height="4" rx="0.5" />
      <rect x="3" y="9" width="4" height="4" rx="0.5" />
      <rect x="9" y="9" width="4" height="4" rx="0.5" />
    </Svg>
  );
}

// ─── Move ────────────────────────────────────────────────────

export function IconMove({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="8" y1="2" x2="8" y2="14" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <polyline points="5,5 8,2 11,5" />
      <polyline points="5,11 8,14 11,11" />
      <polyline points="2,5 2,8 5,8" />
      <polyline points="14,5 14,8 11,8" />
    </Svg>
  );
}

// ─── Corner radius ───────────────────────────────────────────

export function IconCornerRadius({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M3 13V7a4 4 0 0 1 4-4h6" />
    </Svg>
  );
}

// ─── Spacing ─────────────────────────────────────────────────

export function IconSpacing({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="3" width="10" height="10" rx="1" strokeWidth="1" />
      <line x1="6" y1="3" x2="6" y2="5" strokeWidth="1" />
      <line x1="6" y1="11" x2="6" y2="13" strokeWidth="1" />
      <line x1="3" y1="6" x2="5" y2="6" strokeWidth="1" />
      <line x1="11" y1="6" x2="13" y2="6" strokeWidth="1" />
    </Svg>
  );
}

// ─── Send ────────────────────────────────────────────────────

export function IconSend({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M3 3l10 5-10 5V9l6-1-6-1V3z" strokeWidth="1.5" />
    </Svg>
  );
}

// ─── Close ───────────────────────────────────────────────────

export function IconClose({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </Svg>
  );
}

// ─── Inspect ─────────────────────────────────────────────────

export function IconInspect({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="8" cy="8" r="5" />
      <circle cx="8" cy="8" r="1.5" />
      <line x1="8" y1="1" x2="8" y2="3" />
      <line x1="8" y1="13" x2="8" y2="15" />
      <line x1="1" y1="8" x2="3" y2="8" />
      <line x1="13" y1="8" x2="15" y2="8" />
    </Svg>
  );
}

// ─── Undo ────────────────────────────────────────────────────

export function IconUndo({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polyline points="4,7 2,5 4,3" />
      <path d="M2 5h8a4 4 0 0 1 0 8H6" />
    </Svg>
  );
}

// ─── Redo ────────────────────────────────────────────────────

export function IconRedo({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polyline points="12,7 14,5 12,3" />
      <path d="M14 5H6a4 4 0 0 0 0 8h4" />
    </Svg>
  );
}

// ─── Reset ───────────────────────────────────────────────────

export function IconReset({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polyline points="3,7 3,3 7,3" />
      <path d="M3 3l4.5 4.5" />
      <circle cx="9" cy="9" r="4.5" />
    </Svg>
  );
}

// ─── Copy ────────────────────────────────────────────────────

export function IconCopy({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="5" y="5" width="8" height="8" rx="1.5" />
      <path d="M3 11V4a1 1 0 0 1 1-1h7" />
    </Svg>
  );
}

// ─── Paste ───────────────────────────────────────────────────

export function IconPaste({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="4" y="4" width="9" height="10" rx="1.5" />
      <path d="M6 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
    </Svg>
  );
}

// ─── Layers ──────────────────────────────────────────────────

export function IconLayers({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polygon points="8,2 14,5.5 8,9 2,5.5" />
      <polyline points="2,8 8,11.5 14,8" />
      <polyline points="2,10.5 8,14 14,10.5" />
    </Svg>
  );
}

// ─── Panel Left ──────────────────────────────────────────────

export function IconPanelLeft({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <line x1="6" y1="3" x2="6" y2="13" />
    </Svg>
  );
}

// ─── Panel Right ─────────────────────────────────────────────

export function IconPanelRight({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <line x1="10" y1="3" x2="10" y2="13" />
    </Svg>
  );
}

// ─── State / Lightning ───────────────────────────────────────

export function IconState({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polygon points="9,2 4,9 8,9 7,14 12,7 8,7" />
    </Svg>
  );
}

// ─── Cursor / Pointer ────────────────────────────────────────

export function IconCursor({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 2l1.5 12 2.5-3.5L12 12 4 2z" />
    </Svg>
  );
}

// ─── Frame ───────────────────────────────────────────────────

export function IconFrame({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="6" y1="2" x2="6" y2="14" />
      <line x1="10" y1="2" x2="10" y2="14" />
      <line x1="2" y1="6" x2="14" y2="6" />
      <line x1="2" y1="10" x2="14" y2="10" />
    </Svg>
  );
}

// ─── Type / Text ─────────────────────────────────────────────

export function IconType({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="4" y1="4" x2="12" y2="4" />
      <line x1="8" y1="4" x2="8" y2="13" />
      <line x1="6" y1="13" x2="10" y2="13" />
    </Svg>
  );
}

// ─── Image ───────────────────────────────────────────────────

export function IconImage({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="5.5" cy="6" r="1.5" />
      <path d="M14 10l-3-3-5 5" />
    </Svg>
  );
}

// ─── Container / Box ─────────────────────────────────────────

export function IconContainer({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="3" width="10" height="10" rx="1.5" strokeDasharray="2 2" />
    </Svg>
  );
}

// ─── Component ───────────────────────────────────────────────

export function IconComponent({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M8 2L5 5l3 3 3-3L8 2z" />
      <path d="M8 10l-3 3h6l-3-3z" />
      <path d="M2 8l3-3v6L2 8z" />
      <path d="M14 8l-3-3v6l3-3z" />
    </Svg>
  );
}

// ─── Link ────────────────────────────────────────────────────

export function IconLink({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M7 9l2-2" />
      <path d="M9 5l1.5-1.5a2.12 2.12 0 0 1 3 3L12 8" />
      <path d="M7 8L5.5 9.5a2.12 2.12 0 0 0 3 3L10 11" />
    </Svg>
  );
}

// ─── Button ──────────────────────────────────────────────────

export function IconButton({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="2" y="5" width="12" height="6" rx="3" />
    </Svg>
  );
}

// ─── Input field ─────────────────────────────────────────────

export function IconInput({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="2" y="4" width="12" height="8" rx="1.5" />
      <line x1="4" y1="6" x2="4" y2="10" />
    </Svg>
  );
}

// ─── List ────────────────────────────────────────────────────

export function IconList({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="6" y1="4" x2="13" y2="4" />
      <line x1="6" y1="8" x2="13" y2="8" />
      <line x1="6" y1="12" x2="13" y2="12" />
      <circle cx="3.5" cy="4" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="8" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// ─── Design mode ─────────────────────────────────────────────

export function IconDesign({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 2L4 10l-1 4 4-1 8-8-3-3z" />
      <line x1="9.5" y1="4.5" x2="11.5" y2="6.5" />
    </Svg>
  );
}

// ─── Accessibility ───────────────────────────────────────────

export function IconAccessibility({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="8" cy="3.5" r="1.5" />
      <path d="M4 6.5l4 1 4-1" />
      <line x1="8" y1="7.5" x2="8" y2="10" />
      <line x1="8" y1="10" x2="5.5" y2="14" />
      <line x1="8" y1="10" x2="10.5" y2="14" />
    </Svg>
  );
}

// ─── Responsive / Device ─────────────────────────────────────

export function IconResponsive({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="1" y="3" width="10" height="7" rx="1" />
      <rect x="9" y="5" width="5" height="9" rx="1" />
    </Svg>
  );
}

// ─── Spacing / Box Model ─────────────────────────────────────

export function IconBoxModel({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1" strokeDasharray="2 2" />
      <rect x="5" y="5" width="6" height="6" rx="0.5" />
    </Svg>
  );
}

// ─── Code / Braces ───────────────────────────────────────────

export function IconCode({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polyline points="5,4 2,8 5,12" />
      <polyline points="11,4 14,8 11,12" />
      <line x1="9" y1="3" x2="7" y2="13" />
    </Svg>
  );
}
