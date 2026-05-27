import { getCache, setCache } from "./cache.js";
import { fetchWithRetry } from "./httpClient.js";

export interface CountrySummary {
  cca3: string;
  name: string;
  /** REST Countries `name.official` — used to match map labels (e.g. United States of America). */
  nameOfficial?: string;
  region: string;
  subregion: string;
  capital: string[];
  population: number;
  area: number;
  latlng: [number, number];
  /** Representative IANA timezone derived from lat/lng (handles DST). */
  ianaTimezone?: string;
  flags: { png?: string; svg?: string };
  timezones: string[];
  currencies: string[];
  /** Political system label (REST Countries and/or Wikidata enrichment) */
  government?: string;
  /** Head-of-government office label (Wikidata), e.g. President */
  headOfGovernmentTitle?: string;
  /** UN M.49 numeric code (string), used for EEZ lookups */
  ccn3?: string;
  landlocked?: boolean;
  /** First currency formatted for display */
  currencyDisplay?: string;
  /** ISO 3166-1 alpha-2 — used for flag emoji / map hover patterns */
  cca2?: string;
}

const REST_BASE = "https://restcountries.com/v3.1/all";
const COUNTRIES_CACHE_KEY = "restcountries:v3.1:all:v11-cca2-fallback";
const COUNTRIES_BACKUP_CACHE_KEY = "restcountries:v3.1:all:backup:v11";

/** REST Countries v3.1 returns 400 if `fields` lists more than 10 names */
const FIELDS_MAIN =
  "cca3,name,region,subregion,capital,population,area,latlng,flags,currencies";
const FIELDS_EXTRA = "cca3,timezones,government";
const FIELDS_GEO = "cca3,ccn3,landlocked";
const FIELDS_CCA2 = "cca3,cca2";

async function fetchCountriesChunk(fields: string): Promise<unknown[]> {
  const url = `${REST_BASE}?fields=${fields}`;
  const res = await fetchWithRetry(url, {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`REST Countries: response was not JSON (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : text.slice(0, 240);
    throw new Error(`REST Countries HTTP ${res.status}${msg ? `: ${msg}` : ""}`);
  }
  if (!Array.isArray(body)) throw new Error("REST Countries: expected a JSON array of countries");
  return body;
}

function mergeCountryRows(main: unknown[], extra: unknown[], geo: unknown[], cca2chunk: unknown[]): unknown[] {
  const byCca = new Map<string, Record<string, unknown>>();
  for (const row of main) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const c = o.cca3;
    if (typeof c === "string" && c.length === 3) byCca.set(c, { ...o });
  }
  for (const row of extra) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const c = o.cca3;
    if (typeof c !== "string") continue;
    const base = byCca.get(c);
    if (!base) continue;
    if ("timezones" in o) base.timezones = o.timezones;
    if ("government" in o && o.government !== undefined) base.government = o.government;
  }
  for (const row of geo) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const c = o.cca3;
    if (typeof c !== "string") continue;
    const base = byCca.get(c);
    if (!base) continue;
    if ("ccn3" in o && o.ccn3 !== undefined) base.ccn3 = o.ccn3;
    if ("landlocked" in o && o.landlocked !== undefined) base.landlocked = o.landlocked;
  }
  for (const row of cca2chunk) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const c = o.cca3;
    if (typeof c !== "string") continue;
    const base = byCca.get(c);
    if (!base) continue;
    const a2 = o.cca2;
    if (typeof a2 === "string" && /^[A-Za-z]{2}$/.test(a2)) base.cca2 = a2.toUpperCase();
  }
  return [...byCca.values()];
}

function normalize(raw: unknown): CountrySummary[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const cca3 = o.cca3;
      if (typeof cca3 !== "string" || cca3.length !== 3) return null;
      const nameObj = o.name;
      const name =
        nameObj && typeof nameObj === "object" && typeof (nameObj as { common?: string }).common === "string"
          ? (nameObj as { common: string }).common
          : String(cca3);
      const nameOfficial =
        nameObj && typeof nameObj === "object" && typeof (nameObj as { official?: string }).official === "string"
          ? (nameObj as { official: string }).official
          : undefined;
      const cur = o.currencies as Record<string, { name?: string; symbol?: string }> | undefined;
      const currencyCodes =
        cur && typeof cur === "object"
          ? Object.keys(cur).filter((k) => /^[A-Z]{3}$/.test(k))
          : [];
      let currencyDisplay: string | undefined;
      if (cur && typeof cur === "object") {
        const entry = Object.entries(cur).find(([k]) => /^[A-Z]{3}$/.test(k));
        if (entry) {
          const [code, meta] = entry;
          const name = meta?.name ?? code;
          const sym = meta?.symbol ?? "";
          currencyDisplay = sym ? `${name} (${sym}) · ${code}` : `${name} · ${code}`;
        }
      }
      const gov = o.government;
      const latlng: [number, number] =
        Array.isArray(o.latlng) && o.latlng.length >= 2
          ? [Number(o.latlng[0]), Number(o.latlng[1])]
          : [0, 0];
      const row: CountrySummary = {
        cca3,
        name,
        region: typeof o.region === "string" ? o.region : "",
        subregion: typeof o.subregion === "string" ? o.subregion : "",
        capital: Array.isArray(o.capital) ? (o.capital as string[]) : [],
        population: typeof o.population === "number" ? o.population : 0,
        area: typeof o.area === "number" ? o.area : 0,
        latlng,
        flags:
          o.flags && typeof o.flags === "object"
            ? (o.flags as { png?: string; svg?: string })
            : {},
        timezones: Array.isArray(o.timezones) ? (o.timezones as string[]) : [],
        currencies: currencyCodes,
      };
      if (typeof gov === "string" && gov.length > 0) row.government = gov;
      const ccn3 = o.ccn3;
      if (typeof ccn3 === "string" && ccn3.length > 0) row.ccn3 = ccn3;
      else if (typeof ccn3 === "number" && Number.isFinite(ccn3)) row.ccn3 = String(ccn3);
      if (typeof o.landlocked === "boolean") row.landlocked = o.landlocked;
      if (currencyDisplay) row.currencyDisplay = currencyDisplay;
      if (nameOfficial) row.nameOfficial = nameOfficial;
      const cca2m = o.cca2;
      if (typeof cca2m === "string" && /^[A-Za-z]{2}$/.test(cca2m)) row.cca2 = cca2m.toUpperCase();
      return row;
    })
    .filter((x): x is CountrySummary => x !== null);
}

export async function listCountries(): Promise<CountrySummary[]> {
  const cached = getCache<CountrySummary[]>(COUNTRIES_CACHE_KEY);
  if (cached) return cached;
  const backup = getCache<CountrySummary[]>(COUNTRIES_BACKUP_CACHE_KEY);

  try {
    const [main, extra, geo, cca2chunk] = await Promise.all([
      fetchCountriesChunk(FIELDS_MAIN),
      fetchCountriesChunk(FIELDS_EXTRA),
      fetchCountriesChunk(FIELDS_GEO),
      fetchCountriesChunk(FIELDS_CCA2),
    ]);
    const merged = mergeCountryRows(main, extra, geo, cca2chunk);
    const list = normalize(merged);
    if (list.length > 0) {
      setCache(COUNTRIES_CACHE_KEY, list, 1000 * 60 * 60 * 6);
      setCache(COUNTRIES_BACKUP_CACHE_KEY, list, 1000 * 60 * 60 * 24 * 30);
      return list;
    }
    throw new Error("REST Countries merged result empty");
  } catch {
    try {
      const list = await fetchCountriesAllFallback();
      if (list.length > 0) {
        setCache(COUNTRIES_CACHE_KEY, list, 1000 * 60 * 30);
        setCache(COUNTRIES_BACKUP_CACHE_KEY, list, 1000 * 60 * 60 * 24 * 30);
        return list;
      }
      throw new Error("REST Countries /all fallback empty");
    } catch {
      try {
        const wb = await fetchCountriesFromWorldBankFallback();
        if (wb.length > 0) {
          setCache(COUNTRIES_CACHE_KEY, wb, 1000 * 60 * 30);
          setCache(COUNTRIES_BACKUP_CACHE_KEY, wb, 1000 * 60 * 60 * 24 * 30);
          return wb;
        }
      } catch {
        // fall through to backup
      }
      if (backup && backup.length > 0) {
        setCache(COUNTRIES_CACHE_KEY, backup, 1000 * 60 * 5);
        return backup;
      }
      throw new Error("Country directory unavailable from upstreams");
    }
  }
}

export async function getCountry(cca3: string): Promise<CountrySummary | undefined> {
  const all = await listCountries();
  return all.find((c) => c.cca3 === cca3.toUpperCase());
}

export async function fetchCountryByIso3Direct(cca3: string): Promise<CountrySummary | null> {
  const iso = String(cca3 ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(iso)) return null;
  const url = `https://restcountries.com/v3.1/alpha/${encodeURIComponent(iso)}`;
  const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body) || body.length === 0) return null;
  const rows = normalize(body);
  return rows[0] ?? null;
}

async function fetchCountriesAllFallback(): Promise<CountrySummary[]> {
  const res = await fetchWithRetry(REST_BASE, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`REST Countries /all HTTP ${res.status}`);
  const body = (await res.json()) as unknown;
  return normalize(body);
}

async function fetchCountriesFromWorldBankFallback(): Promise<CountrySummary[]> {
  const url = "https://api.worldbank.org/v2/country?format=json&per_page=400";
  const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`World Bank country directory HTTP ${res.status}`);
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body) || body.length < 2 || !Array.isArray(body[1])) return [];
  const rows = body[1] as Array<Record<string, unknown>>;
  const out: CountrySummary[] = [];
  for (const row of rows) {
    const cca3 = String(row.id ?? "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(cca3)) continue;
    const regionObj = row.region as { value?: unknown } | undefined;
    const region = String(regionObj?.value ?? "").trim();
    if (!region || /^aggregates?$/i.test(region)) continue;
    const cca2raw = String(row.iso2Code ?? "").toUpperCase();
    const cca2 = /^[A-Z]{2}$/.test(cca2raw) ? cca2raw : undefined;
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    out.push({
      cca3,
      cca2,
      name: String(row.name ?? cca3),
      region,
      subregion: "",
      capital: String(row.capitalCity ?? "").trim() ? [String(row.capitalCity)] : [],
      population: 0,
      area: 0,
      latlng: [Number.isFinite(lat) ? lat : 0, Number.isFinite(lng) ? lng : 0],
      flags:
        cca2 != null
          ? {
              png: `https://flagcdn.com/w320/${cca2.toLowerCase()}.png`,
              svg: `https://flagcdn.com/${cca2.toLowerCase()}.svg`,
            }
          : {},
      timezones: [],
      currencies: [],
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
