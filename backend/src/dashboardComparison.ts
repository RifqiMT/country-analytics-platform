import { METRIC_BY_ID } from "./metrics.js";
import { getMetricShortLabel } from "./metricShortLabels.js";
import { fetchGlobalYearSnapshot, type GlobalRow } from "./globalSnapshot.js";
import type { SeriesPoint } from "./series.js";
import { fetchCountryBundle } from "./worldBank.js";
import { fetchCountryByIso3Direct, listCountries, type CountrySummary } from "./restCountries.js";
import { resolveCountryGeography, resolveGeographyAggregates } from "./geographyComparison.js";
import { EEZ_SQKM_FALLBACK } from "./eezSqKmFallback.js";
import { fetchSeaAroundUsEezAreaKm2 } from "./seaAroundUsEez.js";
import { currentDataYear, MIN_DATA_YEAR } from "./yearBounds.js";
import { isUsableNumber } from "./wdiParse.js";
import { getCache, setCache } from "./cache.js";

/**
 * Comparison rows intentionally use a curated dashboard-relevant subset.
 * Fetching the full catalog can exceed serverless budgets for many countries.
 */
const COMPARISON_COUNTRY_METRIC_IDS: string[] = [
  "population",
  "gdp",
  "gdp_ppp",
  "gdp_per_capita",
  "gdp_per_capita_ppp",
  "gni_per_capita_atlas",
  "gov_debt_usd",
  "gov_debt_pct_gdp",
  "inflation",
  "unemployment_ilo",
  "lending_rate",
  "labor_force_total",
  "poverty_headcount",
  "poverty_national",
  "life_expectancy",
  "mortality_under5",
  "maternal_mortality",
  "undernourishment",
  "birth_rate",
  "tb_incidence",
  "uhc_service_coverage",
  "hospital_beds",
  "physicians_density",
  "nurses_midwives_density",
  "immunization_dpt",
  "immunization_measles",
  "health_expenditure_gdp",
  "smoking_prevalence",
  "pop_age_0_14",
  "pop_15_64_pct",
  "pop_age_65_plus",
  "literacy_adult",
  "homicide_rate",
  "homicide_rate_female",
  "homicide_rate_male",
  "gbv_women_pct",
  "idp_conflict_violence",
  "battle_related_deaths",
  "rule_of_law_wgi",
  "political_stability_wgi",
  "corruption_control_wgi",
].filter((id) => Boolean(METRIC_BY_ID[id]));

const COMPARISON_CACHE_TTL_MS = 1000 * 60 * 15;

type ComparisonCell = {
  value: number | null;
  yoyPct: number | null;
  yoyBps: number | null;
};

type ComparisonRow = {
  id: string;
  label: string;
  country: ComparisonCell;
  avgCountry: ComparisonCell;
  global: ComparisonCell;
  /** How the global column was derived (WLD series vs snapshot fallbacks). */
  note?: string;
  /** Short code for avg-country aggregation (e.g. median, pop-weighted mean). */
  avgMethod?: string;
  /** Short code for global aggregation. */
  globalMethod?: string;
};

export type DashboardComparisonPayload = {
  year: number;
  /** Latest WDI calendar year used when the requested year had gaps. */
  dataYear?: number;
  countryIso3: string;
  countryName: string;
  rows: ComparisonRow[];
  geographyMeta: {
    medianArea: number | null;
    sumArea: number;
    medianTotalArea?: number | null;
    sumTotalArea?: number | null;
    refYear?: number | null;
  };
  /** REST sovereign economies included in cross-country aggregates. */
  membersCount?: number;
  mode?: "full-aggregates" | "fast-wld" | "fallback";
};

const SNAPSHOT_LOOKBACK_YEARS = 14;
const MIN_COUNTRIES_FOR_UNEMPLOYED_AVG = 8;
const SNAPSHOT_PREFETCH_CONCURRENCY = 10;

/** Rates / shares where cross-country “avg” should reflect population-weighted mean (WDI best practice). */
const POP_WEIGHTED_RATE_METRICS = new Set([
  "inflation",
  "lending_rate",
  "poverty_headcount",
  "poverty_national",
  "unemployment_ilo",
  "gbv_women_pct",
  "homicide_rate",
  "homicide_rate_female",
  "homicide_rate_male",
  "undernourishment",
  "birth_rate",
  "tb_incidence",
  "immunization_dpt",
  "immunization_measles",
  "health_expenditure_gdp",
  "smoking_prevalence",
  "pop_age_0_14",
  "pop_15_64_pct",
  "pop_age_65_plus",
  "literacy_adult",
  "life_expectancy",
  "mortality_under5",
  "maternal_mortality",
]);

const MEDIAN_LEVEL_METRICS = new Set([
  "gdp",
  "gdp_ppp",
  "gni_per_capita_atlas",
  "population",
  "labor_force_total",
  "gov_debt_usd",
]);

const SUM_GLOBAL_FLOW_METRICS = new Set(["idp_conflict_violence", "battle_related_deaths"]);

const MEDIAN_INDEX_METRICS = new Set([
  "rule_of_law_wgi",
  "political_stability_wgi",
  "corruption_control_wgi",
  "uhc_service_coverage",
  "hospital_beds",
  "physicians_density",
  "nurses_midwives_density",
]);

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

function memberIsoSet(countries: CountrySummary[]): Set<string> {
  const s = new Set<string>();
  for (const c of countries) {
    const iso = (c.cca3 || "").toUpperCase();
    if (/^[A-Z]{3}$/.test(iso)) s.add(iso);
  }
  return s;
}

function filterMemberRows(rows: GlobalRow[], members: Set<string>): GlobalRow[] {
  return rows.filter((r) => members.has(r.countryIso3.toUpperCase()));
}

function medianFromSorted(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function medianFromRows(rows: { value: number | null }[]): number | null {
  const vals = rows.map((r) => r.value).filter((v): v is number => isUsableNumber(v));
  if (vals.length === 0) return null;
  vals.sort((a, b) => a - b);
  return medianFromSorted(vals);
}

function latestUpToYear(
  points: { year: number; value: number | null }[],
  year: number
): { year: number; value: number } | null {
  let best: { year: number; value: number } | null = null;
  for (const p of points) {
    const v = p.value;
    if (p.year > year || !isUsableNumber(v)) continue;
    if (!best || p.year > best.year) best = { year: p.year, value: v };
  }
  return best;
}

function yoyFromSeries(
  points: { year: number; value: number | null }[],
  year: number
): { pct: number | null; bps: number | null } {
  const cur = latestUpToYear(points, year);
  if (!cur) return { pct: null, bps: null };
  let prevVal: number | null = null;
  for (const p of points) {
    const pv = p.value;
    if (p.year === cur.year - 1 && isUsableNumber(pv)) {
      prevVal = pv;
      break;
    }
  }
  if (prevVal === null) return { pct: null, bps: null };
  if (prevVal === 0) return { pct: null, bps: null };
  const delta = cur.value - prevVal;
  const pct = (delta / Math.abs(prevVal)) * 100;
  const bps = delta * 100;
  return { pct, bps };
}

function worldPointFromBundle(
  bundle: Record<string, SeriesPoint[]>,
  metricId: string,
  year: number
): number | null {
  if (!METRIC_BY_ID[metricId]) return null;
  const series = bundle[metricId] ?? [];
  const lv = latestUpToYear(series, year);
  return lv?.value ?? null;
}

function aggregateSnapshot(
  rows: { value: number | null }[],
  mode: "mean" | "sum"
): number | null {
  const vals = rows.map((r) => r.value).filter((v): v is number => isUsableNumber(v));
  if (vals.length === 0) return null;
  if (mode === "sum") return vals.reduce((a, b) => a + b, 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

type SnapshotMemberStats = {
  refYear: number | null;
  mean: number | null;
  median: number | null;
  sum: number | null;
  count: number;
};

/**
 * WDI global snapshots often omit the requested calendar year (reporting lag).
 * Walk backward to the latest year with at least one country observation, then
 * aggregate across **REST member countries** only (excludes WLD/regions in WDI “all”).
 */
async function snapshotMemberAggregates(
  metricId: string,
  year: number,
  members: Set<string>
): Promise<SnapshotMemberStats> {
  const yMin = Math.max(MIN_DATA_YEAR, year - SNAPSHOT_LOOKBACK_YEARS);
  for (let y = year; y >= yMin; y--) {
    const rows = filterMemberRows(await fetchGlobalYearSnapshot(metricId, y), members);
    const mean = aggregateSnapshot(rows, "mean");
    const sum = aggregateSnapshot(rows, "sum");
    const median = medianFromRows(rows);
    const count = rows.filter((r) => isUsableNumber(r.value)).length;
    if (mean !== null || sum !== null) {
      return { refYear: y, mean, median, sum, count };
    }
  }
  return { refYear: null, mean: null, median: null, sum: null, count: 0 };
}

type GlobalKind = "level_total" | "rate_or_pc";

type ResolveStats = { mean: number | null; sum: number | null; median: number | null };

function resolveGlobalValue(
  globalKind: GlobalKind,
  wld: number | null,
  stats: ResolveStats,
  weightedFallback: number | null
): { value: number | null; note: string } {
  if (wld !== null && Number.isFinite(wld)) return { value: wld, note: "wld" };
  if (weightedFallback !== null && Number.isFinite(weightedFallback)) {
    return { value: weightedFallback, note: "weighted_countries" };
  }
  if (globalKind === "level_total" && stats.sum !== null) return { value: stats.sum, note: "sum_countries" };
  if (stats.median !== null) return { value: stats.median, note: "median_countries" };
  if (stats.mean !== null) return { value: stats.mean, note: "mean_countries" };
  return { value: null, note: "none" };
}

type ComparisonPrefetch = {
  snapshotByMetric: Map<string, SnapshotMemberStats>;
  popWeightedByMetric: Map<string, { value: number | null; refYear: number | null }>;
  unemploymentWeighted: { value: number | null; refYear: number | null };
  impliedPcNominal: Map<number, number | null>;
  impliedPcPpp: Map<number, number | null>;
};

async function prefetchComparisonAggregates(
  year: number,
  members: Set<string>,
  metricIds: string[]
): Promise<ComparisonPrefetch> {
  const snapshotEntries = await mapWithConcurrency(
    metricIds,
    SNAPSHOT_PREFETCH_CONCURRENCY,
    async (id) => [id, await snapshotMemberAggregates(id, year, members)] as const
  );
  const snapshotByMetric = new Map(snapshotEntries);

  const popWeightedIds = metricIds.filter((id) => POP_WEIGHTED_RATE_METRICS.has(id));
  const popWeightedEntries = await mapWithConcurrency(
    popWeightedIds,
    SNAPSHOT_PREFETCH_CONCURRENCY,
    async (id) => [id, await populationWeightedRateWithFallback(id, year, members)] as const
  );
  const popWeightedByMetric = new Map(popWeightedEntries);

  const unemploymentWeighted = await laborForceWeightedUnemploymentWithFallback(year, members);

  const refYears = new Set<number>([year]);
  for (const s of snapshotByMetric.values()) {
    if (s.refYear != null) refYears.add(s.refYear);
  }
  const impliedPcNominal = new Map<number, number | null>();
  const impliedPcPpp = new Map<number, number | null>();
  await Promise.all(
    [...refYears].map(async (y) => {
      impliedPcNominal.set(y, await impliedPerCapitaAtYear("gdp", y, members));
      impliedPcPpp.set(y, await impliedPerCapitaAtYear("gdp_ppp", y, members));
    })
  );

  return {
    snapshotByMetric,
    popWeightedByMetric,
    unemploymentWeighted,
    impliedPcNominal,
    impliedPcPpp,
  };
}

function globalKindForMetric(metricId: string): GlobalKind {
  if (
    SUM_GLOBAL_FLOW_METRICS.has(metricId) ||
    metricId === "gdp" ||
    metricId === "gdp_ppp" ||
    metricId === "population" ||
    metricId === "labor_force_total" ||
    metricId === "gov_debt_usd"
  ) {
    return "level_total";
  }
  return "rate_or_pc";
}

async function impliedPerCapitaAtYear(
  gdpMetricId: "gdp" | "gdp_ppp",
  y: number,
  members: Set<string>
): Promise<number | null> {
  const [gRows, pRows] = await Promise.all([
    fetchGlobalYearSnapshot(gdpMetricId, y),
    fetchGlobalYearSnapshot("population", y),
  ]);
  const gF = filterMemberRows(gRows, members);
  const pF = filterMemberRows(pRows, members);
  const pMap = new Map(pF.map((r) => [r.countryIso3.toUpperCase(), r.value]));
  let sumG = 0;
  let sumP = 0;
  for (const r of gF) {
    const p = pMap.get(r.countryIso3.toUpperCase());
    if (!isUsableNumber(r.value) || !isUsableNumber(p) || p <= 0) continue;
    sumG += r.value;
    sumP += p;
  }
  return sumP > 0 ? sumG / sumP : null;
}

async function populationWeightedRateWithFallback(
  metricId: string,
  year: number,
  members: Set<string>
): Promise<{ value: number | null; refYear: number | null }> {
  const yMin = Math.max(MIN_DATA_YEAR, year - SNAPSHOT_LOOKBACK_YEARS);
  for (let y = year; y >= yMin; y--) {
    const [rateRows, popRows] = await Promise.all([
      fetchGlobalYearSnapshot(metricId, y),
      fetchGlobalYearSnapshot("population", y),
    ]);
    const rr = filterMemberRows(rateRows, members);
    const pr = filterMemberRows(popRows, members);
    const popMap = new Map(pr.map((r) => [r.countryIso3.toUpperCase(), r.value]));
    let w = 0;
    let popSum = 0;
    for (const r of rr) {
      const rate = r.value;
      const pop = popMap.get(r.countryIso3.toUpperCase());
      if (!isUsableNumber(rate) || !isUsableNumber(pop) || pop <= 0) continue;
      w += rate * pop;
      popSum += pop;
    }
    if (popSum > 0) return { value: w / popSum, refYear: y };
  }
  return { value: null, refYear: null };
}

async function laborForceWeightedUnemploymentWithFallback(
  year: number,
  members: Set<string>
): Promise<{ value: number | null; refYear: number | null }> {
  const yMin = Math.max(MIN_DATA_YEAR, year - SNAPSHOT_LOOKBACK_YEARS);
  for (let y = year; y >= yMin; y--) {
    const [uRows, lfRows] = await Promise.all([
      fetchGlobalYearSnapshot("unemployment_ilo", y),
      fetchGlobalYearSnapshot("labor_force_total", y),
    ]);
    const ur = filterMemberRows(uRows, members);
    const lfr = filterMemberRows(lfRows, members);
    const lfMap = new Map(lfr.map((r) => [r.countryIso3.toUpperCase(), r.value]));
    let num = 0;
    let den = 0;
    for (const r of ur) {
      const u = r.value;
      const lf = lfMap.get(r.countryIso3.toUpperCase());
      if (!isUsableNumber(u) || !isUsableNumber(lf)) continue;
      num += (u / 100) * lf;
      den += lf;
    }
    if (den > 0) return { value: (num / den) * 100, refYear: y };
  }
  return { value: null, refYear: null };
}

/**
 * Median national unemployed count and WLD-based (or summed) global unemployed.
 * WLD values are read at the same reference year as the snapshot used for medians/sums.
 */
async function aggregatesUnemployedNumber(
  requestYear: number,
  wldBundle: Record<string, SeriesPoint[]>,
  members: Set<string>
): Promise<{
  avg: number | null;
  global: number | null;
}> {
  const yMin = Math.max(MIN_DATA_YEAR, requestYear - SNAPSHOT_LOOKBACK_YEARS);
  let lastCounts: number[] = [];

  for (let y = requestYear; y >= yMin; y--) {
    const [uRows, lfRows] = await Promise.all([
      fetchGlobalYearSnapshot("unemployment_ilo", y),
      fetchGlobalYearSnapshot("labor_force_total", y),
    ]);
    const byLf = new Map(
      filterMemberRows(lfRows, members).map((r) => [r.countryIso3.toUpperCase(), r.value])
    );
    const counts: number[] = [];
    for (const r of filterMemberRows(uRows, members)) {
      const u = r.value;
      const lf = byLf.get(r.countryIso3.toUpperCase());
      if (!isUsableNumber(u) || !isUsableNumber(lf)) continue;
      counts.push((u / 100) * lf);
    }
    if (counts.length >= MIN_COUNTRIES_FOR_UNEMPLOYED_AVG) {
      const sorted = [...counts].sort((a, b) => a - b);
      const avg = medianFromSorted(sorted);
      const wu = worldPointFromBundle(wldBundle, "unemployment_ilo", y);
      const wf = worldPointFromBundle(wldBundle, "labor_force_total", y);
      if (isUsableNumber(wu) && isUsableNumber(wf)) {
        return { avg, global: (wu / 100) * wf };
      }
      const globalSum = counts.reduce((a, b) => a + b, 0);
      return { avg, global: globalSum };
    }
    if (counts.length > lastCounts.length) lastCounts = counts;
  }

  const wu = worldPointFromBundle(wldBundle, "unemployment_ilo", requestYear);
  const wf = worldPointFromBundle(wldBundle, "labor_force_total", requestYear);
  if (isUsableNumber(wu) && isUsableNumber(wf)) {
    return { avg: null, global: (wu / 100) * wf };
  }
  if (lastCounts.length > 0) {
    const sorted = [...lastCounts].sort((a, b) => a - b);
    const avg = medianFromSorted(sorted);
    return { avg, global: lastCounts.reduce((a, b) => a + b, 0) };
  }
  return { avg: null, global: null };
}

async function computeDashboardComparison(iso3: string, year: number): Promise<DashboardComparisonPayload> {
  const upper = iso3.toUpperCase();
  const allCountries = await listCountries();
  const members = memberIsoSet(allCountries);
  const meta = allCountries.find((c) => c.cca3.toUpperCase() === upper);
  const endYear = Math.min(currentDataYear(), year);

  const eezCoastalValues = allCountries
    .map((c) => (c.cca3 || "").toUpperCase())
    .filter((iso) => /^[A-Z]{3}$/.test(iso))
    .map((iso) => EEZ_SQKM_FALLBACK[iso])
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const eezMedianAll = medianFromSorted(eezCoastalValues);
  const eezSumAll = eezCoastalValues.length > 0 ? eezCoastalValues.reduce((a, b) => a + b, 0) : null;
  const countryEez = await (async () => {
    const directMeta = meta?.ccn3 ? null : await fetchCountryByIso3Direct(upper).catch(() => null);
    const profile = meta ?? directMeta;
    if (profile?.landlocked === true) return null;
    const fb = EEZ_SQKM_FALLBACK[upper];
    if (fb != null && Number.isFinite(fb) && fb > 0) return fb;
    const ccn3 = profile?.ccn3;
    if (!ccn3) return null;
    try {
      const api = await fetchSeaAroundUsEezAreaKm2(ccn3);
      return api != null && Number.isFinite(api) && api > 0 ? api : null;
    } catch {
      return null;
    }
  })();

  const startYear = Math.max(MIN_DATA_YEAR, endYear - 12);
  const metricIds = [...COMPARISON_COUNTRY_METRIC_IDS];

  const [bundle, wldBundle, prefetch, countryGeo, geoAgg] = await Promise.all([
    fetchCountryBundle(upper, metricIds, startYear, endYear, { skipWldFallback: true }),
    fetchCountryBundle("WLD", metricIds, startYear, endYear),
    prefetchComparisonAggregates(year, members, metricIds),
    resolveCountryGeography(upper, meta?.area, endYear),
    resolveGeographyAggregates(year, members, allCountries),
  ]);

  const unemployedSeries = bundle.unemployment_ilo ?? [];
  const laborSeries = bundle.labor_force_total ?? [];

  const derivedUnemployed = (y: number): number | null => {
    const u = latestUpToYear(unemployedSeries, y)?.value;
    const lf = latestUpToYear(laborSeries, y)?.value;
    if (!isUsableNumber(u) || !isUsableNumber(lf)) return null;
    return (u / 100) * lf;
  };

  const cellFromMetric = (metricId: string): ComparisonRow => {
    const label = getMetricShortLabel(metricId);
    const globalKind = globalKindForMetric(metricId);
    const cSeries = bundle[metricId] ?? [];
    const cur = latestUpToYear(cSeries, year);
    const { pct, bps } = yoyFromSeries(cSeries, cur?.year ?? year);

    const stats = prefetch.snapshotByMetric.get(metricId) ?? {
      refYear: null,
      mean: null,
      median: null,
      sum: null,
      count: 0,
    };
    let refY = stats.refYear ?? year;
    let avg: number | null = null;
    let avgMethod = "mean_unweighted";
    let weightedFallback: number | null = null;

    if (metricId === "gdp" || metricId === "gdp_ppp") {
      avg = stats.median;
      avgMethod = "median_economies";
    } else if (metricId === "gdp_per_capita") {
      refY = stats.refYear ?? year;
      const implied = prefetch.impliedPcNominal.get(refY) ?? null;
      avg = implied ?? stats.mean;
      weightedFallback = implied ?? stats.mean;
      avgMethod = implied != null ? "sum_gdp_over_sum_pop" : "mean_unweighted";
    } else if (metricId === "gdp_per_capita_ppp") {
      refY = stats.refYear ?? year;
      const implied = prefetch.impliedPcPpp.get(refY) ?? null;
      avg = implied ?? stats.mean;
      weightedFallback = implied ?? stats.mean;
      avgMethod = implied != null ? "sum_gdp_ppp_over_sum_pop" : "mean_unweighted";
    } else if (metricId === "gni_per_capita_atlas") {
      avg = stats.median;
      avgMethod = "median_economies";
    } else if (metricId === "unemployment_ilo") {
      const w = prefetch.unemploymentWeighted;
      refY = w.refYear ?? refY;
      avg = w.value;
      weightedFallback = w.value;
      avgMethod = "lf_weighted_mean";
    } else if (POP_WEIGHTED_RATE_METRICS.has(metricId)) {
      const w = prefetch.popWeightedByMetric.get(metricId);
      refY = w?.refYear ?? refY;
      avg = w?.value ?? stats.median ?? stats.mean;
      weightedFallback = w?.value ?? null;
      avgMethod = w?.value != null ? "pop_weighted_mean" : "median_economies";
    } else if (MEDIAN_LEVEL_METRICS.has(metricId)) {
      avg = stats.median;
      avgMethod = "median_economies";
    } else if (MEDIAN_INDEX_METRICS.has(metricId)) {
      avg = stats.median;
      avgMethod = "median_economies";
    } else if (SUM_GLOBAL_FLOW_METRICS.has(metricId)) {
      avg = stats.median;
      avgMethod = "median_economies";
    } else {
      avg = stats.mean;
      avgMethod = "mean_unweighted";
    }

    const resolveStats: ResolveStats = {
      mean: stats.mean,
      sum: stats.sum,
      median: stats.median,
    };
    const wld = worldPointFromBundle(wldBundle, metricId, refY);
    const { value: globalVal, note } = resolveGlobalValue(globalKind, wld, resolveStats, weightedFallback);

    let globalMethod = note;
    if (note === "wld") globalMethod = "wld_aggregate";
    else if (note === "weighted_countries") globalMethod = avgMethod;
    else if (note === "sum_countries") globalMethod = "sum_economies";
    else if (note === "median_countries") globalMethod = "median_economies";
    else if (note === "mean_countries") globalMethod = "mean_unweighted";

    return {
      id: metricId,
      label,
      country: { value: cur?.value ?? null, yoyPct: pct, yoyBps: bps },
      avgCountry: { value: avg, yoyPct: null, yoyBps: null },
      global: { value: globalVal, yoyPct: null, yoyBps: null },
      note,
      avgMethod,
      globalMethod,
    };
  };

  const rows: ComparisonRow[] = [];

  rows.push({
    id: "land_area",
    label: getMetricShortLabel("land_area"),
    country: { value: countryGeo.landAreaKm2, yoyPct: null, yoyBps: null },
    avgCountry: { value: geoAgg.land.median, yoyPct: null, yoyBps: null },
    global: { value: geoAgg.land.global, yoyPct: null, yoyBps: null },
    note:
      countryGeo.landSource === "wdi"
        ? "World Bank WDI AG.LND.TOTL.K2"
        : countryGeo.landSource === "rest_countries"
          ? "REST Countries area fallback"
          : undefined,
    avgMethod: "median_economies_wdi",
    globalMethod: geoAgg.land.globalMethod,
  });
  rows.push({
    id: "total_area",
    label: getMetricShortLabel("total_area"),
    country: { value: countryGeo.totalAreaKm2, yoyPct: null, yoyBps: null },
    avgCountry: { value: geoAgg.total.median, yoyPct: null, yoyBps: null },
    global: { value: geoAgg.total.global, yoyPct: null, yoyBps: null },
    note:
      countryGeo.totalSource === "wdi"
        ? "World Bank WDI AG.SRF.TOTL.K2"
        : countryGeo.totalSource === "rest_countries"
          ? "REST Countries area fallback"
          : undefined,
    avgMethod: "median_economies_wdi",
    globalMethod: geoAgg.total.globalMethod,
  });
  rows.push({
    id: "eez",
    label: getMetricShortLabel("eez"),
    country: { value: countryEez, yoyPct: null, yoyBps: null },
    avgCountry: { value: eezMedianAll, yoyPct: null, yoyBps: null },
    global: { value: eezSumAll, yoyPct: null, yoyBps: null },
    avgMethod: "median_coastal_eez",
    globalMethod: "sum_coastal_eez",
  });

  const financialIds = [
    "gdp",
    "gdp_ppp",
    "gdp_per_capita",
    "gdp_per_capita_ppp",
    "gni_per_capita_atlas",
    "inflation",
    "unemployment_ilo",
  ] as const;
  const tailIds = ["lending_rate", "poverty_headcount", "poverty_national"] as const;
  const healthIds = [
    "birth_rate",
    "tb_incidence",
    "uhc_service_coverage",
    "hospital_beds",
    "physicians_density",
    "nurses_midwives_density",
    "immunization_dpt",
    "immunization_measles",
    "health_expenditure_gdp",
    "smoking_prevalence",
  ] as const;
  const orderedMetricIds = [
    ...financialIds,
    "lending_rate",
    "poverty_headcount",
    "poverty_national",
    ...healthIds,
    ...metricIds.filter(
      (id) =>
        !financialIds.includes(id as (typeof financialIds)[number]) &&
        !tailIds.includes(id as (typeof tailIds)[number]) &&
        !healthIds.includes(id as (typeof healthIds)[number]) &&
        id !== "labor_force_total" &&
        id !== "unemployment_ilo"
    ),
  ];

  const seen = new Set<string>();
  for (const id of orderedMetricIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (!METRIC_BY_ID[id]) continue;
    rows.push(cellFromMetric(id));
  }

  const lfCur = latestUpToYear(laborSeries, year);
  const lfYo = yoyFromSeries(laborSeries, lfCur?.year ?? year);
  const du = derivedUnemployed(year);
  const duPrev = derivedUnemployed(year - 1);
  let duPct: number | null = null;
  if (du !== null && duPrev !== null && duPrev !== 0) duPct = ((du - duPrev) / Math.abs(duPrev)) * 100;

  const unempAgg = await aggregatesUnemployedNumber(year, wldBundle, members);
  rows.push({
    id: "unemployed_number",
    label: getMetricShortLabel("unemployed_number"),
    country: { value: du, yoyPct: duPct, yoyBps: null },
    avgCountry: { value: unempAgg.avg, yoyPct: null, yoyBps: null },
    global: { value: unempAgg.global, yoyPct: null, yoyBps: null },
    avgMethod: "median_national_counts",
    globalMethod: unempAgg.global != null ? "wld_or_sum_derived" : "none",
  });

  const lfStats = prefetch.snapshotByMetric.get("labor_force_total") ?? {
    refYear: year,
    mean: null,
    median: null,
    sum: null,
    count: 0,
  };
  const lfRefY = lfStats.refYear ?? year;
  let lfGlobal = worldPointFromBundle(wldBundle, "labor_force_total", lfRefY);
  if (lfGlobal === null && lfStats.sum !== null) lfGlobal = lfStats.sum;

  const lfRow = cellFromMetric("labor_force_total");
  lfRow.country = {
    value: lfCur?.value ?? null,
    yoyPct: lfYo.pct,
    yoyBps: lfYo.bps,
  };
  lfRow.avgCountry = { value: lfStats.median, yoyPct: null, yoyBps: null };
  lfRow.global = { value: lfGlobal, yoyPct: null, yoyBps: null };
  lfRow.avgMethod = "median_economies";
  lfRow.globalMethod = lfGlobal != null ? (worldPointFromBundle(wldBundle, "labor_force_total", lfRefY) != null ? "wld_aggregate" : "sum_economies") : "none";
  rows.push(lfRow);

  const refYears = rows
    .map((r) => prefetch.snapshotByMetric.get(r.id)?.refYear)
    .filter((y): y is number => y != null);
  const dataYear = refYears.length > 0 ? Math.max(...refYears, endYear) : endYear;

  return {
    year,
    dataYear,
    countryIso3: upper,
    countryName: meta?.name ?? upper,
    rows,
    geographyMeta: {
      medianArea: geoAgg.land.median,
      sumArea: geoAgg.land.global ?? 0,
      medianTotalArea: geoAgg.total.median,
      sumTotalArea: geoAgg.total.global,
      refYear: geoAgg.land.refYear ?? geoAgg.total.refYear ?? countryGeo.refYear,
    },
    membersCount: members.size,
    mode: "full-aggregates",
  };
}

export async function buildDashboardComparison(iso3: string, year: number): Promise<DashboardComparisonPayload> {
  const upper = iso3.toUpperCase();
  const key = `dash:comparison:v8-geography-wdi:${upper}:${year}`;
  const hit = getCache<DashboardComparisonPayload>(key);
  if (hit) return hit;
  const data = await computeDashboardComparison(upper, year);
  setCache(key, data, COMPARISON_CACHE_TTL_MS);
  return data;
}
