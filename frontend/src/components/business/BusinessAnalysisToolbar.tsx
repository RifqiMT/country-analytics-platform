import type { MetricDef } from "../../api";
import { metricDisplayLabel } from "../../lib/metricDisplay";
import {
  MIN_DATA_YEAR,
  clampSpanEnd,
  clampSpanStart,
  maxSelectableYear,
} from "../../lib/yearBounds";
import HighlightCountrySelect from "../HighlightCountrySelect";

type Props = {
  metrics: MetricDef[];
  startYear: number;
  endYear: number;
  onStartYearChange: (year: number) => void;
  onEndYearChange: (year: number) => void;
  excludeIqr: boolean;
  onExcludeIqrChange: (value: boolean) => void;
  strictSelectedRange: boolean;
  onStrictSelectedRangeChange: (value: boolean) => void;
  highlight: string;
  onHighlightChange: (value: string) => void;
  xId: string;
  yId: string;
  onXIdChange: (value: string) => void;
  onYIdChange: (value: string) => void;
  loading: boolean;
  onGenerate: () => void;
  labelX: string;
  labelY: string;
};

const WandIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.5 4.5L19 12l-5.5 3L10 19l-2.5-4L2 12l5.5-3L10 5z"
    />
  </svg>
);

/** Country, metrics, year span, and analysis options. */
export default function BusinessAnalysisToolbar({
  metrics,
  startYear,
  endYear,
  onStartYearChange,
  onEndYearChange,
  excludeIqr,
  onExcludeIqrChange,
  strictSelectedRange,
  onStrictSelectedRangeChange,
  highlight,
  onHighlightChange,
  xId,
  yId,
  onXIdChange,
  onYIdChange,
  loading,
  onGenerate,
  labelX,
  labelY,
}: Props) {
  const maxY = maxSelectableYear();

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <div className="min-w-0">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Focus country</label>
          <p className="mt-0.5 text-xs text-slate-500">Highlighted in gold on the scatter plot.</p>
          <div className="mt-1.5 min-w-0">
            <HighlightCountrySelect
              value={highlight}
              onChange={onHighlightChange}
              clearPlacement="inline"
              className="gap-0 [&_input]:h-9 [&_input]:truncate [&_input]:py-1.5 [&_input]:pl-2.5 [&_input]:text-xs sm:[&_input]:pl-3 sm:[&_input]:text-sm"
            />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Year range</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Coverage {MIN_DATA_YEAR} through {maxY}. Each country-year is one point.
          </p>
          <div
            className="mt-1.5 inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50/80 px-1.5"
            title={`Coverage ${MIN_DATA_YEAR}–${maxY}`}
          >
            <label className="sr-only" htmlFor="business-year-from">
              From year
            </label>
            <input
              id="business-year-from"
              type="number"
              value={startYear}
              min={MIN_DATA_YEAR}
              max={Math.min(endYear, maxY)}
              onChange={(e) => onStartYearChange(clampSpanStart(Number(e.target.value), endYear))}
              className="w-[4.25rem] border-0 bg-transparent px-1 text-center text-sm font-medium tabular-nums text-slate-900 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="select-none px-1 text-xs text-slate-400" aria-hidden>
              to
            </span>
            <label className="sr-only" htmlFor="business-year-to">
              To year
            </label>
            <input
              id="business-year-to"
              type="number"
              value={endYear}
              min={Math.max(startYear, MIN_DATA_YEAR)}
              max={maxY}
              onChange={(e) => onEndYearChange(clampSpanEnd(Number(e.target.value), startYear))}
              className="w-[4.25rem] border-0 bg-transparent px-1 text-center text-sm font-medium tabular-nums text-slate-900 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>

        <div className="min-w-0">
          <label htmlFor="business-var-x" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Horizontal axis
          </label>
          <select
            id="business-var-x"
            value={xId}
            onChange={(e) => onXIdChange(e.target.value)}
            title={labelX}
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
          >
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {metricDisplayLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="business-var-y" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Vertical axis
          </label>
          <select
            id="business-var-y"
            value={yId}
            onChange={(e) => onYIdChange(e.target.value)}
            title={labelY}
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
          >
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {metricDisplayLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 has-[:checked]:border-teal-200 has-[:checked]:bg-teal-50 has-[:checked]:text-teal-900">
            <input
              type="checkbox"
              checked={excludeIqr}
              onChange={(e) => onExcludeIqrChange(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            Exclude IQR outliers
          </label>
          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 has-[:checked]:border-teal-200 has-[:checked]:bg-teal-50 has-[:checked]:text-teal-900"
            title="When off, a shorter recent window is used automatically if the full span is slow"
          >
            <input
              type="checkbox"
              checked={strictSelectedRange}
              onChange={(e) => onStrictSelectedRangeChange(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            Strict year range
          </label>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <WandIcon />
          {loading ? "Running…" : "Generate analysis"}
        </button>
      </div>
    </div>
  );
}
