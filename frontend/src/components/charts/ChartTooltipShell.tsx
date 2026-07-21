import type { CSSProperties, ReactNode } from "react";
import { yoYClass } from "../../lib/formatValue";

/** Solid surface — width follows content up to viewport cap; no clipping overflow. */
const CHART_TOOLTIP_SURFACE_CLASS =
  "box-border w-max min-w-[14rem] max-w-[min(28rem,calc(100vw-1rem))] overflow-visible rounded-lg border border-slate-200 bg-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.12)] sm:p-3.5";

type ShellProps = { children: ReactNode; className?: string };

export function ChartTooltipShell({ children, className = "" }: ShellProps) {
  return (
    <div
      className={`${CHART_TOOLTIP_SURFACE_CLASS} cap-chart-tooltip-shell ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
  );
}

/** Primary context line (e.g. year, quarter, week label). */
export function ChartTooltipHeading({
  children,
  sticky,
  hint,
  trailing,
}: {
  children: ReactNode;
  sticky?: boolean;
  hint?: string;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={`mb-2 border-b border-slate-200 pb-2 ${
        sticky ? "sticky top-0 z-[1] bg-white pt-0.5" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          {hint ? (
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{hint}</p>
          ) : null}
          <p className="break-words text-[0.9375rem] font-bold leading-snug tracking-tight text-slate-900">{children}</p>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </div>
  );
}

export function ChartTooltipSeriesList({ children, scrollable }: { children: ReactNode; scrollable?: boolean }) {
  return (
    <ul
      className={
        scrollable
          ? "cap-tooltip-series-list divide-y divide-slate-100 overflow-x-visible overflow-y-auto overscroll-contain"
          : "divide-y divide-slate-100 overflow-visible"
      }
      style={scrollable ? { maxHeight: "min(320px, 50vh)" } : undefined}
    >
      {children}
    </ul>
  );
}

export type TooltipChange = {
  text: string;
  tone: "up" | "down" | "flat";
};

function ChangeIndicator({ change }: { change: TooltipChange }) {
  const symbol = change.tone === "up" ? "▲" : change.tone === "down" ? "▼" : "—";
  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center justify-end gap-x-1 gap-y-0.5 text-[0.6875rem] font-semibold tabular-nums leading-snug ${yoYClass(change.tone)}`}
    >
      <span className="text-[0.5rem] leading-none opacity-80" aria-hidden>
        {symbol}
      </span>
      <span className="break-words">{change.text}</span>
    </span>
  );
}

export function ChartTooltipSeriesRow({
  label,
  value,
  color,
  meta,
  change,
}: {
  label: string;
  value: string;
  color?: string;
  meta?: ReactNode;
  change?: TooltipChange | null;
}) {
  const isEmpty = value === "—";

  return (
    <li className="overflow-visible py-2.5 first:pt-0 last:pb-0">
      <div className="flex gap-2.5 overflow-visible">
        <span
          className="mt-0.5 w-[3px] shrink-0 self-stretch rounded-full bg-slate-200"
          style={color ? { backgroundColor: color } : undefined}
          aria-hidden
        />
        <div className="min-w-0 flex-1 overflow-visible">
          <p className="break-words text-[0.8125rem] font-medium leading-snug text-slate-700">{label}</p>
          {meta ? (
            <p className="mt-0.5 break-words text-[0.6875rem] leading-snug text-slate-400">{meta}</p>
          ) : null}
        </div>
        <div className="flex min-w-[5.5rem] max-w-[12rem] shrink-0 flex-col items-end justify-start gap-0.5 text-right sm:max-w-none">
          <span
            className={`break-words text-[0.8125rem] font-semibold tabular-nums leading-snug ${
              isEmpty ? "text-slate-400" : "text-slate-900"
            }`}
          >
            {value}
          </span>
          {change && change.text !== "—" ? <ChangeIndicator change={change} /> : null}
        </div>
      </div>
    </li>
  );
}

/** Secondary note (e.g. metric description on map). */
export function ChartTooltipFootnote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 break-words border-t border-slate-100 pt-2 text-[0.6875rem] leading-relaxed text-slate-500">
      {children}
    </p>
  );
}

/** Recharts default wrapper clips tooltips; keep them above charts. */
export const RECHARTS_TOOLTIP_WRAPPER: CSSProperties = {
  outline: "none",
  zIndex: 60,
};
