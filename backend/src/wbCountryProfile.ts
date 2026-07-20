import { getCache, setCache } from "./cache.js";
import { fetchWithRetry } from "./httpClient.js";

/** World Bank Country API — same ISO3 universe as WDI; used for operational income & lending groups. */
export interface WbCountryProfile {
  iso3: string;
  name: string;
  capitalCity: string;
  region: string;
  /** Human-readable label, e.g. "High income" (from `incomeLevel.value`). */
  incomeLevel: string;
  /** Stable WB code: LIC, LMC, UMC, HIC, INX, etc. */
  incomeLevelId: string;
  lendingType: string;
  /** WB lending group code (IDA, IBRD, Blend, …). */
  lendingTypeId: string;
  latitude: string;
  longitude: string;
}

function parse(raw: unknown): WbCountryProfile | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const row = (raw[1] as unknown[])[0];
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const id = o.id;
  if (typeof id !== "string") return null;
  const regionObj = o.region;
  const region =
    regionObj && typeof regionObj === "object" && "value" in regionObj
      ? String((regionObj as { value?: string }).value ?? "")
      : "";
  const inc = o.incomeLevel;
  const incomeLevel =
    inc && typeof inc === "object" && "value" in inc
      ? String((inc as { value?: string }).value ?? "")
      : "";
  const incomeLevelId =
    inc && typeof inc === "object" && "id" in inc
      ? String((inc as { id?: string }).id ?? "")
      : "";
  const lend = o.lendingType;
  const lendingType =
    lend && typeof lend === "object" && "value" in lend
      ? String((lend as { value?: string }).value ?? "")
      : "";
  const lendingTypeId =
    lend && typeof lend === "object" && "id" in lend
      ? String((lend as { id?: string }).id ?? "")
      : "";
  return {
    iso3: id,
    name: String(o.name ?? id),
    capitalCity: String(o.capitalCity ?? ""),
    region,
    incomeLevel,
    incomeLevelId,
    lendingType,
    lendingTypeId,
    latitude: String(o.latitude ?? ""),
    longitude: String(o.longitude ?? ""),
  };
}

export async function fetchWbCountryProfile(iso3: string): Promise<WbCountryProfile | null> {
  const key = `wbcountry:v2:${iso3}`;
  const cached = getCache<WbCountryProfile | null>(key);
  if (cached !== undefined) return cached;
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(iso3)}?format=json`;
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    setCache(key, null, 1000 * 60 * 5);
    return null;
  }
  const raw = (await res.json()) as unknown;
  const profile = parse(raw);
  setCache(key, profile, 1000 * 60 * 60 * 12);
  return profile;
}
