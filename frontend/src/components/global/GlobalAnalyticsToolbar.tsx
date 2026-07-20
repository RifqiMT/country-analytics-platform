import type { ReactNode } from "react";
import type { MetricDef } from "../../api";
import { metricDisplayLabel } from "../../lib/metricDisplay";
import { MIN_DATA_YEAR, clampPickerYear } from "../../lib/yearBounds";

type GlobalViewMode = "map" | "table" | "charts";

type Props = {
  year: number;
  maxYear: number;
  onYearChange: (year: number) => void;
  region: string;
  regions: string[];
  onRegionChange: (region: string) => void;
  view: GlobalViewMode;
  onViewChange: (view: GlobalViewMode) => void;
  mapMetric: string;
  mapMetricOptions: MetricDef[];
  mapMetricFallbackIds: readonly string[];
  onMapMetricChange: (id: string) => void;
};

const VIEW_OPTIONS: { mode: GlobalViewMode; label: string; shortLabel: string; icon: ReactNode }[] = [
  {
    mode: "map",
    label: "Map",
    shortLabel: "Map",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
        />
      </svg>
    ),
  },
  {
    mode: "table",
    label: "Table",
    shortLabel: "Table",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    mode: "charts",
    label: "Charts",
    shortLabel: "Charts",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19V5m4 14V9m4 10V7m4 12v-8" />
      </svg>
    ),
  },
];

/** Year, region, map metric, and Map / Table / Charts mode. */
export default function GlobalAnalyticsToolbar({
  year,
  maxYear,
  onYearChange,
  region,
  regions,
  onRegionChange,
  view,
  onViewChange,
  mapMetric,
  mapMetricOptions,
  mapMetricFallbackIds,
  onMapMetricChange,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        <div>
          <label htmlFor="global-year" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Year
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Coverage {MIN_DATA_YEAR}–{maxYear}. Latest sparse years may fall back automatically.
          </p>
          <input
            id="global-year"
            type="number"
            value={year}
            min={MIN_DATA_YEAR}
            max={maxYear}
            onChange={(e) => onYearChange(clampPickerYear(Number(e.target.value)))}
            className="mt-1.5 h-9 w-full max-w-[8rem] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium tabular-nums text-slate-900 shadow-sm [appearance:textfield] focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        <div className="min-w-0">
          <label htmlFor="global-region" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Region
          </label>
          <p className="mt-0.5 text-xs text-slate-500">Filter map and table to one world region or show all.</p>
          <select
            id="global-region"
            value={region}
            onChange={(e) => onRegionChange(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">View</p>
          <p className="mt-0.5 text-xs text-slate-500">Switch between map, country table, and world charts.</p>
          <div className="mt-1.5 inline-flex w-full rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Global view mode">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                type="button"
                onClick={() => onViewChange(opt.mode)}
                aria-pressed={view === opt.mode}
                title={opt.label}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold transition sm:px-3 ${
                  view === opt.mode
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "map" ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <label htmlFor="global-map-metric" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Map metric
          </label>
          <p className="mt-0.5 text-xs text-slate-500">One indicator colors every country on the choropleth.</p>
          <select
            id="global-map-metric"
            value={mapMetric}
            onChange={(e) => onMapMetricChange(e.target.value)}
            className="mt-1.5 h-9 w-full max-w-xl rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
          >
            {mapMetricOptions.length > 0
              ? mapMetricOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {metricDisplayLabel(m)}
                  </option>
                ))
              : mapMetricFallbackIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
