import type { SeriesPoint, SeriesProvenance } from "../api";

export type ChartRow = Record<string, number | string | null | undefined>;

/** Per-row map of `metricKey → provenance` for chart tooltips (annual rows from `buildDenseYearRows`). */
export const CHART_POINT_PROVENANCE_KEY = "__provenance" as const;

type ChartRowProvenance = Partial<Record<string, SeriesProvenance>>;

/** Headline flow series: only short carry-forward (WDI usually current within ~1–2y). */
const CORE_CHART_KEYS = new Set([
  "gdp",
  "gdp_ppp",
  "gdp_per_capita",
  "gdp_per_capita_ppp",
  "gni_per_capita_atlas",
  "gdp_growth",
  "population",
]);

/**
 * One row per calendar year in [rangeStart, rangeEnd] so the X-axis matches the selected range
 * even when some indicators have no observations yet.
 */
function buildDenseYearRows(
  series: Record<string, SeriesPoint[]>,
  keys: readonly string[],
  rangeStart: number,
  rangeEnd: number
): ChartRow[] {
  const rows: ChartRow[] = [];
  const lo = Math.min(rangeStart, rangeEnd);
  const hi = Math.max(rangeStart, rangeEnd);
  for (let y = lo; y <= hi; y++) {
    const row: ChartRow = { year: y };
    let prov: ChartRowProvenance | undefined;
    for (const k of keys) {
      const pt = (series[k] ?? []).find((x) => x.year === y);
      const v = pt?.value;
      row[k] = typeof v === "number" && Number.isFinite(v) ? v : null;
      if (pt?.provenance) {
        if (!prov) prov = {};
        prov[k] = pt.provenance;
      }
    }
    if (prov) (row as Record<string, unknown>)[CHART_POINT_PROVENANCE_KEY] = prov;
    rows.push(row);
  }
  return rows;
}

export type MergeLineChartOpts = {
  /**
   * When true, repeats the last published value briefly so lines reach the range end (legacy display).
   * Default false: charts show real gaps where sources have not published a year yet.
   */
  forwardFill?: boolean;
};

/**
 * Carry the last *reported* WDI value forward by up to N years so lines reach the chart end.
 * `lastObsYear` advances only on real (non-imputed) points — long gaps stay empty.
 */
function forwardFillDisplayGaps(
  rows: ChartRow[],
  keys: readonly string[],
  opts?: {
    maxYearsAfterLastObs?: number;
    coreMaxYearsAfterLastObs?: number;
    coreKeys?: Set<string>;
  }
): void {
  const maxLagged = opts?.maxYearsAfterLastObs ?? 6;
  const maxCore = opts?.coreMaxYearsAfterLastObs ?? 2;
  const core = opts?.coreKeys ?? CORE_CHART_KEYS;

  for (const key of keys) {
    if (key === "year") continue;
    const lim = core.has(key) ? maxCore : maxLagged;
    let lastVal: number | null = null;
    let lastObsYear: number | null = null;

    for (const row of rows) {
      const y = row.year as number;
      const raw = row[key];
      const v = typeof raw === "number" && Number.isFinite(raw) ? raw : null;

      if (v !== null) {
        lastVal = v;
        lastObsYear = y;
        row[key] = v;
      } else if (lastVal !== null && lastObsYear !== null && y - lastObsYear <= lim) {
        row[key] = lastVal;
      }
    }
  }
}

export function mergeSeriesForLineChart(
  series: Record<string, SeriesPoint[]>,
  keys: readonly string[],
  rangeStart: number,
  rangeEnd: number,
  opts?: MergeLineChartOpts
): ChartRow[] {
  const rows = buildDenseYearRows(series, keys, rangeStart, rangeEnd);
  if (opts?.forwardFill) forwardFillDisplayGaps(rows, keys);
  return rows;
}

/** Unemployed count = (unemployment % / 100) × labour force; dense years + same fill rules. */
export function labourChartRows(
  bundle: Record<string, SeriesPoint[]>,
  rangeStart: number,
  rangeEnd: number,
  opts?: MergeLineChartOpts
): ChartRow[] {
  const u = bundle.unemployment_ilo ?? [];
  const lf = bundle.labor_force_total ?? [];
  const lo = Math.min(rangeStart, rangeEnd);
  const hi = Math.max(rangeStart, rangeEnd);
  const rows: ChartRow[] = [];

  for (let y = lo; y <= hi; y++) {
    const ur = u.find((x) => x.year === y)?.value;
    const lfv = lf.find((x) => x.year === y)?.value;
    const unemployed =
      ur != null && lfv != null && Number.isFinite(ur) && Number.isFinite(lfv) ? (ur / 100) * lfv : null;
    const labour = typeof lfv === "number" && Number.isFinite(lfv) ? lfv : null;
    rows.push({ year: y, unemployed, labour });
  }

  if (opts?.forwardFill) forwardFillDisplayGaps(rows, ["unemployed", "labour"]);
  return rows;
}
