import { getCache, setCache } from "./cache.js";
import { METRIC_BY_ID } from "./metrics.js";
import { MIN_DATA_YEAR, resolveGlobalWdiYear } from "./yearBounds.js";
import { fetchImfWeoGlobalYearMap } from "./imfWeo.js";
import { listCountries } from "./restCountries.js";
import { fetchCountryBundle } from "./worldBank.js";
import {
  canonicalWbIso3,
  isMissingMetricValue,
  parseWdiNumericValue,
  pickBetterObservation,
} from "./wdiParse.js";
import { fetchWithRetry } from "./httpClient.js";
import { fetchUisGlobalRowsForYear } from "./uisApi.js";
import { fetchWhoGhoGlobalRowsForYear } from "./whoGho.js";
import { isServerlessRuntime } from "./serverlessBudget.js";

/** Per-request ceiling for WDI global indicator pages (prevents hung table builds). */
const WDI_GLOBAL_HTTP_TIMEOUT_MS = isServerlessRuntime() ? 12_000 : 18_000;

export interface GlobalRow {
  countryIso3: string;
  countryName: string;
  value: number | null;
}

function isMissingValue(v: number | null | undefined): boolean {
  return isMissingMetricValue(v);
}

/** Paginated fetch: one indicator, one calendar year, all economies returned by WDI. */
async function fetchGlobalIndicatorYearOnce(indicatorCode: string, year: number): Promise<GlobalRow[]> {
  const byIso = new Map<string, GlobalRow>();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${encodeURIComponent(
      indicatorCode
    )}?date=${year}&format=json&per_page=${perPage}&page=${page}`;
    const res = await fetchWithRetry(url, undefined, {
      attempts: 5,
      baseDelayMs: 500,
      timeoutMs: WDI_GLOBAL_HTTP_TIMEOUT_MS,
    });
    if (!res.ok) throw new Error(`World Bank global HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trimStart().startsWith("[") && !text.trimStart().startsWith("{")) {
      throw new Error(`World Bank global returned non-JSON for ${indicatorCode} ${year}`);
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`World Bank global JSON parse failed for ${indicatorCode} ${year}`);
    }
    if (!Array.isArray(raw) || raw.length < 2) break;
    const chunk = raw[1];
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const r of chunk) {
      if (!r || typeof r !== "object") continue;
      const rec = r as {
        countryiso3code?: string;
        country?: { value?: string };
        value?: unknown;
      };
      const rawIso = rec.countryiso3code;
      if (!rawIso || rawIso === "") continue;
      const iso = canonicalWbIso3(rawIso);
      if (!/^[A-Z]{3}$/.test(iso)) continue;
      const name = rec.country?.value ?? iso;
      const parsed = parseWdiNumericValue(rec.value);
      const prev = byIso.get(iso);
      if (!prev) {
        byIso.set(iso, { countryIso3: iso, countryName: name, value: parsed });
      } else {
        const nextVal = pickBetterObservation(prev.value, parsed);
        byIso.set(iso, {
          countryIso3: iso,
          countryName: name || prev.countryName,
          value: nextVal,
        });
      }
    }
    const meta = raw[0] as { pages?: number };
    if (typeof meta?.pages === "number" && page >= meta.pages) break;
    page += 1;
    if (page > 50) break;
  }
  return [...byIso.values()];
}

/**
 * Retries WDI “all economies” pages so a single HTTP blip does not blank the entire global table.
 */
async function fetchGlobalIndicatorYear(indicatorCode: string, year: number): Promise<GlobalRow[]> {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchGlobalIndicatorYearOnce(indicatorCode, year);
    } catch (e) {
      if (attempt >= maxAttempts) {
        console.error(
          `[WDI] global fetch failed for ${indicatorCode} ${year} after ${maxAttempts} attempts:`,
          e instanceof Error ? e.message : e
        );
        return [];
      }
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  return [];
}

/**
 * Cached raw WDI “all economies” page for an indicator code (no metric merge / UIS / IMF pipeline).
 * Used by the global education table for enrollment-based proxies.
 */
export async function fetchWdiGlobalRowsForYear(indicatorCode: string, year: number): Promise<GlobalRow[]> {
  const cacheKey = `wdi:all:${indicatorCode}:${year}`;
  const cached = getCache<GlobalRow[]>(cacheKey);
  if (cached) return cached;
  const rows = await fetchGlobalIndicatorYear(indicatorCode, year);
  setCache(cacheKey, rows, 1000 * 60 * 60);
  return rows;
}

function mergeGlobalRows(primary: GlobalRow[], fallback: GlobalRow[]): GlobalRow[] {
  const byIso = new Map<string, GlobalRow>();
  for (const r of primary) {
    byIso.set(r.countryIso3, { ...r });
  }
  for (const r of fallback) {
    const cur = byIso.get(r.countryIso3);
    if (!cur) {
      byIso.set(r.countryIso3, { ...r });
      continue;
    }
    if (isMissingValue(cur.value) && !isMissingValue(r.value)) {
      byIso.set(r.countryIso3, { ...cur, value: r.value });
    }
  }
  return [...byIso.values()];
}

/** Fill null cells from IMF WEO DataMapper for the same calendar year (bulk, one request). */
async function enrichGlobalRowsWithImf(
  rows: GlobalRow[],
  imfIndicator: string,
  year: number,
  scale = 1
): Promise<GlobalRow[]> {
  const need = rows.filter((r) => isMissingValue(r.value));
  if (need.length === 0) return rows;
  const bulk = await fetchImfWeoGlobalYearMap(imfIndicator, year, scale);
  if (bulk.size === 0) return rows;
  return rows.map((row) => {
    if (!isMissingValue(row.value)) return row;
    const v = bulk.get(row.countryIso3.toUpperCase());
    if (v !== undefined && Number.isFinite(v)) return { ...row, value: v };
    return row;
  });
}

/** Same rule as country series: fill missing WDI debt (US$) from nominal GDP × debt % GDP. */
async function enrichGlobalGovDebtUsd(rows: GlobalRow[], year: number): Promise<GlobalRow[]> {
  const [gdpRows, pctRows] = await Promise.all([
    fetchGlobalYearSnapshot("gdp", year),
    fetchGlobalYearSnapshot("gov_debt_pct_gdp", year),
  ]);
  const gdpMap = new Map(gdpRows.map((r) => [r.countryIso3, r.value]));
  const pctMap = new Map(pctRows.map((r) => [r.countryIso3, r.value]));

  const derive = (iso: string): number | null => {
    const g = gdpMap.get(iso);
    const p = pctMap.get(iso);
    if (isMissingValue(g) || isMissingValue(p)) return null;
    return (p! / 100) * g!;
  };

  const byIso = new Map<string, GlobalRow>();
  for (const r of rows) {
    byIso.set(r.countryIso3, { ...r });
  }

  for (const [iso, row] of byIso) {
    if (!isMissingValue(row.value)) continue;
    const v = derive(iso);
    if (v !== null) byIso.set(iso, { ...row, value: v });
  }

  const seen = new Set(byIso.keys());
  for (const gr of gdpRows) {
    if (seen.has(gr.countryIso3)) continue;
    const v = derive(gr.countryIso3);
    if (v === null) continue;
    byIso.set(gr.countryIso3, {
      countryIso3: gr.countryIso3,
      countryName: gr.countryName,
      value: v,
    });
  }

  return [...byIso.values()];
}

/** When the total series is null but male and female WDI series exist, use the simple mean (gap-fill only). */
async function enrichFromSexPairAverage(
  rows: GlobalRow[],
  year: number,
  maleCode: string,
  femaleCode: string
): Promise<GlobalRow[]> {
  const [maleRows, femaleRows] = await Promise.all([
    fetchGlobalIndicatorYear(maleCode, year),
    fetchGlobalIndicatorYear(femaleCode, year),
  ]);
  const maleMap = new Map(maleRows.map((r) => [r.countryIso3.toUpperCase(), r.value] as const));
  const femaleMap = new Map(femaleRows.map((r) => [r.countryIso3.toUpperCase(), r.value] as const));

  return rows.map((row) => {
    if (!isMissingValue(row.value)) return row;
    const iso = row.countryIso3.toUpperCase();
    const m = maleMap.get(iso);
    const f = femaleMap.get(iso);
    if (!isMissingValue(m) && !isMissingValue(f)) {
      return { ...row, value: ((m as number) + (f as number)) / 2 };
    }
    return row;
  });
}

/**
 * Paginated WDI fetch across a year span (`date=start:end`) — far fewer round-trips than one year at a time.
 * Returns rows keyed by calendar year for correlation / multi-year analytics.
 */
async function fetchGlobalIndicatorYearRangeOnce(
  indicatorCode: string,
  startYear: number,
  endYear: number
): Promise<Map<number, GlobalRow[]>> {
  const byYearIso = new Map<number, Map<string, GlobalRow>>();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${encodeURIComponent(
      indicatorCode
    )}?date=${startYear}:${endYear}&format=json&per_page=${perPage}&page=${page}`;
    const res = await fetchWithRetry(url, undefined, {
      attempts: 5,
      baseDelayMs: 500,
      timeoutMs: WDI_GLOBAL_HTTP_TIMEOUT_MS,
    });
    if (!res.ok) throw new Error(`World Bank global range HTTP ${res.status}`);
    const text = await res.text();
    // WAF / CDN sometimes returns HTML with HTTP 200 — treat as failure so we can fall back.
    if (!text.trimStart().startsWith("[") && !text.trimStart().startsWith("{")) {
      throw new Error(`World Bank global range returned non-JSON for ${indicatorCode}`);
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`World Bank global range JSON parse failed for ${indicatorCode}`);
    }
    if (!Array.isArray(raw) || raw.length < 2) break;
    const chunk = raw[1];
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const r of chunk) {
      if (!r || typeof r !== "object") continue;
      const rec = r as {
        countryiso3code?: string;
        country?: { value?: string };
        value?: unknown;
        date?: string | number;
      };
      const year = typeof rec.date === "number" ? rec.date : parseInt(String(rec.date ?? ""), 10);
      if (!Number.isFinite(year) || year < startYear || year > endYear) continue;
      const rawIso = rec.countryiso3code;
      if (!rawIso || rawIso === "") continue;
      const iso = canonicalWbIso3(rawIso);
      if (!/^[A-Z]{3}$/.test(iso)) continue;
      const name = rec.country?.value ?? iso;
      const parsed = parseWdiNumericValue(rec.value);
      if (!byYearIso.has(year)) byYearIso.set(year, new Map());
      const byIso = byYearIso.get(year)!;
      const prev = byIso.get(iso);
      if (!prev) {
        byIso.set(iso, { countryIso3: iso, countryName: name, value: parsed });
      } else {
        byIso.set(iso, {
          countryIso3: iso,
          countryName: name || prev.countryName,
          value: pickBetterObservation(prev.value, parsed),
        });
      }
    }
    const meta = raw[0] as { pages?: number };
    if (typeof meta?.pages === "number" && page >= meta.pages) break;
    page += 1;
    if (page > 80) break;
  }
  const out = new Map<number, GlobalRow[]>();
  for (const [year, byIso] of byYearIso) {
    out.set(year, [...byIso.values()]);
  }
  return out;
}

async function fetchGlobalIndicatorYearRange(
  indicatorCode: string,
  startYear: number,
  endYear: number
): Promise<Map<number, GlobalRow[]>> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchGlobalIndicatorYearRangeOnce(indicatorCode, startYear, endYear);
    } catch (e) {
      if (attempt >= maxAttempts) {
        console.error(
          `[WDI] global range fetch failed for ${indicatorCode} ${startYear}:${endYear}:`,
          e instanceof Error ? e.message : e
        );
        return new Map();
      }
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  return new Map();
}

function emptyYearMap(startYear: number, endYear: number): Map<number, GlobalRow[]> {
  const m = new Map<number, GlobalRow[]>();
  for (let y = startYear; y <= endYear; y++) m.set(y, []);
  return m;
}

function mergeYearMaps(
  primary: Map<number, GlobalRow[]>,
  fallback: Map<number, GlobalRow[]>,
  startYear: number,
  endYear: number
): Map<number, GlobalRow[]> {
  const out = new Map<number, GlobalRow[]>();
  for (let y = startYear; y <= endYear; y++) {
    out.set(y, mergeGlobalRows(primary.get(y) ?? [], fallback.get(y) ?? []));
  }
  return out;
}

function applySexPairAverageOnRows(
  rows: GlobalRow[],
  maleByIso: Map<string, number | null>,
  femaleByIso: Map<string, number | null>
): GlobalRow[] {
  return rows.map((row) => {
    if (!isMissingValue(row.value)) return row;
    const iso = row.countryIso3.toUpperCase();
    const m = maleByIso.get(iso);
    const f = femaleByIso.get(iso);
    if (!isMissingValue(m) && !isMissingValue(f)) {
      return { ...row, value: ((m as number) + (f as number)) / 2 };
    }
    return row;
  });
}

function countUsableRowsInYearMap(byYear: Map<number, GlobalRow[]>): number {
  let n = 0;
  for (const rows of byYear.values()) {
    for (const r of rows) {
      if (!isMissingValue(r.value)) n += 1;
    }
  }
  return n;
}

/**
 * Fast multi-year global snapshots for correlation analytics.
 * Prefers WDI date-range pages; falls back to per-year snapshots when the range path is empty or blocked.
 * Skips per-country IMF/UIS enrichment on the range path (too slow for long spans).
 */
export async function fetchGlobalYearSnapshotsForRange(
  metricId: string,
  startYear: number,
  endYear: number,
  opts?: { allowYearByYearFallback?: boolean }
): Promise<Map<number, GlobalRow[]>> {
  const def = METRIC_BY_ID[metricId];
  if (!def) throw new Error(`Unknown metric: ${metricId}`);
  if (endYear < startYear) return emptyYearMap(startYear, endYear);
  const allowYearByYearFallback = opts?.allowYearByYearFallback !== false;

  const rangeCacheKey = `global:range:v2:${metricId}:${startYear}:${endYear}`;
  const rangeHit = getCache<Array<[number, GlobalRow[]]>>(rangeCacheKey);
  if (rangeHit) {
    const restored = new Map(rangeHit);
    if (countUsableRowsInYearMap(restored) > 0) return restored;
  }

  // Reuse per-year caches when the full span is already warm with real data.
  const fromYearCache = new Map<number, GlobalRow[]>();
  let allCached = true;
  for (let y = startYear; y <= endYear; y++) {
    const hit = getCache<GlobalRow[]>(`global:v10:${metricId}:${y}`);
    if (!hit || hit.length === 0) {
      allCached = false;
      break;
    }
    fromYearCache.set(y, hit);
  }
  if (allCached && countUsableRowsInYearMap(fromYearCache) > 0) return fromYearCache;

  let byYear = await fetchGlobalIndicatorYearRange(def.worldBankCode, startYear, endYear);
  if (def.fallbackWorldBankCode) {
    const fb = await fetchGlobalIndicatorYearRange(def.fallbackWorldBankCode, startYear, endYear);
    byYear = mergeYearMaps(byYear, fb, startYear, endYear);
  } else {
    byYear = mergeYearMaps(byYear, emptyYearMap(startYear, endYear), startYear, endYear);
  }

  if (metricId === "life_expectancy" || metricId === "mortality_under5") {
    const maleCode = metricId === "life_expectancy" ? "SP.DYN.LE00.MA.IN" : "SH.DYN.MORT.MA";
    const femaleCode = metricId === "life_expectancy" ? "SP.DYN.LE00.FE.IN" : "SH.DYN.MORT.FE";
    const [maleByYear, femaleByYear] = await Promise.all([
      fetchGlobalIndicatorYearRange(maleCode, startYear, endYear),
      fetchGlobalIndicatorYearRange(femaleCode, startYear, endYear),
    ]);
    for (let y = startYear; y <= endYear; y++) {
      const maleByIso = new Map(
        (maleByYear.get(y) ?? []).map((r) => [r.countryIso3.toUpperCase(), r.value] as const)
      );
      const femaleByIso = new Map(
        (femaleByYear.get(y) ?? []).map((r) => [r.countryIso3.toUpperCase(), r.value] as const)
      );
      byYear.set(y, applySexPairAverageOnRows(byYear.get(y) ?? [], maleByIso, femaleByIso));
    }
  }

  // Range path failed or was blocked — optional lite per-year fallback (can be very slow).
  if (countUsableRowsInYearMap(byYear) === 0) {
    if (!allowYearByYearFallback) {
      console.warn(
        `[WDI] range snapshot empty for ${metricId} ${startYear}:${endYear}; skipping year-by-year fallback`
      );
      return emptyYearMap(startYear, endYear);
    }
    console.warn(
      `[WDI] range snapshot empty for ${metricId} ${startYear}:${endYear}; falling back to per-year lite fetches`
    );
    byYear = await fetchGlobalYearSnapshotsYearByYearLite(metricId, startYear, endYear);
  }

  if (countUsableRowsInYearMap(byYear) === 0) {
    // Do not poison per-year / range caches with empty failures.
    return emptyYearMap(startYear, endYear);
  }

  for (let y = startYear; y <= endYear; y++) {
    const rows = byYear.get(y) ?? [];
    byYear.set(y, rows);
    if (rows.length > 0) setCache(`global:v10:${metricId}:${y}`, rows, 1000 * 60 * 60);
  }
  setCache(rangeCacheKey, [...byYear.entries()], 1000 * 60 * 45);
  return byYear;
}

/** WDI-only year snapshot (no IMF/UIS) for fast correlation recovery. */
async function fetchGlobalYearSnapshotLite(metricId: string, year: number): Promise<GlobalRow[]> {
  const def = METRIC_BY_ID[metricId];
  if (!def) throw new Error(`Unknown metric: ${metricId}`);
  const cacheKey = `global:lite:v1:${metricId}:${year}`;
  const cached = getCache<GlobalRow[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  const primary = await fetchGlobalIndicatorYear(def.worldBankCode, year);
  let rows = primary;
  if (def.fallbackWorldBankCode) {
    const fb = await fetchGlobalIndicatorYear(def.fallbackWorldBankCode, year);
    rows = mergeGlobalRows(primary, fb);
  }
  if (metricId === "life_expectancy") {
    rows = await enrichFromSexPairAverage(rows, year, "SP.DYN.LE00.MA.IN", "SP.DYN.LE00.FE.IN");
  }
  if (metricId === "mortality_under5") {
    rows = await enrichFromSexPairAverage(rows, year, "SH.DYN.MORT.MA", "SH.DYN.MORT.FE");
  }
  if (metricId === "uhc_service_coverage") {
    try {
      const who = await fetchWhoGhoGlobalRowsForYear("UHC_INDEX_REPORTED", year);
      rows = mergeGlobalRows(
        rows,
        who.map((r) => ({
          countryIso3: r.countryIso3,
          countryName: r.countryName,
          value: r.value,
        }))
      );
    } catch {
      /* keep WDI (likely empty) */
    }
  }
  if (rows.length > 0) setCache(cacheKey, rows, 1000 * 60 * 60);
  return rows;
}

async function fetchGlobalYearSnapshotsYearByYearLite(
  metricId: string,
  startYear: number,
  endYear: number
): Promise<Map<number, GlobalRow[]>> {
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  const concurrency = isServerlessRuntime() ? 6 : 8;
  const out = emptyYearMap(startYear, endYear);
  for (let i = 0; i < years.length; i += concurrency) {
    const chunk = years.slice(i, i + concurrency);
    const resolved = await Promise.all(
      chunk.map(async (year) => {
        try {
          const rows = await fetchGlobalYearSnapshotLite(metricId, year);
          return { year, rows };
        } catch {
          return { year, rows: [] as GlobalRow[] };
        }
      })
    );
    for (const { year, rows } of resolved) out.set(year, rows);
  }
  return out;
}

/**
 * One metric, one year — all economies (paginated WDI).
 * Merges secondary WDI code when defined; IMF WEO when `imfWeoIndicator` is set; UNESCO UIS when `uisIndicatorId` is set.
 */
export async function fetchGlobalYearSnapshot(metricId: string, year: number): Promise<GlobalRow[]> {
  const def = METRIC_BY_ID[metricId];
  if (!def) throw new Error(`Unknown metric: ${metricId}`);
  const cacheKey = `global:v10:${metricId}:${year}`;
  const cached = getCache<GlobalRow[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  const primary = await fetchGlobalIndicatorYear(def.worldBankCode, year);
  let rows = primary;
  if (def.fallbackWorldBankCode) {
    const fb = await fetchGlobalIndicatorYear(def.fallbackWorldBankCode, year);
    rows = mergeGlobalRows(primary, fb);
  }
  if (def.imfWeoIndicator) {
    try {
      rows = await enrichGlobalRowsWithImf(
        rows,
        def.imfWeoIndicator,
        year,
        def.imfWeoScale ?? 1
      );
    } catch (e) {
      console.error(
        `[WDI] IMF enrich failed for ${metricId} ${year}:`,
        e instanceof Error ? e.message : e
      );
    }
  }
  if (def.uisIndicatorId) {
    try {
      const uis = await fetchUisGlobalRowsForYear(def.uisIndicatorId, year);
      rows = mergeGlobalRows(
        rows,
        uis.map((r) => ({ countryIso3: r.countryIso3, countryName: r.countryName, value: r.value }))
      );
    } catch (e) {
      console.error(
        `[WDI] UIS enrich failed for ${metricId} ${year}:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  if (metricId === "gov_debt_usd") {
    try {
      rows = await enrichGlobalGovDebtUsd(rows, year);
    } catch (e) {
      console.error(
        `[WDI] gov debt USD enrich failed for ${year}:`,
        e instanceof Error ? e.message : e
      );
    }
  }
  if (metricId === "uhc_service_coverage") {
    try {
      // WDI series SH.UHC.SRVS.CV.XD is archived; WHO GHO remains the authoritative source.
      const who = await fetchWhoGhoGlobalRowsForYear("UHC_INDEX_REPORTED", year);
      rows = mergeGlobalRows(
        rows,
        who.map((r) => ({
          countryIso3: r.countryIso3,
          countryName: r.countryName,
          value: r.value,
        }))
      );
    } catch (e) {
      console.error(
        `[WHO] UHC enrich failed for ${year}:`,
        e instanceof Error ? e.message : e
      );
    }
  }
  if (metricId === "life_expectancy") {
    rows = await enrichFromSexPairAverage(rows, year, "SP.DYN.LE00.MA.IN", "SP.DYN.LE00.FE.IN");
  }
  if (metricId === "mortality_under5") {
    rows = await enrichFromSexPairAverage(rows, year, "SH.DYN.MORT.MA", "SH.DYN.MORT.FE");
  }

  setCache(cacheKey, rows, 1000 * 60 * 60);
  return rows;
}

function countNonNullGlobalRows(rows: GlobalRow[]): number {
  return rows.filter((r) => r.value !== null && Number.isFinite(r.value)).length;
}

const SNAPSHOT_TARGET_MIN_OBS = 50;
const SNAPSHOT_YEAR_FALLBACK_MAX_STEPS = isServerlessRuntime() ? 4 : 14;
const SNAPSHOT_FILL_MAX_STEPS = isServerlessRuntime() ? 3 : SNAPSHOT_YEAR_FALLBACK_MAX_STEPS;

/**
 * WDI “all economies” pages are often sparse for the latest calendar year(s).
 * Walk backward to the best recent year with enough non-null observations for a choropleth.
 */
export async function fetchGlobalSnapshotWithYearFallback(
  metricId: string,
  requestedYear: number
): Promise<{ dataYear: number; rows: GlobalRow[] }> {
  let y = resolveGlobalWdiYear(requestedYear);
  let rows = await fetchGlobalYearSnapshot(metricId, y);
  let bestY = y;
  let bestRows = rows;
  let bestN = countNonNullGlobalRows(rows);
  if (bestN >= SNAPSHOT_TARGET_MIN_OBS) {
    const filled = await fillMissingRowsWithCountryLatest(metricId, bestY, bestRows);
    return { dataYear: bestY, rows: filled };
  }
  for (let step = 0; step < SNAPSHOT_YEAR_FALLBACK_MAX_STEPS && y > MIN_DATA_YEAR; step++) {
    y -= 1;
    rows = await fetchGlobalYearSnapshot(metricId, y);
    const n = countNonNullGlobalRows(rows);
    if (n > bestN) {
      bestN = n;
      bestY = y;
      bestRows = rows;
    }
    if (bestN >= SNAPSHOT_TARGET_MIN_OBS) break;
  }
  const filled = await fillMissingRowsWithCountryLatest(metricId, bestY, bestRows);
  return { dataYear: bestY, rows: filled };
}

async function fillMissingRowsWithCountryLatest(
  metricId: string,
  baseYear: number,
  rows: GlobalRow[]
): Promise<GlobalRow[]> {
  const byIso = new Map<string, GlobalRow>();
  for (const r of rows) byIso.set(r.countryIso3.toUpperCase(), { ...r });

  const unresolved = () =>
    [...byIso.values()].filter((r) => r.value === null || Number.isNaN(r.value)).length;

  // Ensure every known country appears in the snapshot row-set so map/table coverage
  // can be reconciled against per-country series (dashboard path).
  const countries = await listCountries().catch(() => []);
  for (const c of countries) {
    const iso = c.cca3.toUpperCase();
    if (!byIso.has(iso)) {
      byIso.set(iso, { countryIso3: iso, countryName: c.name, value: null });
    }
  }

  if (unresolved() === 0) return [...byIso.values()];

  let y = baseYear - 1;
  let steps = 0;
  while (y >= MIN_DATA_YEAR && steps < SNAPSHOT_FILL_MAX_STEPS && unresolved() > 0) {
    const prevRows = await fetchGlobalYearSnapshot(metricId, y);
    for (const prev of prevRows) {
      if (prev.value === null || Number.isNaN(prev.value)) continue;
      const iso = prev.countryIso3.toUpperCase();
      const cur = byIso.get(iso);
      if (!cur) {
        byIso.set(iso, { ...prev });
        continue;
      }
      if (cur.value === null || Number.isNaN(cur.value)) {
        byIso.set(iso, { ...cur, value: prev.value, countryName: cur.countryName || prev.countryName });
      }
    }
    y -= 1;
    steps += 1;
  }

  // Final reconciliation: use each country's latest available value from the same
  // metric series pipeline used by dashboard country pages.
  const pending = [...byIso.values()]
    .filter((r) => r.value === null || Number.isNaN(r.value))
    .map((r) => r.countryIso3.toUpperCase());
  if (pending.length > 0) {
    const latestByIso = await fillMissingViaCountrySeries(metricId, baseYear, pending);
    for (const iso of pending) {
      const v = latestByIso.get(iso);
      if (v === undefined || v === null || Number.isNaN(v)) continue;
      const cur = byIso.get(iso);
      if (!cur) continue;
      byIso.set(iso, { ...cur, value: v });
    }
  }

  return [...byIso.values()];
}

function latestNonNullValue(
  points: Array<{ year: number; value: number | null; provenance?: string }>
): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    const v = p?.value;
    // Global map/table must avoid synthetic world-proxy values for country accuracy.
    if (p?.provenance === "wld_proxy") continue;
    if (v !== null && v !== undefined && Number.isFinite(v)) return v;
  }
  return null;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fillMissingViaCountrySeries(
  metricId: string,
  endYear: number,
  countryIso3s: string[]
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const cacheKey = `global:country-latest:v1:${metricId}:${endYear}:${countryIso3s.sort().join(",")}`;
  const cached = getCache<Array<[string, number | null]>>(cacheKey);
  if (cached) return new Map(cached);

  const concurrency = 8;
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= countryIso3s.length) return;
      const iso = countryIso3s[i]!;
      try {
        const bundle = await withTimeout(
          fetchCountryBundle(iso, [metricId], MIN_DATA_YEAR, endYear),
          20000,
          { [metricId]: [] as Array<{ year: number; value: number | null; provenance?: string }> }
        );
        out.set(iso, latestNonNullValue(bundle[metricId] ?? []));
      } catch {
        out.set(iso, null);
      }
    }
  };
  await Promise.all(new Array(Math.min(concurrency, countryIso3s.length)).fill(0).map(worker));
  setCache(cacheKey, [...out.entries()], 1000 * 60 * 30);
  return out;
}
