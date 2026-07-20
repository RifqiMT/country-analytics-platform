import { getCache, setCache } from "./cache.js";
import { fetchWithRetry } from "./httpClient.js";
import type { SeriesPoint } from "./series.js";
import { fetchIndicatorSeries } from "./worldBank.js";
import { MIN_DATA_YEAR } from "./yearBounds.js";

const FRANKFURTER_BASE = "https://api.frankfurter.app";
const FX_SERIES_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
/** ECB reference rates via Frankfurter — EUR available from 1999. */
const EUR_INCEPTION_YEAR = 1999;

export type FxSeriesPayload = {
  currency: string;
  /** 1 USD = value local currency units (annual, year-end where daily source used). */
  usdToLocal: SeriesPoint[];
  /** 1 EUR = value local currency units. */
  eurToLocal: SeriesPoint[];
  usdSource: string;
  eurSource: string;
};

function isUsableRate(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function densifyYears(points: SeriesPoint[], startYear: number, endYear: number): SeriesPoint[] {
  const byYear = new Map<number, SeriesPoint>();
  for (const p of points) {
    if (p.year >= startYear && p.year <= endYear && isUsableRate(p.value)) byYear.set(p.year, p);
  }
  return Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return byYear.get(year) ?? { year, value: null };
  });
}

/** Last Frankfurter observation per calendar year (year-end ECB reference). */
function yearEndFromDailyRates(rates: Record<string, Record<string, unknown>>): Map<number, number> {
  const best = new Map<number, { date: string; rate: number }>();
  for (const [date, row] of Object.entries(rates)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const year = Number(date.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const values = Object.values(row ?? {});
    const rate = values.length === 1 ? Number(values[0]) : NaN;
    if (!isUsableRate(rate)) continue;
    const prev = best.get(year);
    if (!prev || date > prev.date) best.set(year, { date, rate });
  }
  const out = new Map<number, number>();
  for (const [year, { rate }] of best) out.set(year, rate);
  return out;
}

async function fetchFrankfurterRangeYearEnd(
  base: string,
  target: string,
  startYear: number,
  endYear: number
): Promise<Map<number, number>> {
  const b = base.toUpperCase();
  const t = target.toUpperCase();
  if (!/^[A-Z]{3}$/.test(b) || !/^[A-Z]{3}$/.test(t)) return new Map();
  if (b === t) {
    const m = new Map<number, number>();
    for (let y = startYear; y <= endYear; y++) m.set(y, 1);
    return m;
  }

  const cacheKey = `fx:frankfurter:ye:${b}:${t}:${startYear}:${endYear}:v1`;
  const cached = getCache<Record<string, number>>(cacheKey);
  if (cached) return new Map(Object.entries(cached).map(([k, v]) => [Number(k), v]));

  const startDate = `${Math.max(startYear, EUR_INCEPTION_YEAR)}-01-01`;
  const endDate = `${endYear}-12-31`;
  const url = `${FRANKFURTER_BASE}/${startDate}..${endDate}?from=${encodeURIComponent(b)}&to=${encodeURIComponent(t)}`;

  try {
    const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } }, { attempts: 3, baseDelayMs: 400 });
    if (!res.ok) return new Map();
    const raw = (await res.json()) as { rates?: Record<string, Record<string, unknown>> } | null;
    const yearEnd = yearEndFromDailyRates(raw?.rates ?? {});
    const plain: Record<string, number> = {};
    for (const [y, r] of yearEnd) plain[String(y)] = r;
    if (Object.keys(plain).length > 0) setCache(cacheKey, plain, FX_SERIES_CACHE_TTL_MS);
    return yearEnd;
  } catch {
    return new Map();
  }
}

async function fetchWbUsdLcuSeries(iso3: string, startYear: number, endYear: number): Promise<SeriesPoint[]> {
  const rows = await fetchIndicatorSeries(iso3, "PA.NUS.FCRF", startYear, endYear).catch(() => [] as SeriesPoint[]);
  return rows.map((p) => ({
    year: p.year,
    value: isUsableRate(p.value) ? p.value : null,
    provenance: isUsableRate(p.value) ? ("reported" as const) : undefined,
  }));
}

function mergeUsdSeries(
  wb: SeriesPoint[],
  frankfurter: Map<number, number>,
  startYear: number,
  endYear: number
): SeriesPoint[] {
  const wbByYear = new Map(wb.filter((p) => isUsableRate(p.value)).map((p) => [p.year, p.value!]));
  const out: SeriesPoint[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const ff = frankfurter.get(y);
    if (isUsableRate(ff)) {
      out.push({ year: y, value: ff, provenance: "reported" });
    } else if (wbByYear.has(y)) {
      out.push({ year: y, value: wbByYear.get(y)!, provenance: "reported" });
    } else {
      out.push({ year: y, value: null });
    }
  }
  return out;
}

function buildEurSeries(
  usdLocal: SeriesPoint[],
  eurDirect: Map<number, number>,
  usdEur: Map<number, number>,
  startYear: number,
  endYear: number
): SeriesPoint[] {
  const usdLocalMap = new Map(usdLocal.filter((p) => isUsableRate(p.value)).map((p) => [p.year, p.value!]));
  const out: SeriesPoint[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const direct = eurDirect.get(y);
    if (isUsableRate(direct)) {
      out.push({ year: y, value: direct, provenance: "reported" });
      continue;
    }
    const usdLc = usdLocalMap.get(y);
    const uEur = usdEur.get(y);
    if (isUsableRate(usdLc) && isUsableRate(uEur)) {
      out.push({ year: y, value: usdLc / uEur, provenance: "derived_cross_metric" });
    } else {
      out.push({ year: y, value: null });
    }
  }
  return out;
}

function pickFxCurrency(candidates: string[]): string | null {
  for (const raw of candidates) {
    const c = String(raw ?? "").toUpperCase();
    if (/^[A-Z]{3}$/.test(c)) return c;
  }
  return null;
}

function describeUsdSource(hasFrankfurter: boolean, hasWb: boolean): string {
  if (hasFrankfurter && hasWb) return "ECB year-end (Frankfurter) with World Bank PA.NUS.FCRF fill";
  if (hasFrankfurter) return "ECB year-end via Frankfurter";
  if (hasWb) return "World Bank PA.NUS.FCRF (official annual)";
  return "Not available";
}

function describeEurSource(hasDirect: boolean, hasTriangulated: boolean): string {
  if (hasDirect && hasTriangulated) return "ECB year-end (Frankfurter) with USD/EUR triangulation fill";
  if (hasDirect) return "ECB year-end via Frankfurter";
  if (hasTriangulated) return "Triangulated from USD/LCU ÷ USD/EUR (WB + ECB)";
  return "Not available";
}

/**
 * Annual USD/EUR → local currency series for dashboard charts.
 * USD: Frankfurter year-end where available, World Bank PA.NUS.FCRF otherwise.
 * EUR: Frankfurter direct from 1999, triangulated from USD rates when needed.
 */
export async function fetchCountryFxSeries(
  iso3: string,
  currencyCandidates: string[],
  startYear: number,
  endYear: number
): Promise<FxSeriesPayload | null> {
  const currency = pickFxCurrency(currencyCandidates);
  if (!currency) return null;

  const lo = Math.max(MIN_DATA_YEAR, Math.min(startYear, endYear));
  const hi = Math.max(startYear, endYear);
  const cacheKey = `fx:series:v1:${iso3.toUpperCase()}:${currency}:${lo}:${hi}`;
  const hit = getCache<FxSeriesPayload>(cacheKey);
  if (hit) return hit;

  if (currency === "USD") {
    const flat = densifyYears([], lo, hi).map((p) => ({ ...p, value: 1, provenance: "reported" as const }));
    const payload: FxSeriesPayload = {
      currency,
      usdToLocal: flat,
      eurToLocal: [],
      usdSource: "Identity (USD)",
      eurSource: "Not applicable (USD economy)",
    };
    setCache(cacheKey, payload, FX_SERIES_CACHE_TTL_MS);
    return payload;
  }

  const ffStart = Math.max(lo, EUR_INCEPTION_YEAR);
  const [wbUsd, ffUsdLocal, ffEurLocal, ffUsdEur] = await Promise.all([
    fetchWbUsdLcuSeries(iso3, lo, hi),
    ffStart <= hi ? fetchFrankfurterRangeYearEnd("USD", currency, ffStart, hi) : Promise.resolve(new Map()),
    currency !== "EUR" && ffStart <= hi
      ? fetchFrankfurterRangeYearEnd("EUR", currency, ffStart, hi)
      : Promise.resolve(new Map()),
    ffStart <= hi ? fetchFrankfurterRangeYearEnd("USD", "EUR", ffStart, hi) : Promise.resolve(new Map()),
  ]);

  const usdToLocal = mergeUsdSeries(wbUsd, ffUsdLocal, lo, hi);
  const eurToLocal =
    currency === "EUR"
      ? densifyYears([], lo, hi).map((p) => ({
          ...p,
          value: p.year >= EUR_INCEPTION_YEAR ? 1 : null,
          provenance: p.year >= EUR_INCEPTION_YEAR ? ("reported" as const) : undefined,
        }))
      : buildEurSeries(usdToLocal, ffEurLocal, ffUsdEur, lo, hi);

  const hasFfUsd = ffUsdLocal.size > 0;
  const hasWb = wbUsd.some((p) => isUsableRate(p.value));
  const hasEurDirect = ffEurLocal.size > 0;
  const hasEurTri = eurToLocal.some((p) => p.provenance === "derived_cross_metric");

  const payload: FxSeriesPayload = {
    currency,
    usdToLocal,
    eurToLocal,
    usdSource: describeUsdSource(hasFfUsd, hasWb),
    eurSource: currency === "EUR" ? "Identity (EUR)" : describeEurSource(hasEurDirect, hasEurTri),
  };
  setCache(cacheKey, payload, FX_SERIES_CACHE_TTL_MS);
  return payload;
}

/** Build currency candidate list consistent with `/api/country/:cca3`. */
export function buildFxCurrencyCandidates(input: {
  currencyCodes?: string[];
  currencyDisplay?: string;
  directCurrencyFallback?: string;
  iso3?: string;
}): string[] {
  const iso = (input.iso3 ?? "").toUpperCase();
  const fromDisplay =
    typeof input.currencyDisplay === "string"
      ? (input.currencyDisplay.match(/\b[A-Z]{3}\b/g) ?? []).filter((c) => /^[A-Z]{3}$/.test(c))
      : [];
  const fallbackByIso3: Record<string, string> = { XKX: "EUR" };
  return [
    ...(input.currencyCodes ?? []),
    ...fromDisplay,
    ...(input.directCurrencyFallback ? [input.directCurrencyFallback] : []),
    ...(fallbackByIso3[iso] ? [fallbackByIso3[iso]] : []),
  ];
}
