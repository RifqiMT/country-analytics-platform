import type { SeriesPoint } from "../series.js";
import { METRIC_BY_ID } from "../metrics.js";
import { listCountries } from "../restCountries.js";
import { isServerlessRuntime } from "../serverlessBudget.js";
import { clampSeriesByMetricDef } from "../seriesCompletion.js";
import { isMissingMetricValue } from "../wdiParse.js";
import { composeMetricMatrix } from "./composeMetricMatrix.js";
import type { YearIsoMatrix } from "./matrixTypes.js";

function emptyDenseSeries(startYear: number, endYear: number): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let y = startYear; y <= endYear; y++) out.push({ year: y, value: null });
  return out;
}

function isFiniteNum(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && Number.isFinite(v);
}

function countFilled(series: SeriesPoint[]): number {
  return series.filter((p) => isFiniteNum(p.value)).length;
}

/** Metrics where the world total is the sum of country values. */
const WLD_SUM_METRICS = new Set([
  "gdp",
  "gdp_ppp",
  "population",
  "gov_debt_usd",
  "enrollment_primary_count",
  "enrollment_secondary_count",
  "enrollment_tertiary_count",
  "labor_force_total",
  "idp_conflict_violence",
  "battle_related_deaths",
]);

/** True world ratio = Σ(numerator) / Σ(denominator). */
const WLD_RATIO_METRICS: Record<string, { numerator: string; denominator: string }> = {
  gdp_per_capita: { numerator: "gdp", denominator: "population" },
  gdp_per_capita_ppp: { numerator: "gdp_ppp", denominator: "population" },
};

/**
 * Rates whose correct world value is a weight-weighted mean of country rates.
 * Default weight is population; overrides below use GDP, labour force, or births proxy.
 */
const WLD_GDP_WEIGHTED = new Set(["inflation"]);
const WLD_LABOUR_WEIGHTED = new Set(["unemployment_ilo"]);
/** Maternal / under-five rates are per live births — weight by pop × crude birth rate. */
const WLD_BIRTH_WEIGHTED = new Set(["maternal_mortality", "mortality_under5"]);

/** Short terminal carry only (matches country dashboard TERMINAL_CARRY_MAX_YEARS). */
const WLD_TERMINAL_CARRY_YEARS = 2;
/** Interior gaps larger than this stay empty (no long-range invention). */
const WLD_MAX_INTERIOR_GAP = 4;

type YearIso = YearIsoMatrix;

function sumYear(yearIso: YearIso, year: number): number | null {
  const m = yearIso.get(year);
  if (!m || m.size === 0) return null;
  let s = 0;
  let n = 0;
  for (const v of m.values()) {
    if (!isFiniteNum(v)) continue;
    s += v;
    n += 1;
  }
  return n > 0 ? s : null;
}

function weightedMeanYear(
  yearIso: YearIso,
  weights: YearIso,
  year: number,
  opts?: { requireWeight?: boolean }
): number | null {
  const m = yearIso.get(year);
  if (!m || m.size === 0) return null;
  const wMap = weights.get(year);
  let num = 0;
  let den = 0;
  for (const [iso, v] of m) {
    if (!isFiniteNum(v)) continue;
    const w = wMap?.get(iso);
    if (!isFiniteNum(w) || w <= 0) {
      if (opts?.requireWeight) continue;
      continue;
    }
    num += v * w;
    den += w;
  }
  return den > 0 ? num / den : null;
}

function toSeries(
  byYear: Map<number, number | null>,
  startYear: number,
  endYear: number
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const v = byYear.get(y) ?? null;
    out.push({
      year: y,
      value: isFiniteNum(v) ? v : null,
      provenance: isFiniteNum(v) ? "derived_cross_metric" : undefined,
    });
  }
  return out;
}

/** Keep published / provider values; fill nulls from country aggregates. */
function mergePreferPrimary(primary: SeriesPoint[], fill: SeriesPoint[]): SeriesPoint[] {
  const byYear = new Map(fill.map((p) => [p.year, p] as const));
  return primary.map((p) => {
    if (isFiniteNum(p.value)) return p;
    const f = byYear.get(p.year);
    if (f && isFiniteNum(f.value)) {
      return { year: p.year, value: f.value, provenance: f.provenance ?? "derived_cross_metric" };
    }
    return p;
  });
}

/**
 * Conservative chart polish: short interior interpolation + short trailing carry.
 * Does not invent leading history or fill unbounded future years.
 */
export function polishWldChartSeries(metricId: string, points: SeriesPoint[]): SeriesPoint[] {
  if (countFilled(points) === 0) return points;
  const n = points.length;
  const out: SeriesPoint[] = points.map((p) => ({ ...p }));

  let first = -1;
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (!isMissingMetricValue(out[i]!.value)) {
      first = i;
      break;
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    if (!isMissingMetricValue(out[i]!.value)) {
      last = i;
      break;
    }
  }
  if (first === -1 || last === -1) return clampSeriesByMetricDef(metricId, out);

  // Interior gaps only between first and last observation.
  let i = first;
  while (i < last) {
    let j = i + 1;
    while (j <= last && isMissingMetricValue(out[j]!.value)) j++;
    if (j > last) break;
    const gap = j - i - 1;
    const vi = out[i]!.value as number;
    const vj = out[j]!.value as number;
    if (gap > 0 && gap <= WLD_MAX_INTERIOR_GAP) {
      for (let k = 1; k <= gap; k++) {
        const t = k / (gap + 1);
        out[i + k] = {
          year: out[i + k]!.year,
          value: vi + t * (vj - vi),
          provenance: "interpolated",
        };
      }
    }
    i = j;
  }

  // Trailing carry: at most WLD_TERMINAL_CARRY_YEARS after last observation.
  const lastVal = out[last]!.value as number;
  const lastYear = out[last]!.year;
  for (let k = last + 1; k < n; k++) {
    if (out[k]!.year - lastYear > WLD_TERMINAL_CARRY_YEARS) break;
    if (isMissingMetricValue(out[k]!.value)) {
      out[k] = { year: out[k]!.year, value: lastVal, provenance: "carried_short" };
    }
  }

  return clampSeriesByMetricDef(metricId, out);
}

type SharedAgg = {
  cache: Map<string, YearIso>;
  pop?: YearIso;
  gdp?: YearIso;
  labour?: YearIso;
  birthRate?: YearIso;
  /** Platform country directory ISO3 allowlist (excludes IMF/WDI region aggregates). */
  allowedIso?: Set<string>;
};

/** Plausible government debt-to-GDP band (percent). Rejects LCU level contamination. */
const DEBT_PCT_MIN = 0;
const DEBT_PCT_MAX = 500;

function isPlausibleDebtPct(v: number): boolean {
  return Number.isFinite(v) && v > DEBT_PCT_MIN && v <= DEBT_PCT_MAX;
}

function filterAllowedMatrix(matrix: YearIso, allowed: Set<string>): YearIso {
  const out: YearIso = new Map();
  for (const [year, byIso] of matrix) {
    const m = new Map<string, number | null>();
    for (const [iso, v] of byIso) {
      if (!allowed.has(iso)) continue;
      m.set(iso, v);
    }
    out.set(year, m);
  }
  return out;
}

async function countryAllowlist(shared: SharedAgg): Promise<Set<string>> {
  if (shared.allowedIso) return shared.allowedIso;
  const countries = await listCountries();
  shared.allowedIso = new Set(
    countries.map((c) => c.cca3.toUpperCase()).filter((iso) => /^[A-Z]{3}$/.test(iso))
  );
  return shared.allowedIso;
}

async function loadYearIso(
  metricId: string,
  start: number,
  end: number,
  shared: SharedAgg
): Promise<YearIso> {
  const hit = shared.cache.get(metricId);
  if (hit) return hit;
  const allowed = await countryAllowlist(shared);
  const yearIso = filterAllowedMatrix(await composeMetricMatrix(metricId, start, end), allowed);
  shared.cache.set(metricId, yearIso);
  return yearIso;
}

async function birthWeights(
  startYear: number,
  endYear: number,
  ctx: SharedAgg
): Promise<YearIso> {
  if (!ctx.pop) ctx.pop = await loadYearIso("population", startYear, endYear, ctx);
  if (!ctx.birthRate) ctx.birthRate = await loadYearIso("birth_rate", startYear, endYear, ctx);
  const out: YearIso = new Map();
  for (let y = startYear; y <= endYear; y++) {
    const m = new Map<string, number | null>();
    const popY = ctx.pop.get(y);
    const brY = ctx.birthRate.get(y);
    if (popY) {
      for (const [iso, pop] of popY) {
        if (!isFiniteNum(pop) || pop <= 0) continue;
        const br = brY?.get(iso);
        // Crude births ≈ pop × (births per 1,000) / 1,000
        const w = isFiniteNum(br) && br > 0 ? pop * (br / 1000) : pop;
        m.set(iso, w);
      }
    }
    out.set(y, m);
  }
  return out;
}

/**
 * World aggregate from country panels.
 * Levels → sum; per-capita → Σnum/Σden; debt% → Σdebt/ΣGDP;
 * unemployment → labour-force-weighted; inflation → GDP-weighted;
 * mortality ratios → birth-proxy-weighted; other rates → population-weighted.
 */
async function buildWldSeriesFromMatrix(
  metricId: string,
  startYear: number,
  endYear: number,
  shared?: SharedAgg
): Promise<SeriesPoint[]> {
  if (!METRIC_BY_ID[metricId]) return emptyDenseSeries(startYear, endYear);
  const ctx: SharedAgg = shared ?? { cache: new Map() };
  const byYear = new Map<number, number | null>();

  // Government debt US$ = Σ(GDP × debt%/100) for sovereigns with a plausible debt %.
  if (metricId === "gov_debt_usd") {
    const [gdpM, pctM] = await Promise.all([
      loadYearIso("gdp", startYear, endYear, ctx),
      loadYearIso("gov_debt_pct_gdp", startYear, endYear, ctx),
    ]);
    for (let y = startYear; y <= endYear; y++) {
      const gdpY = gdpM.get(y);
      const pctY = pctM.get(y);
      if (!gdpY || !pctY) {
        byYear.set(y, null);
        continue;
      }
      let sum = 0;
      let n = 0;
      for (const [iso, gdp] of gdpY) {
        const pct = pctY.get(iso);
        if (!isFiniteNum(gdp) || gdp <= 0 || !isFiniteNum(pct) || !isPlausibleDebtPct(pct)) continue;
        sum += gdp * (pct / 100);
        n += 1;
      }
      byYear.set(y, n > 0 ? sum : null);
    }
    return toSeries(byYear, startYear, endYear);
  }

  // World debt-to-GDP = Σdebt / ΣGDP over the same sovereign panel (not a pop-weighted mean).
  if (metricId === "gov_debt_pct_gdp") {
    const [gdpM, pctM] = await Promise.all([
      loadYearIso("gdp", startYear, endYear, ctx),
      loadYearIso("gov_debt_pct_gdp", startYear, endYear, ctx),
    ]);
    for (let y = startYear; y <= endYear; y++) {
      const gdpY = gdpM.get(y);
      const pctY = pctM.get(y);
      if (!gdpY || !pctY) {
        byYear.set(y, null);
        continue;
      }
      let debt = 0;
      let gdpSum = 0;
      for (const [iso, gdp] of gdpY) {
        const pct = pctY.get(iso);
        if (!isFiniteNum(gdp) || gdp <= 0 || !isFiniteNum(pct) || !isPlausibleDebtPct(pct)) continue;
        debt += gdp * (pct / 100);
        gdpSum += gdp;
      }
      byYear.set(y, gdpSum > 0 ? (debt / gdpSum) * 100 : null);
    }
    return toSeries(byYear, startYear, endYear);
  }

  const ratio = WLD_RATIO_METRICS[metricId];
  if (ratio) {
    const [numM, denM] = await Promise.all([
      loadYearIso(ratio.numerator, startYear, endYear, ctx),
      loadYearIso(ratio.denominator, startYear, endYear, ctx),
    ]);
    for (let y = startYear; y <= endYear; y++) {
      const n = sumYear(numM, y);
      const d = sumYear(denM, y);
      byYear.set(y, isFiniteNum(n) && isFiniteNum(d) && d !== 0 ? n / d : null);
    }
    return toSeries(byYear, startYear, endYear);
  }

  // Atlas GNI/capita world ≈ Σ(gni_pc × pop) / Σ(pop).
  if (metricId === "gni_per_capita_atlas") {
    const [pcM, popM] = await Promise.all([
      loadYearIso("gni_per_capita_atlas", startYear, endYear, ctx),
      loadYearIso("population", startYear, endYear, ctx),
    ]);
    for (let y = startYear; y <= endYear; y++) {
      byYear.set(y, weightedMeanYear(pcM, popM, y, { requireWeight: true }));
    }
    return toSeries(byYear, startYear, endYear);
  }

  const matrix = await loadYearIso(metricId, startYear, endYear, ctx);

  if (WLD_SUM_METRICS.has(metricId)) {
    for (let y = startYear; y <= endYear; y++) byYear.set(y, sumYear(matrix, y));
    return toSeries(byYear, startYear, endYear);
  }

  if (WLD_GDP_WEIGHTED.has(metricId)) {
    if (!ctx.gdp) ctx.gdp = await loadYearIso("gdp", startYear, endYear, ctx);
    for (let y = startYear; y <= endYear; y++) {
      byYear.set(y, weightedMeanYear(matrix, ctx.gdp, y, { requireWeight: true }));
    }
    return toSeries(byYear, startYear, endYear);
  }

  if (WLD_LABOUR_WEIGHTED.has(metricId)) {
    if (!ctx.labour) ctx.labour = await loadYearIso("labor_force_total", startYear, endYear, ctx);
    for (let y = startYear; y <= endYear; y++) {
      byYear.set(y, weightedMeanYear(matrix, ctx.labour, y, { requireWeight: true }));
    }
    return toSeries(byYear, startYear, endYear);
  }

  if (WLD_BIRTH_WEIGHTED.has(metricId)) {
    const weights = await birthWeights(startYear, endYear, ctx);
    for (let y = startYear; y <= endYear; y++) {
      byYear.set(y, weightedMeanYear(matrix, weights, y, { requireWeight: true }));
    }
    return toSeries(byYear, startYear, endYear);
  }

  if (!ctx.pop) ctx.pop = await loadYearIso("population", startYear, endYear, ctx);
  for (let y = startYear; y <= endYear; y++) {
    byYear.set(y, weightedMeanYear(matrix, ctx.pop, y, { requireWeight: true }));
  }
  return toSeries(byYear, startYear, endYear);
}

/**
 * Fill gappy official WLD series from country aggregates (time-boxed).
 * Coverage threshold is high so sparse official points cannot leave decades blank.
 */
export async function fillWldBundleFromMatrices(
  bundle: Record<string, SeriesPoint[]>,
  metricIds: string[],
  startYear: number,
  endYear: number,
  opts?: { deadlineMs?: number }
): Promise<Record<string, SeriesPoint[]>> {
  const span = Math.max(1, endYear - startYear + 1);
  const minFilled = Math.ceil(span * 0.95);
  const need = metricIds.filter((id) => countFilled(bundle[id] ?? []) < minFilled);
  if (need.length === 0) return bundle;

  const deadlineMs = opts?.deadlineMs ?? Date.now() + (isServerlessRuntime() ? 35_000 : 90_000);
  const shared: SharedAgg = { cache: new Map() };
  const concurrency = isServerlessRuntime() ? 2 : 3;
  const perMetricMs = isServerlessRuntime() ? 12_000 : 28_000;
  let next = 0;

  const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const worker = async () => {
    for (;;) {
      if (Date.now() >= deadlineMs) return;
      const i = next++;
      if (i >= need.length) return;
      const id = need[i]!;
      const budget = Math.max(2_000, Math.min(perMetricMs, deadlineMs - Date.now()));
      try {
        const derived = await withTimeout(
          buildWldSeriesFromMatrix(id, startYear, endYear, shared),
          budget
        );
        if (!derived) {
          console.warn(`[wld-matrix] aggregate timed out for ${id} after ${budget}ms`);
          continue;
        }
        const cur = bundle[id] ?? emptyDenseSeries(startYear, endYear);
        bundle[id] = mergePreferPrimary(cur, derived);
      } catch (e) {
        console.error(
          `[wld-matrix] aggregate failed for ${id}:`,
          e instanceof Error ? e.message : e
        );
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, need.length) }, () => worker()));
  return bundle;
}

export function wldSeriesFilledCount(series: SeriesPoint[] | undefined): number {
  return countFilled(series ?? []);
}
