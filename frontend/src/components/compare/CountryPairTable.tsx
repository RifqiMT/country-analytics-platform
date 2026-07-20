import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { SeriesPoint } from "../../api";
import {
  countryAIsAhead,
  describeCompareDelta,
  formatCompareMetricValue,
  preferBpsForMetric,
} from "../../lib/compareMetricFormat";
import {
  latestAtOrBefore,
  yoyAtSnapshot,
  yoyBpsAtSnapshot,
} from "../../lib/countrySeriesFetch";
import { downloadCsv } from "../../lib/csv";
import { formatYoY, yoYClass } from "../../lib/formatValue";
import { cmpNullableNumber, cmpString, toggleColumnSort, type SortDir } from "../../lib/tableSort";
import SortableTh from "../ui/SortableTh";
import CompareCountryLegend from "./CompareCountryLegend";
import { CompareCountryCell } from "./ComparePairField";
import { COMPARE_COLOR_A, COMPARE_COLOR_B } from "../../lib/compareChartMerge";

type PairComparisonCell = {
  value: number | null;
  dataYear: number | null;
  yoyPct: number | null;
  yoyBps: number | null;
};

export type PairComparisonRow = {
  id: string;
  label: string;
  category: string;
  unit: string;
  countryA: PairComparisonCell;
  countryB: PairComparisonCell;
  delta: number | null;
  deltaPct: number | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  financial: "Financial",
  health: "Health & demographics",
  education: "Education",
  labour: "Labour",
  demographics: "Demographics",
  crime: "Crime & public safety",
  general: "General",
};

type Props = {
  snapshotYear: number;
  countryAName: string;
  countryBName: string;
  rows: PairComparisonRow[];
};

type SortCol = "metric" | "countryA" | "countryB" | "comparison";

function cellFromSeries(series: SeriesPoint[], snapshotYear: number): PairComparisonCell {
  const pt = latestAtOrBefore(series, snapshotYear);
  return {
    value: pt?.value ?? null,
    dataYear: pt?.year ?? null,
    yoyPct: yoyAtSnapshot(series, snapshotYear),
    yoyBps: yoyBpsAtSnapshot(series, snapshotYear),
  };
}

export function buildPairComparisonRows(
  metricIds: readonly { id: string; label: string; category: string; unit: string }[],
  bundleA: Record<string, SeriesPoint[]>,
  bundleB: Record<string, SeriesPoint[]>,
  snapshotYear: number
): PairComparisonRow[] {
  return metricIds.map((m) => {
    const countryA = cellFromSeries(bundleA[m.id] ?? [], snapshotYear);
    const countryB = cellFromSeries(bundleB[m.id] ?? [], snapshotYear);
    let delta: number | null = null;
    let deltaPct: number | null = null;
    if (countryA.value != null && countryB.value != null) {
      delta = countryA.value - countryB.value;
      if (countryB.value !== 0) {
        deltaPct = (delta / Math.abs(countryB.value)) * 100;
      }
    }
    return {
      id: m.id,
      label: m.label,
      category: m.category,
      unit: m.unit,
      countryA,
      countryB,
      delta,
      deltaPct,
    };
  });
}

function CellValue({
  id,
  unit,
  cell,
  snapshotYear,
  side,
  name,
  highlight,
}: {
  id: string;
  unit: string;
  cell: PairComparisonCell;
  snapshotYear: number;
  side: "a" | "b";
  name: string;
  highlight?: boolean;
}) {
  const inner =
    cell.value === null || Number.isNaN(cell.value) ? (
      <span className="text-slate-400">Not reported</span>
    ) : (
      <>
        <span className="font-semibold tabular-nums text-slate-900">
          {formatCompareMetricValue(id, cell.value, unit)}
        </span>
        {cell.dataYear != null && cell.dataYear !== snapshotYear ? (
          <p className="mt-0.5 text-[10px] text-slate-400">Data year {cell.dataYear}</p>
        ) : null}
        {(() => {
          const y = formatYoY(cell.yoyPct, cell.yoyBps, preferBpsForMetric(id));
          return y.text !== "—" ? (
            <p className={`mt-0.5 text-[11px] font-medium tabular-nums ${yoYClass(y.tone)}`}>{y.text}</p>
          ) : null;
        })()}
      </>
    );

  return (
    <CompareCountryCell side={side} name={name} highlight={highlight} showName={false}>
      {inner}
    </CompareCountryCell>
  );
}

export default function CountryPairTable({
  snapshotYear,
  countryAName,
  countryBName,
  rows,
}: Props) {
  const [sortKey, setSortKey] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [fullscreen, setFullscreen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

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

  const categories = useMemo(() => {
    const set = new Set(rows.map((r) => r.category));
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (q && !`${r.label} ${r.category} ${r.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, category]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      if (sortKey === "metric") return cmpString(a.label, b.label, sortDir);
      if (sortKey === "countryA") return cmpNullableNumber(a.countryA.value, b.countryA.value, sortDir);
      if (sortKey === "countryB") return cmpNullableNumber(a.countryB.value, b.countryB.value, sortDir);
      return cmpNullableNumber(a.delta, b.delta, sortDir);
    });
  }, [filtered, sortKey, sortDir]);

  const grouped = useMemo(() => {
    if (sortKey) return [{ category: null as string | null, rows: sorted }];
    const acc: { category: string; rows: PairComparisonRow[] }[] = [];
    const byCat: Record<string, PairComparisonRow[]> = {};
    for (const r of sorted) {
      byCat[r.category] = byCat[r.category] ?? [];
      byCat[r.category].push(r);
    }
    for (const cat of Object.keys(byCat).sort()) {
      acc.push({ category: cat, rows: byCat[cat]! });
    }
    return acc;
  }, [sorted, sortKey]);

  const onSort = useCallback(
    (key: string) => {
      const n = toggleColumnSort(sortKey, sortDir, key as SortCol);
      setSortKey(n.col as SortCol);
      setSortDir(n.dir);
    },
    [sortKey, sortDir]
  );

  const exportCsv = useCallback(() => {
    const safe = (s: string) =>
      s
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase()
        .slice(0, 40);
    const headers = [
      "metric",
      "category",
      countryAName,
      `${countryAName}_year`,
      countryBName,
      `${countryBName}_year`,
      "delta",
      "delta_pct",
    ];
    const csvRows = sorted.map((r) => [
      r.label,
      r.category,
      r.countryA.value,
      r.countryA.dataYear,
      r.countryB.value,
      r.countryB.dataYear,
      r.delta,
      r.deltaPct,
    ]);
    downloadCsv(
      `compare_${safe(countryAName)}_vs_${safe(countryBName)}_${snapshotYear}.csv`,
      headers,
      csvRows
    );
  }, [sorted, countryAName, countryBName, snapshotYear]);

  const table = (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <SortableTh columnKey="metric" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="min-w-[12rem] px-5 py-3 font-medium normal-case">
              Metric
            </SortableTh>
            <SortableTh columnKey="countryA" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="min-w-[9rem] bg-blue-50/30 px-5 py-3 font-medium normal-case">
              <span className="inline-flex items-center gap-1.5" style={{ color: COMPARE_COLOR_A }}>
                <span className="h-0 w-3 border-t-2" style={{ borderColor: COMPARE_COLOR_A }} aria-hidden />
                {countryAName}
              </span>
            </SortableTh>
            <SortableTh columnKey="countryB" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="min-w-[9rem] bg-orange-50/30 px-5 py-3 font-medium normal-case">
              <span className="inline-flex items-center gap-1.5" style={{ color: COMPARE_COLOR_B }}>
                <span
                  className="h-0 w-3 border-t-2 border-dashed"
                  style={{ borderColor: COMPARE_COLOR_B }}
                  aria-hidden
                />
                {countryBName}
              </span>
            </SortableTh>
            <SortableTh columnKey="comparison" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="min-w-[14rem] px-5 py-3 font-medium normal-case">
              How they compare
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {grouped.map((group) => (
            <Fragment key={group.category ?? "all"}>
              {group.category && !sortKey ? (
                <tr className="bg-slate-50/80">
                  <td colSpan={4} className="px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {CATEGORY_LABEL[group.category] ?? group.category}
                  </td>
                </tr>
              ) : null}
              {group.rows.map((row) => {
                const ahead = row.delta != null ? countryAIsAhead(row.id, row.delta) : null;
                const aLeads = ahead === true;
                const bLeads = ahead === false;
                const comparison =
                  row.delta != null
                    ? describeCompareDelta({
                        metricId: row.id,
                        delta: row.delta,
                        deltaPct: row.deltaPct,
                        nameA: countryAName,
                        nameB: countryBName,
                      })
                    : null;
                return (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-medium text-slate-800">{row.label}</td>
                    <td className="bg-blue-50/15 px-5 py-3">
                      <CellValue
                        id={row.id}
                        unit={row.unit}
                        cell={row.countryA}
                        snapshotYear={snapshotYear}
                        side="a"
                        name={countryAName}
                        highlight={aLeads}
                      />
                    </td>
                    <td className="bg-orange-50/15 px-5 py-3">
                      <CellValue
                        id={row.id}
                        unit={row.unit}
                        cell={row.countryB}
                        snapshotYear={snapshotYear}
                        side="b"
                        name={countryBName}
                        highlight={bLeads}
                      />
                    </td>
                    <td className="max-w-md px-5 py-3 text-xs leading-relaxed text-slate-600">
                      {comparison ? (
                        <>
                          <p className="text-slate-700">{comparison.primary}</p>
                          {comparison.secondary ? <p className="mt-0.5 text-slate-500">{comparison.secondary}</p> : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">No metrics match your search.</p>
      ) : null}
    </div>
  );

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[200] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50 p-2 sm:p-3"
          : ""
      }
      role={fullscreen ? "dialog" : undefined}
      aria-modal={fullscreen || undefined}
    >
      <div
        className={`flex flex-col overflow-hidden bg-white shadow-sm ${
          fullscreen ? "min-h-0 flex-1 rounded-2xl border border-slate-200" : "rounded-2xl border border-slate-200/80"
        }`}
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Snapshot year {snapshotYear} · showing {sorted.length} of {rows.length} indicators
            </p>
            <div className="flex shrink-0 items-center gap-1.5 sm:ml-auto">
              {!fullscreen ? (
                <>
                  <button
                    type="button"
                    onClick={() => setFullscreen(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:px-3 sm:py-1.5 sm:text-xs"
                    title="Full screen"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                    <span className="hidden sm:inline">Full screen</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:px-3 sm:py-1.5 sm:text-xs"
                    title="Export table as CSV"
                    aria-label="Export table as CSV"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v10m0 0l-4-4m4 4l4-4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
                    </svg>
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:px-3 sm:py-1.5 sm:text-xs"
                    title="Export table as CSV"
                    aria-label="Export table as CSV"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v10m0 0l-4-4m4 4l4-4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
                    </svg>
                    <span className="hidden sm:inline">Export</span>
                  </button>
                  <button
                    type="button"
                    onClick={exitFullscreen}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
          <CompareCountryLegend nameA={countryAName} nameB={countryBName} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search metrics…"
              aria-label="Search metrics"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    category === cat
                      ? "border-slate-800 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {cat === "all" ? "All" : CATEGORY_LABEL[cat] ?? cat}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={fullscreen ? "min-h-0 flex-1 overflow-auto" : "max-h-[28rem] overflow-auto sm:max-h-[36rem]"}>
          {table}
        </div>
      </div>
    </div>
  );
}
