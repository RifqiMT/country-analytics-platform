import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MIN_DATA_YEAR } from "../../lib/yearBounds";

export type YearPresetKind =
  | "full"
  | "current"
  | "y2"
  | "y3"
  | "y5"
  | "y8"
  | "y10"
  | "y15"
  | "y20";

type Props = {
  start: number;
  end: number;
  maxYear: number;
  onSelect: (kind: YearPresetKind) => void;
  /** Single-line trigger for dense toolbars (e.g. dashboard control row). */
  compact?: boolean;
};

function spanStart(maxYear: number, spanYears: number): number {
  return Math.max(MIN_DATA_YEAR, maxYear - (spanYears - 1));
}

function spanForKind(kind: "y2" | "y3" | "y5" | "y8" | "y10" | "y15" | "y20"): number {
  switch (kind) {
    case "y2":
      return 2;
    case "y3":
      return 3;
    case "y5":
      return 5;
    case "y8":
      return 8;
    case "y10":
      return 10;
    case "y15":
      return 15;
    default:
      return 20;
  }
}

function activePreset(start: number, end: number, maxYear: number): YearPresetKind | "custom" {
  if (start === MIN_DATA_YEAR && end === maxYear) return "full";
  if (start === end && end === maxYear) return "current";
  if (end !== maxYear) return "custom";
  const spans = [2, 3, 5, 8, 10, 15, 20] as const;
  for (const n of spans) {
    if (start === spanStart(maxYear, n)) {
      if (n === 2) return "y2";
      if (n === 3) return "y3";
      if (n === 5) return "y5";
      if (n === 8) return "y8";
      if (n === 10) return "y10";
      if (n === 15) return "y15";
      return "y20";
    }
  }
  return "custom";
}

const LABELS: Record<YearPresetKind, string> = {
  full: "Full range",
  current: "The current year",
  y2: "Last 2 years",
  y3: "Last 3 years",
  y5: "Last 5 years",
  y8: "Last 8 years",
  y10: "Last 10 years",
  y15: "Last 15 years",
  y20: "Last 20 years",
};

const ROWS: readonly { kind: YearPresetKind; title: string; sub: (max: number) => string }[] = [
  { kind: "current", title: "The current year", sub: (max) => `${max} (latest data year)` },
  { kind: "y2", title: "Last 2 years", sub: (max) => `${spanStart(max, 2)}–${max}` },
  { kind: "y3", title: "Last 3 years", sub: (max) => `${spanStart(max, 3)}–${max}` },
  { kind: "y5", title: "Last 5 years", sub: (max) => `${spanStart(max, 5)}–${max}` },
  { kind: "y8", title: "Last 8 years", sub: (max) => `${spanStart(max, 8)}–${max}` },
  { kind: "y10", title: "Last 10 years", sub: (max) => `${spanStart(max, 10)}–${max}` },
  { kind: "y15", title: "Last 15 years", sub: (max) => `${spanStart(max, 15)}–${max}` },
  { kind: "y20", title: "Last 20 years", sub: (max) => `${spanStart(max, 20)}–${max}` },
  { kind: "full", title: "Full range", sub: (max) => `${MIN_DATA_YEAR}–${max}` },
];

export default function YearRangePresetDropdown({ start, end, maxYear, onSelect, compact = false }: Props) {
  const active = activePreset(start, end, maxYear);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = useCallback(
    (kind: YearPresetKind) => {
      onSelect(kind);
      setOpen(false);
    },
    [onSelect]
  );

  const summary =
    active === "custom"
      ? start === end
        ? `${start}`
        : `${start}–${end}`
      : active === "full"
        ? `${MIN_DATA_YEAR}–${maxYear}`
        : active === "current"
          ? `${maxYear}`
          : `${spanStart(maxYear, spanForKind(active))}–${maxYear}`;

  const headline = active === "custom" ? "Custom range" : LABELS[active];

  const triggerClass = compact
    ? "inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium tabular-nums text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:gap-1.5 sm:px-2.5 sm:text-sm"
    : "flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

  return (
    <div ref={rootRef} className={compact ? "relative shrink-0" : "relative w-full min-w-[10rem] sm:w-auto sm:min-w-[12rem]"}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-label={compact ? `Year range preset: ${headline}, ${summary}` : undefined}
        onClick={() => setOpen((o) => !o)}
        className={triggerClass}
      >
        {compact ? (
          <>
            <span className="hidden max-w-[5.5rem] truncate sm:inline sm:max-w-[7rem]">{summary}</span>
            <svg
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        ) : (
          <>
            <span className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Quick preset</span>
              <span className="block truncate text-sm font-semibold text-slate-900">{headline}</span>
              <span className="block truncate text-xs text-slate-500">{summary}</span>
            </span>
            <svg
              className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Year range presets"
          className={`absolute z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5 ${
            compact ? "right-0 min-w-[14rem]" : "left-0 right-0"
          }`}
        >
          {ROWS.map((row) => {
            const sel = active === row.kind;
            return (
              <li key={row.kind} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={sel}
                  onClick={() => choose(row.kind)}
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition ${
                    sel ? "bg-red-50 text-red-950" : "text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-semibold">{row.title}</span>
                  <span className="text-xs text-slate-500">{row.sub(maxYear)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
