import { getCache, setCache } from "./cache.js";
import { fetchWithRetry, OUTBOUND_USER_AGENT } from "./httpClient.js";
import { canonicalWbIso3 } from "./wdiParse.js";

const GHO_BASE = "https://ghoapi.azureedge.net/api";

export type WhoGhoGlobalRow = {
  countryIso3: string;
  countryName: string;
  value: number | null;
};

/**
 * Bulk year fetch from WHO Global Health Observatory OData API (all COUNTRY spatial dims).
 * Used when a WDI series is archived (e.g. UHC service coverage index).
 */
export async function fetchWhoGhoGlobalRowsForYear(
  indicatorCode: string,
  year: number
): Promise<WhoGhoGlobalRow[]> {
  const matrix = await fetchWhoGhoGlobalMatrixForYears(indicatorCode, [year]);
  const byIso = matrix.get(year) ?? new Map();
  return [...byIso.entries()].map(([iso, value]) => ({
    countryIso3: iso,
    countryName: iso,
    value,
  }));
}

/** Fetch multiple years with bounded concurrency; returns year → iso3 → value. */
export async function fetchWhoGhoGlobalMatrixForYears(
  indicatorCode: string,
  years: number[]
): Promise<Map<number, Map<string, number>>> {
  const uniqueYears = [...new Set(years)].filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
  const out = new Map<number, Map<string, number>>();
  const concurrency = 3;
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= uniqueYears.length) return;
      const year = uniqueYears[i]!;
      const rows = await fetchWhoGhoYearOnce(indicatorCode, year);
      const m = new Map<string, number>();
      for (const r of rows) {
        if (r.value !== null && Number.isFinite(r.value)) m.set(r.countryIso3, r.value);
      }
      out.set(year, m);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, uniqueYears.length)) }, () => worker())
  );
  return out;
}

async function fetchWhoGhoYearOnce(
  indicatorCode: string,
  year: number
): Promise<WhoGhoGlobalRow[]> {
  const cacheKey = `who:gho:${indicatorCode}:${year}`;
  const cached = getCache<WhoGhoGlobalRow[]>(cacheKey);
  if (cached) return cached;

  const filter = encodeURIComponent(
    `TimeDim eq ${year} and SpatialDimType eq 'COUNTRY'`
  );
  const url = `${GHO_BASE}/${encodeURIComponent(indicatorCode)}?$filter=${filter}`;
  try {
    const res = await fetchWithRetry(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": OUTBOUND_USER_AGENT,
        },
      },
      { attempts: 3, baseDelayMs: 400, timeoutMs: 18_000 }
    );
    if (!res.ok) {
      setCache(cacheKey, [], 1000 * 60 * 30);
      return [];
    }
    const j = (await res.json()) as {
      value?: Array<{
        SpatialDim?: string;
        NumericValue?: number | null;
        Value?: string | number | null;
      }>;
    };
    const byIso = new Map<string, WhoGhoGlobalRow>();
    for (const r of j.value ?? []) {
      const raw = r.SpatialDim;
      if (!raw || typeof raw !== "string") continue;
      const iso = canonicalWbIso3(raw.toUpperCase());
      if (!/^[A-Z]{3}$/.test(iso)) continue;
      let n: number | null = null;
      if (typeof r.NumericValue === "number" && Number.isFinite(r.NumericValue)) {
        n = r.NumericValue;
      } else if (typeof r.Value === "number" && Number.isFinite(r.Value)) {
        n = r.Value;
      } else if (typeof r.Value === "string" && r.Value.trim() !== "") {
        const p = Number(r.Value);
        if (Number.isFinite(p)) n = p;
      }
      if (n === null) continue;
      if (!byIso.has(iso)) {
        byIso.set(iso, { countryIso3: iso, countryName: iso, value: n });
      }
    }
    const out = [...byIso.values()];
    setCache(cacheKey, out, 1000 * 60 * 60 * 6);
    return out;
  } catch (e) {
    console.error(
      `[WHO GHO] fetch failed for ${indicatorCode} ${year}:`,
      e instanceof Error ? e.message : e
    );
    setCache(cacheKey, [], 1000 * 60 * 15);
    return [];
  }
}
