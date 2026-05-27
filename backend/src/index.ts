import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import countryToCurrency from "country-to-currency";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Load `.env` from likely locations; `override: true` so values win over empty exported vars in the shell. */
const ENV_CANDIDATES = [
  resolve(process.cwd(), ".env"),
  resolve(__dirname, "../.env"),
  resolve(__dirname, "../../.env"),
];
for (const p of ENV_CANDIDATES) {
  if (existsSync(p)) dotenv.config({ path: p, override: true });
}
if (!process.env.GROQ_API_KEY?.trim()) {
  const tried = ENV_CANDIDATES.filter((p) => existsSync(p));
  console.warn(
    `[cap-backend] GROQ_API_KEY is unset after loading .env (tried: ${tried.length ? tried.join(", ") : "no files found"}). PESTEL/Porter/Assistant use data-only scaffolds.`
  );
}
import cors from "cors";
import express from "express";
import { METRICS, METRIC_BY_ID } from "./metrics.js";
import { listCountries, getCountry, fetchCountryByIso3Direct, type CountrySummary } from "./restCountries.js";
import { fetchEnrichedCountryMeta } from "./countryMetaEnrichment.js";
import { fetchWikidataCountryEnrichment } from "./wikidataCountryProfile.js";
import { fetchSeaAroundUsEezAreaKm2 } from "./seaAroundUsEez.js";
import { EEZ_SQKM_FALLBACK } from "./eezSqKmFallback.js";
import { fetchCountryBundle, fetchMetricSeriesForCountry, fetchIndicatorSeries, allMetricIds } from "./worldBank.js";
import type { SeriesPoint } from "./series.js";
import { fetchGlobalSnapshotWithYearFallback } from "./globalSnapshot.js";
import {
  groqChatWithFallbackForUseCase,
  tavilySearch,
  utcDateDaysAgo,
  utcDateISO,
} from "./llm.js";
import {
  buildPovertyInternationalVsNationalTable,
  tavilyAssistantFallbackReply,
} from "./assistantTavilyFallback.js";
import { clearAllCache, getCache, setCache } from "./cache.js";
import { resetDataWarmupGate, startDataWarmup } from "./dataWarmup.js";
import { fetchWbCountryProfile } from "./wbCountryProfile.js";
import { buildDashboardComparison } from "./dashboardComparison.js";
import { buildGlobalTable, type TableCategory } from "./globalTable.js";
import {
  buildDataOnlyPestel,
  buildPestelLlmDigest,
  mergePestelAnalysis,
  parsePestelAnalysisFromLlm,
  type PestelAnalysis,
} from "./pestelAnalysis.js";
import {
  pestelAllowedDataYearsHint,
  sanitizePestelPartial,
  validatePestelAnalysisGrounding,
} from "./pestelGrounding.js";
import {
  buildPartialPestelFromTavilyWeb,
  fetchPestelSwotPartialFromTavily,
  mergePestelPartials,
  PESTEL_CREDIBLE_DOMAINS,
  truncatePestelSourceBForLlm,
} from "./pestelTavily.js";
import {
  buildDataOnlyPorter,
  mergePorterAnalysis,
  parsePorterFromLlm,
  type PorterAnalysis,
  type PorterForce,
} from "./porterAnalysis.js";
import { fetchPorterTemporalHorizonWeb, PORTER_TEMPORAL_SECTION_MARKER } from "./porterTavily.js";
import { ILO_ISIC_DIVISIONS } from "./iloIsicDivisions.js";
import { computeCorrelationGlobal } from "./correlationGlobal.js";
import tzLookup from "tz-lookup";
import { getMetricShortLabel } from "./metricShortLabels.js";
import {
  MIN_DATA_YEAR,
  clampYear,
  clampYearRange,
  currentDataYear,
  resolveGlobalWdiYear,
} from "./yearBounds.js";
import { listDataProvidersResponse } from "./dataProviders.js";
import { buildAssistantRankingPayload, looksLikeGlobalRankingQuery } from "./assistantRankingBlock.js";
import {
  ASSISTANT_MAX_COMPARISON_COUNTRIES,
  buildAssistantWebSearchQuery,
  classifyAssistantIntent,
  extractComparisonCca3s,
  extractCountryCodesMentionedInText,
  finalizeComparisonCodes,
  groqTemperatureForIntent,
  intentPrefersWebFirst,
  isWebSearchContextThin,
  looksLikePovertyInternationalVsNationalComparison,
  questionInvokesFocusCountryPlatformMetrics,
  questionIsSensitiveCountryFact,
  questionLooksMetricAnchored,
  questionNeedsLiveWebVerification,
  shouldSkipTavilyForPlatformFirst,
  type AssistantIntent,
} from "./assistantIntel.js";
import { stripRedundantRankingTablesFromLlmMarkdown } from "./assistantReplyTableDedupe.js";
import { polishAssistantLlmReply } from "./assistantReplyPolish.js";
import { compactAssistantRetrievalForLlm } from "./assistantCitationContext.js";
import { clampAssistantUserForLlm } from "./assistantPromptBudget.js";

export const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

function firstHeaderValue(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function readRequestApiKey(req: express.Request, kind: "groq" | "tavily"): string | undefined {
  const headerName = kind === "groq" ? "x-user-groq-api-key" : "x-user-tavily-api-key";
  const bodyName = kind === "groq" ? "groqApiKey" : "tavilyApiKey";
  const fromHeader = firstHeaderValue(req.headers[headerName]);
  if (typeof fromHeader === "string" && fromHeader.trim().length > 0) return fromHeader.trim();
  const fromBody = req.body?.[bodyName];
  if (typeof fromBody === "string" && fromBody.trim().length > 0) return fromBody.trim();
  return undefined;
}

async function settleWithin<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const guarded = promise.catch(() => fallback);
  try {
    return await Promise.race<T>([
      guarded,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchCountriesFromWorldBankDirectory(): Promise<CountrySummary[]> {
  const key = "wb:country-directory:v1";
  const cached = getCache<CountrySummary[]>(key);
  if (cached && cached.length > 0) return cached;
  const url = "https://api.worldbank.org/v2/country?format=json&per_page=400";
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw) || raw.length < 2 || !Array.isArray(raw[1])) return [];
    const rows = raw[1] as Array<Record<string, unknown>>;
    const out: CountrySummary[] = [];
    for (const r of rows) {
      const iso3 = String(r.id ?? "").toUpperCase();
      if (!/^[A-Z]{3}$/.test(iso3)) continue;
      const regionObj = r.region as { value?: unknown } | undefined;
      const region = String(regionObj?.value ?? "").trim();
      if (!region || /^aggregates?$/i.test(region)) continue;
      const iso2 = String(r.iso2Code ?? "").toUpperCase();
      const cca2 = /^[A-Z]{2}$/.test(iso2) ? iso2 : undefined;
      const lat = Number(r.latitude);
      const lng = Number(r.longitude);
      out.push({
        cca3: iso3,
        cca2,
        name: String(r.name ?? iso3),
        region,
        subregion: "",
        capital: String(r.capitalCity ?? "").trim() ? [String(r.capitalCity)] : [],
        population: 0,
        area: 0,
        latlng: [Number.isFinite(lat) ? lat : 0, Number.isFinite(lng) ? lng : 0],
        flags: cca2
          ? {
              png: `https://flagcdn.com/w320/${cca2.toLowerCase()}.png`,
              svg: `https://flagcdn.com/${cca2.toLowerCase()}.svg`,
            }
          : {},
        timezones: [],
        currencies: [],
      });
    }
    const sorted = out.sort((a, b) => a.name.localeCompare(b.name));
    if (sorted.length > 0) setCache(key, sorted, 1000 * 60 * 60 * 24);
    return sorted;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

type UsdFxSnapshot = {
  /** ISO currency code quoted against USD (or LCU fallback label). */
  target: string;
  /** 1 USD = rate target currency units. */
  rate: number;
  /** Upstream rate date in YYYY-MM-DD, when available. */
  asOf?: string;
  /** Institution/provider used for the returned rate. */
  source: string;
} | null;

type WbUsdFxSnapshot = {
  /** PA.NUS.FCRF yearly official rate (LCU per USD). */
  rate: number;
  /** Year represented by the official rate. */
  year: number;
} | null;

async function fetchWbOfficialUsdFxLatest(iso3: string): Promise<WbUsdFxSnapshot> {
  const countryIso = String(iso3 ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(countryIso)) return null;
  const key = `fx:wb:usd:${countryIso}:v1`;
  const cached = getCache<WbUsdFxSnapshot>(key);
  if (cached && cached.rate > 0) return cached;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(
      countryIso
    )}/indicator/PA.NUS.FCRF?format=json&per_page=80`;
    const res = await fetch(url, { signal: ac.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw) || raw.length < 2 || !Array.isArray(raw[1])) return null;
    const rows = raw[1] as Array<{ date?: unknown; value?: unknown }>;
    for (const row of rows) {
      const year = Number(row.date);
      const rate = Number(row.value);
      if (!Number.isFinite(year) || !Number.isFinite(rate) || rate <= 0) continue;
      const out: WbUsdFxSnapshot = { rate, year };
      // WB official FX is annual; cache daily refresh is enough.
      setCache(key, out, 1000 * 60 * 60 * 24);
      return out;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUsdFxSnapshot(targetCurrency: string, iso3: string): Promise<UsdFxSnapshot> {
  const target = String(targetCurrency ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(target) || target === "USD") {
    return target === "USD" ? { target: "USD", rate: 1, asOf: undefined, source: "Identity (USD)" } : null;
  }
  const key = `fx:usd:${target}:v1`;
  const cached = getCache<UsdFxSnapshot>(key);
  if (cached && cached.rate > 0) return cached;
  const wbOfficial = await settleWithin(fetchWbOfficialUsdFxLatest(iso3), 7000, null);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 7000);
  try {
    const url = `https://api.frankfurter.app/latest?from=USD&to=${encodeURIComponent(target)}`;
    const res = await fetch(url, { signal: ac.signal, headers: { Accept: "application/json" } });
    if (!res.ok) {
      if (wbOfficial?.rate) {
        return {
          target,
          rate: wbOfficial.rate,
          asOf: `${wbOfficial.year}-12-31`,
          source: "World Bank PA.NUS.FCRF",
        };
      }
      return null;
    }
    const raw = (await res.json()) as { date?: unknown; rates?: Record<string, unknown> } | null;
    const rateCandidate = raw?.rates?.[target];
    const rate = Number(rateCandidate);
    if (!Number.isFinite(rate) || rate <= 0) {
      if (wbOfficial?.rate) {
        return {
          target,
          rate: wbOfficial.rate,
          asOf: `${wbOfficial.year}-12-31`,
          source: "World Bank PA.NUS.FCRF",
        };
      }
      return null;
    }
    const asOf = typeof raw?.date === "string" && raw.date.trim() ? raw.date.trim() : undefined;
    // Guard against occasional outlier/inverted quotes by comparing to WB official annual series.
    if (wbOfficial?.rate && wbOfficial.rate > 0) {
      const deviation = Math.abs(rate - wbOfficial.rate) / wbOfficial.rate;
      if (deviation > 0.6) {
        return {
          target,
          rate: wbOfficial.rate,
          asOf: `${wbOfficial.year}-12-31`,
          source: "World Bank PA.NUS.FCRF (sanity fallback)",
        };
      }
    }
    const out: UsdFxSnapshot = { target, rate, asOf, source: "ECB via Frankfurter" };
    // Cache for 6 hours to reduce external API pressure while keeping rates fresh.
    setCache(key, out, 1000 * 60 * 60 * 6);
    return out;
  } catch {
    if (wbOfficial?.rate) {
      return {
        target,
        rate: wbOfficial.rate,
        asOf: `${wbOfficial.year}-12-31`,
        source: "World Bank PA.NUS.FCRF",
      };
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBestUsdFxSnapshot(currencyCandidates: string[], iso3: string): Promise<UsdFxSnapshot> {
  const uniqueCandidates = [...new Set(currencyCandidates.map((c) => String(c ?? "").toUpperCase()))].filter((c) =>
    /^[A-Z]{3}$/.test(c)
  );
  for (const code of uniqueCandidates) {
    const snap = await settleWithin(fetchUsdFxSnapshot(code, iso3), 7000, null);
    if (snap?.rate && Number.isFinite(snap.rate) && snap.rate > 0) return snap;
  }
  // Final fallback: if no currency quote is available, still provide an official WB LCU-per-USD rate.
  const wbOfficial = await settleWithin(fetchWbOfficialUsdFxLatest(iso3), 7000, null);
  if (wbOfficial?.rate && Number.isFinite(wbOfficial.rate) && wbOfficial.rate > 0) {
    return {
      target: uniqueCandidates[0] ?? "LCU",
      rate: wbOfficial.rate,
      asOf: `${wbOfficial.year}-12-31`,
      source: "World Bank PA.NUS.FCRF",
    };
  }
  return null;
}

async function validateGroqApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: ac.signal,
    });
    if (res.ok) return { ok: true, message: "Groq key is valid." };
    const body = await res.text();
    const brief = body.trim().slice(0, 180);
    return { ok: false, message: `Groq key rejected (${res.status})${brief ? `: ${brief}` : ""}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Groq validation failed: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

async function validateTavilyApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: "country analytics platform key check",
        search_depth: "basic",
        max_results: 1,
        include_answer: false,
        topic: "general",
      }),
      signal: ac.signal,
    });
    if (res.ok) return { ok: true, message: "Tavily key is valid." };
    const body = await res.text();
    const brief = body.trim().slice(0, 180);
    return { ok: false, message: `Tavily key rejected (${res.status})${brief ? `: ${brief}` : ""}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Tavily validation failed: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/keys/validate", async (req, res) => {
  try {
    const groqApiKey = readRequestApiKey(req, "groq");
    const tavilyApiKey = readRequestApiKey(req, "tavily");
    const [groq, tavily] = await Promise.all([
      groqApiKey
        ? validateGroqApiKey(groqApiKey)
        : Promise.resolve({ ok: false, message: "No Groq key provided." }),
      tavilyApiKey
        ? validateTavilyApiKey(tavilyApiKey)
        : Promise.resolve({ ok: false, message: "No Tavily key provided." }),
    ]);
    res.json({
      groq,
      tavily,
      checkedAt: Date.now(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/metrics", (_req, res) => {
  res.json(METRICS.map((m) => ({ ...m, shortLabel: getMetricShortLabel(m.id) })));
});

app.get("/api/data-providers", (_req, res) => {
  res.json(listDataProvidersResponse());
});

app.get("/api/ilo-isic-divisions", (_req, res) => {
  res.json(ILO_ISIC_DIVISIONS);
});

app.get("/api/countries", async (_req, res) => {
  try {
    let countries = await settleWithin(listCountries(), 10000, []);
    if (countries.length === 0) {
      const wb = await fetchCountriesFromWorldBankDirectory();
      if (wb.length > 0) {
        countries = wb;
        res.setHeader("x-cap-warning", "countries-wb-fallback-used");
      }
    }
    res.json(countries.filter((c) => /^[A-Z]{3}$/.test(c.cca3)).sort((a, b) => a.name.localeCompare(b.name)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.setHeader("x-cap-warning", `countries-fallback-empty:${msg.slice(0, 120)}`);
    res.json([]);
  }
});

app.get("/api/country/:cca3", async (req, res) => {
  try {
    const isoReq = String(req.params.cca3 ?? "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(isoReq)) return res.status(400).json({ error: "Invalid ISO3 code" });
    const [c, directCountry, wbDirectoryCountry] = await Promise.all([
      settleWithin(getCountry(isoReq), 8000, undefined),
      settleWithin(fetchCountryByIso3Direct(isoReq), 7000, null),
      settleWithin(
        fetchCountriesFromWorldBankDirectory().then((rows) => rows.find((row) => row.cca3 === isoReq) ?? null),
        7000,
        null
      ),
    ]);
    const country: CountrySummary =
      c ??
      ({
        cca3: isoReq,
        name: directCountry?.name ?? wbDirectoryCountry?.name ?? isoReq,
        region: "",
        subregion: "",
        capital: directCountry?.capital ?? wbDirectoryCountry?.capital ?? [],
        population: 0,
        area: directCountry?.area ?? wbDirectoryCountry?.area ?? 0,
        latlng: directCountry?.latlng ?? wbDirectoryCountry?.latlng ?? [0, 0],
        flags: directCountry?.flags ?? wbDirectoryCountry?.flags ?? {},
        timezones: [],
        currencies: directCountry?.currencies ?? [],
        currencyDisplay: directCountry?.currencyDisplay,
        cca2: directCountry?.cca2 ?? wbDirectoryCountry?.cca2,
        ccn3: directCountry?.ccn3,
        landlocked: directCountry?.landlocked,
      } satisfies CountrySummary);
    if (!c) res.setHeader("x-cap-warning", "country-directory-fallback-used");
    const iso = country.cca3.toUpperCase();
    const [wd, eezApi, worldBankProfile] = await Promise.all([
      settleWithin(fetchWikidataCountryEnrichment(iso), 7000, null),
      country.landlocked
        ? Promise.resolve(null)
        : settleWithin(fetchSeaAroundUsEezAreaKm2(country.ccn3), 7000, null),
      settleWithin(fetchWbCountryProfile(iso), 7000, null),
    ]);
    const ianaTimezone = (() => {
      try {
        // Prefer capital coordinates (World Bank profile) for multi-timezone countries.
        const wbLat = worldBankProfile?.latitude ? Number(worldBankProfile.latitude) : NaN;
        const wbLng = worldBankProfile?.longitude ? Number(worldBankProfile.longitude) : NaN;
        if (Number.isFinite(wbLat) && Number.isFinite(wbLng)) {
          return tzLookup(wbLat, wbLng);
        }
        const [lat, lng] = country.latlng ?? [NaN, NaN];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
        return tzLookup(lat, lng);
      } catch {
        return undefined;
      }
    })();
    const resolvedCountry: CountrySummary =
      c || !worldBankProfile
        ? country
        : {
            ...country,
            name: worldBankProfile.name || country.name,
            region: worldBankProfile.region || country.region,
            capital:
              worldBankProfile.capitalCity && worldBankProfile.capitalCity.trim().length > 0
                ? [worldBankProfile.capitalCity.trim()]
                : country.capital,
            latlng: [
              Number.isFinite(Number(worldBankProfile.latitude))
                ? Number(worldBankProfile.latitude)
                : country.latlng?.[0] ?? 0,
              Number.isFinite(Number(worldBankProfile.longitude))
                ? Number(worldBankProfile.longitude)
                : country.latlng?.[1] ?? 0,
            ],
          };
    const mergedCountry: CountrySummary = {
      ...resolvedCountry,
      currencies:
        resolvedCountry.currencies && resolvedCountry.currencies.length > 0
          ? resolvedCountry.currencies
          : (directCountry?.currencies ?? []),
      currencyDisplay: resolvedCountry.currencyDisplay ?? directCountry?.currencyDisplay,
      flags:
        (resolvedCountry.flags?.png || resolvedCountry.flags?.svg)
          ? resolvedCountry.flags
          : (directCountry?.flags ?? wbDirectoryCountry?.flags ?? resolvedCountry.flags),
      cca2: resolvedCountry.cca2 ?? directCountry?.cca2 ?? wbDirectoryCountry?.cca2,
      area:
        Number.isFinite(resolvedCountry.area) && resolvedCountry.area > 0
          ? resolvedCountry.area
          : (directCountry?.area ?? resolvedCountry.area),
    };
    const [totalAreaSeries, landAreaSeries] = await Promise.all([
      settleWithin(fetchIndicatorSeries(iso, "AG.SRF.TOTL.K2", MIN_DATA_YEAR, currentDataYear()), 7000, []),
      settleWithin(fetchIndicatorSeries(iso, "AG.LND.TOTL.K2", MIN_DATA_YEAR, currentDataYear()), 7000, []),
    ]);
    const lastNonNullValue = (rows: SeriesPoint[]): number | null => {
      for (let i = rows.length - 1; i >= 0; i--) {
        const v = rows[i]?.value;
        if (v !== null && v !== undefined && Number.isFinite(v)) return v;
      }
      return null;
    };
    const totalAreaKm2 = lastNonNullValue(totalAreaSeries);
    const landAreaKm2 = lastNonNullValue(landAreaSeries);
    const areaResolved =
      Number.isFinite(mergedCountry.area) && mergedCountry.area > 0
        ? mergedCountry.area
        : (totalAreaKm2 ?? landAreaKm2 ?? mergedCountry.area);
    const government = resolvedCountry.government ?? wd?.government;
    const headOfGovernmentTitle = wd?.headOfGovernmentTitle;
    const eezSqKm = mergedCountry.landlocked ? null : eezApi ?? EEZ_SQKM_FALLBACK[iso] ?? null;
    const directCurrencyFallback =
      mergedCountry.cca2 && /^[A-Z]{2}$/.test(mergedCountry.cca2)
        ? (countryToCurrency[mergedCountry.cca2 as keyof typeof countryToCurrency] as string | undefined)
        : undefined;
    const currencyCodes = (mergedCountry.currencies ?? []).filter((code) => /^[A-Z]{3}$/.test(String(code)));
    if (currencyCodes.length === 0 && directCurrencyFallback && /^[A-Z]{3}$/.test(directCurrencyFallback)) {
      currencyCodes.push(directCurrencyFallback);
    }
    const currencyFromDisplay =
      typeof mergedCountry.currencyDisplay === "string"
        ? (mergedCountry.currencyDisplay.match(/\b[A-Z]{3}\b/g) ?? []).filter((c) => /^[A-Z]{3}$/.test(c))
        : [];
    const fallbackByIso3: Record<string, string> = {
      XKX: "EUR",
    };
    const fxCurrencyCandidates = [
      ...currencyCodes,
      ...currencyFromDisplay,
      ...(directCurrencyFallback ? [directCurrencyFallback] : []),
      ...(fallbackByIso3[iso] ? [fallbackByIso3[iso]] : []),
    ];
    const currencyDisplayResolved =
      (typeof mergedCountry.currencyDisplay === "string" && mergedCountry.currencyDisplay.trim()
        ? mergedCountry.currencyDisplay.trim()
        : "") || currencyCodes[0];
    const usdFxRate = await settleWithin(fetchBestUsdFxSnapshot(fxCurrencyCandidates, iso), 14000, null);
    res.json({
      ...mergedCountry,
      currencies: currencyCodes,
      currencyDisplay: currencyDisplayResolved,
      usdFxRate: usdFxRate?.rate ?? null,
      usdFxRateAsOf: usdFxRate?.asOf,
      usdFxCurrency: usdFxRate?.target ?? currencyCodes[0] ?? null,
      usdFxSource: usdFxRate?.source,
      area: areaResolved,
      totalAreaKm2,
      landAreaKm2,
      ianaTimezone,
      government,
      headOfGovernmentTitle,
      eezSqKm,
      worldBankProfile,
    });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

app.get("/api/country/:cca3/wb-profile", async (req, res) => {
  try {
    const p = await fetchWbCountryProfile(req.params.cca3.toUpperCase());
    res.json(p);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/dashboard/comparison", async (req, res) => {
  try {
    const cca3 = String(req.query.cca3 ?? "").toUpperCase();
    const year = req.query.year
      ? clampYear(parseInt(String(req.query.year), 10))
      : clampYear(currentDataYear() - 1);
    if (!/^[A-Z]{3}$/.test(cca3)) return res.status(400).json({ error: "cca3 required" });
    const fallback: Awaited<ReturnType<typeof buildDashboardComparison>> = {
      year,
      countryIso3: cca3,
      countryName: cca3,
      rows: [],
      geographyMeta: { medianArea: null, sumArea: 0 },
      membersCount: 0,
      mode: "fallback",
    };
    const data = await settleWithin(buildDashboardComparison(cca3, year), 45000, fallback);
    if (!Array.isArray(data.rows) || data.rows.length === 0) {
      res.setHeader("x-cap-warning", "dashboard-comparison-fallback-empty");
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/cache/clear", (_req, res) => {
  clearAllCache();
  resetDataWarmupGate();
  res.json({ ok: true });
});

/**
 * First-open bootstrap: warms server-side cache for every country + WLD with the full metric catalog
 * and default year span (same payload as GET /api/country/:cca3/series with all metrics). Returns immediately;
 * work continues in the background. Set DISABLE_BOOTSTRAP_WARMUP=1 to skip.
 */
app.post("/api/bootstrap/warm", (_req, res) => {
  if (process.env.DISABLE_BOOTSTRAP_WARMUP === "1") {
    res.json({ status: "skipped", reason: "DISABLE_BOOTSTRAP_WARMUP" });
    return;
  }
  res.status(202).json({
    status: "started",
    message: "Prefetching full country metric bundles into server cache (runs in background).",
  });
  void startDataWarmup().catch((e) => console.error("[bootstrap/warm]", e));
});

function countrySeriesCacheKey(cca3: string, start: number, end: number, metricIds: string[]): string {
  const sorted = [...metricIds].sort().join("\0");
  const h = createHash("sha256").update(sorted).digest("hex").slice(0, 20);
  return `country:series:v3:${cca3}:${start}:${end}:${h}`;
}

const COUNTRY_SERIES_CACHE_TTL_MS = 1000 * 60 * 20;
function makeNullSeries(start: number, end: number): SeriesPoint[] {
  return Array.from({ length: end - start + 1 }, (_, i) => ({ year: start + i, value: null }));
}

app.get("/api/country/:cca3/series", async (req, res) => {
  try {
    const idsParam = req.query.metrics as string | undefined;
    const { start, end } = clampYearRange(
      req.query.start ? parseInt(String(req.query.start), 10) : MIN_DATA_YEAR,
      req.query.end ? parseInt(String(req.query.end), 10) : currentDataYear()
    );
    const metricIds = idsParam
      ? idsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : allMetricIds();
    for (const id of metricIds) {
      if (!METRIC_BY_ID[id]) return res.status(400).json({ error: `Unknown metric: ${id}` });
    }
    const cca3 = req.params.cca3.toUpperCase();
    const cacheKey = countrySeriesCacheKey(cca3, start, end, metricIds);
    const cached = getCache<Record<string, SeriesPoint[]>>(cacheKey);
    const isAllNullBundle = (b: Record<string, SeriesPoint[]>): boolean =>
      Object.values(b).length > 0 &&
      Object.values(b).every((s) => Array.isArray(s) && s.every((p) => p.value === null));
    if (cached && !isAllNullBundle(cached)) {
      res.json(cached);
      return;
    }
    const fallbackBundle: Record<string, SeriesPoint[]> = Object.fromEntries(
      metricIds.map((id) => [
        id,
        Array.from({ length: end - start + 1 }, (_, i) => ({ year: start + i, value: null })),
      ])
    );
    const seriesTimeoutMs = metricIds.length >= 40 ? 95000 : 55000;
    const bundle = await settleWithin(
      fetchCountryBundle(cca3, metricIds, start, end),
      seriesTimeoutMs,
      fallbackBundle
    );
    const allNull = isAllNullBundle(bundle);
    if (!allNull) {
      setCache(cacheKey, bundle, COUNTRY_SERIES_CACHE_TTL_MS);
    }
    if (allNull) {
      res.setHeader("x-cap-warning", "country-series-fallback-null-dense");
    }
    res.json(bundle);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/global/snapshot", async (req, res) => {
  try {
    const metricId = String(req.query.metric ?? "gdp");
    const requestedYear = req.query.year
      ? clampYear(parseInt(String(req.query.year), 10))
      : clampYear(currentDataYear() - 1);
    if (!METRIC_BY_ID[metricId]) return res.status(400).json({ error: "Unknown metric" });
    const fallbackRows = [] as Awaited<ReturnType<typeof fetchGlobalSnapshotWithYearFallback>>["rows"];
    const snap = await settleWithin(
      fetchGlobalSnapshotWithYearFallback(metricId, requestedYear),
      120000,
      { dataYear: requestedYear, rows: fallbackRows }
    );
    const { dataYear, rows } = snap;
    if (rows.length === 0) res.setHeader("x-cap-warning", "global-snapshot-fallback-empty");
    res.json({ metricId, requestedYear, dataYear, year: dataYear, rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/global/table", async (req, res) => {
  try {
    const year = req.query.year
      ? clampYear(parseInt(String(req.query.year), 10))
      : clampYear(currentDataYear() - 1);
    const region = String(req.query.region ?? "All");
    const category = String(req.query.category ?? "general") as TableCategory;
    if (!["general", "financial", "health", "education"].includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }
    const fallbackTable: Awaited<ReturnType<typeof buildGlobalTable>> = {
      requestedYear: year,
      dataYear: year,
      category,
      columns: [],
      rows: [],
      wdiLookbackYears: 0,
    };
    const data = await settleWithin(buildGlobalTable(year, region, category), 30000, fallbackTable);
    if (!Array.isArray(data) || data.length === 0) {
      res.setHeader("x-cap-warning", "global-table-fallback-empty");
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/global/wld-series", async (req, res) => {
  try {
    const idsParam = String(req.query.metrics ?? "");
    const metricIds = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (metricIds.length === 0) return res.status(400).json({ error: "metrics required" });
    for (const id of metricIds) {
      if (!METRIC_BY_ID[id]) return res.status(400).json({ error: `Unknown metric: ${id}` });
    }
    const { start, end } = clampYearRange(
      req.query.start ? parseInt(String(req.query.start), 10) : MIN_DATA_YEAR,
      req.query.end ? parseInt(String(req.query.end), 10) : currentDataYear()
    );
    const wldFallback: Record<string, SeriesPoint[]> = Object.fromEntries(
      metricIds.map((id) => [id, makeNullSeries(start, end)])
    );
    const wldTimeoutMs = metricIds.length >= 30 ? 95000 : 45000;
    const bundle = await settleWithin(fetchCountryBundle("WLD", metricIds, start, end), wldTimeoutMs, wldFallback);
    const allNull = Object.values(bundle).every((s) => s.every((p) => p.value === null));
    if (allNull) res.setHeader("x-cap-warning", "global-wld-series-fallback-null");
    res.json({ start, end, series: bundle });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/compare", async (req, res) => {
  try {
    const countries = String(req.query.countries ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const metricId = String(req.query.metric ?? "gdp_per_capita");
    const { start, end } = clampYearRange(
      req.query.start ? parseInt(String(req.query.start), 10) : MIN_DATA_YEAR,
      req.query.end ? parseInt(String(req.query.end), 10) : currentDataYear()
    );
    if (countries.length === 0) return res.status(400).json({ error: "countries required" });
    if (!METRIC_BY_ID[metricId]) return res.status(400).json({ error: "Unknown metric" });
    const series: Record<string, SeriesPoint[]> = {};
    await Promise.all(
      countries.map(async (iso) => {
        const fallback = { [metricId]: makeNullSeries(start, end) } as Record<string, SeriesPoint[]>;
        const b = await settleWithin(fetchCountryBundle(iso, [metricId], start, end), 40000, fallback);
        series[iso] = b[metricId] ?? makeNullSeries(start, end);
      })
    );
    if (Object.values(series).every((s) => s.every((p) => p.value === null))) {
      res.setHeader("x-cap-warning", "compare-series-fallback-null");
    }
    res.json({ metricId, series });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

function latestValue(points: { year: number; value: number | null }[]): { year: number; value: number } | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const v = points[i].value;
    if (v !== null && v !== undefined && !Number.isNaN(v)) {
      return { year: points[i].year, value: v };
    }
  }
  return null;
}

function yoyChange(points: { year: number; value: number | null }[]): number | null {
  const last = latestValue(points);
  if (!last) return null;
  const prev = points.filter((p) => p.year === last.year - 1 && p.value !== null);
  if (prev.length === 0) return null;
  const pv = prev[0].value!;
  if (pv === 0) return null;
  return ((last.value - pv) / Math.abs(pv)) * 100;
}

/** Core metrics pulled for the assistant — same pipeline as the dashboard. */
const ASSISTANT_PRIMARY_METRIC_IDS: string[] = allMetricIds();
/** Default compact subset used for focus-country narrative unless user asks specific metrics. */
const ASSISTANT_OVERVIEW_METRIC_IDS: string[] = [
  "gdp",
  "gdp_growth",
  "gdp_per_capita",
  "gni_per_capita_atlas",
  "population",
  "inflation",
  "unemployment_ilo",
  "gov_debt_pct_gdp",
  "poverty_headcount",
  "life_expectancy",
  "birth_rate",
  "tb_incidence",
  "uhc_service_coverage",
  "hospital_beds",
  "physicians_density",
  "nurses_midwives_density",
  "immunization_measles",
  "health_expenditure_gdp",
];

function formatAssistantMetricValue(id: string, value: number): string {
  const pctIds = new Set([
    "gdp_growth",
    "inflation",
    "gov_debt_pct_gdp",
    "unemployment_ilo",
    "poverty_headcount",
    "poverty_national",
    "undernourishment",
    "immunization_dpt",
    "immunization_measles",
    "health_expenditure_gdp",
    "smoking_prevalence",
    "literacy_adult",
    "lending_rate",
  ]);
  if (pctIds.has(id)) return `${Number(value.toFixed(1))}%`;
  if (id === "life_expectancy") return `${value.toFixed(1)} years`;
  if (id === "birth_rate") return `${value.toFixed(1)} per 1,000`;
  if (id === "tb_incidence") return `${value.toFixed(1)} per 100,000`;
  if (id === "population") {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)} billion`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)} million`;
    return Math.round(value).toLocaleString("en-US");
  }
  if (
    id === "gdp" ||
    id === "gdp_ppp" ||
    id === "gdp_per_capita" ||
    id === "gdp_per_capita_ppp" ||
    id === "gni_per_capita_atlas" ||
    id === "gov_debt_usd"
  ) {
    const x = Math.abs(value);
    if (x >= 1e12) return `$${(value / 1e12).toFixed(2)} trillion`;
    if (x >= 1e9) return `$${(value / 1e9).toFixed(2)} billion`;
    if (x >= 1e6) return `$${(value / 1e6).toFixed(2)} million`;
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/**
 * Narrow per-country comparison blocks to metrics the user named.
 * If they use `… on GDP, population`, only the tail after `on` is scanned; otherwise the whole message
 * (so “GDP and inflation for France, Germany” picks both series).
 */
function extractAssistantComparisonMetricIds(message: string): string[] | undefined {
  const hasOn = /\s+on\s+/i.test(message);
  const text = hasOn
    ? message.slice(message.search(/\s+on\s+/i)).replace(/^\s+on\s+/i, "")
    : message;
  const picked: string[] = [];
  const add = (id: string) => {
    if (ASSISTANT_PRIMARY_METRIC_IDS.includes(id) && !picked.includes(id)) picked.push(id);
  };
  const asksPpp = /\bppp\b|\bpurchasing\s+power\b/i.test(text);
  if (/\bgdp\s+per\s+capita\s+ppp\b|\bppp\s+per\s+capita\b/i.test(text)) {
    add("gdp_per_capita_ppp");
  } else if (/\bgdp\s+per\s+capita\b|\bper\s+capita\s+gdp\b/i.test(text)) {
    add("gdp_per_capita");
    if (asksPpp) add("gdp_per_capita_ppp");
  } else if (
    /\bgni(\s+per\s+capita)?\b|\bworld\s+bank\s+income\b|\bincome\s+(group|classification)\b|\batlas\s+method\b.*\b(per\s+capita|gni)\b/i.test(
      text
    )
  ) {
    add("gni_per_capita_atlas");
  } else if (/\bgdp\b|\bgross\s+domestic\b/i.test(text)) {
    if (asksPpp) add("gdp_ppp");
    else add("gdp");
  }
  if (/\bgdp\s+growth\b|\beconomic\s+growth\s+rate\b/i.test(text)) add("gdp_growth");
  if (/\bpopulation\b|\bpopulous\b/i.test(text)) add("population");
  if (/\bunemployment\b/i.test(text)) add("unemployment_ilo");
  if (/\binflation\b|\bcpi\b/i.test(text)) add("inflation");
  if (/\bdebt\b|\bgovernment\s+debt\b/i.test(text)) {
    if (/\b(usd|dollar|nominal|amount|value)\b/i.test(text)) add("gov_debt_usd");
    else add("gov_debt_pct_gdp");
  }
  if (/\blife\s+expectancy\b/i.test(text)) add("life_expectancy");
  if (/\bbirth\s+rate\b|\bcrude\s+birth\b/i.test(text)) add("birth_rate");
  if (/\b(tuberculosis|tb)\b.*\b(incidence|burden|morbidity)\b|\bdisease\s+burden\b/i.test(text))
    add("tb_incidence");
  if (/\buhc\b|\buniversal\s+health\s+coverage\b|\bcoverage\s+index\b/i.test(text))
    add("uhc_service_coverage");
  if (/\bhospital\s+beds?\b/i.test(text)) add("hospital_beds");
  if (/\bphysicians?\b|\bdoctors?\s+per\b/i.test(text)) add("physicians_density");
  if (/\bnurses?\b|\bmidwives?\b|\bhealth\s+workforce\b/i.test(text))
    add("nurses_midwives_density");
  if (/\bvaccin|immunization|immunisation|dpt|measles\b/i.test(text)) {
    add("immunization_dpt");
    add("immunization_measles");
  }
  if (/\bhealth\s+spend|healthcare\s+spend|health\s+expenditure\b/i.test(text))
    add("health_expenditure_gdp");
  if (/\bsmok|tobacco\b|\brisk\s+factor\b/i.test(text)) add("smoking_prevalence");
  if (/\bliteracy\b/i.test(text)) add("literacy_adult");
  if (/\bpoverty\b/i.test(text)) {
    add("poverty_headcount");
    if (
      /\bnational\b|\binternational\b|\bvs\.?\b|\bversus\b|\bcompare|\bcomparison\b/i.test(text)
    ) {
      add("poverty_national");
    }
  } else if (/\bheadcount\b/i.test(text)) {
    add("poverty_headcount");
  }
  if (/\b(undernourishment|hunger|malnutrition)\b/i.test(text)) add("undernourishment");
  if (/\blending\b|\binterest\s+rate\b/i.test(text)) add("lending_rate");
  return picked.length > 0 ? picked : undefined;
}

function extractAssistantFocusMetricIds(message: string): string[] {
  const picked = extractAssistantComparisonMetricIds(message);
  if (picked && picked.length > 0) return picked;
  return ASSISTANT_OVERVIEW_METRIC_IDS.filter((id) => ASSISTANT_PRIMARY_METRIC_IDS.includes(id));
}

function assistantReplyContainsCitationTag(text: string): boolean {
  return /\[(?:D|W)\d+\]/.test(text);
}

function assistantReplyContainsPlatformCitation(text: string): boolean {
  return /\[D\d+\]/.test(text);
}

function assistantReplyTimeSensitiveMentionsWithoutWebCitation(text: string, opts?: { webTag?: string }): boolean {
  const webTag = opts?.webTag ?? "[W1]";
  const timeSensitiveRe =
    /\b(today|current|latest|now|right now|as of|this week|this month|current events|incumbent|in office|president|prime\s+minister|chancellor|head\s+of\s+state|head\s+of\s+government|minister|election|parliament)\b/i;
  const hasWebTag = (s: string) => s.includes(webTag);
  const parts = text.split(/(?<=[.!?])\s+/g);
  for (const p of parts) {
    if (!timeSensitiveRe.test(p)) continue;
    if (!hasWebTag(p)) return true;
  }
  return false;
}

function assistantReplyOfficeholderCoverageFails(args: {
  asked: string;
  reply: string;
  webTag?: string;
}): boolean {
  const webTag = args.webTag ?? "[W1]";
  const q = args.asked.toLowerCase();
  const r = args.reply;

  const sentenceParts = r.split(/(?<=[.!?])\s+/g);
  const sentenceHas = (re: RegExp, s: string) => re.test(s);
  const sentenceHasWeb = (s: string) => s.includes(webTag);

  const asksHeadState = /\b(head of state|president|monarch|king|queen)\b/i.test(q);
  const asksHeadGov = /\b(head of government|prime\s+minister|chancellor|pm)\b/i.test(q);
  const asksTakeOffice =
    /\bwhen\b.*\b(take office|took office|assume[d]?|assumed|in office|since)\b/i.test(q) ||
    /\b(take office|took office|assume[d]?|in office|since)\b/i.test(q);

  const headStateRe = /\b(head of state|president|monarch|king|queen)\b/i;
  const headGovRe = /\b(head of government|prime\s+minister|chancellor|pm)\b/i;
  const takeOfficeRe = /\b(take office|took office|assume[d]?|in office|since|sworn|inaugurated|appointed|began serving)\b/i;

  if (asksHeadState) {
    const found = sentenceParts.some((s) => sentenceHas(headStateRe, s));
    if (!found) return true;
    const needsWeb = sentenceParts.find((s) => sentenceHas(headStateRe, s));
    if (needsWeb && !sentenceHasWeb(needsWeb)) return true;
  }

  if (asksHeadGov) {
    const found = sentenceParts.some((s) => sentenceHas(headGovRe, s));
    if (!found) return true;
    const needsWeb = sentenceParts.find((s) => sentenceHas(headGovRe, s));
    if (needsWeb && !sentenceHasWeb(needsWeb)) return true;
  }

  if (asksTakeOffice) {
    const found = sentenceParts.some((s) => sentenceHas(takeOfficeRe, s));
    if (!found) return true;
    const needsWeb = sentenceParts.find((s) => sentenceHas(takeOfficeRe, s));
    if (needsWeb && !sentenceHasWeb(needsWeb)) return true;
  }

  return false;
}

function parseFirstWebCitationFromCitedBlock(raw: string): { title: string; url: string; snippet: string } | null {
  if (!raw.trim()) return null;
  const lines = raw.split(/\r?\n/);
  let title = "";
  let url = "";
  let snippet = "";
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    const m = t.match(/^\[W1\]\s+(.+?)\s+\((https?:\/\/[^)]+)\)(?:\s*·\s*published\/updated:\s*.+)?$/i);
    if (m?.[1] && m[2]) {
      title = m[1].trim();
      url = m[2].trim();
      const next = lines[i + 1]?.trim() ?? "";
      snippet = next.replace(/^\s+/, "").trim();
      break;
    }
  }
  if (!title || !url) return null;
  return { title, url, snippet };
}

function buildDeterministicVerifiedWebReply(message: string, webCitedBlock: string): string | null {
  const w = parseFirstWebCitationFromCitedBlock(webCitedBlock);
  if (!w) return null;
  const q = message.toLowerCase();
  const asksOfficeholder =
    /\b(president|prime\s+minister|head\s+of\s+state|head\s+of\s+government|in office|incumbent)\b/i.test(q);
  const asksTakeOffice =
    /\b(when|since)\b.*\b(take office|took office|in office|assume[d]?|inaugurat)\b/i.test(q) ||
    /\b(take office|took office|assume[d]?|in office|since|inaugurat)\b/i.test(q);
  if (!asksOfficeholder) return null;

  const s = w.snippet;
  const hasRoleSignal =
    /\b(president|prime minister|head of state|head of government|incumbent|officeholder|in office)\b/i.test(
      s
    );
  const hasDateSignal =
    /\b(20\d{2}|19\d{2})\b/.test(s) ||
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(s);

  if (!hasRoleSignal) {
    return `I could not verify the requested current officeholder details from the retrieved live-web excerpt [W1]. Please verify on the official government site linked in [W1].`;
  }

  if (asksTakeOffice && !hasDateSignal) {
    return `From the retrieved excerpt [W1], I can reference the officeholder context, but I could not verify a reliable take-office date. Please confirm the exact date from the official source in [W1].`;
  }

  return `Based on the retrieved live-web excerpt [W1], here is the verified officeholder context: ${s} [W1]`;
}

function capLines(raw: string, maxLines: number): string {
  const lines = raw.split(/\r?\n/);
  if (lines.length <= maxLines) return raw.trim();
  return `${lines.slice(0, maxLines).join("\n").trim()}\n…`;
}

function buildAssistantGroundedFallbackFromCited(opts: {
  asked: string;
  focusBlock: string;
  comparisonBlock: string;
  rankingBlock: string;
  webBlock: string;
  includeWeb?: boolean;
}): string {
  const lines: string[] = [];
  const q = opts.asked.trim();
  if (q) lines.push(`I’m returning a grounded answer only from retrieved evidence for: "${q}"`);

  if (opts.rankingBlock.trim()) {
    lines.push("");
    lines.push("### Ranking snapshot");
    lines.push(capLines(opts.rankingBlock, 16));
  }
  if (opts.comparisonBlock.trim()) {
    lines.push("");
    lines.push("### Comparison snapshot");
    lines.push(capLines(opts.comparisonBlock, 18));
  }
  if (opts.focusBlock.trim()) {
    lines.push("");
    lines.push("### Focus-country indicators");
    lines.push(capLines(opts.focusBlock, 14));
  }
  if (opts.includeWeb && opts.webBlock.trim()) {
    lines.push("");
    lines.push("### Recent web context");
    lines.push(capLines(opts.webBlock, 10));
  }

  if (lines.length === 0) {
    return "I don’t have enough grounded evidence in this turn to answer reliably. Please ask again with a specific country and metric (or ranking request), and I will answer strictly from cited data.";
  }
  return lines.join("\n");
}

function extractTaggedLines(section: string, re: RegExp, max = 6): string[] {
  if (!section.trim()) return [];
  const out: string[] = [];
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(re);
    if (!m?.[1]) continue;
    out.push(m[1].trim());
    if (out.length >= max) break;
  }
  return out;
}

const ASSISTANT_CREDIBLE_DOMAINS = [
  "worldbank.org",
  "imf.org",
  "oecd.org",
  "who.int",
  "ilo.org",
  "un.org",
  "undp.org",
  "unesco.org",
  "wto.org",
  "europa.eu",
  "ec.europa.eu",
  "census.gov",
  "data.gov",
  "ourworldindata.org",
  "britannica.com",
  "wikipedia.org",
  "wikidata.org",
];

const ASSISTANT_SENSITIVE_FACT_DOMAINS = [
  "wikipedia.org",
  "wikidata.org",
  "britannica.com",
  "cia.gov",
  "state.gov",
  "gov.uk",
  "europa.eu",
  "un.org",
  "unesco.org",
];

type ParsedComparisonCountry = {
  countryName: string;
  iso3: string;
  metrics: Record<string, string>;
};

function parseComparisonCountrySections(raw: string): ParsedComparisonCountry[] {
  if (!raw.trim()) return [];
  const sections = raw.split(/\n\n────────\n\n/).map((s) => s.trim()).filter(Boolean);
  const out: ParsedComparisonCountry[] = [];
  for (const sec of sections) {
    const lines = sec.split(/\r?\n/);
    const countryLine = lines.find((l) => /^Country:\s+/i.test(l.trim()));
    if (!countryLine) continue;
    const cm = countryLine.trim().match(/^Country:\s+(.+?)\s+\(([A-Z]{3})\)\s*$/i);
    if (!cm?.[1] || !cm[2]) continue;
    const countryName = cm[1].trim();
    const iso3 = cm[2].toUpperCase();
    const metrics: Record<string, string> = {};
    for (const l of lines) {
      const t = l.trim();
      if (!/^•\s+/.test(t)) continue;
      const m = t.match(/^•\s+(.+?):\s+(.+)$/);
      if (!m?.[1] || !m[2]) continue;
      metrics[m[1].trim()] = m[2].trim();
    }
    out.push({ countryName, iso3, metrics });
  }
  return out;
}

function compactMetricCell(raw: string): string {
  const head = raw.split(/\s*;\s*/)[0]?.trim() ?? raw.trim();
  return head.length > 72 ? `${head.slice(0, 72)}…` : head;
}

function parseComparableMetricNumber(raw: string): number | null {
  const head = raw.split(/\s*;\s*/)[0]?.trim() ?? raw.trim();
  if (!head) return null;
  if (/^(?:n\/a|na|—|-|not available)$/i.test(head)) return null;

  const lc = head.toLowerCase();
  let mul = 1;
  if (/\btrillion\b/.test(lc)) mul = 1e12;
  else if (/\bbillion\b/.test(lc)) mul = 1e9;
  else if (/\bmillion\b/.test(lc)) mul = 1e6;
  else if (/\bthousand\b|\bk\b/.test(lc)) mul = 1e3;

  const normalized = head.replace(/,/g, "");
  const m = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!m?.[0]) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return null;
  return n * mul;
}

function formatPctOfTop(value: number, top: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(top) || top <= 0) return "";
  const ratio = (value / top) * 100;
  if (!Number.isFinite(ratio) || ratio <= 0) return "";
  if (Math.abs(ratio - 100) < 1e-9) return "100% of top";
  return ratio >= 10 ? `${ratio.toFixed(1)}% of top` : `${ratio.toFixed(2)}% of top`;
}

function buildDeterministicRankingOrComparisonReply(opts: {
  intent: AssistantIntent;
  rankingSection: string;
  comparisonBlock: string;
  rankingMarkdown: string;
  cited: {
    rankingSection: string;
    comparisonBlock: string;
  };
  comparisonMetricIds?: string[];
}): string | null {
  const rankTurn = opts.intent === "statistics_drill" && opts.rankingSection.trim().length > 0;
  const compareTurn = opts.intent === "country_compare" && opts.comparisonBlock.trim().length > 0;
  if (!rankTurn && !compareTurn) return null;

  if (rankTurn) {
    // Keep deterministic ranking fallback intentionally minimal: the table above
    // is already authoritative and avoids accidental synthetic prose drift.
    return "The platform ranking table above contains the requested metric snapshot and ordered results.";
  }

  const countries = parseComparisonCountrySections(opts.comparisonBlock);
  if (countries.length < 2) {
    return "The platform comparison snapshot is limited for this turn, so I cannot produce a reliable side-by-side yet.";
  }

  const requestedDefs = (opts.comparisonMetricIds ?? [])
    .map((id) => METRIC_BY_ID[id]?.label)
    .filter((x): x is string => Boolean(x));
  const requestedLabels = requestedDefs.slice(0, 8);
  const commonMetricLabels = (() => {
    if (requestedLabels.length > 0) return requestedLabels;
    const counts = new Map<string, number>();
    for (const c of countries) {
      for (const k of Object.keys(c.metrics)) {
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k]) => k);
  })();
  if (commonMetricLabels.length === 0) {
    return `Compared countries: ${countries.map((c) => `${c.countryName} (${c.iso3})`).join(", ")}. I could not find comparable metric rows in this snapshot.`;
  }

  const topByMetric = new Map<string, number>();
  for (const k of commonMetricLabels) {
    const vals = countries
      .map((c) => parseComparableMetricNumber(c.metrics[k] ?? ""))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    if (vals.length > 0) topByMetric.set(k, Math.max(...vals));
  }

  const header = `| Country | ${commonMetricLabels.map((x) => x.replace(/\|/g, "·")).join(" | ")} |\n| --- | ${commonMetricLabels.map(() => "---").join(" | ")} |`;
  const rows = countries
    .map((c) => {
      const cells = commonMetricLabels.map((k) => {
        const v = c.metrics[k];
        if (!v) return "n/a";
        const base = compactMetricCell(v).replace(/\|/g, "·");
        const parsed = parseComparableMetricNumber(v);
        const top = topByMetric.get(k);
        if (parsed === null || top === undefined) return base;
        const pct = formatPctOfTop(parsed, top);
        return pct ? `${base} · ${pct}` : base;
      });
      return `| ${c.countryName} (${c.iso3}) | ${cells.join(" | ")} |`;
    })
    .join("\n");
  const intro = `Compared countries: ${countries.map((c) => `${c.countryName} (${c.iso3})`).join(", ")}. Values below use the latest platform snapshot for the requested indicators; each cell also shows the country's percentage relative to the highest value on that metric.`;
  return `${intro}\n\n${header}\n${rows}`;
}

function buildDeterministicDashboardMetricTableReply(opts: {
  message: string;
  dashboardBlock: string;
  intent: AssistantIntent;
  hasComparison: boolean;
  hasRanking: boolean;
  metricAnchored: boolean;
}): string | null {
  if (!opts.dashboardBlock.trim()) return null;
  if (opts.hasComparison || opts.hasRanking) return null;
  // Strict rule: table format is only for pure dashboard-metric questions.
  if (!opts.metricAnchored) return null;
  if (!(opts.intent === "statistics_drill" || opts.intent === "country_overview")) return null;

  const lines = opts.dashboardBlock.split(/\r?\n/);
  const countryLine = lines.find((l) => /^Country:\s+/i.test(l.trim()))?.trim() ?? "Country";
  const metricRows: Array<{ label: string; latest: string; year: string; yoy: string }> = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t.startsWith("• ")) continue;
    const m = t.match(
      /^•\s+(.+?):\s+(.+?)\s+\(data year\s+(\d{4})\)(?:;\s*YoY vs prior year:\s*([\-0-9.]+)%?)?$/i
    );
    if (!m?.[1] || !m[2] || !m[3]) continue;
    const label = m[1].trim().replace(/\|/g, "·");
    const latest = m[2].trim().replace(/\|/g, "·");
    const year = m[3].trim();
    const yoy = m[4] ? `${m[4].trim()}%` : "n/a";
    metricRows.push({ label, latest, year, yoy });
  }
  if (metricRows.length === 0) return null;

  const header = `| Indicator | Latest value | Data year | YoY |\n| --- | --- | ---: | ---: |`;
  const rows = metricRows.map((r) => `| ${r.label} | ${r.latest} | ${r.year} | ${r.yoy} |`).join("\n");
  const pick = (re: RegExp) => metricRows.find((r) => re.test(r.label));
  const gdp = pick(/\bGDP\b/i);
  const infl = pick(/\binflation\b/i);
  const unemp = pick(/\bunemployment\b/i);
  const debt = pick(/\bdebt\b/i);
  const life = pick(/\blife expectancy\b/i);

  const analysisLines: string[] = [];
  analysisLines.push("**High-level analysis**");
  if (gdp) analysisLines.push(`- Output level remains anchored by ${gdp.label.toLowerCase()} at ${gdp.latest} (${gdp.year}).`);
  if (infl) analysisLines.push(`- Price pressure context: ${infl.latest} in ${infl.year}${infl.yoy !== "n/a" ? ` with YoY ${infl.yoy}` : ""}.`);
  if (unemp)
    analysisLines.push(
      `- Labor-market signal: ${unemp.label.toLowerCase()} is ${unemp.latest} (${unemp.year})${unemp.yoy !== "n/a" ? `, YoY ${unemp.yoy}` : ""}.`
    );
  if (!unemp && debt)
    analysisLines.push(
      `- Fiscal-risk read: ${debt.label.toLowerCase()} at ${debt.latest} (${debt.year})${debt.yoy !== "n/a" ? `, YoY ${debt.yoy}` : ""}.`
    );
  if (life) analysisLines.push(`- Human-development anchor: ${life.latest} (${life.year}) for ${life.label.toLowerCase()}.`);
  if (analysisLines.length === 1)
    analysisLines.push("- The table shows the latest platform snapshot and YoY direction for the requested dashboard indicators.");

  return `${countryLine}\n\n${header}\n${rows}\n\n${analysisLines.join("\n")}\n\nThe table above uses the same platform snapshot logic as dashboard/comparison answers.`;
}

function messageAnchorsSelectedCountry(message: string): boolean {
  return /\bselected\s+countr(?:y)?\b/i.test(message) || /\bthe\s+selected\s+countr(?:y)?\b/i.test(message);
}

const METRIC_DEFINITION_ALIAS_MAP: ReadonlyArray<{ re: RegExp; metricId: string }> = [
  { re: /\bgdp growth\b|\bgrowth rate\b/, metricId: "gdp_growth" },
  { re: /\bgdp per capita\b.*\bppp\b|\bppp gdp per capita\b/, metricId: "gdp_per_capita_ppp" },
  { re: /\bgdp per capita\b/, metricId: "gdp_per_capita" },
  { re: /\bgdp\b.*\bppp\b|\bppp gdp\b/, metricId: "gdp_ppp" },
  { re: /\bgdp\b/, metricId: "gdp" },
  { re: /\bgni per capita\b|\batlas method\b/, metricId: "gni_per_capita_atlas" },
  { re: /\bgovernment debt\b.*\b%|\bdebt % of gdp\b/, metricId: "gov_debt_pct_gdp" },
  { re: /\bgovernment debt\b|\bnominal debt\b/, metricId: "gov_debt_usd" },
  { re: /\binflation\b/, metricId: "inflation" },
  { re: /\blending rate\b/, metricId: "lending_rate" },
  { re: /\bunemployment\b|\bilo\b/, metricId: "unemployment_ilo" },
  { re: /\blabor force\b|\blabour force\b/, metricId: "labor_force_total" },
  { re: /\bpoverty\b.*\b2\.15\b|\binternational poverty\b/, metricId: "poverty_headcount" },
  { re: /\bnational poverty\b/, metricId: "poverty_national" },
  { re: /\blife expectancy\b/, metricId: "life_expectancy" },
  { re: /\bund(er)?-?five mortality\b/, metricId: "mortality_under5" },
  { re: /\bmaternal mortality\b/, metricId: "maternal_mortality" },
  { re: /\bundernourishment\b/, metricId: "undernourishment" },
  { re: /\bbirth rate\b/, metricId: "birth_rate" },
  { re: /\btuberculosis\b|\btb incidence\b/, metricId: "tb_incidence" },
  { re: /\buhc\b|\bservice coverage\b/, metricId: "uhc_service_coverage" },
  { re: /\bhospital beds?\b/, metricId: "hospital_beds" },
  { re: /\bphysicians?\b/, metricId: "physicians_density" },
  { re: /\bnurses?\b|\bmidwives?\b/, metricId: "nurses_midwives_density" },
  { re: /\bimmunization\b.*\bdpt\b|\bvaccination\b.*\bdpt\b/, metricId: "immunization_dpt" },
  { re: /\bimmunization\b.*\bmeasles\b|\bvaccination\b.*\bmeasles\b/, metricId: "immunization_measles" },
  { re: /\bhealth expenditure\b/, metricId: "health_expenditure_gdp" },
  { re: /\bsmoking prevalence\b/, metricId: "smoking_prevalence" },
  { re: /\bliteracy\b/, metricId: "literacy_adult" },
  { re: /\benrollment\b.*\bprimary\b/, metricId: "enrollment_primary_pct" },
  { re: /\benrollment\b.*\bsecondary\b/, metricId: "enrollment_secondary" },
  { re: /\benrollment\b.*\btertiary\b/, metricId: "enrollment_tertiary_pct" },
  { re: /\bgender parity\b|\bgpi\b/, metricId: "gpi_secondary" },
  { re: /\beducation expenditure\b/, metricId: "edu_expenditure_gdp" },
  { re: /\barea\b|\bland area\b|\btotal area\b/, metricId: "area" },
];

function questionLooksMetricDefinitionQuery(message: string): boolean {
  const q = message.toLowerCase();
  const directDefinitionAsk =
    /\b(define|definition|what is|what does .* mean|explain|difference between|compare .* definition|methodology)\b/.test(
      q
    );
  const mapDefinitionAsk =
    /\b(map|global map|choropleth)\b/.test(q) &&
    /\b(metric|indicator|means?|definition|interpret|read|how to read|what does)\b/.test(q);
  return directDefinitionAsk || mapDefinitionAsk;
}

function resolveMetricDefinitionIds(message: string): string[] {
  const q = message.toLowerCase();
  const out: string[] = [];
  for (const a of METRIC_DEFINITION_ALIAS_MAP) {
    if (a.re.test(q) && !out.includes(a.metricId)) out.push(a.metricId);
  }
  // Fallback on metric labels for broader phrasing.
  for (const m of METRICS) {
    const lbl = m.label.toLowerCase();
    if (lbl.length >= 6 && q.includes(lbl) && !out.includes(m.id)) out.push(m.id);
  }
  return out.slice(0, 6);
}

function buildMetricDefinitionExpertReply(message: string, metricIds: string[]): string | null {
  if (metricIds.length === 0) return null;
  const blocks: string[] = [];
  blocks.push("Here are professional metric definitions grounded in institutional metadata used by this app:");
  for (const id of metricIds) {
    const m = METRIC_BY_ID[id];
    if (!m) continue;
    const desc = (m.description ?? "").trim();
    const unit = m.unit?.trim() ? `Unit: ${m.unit.trim()}.` : "";
    const src = m.sourceName?.trim() || "Institutional source";
    const srcUrl = m.sourceUrl?.trim();
    const formula = m.formula?.trim() ? `Formula note: ${m.formula.trim()}.` : "";
    const line = [
      `- **${m.label}**`,
      desc ? `Definition: ${desc}` : "Definition: Official indicator definition from the source metadata.",
      unit,
      formula,
      `Source: ${src}${srcUrl ? ` ([link](${srcUrl}))` : ""}.`,
    ]
      .filter(Boolean)
      .join(" ");
    blocks.push(line);
  }
  if (metricIds.length >= 2 && /\bdifference|compare\b/i.test(message)) {
    blocks.push(
      "Use these definitions comparatively by checking scope first (nominal vs PPP, rate vs level, stock vs flow), then unit consistency and reference year alignment."
    );
  }
  return blocks.join("\n\n");
}

function buildAssistantPrimaryDataBlock(
  meta: NonNullable<Awaited<ReturnType<typeof getCountry>>>,
  bundle: Record<string, SeriesPoint[]>,
  metricIds?: string[]
): string {
  const idList =
    metricIds && metricIds.length > 0
      ? metricIds.filter((id) => ASSISTANT_PRIMARY_METRIC_IDS.includes(id))
      : ASSISTANT_PRIMARY_METRIC_IDS;
  const ids = idList.length > 0 ? idList : ASSISTANT_PRIMARY_METRIC_IDS;
  const usedRequestedSubset = Boolean(metricIds && metricIds.length > 0 && idList.length > 0);
  const lines: string[] = [
    `Country: ${meta.name} (${meta.cca3})`,
    `Region: ${meta.region}${meta.subregion ? ` · ${meta.subregion}` : ""}`,
    "",
    usedRequestedSubset
      ? "The following values match the Country Dashboard definitions (subset you asked about). Each line is the latest observation stored in this app for that indicator (data year on the line):"
      : "The following values match the Country Dashboard (World Bank WDI plus configured gap-fills). Each line is the latest observation stored in this app for that indicator (data year on the line):",
    "",
  ];
  for (const id of ids) {
    const pts = bundle[id] ?? [];
    const lv = latestValue(pts);
    if (!lv) continue;
    const label = METRIC_BY_ID[id]?.label ?? id;
    const valStr = formatAssistantMetricValue(id, lv.value);
    const yoy = yoyChange(pts);
    let line = `• ${label}: ${valStr} (data year ${lv.year})`;
    if (yoy !== null) line += `; YoY vs prior year: ${yoy.toFixed(1)}%`;
    lines.push(line);
  }
  return lines.join("\n");
}

app.post("/api/assistant/chat", async (req, res) => {
  try {
    const message = String(req.body?.message ?? "").trim();
    const cca3 = req.body?.countryCode ? String(req.body.countryCode).toUpperCase() : "";
    if (!message) return res.status(400).json({ error: "message required" });
    const providedGroqApiKey = readRequestApiKey(req, "groq");
    const providedTavilyApiKey = readRequestApiKey(req, "tavily");

    /** When true (UI “web-first” mode), never skip Tavily for platform-heavy intents so retrieval stays fresh. */
    const webSearchPriority =
      req.body?.webSearchPriority === true ||
      req.body?.webSearchPriority === "true" ||
      String(req.body?.assistantMode ?? "").toLowerCase() === "web_priority";

    const countries = await settleWithin(listCountries(), 10000, []);
    const intent = classifyAssistantIntent(message);
    const explicitCountryKeyword = /\b(selected country|named country|country\b)\b/i.test(message);
    const namedCountries = extractCountryCodesMentionedInText(
      message,
      countries,
      ASSISTANT_MAX_COMPARISON_COUNTRIES
    );
    const definitionMetricIds = resolveMetricDefinitionIds(message);
    if (questionLooksMetricDefinitionQuery(message) && !explicitCountryKeyword && namedCountries.length === 0) {
      const definitionReply = buildMetricDefinitionExpertReply(message, definitionMetricIds);
      if (definitionReply) {
        return res.json({
          reply: definitionReply,
          attribution: ["Definition mode: institutional metric definitions (no country scope requested)"],
          citations: { D: {}, W: {} },
        });
      }
    }
    const needsVerifiedWeb = questionNeedsLiveWebVerification(message);
    const sensitiveCountryFact = questionIsSensitiveCountryFact(message);
    let extractedCompare = extractComparisonCca3s(message, cca3, countries);
    if (extractedCompare.length < 2) {
      const scanned = extractCountryCodesMentionedInText(
        message,
        countries,
        ASSISTANT_MAX_COMPARISON_COUNTRIES
      );
      if (scanned.length >= 2 && questionLooksMetricAnchored(message)) {
        extractedCompare = scanned;
      }
    }
    const comparisonCodes = finalizeComparisonCodes(extractedCompare, cca3, message);
    const explicitlyMentionedCountryCodes = extractCountryCodesMentionedInText(
      message,
      countries,
      ASSISTANT_MAX_COMPARISON_COUNTRIES
    );
    const primaryMentionedCountryCode = explicitlyMentionedCountryCodes[0] ?? "";
    const comparisonMetricIds = extractAssistantComparisonMetricIds(message);
    const selectedCountryMacroTurn =
      messageAnchorsSelectedCountry(message) &&
      questionLooksMetricAnchored(message) &&
      comparisonCodes.length < 2;
    const preferWebPrimary = intentPrefersWebFirst(intent);
    const nameByCca3 = new Map(countries.map((c) => [c.cca3, c.name] as const));

    const intentLabel = (i: AssistantIntent): string => {
      switch (i) {
        case "statistics_drill":
          return needsVerifiedWeb
            ? "Statistics / ranking — platform first + live web (ephemeral facts in question)"
            : "Statistics / ranking — platform series first";
        case "country_compare":
          return needsVerifiedWeb
            ? "Country comparison — platform first + live web (ephemeral facts in question)"
            : "Country comparison — platform series first";
        case "country_overview":
          return "Country overview — statistics + optional web";
        default:
          return needsVerifiedWeb
            ? "General — live web grounding (officeholders / current events)"
            : "General — web + model first";
      }
    };

    const attribution: string[] = [
      `Intent: ${intentLabel(intent)}${webSearchPriority ? " · Web search prioritized (user mode)" : ""}`,
    ];

    const requestedFocusMetricIds = extractAssistantFocusMetricIds(message);
    const nonMetricWebTurn =
      !questionLooksMetricAnchored(message) &&
      !looksLikePovertyInternationalVsNationalComparison(message) &&
      comparisonCodes.length < 2 &&
      !looksLikeGlobalRankingQuery(message);
    const requestedFocusMetricIdsForFetch =
      requestedFocusMetricIds && requestedFocusMetricIds.length > 0 ? requestedFocusMetricIds : ASSISTANT_OVERVIEW_METRIC_IDS;
    const [dashFocus, rankingPayload, comparisonBlock] = await Promise.all([
      (async (): Promise<{
        block: string;
        meta?: CountrySummary;
        bundle?: Record<string, SeriesPoint[]>;
      }> => {
        if (!cca3 || !/^[A-Z]{3}$/.test(cca3)) return { block: "" };
        const [metaMaybe, bundle] = await Promise.all([
          getCountry(cca3),
          fetchCountryBundle(cca3, requestedFocusMetricIdsForFetch, MIN_DATA_YEAR, currentDataYear()),
        ]);
        const meta: CountrySummary =
          metaMaybe ??
          ({
            cca3,
            name: cca3,
            region: "",
            subregion: "",
            capital: [],
            population: 0,
            area: 0,
            latlng: [0, 0],
            flags: {},
            timezones: [],
            currencies: [],
          } satisfies CountrySummary);
        return {
          block: buildAssistantPrimaryDataBlock(meta, bundle, requestedFocusMetricIds),
          meta,
          bundle,
        };
      })(),
      buildAssistantRankingPayload(message, formatAssistantMetricValue, {
        focusCca3: /^[A-Z]{3}$/.test(cca3) ? cca3 : undefined,
      }),
      (async () => {
        if (comparisonCodes.length < 2) return "";
        const comparisonMetricIdsForFetch =
          comparisonMetricIds && comparisonMetricIds.length > 0 ? comparisonMetricIds : ASSISTANT_OVERVIEW_METRIC_IDS;
        const parts = (await Promise.all(
          comparisonCodes
            .slice(0, ASSISTANT_MAX_COMPARISON_COUNTRIES)
            .map(async (code) => {
              const [meta, bundle] = await Promise.all([
                getCountry(code),
                fetchCountryBundle(code, comparisonMetricIdsForFetch, MIN_DATA_YEAR, currentDataYear()),
              ]);
              return meta ? buildAssistantPrimaryDataBlock(meta, bundle, comparisonMetricIdsForFetch) : null;
            })
        )).filter((x): x is string => Boolean(x));
        return parts.length >= 2 ? parts.join("\n\n────────\n\n") : "";
      })(),
    ]);

    const dashboardBlock = dashFocus.block;
    const dashboardFocusMeta = dashFocus.meta;
    const dashboardFocusBundle = dashFocus.bundle;

    const rankingSection = rankingPayload?.plainBlock ?? "";
    const rankingMarkdownMain = rankingPayload?.markdownTable ?? "";
    const rankingMarkdownFocus = rankingPayload?.focusComparisonMarkdown?.trim() ?? "";
    const rankingMarkdown = [rankingMarkdownMain, rankingMarkdownFocus].filter(Boolean).join("\n\n");
    const rankingRequested = looksLikeGlobalRankingQuery(message);
    if (rankingRequested && !rankingPayload) {
      const quickRankables = [
        "GDP (Nominal, US$)",
        "GDP growth (annual %)",
        "GDP per capita (Nominal, US$)",
        "GNI per capita (Atlas method)",
        "Population",
        "Inflation",
        "Unemployment",
        "Government debt (% of GDP)",
        "Poverty headcount ($2.15/day)",
        "Life expectancy",
      ];
      const reply =
        `I can rank countries only on metrics available in this platform's catalog, and your requested ranking metric is not currently available.\n\n` +
        `Try one of these ranking metrics instead: ${quickRankables.join("; ")}.`;
      attribution.push("Ranking: requested metric not in platform catalog (no fallback substitution applied)");
      return res.json({ reply, attribution, citations: { D: {}, W: {} } });
    }
    if (rankingSection) {
      attribution.push(
        "Global ranking: full-country snapshot (same API path as dashboard global view; year may step back for WDI coverage)"
      );
    }
    if (comparisonBlock) {
      attribution.push(
        `Comparison: platform series for ${comparisonCodes.length} countries (max ${ASSISTANT_MAX_COMPARISON_COUNTRIES} per request)`
      );
    }

    const omitDuplicateDashboard =
      Boolean(comparisonBlock) && /^[A-Z]{3}$/.test(cca3) && comparisonCodes.includes(cca3);
    const focusMetricsInScope = questionInvokesFocusCountryPlatformMetrics(message, intent);
    // For non-metric, time-sensitive “who is in office right now” turns, avoid injecting
    // platform indicator snapshots that can distract the model from live excerpt grounding.
    const dashboardForPrompt =
      (intent === "general_web" && !questionLooksMetricAnchored(message)) || nonMetricWebTurn
        ? ""
        : omitDuplicateDashboard || !focusMetricsInScope
          ? ""
          : dashboardBlock;
    if (dashboardBlock.trim() && !focusMetricsInScope) {
      attribution.push("Platform: focus-country indicators omitted (question outside dashboard metric scope)");
    }

    const platformForTavilyFallback = (() => {
      const fm = dashboardFocusMeta;
      const fb = dashboardFocusBundle;
      if (fm && fb && looksLikePovertyInternationalVsNationalComparison(message)) {
        const t = buildPovertyInternationalVsNationalTable(`${fm.name} (${fm.cca3})`, fb);
        if (t) return t;
      }
      if (dashboardBlock.trim() && focusMetricsInScope) {
        const head = fm
          ? `**Latest platform indicators — ${fm.name} (${fm.cca3})**`
          : "**Latest platform indicators**";
        return `${head}\n\n${dashboardBlock}`;
      }
      return "";
    })();

    const hasAuthoritativePayload =
      Boolean(rankingSection) ||
      Boolean(comparisonBlock) ||
      (Boolean(dashboardBlock) && focusMetricsInScope);
    const tavilyConfigured = Boolean(providedTavilyApiKey || process.env.TAVILY_API_KEY?.trim());
    if (providedGroqApiKey) attribution.push("Auth: using user-provided Groq API key for this request");
    if (providedTavilyApiKey) attribution.push("Auth: using user-provided Tavily API key for this request");
    const metricScopedTurn =
      (intent === "statistics_drill" || intent === "country_compare" || questionLooksMetricAnchored(message)) &&
      !needsVerifiedWeb;
    const forceSkipWebForMetricTurn = tavilyConfigured && !webSearchPriority && metricScopedTurn;
    const skipWebForPlatform =
      nonMetricWebTurn
        ? false
        : (
      forceSkipWebForMetricTurn ||
      (!webSearchPriority &&
        tavilyConfigured &&
        shouldSkipTavilyForPlatformFirst(intent, hasAuthoritativePayload, message)));

    // If the user explicitly names another country, do not pollute web retrieval
    // with the currently selected dashboard country.
    const effectiveSearchAnchorCca3 =
      primaryMentionedCountryCode && primaryMentionedCountryCode !== cca3
        ? primaryMentionedCountryCode
        : cca3;
    const effectiveSearchAnchorName = effectiveSearchAnchorCca3
      ? nameByCca3.get(effectiveSearchAnchorCca3)
      : undefined;

    let webContext = "";
    if (tavilyConfigured && !skipWebForPlatform) {
      const webQuery = buildAssistantWebSearchQuery(
        message,
        intent,
        effectiveSearchAnchorCca3,
        comparisonCodes,
        nameByCca3,
        {
        boostVerifiedFact: needsVerifiedWeb,
      });
      /** Stats-only web supplement (narrow); disabled when the question mixes in ephemeral facts. */
      const statsSupplementWebOnly =
        intent === "statistics_drill" && !webSearchPriority && !needsVerifiedWeb;
      const today = utcDateISO();

      if (needsVerifiedWeb) {
        webContext = await tavilySearch(webQuery, 6, {
          searchDepth: "advanced",
          includeAnswer: "advanced",
          topic: "news",
          timeRange: "month",
          preferNewestSourcesFirst: true,
          allowedDomains: sensitiveCountryFact
            ? ASSISTANT_SENSITIVE_FACT_DOMAINS
            : ASSISTANT_CREDIBLE_DOMAINS,
          apiKey: providedTavilyApiKey,
        });
        if (isWebSearchContextThin(webContext)) {
          const y = String(new Date().getFullYear());
          const retry = await tavilySearch(
            `${message.replace(/\s+/g, " ").trim()} ${y} current officeholder confirmed news`,
            6,
            {
              searchDepth: "advanced",
              includeAnswer: "advanced",
              topic: "news",
              timeRange: "year",
              startDate: utcDateDaysAgo(400),
              endDate: today,
              preferNewestSourcesFirst: true,
              allowedDomains: sensitiveCountryFact
                ? ASSISTANT_SENSITIVE_FACT_DOMAINS
                : ASSISTANT_CREDIBLE_DOMAINS,
              apiKey: providedTavilyApiKey,
            }
          );
          if (!isWebSearchContextThin(retry)) webContext = retry;
          else if (retry.trim()) webContext = `${webContext}\n\n${retry}`.trim();
        }
        if (isWebSearchContextThin(webContext)) {
          const y = String(new Date().getFullYear());
          const wide = await tavilySearch(`${message.replace(/\s+/g, " ").trim()} ${y}`, 6, {
            searchDepth: "advanced",
            includeAnswer: "advanced",
            topic: "general",
            timeRange: "year",
            preferNewestSourcesFirst: true,
            allowedDomains: sensitiveCountryFact
              ? ASSISTANT_SENSITIVE_FACT_DOMAINS
              : ASSISTANT_CREDIBLE_DOMAINS,
            apiKey: providedTavilyApiKey,
          });
          if (wide.trim().length > webContext.trim().length) webContext = wide;
        }
        if (webContext) {
          attribution.push("Web: Tavily — verified current-affairs (multi-pass retrieval)");
        } else {
          attribution.push("Web: Tavily returned no usable context for verified-fact path");
        }
      } else {
        const strictStart =
          intent === "general_web" && !needsVerifiedWeb
            ? utcDateDaysAgo(21)
            : statsSupplementWebOnly
              ? utcDateDaysAgo(150)
              : utcDateDaysAgo(42);
        webContext = await tavilySearch(webQuery, statsSupplementWebOnly ? 5 : 6, {
          searchDepth: "advanced",
          includeAnswer: "advanced",
          topic: statsSupplementWebOnly ? "general" : "news",
          timeRange: statsSupplementWebOnly ? "month" : "week",
          startDate: strictStart,
          endDate: today,
          preferNewestSourcesFirst: true,
          allowedDomains: sensitiveCountryFact
            ? ASSISTANT_SENSITIVE_FACT_DOMAINS
            : ASSISTANT_CREDIBLE_DOMAINS,
          apiKey: providedTavilyApiKey,
        });
        if (!webContext.trim()) {
          webContext = await tavilySearch(webQuery, statsSupplementWebOnly ? 5 : 6, {
            searchDepth: "advanced",
            includeAnswer: "advanced",
            topic: statsSupplementWebOnly ? "general" : "news",
            timeRange: statsSupplementWebOnly ? "year" : "month",
            preferNewestSourcesFirst: true,
            allowedDomains: sensitiveCountryFact
              ? ASSISTANT_SENSITIVE_FACT_DOMAINS
              : ASSISTANT_CREDIBLE_DOMAINS,
            apiKey: providedTavilyApiKey,
          });
        }
        if (webContext) {
          attribution.push(
            preferWebPrimary
              ? "Web: Tavily (advanced) — primary context"
              : intent === "country_overview"
                ? "Web: Tavily — context alongside dashboard figures"
                : "Web: Tavily — supplementary context"
          );
        } else if (preferWebPrimary || intent === "country_overview") {
          attribution.push("Web: Tavily returned no usable context");
        }
      }
    } else if (skipWebForPlatform) {
      attribution.push("Web: skipped — platform data sufficient for this turn");
    } else if ((preferWebPrimary || intent === "country_overview" || needsVerifiedWeb) && !tavilyConfigured) {
      attribution.push("Web: TAVILY_API_KEY not set");
    }

    const webSearchThin = isWebSearchContextThin(webContext);
    const todayUtc = utcDateISO();
    const broadGeneralWebTurn =
      intent === "general_web" && !sensitiveCountryFact && !questionLooksMetricAnchored(message);

    const cited = compactAssistantRetrievalForLlm({
      dashboardForPrompt,
      comparisonBlock,
      rankingSection,
      webContext,
      webTopK: broadGeneralWebTurn ? 3 : 1,
      webRelevance: {
        message,
        countryName: effectiveSearchAnchorName ?? dashboardFocusMeta?.name,
        cca3:
          (effectiveSearchAnchorCca3 && /^[A-Z]{3}$/.test(effectiveSearchAnchorCca3)
            ? effectiveSearchAnchorCca3
            : undefined) ??
          dashboardFocusMeta?.cca3 ??
          (/^[A-Z]{3}$/.test(cca3) ? cca3 : undefined),
      },
    });
    const hasCitationKeys =
      Object.keys(cited.citations.D).length + Object.keys(cited.citations.W).length > 0;

    // Hard gate for non-metric time-sensitive turns: prefer deterministic web-grounded reply
    // over free-form generation to minimize hallucination and irrelevant spillover.
    if (needsVerifiedWeb) {
      const deterministicWebReply = buildDeterministicVerifiedWebReply(message, cited.webContext);
      if (deterministicWebReply) {
        attribution.push("Deterministic: verified-web reply path for time-sensitive non-metric question");
        return res.json({ reply: deterministicWebReply, attribution, citations: cited.citations });
      }
    }

    const deterministicReply = buildDeterministicRankingOrComparisonReply({
      intent,
      rankingSection,
      comparisonBlock,
      rankingMarkdown,
      cited: {
        rankingSection: cited.rankingSection,
        comparisonBlock: cited.comparisonBlock,
      },
      comparisonMetricIds,
    });
    if (deterministicReply) {
      attribution.push("Deterministic: platform-templated answer for ranking/comparison turn");
      const reply = rankingMarkdown
        ? `${rankingMarkdown.trim()}\n\n${deterministicReply}`.trim()
        : deterministicReply;
      return res.json({ reply, attribution, citations: cited.citations });
    }

    const deterministicDashboardTable = buildDeterministicDashboardMetricTableReply({
      message,
      dashboardBlock: dashboardBlock,
      intent,
      hasComparison: Boolean(comparisonBlock),
      hasRanking: Boolean(rankingSection),
      metricAnchored: questionLooksMetricAnchored(message) || selectedCountryMacroTurn,
    });
    if (deterministicDashboardTable) {
      attribution.push("Deterministic: platform metrics table for dashboard-oriented question");
      return res.json({ reply: deterministicDashboardTable, attribution, citations: cited.citations });
    }
    const citationInstruction = hasCitationKeys
      ? `

CITATIONS: In the context below, **platform** facts (dashboard + ranking rows) are prefixed with **[D1], [D2], …**. Live-web excerpts may appear as **[W1]**, **[W2]**, and **[W3]**. Use only tags that appear in this turn and put each tag right after the supported phrase. Do not quote the full labeled reference lines back to the user—the inline tags are enough.`
      : "";

    const humanVoice = `STYLE — read like a thoughtful human analyst, not a chatbot:
- **Direct and warm:** Answer the question in the first sentence or two when you can. Use natural connectors (“Meanwhile…”, “That compares with…”, “On a human-development note…”).
- **Cohesive:** Prefer **2–4 short paragraphs** of flowing prose. Use bullets only when comparing many countries or listing ranked takeaways—never as a default crutch.
- **Invisible machinery:** Never mention prompts, “blocks”, “Tavily”, “payload”, “web context”, “platform data section”, or apologize for what you were “given”.
- **Thread notes:** If you see lines starting with \`[Retrieval:\` or \`[Server:\`, treat them as private instructions—do **not** quote or summarize them to the user.
- **Numbers:** Fold statistics into sentences (“GDP reached about … in 2022 [D3]”)—do not read the list aloud or say “the data shows”. Use a **markdown table** only when **no** ranking leaderboard table is already shown above your text (e.g. multi-country comparisons). If a ranking table is already prepended to the reply, **never** add another pipe table.
- **No meta-footer:** Do not add a “Sources:” or bibliography block; use inline **[D#]** and at most **[W1]** when the context provides them, and the app maps those for the reader.
- **Recency:** When excerpts carry dates, prefer that timeline for current events; do not “correct” fresh reporting with older training intuition.`;

    const rankingTableRendered = Boolean(rankingMarkdown);
    const multiCountry = comparisonCodes.length >= 2;
    const namedMetricCount = comparisonMetricIds?.length ?? 0;

    const systemStatistics = `You are the Country Analytics Platform’s assistant—an experienced macro and data analyst talking to a colleague.

${humanVoice}

DATA FRESHNESS (platform / API / app database):
- Each indicator line is the **latest observation stored in this application** for that series; the **data year** printed on the line is that observation’s year (WDI and extensions can lag the calendar year—never invent a newer year than shown).
- For **metrics, database figures, or API-style indicators**, these lines override model memory and generic web snippets.

TRUTH (non-negotiable):
- Figures in the **official indicator snapshots**, **comparison set**, and **ranking** below are the source of truth for values and rank order. Never substitute memorized tables or guess missing numbers.
- If the user asks for a metric that is not listed, say so in one clear sentence and offer what you *can* say from the snapshot.
- Optional **recent excerpts** below are background only—they must not contradict those official figures.

When both a selected country and a ranking appear, rely on the prepended **markdown tables** for the ordered list and for **how the dashboard focus country compares** to #1 and to the ends of the shown slice.${
      rankingTableRendered
        ? `

RANKING (top / bottom / leaderboard): The user-visible reply **already starts with** platform-built **markdown table(s)** (ranked economies plus, when applicable, **dashboard focus vs leaderboard**). Your body must be **prose only**—**do not output any markdown pipe (\`|\`) tables** and do not re-list ranks, countries, or ISO3s as a table or bullet leaderboard. Use **[D#]** inline cites and interpret the prepended tables in words only.`
        : ""
    }${
      multiCountry && namedMetricCount >= 2
        ? `

MULTI-COUNTRY + MULTI-METRIC: Several economies and **multiple named indicators** appear below. Respond with **one consolidated GitHub-flavored markdown table** (countries × metrics or metrics × countries) using **only** numbers from the labeled lines, with **[D#]** tags on or beside cells.`
        : multiCountry
          ? `

MULTI-COUNTRY: Several economies appear below. If you compare them on **more than one metric**, use a **single markdown table** for the numeric side-by-side, with **[D#]** cites.`
          : ""
    }`;

    const systemWebPrimary = `You are the Country Analytics Platform’s assistant—curious, well-read, and careful with facts. The user’s question is general (places, institutions, culture, current affairs—not a spreadsheet task).

${humanVoice}

TRUTH (non-negotiable):
- **Today is ${todayUtc} (UTC).** For non-database topics, treat “latest” and “current” **relative to this date**; prioritize **recent excerpts** and their publication dates over stale training data.
- When **recent excerpts** below answer the question, lead with them; newer publication dates beat older ones when they conflict.
- If a **country indicator snapshot** is attached, use it only for hard economic/demographic numbers—and never override clearly dated breaking news from excerpts.
${needsVerifiedWeb ? (webSearchThin ? "- **Leadership:** Search came back thin. You may draw on general knowledge for stable facts, but for *who holds office right now* and *when they took office* you must not guess—say you could not verify from the retrieved excerpts and recommend official sources." : "- **Leadership / who is in office:** If excerpts name the officeholder and include any inauguration/assumption/take-office timing, treat that as authoritative over model cutoff knowledge. If a requested element (especially take-office timing) is not present in the excerpts, say you could not verify rather than inferring.") : "- If excerpts are thin, still be helpful; avoid inventing specific headlines or dates you did not see."}`;

    const ephemeralFactBlock =
      needsVerifiedWeb && !webSearchThin
        ? `

TIME-SENSITIVE ROLES: Offices change hands; trust dated excerpts in the thread over memory. If excerpts name the incumbent, state it plainly. If they do not, do not invent a name—point to official sources.`
        : needsVerifiedWeb && webSearchThin
          ? `

TIME-SENSITIVE ROLES: Retrieval was light—be candid about uncertainty on *current* officeholders; still help on history and context.`
          : "";

    const systemOverview = `You are the Country Analytics Platform’s assistant, drafting a **clear country briefing** for a busy reader.

${humanVoice}

TRUTH (non-negotiable):
- **Today is ${todayUtc} (UTC).** Blend **latest platform indicators** (each line is the newest year stored in the app for that series) with **fresh web context** dated relative to today.
- When indicator lines are present, they are the **spine** of the story **only if** the user wants a broad country picture or explicitly cares about macro/demographic facts. If they narrow the ask (culture-only, language, cuisine, sport, arts, etc.) without requesting economic statistics, lead with that topic and **do not** pad the answer with unrelated WDI-style metrics—at most one short factual clause if it truly helps.
- Excerpts add colour (politics, society, recent themes) but **do not replace** those numbers when numbers are on-topic. Prefer clearly dated material when sources disagree.
- If no snapshot is attached, avoid precise macro figures unless excerpts provide them.

Shape: open with what matters most about the place, develop with stats + context, end with one sentence on what to watch next. One continuous narrative arc.`;

    const systemCompare = `You are the Country Analytics Platform’s assistant, helping someone **compare countries** side by side.

${humanVoice}

DATA FRESHNESS: Each line below is the **latest stored value** in the app for that indicator (year on the line).

TRUTH (non-negotiable):
- **Only** the per-country indicator snapshots below may supply **numeric** comparisons. Contrast GDP, population, growth, inflation, unemployment, debt, life expectancy, literacy, etc. from those lines—**every country with a section** deserves coverage, not just the first two.
- When **two or more metrics** matter for the question, lead with **one consolidated markdown table** (countries as rows, indicators as columns—or the transpose) and optional short prose; use **[D#]** cites.
- If only one or two metrics dominate, a **compact markdown table** still beats long bullet lists.
- If a country’s snapshot is missing, say so once—never back-fill from memory.
- Excerpts are qualitative seasoning only.

Open with the sharpest contrast, then walk the reader through the rest with explicit country names and the exact figures that matter.`;

    const systemBase =
      intent === "general_web" || nonMetricWebTurn
        ? systemWebPrimary
        : intent === "country_overview"
          ? systemOverview
          : intent === "country_compare"
            ? systemCompare
            : systemStatistics;

    const platformDataScopeSuffix = `

DATA SCOPE (non-negotiable): **[D#]** tags and any **Official indicators** / ranking / comparison lines in this thread are the **only** figures that come from this application’s database/APIs. Use them **only** to support claims they directly answer—never as filler when the user asked about something else (culture, sport, biography, offices, etc.). If the question is outside that numeric scope, answer from web excerpts and proportionate general knowledge without inventing or importing unrelated dashboard statistics. Never tell the user a number is “from the platform” unless it appears on a **[D#]** line you cite.`;

    const nonDashboardWebFormatBlock = broadGeneralWebTurn
      ? `

FORMAT FOR THIS TURN:
- Keep the majority of the response as direct, accurate answer prose.
- End with a short **Sources** section (max 3 bullets) using simple markdown hyperlinks from available [W#] citations only.
- Keep source links concise and clearly shorter than the answer body.`
      : "";

    const system = `${systemBase}${ephemeralFactBlock}${citationInstruction}${platformDataScopeSuffix}${nonDashboardWebFormatBlock}`;

    const verifiedRetrievalNote =
      needsVerifiedWeb && webSearchThin && tavilyConfigured
        ? "\n\n[Retrieval: live search returned no substantive excerpts. Answer helpfully using general knowledge where appropriate; for current officeholders or very recent elections, add a short caveat that the user should verify on official or major news sources.]\n"
        : "";
    const noTavilyVerifiedNote =
      needsVerifiedWeb && !tavilyConfigured
        ? "\n\n[Server: live web search is not configured on this deployment. Answer from general knowledge where you can; for who holds office now or very recent political events, clearly caveat uncertainty and suggest official government or major news sources.]\n"
        : "";

    const user = `## Reference
- **Today (UTC):** ${todayUtc}
- **Platform metrics:** When a focus-country snapshot is included below, each line is the **latest year stored in this app** for that series (year on the line). Ranking tables use the snapshot year in the caption. If the focus snapshot is **(none)** because the question is outside dashboard scope, do **not** treat this app as a source for macro figures—use excerpts and general knowledge only.
- **Non-metric / general questions:** Prefer **recent web excerpts** and their dates as “latest” relative to today.

## What they asked
${message}

## Official indicators — focus country (empty if none selected)
${cited.dashboardForPrompt || "(none)"}

## Official indicators — comparison set (empty if not a comparison question)
${cited.comparisonBlock || "(none)"}

## Global ranking snapshot (empty if not a ranking question)
${cited.rankingSection || "(none)"}

## Recent research excerpts (may be empty; use for context and current events, without contradicting official indicators above)
${cited.webContext || "(none)"}${verifiedRetrievalNote}${noTavilyVerifiedNote}${
      looksLikePovertyInternationalVsNationalComparison(message)
        ? `

## Instruction — international vs national poverty
Use **Poverty headcount at $2.15 (2017 PPP)** (international) and **Poverty headcount at national poverty lines** (national) from the platform snapshot when both appear. Answer for the **focus country named in the snapshot**—never substitute another country unless the user explicitly named it. Prefer **one compact markdown table** (indicator, value, data year) plus a short interpretation; cite facts with **[D#]** from the labeled lines only.`
        : ""
    }${
      rankingMarkdown.trim()
        ? `

## Reply format (mandatory)
The message the user sees **opens with** the platform’s ranking markdown table(s) before your text. **Do not include markdown pipe tables in your answer**—write **prose only** with **[D#]** tags. Summarize takeaways; never recreate the leaderboard.`
        : ""
    }`;

    const userForLlm = clampAssistantUserForLlm(user);
    if (userForLlm.length < user.length) {
      attribution.push("Context: prompt trimmed to stay within LLM context limits (full tables may appear above the reply)");
    }

    let assistantLlmText: string | null = null;
    if (providedGroqApiKey || process.env.GROQ_API_KEY) {
      try {
        const { text, model, primaryFailed } = await groqChatWithFallbackForUseCase(
          "assistant",
          system,
          userForLlm,
          {
            temperature: needsVerifiedWeb && !webSearchThin ? 0.22 : groqTemperatureForIntent(intent),
            topP: needsVerifiedWeb && !webSearchThin ? 0.82 : 0.86,
            timeoutMs: 20_000,
            maxModelAttempts: 2,
            analyticsRecencyHint:
              (needsVerifiedWeb && !webSearchThin) ||
              intent === "general_web" ||
              intent === "country_overview",
            apiKey: providedGroqApiKey,
          }
        );
        attribution.push(
          primaryFailed
            ? `LLM: Groq — Assistant stack (${model}, fallback after primary error/rate limit)`
            : `LLM: Groq — Assistant stack (${model})`
        );
        assistantLlmText = polishAssistantLlmReply(text);
        if (rankingMarkdown.trim()) {
          assistantLlmText = stripRedundantRankingTablesFromLlmMarkdown(assistantLlmText);
          assistantLlmText = polishAssistantLlmReply(assistantLlmText);
        }
        if (hasCitationKeys && !assistantReplyContainsCitationTag(assistantLlmText)) {
          attribution.push("Safety: model draft lacked citation tags; retrying with strict citation-only instruction");
          try {
            const strictSystem = `${system}

CITATION ENFORCEMENT (mandatory):
- Every factual sentence must include at least one inline [D#] or [W1] tag from this turn.
- Do not output headings that restate raw context blocks.
- Keep the answer concise and directly scoped to the user question.`;
            const retry = await groqChatWithFallbackForUseCase("assistant", strictSystem, userForLlm, {
              temperature: 0.18,
              topP: 0.8,
              timeoutMs: 15_000,
              maxModelAttempts: 1,
              analyticsRecencyHint:
                (needsVerifiedWeb && !webSearchThin) ||
                intent === "general_web" ||
                intent === "country_overview",
              apiKey: providedGroqApiKey,
            });
            assistantLlmText = polishAssistantLlmReply(retry.text);
            if (rankingMarkdown.trim()) {
              assistantLlmText = stripRedundantRankingTablesFromLlmMarkdown(assistantLlmText);
              assistantLlmText = polishAssistantLlmReply(assistantLlmText);
            }
          } catch {
            // Fall through to grounded fallback below.
          }
          if (hasCitationKeys && !assistantReplyContainsCitationTag(assistantLlmText)) {
            attribution.push("Safety: strict citation retry failed; switched to compact grounded fallback");
            assistantLlmText = buildAssistantGroundedFallbackFromCited({
              asked: message,
              focusBlock: cited.dashboardForPrompt,
              comparisonBlock: cited.comparisonBlock,
              rankingBlock: cited.rankingSection,
              webBlock: cited.webContext,
              includeWeb: !metricScopedTurn,
            });
          }
        }

        // Extra anti-hallucination gate for "live/real-time verified" intents:
        // the reply must actually use the live excerpt tag ([W1]) for any time-sensitive sentences.
        const webTagKeys = Object.keys(cited.citations.W);
        const liveWebAvailable = needsVerifiedWeb && webTagKeys.length > 0;
        if (liveWebAvailable) {
          const missingW1 = !/\[W1\]/.test(assistantLlmText);
          const timeSensitiveMissingW1 = assistantReplyTimeSensitiveMentionsWithoutWebCitation(assistantLlmText, {
            webTag: "[W1]",
          });
        const officeholderCoverageFails =
          needsVerifiedWeb && assistantReplyOfficeholderCoverageFails({ asked: message, reply: assistantLlmText, webTag: "[W1]" });
        if (missingW1 || timeSensitiveMissingW1 || officeholderCoverageFails) {
            attribution.push(
              "Safety: verified web reply missing [W1] for time-sensitive statements; returned grounded evidence-only fallback"
            );
            assistantLlmText = buildAssistantGroundedFallbackFromCited({
              asked: message,
              focusBlock: cited.dashboardForPrompt,
              comparisonBlock: cited.comparisonBlock,
              rankingBlock: cited.rankingSection,
              webBlock: cited.webContext,
              includeWeb: !metricScopedTurn,
            });
          }
        }
      } catch (groqErr) {
        const brief = groqErr instanceof Error ? groqErr.message : String(groqErr);
        attribution.push(`LLM: Groq exhausted (${brief.slice(0, 220)}${brief.length > 220 ? "…" : ""})`);
        if (tavilyConfigured) {
          const { text, hasSynthesis } = await tavilyAssistantFallbackReply({
            message,
            countryName: effectiveSearchAnchorName ?? dashboardFocusMeta?.name,
            cca3:
              (effectiveSearchAnchorCca3 && /^[A-Z]{3}$/.test(effectiveSearchAnchorCca3)
                ? effectiveSearchAnchorCca3
                : undefined) ??
              dashboardFocusMeta?.cca3 ??
              (/^[A-Z]{3}$/.test(cca3) ? cca3 : undefined),
            platformSectionMarkdown: platformForTavilyFallback.trim() || undefined,
            tavilyApiKey: providedTavilyApiKey,
          });
          attribution.push(
            hasSynthesis
              ? "Fallback: Tavily answer synthesis (all Groq models failed or rate-limited)"
              : "Fallback: Tavily retrieval only (all Groq models failed; weak synthesis)"
          );
          assistantLlmText = polishAssistantLlmReply(text);
          if (rankingMarkdown.trim()) {
            assistantLlmText = stripRedundantRankingTablesFromLlmMarkdown(assistantLlmText);
            assistantLlmText = polishAssistantLlmReply(assistantLlmText);
          }
        }
      }
    }

    if (assistantLlmText !== null) {
      if (hasCitationKeys && !assistantReplyContainsCitationTag(assistantLlmText)) {
        attribution.push("Safety: final assistant text had no citation tags; returned compact grounded fallback");
        assistantLlmText = buildAssistantGroundedFallbackFromCited({
          asked: message,
          focusBlock: cited.dashboardForPrompt,
          comparisonBlock: cited.comparisonBlock,
          rankingBlock: cited.rankingSection,
          webBlock: cited.webContext,
          includeWeb: !metricScopedTurn,
        });
      }

      // Non-metric general-web turns should not drift back into platform-metric padding.
      if ((intent === "general_web" || nonMetricWebTurn) && assistantReplyContainsPlatformCitation(assistantLlmText)) {
        attribution.push("Safety: web-mode reply drifted into platform metric citations; returned web-grounded fallback");
        assistantLlmText = buildAssistantGroundedFallbackFromCited({
          asked: message,
          focusBlock: "",
          comparisonBlock: "",
          rankingBlock: "",
          webBlock: cited.webContext,
          includeWeb: true,
        });
      }

      // Final verified-web gate in case the response was produced by a different path.
      const webTagKeys = Object.keys(cited.citations.W);
      const liveWebAvailable = needsVerifiedWeb && webTagKeys.length > 0;
      if (liveWebAvailable) {
        const missingW1 = !/\[W1\]/.test(assistantLlmText);
        const timeSensitiveMissingW1 = assistantReplyTimeSensitiveMentionsWithoutWebCitation(assistantLlmText, {
          webTag: "[W1]",
        });
        const officeholderCoverageFails =
          needsVerifiedWeb &&
          assistantReplyOfficeholderCoverageFails({ asked: message, reply: assistantLlmText, webTag: "[W1]" });
        if (missingW1 || timeSensitiveMissingW1 || officeholderCoverageFails) {
          attribution.push(
            "Safety: final verified web reply missing [W1] for time-sensitive sentences; returned grounded evidence-only fallback"
          );
          assistantLlmText = buildAssistantGroundedFallbackFromCited({
            asked: message,
            focusBlock: cited.dashboardForPrompt,
            comparisonBlock: cited.comparisonBlock,
            rankingBlock: cited.rankingSection,
            webBlock: cited.webContext,
            includeWeb: !metricScopedTurn,
          });
        }
      }
      const reply = rankingMarkdown
        ? `${rankingMarkdown.trim()}\n\n${assistantLlmText}`.trim()
        : assistantLlmText;
      return res.json({ reply, attribution, citations: cited.citations });
    }

    const fallbackParts: string[] = [];
    if (rankingMarkdown) {
      fallbackParts.push(rankingMarkdown);
    } else if (rankingSection) {
      fallbackParts.push(`**Global ranking (platform API)**\n\n${rankingSection}`);
    }
    if (comparisonBlock) {
      fallbackParts.push(`**Comparison (platform API)**\n\n${comparisonBlock}`);
    }
    if (dashboardForPrompt && !nonMetricWebTurn) {
      fallbackParts.push(`**Selected country (platform API)**\n\n${dashboardForPrompt}`);
    }
    const fallback =
      fallbackParts.length > 0
        ? `${fallbackParts.join("\n\n---\n\n")}\n\nSet GROQ_API_KEY for a fuller narrative.`
        : `Select a country (ISO3) for country-level metrics, ask a top-N ranking (e.g. top countries by GDP), or set GROQ_API_KEY for general Q&A without fabricated statistics.`;

    res.json({ reply: fallback, attribution, citations: cited.citations });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

function buildDataDigest(
  countryName: string,
  bundle: Record<string, { year: number; value: number | null }[]>
): string {
  const keys = [
    "gdp_growth",
    "inflation",
    "gov_debt_pct_gdp",
    "life_expectancy",
    "gdp_per_capita",
    "gni_per_capita_atlas",
    "population",
    "literacy_adult",
    "unemployment_ilo",
  ];
  const lines: string[] = [`Country: ${countryName}`];
  for (const k of keys) {
    const lv = latestValue(bundle[k] ?? []);
    if (lv) lines.push(`${k} (${lv.year}): ${lv.value}`);
  }
  return lines.join("\n");
}

app.post("/api/analysis/pestel", async (req, res) => {
  try {
    const providedGroqApiKey = readRequestApiKey(req, "groq");
    const providedTavilyApiKey = readRequestApiKey(req, "tavily");
    const cca3 = String(req.body?.countryCode ?? "").toUpperCase();
    const year = req.body?.year
      ? clampYear(parseInt(String(req.body.year), 10))
      : clampYear(currentDataYear() - 1);
    if (!/^[A-Z]{3}$/.test(cca3)) return res.status(400).json({ error: "countryCode (ISO3) required" });
    const [meta, bundle, profile] = await Promise.all([
      fetchEnrichedCountryMeta(cca3),
      fetchCountryBundle(cca3, allMetricIds(), MIN_DATA_YEAR, currentDataYear()),
      fetchWbCountryProfile(cca3),
    ]);
    const digest = buildPestelLlmDigest(meta?.name ?? cca3, bundle);
    const attribution: string[] = ["PESTEL anchored on World Bank development indicators (dashboard series)"];
    const fallback = buildDataOnlyPestel(meta?.name ?? cca3, cca3, digest, bundle, meta, profile);

    let web = "";
    if (providedTavilyApiKey || process.env.TAVILY_API_KEY?.trim()) {
      const name = meta?.name ?? cca3;
      const y = String(year);
      const calY = String(new Date().getFullYear());
      const today = utcDateISO();
      const startNews = utcDateDaysAgo(75);
      const startGeneral = utcDateDaysAgo(200);
      const tavilyBase = { searchDepth: "advanced" as const, includeAnswer: "advanced" as const };
      const queries: { label: string; q: string; topic: "general" | "news" }[] = [
        {
          label: "Politics & institutions",
          q: `${name} government politics policy election reform law latest news ${y} ${calY}`,
          topic: "news",
        },
        {
          label: "Economy & markets",
          q: `${name} economy GDP inflation central bank investment trade latest ${y} ${calY}`,
          topic: "news",
        },
        {
          label: "Society & human capital",
          q: `${name} demographics education health labor workforce social policy latest ${calY}`,
          topic: "general",
        },
        {
          label: "Technology, energy & environment",
          q: `${name} technology innovation energy climate sustainability policy latest ${calY}`,
          topic: "general",
        },
        {
          label: "Legal, regulatory & compliance",
          q: `${name} law regulation compliance court reform business licensing tax policy latest ${calY}`,
          topic: "news",
        },
        {
          label: "Multilateral & official economic context",
          q: `World Bank ${name} economy development overview ${y} site:data.worldbank.org OR ${name} IMF Article IV ${calY}`,
          topic: "general",
        },
      ];
      const blocks = await Promise.all(
        queries.map(({ q, topic }) =>
          tavilySearch(q, 5, {
            ...tavilyBase,
            topic,
            timeRange: topic === "news" ? "week" : "month",
            startDate: topic === "news" ? startNews : startGeneral,
            endDate: today,
            preferNewestSourcesFirst: true,
            allowedDomains: [...PESTEL_CREDIBLE_DOMAINS],
            apiKey: providedTavilyApiKey,
          })
        )
      );
      const webParts: string[] = [];
      for (let i = 0; i < queries.length; i++) {
        const b = blocks[i]?.trim();
        if (b) webParts.push(`### ${queries[i]!.label}\n${b}`);
      }
      web = webParts.join("\n\n");
      if (web) attribution.push("Web context: Tavily (6 topic bundles × 5 results, advanced retrieval, recency-biased)");
    }

    const todayIso = utcDateISO();
    const webFull = web;
    /** Groq rejects oversized user payloads (413); grounding / Tavily-only paths still use the full bundle. */
    const PESTEL_LLM_WEB_CAP = 26_000;
    const { text: webForLlm, truncated: sourceBTruncated } = truncatePestelSourceBForLlm(webFull, PESTEL_LLM_WEB_CAP);
    if (sourceBTruncated) {
      attribution.push(
        `NOTICE: Web research bundle trimmed to ${PESTEL_LLM_WEB_CAP} chars for Groq limits — full text kept for grounding & Tavily fallback`
      );
    }
    const webPresent = Boolean(webFull.trim());
    const webIsThin = webFull.trim().length < 900;
    const hasTemporalWindows = webFull.includes("Multi-horizon web research");
    const staticProfile = [
      `Government type (country profile): ${meta?.government ?? "—"}`,
      meta?.headOfGovernmentTitle ? `Head of government role: ${meta.headOfGovernmentTitle}` : null,
      `Region: ${meta?.region ?? "—"}${meta?.subregion ? ` · Subregion: ${meta.subregion}` : ""}`,
      `World Bank income level: ${profile?.incomeLevel ?? "—"}${profile?.incomeLevelId ? ` (${profile.incomeLevelId})` : ""}`,
      typeof meta?.area === "number" ? `Land area (km², country profile): ${meta.area}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const narrativeRules = `
SCOPE: You analyze **only** ${meta?.name ?? cca3} (${cca3}). Do not substitute another country’s facts. Regional peers may be mentioned only as comparison, without attributing their statistics to this country.

VOICE & CLIENT OUTPUT (non-negotiable):
- Write for **executives and board readers**: cohesive, fluid **memo-style** prose. Every JSON string you output is **client-facing**—never paste internal retrieval labels, markdown headings from the research bundle, bracketed “model notes,” or engineering terms.
- **Forbidden in user-visible text:** “SOURCE A”, “SOURCE B”, “Source A/B”, “STATIC PROFILE”, “Past 7 days”, “Past 1 month”, “temporal window”, subsection titles from the web bundle, or raw “YYYY-MM-DD → YYYY-MM-DD” range lines. Instead use natural language, e.g. “Official series show … (year)”, “Recent reporting suggests …”, “Over the last several months …”, “Longer-run patterns indicate …”.
- Typography rule: never use the em-dash character (—) or en-dash character (–) in output strings; use commas, parentheses, or a plain hyphen instead.
- **Also avoid** product/engineering scaffolding in client strings: “From platform metadata”, “Data layer:”, “REST Countries”, “WDI-backed”, “the application’s … series”—write as a consultant would (“the reference profile …”, “reported indicators …”, “official development statistics …”).
- Weave **platform statistics** and **web themes** into single flowing sentences; do not structure bullets as “(1) data (2) web (3) implication” explicitly.

ANTI-HALLUCINATION (hard rules — violations invalidate the output):
- **No numbers** (%, GDP, population, rates, years as data claims, rankings) unless they appear in the **platform INDICATORS** block, the **country profile** lines, or **explicitly** in web research snippets below. Never pull statistics from model training memory.
- **Year discipline:** For any digest/WDI statistic, the **year cited must match the INDICATORS line** for that metric (see VALID DATA YEARS below). Do not label 2024 data as 2026 or use a future year as an observation year.
- **No named people** (heads of state, ministers, CEOs, party leaders) unless that **exact name** appears in web excerpts. Otherwise use generic roles (“the government”, “the central bank”) or omit.
- **No specific events** (election outcomes, coups, deals, sanctions) unless web excerpts support them. If unsupported, do not invent—use conditional language (“Where coverage mentions …”) or omit.
- **No fake citations** (“studies show”, “reports indicate”) unless traceable to excerpt wording. For quantitative claims from the indicator list, prefer “Series show … (year …)”.
- Web excerpts are **unverified** third-party text: if they conflict, note uncertainty briefly; do not fabricate reconciliation.
- Do **not** use blanket dismissals such as “No specific recent web sources were identified as of ${todayIso}” unless **all** web research below is effectively empty (no substantive synthesis or snippets anywhere). If material exists, you **must** use it in fluid prose **without** naming internal buckets.

NARRATIVE & EVIDENCE ORDER (internal discipline—do not label this in the JSON):
- Today's date is **${todayIso} (UTC)**. Prefer **newer** published dates in snippets when they conflict with older lines.
- **Logical flow** in each bullet/paragraph: anchor with **verified platform metrics + year** where relevant; add **web-based** qualitative colour only when excerpts support it; close with a **brief** implication stated as your judgment, not as new facts.
${
  hasTemporalWindows
    ? `
- The web bundle includes **multi-horizon slices** (very recent through multi-year lenses) for synthesis only. **Integrate** findings across time naturally (e.g. “near-term press”, “over the past year”, “longer structural trends”)—**never** quote the slice headings or date-range stamps verbatim in client text.`
    : ""
}
${
  webPresent
    ? ""
    : `
- **No web research** is available. Do **not** invent internet-era facts. For every PESTEL comprehensive subsection except Executive summary: paragraph 2 must be **one or two short sentences** stating that live web context was not available and that qualitative colour rests on platform indicators and country profile only. Executive summary paragraph 2 may say once that live web context was unavailable.`
}
- PESTEL & SWOT bullets: tight, analytical mini-paragraphs; no laundry lists of internal labels.
- For each bullet, follow this logic: (1) evidence-backed claim, (2) why it matters for business execution, risk, or investment sequencing. Avoid generic observations without implications.
- Comprehensive & strategicBusiness: **exactly two paragraphs** each (blank line between), each paragraph reads as **one continuous argument**, not a labeled outline.
- TECHNOLOGICAL: use literacy / enrollment / education spend from **indicators** for skills; never use GDP per capita as digital adoption. Digital policy themes only when web excerpts support them.
- strategicBusiness: four distinct voices; no duplicated closings across quadrants.
- **SWOT integrity:** Each quadrant must contain **five genuinely distinct** points. **Do not** repeat, paraphrase, or paste the same idea across strengths, weaknesses, opportunities, or threats. If a fact could fit two quadrants, place it **once** where it is strongest and develop a **different** angle for the other quadrant.`;

    const jsonSchemaHint = `Return ONLY a JSON object (no markdown) with exactly this structure (counts are strict). All string values must read as **polished analyst prose**—no internal labels (see VOICE rules above).
{
  "pestelDimensions": [
    {"letter":"P","label":"POLITICAL","bullets":["EXACTLY 5 fluent bullets blending verified indicators with web themes where supported"]},
    {"letter":"E","label":"ECONOMIC","bullets":["EXACTLY 5"]},
    {"letter":"S","label":"SOCIOCULTURAL","bullets":["EXACTLY 5"]},
    {"letter":"T","label":"TECHNOLOGICAL","bullets":["EXACTLY 5"]},
    {"letter":"E","label":"ENVIRONMENTAL","bullets":["EXACTLY 5"]},
    {"letter":"L","label":"LEGAL","bullets":["EXACTLY 5"]}
  ],
  "swot": {
    "strengths": ["EXACTLY 5 coherent bullets"],
    "weaknesses": ["EXACTLY 5"],
    "opportunities": ["EXACTLY 5"],
    "threats": ["EXACTLY 5"]
  },
  "comprehensiveSections": [
    {"title":"Executive summary","body":"EXACTLY two flowing paragraphs (blank lines between): macro snapshot from official series with years; cross-cutting themes from recent coverage as of ${todayIso}; outlook and what to monitor."},
    {"title":"Political factors","body":"EXACTLY two integrated paragraphs: anchors from indicators/profile plus web-supported political context, and then implications."},
    {"title":"Economic factors","body":"EXACTLY two paragraphs: same integrated pattern."},
    {"title":"Sociocultural factors","body":"EXACTLY two paragraphs: same pattern."},
    {"title":"Technological factors","body":"EXACTLY two paragraphs: same pattern."},
    {"title":"Environmental factors","body":"EXACTLY two paragraphs: same pattern."},
    {"title":"Legal factors","body":"EXACTLY two paragraphs: same pattern."}
  ],
  "strategicBusiness": [
    {"title":"Strengths","paragraphs":["EXACTLY two strings: grounded strengths, external validation from coverage and how to operationalize"]},
    {"title":"Weaknesses","paragraphs":["EXACTLY two strings: data gaps or structural frictions and external risks from coverage, plus mitigation"]},
    {"title":"Opportunities","paragraphs":["EXACTLY two strings: indicator-backed openings with catalysts from coverage, plus sequencing"]},
    {"title":"Threats","paragraphs":["EXACTLY two strings: dashboard risk signals with external shocks from coverage, plus resilience"]}
  ],
  "newMarketAnalysis": ["EXACTLY 5 bullets for market entry / expansion"],
  "keyTakeaways": ["EXACTLY 5 bullets"],
  "recommendations": ["EXACTLY 5 actionable bullets (Key recommendations)"]
}`;

    const validYearsLine = pestelAllowedDataYearsHint(bundle);

    const prompt = `Country: ${meta?.name ?? cca3} (${cca3}). Context year for digest alignment: ${year}. **Calendar "as of today" for web layer: ${todayIso} (UTC).**
${narrativeRules}

VALID DATA YEARS (mandatory):
${validYearsLine}

${jsonSchemaHint}

STATIC PROFILE (API ground truth — do not contradict):
${staticProfile}

PLATFORM INDICATORS — Latest non-null year per series (ground all numeric claims here unless the same figure appears in web excerpts):
${digest}

WEB RESEARCH EXCERPTS — Live retrieval as of ${todayIso} (may be empty). Synthesize into fluent prose; use only supported themes—never invent details:
${webForLlm || "(none — no web excerpts; follow empty-web rules above)"}`;

    const buildDeterministicPestelBlend = async (
      reasonLabel: string
    ): Promise<{ analysis: PestelAnalysis; attributionLabel?: string }> => {
      if ((providedTavilyApiKey || process.env.TAVILY_API_KEY?.trim()) && webFull.trim()) {
        let tavilyPartial: Partial<PestelAnalysis> | null = buildPartialPestelFromTavilyWeb(webFull);
        const swotP = await fetchPestelSwotPartialFromTavily(meta?.name ?? cca3, year, providedTavilyApiKey);
        if (tavilyPartial && swotP) tavilyPartial = mergePestelPartials(tavilyPartial, swotP);
        else if (!tavilyPartial) tavilyPartial = swotP ?? null;
        if (tavilyPartial) {
          const groundingCtx = { bundle, digest, staticProfile, web: webFull };
          const { partial: groundedPartial, droppedFragments } = sanitizePestelPartial(tavilyPartial, groundingCtx);
          if (droppedFragments > 0) {
            attribution.push(
              `Grounding filter removed ${droppedFragments} fragment(s) not supported by indicators, profile, or web corpus`
            );
          }
          return {
            analysis: mergePestelAnalysis(groundedPartial, fallback),
            attributionLabel: `${reasonLabel}: deterministic Tavily+data blend`,
          };
        }
      }
      return { analysis: fallback, attributionLabel: `${reasonLabel}: deterministic data scaffold` };
    };

    // Hallucination-safe mode: always return deterministic evidence-only synthesis
    // (dashboard indicators + filtered Tavily snippets), never free-form JSON generation.
    const deterministic = await buildDeterministicPestelBlend("PESTEL");
    attribution.push("Generation mode: deterministic evidence synthesis (LLM narrative disabled for reliability)");
    if (deterministic.attributionLabel) attribution.push(deterministic.attributionLabel);
    res.json({ analysis: deterministic.analysis, attribution });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/analysis/porter", async (req, res) => {
  try {
    const providedGroqApiKey = readRequestApiKey(req, "groq");
    const providedTavilyApiKey = readRequestApiKey(req, "tavily");
    const cca3 = String(req.body?.countryCode ?? "").toUpperCase();
    const year = req.body?.year
      ? clampYear(parseInt(String(req.body.year), 10))
      : clampYear(currentDataYear() - 1);
    const industrySector = String(req.body?.industrySector ?? "10 - Manufacture of food products").trim();
    if (!/^[A-Z]{3}$/.test(cca3)) return res.status(400).json({ error: "countryCode (ISO3) required" });

    const [meta, bundle, profile] = await Promise.all([
      fetchEnrichedCountryMeta(cca3),
      fetchCountryBundle(cca3, allMetricIds(), MIN_DATA_YEAR, currentDataYear()),
      fetchWbCountryProfile(cca3),
    ]);
    const digest = buildDataDigest(meta?.name ?? cca3, bundle);
    const attribution: string[] = ["Porter scaffold from macro/demographic indicators (proxy view)"];
    const fallback = buildDataOnlyPorter(
      meta?.name ?? cca3,
      cca3,
      industrySector,
      digest,
      bundle,
      meta,
      profile
    );

    let webFull = "";
    if (providedTavilyApiKey || process.env.TAVILY_API_KEY?.trim()) {
      const name = meta?.name ?? cca3;
      const calY = String(new Date().getFullYear());
      const today = utcDateISO();
      const startNews = utcDateDaysAgo(90);
      const startGeneral = utcDateDaysAgo(200);
      const tavilyBase = { searchDepth: "advanced" as const, includeAnswer: "advanced" as const };
      const queries: { label: string; q: string; topic: "general" | "news" }[] = [
        {
          label: "Regulation, trade, investment & entry barriers",
          q: `${name} ${industrySector} regulation FDI trade policy licensing barriers to entry ${calY}`,
          topic: "general",
        },
        {
          label: "Industry competition & market structure",
          q: `${name} ${industrySector} Porter five forces competitive rivalry market structure M&A consolidation ${year} ${calY}`,
          topic: "news",
        },
        {
          label: "Supply chain, suppliers, buyers & demand",
          q: `${name} ${industrySector} supply chain input costs consumers retailers buyer power ${calY}`,
          topic: "general",
        },
      ];
      const [blocks, temporalBlock] = await Promise.all([
        Promise.all(
          queries.map(({ q, topic }) =>
            tavilySearch(q, 6, {
              ...tavilyBase,
              topic,
              timeRange: topic === "news" ? "month" : "month",
              startDate: topic === "news" ? startNews : startGeneral,
              endDate: today,
              preferNewestSourcesFirst: true,
              apiKey: providedTavilyApiKey,
            })
          )
        ),
        fetchPorterTemporalHorizonWeb(name, cca3, industrySector, year, providedTavilyApiKey),
      ]);
      const webParts: string[] = [];
      for (let i = 0; i < queries.length; i++) {
        const b = blocks[i]?.trim();
        if (b) webParts.push(`### ${queries[i]!.label}\n${b}`);
      }
      webFull = webParts.join("\n\n");
      if (!webFull.trim()) {
        webFull = await tavilySearch(
          `${name} ${industrySector} industry market competition trends Porter analysis ${year} ${calY}`,
          8,
          {
            searchDepth: "advanced",
            includeAnswer: "advanced",
            topic: "general",
            timeRange: "year",
            preferNewestSourcesFirst: true,
            apiKey: providedTavilyApiKey,
          }
        );
      }
      if (temporalBlock.trim()) {
        webFull = webFull.trim() ? `${webFull.trim()}\n\n${temporalBlock.trim()}` : temporalBlock.trim();
        attribution.push(
          "Tavily: Porter five publication windows (7d, 1mo, 6mo, 1y, 5y) for industry five-forces context"
        );
      }
      if (webFull.trim()) attribution.push("Web context: Tavily (multi-topic industry retrieval + fallback if needed)");
    }

    const todayIso = utcDateISO();
    const hasTemporalWindows = webFull.includes(PORTER_TEMPORAL_SECTION_MARKER);
    const PORTER_LLM_WEB_CAP = 26_000;
    const { text: webForLlm, truncated: porterWebTruncated } = truncatePestelSourceBForLlm(webFull, PORTER_LLM_WEB_CAP);
    if (porterWebTruncated) {
      attribution.push(
        `NOTICE: Porter web bundle trimmed to ${PORTER_LLM_WEB_CAP} chars for Groq limits — full text used where feasible for retrieval`
      );
    }
    const webPresent = Boolean(webFull.trim());
    const webIsThin = webFull.trim().length < 900;

    const porterNarrativeRules = `
SCOPE: Analyze **only** ${meta?.name ?? cca3} (${cca3}) and industry **${industrySector}**.

PRIORITY (non-negotiable):
1) **First** anchor every quantitative claim in the **PLATFORM INDICATORS** digest below—use the **latest year shown** for each series. Do not invent statistics from memory.
2) **Then** enrich with **web research** (SOURCE B) for industry structure, regulation, channels, and competitive dynamics. Integrate themes across recency: very recent news, the past month, half-year, year, and multi-year structure where excerpts support it.

VOICE & CLIENT OUTPUT:
- Every JSON string is **client-facing** board-ready prose—no "SOURCE A/B", no pasted internal subsection titles, no raw date-range stamps from the research bundle.
- Cohesive paragraphs; no bullet lists inside comprehensive \`body\` fields.
${
  hasTemporalWindows
    ? `
- The bundle includes **multi-horizon slices**. Integrate them naturally (e.g. "in recent reporting", "over the past year", "longer-run structure")—**never** quote slice headings verbatim.`
    : ""
}
${
  webPresent
    ? ""
    : `
- **No web research** is available. State briefly in paragraph 2 of each comprehensive section (except Executive Summary may say once in paragraph 2) that live web context was unavailable; still deliver two paragraphs using digest + careful sector inference.`
}

NARRATIVE & SOURCE INTEGRATION (mandatory):
- Each comprehensive \`body\` is **EXACTLY two prose paragraphs**, separated by one blank line (\\n\\n). No markdown inside \`body\`.
- Paragraph 1: **Digest-first**—concrete metrics with matching years from the indicator list; tie to this ISIC sector.
- Paragraph 2: Web-supported themes for that force plus a tight, force-specific implication; if web is thin, say so once briefly.
- **Forces bullets:** five distinct, analytical mini-paragraphs per force; digest anchors before speculative industry colour.
- **newMarketAnalysis, keyTakeaways, recommendations:** each **exactly five** bullets, non-redundant, digest-aware where metrics apply.
- Quantitative claims only from the digest or explicit figures in web excerpts.`;

    const jsonSchemaHint = `Return ONLY a JSON object (no markdown) with exactly this structure (counts are strict):
{
  "forces": [
    {"number":1,"title":"Threat of New Entry","accent":"threat_new_entry","bullets":["EXACTLY 5 fluent bullets; lead with digest-backed facts where relevant, then industry logic"]},
    {"number":2,"title":"Supplier Power","accent":"supplier_power","bullets":["EXACTLY 5"]},
    {"number":3,"title":"Buyer Power","accent":"buyer_power","bullets":["EXACTLY 5"]},
    {"number":4,"title":"Threat of Substitution","accent":"threat_substitutes","bullets":["EXACTLY 5"]},
    {"number":5,"title":"Competitive Rivalry","accent":"rivalry","bullets":["EXACTLY 5"]}
  ],
  "comprehensiveSections": [
    {"title":"Executive Summary","body":"EXACTLY two flowing paragraphs (\\n\\n between): (1) Country + industry + **digest metrics with years**; (2) competitive / policy themes from web (if any) plus an integrated five-forces outlook and what to monitor."},
    {"title":"1. Threat of new entrants","body":"EXACTLY two paragraphs: digest entry economics first; then web on regulation/investment/disruption plus implications for entry threat."},
    {"title":"2. Bargaining power of suppliers","body":"EXACTLY two paragraphs: digest macro/input proxies first; then web on supply chain and commodities plus supplier power implications."},
    {"title":"3. Bargaining power of buyers","body":"EXACTLY two paragraphs: digest demand/income/labour first; then web on channels and pricing plus buyer power implications."},
    {"title":"4. Threat of substitutes","body":"EXACTLY two paragraphs: digest trade/income/tech proxies first; then web on alternatives and innovation plus substitute threat implications."},
    {"title":"5. Competitive rivalry","body":"EXACTLY two paragraphs: digest growth/macro rivalry signals first; then web on competitors and pricing plus rivalry implications."}
  ],
  "newMarketAnalysis": ["EXACTLY 5 bullets"],
  "keyTakeaways": ["EXACTLY 5 bullets"],
  "recommendations": ["EXACTLY 5 actionable bullets"]
}
Ground numbers in the PLATFORM INDICATORS block when available. Be specific to the country and industry sector.`;

    const prompt = `Country: ${meta?.name ?? cca3} (${cca3}). Industry/Sector: ${industrySector}. Digest alignment year: ${year}. **Calendar "as of" for web layer: ${todayIso} (UTC).**
${porterNarrativeRules}

${jsonSchemaHint}

PLATFORM INDICATORS — Latest non-null year per series (prioritize these for all numeric claims):
${digest}

WEB RESEARCH — Tavily excerpts (may be empty). Synthesize; do not invent facts:
${webForLlm || "(none — follow no-web rules above)"}`;

    const extractDigestYears = (d: string): Set<string> => {
      const out = new Set<string>();
      const re = /\((19\d{2}|20\d{2})\):/g;
      for (;;) {
        const m = re.exec(d);
        if (!m) break;
        out.add(m[1]!);
      }
      return out;
    };

    const sanitizePorterByGrounding = (analysis: PorterAnalysis, fallback: PorterAnalysis): PorterAnalysis => {
      // If web context is too thin, trust the deterministic scaffold instead of the model.
      if (!webPresent || webIsThin) return fallback;

      const digestYears = extractDigestYears(digest);
      const webLower = (webForLlm || "").toLowerCase();

      const fbForceByNo = new Map<number, PorterForce>();
      for (const f of fallback.forces) fbForceByNo.set(f.number, f);

      const forces = analysis.forces.map((f) => {
        const fb = fbForceByNo.get(f.number);
        if (!fb) return f;

        let bullets = [...f.bullets];

        // Keep the exact scaffold language for the New Entry force (prevents overconfident regulatory assertions).
        if (f.number === 1) {
          const scaffold = fb.bullets.find((b) => /barriers to entry/i.test(b)) ?? fb.bullets[0];
          if (scaffold) bullets[0] = scaffold;
        }

        const sanitizeBullet = (b: string, idx: number): string => {
          const years = [...b.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((m) => m[1]!);
          if (years.length > 0 && !years.some((y) => digestYears.has(y))) {
            return fb.bullets[idx] ?? b;
          }

          // If a bullet asserts regulatory/licensing specifics, ensure the web bundle contains the theme terms.
          if (/(licens|permit|regulation|investment promotion|entry barrier|barriers to entry|fdi)/i.test(b)) {
            if (!/(licens|permit|regulation|investment promotion|entry barrier|barriers to entry|fdi)/i.test(webLower)) {
              return fb.bullets[idx] ?? b;
            }
          }
          return b;
        };

        bullets = bullets.map((b, i) => sanitizeBullet(b, i));
        return { ...f, bullets };
      });

      const fbSectionByTitle = new Map<string, string>();
      for (const s of fallback.comprehensiveSections) fbSectionByTitle.set(s.title.trim().toLowerCase(), s.body);

      const comprehensiveSections = analysis.comprehensiveSections.map((s) => {
        const fbBody = fbSectionByTitle.get(s.title.trim().toLowerCase());
        if (!fbBody) return s;

        const paras = s.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        const fbParas = fbBody.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        const p1 = paras[0] ?? "";
        const p1HasDigestYear = [...p1.matchAll(/\b(19\d{2}|20\d{2})\b/g)].some((m) => digestYears.has(m[1]!));

        if (!p1HasDigestYear) return { ...s, body: fbBody };

        if (/(licens|permit|regulation|investment promotion|entry barrier|barriers to entry)/i.test(s.body)) {
          if (!/(licens|permit|regulation|investment promotion|entry barrier|barriers to entry)/i.test(webLower)) {
            return { ...s, body: fbBody };
          }
        }

        // Keep original.
        if (paras.length !== fbParas.length) return { ...s, body: fbBody };
        return s;
      });

      return { ...analysis, forces, comprehensiveSections };
    };

    if (!(providedGroqApiKey || process.env.GROQ_API_KEY)) {
      attribution.push("Porter: AI narrative disabled; using digest-based Porter analysis");
      return res.json({ analysis: fallback, attribution });
    }

    if (webIsThin) {
      attribution.push("Porter: sector reporting too thin; using digest-based Porter analysis");
      return res.json({ analysis: fallback, attribution });
    }
    try {
      const { text, model, primaryFailed } = await groqChatWithFallbackForUseCase(
        "porter",
        `You are a competitive strategy analyst. Output **only** valid JSON. Every string is client-facing: no "SOURCE A/B", no internal labels. Exactly **5 bullets** per force; **2 paragraphs** per comprehensive body; **5 bullets** each for newMarketAnalysis, keyTakeaways, and recommendations. Priorize PLATFORM INDICATORS for numbers and years, then web themes across time horizons.`,
        prompt,
        { jsonObject: true, temperature: 0.2, topP: 0.86, analyticsRecencyHint: true, apiKey: providedGroqApiKey }
      );
      attribution.push(
        primaryFailed
          ? `Porter: AI narrative refined`
          : `Porter: AI narrative refined`
      );
      const partial = parsePorterFromLlm(text);
      const analysis = partial ? mergePorterAnalysis(partial, fallback) : fallback;
      const grounded = sanitizePorterByGrounding(analysis, fallback);
      res.json({ analysis: grounded, attribution });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      attribution.push("Porter: using digest-based Porter analysis");
      res.json({ analysis: fallback, attribution });
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/analysis/correlation-global", async (req, res) => {
  try {
    const metricX = String(req.query.metricX ?? "gdp_per_capita").trim();
    const metricY = String(req.query.metricY ?? "life_expectancy").trim();
    const { start: s0, end: e0 } = clampYearRange(
      req.query.start ? parseInt(String(req.query.start), 10) : MIN_DATA_YEAR,
      req.query.end ? parseInt(String(req.query.end), 10) : currentDataYear()
    );
    const endYear = resolveGlobalWdiYear(e0);
    const startYear = Math.min(s0, endYear);
    const excludeIqr = String(req.query.excludeIqr ?? "false").toLowerCase() === "true";
    const highlightCountry = String(req.query.highlight ?? "").toUpperCase();
    if (!METRIC_BY_ID[metricX] || !METRIC_BY_ID[metricY]) {
      return res.status(400).json({ error: "Unknown metricX or metricY" });
    }
    const result = await computeCorrelationGlobal(
      metricX,
      metricY,
      startYear,
      endYear,
      excludeIqr,
      highlightCountry
    );
    res.json({
      ...result,
      metricX,
      metricY,
      labelX: getMetricShortLabel(metricX),
      labelY: getMetricShortLabel(metricY),
      startYear,
      endYear,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

function correlationStrengthLabel(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.7) return "strong";
  if (a >= 0.4) return "moderate";
  if (a >= 0.2) return "weak";
  return "negligible";
}

function pValueIsSignificant(p: string | null | undefined): boolean {
  if (!p || p === "—") return false;
  if (p.startsWith("<")) return true;
  const n = Number(p);
  return Number.isFinite(n) && n < 0.05;
}

function buildBusinessCorrelationNarrativeFallback(args: {
  metricX: string;
  metricY: string;
  labelX: string;
  labelY: string;
  startYear: number;
  endYear: number;
  yearCount: number;
  excludeIqr: boolean;
  highlightCountryIso3?: string;
  highlightCountryName?: string;
  correlation: number | null;
  pValue: string | null;
  rSquared: number | null;
  slope: number | null;
  intercept: number | null;
  n: number;
  nMissing: number;
  nIqrFlagged: number;
  subgroups: { region: string; r: number; n: number; pValue: string }[];
  highlightStats?: {
    pointCount: number;
    meanX: number | null;
    meanY: number | null;
    meanResidual: number | null;
    meanFitted: number | null;
    nIqrOutliers: number;
  };
  residualDiagnostics?: {
    meanAbsResidual: number | null;
    medianResidual: number | null;
    residualIqr: number | null;
  };
}): {
  associationParagraphs: string[];
  correlationBullets: string[];
  causationParagraph: string;
  causationHypotheses: string[];
  recommendedAnalyses: string[];
} {
  const {
    labelX,
    labelY,
    startYear,
    endYear,
    yearCount,
    excludeIqr,
    correlation,
    pValue,
    rSquared,
    slope,
    n,
    nMissing,
    nIqrFlagged,
    subgroups,
    highlightStats,
    residualDiagnostics,
  } = args;

  const xCategory = METRIC_BY_ID[args.metricX]?.category ?? "general";
  const yCategory = METRIC_BY_ID[args.metricY]?.category ?? "general";

  const significant = pValueIsSignificant(pValue);
  const strength = correlation !== null ? correlationStrengthLabel(correlation) : "negligible";
  const direction =
    slope === null
      ? correlation === null
        ? "an interpretable linear relationship"
        : correlation >= 0
          ? "a tendency for Y to rise with X"
          : "a tendency for Y to fall as X rises"
      : slope >= 0
        ? "higher X is associated with higher Y"
        : "higher X is associated with lower Y";

  const associationP1 =
    correlation === null
      ? `Across ${yearCount} years (${startYear}–${endYear}), the platform has insufficient overlapping data to estimate a stable linear association between ${labelX} and ${labelY}.`
      : `Across ${yearCount} years (${startYear}–${endYear}) using ${n} point(s), the relationship between ${labelX} (X) and ${labelY} (Y) shows ${strength} linear association: ${direction}. ${significant ? "The association is statistically significant at the 5% level." : "The statistical evidence is not clearly significant at the 5% level."}`;

  const associationP2 = correlation === null
    ? `Data context: ${nMissing} point(s) were missing and ${nIqrFlagged} point(s) were flagged by the IQR rule (with “Exclude IQR outliers” = ${excludeIqr ? "on" : "off"}). For interpretation, treat any apparent pattern as exploratory and confirm with additional robustness checks.`
    : (() => {
        const residualMedianVal = residualDiagnostics?.medianResidual ?? null;
        const medianResidualStr =
          residualMedianVal !== null && Number.isFinite(residualMedianVal) ? residualMedianVal.toFixed(3) : null;

        const residualMeanAbsVal = residualDiagnostics?.meanAbsResidual ?? null;
        const meanAbsResidualStr =
          residualMeanAbsVal !== null && Number.isFinite(residualMeanAbsVal) ? residualMeanAbsVal.toFixed(3) : null;

        const highlightName = args.highlightCountryName?.trim();
        const highlightMeanResidual = highlightStats?.meanResidual ?? null;
        const highlightMeanResidualStr =
          highlightMeanResidual !== null ? highlightMeanResidual.toExponential(2) : null;
        const highlightPos =
          highlightMeanResidual === null
            ? null
            : Math.abs(highlightMeanResidual) < 1e-12
              ? "close to the fitted line"
              : highlightMeanResidual > 0
                ? "above the fitted line"
                : "below the fitted line";

        const residualSentence =
          medianResidualStr !== null && meanAbsResidualStr !== null
            ? ` Residuals are centered around a median of ${medianResidualStr} (mean absolute residual ${meanAbsResidualStr}), so most points largely follow the linear pattern while larger deviations show up as IQR outliers.`
            : medianResidualStr !== null
              ? ` Residuals are centered around a median of ${medianResidualStr}, which indicates the fitted line captures the central tendency, with deviations concentrated among outliers.`
              : "";

        const highlightSentence =
          highlightName && highlightPos && highlightMeanResidualStr
            ? ` Relative to the fitted line, ${highlightName} sits ${highlightPos} on average (mean residual ${highlightMeanResidualStr}). Use this as a hypothesis-generation cue rather than a conclusion about causality.`
            : "";

        const base =
          `If you translate the fitted line into intuition, the slope implies how changes in X align with changes in Y within the observed range. The model also reports ${
            rSquared !== null ? `r² ≈ ${rSquared.toFixed(3)} (explained variance proxy).` : "an R² estimate (if available)."
          } Outliers flagged by the IQR rule (nIqrFlagged = ${nIqrFlagged}) can strongly influence linear fits, so it is useful to compare results with and without IQR exclusion.`;

        return `${base}${residualSentence}${highlightSentence}`;
      })();

  const correlationBullets: string[] = [];
  correlationBullets.push(
    correlation !== null
      ? `Pearson r = ${correlation.toFixed(3)} (${strength}) over ${n} point(s).`
      : `Pearson r unavailable (insufficient overlap).`
  );
  correlationBullets.push(
    pValue !== null && pValue !== "—"
      ? `p-value = ${pValue} (${significant ? "significant" : "not clearly significant"}).`
      : `p-value unavailable for this pairing.`
  );
  if (slope !== null) {
    correlationBullets.push(`Slope indicates the direction and magnitude of the fitted relationship (beta / 1-unit X → ${slope.toExponential(2)} units of Y).`);
  } else {
    correlationBullets.push(`Slope unavailable; focus on the qualitative direction implied by r and subgroup patterns.`);
  }

  const channelCandidates: string[] = [];
  if ((xCategory === "financial" || xCategory === "education" || xCategory === "general") && yCategory === "health") {
    channelCandidates.push("economic capacity translating into access to services (health, nutrition, and prevention)");
    channelCandidates.push("health system readiness and coverage mediating outcomes tied to development");
  } else if (xCategory === "health" && (yCategory === "financial" || yCategory === "education")) {
    channelCandidates.push("human-capital effects where health conditions shape productivity and economic performance");
    channelCandidates.push("reverse causality where economic/educational resources drive improvements in health indicators");
  } else if (yCategory === xCategory && xCategory !== "general") {
    channelCandidates.push("shared drivers within the same domain (policy, institutions, infrastructure, and measurement scope)");
    channelCandidates.push("both metrics responding to broader macro/sector conditions that move them together");
  } else {
    channelCandidates.push("common macro drivers affecting both metrics (e.g., institutions, infrastructure, and broader sector capacity)");
    channelCandidates.push("mediating pathways where the X metric influences an intermediate factor that then affects Y");
  }

  const topRegions = [...subgroups]
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 3);

  const highlightCausationHint = (() => {
    const name = args.highlightCountryName?.trim();
    const meanResidual = highlightStats?.meanResidual ?? null;
    if (!name || meanResidual === null || !Number.isFinite(meanResidual)) return "";
    const pos =
      Math.abs(meanResidual) < 1e-12 ? "close to" : meanResidual > 0 ? "above" : "below";
    const meanResidualStr = meanResidual.toExponential(2);
    return ` In this window, ${name} sits ${pos} the fitted line on average (mean residual ${meanResidualStr}). Use that deviation to prioritize where to investigate mechanisms, not to infer causality.`;
  })();

  const residualCausationHint = (() => {
    const medianResidual = residualDiagnostics?.medianResidual ?? null;
    if (medianResidual === null || !Number.isFinite(medianResidual)) return "";
    const residualMedianStr = medianResidual.toFixed(3);
    return ` The residual center (median residual ${residualMedianStr}) supports the linear specification as a first-pass summary, while IQR outliers flag where the relationship may differ across countries.`;
  })();

  const causationParagraph =
    `Correlation does not imply causation. The patterns you see are consistent with multiple causal structures: ${channelCandidates[0] || "shared drivers"} and ${channelCandidates[1] || "mediated pathways"}. The strongest region-level associations can help you prioritize where to investigate context: ${topRegions.length ? topRegions.map((r) => `${r.region} (r ≈ ${r.r.toFixed(3)})`).join("; ") : "subgroup strength varies by region"}.${highlightCausationHint}${residualCausationHint} Treat these as hypothesis-generation signals, not proof of causal direction.`;

  const causationHypotheses = [
    `If ${labelX} improves (or reflects stronger underlying capacity), it plausibly increases ${labelY} through a development or capacity channel; confirm directionality with time-lagged patterns.`,
    `A confounder (institutions, education, infrastructure, governance) may drive both ${labelX} and ${labelY}; test by adding controls or subgroup stability across comparable regions.`,
    `Reverse causality may be operating (where ${labelY} influences underlying resources that also shape ${labelX}); test by comparing lag structures and checking whether effects persist when reversing the regression direction.`,
  ];

  const recommendedAnalyses = [
    "Check robustness with and without IQR outliers, then test whether the sign/direction remains stable.",
    "Run time-lag or panel-style comparisons (X leading Y by 1–3 years) to evaluate temporality.",
    "Add controls (or multivariate models) to reduce confounding, and compare subgroup results by region or income band.",
  ];

  return {
    associationParagraphs: [associationP1, associationP2],
    correlationBullets,
    causationParagraph,
    causationHypotheses,
    recommendedAnalyses,
  };
}

app.post("/api/analysis/business/correlation-narrative", async (req, res) => {
  try {
    const requestStartedAt = Date.now();
    const NARRATIVE_BUDGET_MS = 28_000;
    const MIN_ATTEMPT_WINDOW_MS = 7_500;
    const SAFETY_BUFFER_MS = 1_500;
    const remainingBudgetMs = () => NARRATIVE_BUDGET_MS - (Date.now() - requestStartedAt);
    const canRunAnotherAttempt = () => remainingBudgetMs() > MIN_ATTEMPT_WINDOW_MS;

    const providedGroqApiKey = readRequestApiKey(req, "groq");
    const metricX = String(req.body?.metricX ?? "").trim();
    const metricY = String(req.body?.metricY ?? "").trim();
    if (!METRIC_BY_ID[metricX] || !METRIC_BY_ID[metricY]) return res.status(400).json({ error: "Unknown metricX or metricY" });

    const labelX = String(req.body?.labelX ?? getMetricShortLabel(metricX));
    const labelY = String(req.body?.labelY ?? getMetricShortLabel(metricY));

    const startYear = Number(req.body?.startYear ?? MIN_DATA_YEAR);
    const endYear = Number(req.body?.endYear ?? currentDataYear());
    const excludeIqr = String(req.body?.excludeIqr ?? "false").toLowerCase() === "true";
    const yearCount = Math.max(1, endYear - startYear + 1);

    const correlation = req.body?.correlation ?? null;
    const pValue = req.body?.pValue ?? null;
    const rSquared = req.body?.rSquared ?? null;
    const slope = req.body?.slope ?? null;
    const intercept = req.body?.intercept ?? null;
    const n = Number(req.body?.n ?? 0);
    const nMissing = Number(req.body?.nMissing ?? 0);
    const nIqrFlagged = Number(req.body?.nIqrFlagged ?? 0);

    const toFiniteOrNull = (v: any): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const hs: any = req.body?.highlightStats;
    const parsedHighlightStats =
      hs && typeof hs === "object"
        ? {
            pointCount: Number(hs?.pointCount ?? 0),
            meanX: toFiniteOrNull(hs?.meanX),
            meanY: toFiniteOrNull(hs?.meanY),
            meanResidual: toFiniteOrNull(hs?.meanResidual),
            meanFitted: toFiniteOrNull(hs?.meanFitted),
            nIqrOutliers: Number(hs?.nIqrOutliers ?? 0),
          }
        : undefined;
    const highlightStats =
      parsedHighlightStats && parsedHighlightStats.pointCount > 0 ? parsedHighlightStats : undefined;

    const rd: any = req.body?.residualDiagnostics;
    const residualDiagnostics =
      rd && typeof rd === "object"
        ? {
            meanAbsResidual: toFiniteOrNull(rd?.meanAbsResidual),
            medianResidual: toFiniteOrNull(rd?.medianResidual),
            residualIqr: toFiniteOrNull(rd?.residualIqr),
          }
        : undefined;

    const subgroups = Array.isArray(req.body?.subgroups) ? req.body.subgroups : [];
    const normalizedSubgroups = subgroups
      .map((s: any) => ({
        region: String(s?.region ?? ""),
        r: Number(s?.r ?? NaN),
        n: Number(s?.n ?? NaN),
        pValue: String(s?.pValue ?? "—"),
      }))
      .filter((s: any) => s.region && Number.isFinite(s.r) && Number.isFinite(s.n));

    const fallback = buildBusinessCorrelationNarrativeFallback({
      metricX,
      metricY,
      labelX,
      labelY,
      startYear,
      endYear,
      yearCount,
      excludeIqr,
      highlightCountryIso3: req.body?.highlightCountryIso3 ? String(req.body.highlightCountryIso3) : undefined,
      highlightCountryName: req.body?.highlightCountryName ? String(req.body.highlightCountryName) : undefined,
      correlation: correlation === null ? null : Number(correlation),
      pValue: pValue === null ? null : String(pValue),
      rSquared: rSquared === null ? null : Number(rSquared),
      slope: slope === null ? null : Number(slope),
      intercept: intercept === null ? null : Number(intercept),
      n,
      nMissing,
      nIqrFlagged,
      subgroups: normalizedSubgroups,
      highlightStats,
      residualDiagnostics,
    });

    if (!(providedGroqApiKey || process.env.GROQ_API_KEY?.trim())) {
      res.json({ narrative: fallback, modelUsed: null, triedModels: [] });
      return;
    }

    const sys = `You are a business analytics strategist. Create a coherent, cohesive, fluid narrative that interprets multi-metric correlations across countries (association, not proof). Output ONLY valid JSON.

Hard rules:
- Do NOT invent any facts or numbers. You may only reuse numbers and labels provided in the user payload (r, p-value, slope, intercept, r², missing counts, sample size n, year range, and region subgroup r values). If highlightStats or residualDiagnostics are missing, do not mention them.
- Correlation is not causation: any causal language must be clearly labeled as hypotheses and must mention that causation requires additional evidence (e.g. temporality, controls, instruments, experiments).
- Keep the tone analyst-grade, readable, and non-repetitive.

Structure expectations (still JSON only):
- associationParagraphs[0] should summarize the direction + strength + statistical evidence.
- associationParagraphs[1] should smoothly connect the fitted line, residual diagnostics (if provided), and the highlight-country position (if provided).
- causationParagraph should stay explicitly in "hypothesis-generation" mode and reference region subgroup strength.

Return schema:
{
  "associationParagraphs": [string, string],
  "correlationBullets": [string, string, string],
  "causationParagraph": string,
  "causationHypotheses": [string, string, string],
  "recommendedAnalyses": [string, string, string]
}`;

    const user = JSON.stringify({
      metricX,
      metricY,
      labelX,
      labelY,
      startYear,
      endYear,
      yearCount,
      excludeIqr,
      highlightCountryIso3: req.body?.highlightCountryIso3 ? String(req.body.highlightCountryIso3) : "",
      highlightCountryName: req.body?.highlightCountryName ? String(req.body.highlightCountryName) : "",
      stats: {
        correlation: fallback.associationParagraphs[0].includes("insufficient") ? null : (correlation === null ? null : Number(correlation)),
        pValue: pValue === null ? null : String(pValue),
        rSquared: rSquared === null ? null : Number(rSquared),
        slope: slope === null ? null : Number(slope),
        intercept: intercept === null ? null : Number(intercept),
        n,
        nMissing,
        nIqrFlagged,
      },
      topSubgroupsByAbsR: normalizedSubgroups
        .slice()
        .sort((a: any, b: any) => Math.abs(b.r) - Math.abs(a.r))
        .slice(0, 5),
      categoryX: METRIC_BY_ID[metricX]?.category,
      categoryY: METRIC_BY_ID[metricY]?.category,
      highlightStats: highlightStats ?? null,
      residualDiagnostics: residualDiagnostics ?? null,
      fallback,
    });

    if (!canRunAnotherAttempt()) {
      res.json({
        narrative: fallback,
        modelUsed: null,
        triedModels: [],
        fallbackReason: "request-budget-exhausted-before-llm",
      });
      return;
    }

    const firstAttemptTimeoutMs = Math.max(
      6_000,
      Math.min(14_000, remainingBudgetMs() - SAFETY_BUFFER_MS)
    );

    const firstAttempt = await groqChatWithFallbackForUseCase(
      "business",
      sys,
      `Payload (stats + context) is below. Produce JSON only.\n${user}`,
      {
        jsonObject: true,
        temperature: 0.22,
        topP: 0.84,
        timeoutMs: firstAttemptTimeoutMs,
        maxModelAttempts: 2,
        apiKey: providedGroqApiKey,
      }
    );

    let parsed: any = null;
    try {
      parsed = JSON.parse(firstAttempt.text);
    } catch {
      parsed = null;
    }

    if (
      parsed &&
      Array.isArray(parsed.associationParagraphs) &&
      parsed.associationParagraphs.length === 2 &&
      Array.isArray(parsed.correlationBullets) &&
      parsed.correlationBullets.length === 3 &&
      Array.isArray(parsed.causationHypotheses) &&
      parsed.causationHypotheses.length === 3 &&
      Array.isArray(parsed.recommendedAnalyses) &&
      parsed.recommendedAnalyses.length === 3
    ) {
      res.json({ narrative: parsed, modelUsed: firstAttempt.model, triedModels: firstAttempt.triedModels });
      return;
    }

    const strictSys = `${sys}

STRICT OUTPUT REQUIREMENTS:
- Output ONLY a JSON object (no markdown, no surrounding text).
- Exactly these keys must exist.
- Array lengths: associationParagraphs=2, correlationBullets=3, causationHypotheses=3, recommendedAnalyses=3.
`;

    if (!canRunAnotherAttempt()) {
      res.json({
        narrative: fallback,
        modelUsed: null,
        triedModels: firstAttempt.triedModels,
        fallbackReason: "request-budget-exhausted-after-first-attempt",
      });
      return;
    }

    const retryTimeoutMs = Math.max(
      5_500,
      Math.min(10_000, remainingBudgetMs() - SAFETY_BUFFER_MS)
    );

    const retryAttempt = await groqChatWithFallbackForUseCase(
      "business",
      strictSys,
      `Payload (stats + context) is below. Produce JSON only.\n${user}`,
      {
        jsonObject: true,
        temperature: 0.12,
        topP: 0.78,
        timeoutMs: retryTimeoutMs,
        maxModelAttempts: 1,
        apiKey: providedGroqApiKey,
      }
    );

    let retryParsed: any = null;
    try {
      retryParsed = JSON.parse(retryAttempt.text);
    } catch {
      retryParsed = null;
    }

    if (
      retryParsed &&
      Array.isArray(retryParsed.associationParagraphs) &&
      retryParsed.associationParagraphs.length === 2 &&
      Array.isArray(retryParsed.correlationBullets) &&
      retryParsed.correlationBullets.length === 3 &&
      Array.isArray(retryParsed.causationHypotheses) &&
      retryParsed.causationHypotheses.length === 3 &&
      Array.isArray(retryParsed.recommendedAnalyses) &&
      retryParsed.recommendedAnalyses.length === 3
    ) {
      res.json({
        narrative: retryParsed,
        modelUsed: retryAttempt.model,
        triedModels: [...firstAttempt.triedModels, ...retryAttempt.triedModels],
      });
      return;
    }

    res.json({
      narrative: fallback,
      modelUsed: null,
      triedModels: [...firstAttempt.triedModels, ...retryAttempt.triedModels],
      fallbackReason: "llm-json-schema-invalid",
    });
  } catch (e) {
    res.json({
      narrative: buildBusinessCorrelationNarrativeFallback({
        metricX: String(req.body?.metricX ?? ""),
        metricY: String(req.body?.metricY ?? ""),
        labelX: String(req.body?.labelX ?? req.body?.metricX ?? "Metric X"),
        labelY: String(req.body?.labelY ?? req.body?.metricY ?? "Metric Y"),
        startYear: Number(req.body?.startYear ?? MIN_DATA_YEAR),
        endYear: Number(req.body?.endYear ?? currentDataYear()),
        yearCount: Math.max(1, Number(req.body?.endYear ?? currentDataYear()) - Number(req.body?.startYear ?? MIN_DATA_YEAR) + 1),
        excludeIqr: String(req.body?.excludeIqr ?? "false").toLowerCase() === "true",
        highlightCountryIso3: req.body?.highlightCountryIso3 ? String(req.body.highlightCountryIso3) : undefined,
        highlightCountryName: req.body?.highlightCountryName ? String(req.body.highlightCountryName) : undefined,
        correlation: req.body?.correlation === null ? null : Number(req.body?.correlation),
        pValue: req.body?.pValue === null ? null : String(req.body?.pValue),
        rSquared: req.body?.rSquared === null ? null : Number(req.body?.rSquared),
        slope: req.body?.slope === null ? null : Number(req.body?.slope),
        intercept: req.body?.intercept === null ? null : Number(req.body?.intercept),
        n: Number(req.body?.n ?? 0),
        nMissing: Number(req.body?.nMissing ?? 0),
        nIqrFlagged: Number(req.body?.nIqrFlagged ?? 0),
        subgroups: [],
      }),
      modelUsed: null,
      triedModels: [],
      fallbackReason: "llm-runtime-error",
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

app.post("/api/analysis/correlation", async (req, res) => {
  try {
    const cca3 = String(req.body?.countryCode ?? "").toUpperCase();
    const xId = String(req.body?.metricX ?? "");
    const yId = String(req.body?.metricY ?? "");
    if (!/^[A-Z]{3}$/.test(cca3)) return res.status(400).json({ error: "countryCode required" });
    if (!METRIC_BY_ID[xId] || !METRIC_BY_ID[yId]) return res.status(400).json({ error: "Unknown metric" });
    const { start, end } = clampYearRange(MIN_DATA_YEAR, currentDataYear());
    const pairBundle = await fetchCountryBundle(cca3, [xId, yId], start, end);
    const xs = pairBundle[xId] ?? [];
    const ys = pairBundle[yId] ?? [];
    const byYear = new Map<number, { x: number; y: number }>();
    for (const p of xs) {
      if (p.value === null) continue;
      byYear.set(p.year, { x: p.value, y: NaN });
    }
    for (const p of ys) {
      if (p.value === null) continue;
      const row = byYear.get(p.year);
      if (row) row.y = p.value;
    }
    const pairs = [...byYear.values()].filter((r) => !Number.isNaN(r.x) && !Number.isNaN(r.y));
    const n = pairs.length;
    if (n < 3) return res.json({ n, correlation: null, points: pairs, note: "Not enough overlapping years" });
    const mx = pairs.reduce((s, p) => s + p.x, 0) / n;
    const my = pairs.reduce((s, p) => s + p.y, 0) / n;
    let num = 0,
      dx = 0,
      dy = 0;
    for (const p of pairs) {
      const zx = p.x - mx;
      const zy = p.y - my;
      num += zx * zy;
      dx += zx * zx;
      dy += zy * zy;
    }
    const denom = Math.sqrt(dx * dy);
    const r = denom === 0 ? null : num / denom;
    res.json({
      n,
      correlation: r,
      points: pairs,
      metricX: xId,
      metricY: yId,
      labelX: getMetricShortLabel(xId),
      labelY: getMetricShortLabel(yId),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

if (process.env.VERCEL !== "1") {
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, () => {
    console.log(`Country Analytics API http://localhost:${port}`);
  });
}

export default app;
