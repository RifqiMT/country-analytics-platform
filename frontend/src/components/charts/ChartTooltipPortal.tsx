import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const VIEWPORT_MARGIN = 12;
const CURSOR_GAP = 14;

export type TooltipPlacement = "right" | "left" | "top" | "bottom";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

type ChartTooltipCoordinate = { x?: number; y?: number };

type Props = {
  active?: boolean;
  coordinate?: ChartTooltipCoordinate;
  /** Chart host element — Recharts coords are relative to `.recharts-wrapper` inside this node. */
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
};

function resolveRechartsRect(anchor: HTMLElement): DOMRect {
  const wrapper = anchor.querySelector(".recharts-wrapper");
  return (wrapper ?? anchor).getBoundingClientRect();
}

function computeTooltipPosition(
  anchorRect: DOMRect,
  cx: number,
  cy: number,
  tipW: number,
  tipH: number
): { left: number; top: number; placement: TooltipPlacement } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const relX = cx - anchorRect.left;
  const inRightHalf = relX > anchorRect.width * 0.48;

  const spaceAbove = cy - CURSOR_GAP - VIEWPORT_MARGIN;
  const spaceBelow = vh - VIEWPORT_MARGIN - (cy + CURSOR_GAP);

  type Candidate = { left: number; top: number; placement: TooltipPlacement; score: number };
  const candidates: Candidate[] = [];

  const pushHorizontal = (side: "left" | "right") => {
    const left = side === "right" ? cx + CURSOR_GAP : cx - CURSOR_GAP - tipW;
    const top = cy - tipH / 2;
    const overflow =
      Math.max(0, VIEWPORT_MARGIN - left) +
      Math.max(0, left + tipW - (vw - VIEWPORT_MARGIN)) +
      Math.max(0, VIEWPORT_MARGIN - top) +
      Math.max(0, top + tipH - (vh - VIEWPORT_MARGIN));
    const bias = side === "left" && inRightHalf ? -32 : side === "right" && !inRightHalf ? -8 : 0;
    candidates.push({ left, top, placement: side, score: overflow + bias });
  };

  const pushVertical = (side: "top" | "bottom") => {
    const top = side === "top" ? cy - CURSOR_GAP - tipH : cy + CURSOR_GAP;
    const left = cx - tipW / 2;
    const overflow =
      Math.max(0, VIEWPORT_MARGIN - left) +
      Math.max(0, left + tipW - (vw - VIEWPORT_MARGIN)) +
      Math.max(0, VIEWPORT_MARGIN - top) +
      Math.max(0, top + tipH - (vh - VIEWPORT_MARGIN));
    candidates.push({ left, top, placement: side, score: overflow + 8 });
  };

  pushHorizontal(inRightHalf ? "left" : "right");
  pushHorizontal(inRightHalf ? "right" : "left");
  if (spaceAbove >= tipH * 0.5) pushVertical("top");
  if (spaceBelow >= tipH * 0.5) pushVertical("bottom");

  candidates.sort((a, b) => a.score - b.score);
  let { left, top, placement } = candidates[0] ?? {
    left: cx - tipW / 2,
    top: cy - tipH / 2,
    placement: "top" as TooltipPlacement,
  };

  left = clamp(left, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vw - VIEWPORT_MARGIN - tipW));
  top = clamp(top, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - tipH));

  return { left, top, placement };
}

function caretClass(placement: TooltipPlacement): string {
  const base = "pointer-events-none absolute z-[2] h-2 w-2 rotate-45 border border-slate-200 bg-white";
  switch (placement) {
    case "right":
      return `${base} -left-1 top-1/2 -translate-y-1/2 border-r-0 border-t-0`;
    case "left":
      return `${base} -right-1 top-1/2 -translate-y-1/2 border-l-0 border-b-0`;
    case "top":
      return `${base} -bottom-1 left-1/2 -translate-x-1/2 border-b-0 border-r-0`;
    case "bottom":
      return `${base} -top-1 left-1/2 -translate-x-1/2 border-t-0 border-l-0`;
    default:
      return base;
  }
}

/**
 * Renders chart tooltips in a document portal with viewport-aware flip/shift placement.
 */
export function ChartTooltipPortal({ active, coordinate, anchorRef, children }: Props) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    left: -9999,
    top: 0,
    visibility: "hidden",
    pointerEvents: "none",
  });
  const [placement, setPlacement] = useState<TooltipPlacement>("right");
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    if (
      !active ||
      !coordinate ||
      coordinate.x == null ||
      coordinate.y == null ||
      !anchorRef.current ||
      !tooltipRef.current
    ) {
      setVisible(false);
      setStyle((s) => ({ ...s, visibility: "hidden", opacity: 0 }));
      return;
    }

    const reposition = () => {
      const anchor = anchorRef.current;
      const tipEl = tooltipRef.current;
      if (!anchor || !tipEl || coordinate.x == null || coordinate.y == null) return;

      const anchorRect = resolveRechartsRect(anchor);
      const tipW = tipEl.offsetWidth;
      const tipH = tipEl.offsetHeight;
      const cx = anchorRect.left + coordinate.x;
      const cy = anchorRect.top + coordinate.y;

      const pos = computeTooltipPosition(anchorRect, cx, cy, tipW, tipH);

      setPlacement(pos.placement);
      setStyle({
        position: "fixed",
        left: pos.left,
        top: pos.top,
        zIndex: 99999,
        visibility: "visible",
        opacity: 1,
        pointerEvents: "none",
        overflow: "visible",
        width: "auto",
        maxWidth: "min(28rem, calc(100vw - 1rem))",
      });
      setVisible(true);
    };

    reposition();
    const raf1 = requestAnimationFrame(reposition);
    const raf2 = requestAnimationFrame(reposition);

    const tipEl = tooltipRef.current;
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => reposition()) : null;
    ro?.observe(tipEl);

    const onScrollOrResize = () => reposition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro?.disconnect();
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [active, coordinate?.x, coordinate?.y, anchorRef, children]);

  if (!active) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className={`cap-chart-tooltip-portal relative overflow-visible ${visible ? "cap-chart-tooltip-portal--visible" : ""}`}
      style={style}
      role="tooltip"
      aria-hidden={!visible}
    >
      {visible ? <span className={caretClass(placement)} aria-hidden /> : null}
      {children}
    </div>,
    document.body
  );
}
