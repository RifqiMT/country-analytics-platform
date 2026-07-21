import { useCallback, useEffect, useMemo, useState } from "react";
import PageIntro from "../components/layout/PageIntro";
import { PAGE_INTRO } from "../lib/platformCopy";
import ChartTableToggle from "../components/charts/ChartTableToggle";
import GlobalChoropleth from "../components/global/GlobalChoropleth";
import GlobalWldCharts from "../components/global/GlobalWldCharts";
import GlobalAnalyticsToolbar from "../components/global/GlobalAnalyticsToolbar";
import SortableTh from "../components/ui/SortableTh";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmpty,
  DataTableFooterBar,
  DataTableHead,
  DataTableMetricValue,
  DataTableRow,
  DataTableShell,
  DATA_TABLE_TH_LABEL,
  DATA_TABLE_TH_SORT_RIGHT,
} from "../components/ui/DataTable";
import LoadingProgressSection from "../components/ui/LoadingProgressSection";
import { startSimulatedLoadProgress } from "../lib/loadProgress";
import { getJson, type CountrySummary, type MetricDef } from "../api";
import { metricDisplayLabel } from "../lib/metricDisplay";
import { downloadCsv } from "../lib/csv";
import { formatCompactNumber, formatYoY, yoYClass } from "../lib/formatValue";
import { maxSelectableYear } from "../lib/yearBounds";
import { buildGeoNameToIso3Lookup } from "../lib/geoNameToIso3";
import { flagEmojiFromAlpha2 } from "../lib/flagEmoji";
import { cmpNullableNumber, cmpString, toggleColumnSort, type SortDir } from "../lib/tableSort";

type ViewMode = "map" | "table" | "charts";
type TableCategory = "general" | "financial" | "health" | "education" | "crime";

type TableColumn = {
  id: string;
  label: string;
  format: "text" | "number" | "percent";
  yoyBps: boolean;
  description?: string;
};

type TableCell = {
  value: number | null;
  yoyPct: number | null;
  yoyBps: number | null;
};

type TableRow = {
  iso3: string;
  name: string;
  flagPng?: string;
  cells: Record<string, string | TableCell>;
};

type Snapshot = {
  metricId: string;
  year: number;
  dataYear?: number;
  requestedYear?: number;
  rows: { countryIso3: string; countryName: string; value: number | null }[];
};

type GlobalTablePayload = {
  requestedYear: number;
  dataYear: number;
  columns: TableColumn[];
  rows: TableRow[];
  /** Calendar years scanned backward per metric (financial tab uses full span from MIN_DATA_YEAR). */
  wdiLookbackYears?: number;
};

const MAP_METRIC_FALLBACK_ORDER = [
  "gdp",
  "gdp_ppp",
  "gdp_per_capita",
  "gni_per_capita_atlas",
  "population",
  "life_expectancy",
  "homicide_rate",
  "gov_debt_pct_gdp",
  "inflation",
] as const;

/** Choropleth tooltip + legend — rates/shares as %; levels as compact US$ / counts. */
const MAP_METRIC_VALUE_PERCENT = new Set([
  "gdp_growth",
  "gov_debt_pct_gdp",
  "inflation",
  "lending_rate",
  "interest_real",
  "unemployment_ilo",
  "poverty_headcount",
  "poverty_national",
  "undernourishment",
  "immunization_dpt",
  "immunization_measles",
  "health_expenditure_gdp",
  "smoking_prevalence",
  "pop_age_0_14",
  "pop_15_64_pct",
  "pop_age_65_plus",
  "gbv_women_pct",
]);

function missingWdiCellLabel(_cat: TableCategory): string {
  return "No value (WDI + IMF / UIS gap-fills exhausted)";
}

function formatTableCell(
  col: TableColumn,
  cell: string | TableCell | undefined,
  tableCat: TableCategory
): { main: string; sub?: string; subClass?: string } {
  if (cell === undefined) return { main: "Not reported" };
  if (typeof cell === "string") {
    if ((col.id === "area" || col.id === "eez") && cell !== "—" && !Number.isNaN(Number(cell))) {
      const n = Number(cell);
      if (Number.isFinite(n)) return { main: formatCompactNumber(n, { suffix: " km²", maxFrac: 2 }) };
    }
    if (cell === "—") return { main: "Not reported" };
    return { main: cell };
  }
  if (cell.value === null || Number.isNaN(cell.value)) {
    return { main: missingWdiCellLabel(tableCat) };
  }
  let main: string;
  if (col.format === "percent") main = `${cell.value.toFixed(1)}%`;
  else if (col.id === "area" || col.id === "eez") main = formatCompactNumber(cell.value, { suffix: " km²", maxFrac: 2 });
  else main = formatCompactNumber(cell.value, { maxFrac: 2 });
  const y = formatYoY(cell.yoyPct, cell.yoyBps, col.yoyBps);
  if (y.text === "—" || col.format === "text") return { main };
  return { main, sub: y.text, subClass: yoYClass(y.tone) };
}

function cellSortNumber(cell: string | TableCell | undefined): number | null {
  if (cell === undefined) return null;
  if (typeof cell === "string") {
    if (cell === "—") return null;
    const n = Number(cell);
    return Number.isFinite(n) ? n : null;
  }
  if (cell.value === null || Number.isNaN(cell.value)) return null;
  return cell.value;
}

function compareGlobalTableRows(
  a: TableRow,
  b: TableRow,
  colId: string,
  column: TableColumn | undefined,
  dir: SortDir,
  tableCat: TableCategory
): number {
  if (colId === "name") return cmpString(a.name, b.name, dir);
  if (colId === "iso3") return cmpString(a.iso3, b.iso3, dir);
  if (!column) return 0;
  const ca = a.cells[colId];
  const cb = b.cells[colId];
  if (column.format === "text") {
    const sa = typeof ca === "string" ? ca : formatTableCell(column, ca, tableCat).main;
    const sb = typeof cb === "string" ? cb : formatTableCell(column, cb, tableCat).main;
    return cmpString(sa, sb, dir);
  }
  const na = cellSortNumber(ca);
  const nb = cellSortNumber(cb);
  if (na !== null || nb !== null) return cmpNullableNumber(na, nb, dir);
  const fa = formatTableCell(column, ca, tableCat).main;
  const fb = formatTableCell(column, cb, tableCat).main;
  return cmpString(fa, fb, dir);
}

function GlobalMapMetricTable({
  rows,
  allowedIso3,
  metricLabel,
  year,
}: {
  rows: { countryIso3: string; countryName: string; value: number | null }[];
  allowedIso3: Set<string>;
  metricLabel: string;
  year: number;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const onSort = useCallback(
    (key: string) => {
      const n = toggleColumnSort(sortKey, sortDir, key);
      setSortKey(n.col);
      setSortDir(n.dir);
    },
    [sortKey, sortDir]
  );

  const filtered = useMemo(
    () => rows.filter((r) => allowedIso3.has(r.countryIso3.toUpperCase())),
    [rows, allowedIso3]
  );

  const sorted = useMemo(() => {
    if (sortKey === null) return [...filtered].sort((a, b) => a.countryName.localeCompare(b.countryName));
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "country") return cmpString(a.countryName, b.countryName, sortDir);
      if (sortKey === "iso3") return cmpString(a.countryIso3, b.countryIso3, sortDir);
      return cmpNullableNumber(a.value, b.value, sortDir);
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  return (
    <DataTableShell
      framed={false}
      footer={
        <DataTableFooterBar
          count={sorted.length}
          label={sorted.length === 1 ? "country" : "countries"}
        />
      }
    >
      <DataTable compact>
      <DataTableHead>
        <DataTableRow>
          <SortableTh
            columnKey="country"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            sticky
            className={DATA_TABLE_TH_LABEL}
          >
            Country
          </SortableTh>
          <SortableTh
            columnKey="iso3"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            className={DATA_TABLE_TH_SORT_RIGHT}
          >
            ISO3
          </SortableTh>
          <SortableTh
            columnKey="value"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            align="right"
            className={DATA_TABLE_TH_SORT_RIGHT}
          >
            {metricLabel} ({year})
          </SortableTh>
        </DataTableRow>
      </DataTableHead>
      <DataTableBody>
        {sorted.map((r) => (
          <DataTableRow key={r.countryIso3}>
            <DataTableCell sticky label>
              {r.countryName}
            </DataTableCell>
            <DataTableCell muted className="uppercase">
              {r.countryIso3}
            </DataTableCell>
            <DataTableCell numeric>
              {r.value === null || Number.isNaN(r.value) ? (
                <DataTableEmpty />
              ) : (
                formatCompactNumber(r.value, { maxFrac: 2 })
              )}
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}

export default function GlobalAnalytics() {
  const maxYear = maxSelectableYear();
  const [year, setYear] = useState(() => maxSelectableYear());
  const [region, setRegion] = useState("All");
  const [view, setView] = useState<ViewMode>("map");
  const [mapMetric, setMapMetric] = useState("gdp");
  const [tableCat, setTableCat] = useState<TableCategory>("general");

  const [metrics, setMetrics] = useState<MetricDef[]>([]);
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [tableData, setTableData] = useState<GlobalTablePayload | null>(null);
  const [tableSortKey, setTableSortKey] = useState<string | null>(null);
  const [tableSortDir, setTableSortDir] = useState<SortDir>("asc");
  const [tableFullscreen, setTableFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapLoadProgress, setMapLoadProgress] = useState(0);
  const [tableLoadProgress, setTableLoadProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const regions = useMemo(() => {
    const s = new Set<string>();
    countries.forEach((c) => {
      if (c.region) s.add(c.region);
    });
    return ["All", ...[...s].sort()];
  }, [countries]);

  const allowedIso3 = useMemo(() => {
    if (region === "All") return new Set(countries.map((c) => c.cca3.toUpperCase()));
    return new Set(countries.filter((c) => c.region === region).map((c) => c.cca3.toUpperCase()));
  }, [countries, region]);

  const mapMetricOptions = useMemo(() => {
    const picked = [...metrics];
    picked.sort((a, b) => {
      const ca = a.category.localeCompare(b.category);
      if (ca !== 0) return ca;
      return a.id.localeCompare(b.id);
    });
    return picked;
  }, [metrics]);

  useEffect(() => {
    if (mapMetricOptions.length === 0) return;
    if (!mapMetricOptions.some((m) => m.id === mapMetric)) {
      const first = MAP_METRIC_FALLBACK_ORDER.find((id) => mapMetricOptions.some((m) => m.id === id));
      setMapMetric(first ?? mapMetricOptions[0].id);
    }
  }, [mapMetric, mapMetricOptions]);

  const geoNameToIso3 = useMemo(
    () => buildGeoNameToIso3Lookup(countries, snapshot?.rows),
    [countries, snapshot?.rows]
  );

  const flagByIso3 = useMemo(() => {
    const m = new Map<string, { emoji: string; flagPng?: string }>();
    for (const c of countries) {
      const iso3 = c.cca3.toUpperCase();
      const emoji = c.cca2 ? flagEmojiFromAlpha2(c.cca2) : "";
      m.set(iso3, { emoji, flagPng: c.flags?.png });
    }
    return m;
  }, [countries]);

  const valueByIso3 = useMemo(() => {
    const m = new Map<string, number>();
    if (!snapshot) return m;
    for (const r of snapshot.rows) {
      if (r.value !== null && !Number.isNaN(r.value)) {
        m.set(r.countryIso3.toUpperCase(), r.value);
      }
    }
    return m;
  }, [snapshot]);

  const mapMeta = useMemo(() => {
    const m = metrics.find((x) => x.id === mapMetric);
    return {
      label: m ? metricDisplayLabel(m) : mapMetric,
      description: m?.description ?? "",
    };
  }, [mapMetric, metrics]);

  const mapMetricDef = useMemo(() => metrics.find((m) => m.id === mapMetric), [metrics, mapMetric]);
  const mapValueFormat =
    MAP_METRIC_VALUE_PERCENT.has(mapMetric) || mapMetricDef?.unit.includes("%")
      ? ("percent" as const)
      : ("compact" as const);

  useEffect(() => {
    getJson<MetricDef[]>("/api/metrics").then(setMetrics).catch(console.error);
    getJson<CountrySummary[]>("/api/countries").then(setCountries).catch(console.error);
  }, []);

  useEffect(() => {
    if (view !== "map") return;
    let active = true;
    setLoading(true);
    setErr(null);
    setSnapshot(null);
    setMapLoadProgress(8);
    const stopMapProgress = startSimulatedLoadProgress(setMapLoadProgress);
    getJson<Snapshot>(`/api/global/snapshot?metric=${mapMetric}&year=${year}`)
      .then((data) => {
        if (!active) return;
        setSnapshot(data);
        setMapLoadProgress(100);
      })
      .catch((e) => {
        if (!active) return;
        setErr(String(e));
        setMapLoadProgress(0);
      })
      .finally(() => {
        if (!active) return;
        stopMapProgress();
        setLoading(false);
      });
    return () => {
      active = false;
      stopMapProgress();
    };
  }, [view, mapMetric, year]);

  useEffect(() => {
    if (view !== "table") return;
    let active = true;
    setLoading(true);
    setErr(null);
    setTableData(null);
    setTableLoadProgress(8);
    const stopTableProgress = startSimulatedLoadProgress(setTableLoadProgress);
    const q = new URLSearchParams({ year: String(year), region, category: tableCat });
    getJson<GlobalTablePayload>(`/api/global/table?${q}`)
      .then((payload) => {
        if (!active) return;
        setTableData(payload);
        setTableLoadProgress(100);
      })
      .catch((e) => {
        if (!active) return;
        setErr(String(e));
        setTableLoadProgress(0);
      })
      .finally(() => {
        if (!active) return;
        stopTableProgress();
        setLoading(false);
      });
    return () => {
      active = false;
      stopTableProgress();
    };
  }, [view, year, region, tableCat]);

  useEffect(() => {
    setTableSortKey(null);
  }, [tableData]);

  useEffect(() => {
    if (view !== "table") setTableFullscreen(false);
  }, [view]);

  const exitTableFullscreen = useCallback(() => setTableFullscreen(false), []);

  useEffect(() => {
    if (!tableFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitTableFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [tableFullscreen, exitTableFullscreen]);

  const onTableSort = useCallback(
    (key: string) => {
      const n = toggleColumnSort(tableSortKey, tableSortDir, key);
      setTableSortKey(n.col);
      setTableSortDir(n.dir);
    },
    [tableSortKey, tableSortDir]
  );

  const sortedTableRows = useMemo(() => {
    if (!tableData) return [];
    if (tableSortKey === null) return tableData.rows;
    const col = tableData.columns.find((c) => c.id === tableSortKey);
    const copy = [...tableData.rows];
    copy.sort((a, b) => compareGlobalTableRows(a, b, tableSortKey, col, tableSortDir, tableCat));
    return copy;
  }, [tableData, tableSortKey, tableSortDir, tableCat]);

  const exportTable = () => {
    if (!tableData) return;
    const headers = ["iso3", "name", ...tableData.columns.map((c) => c.id)];
    const rows = sortedTableRows.map((r) => {
      const vals = tableData.columns.map((c) => {
        const cell = r.cells[c.id];
        if (cell === undefined) return "Not reported";
        if (typeof cell === "string") return cell;
        if (cell.value === null || Number.isNaN(cell.value)) return missingWdiCellLabel(tableCat);
        return cell.value;
      });
      return [r.iso3, r.name, ...vals];
    });
    downloadCsv(`global_table_${tableCat}_${tableData.dataYear}.csv`, headers, rows);
  };

  const tableDataYear = tableData?.dataYear ?? year;
  const tableYearMismatch = tableData && tableData.requestedYear !== tableData.dataYear;
  const mapDataYear = snapshot?.dataYear ?? snapshot?.year ?? year;
  const mapYearMismatch = Boolean(
    snapshot && (snapshot.requestedYear ?? year) !== mapDataYear
  );

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageIntro {...PAGE_INTRO.global} />

      <GlobalAnalyticsToolbar
        year={year}
        maxYear={maxYear}
        onYearChange={setYear}
        region={region}
        regions={regions}
        onRegionChange={setRegion}
        view={view}
        onViewChange={setView}
        mapMetric={mapMetric}
        mapMetricOptions={mapMetricOptions}
        mapMetricFallbackIds={MAP_METRIC_FALLBACK_ORDER}
        onMapMetricChange={setMapMetric}
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {err.replace(/^Error:\s*/i, "")}
        </div>
      ) : null}

      {view === "map" && loading ? (
        <LoadingProgressSection label="Loading global map data…" progress={mapLoadProgress} />
      ) : null}

      {view === "map" && !loading && snapshot ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{mapMeta.label}</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Choropleth and sortable table for {region === "All" ? "all countries" : region}. Data year{" "}
                  <span className="font-semibold text-slate-700">{mapDataYear}</span>
                  {mapYearMismatch ? (
                    <span className="text-slate-400">
                      {" "}
                      (selected {snapshot.requestedYear ?? year}; using best coverage year)
                    </span>
                  ) : null}
                  .
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="cap-map-shell flex h-[min(55vh,520px)] min-h-[320px] w-full flex-col">
              <ChartTableToggle
                chartLabel="Map"
                tableLabel="Table"
                className="flex h-full min-h-0 w-full flex-1 flex-col"
                vizTitle={`Map · ${mapMeta.label}`}
                chart={
                  <GlobalChoropleth
                    valueByIso3={valueByIso3}
                    geoNameToIso3={geoNameToIso3}
                    flagByIso3={flagByIso3}
                    regionFilter={region}
                    allowedIso3={allowedIso3}
                    metricId={mapMetric}
                    metricLabel={mapMeta.label}
                    metricDescription={mapMeta.description}
                    year={mapDataYear}
                    valueFormat={mapValueFormat}
                  />
                }
                table={
                  <GlobalMapMetricTable
                    rows={snapshot.rows}
                    allowedIso3={allowedIso3}
                    metricLabel={mapMeta.label}
                    year={mapDataYear}
                  />
                }
              />
            </div>
          </div>
        </section>
      ) : null}

      {view === "map" && !loading && !snapshot && !err ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center">
          <p className="text-sm text-slate-500">Map data is unavailable for this selection. Try another year or metric.</p>
        </div>
      ) : null}

      {view === "table" && loading ? (
        <LoadingProgressSection label="Loading global table data…" progress={tableLoadProgress} />
      ) : null}

      {view === "table" && tableData && (
        <div
          className={
            tableFullscreen
              ? "fixed inset-0 z-[200] box-border flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50/98 p-2 backdrop-blur-sm sm:p-3"
              : ""
          }
          role={tableFullscreen ? "dialog" : undefined}
          aria-modal={tableFullscreen || undefined}
          aria-label={tableFullscreen ? "Global country table" : undefined}
        >
          <section
            className={
              tableFullscreen
                ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                : "rounded-2xl border border-slate-200 bg-white shadow-sm"
            }
          >
            {tableFullscreen ? (
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <h2 className="min-w-0 truncate text-base font-semibold text-slate-900">
                  Global country table · WDI {tableDataYear}
                </h2>
                <button
                  type="button"
                  onClick={exitTableFullscreen}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            ) : null}
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              {!tableFullscreen ? (
                <div>
                  <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Country table</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Primary year <span className="font-semibold text-slate-700">{tableDataYear}</span>
                    {tableYearMismatch ? (
                      <span className="text-slate-400">
                        {" "}
                        (requested {tableData.requestedYear}; using best publishable year)
                      </span>
                    ) : null}
                    . Missing cells fall back to each country&apos;s latest available value.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 sm:max-w-xl">
                  Category: <span className="font-semibold text-slate-700">{tableCat}</span> · Year{" "}
                  <span className="font-semibold text-slate-700">{tableDataYear}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {!tableFullscreen ? (
                  <button
                    type="button"
                    onClick={() => setTableFullscreen(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
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
                  onClick={exportTable}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  title="Export CSV"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2.5">
              {(
                [
                  ["general", "General"],
                  ["financial", "Financial"],
                  ["health", "Health"],
                  ["education", "Education"],
                  ["crime", "Crime"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTableCat(id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                    tableCat === id
                      ? "bg-teal-700 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          <DataTableShell
            wide
            scrollClassName={
              tableFullscreen
                ? "cap-fs-table-shell min-h-0 flex-1"
                : "max-h-[min(70vh,720px)]"
            }
            footer={
              <DataTableFooterBar
                count={sortedTableRows.length}
                label={sortedTableRows.length === 1 ? "country" : "countries"}
                wide
              />
            }
          >
            <DataTable wide>
              <DataTableHead>
                <DataTableRow>
                  <SortableTh
                    columnKey="name"
                    sortKey={tableSortKey}
                    sortDir={tableSortDir}
                    onSort={onTableSort}
                    sticky
                    className={DATA_TABLE_TH_LABEL}
                  >
                    Country
                  </SortableTh>
                  <SortableTh
                    columnKey="iso3"
                    sortKey={tableSortKey}
                    sortDir={tableSortDir}
                    onSort={onTableSort}
                    className={DATA_TABLE_TH_SORT_RIGHT}
                  >
                    Code
                  </SortableTh>
                  {tableData.columns.map((c) => (
                    <SortableTh
                      key={c.id}
                      columnKey={c.id}
                      sortKey={tableSortKey}
                      sortDir={tableSortDir}
                      onSort={onTableSort}
                      align="right"
                      className={DATA_TABLE_TH_SORT_RIGHT}
                      title={c.description}
                    >
                      {c.label}
                    </SortableTh>
                  ))}
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {sortedTableRows.map((r) => (
                  <DataTableRow key={r.iso3}>
                    <DataTableCell sticky label>
                      <span className="inline-flex min-w-0 items-center gap-2">
                        {r.flagPng ? (
                          <img
                            src={r.flagPng}
                            alt=""
                            className="h-4 w-6 shrink-0 rounded-[3px] border border-slate-200 object-cover"
                          />
                        ) : null}
                        <span className="truncate">{r.name}</span>
                      </span>
                    </DataTableCell>
                    <DataTableCell muted className="whitespace-nowrap uppercase">
                      {r.iso3}
                    </DataTableCell>
                    {tableData.columns.map((c) => {
                      const f = formatTableCell(c, r.cells[c.id], tableCat);
                      return (
                        <DataTableCell key={c.id} numeric>
                          <DataTableMetricValue
                            value={f.main}
                            delta={f.sub}
                            deltaClassName={f.subClass ?? "text-slate-500"}
                          />
                        </DataTableCell>
                      );
                    })}
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableShell>
          <p
            className={`border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 ${tableFullscreen ? "shrink-0" : ""}`}
          >
            {tableCat === "financial" ? (
              <>
                Sources: World Bank WDI; IMF WEO gap-fill for nominal and PPP GDP (scaled from billions), GDP per capita
                (NGDPDPC / PPPPC), population (LP, scaled from millions), government debt (% GDP), inflation (PCPIPCH),
                and unemployment (LUR) where WDI is null; unemployment also uses modeled ILO with national-estimate
                fallback; derived US$ debt and per-capita figures as described above.{" "}
                {tableData.wdiLookbackYears != null && tableData.wdiLookbackYears > 0 ? (
                  <>Up to {tableData.wdiLookbackYears} calendar years are considered per cell.</>
                ) : null}{" "}
                Lending rates are often unpublished in WDI for smaller economies — those cells may show “
                {missingWdiCellLabel("financial")}”.
              </>
            ) : tableCat === "general" ? (
              <>
                Sources: REST Countries (area, region, landlocked, government); Wikidata (government / head titles, broader
                country coverage); EEZ from Sea Around Us (UN M.49) plus a reference table, or “Landlocked (no EEZ)”.
                “Not reported” is used only when REST truly omits a field.
              </>
            ) : tableCat === "health" ? (
              <>
                Sources: World Bank WDI; age-structure gap-fill from the three population share series; life expectancy /
                under-five mortality may use male–female means as described above.{" "}
                {tableData.wdiLookbackYears != null && tableData.wdiLookbackYears > 0 ? (
                  <>Up to {tableData.wdiLookbackYears} calendar years are considered per cell.</>
                ) : null}{" "}
                Maternal mortality and undernourishment are often sparse for small economies — those cells may show “
                {missingWdiCellLabel("health")}”.
              </>
            ) : tableCat === "crime" ? (
              <>
                Sources: World Bank WDI republishing UNODC (homicide), UN/WHO surveys (gender-based violence), IDMC
                (conflict displacement), UCDP (battle deaths), and World Bank WGI (governance).{" "}
                {tableData.wdiLookbackYears != null && tableData.wdiLookbackYears > 0 ? (
                  <>Up to {tableData.wdiLookbackYears} calendar years are considered per cell.</>
                ) : null}{" "}
                Homicide and survey-based violence indicators are often reported intermittently — those cells may show “
                {missingWdiCellLabel("crime")}”.
              </>
            ) : (
              <>
                Sources: World Bank WDI; UNESCO UIS where configured for the series above; out-of-school rates may use the
                enrollment proxy described in the intro.{" "}
                {tableData.wdiLookbackYears != null && tableData.wdiLookbackYears > 0 ? (
                  <>Up to {tableData.wdiLookbackYears} calendar years are considered per cell.</>
                ) : null}{" "}
                Completion and graduation series can still be missing for some economies — those cells may show “
                {missingWdiCellLabel("education")}”.
              </>
            )}
          </p>
          </section>
        </div>
      )}

      {view === "charts" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">World aggregate charts</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              World (WLD) series grouped like the country dashboard. Use full screen on any chart for a larger view.
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <GlobalWldCharts />
          </div>
        </section>
      ) : null}
    </div>
  );
}
