import type { CountrySummary } from "./restCountries.js";
import { looksLikeGlobalRankingQuery } from "./assistantRankingBlock.js";

export type AssistantIntent = "general_web" | "country_overview" | "statistics_drill" | "country_compare";

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "");
}

/** Heuristic: user is asking about numeric / dashboard metrics — Tavily usually skipped when platform payload exists. */
/** User asks to compare international vs national poverty lines for the focus country. */
export function looksLikePovertyInternationalVsNationalComparison(message: string): boolean {
  const q = message.toLowerCase();
  if (!/\bpoverty\b/.test(q)) return false;
  const hasNat = /\bnational\b/.test(q);
  const hasIntl = /\binternational\b/.test(q);
  const compares =
    /\bvs\.?\b|\bversus\b|\bcompare\b|\bcomparison\b/.test(q) || (hasNat && hasIntl);
  return compares || (hasNat && hasIntl);
}

export function questionLooksMetricAnchored(message: string): boolean {
  const q = message.toLowerCase();
  if (q.length < 3) return false;
  if (
    /\b(gdp|gni|inflation|population|unemployment|debt|deficit|surplus|growth|recession|wdi|world bank|imf|uis|metrics?|indicators?|series|per capita|income group|ppp|literacy|life expectancy|birth rate|tuberculosis|tb incidence|uhc|hospital beds|health workforce|immunization|vaccination|health expenditure|smoking|risk factor|poverty|interest rate|lending|yoy|year over year)\b/.test(
      q
    )
  ) {
    return true;
  }
  if (/\b(api|database|backend|stored|ingested)\b/.test(q) && /\b(data|metric|indicator|figure|stat|series)\b/.test(q)) {
    return true;
  }
  if (
    /\b(dashboard|country analytics|this app|the app|the platform)\b/.test(q) &&
    /\b(data|metrics?|indicators?|figure|number|stats?)\b/.test(q)
  ) {
    return true;
  }
  if (/\b(latest|current|recent)\b.*\b(data|figure|number|value|stat|statistic)\b/.test(q)) return true;
  if (/\bwhat('s| is)\b.*\b(%|gdp|inflation|population|unemployment)\b/.test(q)) return true;
  if (/\bhow (big|large|high|low|much)\b.*\b(economy|gdp|population|inflation)\b/.test(q)) return true;
  if (looksLikeGlobalRankingQuery(message)) return true;
  return false;
}

/** Four-digit years in the question (1800–2100). */
function explicitYearsInQuestion(message: string): number[] {
  const out: number[] = [];
  const re = /\b(19\d{2}|20\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    const y = parseInt(m[0]!, 10);
    if (y >= 1800 && y <= 2100) out.push(y);
  }
  return [...new Set(out)];
}

/**
 * Past leadership / election questions where training data is an acceptable primary source
 * (no “web-only or refuse” behavior).
 */
function questionIsClearlyHistoricalOfficeholder(message: string): boolean {
  const calY = new Date().getFullYear();
  const q = message.toLowerCase();
  if (/\bwho\s+was\b|\bwho\s+were\b/.test(q)) return true;
  const years = explicitYearsInQuestion(message);
  if (years.length > 0 && years.every((y) => y < calY)) return true;
  return false;
}

/**
 * Questions whose correct answer can change frequently (officeholders, elections).
 * Forces live retrieval and blocks “platform-first” Tavily skip even when dashboard payload exists.
 * Intentionally narrow — do not treat generic “recent GDP” style asks as ephemeral facts.
 *
 * Excludes clearly historical asks (past years, “who was”) so the model may use general knowledge
 * when search is thin.
 */
export function questionNeedsLiveWebVerification(message: string): boolean {
  if (questionIsClearlyHistoricalOfficeholder(message)) return false;

  const q = message.toLowerCase();
  const calY = String(new Date().getFullYear());
  if (
    /\b(today|right now|this week|this month|breaking\s+news|current events|as of today|as of now)\b/.test(q) &&
    /\b(president|prime\s+minister|election|government|minister|parliament|elected|inauguration|resigned|referendum)\b/.test(
      q
    )
  ) {
    return true;
  }
  if (q.includes(calY) && /\b(president|election|inauguration|prime\s+minister|who\s+won)\b/.test(q)) return true;
  if (
    /\b(who\s+is|who\s+are|who's|who\s+was|who\s+were)\b/.test(q) &&
    /\b(president|prime\s+minister|chancellor|monarch|head\s+of\s+state|head\s+of\s+government|premier|governor[-\s]general)\b/.test(
      q
    )
  ) {
    return true;
  }
  if (/\b(king|queen)\s+of\b/.test(q) && /\bwho\b/.test(q)) return true;
  if (
    /\b(current|today|now|right\s+now|incumbent|sitting)\b/.test(q) &&
    /\b(president|prime\s+minister|pm\b|king|queen|chancellor)\b/.test(q)
  ) {
    return true;
  }
  if (/\b(president|prime\s+minister|chancellor)\s+of\b/.test(q)) return true;
  if (/\b(u\.s\.|us|united\s+states)\s+president\b/.test(q)) return true;
  if (/\bwho\s+won\b.*\b(election|vote|runoff|primary|referendum)\b/.test(q)) return true;
  return false;
}

/**
 * Sensitive country-fact asks that should prefer encyclopedic / institutional sources.
 */
export function questionIsSensitiveCountryFact(message: string): boolean {
  const q = message.toLowerCase();
  return /\b(president|leader|head\s+of\s+state|head\s+of\s+government|prime\s+minister|king|queen|cuisine|dish|food|culture|cultural|religion|religious|border|borders|neighbor|neighbour|region|regions|geography|where\s+is|located|country\s+facts?|politics|political)\b/.test(
    q
  );
}

/** True when Tavily output is too thin to ground a verified-fact answer. */
export function isWebSearchContextThin(ctx: string): boolean {
  const t = ctx.trim();
  if (!t) return true;
  const hasUrl = /\bhttps?:\/\//i.test(t);
  if (!hasUrl && t.length < 400) return true;
  return false;
}

function looksLikeComparisonQuery(message: string): boolean {
  return /\bcompare\b/i.test(message) || /\bversus\b|\bvs\.?\b/i.test(message);
}

function isCountryOverviewQuery(message: string): boolean {
  const q = message.trim().toLowerCase();
  return (
    /\b(overview|big\s+picture|general\s+picture)\b/i.test(q) ||
    /\bselected\s+country\b/i.test(q) ||
    /\bsummary\b.*\b(country|nation)\b/i.test(q) ||
    /^(tell me about|describe|what do you know about|what can you tell me about)\s+/i.test(q.trim())
  );
}

/**
 * Route the turn: comparisons and rankings are handled with platform-first logic;
 * overviews get a balanced web+stats mode; pure geography/news stays web-first.
 */
export function classifyAssistantIntent(message: string): AssistantIntent {
  if (looksLikeComparisonQuery(message)) return "country_compare";
  if (looksLikeGlobalRankingQuery(message)) return "statistics_drill";
  if (isCountryOverviewQuery(message)) return "country_overview";
  if (questionLooksMetricAnchored(message)) return "statistics_drill";
  return "general_web";
}

export function intentPrefersWebFirst(intent: AssistantIntent): boolean {
  return intent === "general_web";
}

/**
 * Whether the selected-country WDI-style snapshot should be injected into the LLM prompt.
 * For `general_web` turns (culture, offices, news, etc.), omitting it avoids irrelevant macro padding
 * and keeps answers scoped to web excerpts + appropriate general knowledge.
 */
export function questionInvokesFocusCountryPlatformMetrics(
  message: string,
  intent: AssistantIntent
): boolean {
  if (intent === "statistics_drill" || intent === "country_compare" || intent === "country_overview") {
    return true;
  }
  if (questionLooksMetricAnchored(message)) return true;
  if (looksLikePovertyInternationalVsNationalComparison(message)) return true;
  const q = message.toLowerCase();
  if (
    /\b(this app|the app|the platform|dashboard|country analytics)\b/.test(q) &&
    /\b(data|metric|indicator|figure|stat|series|wdi|world bank)\b/.test(q)
  ) {
    return true;
  }
  if (/\b(economic|economy|macro|macroeconomic)\s+(snapshot|picture|outlook|health|situation|performance|profile)\b/.test(q)) {
    return true;
  }
  if (/\bhow\s+(is|are)\b[^?.]{0,80}\b(economy|economic)\b/.test(q)) return true;
  return false;
}

/** When true and Tavily is configured, skip retrieval so the model cannot override curated series. */
export function shouldSkipTavilyForPlatformFirst(
  intent: AssistantIntent,
  hasAuthoritativePayload: boolean,
  message: string
): boolean {
  if (questionNeedsLiveWebVerification(message)) return false;
  if (!hasAuthoritativePayload) return false;
  return intent === "statistics_drill" || intent === "country_compare";
}

function cleanCountryFragment(raw: string): string {
  return raw
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/\b(gdp|population|economy|economies|metrics?|figures?|data)\s+of\s+/gi, "")
    .replace(/\b(the\s+)?(nominal|real)\s+/gi, "")
    .trim();
}

function resolveCountryMention(raw: string, countries: CountrySummary[]): string | null {
  const q = raw.trim();
  if (!q) return null;
  if (/^[A-Za-z]{3}$/.test(q)) {
    const u = q.toUpperCase();
    return countries.some((c) => c.cca3 === u) ? u : null;
  }
  if (/^[A-Za-z]{2}$/.test(q)) {
    const u = q.toUpperCase();
    const hit = countries.find((c) => c.cca2 === u);
    return hit?.cca3 ?? null;
  }

  const n = norm(q);
  let best: { cca3: string; score: number } | null = null;

  for (const c of countries) {
    const common = norm(c.name);
    const official = c.nameOfficial ? norm(c.nameOfficial) : "";
    if (n === common || (official && n === official)) return c.cca3;

    let score = 0;
    if (common === n || official === n) score = 999;
    else if (common.startsWith(n) || n.startsWith(common)) score = Math.min(common.length, n.length) + 2;
    else if (n.length >= 4 && common.includes(n)) score = n.length;
    else if (common.length >= 4 && n.includes(common)) score = common.length;
    if (score > (best?.score ?? 0)) best = { cca3: c.cca3, score };
  }

  if (best && best.score >= 4) return best.cca3;
  return null;
}

/** Max countries in one assistant comparison (selected + peers). */
export const ASSISTANT_MAX_COMPARISON_COUNTRIES = 12;

function dedupeCca3KeepOrder(codes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    if (!/^[A-Z]{3}$/.test(c) || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/** Strip trailing `on GDP, population, …` so country lists parse cleanly. */
function stripComparisonMetricClause(message: string): string {
  const m = message.match(/\s+on\s+/i);
  if (!m || m.index === undefined) return message.trim();
  return message.slice(0, m.index).trim();
}

function messageAnchorsSelectedCountryForComparison(message: string): boolean {
  return (
    /(?:the\s+)?selected\s+country/i.test(message) || /\bmy\s+dashboard\s+country\b/i.test(message)
  );
}

/** Split RHS of compare … to … into name segments (commas, `and`, `&`). */
function splitComparisonRhsSegments(rhs: string): string[] {
  const cleaned = rhs.replace(/\s+and\s+etc\.?$/i, "").trim();
  const byComma = cleaned.split(/\s*,\s*/);
  const segments: string[] = [];
  for (const part of byComma) {
    const t = part.trim().replace(/^(and|&)\s+/i, "").trim();
    if (t) segments.push(t);
  }
  return segments;
}

/**
 * Resolve one RHS segment to one or more ISO3 codes (handles "France and Germany" without a comma).
 */
function resolveComparisonSegmentToCca3s(segment: string, countries: CountrySummary[]): string[] {
  const full = resolveCountryMention(cleanCountryFragment(segment), countries);
  if (full) return [full];
  const parts = segment.split(/\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [];
  const out: string[] = [];
  for (const p of parts) {
    const c = resolveCountryMention(cleanCountryFragment(p), countries);
    if (!c) return [];
    out.push(c);
  }
  return out;
}

/**
 * Detect multiple ISO3 codes named in free text (longest country names first to reduce substring collisions).
 * Used when the user lists economies for a metric question without explicit "compare … to …" phrasing.
 */
export function extractCountryCodesMentionedInText(
  message: string,
  countries: CountrySummary[],
  cap: number
): string[] {
  const lower = message.toLowerCase();
  const hits: { idx: number; cca3: string }[] = [];
  const sorted = [...countries].sort((a, b) => b.name.length - a.name.length);

  for (const c of sorted) {
    const n = c.name.trim().toLowerCase();
    if (n.length < 4) continue;
    let pos = 0;
    for (;;) {
      const i = lower.indexOf(n, pos);
      if (i < 0) break;
      const before = i > 0 ? lower[i - 1]! : " ";
      const after = i + n.length < lower.length ? lower[i + n.length]! : " ";
      if (!/[a-zà-ž]/.test(before) && !/[a-zà-ž]/.test(after)) {
        hits.push({ idx: i, cca3: c.cca3 });
      }
      pos = i + Math.max(1, n.length);
    }
    if (c.nameOfficial) {
      const o = c.nameOfficial.trim().toLowerCase();
      if (o.length >= 6) {
        let op = 0;
        for (;;) {
          const i = lower.indexOf(o, op);
          if (i < 0) break;
          const before = i > 0 ? lower[i - 1]! : " ";
          const after = i + o.length < lower.length ? lower[i + o.length]! : " ";
          if (!/[a-zà-ž]/.test(before) && !/[a-zà-ž]/.test(after)) {
            hits.push({ idx: i, cca3: c.cca3 });
          }
          op = i + Math.max(1, o.length);
        }
      }
    }
  }

  // Treat ISO3 mentions as explicit uppercase tokens only (e.g., USA, IDN).
  // This avoids false positives from common words like "and" -> AND (Andorra), "per" -> PER (Peru).
  const isoWord = /\b([A-Z]{3})\b/g;
  let im: RegExpExecArray | null;
  while ((im = isoWord.exec(message)) !== null) {
    const code = im[1]!;
    if (countries.some((c) => c.cca3 === code)) {
      hits.push({ idx: im.index, cca3: code });
    }
  }

  hits.sort((a, b) => a.idx - b.idx);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (seen.has(h.cca3)) continue;
    seen.add(h.cca3);
    out.push(h.cca3);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Extract ISO3 codes for comparison questions (2+ countries).
 * Supports: "Compare the selected country to A, B, and C", "Compare X to A, B on GDP", "Brazil vs A, B".
 */
export function extractComparisonCca3s(
  message: string,
  _selectedCca3: string,
  countries: CountrySummary[]
): string[] {
  if (!looksLikeComparisonQuery(message)) return [];

  const core = stripComparisonMetricClause(message);
  const cap = ASSISTANT_MAX_COMPARISON_COUNTRIES;
  const pushSegments = (rhs: string, bucket: string[]) => {
    for (const seg of splitComparisonRhsSegments(rhs)) {
      bucket.push(...resolveComparisonSegmentToCca3s(seg, countries));
      if (bucket.length >= cap) break;
    }
  };

  const out: string[] = [];

  // Compare (the) selected country to/with LIST
  let m = core.match(/^compare\s+(?:the\s+)?selected\s+country\s+(?:to|with)\s+(.+)$/i);
  if (m?.[1]) {
    pushSegments(m[1], out);
    return dedupeCca3KeepOrder(out).slice(0, cap);
  }

  // Compare X to/with LIST
  m = core.match(/^compare\s+(.+?)\s+(?:to|with)\s+(.+)$/i);
  if (m?.[1] && m?.[2]) {
    const leftRaw = m[1].trim();
    const rightRaw = m[2].trim();
    if (/(?:the\s+)?selected\s+country/i.test(leftRaw)) {
      pushSegments(rightRaw, out);
      return dedupeCca3KeepOrder(out).slice(0, cap);
    }
    const leftCode = resolveCountryMention(cleanCountryFragment(leftRaw), countries);
    const rhsCodes: string[] = [];
    pushSegments(rightRaw, rhsCodes);
    if (leftCode && rhsCodes.length > 0) {
      return dedupeCca3KeepOrder([leftCode, ...rhsCodes]).slice(0, cap);
    }
    if (!leftCode && rhsCodes.length > 0) {
      return dedupeCca3KeepOrder(rhsCodes).slice(0, cap);
    }
  }

  // Compare X vs Y[, Y2 …] (optional `compare` prefix already handled above when same)
  m = core.match(/^compare\s+(.+?)\s+vs\.?\s+(.+)$/i);
  if (m?.[1] && m?.[2]) {
    const leftCode = resolveCountryMention(cleanCountryFragment(m[1].trim()), countries);
    const rhsCodes: string[] = [];
    pushSegments(m[2], rhsCodes);
    if (leftCode && rhsCodes.length > 0) {
      return dedupeCca3KeepOrder([leftCode, ...rhsCodes]).slice(0, cap);
    }
  }

  // Leading "X vs Y" without "compare"
  if (!/^compare\b/i.test(core.trim())) {
    m = core.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
    if (m?.[1] && m?.[2]) {
      const leftCode = resolveCountryMention(cleanCountryFragment(m[1].trim()), countries);
      const rhsCodes: string[] = [];
      pushSegments(m[2], rhsCodes);
      if (leftCode && rhsCodes.length > 0) {
        return dedupeCca3KeepOrder([leftCode, ...rhsCodes]).slice(0, cap);
      }
    }
  }

  // Legacy pairwise patterns (tight endings)
  const patterns: RegExp[] = [
    /compare\s+(.+?)\s+vs\.?\s+(.+?)(?:$|[\n?!.])/i,
    /compare\s+(.+?)\s+(?:to|with)\s+(.+?)(?:$|[\n?!.])/i,
    /compare\s+(.+?)\s+and\s+(.+?)(?:$|[\n?!.])/i,
    /(.+?)\s+vs\.?\s+(.+?)(?:$|[\n?!.])/i,
  ];

  for (const re of patterns) {
    const pm = core.match(re);
    if (!pm?.[1] || !pm[2]) continue;
    const a = resolveCountryMention(cleanCountryFragment(pm[1]), countries);
    const b = resolveCountryMention(cleanCountryFragment(pm[2]), countries);
    if (a && b && a !== b) return [a, b];
  }

  return [];
}

/** Merge extracted codes with dashboard selection when the question names the selected country. */
export function finalizeComparisonCodes(
  extracted: string[],
  selectedCca3: string,
  message: string
): string[] {
  const sel = selectedCca3 && /^[A-Z]{3}$/.test(selectedCca3) ? selectedCca3 : "";
  let codes = dedupeCca3KeepOrder(extracted);
  const anchorSelected = messageAnchorsSelectedCountryForComparison(message);

  if (anchorSelected && sel && !codes.includes(sel)) {
    codes = [sel, ...codes];
  } else if (!anchorSelected && codes.length === 1 && sel && !codes.includes(sel)) {
    codes = [sel, codes[0]!];
  }

  return codes.slice(0, ASSISTANT_MAX_COMPARISON_COUNTRIES);
}

export function buildAssistantWebSearchQuery(
  message: string,
  intent: AssistantIntent,
  selectedCca3: string,
  comparisonCodes: string[],
  nameByCca3: Map<string, string>,
  options?: { boostVerifiedFact?: boolean }
): string {
  const now = new Date();
  const y = String(now.getFullYear());
  const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const parts: string[] = [message];
  if (selectedCca3 && nameByCca3.has(selectedCca3)) parts.push(nameByCca3.get(selectedCca3)!);
  for (const c of comparisonCodes) {
    const n = nameByCca3.get(c);
    if (n) parts.push(n);
  }
  const isoToday = now.toISOString().slice(0, 10);
  if (intent === "country_compare") parts.push("economic comparison", "latest policy and data");
  if (intent === "country_overview") {
    parts.push("current government economy society", "today", `as of ${isoToday} UTC`);
  }
  if (intent === "statistics_drill") {
    parts.push("latest reported figures and commentary", monthYear, y);
  } else if (intent === "general_web") {
    parts.push(
      "latest verified information",
      `as of ${isoToday} UTC`,
      "today",
      monthYear,
      y,
      "past two weeks"
    );
  } else {
    parts.push("breaking or latest verified news", monthYear, y, "past six weeks");
  }
  if (options?.boostVerifiedFact) {
    parts.push(y, "current officeholder", "who holds office", "latest confirmed reporting");
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function groqTemperatureForIntent(intent: AssistantIntent): number {
  switch (intent) {
    case "statistics_drill":
      return 0.22;
    case "country_compare":
      return 0.24;
    case "country_overview":
      return 0.34;
    case "general_web":
      return 0.38;
    default:
      return 0.38;
  }
}
