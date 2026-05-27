import type { SeriesPoint } from "./worldBank.js";
import { inferHeadOfGovernmentFromGovernmentType } from "./countryMetaEnrichment.js";
import type { CountrySummary } from "./restCountries.js";
import type { WbCountryProfile } from "./wbCountryProfile.js";
import { METRIC_BY_ID } from "./metrics.js";
import { PESTEL_DIGEST_KEYS } from "./pestelDigestKeys.js";

export type PestelDimension = {
  letter: "P" | "E" | "S" | "T" | "E" | "L";
  label: string;
  bullets: string[];
};

export type PestelSwot = {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
};

export type ComprehensiveSection = { title: string; body: string };

export type StrategicSection = { title: string; paragraphs: string[] };

export type PestelAnalysis = {
  pestelDimensions: PestelDimension[];
  swot: PestelSwot;
  comprehensiveSections: ComprehensiveSection[];
  strategicBusiness: StrategicSection[];
  newMarketAnalysis: string[];
  keyTakeaways: string[];
  recommendations: string[];
};

const DIMENSION_TEMPLATE: { letter: PestelDimension["letter"]; label: string }[] = [
  { letter: "P", label: "POLITICAL" },
  { letter: "E", label: "ECONOMIC" },
  { letter: "S", label: "SOCIOCULTURAL" },
  { letter: "T", label: "TECHNOLOGICAL" },
  { letter: "E", label: "ENVIRONMENTAL" },
  { letter: "L", label: "LEGAL" },
];

function strArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((i): i is string => typeof i === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function latest(bundle: Record<string, SeriesPoint[]>, id: string): { year: number; value: number } | null {
  const pts = bundle[id] ?? [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const v = pts[i]?.value;
    if (v !== null && v !== undefined && Number.isFinite(v)) return { year: pts[i].year, value: v };
  }
  return null;
}

function fmtUsd(v: number): string {
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)} trillion`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)} Bn`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)} Mn`;
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtPop(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} Bn`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} Mn`;
  return `${Math.round(v).toLocaleString("en-US")}`;
}

function pct(v: number, digits = 1): string {
  return `${v.toFixed(digits)}%`;
}

function canonicalDimensionLabel(raw: string): string | null {
  const u = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (u.includes("POLIT") || u === "P") return "POLITICAL";
  if (u.includes("ECON") || u === "Economic".toUpperCase()) return "ECONOMIC";
  if (u.includes("SOCIO") || u === "SOCIAL" || u.includes("CULTUR")) return "SOCIOCULTURAL";
  if (u.includes("TECH")) return "TECHNOLOGICAL";
  if (u.includes("ENVIRON") || u === "ENVIRONMENTAL") return "ENVIRONMENTAL";
  if (u.includes("LEGAL") || u.includes("LAW")) return "LEGAL";
  return null;
}

function normalizeLabelKey(label: string): string {
  const c = canonicalDimensionLabel(label);
  return c ?? label.toUpperCase().replace(/\s+/g, " ").trim();
}

export function parsePestelAnalysisFromLlm(text: string): Partial<PestelAnalysis> | null {
  let t = text.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im.exec(t);
  if (fence) t = fence[1].trim();
  try {
    const o = JSON.parse(t) as unknown;
    if (!o || typeof o !== "object") return null;
    return extractPartial(o as Record<string, unknown>);
  } catch {
    return null;
  }
}

function extractPartial(r: Record<string, unknown>): Partial<PestelAnalysis> {
  const rawDims = (r.pestelDimensions ?? r.pestel ?? r.dimensions) as unknown;
  const pestelDimensions: PestelDimension[] = [];
  if (Array.isArray(rawDims)) {
    for (const item of rawDims) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const letter = typeof o.letter === "string" && o.letter.length === 1 ? (o.letter.toUpperCase() as PestelDimension["letter"]) : "P";
      const label = typeof o.label === "string" ? o.label.toUpperCase() : "POLITICAL";
      const bullets = strArray(o.bullets);
      if (bullets.length) pestelDimensions.push({ letter, label, bullets });
    }
  }

  const swotRaw = r.swot as Record<string, unknown> | undefined;
  const swot: PestelSwot | undefined = swotRaw
    ? {
        strengths: strArray(swotRaw.strengths),
        weaknesses: strArray(swotRaw.weaknesses),
        opportunities: strArray(swotRaw.opportunities),
        threats: strArray(swotRaw.threats),
      }
    : undefined;

  const compRaw = r.comprehensiveSections ?? r.comprehensive;
  const comprehensiveSections: ComprehensiveSection[] = [];
  if (Array.isArray(compRaw)) {
    for (const item of compRaw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title : "Section";
      let body = typeof o.body === "string" ? o.body : "";
      const paras = strArray(o.paragraphs);
      if (paras.length) body = paras.join("\n\n");
      if (body.trim()) comprehensiveSections.push({ title, body: body.trim() });
    }
  }

  const stratRaw = r.strategicBusiness ?? r.strategicImplications ?? r.pestelSwotNarrative;
  const strategicBusiness: StrategicSection[] = [];
  if (Array.isArray(stratRaw)) {
    for (const item of stratRaw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title : "Section";
      let paragraphs = strArray(o.paragraphs);
      if (!paragraphs.length && typeof o.body === "string") {
        paragraphs = o.body
          .split(/\n\n+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (paragraphs.length) strategicBusiness.push({ title, paragraphs });
    }
  }

  return {
    pestelDimensions: pestelDimensions.length ? pestelDimensions : undefined,
    swot,
    comprehensiveSections: comprehensiveSections.length ? comprehensiveSections : undefined,
    strategicBusiness: strategicBusiness.length ? strategicBusiness : undefined,
    newMarketAnalysis: strArray(r.newMarketAnalysis).length ? strArray(r.newMarketAnalysis) : undefined,
    keyTakeaways: strArray(r.keyTakeaways).length ? strArray(r.keyTakeaways) : undefined,
    recommendations: strArray(r.recommendations).length ? strArray(r.recommendations) : undefined,
  };
}

function mapParsedDimensions(parsed: PestelDimension[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const d of parsed) {
    const key = normalizeLabelKey(d.label);
    const canon = canonicalDimensionLabel(d.label) ?? key;
    if (d.bullets.length) m.set(canon, d.bullets);
  }
  return m;
}

/** Split prose into paragraphs (blank-line separated). */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\r/g, "").trim())
    .filter(Boolean);
}

const GENERIC_PAD =
  "Stress-test conclusions against the dashboard time series, primary filings, and regulator notices before capital allocation.";

const GENERIC_PAD_POOL: readonly string[] = [
  "Stress-test conclusions against the dashboard time series, primary filings, and regulator notices before capital allocation.",
  "Validate strategic implications with updated releases and sector-specific filings, and document assumptions for decision review.",
  "Cross-check the narrative against official registers, regulator communications, and the latest dashboard indicators before committing capital.",
];

const FIVE_ITEM_PADS = [
  "Reconcile headline indicators with charted trends and peer benchmarks before board or IC sign-off.",
  "Use Global Analytics to position this economy against regional peers on the metrics that matter for your sector.",
  "Refresh the view after material data revisions, elections, or policy shocks.",
] as const;

/** Normalize for duplicate detection (not for display). */
function pestelBulletDedupeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function dedupeStringsPreserveOrder(items: string[]): string[] {
  const local = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const k = pestelBulletDedupeKey(t);
    if (k.length >= 12 && local.has(k)) continue;
    if (k.length >= 12) local.add(k);
    out.push(t);
  }
  return out;
}

function hasEvidenceAnchor(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(19|20)\d{2}\b/.test(t) ||
    /\d+(\.\d+)?\s*%/.test(t) ||
    /\$\s?\d/.test(t) ||
    /\b(gdp|inflation|unemployment|population|debt|life expectancy|literacy|enrollment|education|series|indicator)\b/.test(
      t
    )
  );
}

function hasBusinessImplicationAnchor(text: string): boolean {
  return /\b(implication|implies|suggests|therefore|so this means|for business|for operators|for investors|risk|opportunity|margin|pricing|entry|capex|opex|compliance|execution)\b/i.test(
    text
  );
}

function ensureImplicationTail(text: string): string {
  const t = text.trim();
  if (!t) return t;
  // Do not append boilerplate implication tails; they reduce readability and feel hallucinated.
  // Keep existing sentence as-is and rely on deterministic fallback prose for coherent implications.
  return t;
}

function strengthenBulletsWithFallbackEvidence(
  merged: string[],
  fallback: string[],
  minEvidence = 2
): string[] {
  const out = [...merged];
  let evidenceCount = out.filter(hasEvidenceAnchor).length;
  if (evidenceCount >= minEvidence) return out;
  const fallbackEvidence = fallback.filter(hasEvidenceAnchor);
  for (const fb of fallbackEvidence) {
    if (evidenceCount >= minEvidence) break;
    if (out.includes(fb)) {
      evidenceCount += hasEvidenceAnchor(fb) ? 1 : 0;
      continue;
    }
    const replaceIdx = out.findIndex((b) => !hasEvidenceAnchor(b));
    if (replaceIdx >= 0) out[replaceIdx] = fb;
    else out.push(fb);
    evidenceCount = out.filter(hasEvidenceAnchor).length;
  }
  return out.slice(0, 5);
}

/**
 * Five bullets: LLM first, then fallback, then pads. Optional `globalSeen` prevents the same point from reappearing across SWOT quadrants.
 */
function ensureFiveBullets(
  primary: string[],
  fallback: string[],
  globalSeen?: Set<string>
): string[] {
  const out: string[] = [];
  const tryPush = (candidate: string, registerGlobal: boolean): boolean => {
    const t = candidate.trim();
    if (!t) return false;
    const k = pestelBulletDedupeKey(t);
    if (k.length >= 12) {
      if (registerGlobal && globalSeen?.has(k)) return false;
      if (out.some((x) => pestelBulletDedupeKey(x) === k)) return false;
      if (registerGlobal) globalSeen?.add(k);
    } else if (out.includes(t)) return false;
    out.push(t);
    return true;
  };

  for (const t of dedupeStringsPreserveOrder(primary.map((b) => b.trim()).filter(Boolean))) {
    tryPush(t, true);
  }

  let fi = 0;
  while (out.length < 5 && fi < fallback.length) {
    tryPush(fallback[fi++]!, true);
  }
  let pi = 0;
  while (out.length < 5 && pi < 24) {
    tryPush(FIVE_ITEM_PADS[pi % FIVE_ITEM_PADS.length]!, false);
    pi += 1;
  }
  let guard = 0;
  while (out.length < 5 && guard++ < 30) {
    tryPush(GENERIC_PAD, false);
  }
  return out.slice(0, 5);
}

function normalizeSwotBullet(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\-\u2022\*\s]+/, "")
    .replace(/^\d+\)\s*/, "")
    .replace(/^\[\s*Retrieval:[^\]]*\]\s*/i, "")
    .replace(/^\[\s*Server:[^\]]*\]\s*/i, "")
    .trim();
}

function swotBulletLooksUsable(s: string): boolean {
  const t = normalizeSwotBullet(s);
  if (t.length < 28) return false;
  if (!/[a-zA-Z]/.test(t)) return false;
  const alpha = (t.match(/[a-zA-Z]/g) ?? []).length;
  return alpha >= 18;
}

function stabilizeSwotQuadrant(primary: string[], fallback: string[], globalSeen: Set<string>): string[] {
  const cleanedPrimary = primary.map(normalizeSwotBullet).filter(swotBulletLooksUsable);
  const merged = ensureFiveBullets(cleanedPrimary, fallback.map(normalizeSwotBullet), globalSeen);
  return merged.map((b) => ensureImplicationTail(normalizeSwotBullet(b)));
}

function enforceDimensionQuality(primary: string[], fallback: string[], minEvidence: number): string[] {
  let out = ensureFiveBullets(primary, fallback);
  out = strengthenBulletsWithFallbackEvidence(out, fallback, minEvidence);
  out = out.map((b) => ensureImplicationTail(b));
  return out.slice(0, 5);
}

/**
 * Ensure exactly two non-empty paragraphs.
 * Missing paragraphs are filled from deterministic fallback paragraphs first.
 * If the model produced more than two, merge overflow into paragraph 2 to preserve coherence.
 */
function ensureTwoParagraphs(primary: string[], fallback: string[]): string[] {
  // If the model outputs the generic pad sentence, prefer the deterministic fallback paragraphs instead.
  const cleanedPrimary = primary
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => p !== GENERIC_PAD);

  const out: string[] = [];
  for (const p of cleanedPrimary) {
    const t = p.trim();
    if (!t) continue;
    if (!out.includes(t)) out.push(t);
  }

  // For narrative quality (and to avoid generic fillers), always fill missing paragraphs from the fallback set first.
  let fi = 0;
  while (out.length < 2 && fi < fallback.length) {
    const next = fallback[fi]!.trim();
    fi += 1;
    if (next && !out.includes(next)) out.push(next);
  }

  // Only if fallback is unexpectedly short, fall back to the non-repeating pad pool.
  let padIdx = 0;
  while (out.length < 2 && padIdx < 20) {
    const pad = GENERIC_PAD_POOL[padIdx % GENERIC_PAD_POOL.length]!;
    padIdx += 1;
    if (!out.includes(pad)) out.push(pad);
  }

  if (out.length > 2) {
    const p1 = out[0]!;
    const p2 = [out[1]!, ...out.slice(2)].join(" ").trim();
    return [p1, p2];
  }
  return out;
}

function formatDigestMetricValue(id: string, value: number): string {
  const pctLike = new Set([
    "gdp_growth",
    "inflation",
    "gov_debt_pct_gdp",
    "unemployment_ilo",
    "poverty_headcount",
    "poverty_national",
    "undernourishment",
    "pop_age_0_14",
    "pop_age_65_plus",
    "pop_15_64_pct",
    "literacy_adult",
    "enrollment_primary_pct",
    "enrollment_secondary",
    "enrollment_tertiary_pct",
    "lending_rate",
    "interest_real",
    "edu_expenditure_gdp",
    "immunization_dpt",
    "immunization_measles",
    "health_expenditure_gdp",
    "smoking_prevalence",
  ]);
  if (pctLike.has(id)) return `${Number(value.toFixed(1))}%`;
  if (id === "life_expectancy") return `${value.toFixed(1)} years`;
  if (id === "birth_rate") return `${value.toFixed(1)} per 1,000`;
  if (id === "tb_incidence") return `${value.toFixed(1)} per 100,000`;
  if (id === "population" || id === "labor_force_total") return fmtPop(value);
  if (
    id === "gdp" ||
    id === "gdp_ppp" ||
    id === "gdp_per_capita" ||
    id === "gdp_per_capita_ppp" ||
    id === "gni_per_capita_atlas" ||
    id === "gov_debt_usd"
  ) {
    return fmtUsd(value);
  }
  if (id.includes("_count") || id.includes("teachers_")) {
    return Math.round(value).toLocaleString("en-US");
  }
  if (id === "completion_tertiary") return `${Number(value.toFixed(1))}%`;
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/**
 * Human-readable dashboard digest for Groq: metric labels + rounded figures (no raw 14-digit floats).
 * Includes education series so TECHNOLOGICAL sections can use skills pipeline data instead of misusing GDP.
 */
export function buildPestelLlmDigest(countryName: string, bundle: Record<string, SeriesPoint[]>): string {
  const lines: string[] = [
    `COUNTRY: ${countryName}`,
    "",
    "PLATFORM INDICATORS — World Bank WDI / IMF / UIS (via this app). Treat as quantitative ground truth for the country.",
    "In prose, cite rounded figures (e.g. one decimal for rates) and the year shown—do not paste machine-precision numbers.",
    "",
    "INDICATORS:",
  ];
  for (const k of PESTEL_DIGEST_KEYS) {
    const lv = latest(bundle, k);
    if (!lv) continue;
    const label = METRIC_BY_ID[k]?.label ?? k;
    const formatted = formatDigestMetricValue(k, lv.value);
    lines.push(`• ${label}: ${formatted} (year ${lv.year})`);
  }
  lines.push(
    "",
    "For TECHNOLOGICAL analysis: prefer literacy + secondary/tertiary enrollment and education spend above; do not use GDP per capita as a stand-in for digital adoption. Pair with web research excerpts for digital policy, infrastructure, and innovation.",
    "",
    "GROUNDING (mandatory): Any numeric statistic in your JSON must either (a) correspond to an INDICATORS line above (same concept, allowed rounding in prose) or (b) appear explicitly in the web research excerpts below. Do not invent figures, rankings, growth rates, or years from model memory.",
    "REST COUNTRIES / PROFILE: Government type, region, and income group in the API response are authoritative for static country metadata—do not substitute from memory."
  );
  return lines.join("\n");
}

function normalizeComprehensiveSections(
  fromLlm: ComprehensiveSection[] | undefined,
  fallback: ComprehensiveSection[]
): ComprehensiveSection[] {
  const byTitle = new Map<string, ComprehensiveSection>();
  for (const s of fromLlm ?? []) {
    byTitle.set(s.title.trim().toLowerCase(), s);
  }
  return fallback.map((fb) => {
    const llm = byTitle.get(fb.title.trim().toLowerCase());
    const rawBody = llm?.body?.trim() ? llm.body : fb.body;
    const fromLlmParas = splitParagraphs(rawBody);
    const fbParas = splitParagraphs(fb.body);
    const two = ensureTwoParagraphs(fromLlmParas, fbParas);
    return { title: fb.title, body: two.join("\n\n") };
  });
}

function normalizeStrategicSections(
  fromLlm: StrategicSection[] | undefined,
  fallback: StrategicSection[]
): StrategicSection[] {
  const byTitle = new Map<string, StrategicSection>();
  for (const s of fromLlm ?? []) {
    byTitle.set(s.title.trim().toLowerCase(), s);
  }
  return fallback.map((fb) => {
    const llm = byTitle.get(fb.title.trim().toLowerCase());
    let primary: string[] = [];
    if (llm?.paragraphs?.length) {
      primary = llm.paragraphs.map((p) => p.trim()).filter(Boolean);
    } else if (llm && typeof (llm as unknown as { body?: string }).body === "string") {
      primary = splitParagraphs((llm as unknown as { body: string }).body);
    }
    if (!primary.length) primary = [...fb.paragraphs];
    const two = ensureTwoParagraphs(primary, fb.paragraphs);
    return { title: fb.title, paragraphs: two };
  });
}

export function mergePestelAnalysis(partial: Partial<PestelAnalysis>, fallback: PestelAnalysis): PestelAnalysis {
  const byLabel = partial.pestelDimensions ? mapParsedDimensions(partial.pestelDimensions) : new Map();

  const pestelDimensions: PestelDimension[] = DIMENSION_TEMPLATE.map((t, i) => {
    const fromLlm = byLabel.get(t.label);
    const fb = fallback.pestelDimensions[i]!;
    const minEvidence =
      t.label === "ECONOMIC" || t.label === "POLITICAL" || t.label === "LEGAL"
        ? 3
        : t.label === "SOCIOCULTURAL" || t.label === "TECHNOLOGICAL" || t.label === "ENVIRONMENTAL"
          ? 2
          : 2;
    const merged = enforceDimensionQuality(fromLlm ?? [], fb.bullets, minEvidence);
    return { letter: t.letter, label: t.label, bullets: merged };
  });

  const swotGlobal = new Set<string>();
  const swot: PestelSwot = {
    strengths: stabilizeSwotQuadrant(partial.swot?.strengths ?? [], fallback.swot.strengths, swotGlobal),
    weaknesses: stabilizeSwotQuadrant(partial.swot?.weaknesses ?? [], fallback.swot.weaknesses, swotGlobal),
    opportunities: stabilizeSwotQuadrant(partial.swot?.opportunities ?? [], fallback.swot.opportunities, swotGlobal),
    threats: stabilizeSwotQuadrant(partial.swot?.threats ?? [], fallback.swot.threats, swotGlobal),
  };

  const comprehensiveSections = normalizeComprehensiveSections(
    partial.comprehensiveSections,
    fallback.comprehensiveSections
  );
  const comprehensiveWithEvidence = comprehensiveSections.map((s, i) => {
    const fb = fallback.comprehensiveSections[i];
    if (!fb) return s;
    const paras = splitParagraphs(s.body);
    const fbParas = splitParagraphs(fb.body);
    if (paras.length === 0 || fbParas.length === 0) return s;
    // Force first paragraph to stay indicator-anchored for decision-grade value.
    if (!hasEvidenceAnchor(paras[0]!)) {
      const next = [fbParas[0]!, paras[1] ?? fbParas[1] ?? ""].filter(Boolean).join("\n\n").trim();
      return { ...s, body: next };
    }
    return s;
  });

  const strategicBusiness = normalizeStrategicSections(partial.strategicBusiness, fallback.strategicBusiness);

  const newMarketAnalysis = ensureFiveBullets(partial.newMarketAnalysis ?? [], fallback.newMarketAnalysis).map(
    ensureImplicationTail
  );
  const keyTakeaways = ensureFiveBullets(partial.keyTakeaways ?? [], fallback.keyTakeaways).map(
    ensureImplicationTail
  );
  const recommendations = ensureFiveBullets(partial.recommendations ?? [], fallback.recommendations).map(
    ensureImplicationTail
  );

  return polishPestelAnalysisForClient({
    pestelDimensions,
    swot,
    comprehensiveSections: comprehensiveWithEvidence,
    strategicBusiness,
    newMarketAnalysis,
    keyTakeaways,
    recommendations,
  });
}

/** Remove internal retrieval jargon from strings shown to end users. */
function polishPestelProse(s: string): string {
  let t = s
    // User-visible style guard: avoid em/en dashes in final client text.
    .replace(/[—–]/g, " - ");
  const pairs: [RegExp, string][] = [
    [/\bSOURCE\s+A\b/gi, ""],
    [/\bSOURCE\s+B\b/gi, ""],
    [/\bSource\s+A\b/g, ""],
    [/\bSource\s+B\b/g, ""],
    [/\bSTATIC\s+PROFILE\b/gi, ""],
    [/\bSTATE\s+A\b/gi, ""],
    [/\bPast\s+7\s+days\b/gi, "over roughly the past week"],
    [/\bPast\s+1\s+month\b/gi, "over roughly the past month"],
    [/\bPast\s+6\s+months\b/gi, "over roughly the past six months"],
    [/\bPast\s+1\s+year\b/gi, "over roughly the past year"],
    [/\bPast\s+5\s+years\b/gi, "over roughly the past five years"],
    [/\[---[^\]]*truncated[^\]]*\]/gi, ""],
    [/\[Internal:[^\]]*\]/gi, ""],
    [/\[Model note:[^\]]*\]/gi, ""],
    [/\bFrom platform metadata,?\s*/gi, ""],
    [/\bGrounded in the app'?s WDI-backed series:\s*/gi, ""],
    [/\bFrom the application'?s WDI-backed series,?\s*/gi, ""],
    [/\bDemographic and well-being indicators from the platform include:\s*/gi, "Available demographic and well-being indicators include "],
    [/\bData layer:\s*/gi, ""],
    [/\bplatform'?s WDI-backed series\b/gi, "World Bank development indicators"],
    [/\bthe application'?s WDI-backed series\b/gi, "World Bank development indicators"],
    [/\bWDI-backed series\b/gi, "official development statistics"],
    [/\bWDI-backed\b/gi, "indicator-based"],
    [/\bMacro WDI series\b/gi, "Headline macro series"],
    [/\bin WDI for\b/gi, "for"],
    [/\bin WDI\b/gi, "in the official series"],
    [/\bfrom WDI\b/gi, "from the official series"],
    [/\bin REST Countries dataset\b/gi, "in this reference profile"],
    [/\bREST Countries dataset\b/gi, "the reference profile"],
    [/\(REST Countries\)/gi, "(profile)"],
    [/\bREST Countries\b/gi, "the country profile"],
    [/\bThis implies a direct execution and risk-planning consideration for operators\.?/gi, ""],
    [/\bKey Highlights\b/gi, ""],
    [/\bReasons to Buy\b/gi, ""],
    [/\bBuy Report\b/gi, ""],
    [/\bDownload FREE Resources\b/gi, ""],
    [/\bReport Code:\s*[A-Z0-9\-]+\b/gi, ""],
    [/\bShare on [A-Za-z ]+\b/gi, ""],
    [/\bCopy Link\b/gi, ""],
    [/\bMacroeconomic Outlook Report\b/gi, "macroeconomic outlook"],
    [/###\s*[A-Za-z0-9 ~()\-:]+/g, ""],
    [/\[Retrieval window:[^\]]*\]/gi, ""],
  ];
  for (const [re, rep] of pairs) t = t.replace(re, rep);
  return t
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,;:.!?])/g, "$1")
    .trim();
}

export function polishPestelAnalysisForClient(a: PestelAnalysis): PestelAnalysis {
  return {
    pestelDimensions: a.pestelDimensions.map((d) => ({
      ...d,
      bullets: d.bullets.map(polishPestelProse),
    })),
    swot: {
      strengths: a.swot.strengths.map(polishPestelProse),
      weaknesses: a.swot.weaknesses.map(polishPestelProse),
      opportunities: a.swot.opportunities.map(polishPestelProse),
      threats: a.swot.threats.map(polishPestelProse),
    },
    comprehensiveSections: a.comprehensiveSections.map((s) => ({
      ...s,
      body: polishPestelProse(s.body),
    })),
    strategicBusiness: a.strategicBusiness.map((s) => ({
      ...s,
      paragraphs: s.paragraphs.map(polishPestelProse),
    })),
    newMarketAnalysis: a.newMarketAnalysis.map(polishPestelProse),
    keyTakeaways: a.keyTakeaways.map(polishPestelProse),
    recommendations: a.recommendations.map(polishPestelProse),
  };
}

export function buildDataOnlyPestel(
  countryName: string,
  cca3: string,
  digest: string,
  bundle: Record<string, SeriesPoint[]>,
  meta: CountrySummary | undefined,
  profile: WbCountryProfile | null
): PestelAnalysis {
  const region = meta?.region ?? profile?.region ?? "—";
  const sub = meta?.subregion ?? "—";
  const income = profile?.incomeLevel ?? "—";
  const govLabel = meta?.government?.trim();
  const headRole =
    meta?.headOfGovernmentTitle?.trim() ||
    inferHeadOfGovernmentFromGovernmentType(govLabel) ||
    undefined;
  const politicalLeadBullet = govLabel
    ? headRole
      ? `Government type (country profile): ${govLabel}. Head of government role: ${headRole}.`
      : `Government type (country profile): ${govLabel}.`
    : `Government type for ${countryName} (${cca3}) is not listed in reference data; see the Country Dashboard profile card when populated.`;
  const pop = latest(bundle, "population");
  const gdp = latest(bundle, "gdp");
  const gdpPc = latest(bundle, "gdp_per_capita");
  const growth = latest(bundle, "gdp_growth");
  const debt = latest(bundle, "gov_debt_pct_gdp");
  const infl = latest(bundle, "inflation");
  const life = latest(bundle, "life_expectancy");
  const y014 = latest(bundle, "pop_age_0_14");
  const y65 = latest(bundle, "pop_age_65_plus");
  const lit = latest(bundle, "literacy_adult");
  const enrollSec = latest(bundle, "enrollment_secondary");
  const enrollTert = latest(bundle, "enrollment_tertiary_pct");
  const eduSpend = latest(bundle, "edu_expenditure_gdp");
  const unemp = latest(bundle, "unemployment_ilo");
  const area = meta?.area;

  const techSignalBits: string[] = [];
  if (lit) techSignalBits.push(`adult literacy about ${lit.value.toFixed(1)}% (${lit.year})`);
  if (enrollSec) techSignalBits.push(`secondary gross enrollment about ${enrollSec.value.toFixed(1)}% (${enrollSec.year})`);
  if (enrollTert) techSignalBits.push(`tertiary gross enrollment about ${enrollTert.value.toFixed(1)}% (${enrollTert.year})`);
  if (eduSpend) techSignalBits.push(`public education spending about ${eduSpend.value.toFixed(1)}% of GDP (${eduSpend.year})`);
  const techDataParagraph =
    techSignalBits.length > 0
      ? `Reported education and skills indicators include ${techSignalBits.join("; ")}. Together they frame workforce readiness for digital and R&D-intensive work; they do not replace dedicated ICT infrastructure statistics—triangulate with national telecom and cloud-market data and recent coverage where available.`
      : "Education and skills indicators are only partly populated for this economy; review secondary and tertiary enrollment and literacy in the country charts before inferring technology adoption potential.";

  const econLines: string[] = [];
  if (gdp) econLines.push(`Nominal GDP (${gdp.year}): ${fmtUsd(gdp.value)}.`);
  if (gdpPc) econLines.push(`GDP per capita (${gdpPc.year}): ${fmtUsd(gdpPc.value)}.`);
  if (growth) econLines.push(`GDP growth (${growth.year}): ${pct(growth.value)}.`);
  if (pop) econLines.push(`Population (${pop.year}): ${fmtPop(pop.value)}.`);
  if (debt) econLines.push(`Central government debt (${debt.year}): ${pct(debt.value)} of GDP.`);
  if (infl) econLines.push(`Inflation, consumer prices (${infl.year}): ${pct(infl.value)}.`);
  if (unemp) econLines.push(`Unemployment (${unemp.year}): ${pct(unemp.value)} of labour force.`);

  const socialLines: string[] = [];
  if (y014) socialLines.push(`Population ages 0–14 (${y014.year}): ${pct(y014.value)} of total.`);
  if (y65) socialLines.push(`Population ages 65+ (${y65.year}): ${pct(y65.value)} of total.`);
  if (life) socialLines.push(`Life expectancy at birth (${life.year}): ${life.value.toFixed(1)} years.`);
  if (lit) socialLines.push(`Adult literacy (${lit.year}): ${pct(lit.value)} where reported.`);

  const macroPara1 = [
    `${countryName} (${cca3}) is classified by the World Bank as ${income} and sits in ${region}${sub !== "—" ? ` (${sub})` : ""}.`,
    econLines.slice(0, 3).join(" "),
    socialLines.slice(0, 2).join(" "),
  ]
    .filter((s) => s.trim().length > 0)
    .join(" ");

  const macroPara2 =
    "These figures draw on World Bank development indicators (latest reported year per series). They do not capture firm-level performance, informal activity, or events after the observation year—supplement with market data, regulator notices, and current press when available.";

  const macroPara3 =
    "Cross-check levels and momentum in the country charts and peer benchmarks; treat this note as a structured baseline ahead of investment, entry, or policy decisions.";

  const pestelDimensions: PestelDimension[] = [
    {
      letter: "P",
      label: "POLITICAL",
      bullets: [
        politicalLeadBullet,
        `Geopolitical framing: ${region}${sub !== "—" ? ` · ${sub}` : ""} — validate current leadership and policy priorities with primary sources.`,
        `Cross-check corruption, bureaucracy, and regulatory stability with Transparency International, Doing Business successors, and local counsel.`,
        `Trade and alliance context (e.g. ASEAN, RCEP, bilateral ties) should be confirmed for your sector and time horizon.`,
        `Baseline geography and income classification come from standard country reference data—validate leadership statements, budgets, and gazettes against primary sources.`,
      ],
    },
    {
      letter: "E",
      label: "ECONOMIC",
      bullets: ensureFiveBullets(econLines, [
        `Income classification (WB): ${income}.`,
        "Open the Country Dashboard for charts, YoY changes, and peer comparison.",
      ]),
    },
    {
      letter: "S",
      label: "SOCIOCULTURAL",
      bullets: ensureFiveBullets(socialLines, [
        "Urbanization, inequality, and middle-class dynamics require sector-specific consumer research.",
        "Education and skills statistics support workforce planning—pair with local hiring market intelligence.",
      ]),
    },
    {
      letter: "T",
      label: "TECHNOLOGICAL",
      bullets: [
        "Digital adoption, fintech, and e-commerce penetration vary sharply by island/region — use operator and regulator filings where possible.",
        "National digital infrastructure and literacy programs (where reported in official statistics) are a baseline; pilot markets before national rollouts.",
        "Cybersecurity, data residency, and cloud policy should be validated with ICT ministry guidance.",
        "Startup ecosystem signals are qualitative — triangulate with investment databases and local accelerators.",
        "Regulatory sandboxes and sector-specific tech licensing (e.g. health, finance) can accelerate pilots—confirm eligibility with ministry circulars.",
      ],
    },
    {
      letter: "E",
      label: "ENVIRONMENTAL",
      bullets: [
        "Climate exposure (coastal, flood, drought) is material for supply chains — use IPCC national chapters and local hazard maps.",
        `Reported land area: ${area != null ? `about ${(area / 1e6).toFixed(2)} million km²` : "—"}; EEZ and offshore claims still need hydrographic and regulatory confirmation.`,
        "Energy mix and emissions commitments: verify with UNFCCC submissions and national energy balances.",
        "Natural-resource sectors (forestry, mining, agriculture) carry permitting and ESG scrutiny — align with host-country ESG rules.",
        "Transition finance, green procurement, and carbon-border alignment increasingly affect market access—track major trade partner rules.",
      ],
    },
    {
      letter: "L",
      label: "LEGAL",
      bullets: [
        "Civil vs common-law traditions and sectoral codes affect contracts — engage local counsel for entity setup, licensing, and labor rules.",
        "IP, competition, and consumer-protection enforcement differ by sector; check registrar and competition authority decisions.",
        "Labor law, tax treaties, and transfer-pricing posture should be modeled before operating scale.",
        "Sanctions, export controls, and FDI screening are dynamic — re-check at deal time.",
        "Dispute forums, judgment enforcement, and court backlog materially affect contract design—benchmark against regional peers.",
      ],
    },
  ];

  const swot: PestelSwot = {
    strengths: [
      pop ? `Large domestic market on a ${fmtPop(pop.value)}-person baseline (${pop.year}).` : "Demographic scale depends on segment — validate TAM.",
      `Regional position: ${region} — map logistics corridors and trade agreements relevant to your product.`,
      gdp ? `Economic mass: nominal GDP ${fmtUsd(gdp.value)} (${gdp.year}).` : "Use dashboard series to size GDP when available.",
      "Natural-resource or services endowments are country-specific — tie to your value chain.",
      growth
        ? `Recent GDP growth print (${growth.year}): ${pct(growth.value)} — frames demand momentum subject to composition effects.`
        : "Pull GDP growth and terms-of-trade proxies from the dashboard to benchmark demand momentum.",
    ],
    weaknesses: [
      "Headline macro series are not firm-level: governance, infrastructure, and execution gaps need local diligence.",
      "Data gaps and lags are common; do not treat a single year as structural truth.",
      "For a fuller, time-stamped storyline, enable AI narrative and live web research in settings; this view stays indicator-anchored.",
      debt
        ? `Public debt burden (${debt.year}): ${pct(debt.value)} of GDP may constrain fiscal space for subsidies or infrastructure.`
        : "Track government debt and contingent liabilities when fiscal headroom matters for your sector.",
      unemp
        ? `Labour slack (${unemp.year}): unemployment near ${pct(unemp.value)} — affects wage pressure and consumer confidence.`
        : "Monitor unemployment and labour-force participation on the dashboard for wage and demand signals.",
    ],
    opportunities: [
      income !== "—" ? `Income group ${income} frames consumption potential — segment by city tier.` : "Segment by city tier and channel.",
      "Manufacturing, tourism, digital services, and green-tech angles depend on sector fit — stress-test with local partners.",
      life
        ? `Rising longevity (${life.year}: ${life.value.toFixed(1)} yr life expectancy) shifts healthcare, insurance, and silver-economy demand.`
        : "Demographic ageing patterns in the official series inform healthcare, insurance, and workforce planning.",
      "Regional trade blocs and logistics upgrades can expand reachable markets if customs and standards align.",
      "Digital public infrastructure and e-government maturity (verify via web) can lower customer acquisition cost for online models.",
    ],
    threats: [
      infl && infl.value > 5 ? `Elevated inflation (${pct(infl.value)} in ${infl.year}) can compress margins.` : "Macro volatility and FX risk require hedging and pricing discipline.",
      "Climate, geopolitical, and regulatory shocks are outside this digest — monitor scenario planning.",
      "Commodity and energy price swings pass through to input costs—stress-test margins under upside scenarios.",
      "Cyber incidents and data breaches can disrupt operations; align with national cybersecurity expectations.",
      "Competitive entry from regional peers or substitutes may accelerate if trade barriers fall.",
    ],
  };

  const comprehensiveSections: ComprehensiveSection[] = [
    {
      title: "Executive summary",
      body: [macroPara1, macroPara2, macroPara3].join("\n\n"),
    },
    {
      title: "Political factors",
      body: [
        govLabel
          ? `The reference profile characterises government as: ${govLabel}${headRole ? ` (${headRole})` : ""}. The economy sits in ${region}${sub !== "—" ? ` / ${sub}` : ""}, which frames alliances, trade blocs, and neighbourhood spillovers relevant to policy risk.`
          : `The economy sits in ${region}${sub !== "—" ? ` / ${sub}` : ""}, which frames alliances, trade blocs, and neighbourhood spillovers relevant to policy risk; confirm government type on the Country Dashboard profile card.`,
        "Latest elections, cabinet changes, industrial policy, and geopolitical tensions sit outside this indicator snapshot—when live web research is enabled, narrative can incorporate recent reporting alongside these anchors; otherwise verify with embassies and official bulletins.",
        "For business: stress-test scenarios for regulatory stability, FDI screening, sanctions exposure, and sector licensing before scale-up; align public-affairs plans with documented government priorities.",
      ].join("\n\n"),
    },
    {
      title: "Economic factors",
      body: [
        econLines.length
          ? `Official series currently highlight: ${econLines.slice(0, 5).join(" ")}`
          : "Several core macro series are sparse for this economy—inspect coverage and alternative indicators in the country charts.",
        "Relative performance versus peers, terms-of-trade shocks, and central-bank reaction functions require current market data and sell-side or policy notes beyond this snapshot.",
        "Implication: size TAM and margins using the latest GDP, inflation, and labour-market prints here, then refine pricing, hedging, and working-capital policy with forward-looking FX and rate assumptions.",
      ].join("\n\n"),
    },
    {
      title: "Sociocultural factors",
      body: [
        socialLines.length
          ? `Available demographic and well-being indicators include: ${socialLines.join(" ")}`
          : "Key sociocultural series may be partially reported—use country-chart drill-downs for literacy, dependency ratios, and health where available.",
        "Consumer behaviour, urban–rural divides, trust in institutions, and digital literacy evolve faster than annual statistics; supplement with syndicated research and local panels.",
        "Implication: segment offers by age structure and income trajectory; adapt workforce, benefits, and brand positioning to documented health and education baselines while validating cultural fit in-market.",
      ].join("\n\n"),
    },
    {
      title: "Technological factors",
      body: [
        techDataParagraph,
        "Digital infrastructure, cybersecurity posture, fintech licensing, and national AI or data-localization rules evolve faster than annual indicator tables. When web search is enabled, weave concrete developments (operators, regulators, flagship programs) into a single narrative; otherwise state briefly which digital layers remain unverified and how you would source them.",
        "For operators: stage pilots in the most connected metros, align architecture with likely data-sovereignty requirements, and partner locally for identity, payments, and last-mile delivery before scaling nationally.",
      ].join("\n\n"),
    },
    {
      title: "Environmental factors",
      body: [
        area != null
          ? `Reported land area is about ${(area / 1e6).toFixed(2)} million km²—layer national climate-risk maps and IPCC country context for exposure detail.`
          : "Land area is not on file for this ISO code—pull official geographic statistics for hazard mapping.",
        "Energy mix, emissions targets, water stress, and biodiversity rules are dynamic; cross-check UNFCCC filings and ministry guidance for the assessment year.",
        "Implication: bake climate transition and physical risk into CAPEX, insurance, and supplier codes of conduct; expect tighter ESG scrutiny in trade finance and procurement.",
      ].join("\n\n"),
    },
    {
      title: "Legal factors",
      body: [
        "Reference profile data does not replace legal advice: entity formation, licensing, labour law, tax treaties, and IP enforcement remain jurisdiction-specific and should be confirmed with qualified counsel.",
        "Sanctions, export controls, competition rulings, and consumer-protection cases shift frequently—monitor official registers and, when available, web-retrieved enforcement headlines.",
        "Implication: run a structured legal DD checklist (corporate, employment, data, sector permits) in parallel with the macro view; document assumptions for board and insurer review.",
      ].join("\n\n"),
    },
  ];

  const strategicBusiness: StrategicSection[] = [
    {
      title: "Strengths",
      paragraphs: [
        swot.strengths.slice(0, 3).join(" "),
        "Corroborate these advantages with customer interviews, channel checks, and competitor benchmarking so they translate into defendable positioning rather than generic macro tailwinds.",
        "Operationally, map each strength to a capability you can scale—distribution, cost position, brand, or regulatory access—and assign owners and metrics for the next two planning cycles.",
      ],
    },
    {
      title: "Weaknesses",
      paragraphs: [
        swot.weaknesses.join(" "),
        "Weaknesses rooted in data gaps or governance opacity warrant primary diligence: local partners, reference customers, and regulator engagement reduce surprise risk.",
        "Mitigate through phased entry, joint ventures, compliance investment, and explicit contingency budgets tied to triggers (e.g. policy reversal, FX stress).",
      ],
    },
    {
      title: "Opportunities",
      paragraphs: [
        swot.opportunities.join(" "),
        "Prioritize opportunities where regulatory direction, infrastructure reach, and your product–market fit overlap; sequence pilots to learn before national scale.",
        "When web-enabled analysis runs, demand explicit links between cited developments and your revenue pools; otherwise validate opportunity themes with trade associations and investment promotion agencies.",
      ],
    },
    {
      title: "Threats",
      paragraphs: [
        swot.threats.join(" "),
        "Monitor macro early-warning indicators in the country charts (inflation, debt, unemployment) alongside geopolitical and climate headlines relevant to your supply chain.",
        "Build contingency plans for FX, policy reversals, and logistics disruption; rehearse downside scenarios with treasury, legal, and operations leads. Escalate material risk shifts to executive sponsors and refresh mitigation playbooks at least annually.",
      ],
    },
  ];

  return polishPestelAnalysisForClient({
    pestelDimensions,
    swot,
    comprehensiveSections,
    strategicBusiness,
    newMarketAnalysis: [
      "Screen sectors against health, education, and labour indicators before detailed due diligence.",
      "Map trade agreements (e.g. regional blocs) to tariff and rules-of-origin advantages.",
      "Digital and sustainability positioning should align with stated national development plans.",
      "Size addressable spend using dashboard GDP per capita, poverty, and urban-age structure—not headline GDP alone.",
      "Pilot in the most data-transparent region or city tier; scale only after channel economics and regulatory fit are proven.",
    ],
    keyTakeaways: [
      "Macro indicators are a starting point — segment-level economics and regulation drive investability.",
      "Regional trade blocs and logistics corridors can expand TAM if product-market fit is proven locally.",
      "Governance, infrastructure, and execution gaps often matter more than headline GDP growth.",
      "Environmental and climate exposure increasingly shape CAPEX, insurance, and supply-chain design.",
      "Coordinate tax, labor, licensing, and IP workstreams early to avoid late-stage surprises.",
    ],
    recommendations: [
      "Use this PESTEL as a first-pass strategic brief, then prioritize two to three sector-specific hypotheses for immediate validation with customers, partners, and regulators.",
      "Pair this scan with Country Dashboard trend charts and peer-country comparisons to separate short-term noise from structural shifts.",
      "Assign owners for each critical assumption and refresh core indicators quarterly, explicitly tracking data year and policy-update dates.",
      "For material commitments, triangulate findings with legal, tax, compliance, and local operating experts before final approval.",
      "Re-run PESTEL after major policy changes, election cycles, inflation or FX shocks, and significant revisions in official statistics.",
    ],
  });
}
