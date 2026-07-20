import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatCompactNumber, formatYoY, yoYClass } from "../../lib/formatValue";
import { COUNTRY_COMPARISON_METHODOLOGY_PATH } from "../../lib/countryComparisonMethodology";
import { comparisonMethodLabel } from "../../lib/comparisonMethodLabels";
import { cmpNullableNumber, cmpString, toggleColumnSort, type SortDir } from "../../lib/tableSort";
import SortableTh from "../ui/SortableTh";

export type ComparisonCell = {
  value: number | null;
  yoyPct: number | null;
  yoyBps: number | null;
};

export type ComparisonRow = {
  id: string;
  label: string;
  country: ComparisonCell;
  avgCountry: ComparisonCell;
  global: ComparisonCell;
  avgMethod?: string;
  globalMethod?: string;
};

type Props = {
  year: number;
  dataYear?: number;
  membersCount?: number;
  countryName: string;
  rows: ComparisonRow[];
  onExport: () => void;
};

function formatMetricValue(id: string, v: number): string {
  if (id === "land_area" || id === "total_area" || id === "eez") {
    return `${formatCompactNumber(v, { suffix: " km²", maxFrac: 2 })}`;
  }
  const pct = new Set([
    "inflation",
    "unemployment_ilo",
    "poverty_headcount",
    "poverty_national",
    "lending_rate",
    "immunization_dpt",
    "immunization_measles",
    "health_expenditure_gdp",
    "smoking_prevalence",
    "gbv_women_pct",
  ]);
  if (pct.has(id)) return `${v.toFixed(1)}%`;
  if (id === "homicide_rate" || id === "homicide_rate_female" || id === "homicide_rate_male") {
    return `${v.toFixed(1)} per 100k`;
  }
  if (id === "rule_of_law_wgi" || id === "political_stability_wgi" || id === "corruption_control_wgi") {
    return v.toFixed(2);
  }
  if (id === "gdp" || id === "gdp_ppp") return formatCompactNumber(v, { maxFrac: 2 });
  if (id === "gdp_per_capita" || id === "gdp_per_capita_ppp" || id === "gni_per_capita_atlas")
    return formatCompactNumber(v, { maxFrac: 2 });
  return formatCompactNumber(v, { maxFrac: 2 });
}

function preferBps(id: string): boolean {
  return [
    "inflation",
    "unemployment_ilo",
    "lending_rate",
    "poverty_headcount",
    "poverty_national",
    "immunization_dpt",
    "immunization_measles",
    "health_expenditure_gdp",
    "smoking_prevalence",
    "gbv_women_pct",
  ].includes(id);
}

function cellBlock(
  id: string,
  c: ComparisonCell,
  method?: string
): { main: string; sub?: string; subClass?: string; methodHint?: string } {
  if (c.value === null || Number.isNaN(c.value)) {
    return { main: "Not reported", methodHint: comparisonMethodLabel(method) };
  }
  const main = formatMetricValue(id, c.value);
  const y = formatYoY(c.yoyPct, c.yoyBps, preferBps(id));
  const methodHint = comparisonMethodLabel(method);
  if (y.text === "—") return { main, methodHint };
  return {
    main,
    sub: `(${y.text.replace(" YoY", "")})`,
    subClass: yoYClass(y.tone),
    methodHint,
  };
}

type SortCol = "metric" | "country" | "avgCountry" | "global";

export default function DashboardComparisonTable({
  year,
  dataYear,
  membersCount,
  countryName,
  rows,
  onExport,
}: Props) {
  const [sortKey, setSortKey] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [fullscreen, setFullscreen] = useState(false);

  const exitFullscreen = useCallback(() => setFullscreen(false), []);

  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen, exitFullscreen]);

  const onSort = useCallback(
    (key: string) => {
      const n = toggleColumnSort(sortKey, sortDir, key as SortCol);
      setSortKey(n.col as SortCol);
      setSortDir(n.dir);
    },
    [sortKey, sortDir]
  );

  const sortedRows = useMemo(() => {
    if (sortKey === null) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "metric") return cmpString(a.label, b.label, sortDir);
      const cellA = sortKey === "country" ? a.country : sortKey === "avgCountry" ? a.avgCountry : a.global;
      const cellB = sortKey === "country" ? b.country : sortKey === "avgCountry" ? b.avgCountry : b.global;
      return cmpNullableNumber(cellA.value, cellB.value, sortDir);
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const snapshotYear = dataYear ?? year;
  const economyNote =
    membersCount != null && membersCount > 0
      ? `${membersCount} sovereign economies in cross-country aggregates (REST Countries, ISO3).`
      : "Cross-country aggregates use World Bank WDI snapshots for sovereign economies.";

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[200] box-border flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50/98 p-2 backdrop-blur-sm sm:p-3"
          : ""
      }
      role={fullscreen ? "dialog" : undefined}
      aria-modal={fullscreen || undefined}
      aria-label={fullscreen ? `Country comparison ${year}` : undefined}
    >
      <div
        className={
          fullscreen
            ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            : "rounded-2xl border border-slate-200/80 bg-white shadow-sm"
        }
      >
        {fullscreen ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h2 className="min-w-0 truncate text-base font-semibold text-slate-900">
              Country comparison ({year}) · {countryName}
            </h2>
            <button
              type="button"
              onClick={exitFullscreen}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {!fullscreen ? (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Country comparison (year {year})
              </h2>
              <p className="text-sm text-slate-500">
                {countryName} versus cross-country benchmarks at WDI snapshot year{" "}
                <strong>{snapshotYear}</strong>
                {snapshotYear !== year ? ` (requested ${year})` : ""}. {economyNote}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 sm:max-w-xl">
              Versus cross-country aggregates and WLD benchmarks — methodology varies by row.
            </p>
          )}
          <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
            {!fullscreen ? (
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                aria-label="Open table full screen"
                title="Full screen"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
                <span className="hidden sm:inline">Full screen</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onExport}
              className="text-sm font-semibold text-red-600 hover:text-red-700"
            >
              Export
            </button>
          </div>
        </div>
        <div
          className={
            fullscreen ? "cap-fs-table-shell min-h-0 flex-1 overflow-auto" : "overflow-x-auto"
          }
        >
        <table className={`min-w-full text-left ${fullscreen ? "text-base" : "text-sm"}`}>
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <SortableTh
                columnKey="metric"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="px-5 py-3 font-medium normal-case"
              >
                Metric
              </SortableTh>
              <SortableTh
                columnKey="country"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="px-5 py-3 font-medium normal-case"
                align="right"
              >
                {countryName}
              </SortableTh>
              <SortableTh
                columnKey="avgCountry"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="px-5 py-3 font-medium normal-case"
                align="right"
              >
                Avg country
                <span className="mt-0.5 block text-[10px] font-normal normal-case text-slate-400">
                  Median / weighted mean
                </span>
              </SortableTh>
              <SortableTh
                columnKey="global"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="px-5 py-3 font-medium normal-case"
                align="right"
              >
                Global (WLD)
                <span className="mt-0.5 block text-[10px] font-normal normal-case text-slate-400">
                  World aggregate or sum
                </span>
              </SortableTh>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                <td className="px-4 py-2.5 text-slate-700">{r.label}</td>
                {[r.country, r.avgCountry, r.global].map((cell, i) => {
                  const method =
                    i === 1 ? r.avgMethod : i === 2 ? r.globalMethod : undefined;
                  const f = cellBlock(r.id, cell, method);
                  return (
                    <td key={i} className="px-5 py-3 text-right align-top">
                      <div className="font-semibold text-slate-900">{f.main}</div>
                      {f.sub && <div className={`text-xs ${f.subClass}`}>{f.sub}</div>}
                      {f.methodHint && i > 0 ? (
                        <div className="mt-0.5 text-[10px] leading-snug text-slate-400">{f.methodHint}</div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        <div
          className={`shrink-0 border-t border-slate-100 px-4 py-3 ${fullscreen ? "" : ""}`}
        >
          <p className="text-xs leading-relaxed text-slate-500">
            <span className="font-medium text-slate-700">Avg country</span> uses median or
            population-/labour-weighted means across reporting economies;{" "}
            <span className="font-medium text-slate-700">Global (WLD)</span> prefers the World Bank
            world aggregate, then credible fallbacks (sum, weighted, or median). Hover cells for
            per-metric method notes.{" "}
            <Link
              to={COUNTRY_COMPARISON_METHODOLOGY_PATH}
              className="font-semibold text-red-600 hover:text-red-700 hover:underline"
            >
              View comparison methodology
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
