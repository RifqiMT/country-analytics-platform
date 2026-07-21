import { getCache, setCache } from "./cache.js";
import { fetchWithRetry } from "./httpClient.js";
import type { SeriesPoint } from "./series.js";
import { currentDataYear, MIN_DATA_YEAR } from "./yearBounds.js";
import { canonicalWbIso3 } from "./wdiParse.js";

const IMF_DATAMAPPER = "https://www.imf.org/external/datamapper/api/v1";

/** IMF DataMapper uses ISO 3-letter codes; a few differ from common WB/REST usage */
const IMF_COUNTRY_CODE: Record<string, string> = {
  // World Bank / REST "ROM" is historical; modern Romania is ROU everywhere relevant
  ROM: "ROU",
};

function buildPeriodsParam(startYear: number, endYear: number): string {
  const parts: string[] = [];
  for (let y = startYear; y <= endYear; y++) parts.push(String(y));
  return parts.join(",");
}

function parseImfSeries(
  raw: unknown,
  indicator: string,
  imfCountry: string,
  startYear: number,
  endYear: number
): SeriesPoint[] {
  if (!raw || typeof raw !== "object") return [];
  const values = (raw as { values?: Record<string, Record<string, Record<string, number>>> }).values;
  const byYear = values?.[indicator]?.[imfCountry];
  if (!byYear || typeof byYear !== "object") return [];
  const out: SeriesPoint[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const key = String(y);
    const v: unknown = byYear[key];
    let n: number | null = null;
    if (typeof v === "number" && Number.isFinite(v)) n = v;
    else if (typeof v === "string") {
      const t = v.trim();
      if (t !== "" && t !== "..") {
        const p = Number(t);
        if (Number.isFinite(p)) n = p;
      }
    }
    out.push({ year: y, value: n });
  }
  return out;
}

/**
 * IMF WEO series via public DataMapper JSON API (GGXWDG_NGDP = general government gross debt, % of GDP).
 */
export async function fetchImfWeoSeries(
  countryIso3: string,
  indicator: string,
  startYear = MIN_DATA_YEAR,
  endYear = currentDataYear()
): Promise<SeriesPoint[]> {
  const iso = canonicalWbIso3(countryIso3.toUpperCase());
  const imfCountry = IMF_COUNTRY_CODE[iso] ?? iso;
  const periods = buildPeriodsParam(startYear, endYear);
  const cacheKey = `imf:${indicator}:${imfCountry}:${startYear}:${endYear}`;
  const cached = getCache<SeriesPoint[]>(cacheKey);
  if (cached) return cached;

  const url = `${IMF_DATAMAPPER}/${encodeURIComponent(indicator)}/${encodeURIComponent(
    imfCountry
  )}?periods=${encodeURIComponent(periods)}`;
  const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const empty = parseImfSeries({}, indicator, imfCountry, startYear, endYear);
    setCache(cacheKey, empty, 1000 * 60 * 30);
    return empty;
  }
  const raw = (await res.json()) as unknown;
  const series = parseImfSeries(raw, indicator, imfCountry, startYear, endYear);
  setCache(cacheKey, series, 1000 * 60 * 60 * 12);
  return series;
}

/**
 * Bulk IMF DataMapper values for one indicator and calendar year (all economies in one request).
 * Prefer this over per-country calls when filling global tables/snapshots.
 */
export async function fetchImfWeoGlobalYearMap(
  indicator: string,
  year: number,
  scale = 1
): Promise<Map<string, number>> {
  const range = await fetchImfWeoGlobalRangeMatrix(indicator, year, year, scale);
  return range.get(year) ?? new Map();
}

/**
 * Bulk IMF DataMapper values for one indicator across a year span (all economies, one HTTP request).
 */
export async function fetchImfWeoGlobalRangeMatrix(
  indicator: string,
  startYear: number,
  endYear: number,
  scale = 1
): Promise<Map<number, Map<string, number>>> {
  const lo = Math.min(startYear, endYear);
  const hi = Math.max(startYear, endYear);
  const cacheKey = `imf:global:range:${indicator}:${lo}:${hi}:${scale}`;
  const cached = getCache<Array<[number, Array<[string, number]>]>>(cacheKey);
  if (cached) {
    return new Map(cached.map(([y, pairs]) => [y, new Map(pairs)] as const));
  }

  const periods = buildPeriodsParam(lo, hi);
  const url = `${IMF_DATAMAPPER}/${encodeURIComponent(indicator)}?periods=${encodeURIComponent(periods)}`;
  const out = new Map<number, Map<string, number>>();
  for (let y = lo; y <= hi; y++) out.set(y, new Map());

  try {
    const res = await fetchWithRetry(
      url,
      { headers: { Accept: "application/json" } },
      { attempts: 3, baseDelayMs: 400, timeoutMs: 30_000 }
    );
    if (!res.ok) {
      setCache(cacheKey, [], 1000 * 60 * 30);
      return out;
    }
    const raw = (await res.json()) as {
      values?: Record<string, Record<string, Record<string, number | string>>>;
    };
    const byCountry = raw.values?.[indicator];
    if (!byCountry || typeof byCountry !== "object") {
      setCache(cacheKey, [], 1000 * 60 * 30);
      return out;
    }
    for (const [imfCode, years] of Object.entries(byCountry)) {
      if (!years || typeof years !== "object") continue;
      const iso = canonicalWbIso3(imfCode.toUpperCase());
      if (!/^[A-Z]{3}$/.test(iso)) continue;
      for (let y = lo; y <= hi; y++) {
        const v: unknown = years[String(y)];
        let n: number | null = null;
        if (typeof v === "number" && Number.isFinite(v)) n = v;
        else if (typeof v === "string") {
          const t = v.trim();
          if (t !== "" && t !== "..") {
            const p = Number(t);
            if (Number.isFinite(p)) n = p;
          }
        }
        if (n === null) continue;
        out.get(y)!.set(iso, n * scale);
      }
    }
    setCache(
      cacheKey,
      [...out.entries()].map(([y, m]) => [y, [...m.entries()]] as [number, Array<[string, number]>]),
      1000 * 60 * 60 * 6
    );
    return out;
  } catch (e) {
    console.error(
      `[IMF] global range matrix failed for ${indicator} ${lo}:${hi}:`,
      e instanceof Error ? e.message : e
    );
    setCache(cacheKey, [], 1000 * 60 * 15);
    return out;
  }
}
