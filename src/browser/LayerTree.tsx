import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  IconChevronDown,
  IconChevronRight,
  IconFrame,
  IconType,
  IconImage,
  IconButton,
  IconInput,
  IconLink,
  IconContainer,
  IconList,
  IconComponent,
  IconEye,
  IconEyeOff,
} from "./icons.js";

// ─── Types ────────────────────────────────────────────────────

interface LayerNode {
  element: HTMLElement;
  tag: string;
  name: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  id: string;
  componentName?: string;
}

interface LayerTreeProps {
  selectedElement: HTMLElement | null;
  onSelect: (el: HTMLElement) => void;
  rootElement?: HTMLElement;
}

// ─── Helpers ──────────────────────────────────────────────────

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT", "BR", "HR"]);
const TEXT_TAGS = new Set(["P", "SPAN", "A", "H1", "H2", "H3", "H4", "H5", "H6", "LABEL", "EM", "STRONG", "B", "I", "SMALL", "BLOCKQUOTE", "FIGCAPTION", "CODE", "PRE"]);
const INTERACTIVE_TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);
const LIST_TAGS = new Set(["UL", "OL", "LI", "DL", "DT", "DD"]);
const MAX_DEPTH = 12;
const MAX_NODES = 500;

function getElementIcon(el: HTMLElement): React.ReactNode {
  const tag = el.tagName;

  if (tag === "IMG" || tag === "SVG" || tag === "VIDEO" || tag === "CANVAS" || tag === "PICTURE") {
    return <IconImage size={12} />;
  }
  if (tag === "BUTTON") return <IconButton size={12} />;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return <IconInput size={12} />;
  if (tag === "A") return <IconLink size={12} />;
  if (TEXT_TAGS.has(tag)) return <IconType size={12} />;
  if (LIST_TAGS.has(tag)) return <IconList size={12} />;

  // Check for React component
  const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
  if (fiberKey) {
    const fiber = (el as Record<string, unknown>)[fiberKey] as Record<string, unknown> | undefined;
    if (fiber?.type && typeof fiber.type === "function") {
      return <IconComponent size={12} />;
    }
  }

  if (tag === "SECTION" || tag === "ARTICLE" || tag === "MAIN" || tag === "ASIDE" || tag === "NAV" || tag === "HEADER" || tag === "FOOTER") {
    return <IconFrame size={12} />;
  }

  return <IconContainer size={12} />;
}

function getElementName(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();

  // Try React component name
  const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
  if (fiberKey) {
    const fiber = (el as Record<string, unknown>)[fiberKey] as Record<string, unknown> | undefined;
    if (fiber?.type && typeof fiber.type === "function") {
      const name = (fiber.type as { displayName?: string; name?: string }).displayName || (fiber.type as { name?: string }).name;
      if (name) return name;
    }
  }

  // ID
  if (el.id) return `#${el.id}`;

  // Meaningful class
  const classes = Array.from(el.classList).filter(
    (c) => !c.startsWith("_") && !c.includes("__") && c.length < 30
  );
  if (classes.length > 0) {
    return `.${classes[0]}`;
  }

  // Text content hint for text tags
  if (TEXT_TAGS.has(el.tagName) || INTERACTIVE_TAGS.has(el.tagName)) {
    const text = (el.textContent || "").trim().slice(0, 20);
    if (text) return `${tag} "${text}${(el.textContent || "").trim().length > 20 ? "…" : ""}"`;
  }

  return tag;
}

function isVizTweakNode(el: HTMLElement): boolean {
  if (el.hasAttribute("data-viztweak")) return true;
  if (el.closest("[data-viztweak]")) return true;
  return false;
}

// ─── Component ────────────────────────────────────────────────

export function LayerTree({ selectedElement, onSelect, rootElement }: LayerTreeProps) {
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build a unique ID for an element based on its path
  const getNodeId = useCallback((el: HTMLElement): string => {
    const parts: string[] = [];
    let current: HTMLElement | null = el;
    while (current && current !== document.body) {
      const parent = current.parentElement;
      if (parent) {
        const idx = Array.from(parent.children).indexOf(current);
        parts.unshift(`${current.tagName}[${idx}]`);
      } else {
        parts.unshift(current.tagName);
      }
      current = parent;
    }
    return parts.join("/");
  }, []);

  // Auto-expand path to selected element
  useEffect(() => {
    if (!selectedElement) return;
    const toExpand = new Set(expandedSet);
    let el: HTMLElement | null = selectedElement.parentElement;
    while (el && el !== document.body) {
      toExpand.add(getNodeId(el));
      el = el.parentElement;
    }
    // Also expand body
    toExpand.add(getNodeId(document.body));
    setExpandedSet(toExpand);
  }, [selectedElement]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build flat list of visible layer nodes
  const layers = React.useMemo(() => {
    const result: LayerNode[] = [];
    const root = rootElement || document.body;

    function walk(el: HTMLElement, depth: number) {
      if (result.length >= MAX_NODES) return;
      if (depth > MAX_DEPTH) return;
      if (SKIP_TAGS.has(el.tagName)) return;
      if (isVizTweakNode(el)) return;

      const nodeId = getNodeId(el);
      const childElements = Array.from(el.children).filter(
        (c) => c instanceof HTMLElement && !SKIP_TAGS.has(c.tagName) && !isVizTweakNode(c as HTMLElement)
      ) as HTMLElement[];

      const isExpanded = expandedSet.has(nodeId);

      result.push({
        element: el,
        tag: el.tagName.toLowerCase(),
        name: getElementName(el),
        depth,
        hasChildren: childElements.length > 0,
        isExpanded,
        id: nodeId,
        componentName: undefined,
      });

      if (isExpanded) {
        for (const child of childElements) {
          walk(child, depth + 1);
        }
      }
    }

    walk(root, 0);
    return result;
  }, [expandedSet, rootElement, getNodeId]);

  const toggleExpand = useCallback(
    (nodeId: string) => {
      setExpandedSet((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    },
    [],
  );

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "4px 0",
      }}
    >
      {layers.map((node) => {
        const isSelected = node.element === selectedElement;
        const isHovered = hoveredId === node.id;
        const indent = 12 + node.depth * 16;

        return (
          <div
            key={node.id}
            style={{
              display: "flex",
              alignItems: "center",
              height: "24px",
              paddingLeft: `${indent}px`,
              paddingRight: "8px",
              cursor: "pointer",
              background: isSelected
                ? "var(--vt-accent-bg)"
                : isHovered
                  ? "var(--vt-hover)"
                  : "transparent",
              color: isSelected ? "var(--vt-accent)" : "var(--vt-text-primary)",
              fontSize: "11px",
              fontFamily: "var(--vt-font)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              transition: "background 80ms ease",
              position: "relative",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(node.element);
            }}
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Expand/collapse chevron */}
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "14px",
                height: "14px",
                flexShrink: 0,
                color: "var(--vt-text-secondary)",
                visibility: node.hasChildren ? "visible" : "hidden",
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
            >
              {node.isExpanded ? (
                <IconChevronDown size={10} />
              ) : (
                <IconChevronRight size={10} />
              )}
            </span>

            {/* Element type icon */}
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "16px",
                height: "16px",
                flexShrink: 0,
                color: isSelected ? "var(--vt-accent)" : "var(--vt-text-secondary)",
                marginRight: "4px",
              }}
            >
              {getElementIcon(node.element)}
            </span>

            {/* Element name */}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
                minWidth: 0,
              }}
            >
              {node.name}
            </span>

            {/* Tag hint */}
            <span
              style={{
                fontSize: "9px",
                color: "var(--vt-text-disabled)",
                marginLeft: "4px",
                flexShrink: 0,
              }}
            >
              {node.tag}
            </span>
          </div>
        );
      })}

      {layers.length === 0 && (
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            color: "var(--vt-text-secondary)",
            fontSize: "11px",
          }}
        >
          No elements found
        </div>
      )}
    </div>
  );
}
