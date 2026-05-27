import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import CollapsibleToolbar from "../components/layout/CollapsibleToolbar";
import PageIntro from "../components/layout/PageIntro";
import ChartTableToggle from "../components/charts/ChartTableToggle";
import AccordionSection from "../components/dashboard/AccordionSection";
import GlobalChoropleth from "../components/global/GlobalChoropleth";
import GlobalWldCharts from "../components/global/GlobalWldCharts";
import SortableTh from "../components/ui/SortableTh";
import { getJson, type CountrySummary, type MetricDef } from "../api";
import { metricDisplayLabel } from "../lib/metricDisplay";
import { downloadCsv } from "../lib/csv";
import { formatCompactNumber, formatYoY, yoYClass } from "../lib/formatValue";
import { MIN_DATA_YEAR, clampPickerYear, maxSelectableYear } from "../lib/yearBounds";
import { buildGeoNameToIso3Lookup } from "../lib/geoNameToIso3";
import { flagEmojiFromAlpha2 } from "../lib/flagEmoji";
import { cmpNullableNumber, cmpString, toggleColumnSort, type SortDir } from "../lib/tableSort";

type ViewMode = "map" | "table" | "charts";
type TableCategory = "general" | "financial" | "health" | "education";

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
    <table className="w-full min-w-[280px] border-collapse text-left text-xs">
      <thead>
        <tr className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50">
          <SortableTh
            columnKey="country"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            className="whitespace-nowrap px-3 py-2 text-slate-600"
          >
            Country
          </SortableTh>
          <SortableTh
            columnKey="iso3"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            className="whitespace-nowrap px-3 py-2 text-slate-600"
          >
            ISO3
          </SortableTh>
          <SortableTh
            columnKey="value"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            className="whitespace-nowrap px-3 py-2 text-slate-600"
          >
            {metricLabel} ({year})
          </SortableTh>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.countryIso3} className="border-b border-slate-100 hover:bg-slate-50/80">
            <td className="px-3 py-1.5 text-slate-800">{r.countryName}</td>
            <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-600">{r.countryIso3}</td>
            <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums text-slate-800">
              {r.value === null || Number.isNaN(r.value)
                ? "—"
                : formatCompactNumber(r.value, { maxFrac: 2 })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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

  const mapSelectOptions = mapMetricOptions.length > 0 ? mapMetricOptions : null;

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
    const progressTimer = window.setInterval(() => {
      setMapLoadProgress((prev) => (prev < 90 ? prev + 7 : 90));
    }, 250);
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
        window.clearInterval(progressTimer);
        setLoading(false);
      });
    return () => {
      active = false;
      window.clearInterval(progressTimer);
    };
  }, [view, mapMetric, year]);

  useEffect(() => {
    if (view !== "table") return;
    let active = true;
    setLoading(true);
    setErr(null);
    setTableData(null);
    setTableLoadProgress(10);
    const progressTimer = window.setInterval(() => {
      setTableLoadProgress((prev) => (prev < 92 ? prev + 6 : 92));
    }, 250);
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
        window.clearInterval(progressTimer);
        setLoading(false);
      });
    return () => {
      active = false;
      window.clearInterval(progressTimer);
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

  const viewBtn = (mode: ViewMode, label: string, shortLabel: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => setView(mode)}
      aria-pressed={view === mode}
      title={label}
      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition sm:gap-1.5 sm:px-2.5 sm:text-sm ${
        view === mode ? "bg-red-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icon}
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  const viewSummary =
    view === "map" ? "Map" : view === "table" ? "Global table" : "Global charts";

  return (
    <div className="space-y-4">
      <PageIntro title="Global view">
        <p>
          Analyst-grade financial, demographic, and health metrics for every country (2000 – latest),
          powered by World Bank, UN, WHO, and IMF data. Switch between an interactive world map, a full
          global country table, and global macro charts for cross-country comparison.
        </p>
      </PageIntro>

      <CollapsibleToolbar
        title="View controls"
        summary={`${viewSummary} · ${year} · ${region}`}
        forceOpen={loading}
      >
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:gap-2 md:gap-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="shrink-0">
            <label htmlFor="global-year" className="sr-only">
              Year
            </label>
            <input
              id="global-year"
              type="number"
              className="h-9 w-[4.5rem] min-w-[4.5rem] rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-medium tabular-nums text-slate-900 shadow-sm [appearance:textfield] focus:border-red-300 focus:outline-none focus:ring-1 focus:ring-red-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={year}
              min={MIN_DATA_YEAR}
              max={maxYear}
              onChange={(e) => setYear(clampPickerYear(Number(e.target.value)))}
            />
          </div>

          <div className="min-w-[5.5rem] flex-1 shrink basis-0 sm:max-w-[10rem] md:max-w-xs">
            <label htmlFor="global-region" className="sr-only">
              Region
            </label>
            <select
              id="global-region"
              className="h-9 w-full truncate rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-red-300 focus:outline-none focus:ring-1 focus:ring-red-300 sm:px-3"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden h-9 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />

          {view === "map" ? (
            <div className="min-w-[7rem] flex-1 shrink basis-0 sm:max-w-[11rem] md:max-w-sm lg:max-w-md">
              <label htmlFor="global-map-metric" className="sr-only">
                Metric on map
              </label>
              <select
                id="global-map-metric"
                className="h-9 w-full truncate rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-red-300 focus:outline-none focus:ring-1 focus:ring-red-300 sm:px-3"
                value={mapMetric}
                onChange={(e) => setMapMetric(e.target.value)}
              >
                {(mapSelectOptions
                  ? mapSelectOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {metricDisplayLabel(m)}
                      </option>
                    ))
                  : [...MAP_METRIC_FALLBACK_ORDER].map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    )))}
              </select>
            </div>
          ) : null}

          <div className="hidden h-9 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />

          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Global view mode">
            {viewBtn(
              "map",
              "Map",
              "Map",
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            )}
            {viewBtn(
              "table",
              "Global table",
              "Table",
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            )}
            {viewBtn(
              "charts",
              "Global charts",
              "Charts",
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19V5m4 14V9m4 10V7m4 12v-8" />
              </svg>
            )}
          </div>
        </div>
      </CollapsibleToolbar>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading && view !== "charts" && <p className="text-sm text-slate-500">Loading…</p>}

      {view === "map" && loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Loading global map data…</p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-red-600 transition-all duration-300"
              style={{ width: `${mapLoadProgress}%` }}
              role="progressbar"
              aria-valuenow={mapLoadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Global map data loading progress"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">{mapLoadProgress}% loaded</p>
        </section>
      ) : null}

      {view === "map" && !loading && snapshot && (
        <AccordionSection title="Geographic snapshot · map & metric table" defaultOpen>
          <p className="text-sm text-slate-600">
            Hover for country name, flag emoji, metric value, and—when available—a flag image inside the shape (REST
            Countries PNG). Default fill follows the metric scale; outline thickens on hover. Data use World Bank WDI and
            configured fallbacks (e.g. IMF for debt %). The API may use an earlier year than selected when the latest
            global release is still sparse, and if a country is still missing in that year it automatically falls back to
            that country's latest available historical value.
            <strong className="text-slate-800"> Data year: {mapDataYear}</strong>
            {mapYearMismatch ? (
              <span className="text-slate-500">
                {" "}
                (you selected {snapshot?.requestedYear ?? year}; values are from the best recent WDI year with enough
                coverage).
              </span>
            ) : null}
          </p>
          <div className="cap-map-shell mt-4 flex h-[min(55vh,520px)] min-h-[320px] w-full flex-col">
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
        </AccordionSection>
      )}

      {view === "map" && !loading && !snapshot && !err ? (
        <p className="text-sm text-slate-500">Map data is unavailable for now. Please retry.</p>
      ) : null}

      {view === "table" && loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Loading global table data…</p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-red-600 transition-all duration-300"
              style={{ width: `${tableLoadProgress}%` }}
              role="progressbar"
              aria-valuenow={tableLoadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Global table data loading progress"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">{tableLoadProgress}% loaded</p>
        </section>
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
              <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900">Global country table</h2>
              <p className="mt-1 text-sm text-slate-600">
                Primary WDI year <strong>{tableDataYear}</strong>.
                {" "}
                If a country is missing in that year, the API falls back to that country's latest available historical
                value for the selected metric.
                {tableCat === "financial" ? (
                  <>
                    {" "}
                    Financial columns scan <strong>every year from {MIN_DATA_YEAR}</strong> through {tableDataYear} until a
                    value is found. Where direct series are still empty, the API fills{" "}
                    <strong>GDP per capita</strong> and <strong>GDP per capita (PPP)</strong> from GDP ÷ population and{" "}
                    <strong>gov. debt (US$)</strong> from (debt % of GDP × nominal GDP) when both inputs exist in the
                    same ladder year. YoY uses the next older non-null step in that ladder.
                  </>
                ) : tableCat === "general" ? (
                  <> Non-numeric columns use REST Countries, Wikidata, and reference EEZ data.</>
                ) : tableCat === "health" ? (
                  <>
                    {" "}
                    Health &amp; demographics columns scan <strong>every year from {MIN_DATA_YEAR}</strong> through{" "}
                    {tableDataYear} until a value is found. Missing <strong>age-band shares</strong> (0–14, 15–64, 65+) are
                    filled as <strong>100% minus the other two</strong> when WDI reports exactly two of the three in the
                    same ladder year. <strong>Life expectancy</strong> and <strong>under-five mortality</strong> may use
                    the mean of male and female WDI series when the total is missing. YoY uses the next older non-null
                    step in that ladder.
                  </>
                ) : (
                  <>
                    {" "}
                    Education columns scan <strong>every year from {MIN_DATA_YEAR}</strong> through {tableDataYear} until a
                    value is found. WDI plus UNESCO UIS still fill many gaps. Remaining <strong>out-of-school</strong> cells
                    may use <strong>100% minus enrollment</strong> (adjusted net primary / secondary; gross tertiary capped
                    at 100%) from WDI in the same ladder year. YoY uses the next older non-null step in that ladder.
                  </>
                )}
                {tableYearMismatch ? (
                  <span className="block text-slate-500">
                    You selected {tableData.requestedYear}; the API uses the latest publishable WDI year.
                  </span>
                ) : null}
              </p>
            </div>
            ) : (
              <p className="text-xs text-slate-500 sm:max-w-xl">
                Primary WDI year <strong>{tableDataYear}</strong>. Category: <strong>{tableCat}</strong>.
                {tableYearMismatch ? (
                  <span className="block text-slate-400">Requested {tableData.requestedYear}; API used best publishable year.</span>
                ) : null}
              </p>
            )}
            <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
              {!tableFullscreen ? (
                <button
                  type="button"
                  onClick={() => setTableFullscreen(true)}
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
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-semibold uppercase text-red-600">Export</span>
                <button
                  type="button"
                  onClick={exportTable}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                  title="Export CSV"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-2.5">
            {(
              [
                ["general", "General"],
                ["financial", "Financial"],
                ["health", "Health & demographics"],
                ["education", "Education"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTableCat(id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  tableCat === id ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className={
              tableFullscreen
                ? "cap-fs-table-shell min-h-0 flex-1 overflow-auto"
                : "max-h-[min(70vh,720px)] overflow-auto"
            }
          >
            <table
              className={`min-w-max w-full text-left ${tableFullscreen ? "text-base" : "text-sm"}`}
            >
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <SortableTh
                    columnKey="name"
                    sortKey={tableSortKey}
                    sortDir={tableSortDir}
                    onSort={onTableSort}
                    className="whitespace-nowrap px-3 py-3 font-medium normal-case"
                  >
                    Country
                  </SortableTh>
                  <SortableTh
                    columnKey="iso3"
                    sortKey={tableSortKey}
                    sortDir={tableSortDir}
                    onSort={onTableSort}
                    className="whitespace-nowrap px-3 py-3 font-medium normal-case"
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
                      className="whitespace-nowrap px-3 py-3 font-medium normal-case"
                      title={c.description}
                    >
                      {c.label}
                    </SortableTh>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTableRows.map((r, i) => (
                  <tr key={r.iso3} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/80"}>
                    <td className="whitespace-nowrap border-t border-slate-100 px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        {r.flagPng && <img src={r.flagPng} alt="" className="h-5 w-7 rounded-sm border border-slate-200 object-cover" />}
                        <span className="font-medium text-slate-900">{r.name}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-t border-slate-100 px-3 py-2 font-mono text-xs text-slate-600">
                      {r.iso3}
                    </td>
                    {tableData.columns.map((c) => {
                      const f = formatTableCell(c, r.cells[c.id], tableCat);
                      return (
                        <td key={c.id} className="whitespace-nowrap border-t border-slate-100 px-3 py-2 text-right align-top">
                          <div className="font-semibold text-slate-900">{f.main}</div>
                          {f.sub && <div className={`text-xs font-medium ${f.subClass}`}>{f.sub}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {view === "charts" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900">Global aggregate charts (WLD)</h2>
          <p className="mt-1 text-sm text-slate-600">
            World series grouped like the country dashboard (Financial, Health &amp; demographics, Education, Labour). Open{" "}
            <span className="font-semibold text-slate-800">Full screen</span> on any chart or table to use the full
            viewport; plots and the map resize with the window.
          </p>
          <div className="mt-6">
            <GlobalWldCharts />
          </div>
        </section>
      )}
    </div>
  );
}
