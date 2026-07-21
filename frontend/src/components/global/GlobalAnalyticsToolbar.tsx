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

const FIELD_LABEL = "shrink-0 text-xs font-semibold text-slate-600";

const CONTROL =
  "h-9 rounded-lg border-0 bg-white text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/80 transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100";

function ToolbarDivider({ className = "" }: { className?: string }) {
  return <div className={`h-8 w-px shrink-0 bg-slate-200/90 ${className}`} aria-hidden />;
}

/** Compact single-row controls for year, region, map metric, and view mode. */
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
  const yearHint = `Coverage ${MIN_DATA_YEAR}–${maxYear}. Latest sparse years may fall back automatically.`;

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 lg:flex-nowrap lg:gap-x-4">
        <div className="flex shrink-0 items-center gap-2">
          <label htmlFor="global-year" className={FIELD_LABEL}>
            Year
          </label>
          <input
            id="global-year"
            type="number"
            value={year}
            min={MIN_DATA_YEAR}
            max={maxYear}
            title={yearHint}
            onChange={(e) => onYearChange(clampPickerYear(Number(e.target.value)))}
            className={`${CONTROL} w-[4.5rem] px-2 text-center font-medium tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
          />
        </div>

        <ToolbarDivider className="hidden sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[11rem] sm:flex-initial lg:max-w-[12rem]">
          <label htmlFor="global-region" className={FIELD_LABEL}>
            Region
          </label>
          <select
            id="global-region"
            value={region}
            title="Filter map and table to one world region or show all."
            onChange={(e) => onRegionChange(e.target.value)}
            className={`${CONTROL} min-w-0 flex-1 truncate px-2.5 sm:w-full`}
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {view === "map" ? (
          <>
            <ToolbarDivider className="hidden md:block" />
            <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:min-w-[12rem] md:flex-1 lg:max-w-sm xl:max-w-md">
              <label htmlFor="global-map-metric" className={FIELD_LABEL}>
                Metric
              </label>
              <select
                id="global-map-metric"
                value={mapMetric}
                title="One indicator colors every country on the choropleth."
                onChange={(e) => onMapMetricChange(e.target.value)}
                className={`${CONTROL} min-w-0 flex-1 truncate px-2.5`}
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
          </>
        ) : null}

        <div className="flex w-full items-center justify-end gap-2 sm:w-auto lg:ml-auto">
          <span className={`${FIELD_LABEL} lg:sr-only`}>View</span>
          <div
            className="inline-flex rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200/60"
            role="group"
            aria-label="Global view mode"
          >
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                type="button"
                onClick={() => onViewChange(opt.mode)}
                aria-pressed={view === opt.mode}
                title={`${opt.label} view`}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
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
    </div>
  );
}
