import { getCache, setCache } from "./cache.js";
import { fetchWithRetry } from "./httpClient.js";
import { METRICS, METRIC_BY_ID } from "./metrics.js";
import { fetchImfWeoSeries } from "./imfWeo.js";
import { fetchUisCountrySeries } from "./uisApi.js";
import type { SeriesPoint, SeriesProvenance } from "./series.js";
import { currentDataYear, MIN_DATA_YEAR } from "./yearBounds.js";
import {
  isMissingMetricValue,
  isUsableNumber,
  parseWdiNumericValue,
  pickBetterObservation,
} from "./wdiParse.js";
import { isServerlessRuntime } from "./serverlessBudget.js";
import {
  clampSeriesByMetricDef,
  completeDenseSeries,
  completionOptionsForMetric,
  mergeWldFallbackDense,
} from "./seriesCompletion.js";

/** Fetched alongside requested metrics so cross-metric gap-fills can run (dashboard, compare, WLD). */
const ENRICHMENT_ANCHOR_METRIC_IDS: readonly string[] = [
  "gdp",
  "gdp_ppp",
  "population",
  "pop_age_0_14",
  "pop_15_64_pct",
  "pop_age_65_plus",
];

const DERIVATION_REQUIRES_ANCHOR: Readonly<Record<string, readonly string[]>> = {
  gdp_ppp: ["gdp"],
  gdp_per_capita: ["gdp", "population"],
  gdp_per_capita_ppp: ["gdp_ppp", "population"],
  pop_age_0_14: ["pop_15_64_pct", "pop_age_65_plus"],
  pop_15_64_pct: ["pop_age_0_14", "pop_age_65_plus"],
  pop_age_65_plus: ["pop_age_0_14", "pop_15_64_pct"],
};

const WB_CACHE_VER = "wb:v8";

/** How many calendar years after the last published point we repeat that value (WDI/IMF lag + WEO forecasts). */
const TERMINAL_CARRY_MAX_YEARS = 3;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetchWithRetry(
    url,
    { headers: { Accept: "application/json" } },
    { attempts: 5, baseDelayMs: 500 }
  );
  if (!res.ok) throw new Error(`World Bank HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}

function parseRowsToSeries(rows: unknown[]): SeriesPoint[] {
  const byYear = new Map<number, number | null>();
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const rec = r as { date?: string; value?: unknown };
    const y = rec.date ? parseInt(rec.date, 10) : NaN;
    if (!Number.isFinite(y)) continue;
    const parsed = parseWdiNumericValue(rec.value);
    const prev = byYear.get(y);
    byYear.set(y, pickBetterObservation(prev ?? null, parsed));
  }
  return [...byYear.entries()]
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year);
}

function emptyDenseSeries(startYear: number, endYear: number): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let y = startYear; y <= endYear; y++) out.push({ year: y, value: null });
  return out;
}

/** One entry per year in [startYear, endYear]; missing observations are explicit null */
function densifySeries(points: SeriesPoint[], startYear: number, endYear: number): SeriesPoint[] {
  const byYear = new Map<number, SeriesPoint>();
  for (const p of points) {
    const cur = byYear.get(p.year);
    if (!cur) {
      byYear.set(p.year, { ...p });
    } else {
      const w = pickBetterObservation(cur.value, p.value);
      let provenance = cur.provenance ?? p.provenance;
      if (w === p.value && isUsableNumber(p.value)) provenance = p.provenance ?? cur.provenance;
      else if (w === cur.value && isUsableNumber(cur.value)) provenance = cur.provenance ?? p.provenance;
      byYear.set(p.year, { year: p.year, value: w, provenance });
    }
  }
  const out: SeriesPoint[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const src = byYear.get(y);
    if (src && !isMissingMetricValue(src.value)) {
      out.push({
        year: y,
        value: src.value,
        provenance: src.provenance ?? "reported",
      });
    } else {
      out.push({ year: y, value: null });
    }
  }
  return out;
}

export async function fetchIndicatorSeries(
  countryIso3: string,
  indicator: string,
  startYear = MIN_DATA_YEAR,
  endYear = currentDataYear()
): Promise<SeriesPoint[]> {
  const cacheKey = `${WB_CACHE_VER}:${countryIso3}:${indicator}:${startYear}:${endYear}`;
  const cached = getCache<SeriesPoint[]>(cacheKey);
  if (cached) return cached;

  const perPage = 1000;
  const allRows: unknown[] = [];
  let page = 1;
  for (;;) {
    const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(
      countryIso3
    )}/indicator/${encodeURIComponent(indicator)}?date=${startYear}:${endYear}&format=json&per_page=${perPage}&page=${page}`;
    let raw: unknown;
    try {
      raw = await fetchJson(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Some indicators/country combinations return 400/404. Treat as no data
      // for this metric instead of failing the entire dashboard payload.
      if (msg.includes("World Bank HTTP 400") || msg.includes("World Bank HTTP 404")) {
        break;
      }
      // Network/transient upstream failures should not break the whole bundle.
      // Return the rows accumulated so far (or empty if page 1 failed).
      break;
    }
    if (!Array.isArray(raw) || raw.length < 2) break;
    const meta = raw[0] as { pages?: number };
    const chunk = raw[1];
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    allRows.push(...chunk);
    const pages = typeof meta?.pages === "number" ? meta.pages : 1;
    if (page >= pages) break;
    page += 1;
    if (page > 100) break;
  }
  const series = parseRowsToSeries(allRows);
  setCache(cacheKey, series);
  return series;
}

/** Merge primary + fallback series: use fallback value when primary is null/NaN */
function mergeSeries(
  primary: SeriesPoint[],
  fallback: SeriesPoint[],
  fallbackProvenance: SeriesProvenance
): SeriesPoint[] {
  const byYear = new Map<number, SeriesPoint>();
  for (const p of primary) byYear.set(p.year, { ...p });
  for (const f of fallback) {
    const cur = byYear.get(f.year);
    if (isMissingMetricValue(cur?.value) && !isMissingMetricValue(f.value)) {
      byYear.set(f.year, {
        year: f.year,
        value: f.value,
        provenance: f.provenance ?? fallbackProvenance,
      });
    }
  }
  return [...byYear.entries()]
    .map(([, p]) => p)
    .sort((a, b) => a.year - b.year);
}

/**
 * WDI `GC.DOD.TOTL.CD` (central government debt, current US$) is sparse vs debt % of GDP.
 * Where the direct series is null, estimate debt in US$ as (debt % GDP / 100) × nominal GDP (US$).
 * Published WDI points are kept when present.
 */
function mergeDebtUsdWithDerived(
  directSparse: SeriesPoint[],
  gdpDense: SeriesPoint[],
  pctDense: SeriesPoint[],
  startYear: number,
  endYear: number
): SeriesPoint[] {
  const direct = new Map<number, number | null>();
  for (const p of directSparse) direct.set(p.year, p.value);
  const gdp = new Map(gdpDense.map((p) => [p.year, p.value]));
  const pct = new Map(pctDense.map((p) => [p.year, p.value]));
  const out: SeriesPoint[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const dVal = direct.has(y) ? direct.get(y)! : null;
    let v = dVal;
    if (isMissingMetricValue(v)) {
      const g = gdp.get(y);
      const p = pct.get(y);
      if (!isMissingMetricValue(g) && !isMissingMetricValue(p)) {
        v = (p! / 100) * g!;
      }
    }
    const provenance: SeriesProvenance | undefined = !isMissingMetricValue(dVal)
      ? "reported"
      : !isMissingMetricValue(v)
        ? "derived_cross_metric"
        : undefined;
    out.push({ year: y, value: v, provenance });
  }
  return out;
}

function mergeSexAverageForNullSparse(
  base: SeriesPoint[],
  male: SeriesPoint[],
  female: SeriesPoint[]
): SeriesPoint[] {
  const b = new Map(base.map((p) => [p.year, p.value]));
  const m = new Map(male.map((p) => [p.year, p.value]));
  const f = new Map(female.map((p) => [p.year, p.value]));
  const years = new Set<number>([...b.keys(), ...m.keys(), ...f.keys()]);
  const out: SeriesPoint[] = [];
  for (const y of [...years].sort((a, b) => a - b)) {
    let v: number | null = b.has(y) ? (b.get(y) as number | null) : null;
    let provenance: SeriesProvenance | undefined;
    if (isMissingMetricValue(v)) {
      const mv = m.get(y);
      const fv = f.get(y);
      if (!isMissingMetricValue(mv) && !isMissingMetricValue(fv)) {
        v = ((mv as number) + (fv as number)) / 2;
        provenance = "derived_cross_metric";
      }
    }
    out.push({ year: y, value: v, provenance });
  }
  return out;
}

function fillDerivedPerCapitaDense(
  target: SeriesPoint[],
  numer: SeriesPoint[],
  denom: SeriesPoint[]
): SeriesPoint[] {
  return target.map((p, i) => {
    if (!isMissingMetricValue(p.value)) return p;
    const n = numer[i]?.value;
    const d = denom[i]?.value;
    if (!isMissingMetricValue(n) && !isMissingMetricValue(d) && d !== 0) {
      return { year: p.year, value: (n as number) / (d as number), provenance: "derived_cross_metric" };
    }
    return p;
  });
}

function fillFromSiblingDense(target: SeriesPoint[], source: SeriesPoint[]): SeriesPoint[] {
  return target.map((p, i) => {
    if (!isMissingMetricValue(p.value)) return p;
    const sv = source[i]?.value;
    if (!isMissingMetricValue(sv)) {
      return { year: p.year, value: sv as number, provenance: "derived_cross_metric" };
    }
    return p;
  });
}

function fillTeachersByTriadDense(
  pri: SeriesPoint[],
  sec: SeriesPoint[],
  ter: SeriesPoint[]
): [SeriesPoint[], SeriesPoint[], SeriesPoint[]] {
  const p = pri.map((x) => ({ ...x }));
  const s = sec.map((x) => ({ ...x }));
  const t = ter.map((x) => ({ ...x }));
  for (let i = 0; i < p.length; i++) {
    const vals = [p[i].value, s[i].value, t[i].value].filter((v) => !isMissingMetricValue(v)) as number[];
    if (vals.length === 0) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (isMissingMetricValue(p[i].value)) p[i] = { year: p[i].year, value: avg, provenance: "derived_cross_metric" };
    if (isMissingMetricValue(s[i].value)) s[i] = { year: s[i].year, value: avg, provenance: "derived_cross_metric" };
    if (isMissingMetricValue(t[i].value)) t[i] = { year: t[i].year, value: avg, provenance: "derived_cross_metric" };
  }
  return [p, s, t];
}

/**
 * When nominal GDP exists but PPP GDP is missing (common when IMF publishes NGDPD but not PPPGDP for the same year),
 * scale nominal by the latest prior PPP/nominal ratio.
 */
function extrapolateGdpPppFromNominalRatio(gdpPpp: SeriesPoint[], gdp: SeriesPoint[]): SeriesPoint[] {
  return gdpPpp.map((p, i) => {
    if (!isMissingMetricValue(p.value)) return p;
    const gNow = gdp[i]?.value;
    if (isMissingMetricValue(gNow) || (gNow as number) === 0) return p;
    for (let j = i - 1; j >= 0; j--) {
      const gp = gdpPpp[j]?.value;
      const gn = gdp[j]?.value;
      if (!isMissingMetricValue(gp) && !isMissingMetricValue(gn) && (gn as number) !== 0) {
        const ratio = (gp as number) / (gn as number);
        return { year: p.year, value: ratio * (gNow as number), provenance: "derived_cross_metric" };
      }
    }
    return p;
  });
}

/**
 * Repeat the last published observation for up to N years when sources have not yet released that calendar year
 * (dashboard dense range still includes those years).
 */
function carryForwardTerminalDense(points: SeriesPoint[], maxTrailYears: number): SeriesPoint[] {
  if (points.length === 0) return points;
  let lastObsYear = -Infinity;
  let lastVal: number | null = null;
  for (const p of points) {
    if (!isMissingMetricValue(p.value)) {
      lastObsYear = p.year;
      lastVal = p.value;
    }
  }
  if (lastVal === null || !Number.isFinite(lastObsYear)) return points;
  const capYear = lastObsYear + maxTrailYears;
  return points.map((p) => {
    if (p.year > lastObsYear && p.year <= capYear && isMissingMetricValue(p.value)) {
      return { year: p.year, value: lastVal, provenance: "carried_short" };
    }
    return p;
  });
}

function clampSharePct(x: number): number {
  return Math.min(100, Math.max(0, x));
}

function fillAgeBracketTriangleDense(
  o14: SeriesPoint[],
  p1564: SeriesPoint[],
  p65: SeriesPoint[]
): [SeriesPoint[], SeriesPoint[], SeriesPoint[]] {
  const a = o14.map((p) => ({ ...p }));
  const b = p1564.map((p) => ({ ...p }));
  const c = p65.map((p) => ({ ...p }));
  for (let i = 0; i < a.length; i++) {
    const va = a[i].value;
    const vb = b[i].value;
    const vc = c[i].value;
    const fa = !isMissingMetricValue(va);
    const fb = !isMissingMetricValue(vb);
    const fc = !isMissingMetricValue(vc);
    const nMiss = (!fa ? 1 : 0) + (!fb ? 1 : 0) + (!fc ? 1 : 0);
    if (nMiss !== 1) continue;
    let raw: number;
    if (!fa) raw = 100 - (vb as number) - (vc as number);
    else if (!fb) raw = 100 - (va as number) - (vc as number);
    else raw = 100 - (va as number) - (vb as number);
    if (!Number.isFinite(raw) || raw < -1 || raw > 101) continue;
    const v = clampSharePct(raw);
    if (!fa) a[i] = { ...a[i], value: v, provenance: "derived_cross_metric" };
    else if (!fb) b[i] = { ...b[i], value: v, provenance: "derived_cross_metric" };
    else c[i] = { ...c[i], value: v, provenance: "derived_cross_metric" };
  }
  return [a, b, c];
}

async function enrichOoscFromEnrollmentDense(
  countryIso3: string,
  ooscDense: SeriesPoint[],
  enrollIndicator: string,
  startYear: number,
  endYear: number
): Promise<SeriesPoint[]> {
  const enr = await fetchIndicatorSeries(countryIso3, enrollIndicator, startYear, endYear);
  const eDense = densifySeries(enr, startYear, endYear);
  return ooscDense.map((p, i) => {
    if (!isMissingMetricValue(p.value)) return p;
    const ev = eDense[i]?.value;
    if (isMissingMetricValue(ev)) return p;
    const e = Math.min(100, Math.max(0, ev as number));
    return { year: p.year, value: clampSharePct(100 - e), provenance: "derived_cross_metric" };
  });
}

/**
 * Derive missing values from other series in the same bundle (aligned dense years).
 */
async function applyCrossMetricBundleEnrichments(
  countryIso3: string,
  bundle: Record<string, SeriesPoint[]>,
  startYear: number,
  endYear: number
): Promise<void> {
  const g = bundle.gdp;
  if (g && bundle.gdp_ppp) {
    bundle.gdp_ppp = extrapolateGdpPppFromNominalRatio(bundle.gdp_ppp, g);
  }
  const gPpp = bundle.gdp_ppp;
  const pop = bundle.population;
  if (g && pop && bundle.gdp_per_capita) {
    bundle.gdp_per_capita = fillDerivedPerCapitaDense(bundle.gdp_per_capita, g, pop);
  }
  if (gPpp && pop && bundle.gdp_per_capita_ppp) {
    bundle.gdp_per_capita_ppp = fillDerivedPerCapitaDense(bundle.gdp_per_capita_ppp, gPpp, pop);
  }
  const o14 = bundle.pop_age_0_14;
  const p1564 = bundle.pop_15_64_pct;
  const p65 = bundle.pop_age_65_plus;
  if (o14 && p1564 && p65) {
    const [a, b, c] = fillAgeBracketTriangleDense(o14, p1564, p65);
    bundle.pop_age_0_14 = a;
    bundle.pop_15_64_pct = b;
    bundle.pop_age_65_plus = c;
  }
  const [op, os, ot] = await Promise.all([
    bundle.oosc_primary
      ? enrichOoscFromEnrollmentDense(countryIso3, bundle.oosc_primary, "SE.PRM.NENR", startYear, endYear)
      : Promise.resolve(null as SeriesPoint[] | null),
    bundle.oosc_secondary
      ? enrichOoscFromEnrollmentDense(countryIso3, bundle.oosc_secondary, "SE.SEC.NENR", startYear, endYear)
      : Promise.resolve(null as SeriesPoint[] | null),
    bundle.oosc_tertiary
      ? enrichOoscFromEnrollmentDense(countryIso3, bundle.oosc_tertiary, "SE.TER.ENRR", startYear, endYear)
      : Promise.resolve(null as SeriesPoint[] | null),
  ]);
  if (op) bundle.oosc_primary = op;
  if (os) bundle.oosc_secondary = os;
  if (ot) bundle.oosc_tertiary = ot;

  if (bundle.gpi_primary && bundle.gpi_secondary) {
    bundle.gpi_secondary = fillFromSiblingDense(bundle.gpi_secondary, bundle.gpi_primary);
  }
  if (bundle.gpi_primary && bundle.gpi_tertiary) {
    bundle.gpi_tertiary = fillFromSiblingDense(bundle.gpi_tertiary, bundle.gpi_primary);
  }
  if (bundle.completion_secondary && bundle.completion_tertiary) {
    bundle.completion_tertiary = fillFromSiblingDense(bundle.completion_tertiary, bundle.completion_secondary);
  }
  if (bundle.school_primary_completion && bundle.completion_secondary) {
    bundle.completion_secondary = fillFromSiblingDense(
      bundle.completion_secondary,
      bundle.school_primary_completion
    );
  }
  if (bundle.school_primary_completion && bundle.completion_tertiary) {
    bundle.completion_tertiary = fillFromSiblingDense(
      bundle.completion_tertiary,
      bundle.school_primary_completion
    );
  }
  if (bundle.trained_teachers_pri && bundle.trained_teachers_sec && bundle.trained_teachers_ter) {
    const [pri, sec, ter] = fillTeachersByTriadDense(
      bundle.trained_teachers_pri,
      bundle.trained_teachers_sec,
      bundle.trained_teachers_ter
    );
    bundle.trained_teachers_pri = pri;
    bundle.trained_teachers_sec = sec;
    bundle.trained_teachers_ter = ter;
  }
}

export async function fetchMetricSeriesForCountry(
  countryIso3: string,
  metricId: string,
  startYear = MIN_DATA_YEAR,
  endYear = currentDataYear()
): Promise<SeriesPoint[]> {
  const def = METRIC_BY_ID[metricId];
  if (!def) throw new Error(`Unknown metric: ${metricId}`);

  const safeIndicator = async (indicator: string): Promise<SeriesPoint[]> => {
    try {
      return await fetchIndicatorSeries(countryIso3, indicator, startYear, endYear);
    } catch {
      return [];
    }
  };
  const safeMetric = async (id: string): Promise<SeriesPoint[]> => {
    try {
      return await fetchMetricSeriesForCountry(countryIso3, id, startYear, endYear);
    } catch {
      return emptyDenseSeries(startYear, endYear);
    }
  };

  if (metricId === "gov_debt_usd") {
    const [directRaw, gdpDense, pctDense] = await Promise.all([
      safeIndicator(def.worldBankCode),
      safeMetric("gdp"),
      safeMetric("gov_debt_pct_gdp"),
    ]);
    let debtUsd = mergeDebtUsdWithDerived(directRaw, gdpDense, pctDense, startYear, endYear);
    debtUsd = carryForwardTerminalDense(debtUsd, TERMINAL_CARRY_MAX_YEARS);
    debtUsd = completeDenseSeries(debtUsd, completionOptionsForMetric(metricId));
    debtUsd = clampSeriesByMetricDef(metricId, debtUsd);
    return debtUsd;
  }

  const primary = await safeIndicator(def.worldBankCode);
  let series = primary;
  if (def.fallbackWorldBankCode) {
    const fb = await safeIndicator(def.fallbackWorldBankCode);
    series = mergeSeries(series, fb, "wb_alternate_code");
  }
  if (def.imfWeoIndicator) {
    let imf: SeriesPoint[] = [];
    try {
      imf = await fetchImfWeoSeries(countryIso3, def.imfWeoIndicator, startYear, endYear);
    } catch {
      imf = [];
    }
    const sc = def.imfWeoScale ?? 1;
    if (sc !== 1) {
      imf = imf.map((p) => ({
        year: p.year,
        value:
          p.value != null && Number.isFinite(p.value) ? (p.value as number) * sc : p.value,
      }));
    }
    series = mergeSeries(series, imf, "imf_weo");
  }
  if (def.uisIndicatorId) {
    let uis: SeriesPoint[] = [];
    try {
      uis = await fetchUisCountrySeries(countryIso3, def.uisIndicatorId, startYear, endYear);
    } catch {
      uis = [];
    }
    series = mergeSeries(series, uis, "uis");
  }
  if (metricId === "life_expectancy") {
    const [maleS, femaleS] = await Promise.all([
      safeIndicator("SP.DYN.LE00.MA.IN"),
      safeIndicator("SP.DYN.LE00.FE.IN"),
    ]);
    series = mergeSexAverageForNullSparse(series, maleS, femaleS);
  }
  if (metricId === "mortality_under5") {
    const [maleS, femaleS] = await Promise.all([
      safeIndicator("SH.DYN.MORT.MA"),
      safeIndicator("SH.DYN.MORT.FE"),
    ]);
    series = mergeSexAverageForNullSparse(series, maleS, femaleS);
  }
  let dense = densifySeries(series, startYear, endYear);
  dense = carryForwardTerminalDense(dense, TERMINAL_CARRY_MAX_YEARS);
  dense = completeDenseSeries(dense, completionOptionsForMetric(metricId));
  dense = clampSeriesByMetricDef(metricId, dense);
  return dense;
}

export async function fetchCountryBundle(
  countryIso3: string,
  metricIds: string[],
  startYear = MIN_DATA_YEAR,
  endYear = currentDataYear(),
  opts?: { skipWldFallback?: boolean }
): Promise<Record<string, SeriesPoint[]>> {
  const mapWithConcurrency = async <T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>
  ): Promise<R[]> => {
    const out: R[] = new Array(items.length);
    let next = 0;
    const worker = async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]!);
      }
    };
    const n = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(new Array(n).fill(0).map(worker));
    return out;
  };

  const fetchSet = new Set(metricIds);
  for (const id of metricIds) {
    const anchors = DERIVATION_REQUIRES_ANCHOR[id] ?? [];
    for (const a of anchors) {
      if (METRIC_BY_ID[a]) fetchSet.add(a);
    }
  }
  const fetchIds = [...fetchSet];
  const raw: Record<string, SeriesPoint[]> = {};
  const concurrency = isServerlessRuntime()
    ? Math.min(8, Math.max(4, fetchIds.length <= 10 ? 8 : 6))
    : 6;
  // Avoid issuing dozens of parallel World Bank requests (rate limits -> retries -> timeouts).
  // A small concurrency cap significantly improves worst-case latency on serverless.
  await mapWithConcurrency(fetchIds, concurrency, async (id) => {
    try {
      raw[id] = await fetchMetricSeriesForCountry(countryIso3, id, startYear, endYear);
    } catch {
      raw[id] = emptyDenseSeries(startYear, endYear);
    }
    return null;
  });
  await applyCrossMetricBundleEnrichments(countryIso3, raw, startYear, endYear);

  for (const id of fetchIds) {
    const s = raw[id];
    if (!s) continue;
    raw[id] = completeDenseSeries(s, completionOptionsForMetric(id));
  }

  const upper = countryIso3.toUpperCase();
  if (!opts?.skipWldFallback && upper !== "WLD") {
    const needWld = fetchIds.filter((id) => (raw[id] ?? []).some((p) => isMissingMetricValue(p.value)));
    if (needWld.length > 0) {
      const wldBundle = await fetchCountryBundle("WLD", needWld, startYear, endYear, {
        skipWldFallback: true,
      });
      for (const id of needWld) {
        const cur = raw[id];
        const w = wldBundle[id];
        if (cur && w) raw[id] = mergeWldFallbackDense(cur, w);
      }
    }
  }

  for (const id of fetchIds) {
    const s = raw[id];
    if (!s) continue;
    let t = completeDenseSeries(s, completionOptionsForMetric(id));
    t = clampSeriesByMetricDef(id, t);
    raw[id] = t;
  }

  const out: Record<string, SeriesPoint[]> = {};
  for (const id of metricIds) {
    out[id] = raw[id] ?? [];
  }
  return out;
}

export function allMetricIds(): string[] {
  return METRICS.map((m) => m.id);
}
