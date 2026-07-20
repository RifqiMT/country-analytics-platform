import { METRIC_BY_ID } from "./metrics.js";
import type { SeriesPoint } from "./series.js";
import { tavilySearchWithMeta, type TavilyWebResult } from "./llm.js";

export type AssistantTavilyFallbackInput = {
  message: string;
  countryName?: string;
  cca3?: string;
  /** Pre-rendered platform markdown (dashboard block and/or poverty table). Shown before any web text. */
  platformSectionMarkdown?: string;
  /** Optional per-request key for user-owned Tavily quota. */
  tavilyApiKey?: string;
};

function isMetricLikeQuestion(message: string): boolean {
  const q = message.toLowerCase();
  return /\b(gdp|inflation|unemployment|poverty|population|debt|growth|life expectancy|literacy|rank|ranking|metric|indicator|series|year)\b/.test(
    q
  );
}

function latestObs(pts: SeriesPoint[]): { year: number; value: number } | null {
  const withVal = pts
    .filter((p) => p.value !== null && Number.isFinite(p.value as number))
    .sort((a, b) => b.year - a.year);
  const p = withVal[0];
  return p ? { year: p.year, value: p.value as number } : null;
}

function escapeMdCell(s: string): string {
  return s.replace(/\|/g, "·").replace(/\r?\n/g, " ").trim();
}

/** Side-by-side international ($2.15) vs national poverty headcount from WDI when available. */
export function buildPovertyInternationalVsNationalTable(
  countryLabel: string,
  bundle: Record<string, SeriesPoint[]>
): string | null {
  const intl = latestObs(bundle.poverty_headcount ?? []);
  const nat = latestObs(bundle.poverty_national ?? []);
  if (!intl && !nat) return null;
  const cap = `**${escapeMdCell(countryLabel)} — poverty lines (platform / World Bank WDI)**`;
  const header = `| Line | Latest value | Data year |\n| --- | --- | ---: |`;
  const rows: string[] = [];
  if (intl) {
    const lbl = METRIC_BY_ID.poverty_headcount?.label ?? "International poverty line";
    rows.push(`| ${escapeMdCell(lbl)} | ${intl.value.toFixed(1)}% | ${intl.year} |`);
  }
  if (nat) {
    const lbl = METRIC_BY_ID.poverty_national?.label ?? "National poverty line";
    rows.push(`| ${escapeMdCell(lbl)} | ${nat.value.toFixed(1)}% | ${nat.year} |`);
  }
  const note =
    "*International: WDI SI.POV.DDAY ($2.15/day, 2017 PPP). National: WDI SI.POV.NAHC (official national threshold). Definitions differ—compare cautiously.*";
  return `${cap}\n\n${header}\n${rows.join("\n")}\n\n${note}`;
}

function countryMatchTokens(countryName: string, cca3?: string): string[] {
  const t = new Set<string>();
  const n = countryName.toLowerCase().trim();
  t.add(n);
  for (const w of n.split(/\s+/)) {
    if (w.length > 2) t.add(w);
  }
  if (cca3 && /^[A-Za-z]{3}$/.test(cca3)) {
    const u = cca3.trim();
    t.add(u.toLowerCase());
    t.add(u.toUpperCase());
  }
  if (n.includes("united states")) {
    ["u.s.", "u.s.a.", "usa", "america", "american", "u.s"].forEach((a) => t.add(a));
  }
  if (n === "united kingdom" || n.includes("united kingdom")) {
    ["uk", "u.k.", "britain", "british", "england"].forEach((a) => t.add(a));
  }
  return [...t].filter((s) => s.length > 0);
}

function synthesisMentionsCountry(synth: string, countryName: string, cca3?: string): boolean {
  const sl = synth.toLowerCase();
  for (const tok of countryMatchTokens(countryName, cca3)) {
    if (tok.length > 2 && sl.includes(tok)) return true;
  }
  return false;
}

function topicKeywordsForMessage(message: string): string[] {
  const q = message.toLowerCase();
  const k: string[] = [];
  if (/\bpoverty\b|\bheadcount\b/i.test(q)) {
    k.push("poverty", "poor", "income", "line", "threshold", "headcount");
  }
  if (/\bnational\b/i.test(q)) k.push("national");
  if (/\binternational\b/i.test(q)) k.push("international", "world bank");
  return k;
}

function snippetMatchesTopic(content: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const c = content.toLowerCase();
  return keywords.some((kw) => c.includes(kw));
}

function looksLikeCorruptSnippet(content: string): boolean {
  const t = content.trim();
  if (t.length > 0 && t.length < 18) return true;
  if (/^[A-Za-zÀ-ž]+:\s*less than \d+/i.test(t)) return true;
  if (/^\d{1,2}:\d{2}\s/.test(t) && !/\bpoverty\b/i.test(t)) return true;
  return false;
}

function authorityHostBonus(url: string): number {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes("worldbank.org")) return 3;
    if (h.endsWith(".gov") || h.includes("census.gov")) return 2.5;
    if (h.includes("imf.org") || h.includes("who.int") || h.includes("ilo.org")) return 2;
    if (h.includes("oecd.org")) return 1.5;
    return 0;
  } catch {
    return 0;
  }
}

function wrongRegionPenalty(hay: string, countryName: string): number {
  const n = countryName.toLowerCase();
  let pen = 0;
  if (n.includes("united states") || n === "usa") {
    const nordic = /\b(norway|sweden|denmark|finland|iceland|nordic)\b/.test(hay);
    const us =
      /\b(united states|u\.s\.|usa|america|american|census bureau|u\.s\. census)\b/.test(hay);
    if (nordic && !us) pen += 9;
  }
  return pen;
}

function scoreHit(
  r: TavilyWebResult,
  message: string,
  countryName?: string,
  cca3?: string
): number {
  const title = (r.title ?? "").toLowerCase();
  const content = (r.content ?? "").toLowerCase();
  const hay = `${title} ${content}`;
  let score = 0;

  const tkw = topicKeywordsForMessage(message);
  if (!snippetMatchesTopic(r.content ?? "", tkw)) score -= 6;
  if (looksLikeCorruptSnippet(r.content ?? "")) score -= 12;

  for (const w of message.toLowerCase().split(/\W+/)) {
    if (w.length > 4 && hay.includes(w)) score += 0.35;
  }

  if (countryName) {
    const slug = countryName.toLowerCase().replace(/\s+/g, "-");
    if (slug.length > 3 && r.url.toLowerCase().includes(slug)) score += 5;
    let hit = false;
    for (const tok of countryMatchTokens(countryName, cca3)) {
      if (tok.length > 2 && hay.includes(tok)) {
        score += 6;
        hit = true;
      }
    }
    if (!hit) score -= 7;
    score -= wrongRegionPenalty(hay, countryName);
  }

  score += authorityHostBonus(r.url);

  return score;
}

/**
 * Rank Tavily hits by relevance to the question (and optional focus country); keep up to `take` (default **1**).
 */
export function pickTopTavilyWebResults(
  results: TavilyWebResult[],
  message: string,
  countryName?: string,
  cca3?: string,
  take = 1
): TavilyWebResult[] {
  if (results.length === 0) return [];
  const scored = results.map((r) => ({ r, s: scoreHit(r, message, countryName, cca3) }));
  scored.sort((a, b) => b.s - a.s);
  const floor = countryName ? -8 : -12;
  let picked = scored.filter((x) => x.s >= floor).map((x) => x.r);
  const need = Math.min(take, results.length);
  if (picked.length < need) {
    picked = scored.slice(0, take).map((x) => x.r);
  }
  return picked.slice(0, take);
}

/** Preamble lines vs parsed `- title (url)…` rows from a Tavily `formattedBlock`. */
export function splitAssistantWebContextHeadAndBullets(raw: string): {
  head: string;
  resultLines: TavilyWebResult[];
} {
  const lines = raw.split(/\r?\n/);
  const headLines: string[] = [];
  const bullets: TavilyWebResult[] = [];
  for (const line of lines) {
    const t = line.trim();
    const m = t.match(
      /^- (.+) \((https?:\/\/[^)]+)\)(?: · published\/updated:\s*([^\n:]+))?: (.+)$/
    );
    if (m) {
      bullets.push({
        title: m[1]!.trim(),
        url: m[2]!,
        published_date: (m[3] ?? "").trim() || undefined,
        content: m[4]!.trim(),
      });
    } else {
      if (bullets.length === 0) headLines.push(line);
    }
  }
  return { head: headLines.join("\n").replace(/\s+$/, ""), resultLines: bullets };
}

function formatTavilyResultAsBullet(r: TavilyWebResult): string {
  const when = r.published_date ? ` · published/updated: ${r.published_date}` : "";
  return `- ${r.title} (${r.url})${when}: ${r.content}`;
}

export function mergeAssistantWebHeadAndResults(head: string, results: TavilyWebResult[]): string {
  const parts = [head.trim(), ...results.map(formatTavilyResultAsBullet)].filter(Boolean);
  return parts.join("\n\n");
}

function compactSnippetForSourceList(content: string, maxLen = 130): string {
  let s = content
    .replace(/\|/g, " ")
    .replace(/[#*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "Supporting article from live web search.";
  if (/^(rank\s*\|?\s*country|#\s*\||\|\s*rank|\|\s*#\s*\|)/i.test(s) && s.length < 120) {
    return "Includes ranked tables and country-level figures.";
  }
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const sp = cut.lastIndexOf(" ");
  return (sp > 35 ? cut.slice(0, sp) : cut).trim() + "…";
}

function escapeMdLinkLabel(s: string): string {
  return s.replace(/[\[\]]/g, "");
}

/**
 * When all Groq models fail: ground on platform markdown when provided, run a country-scoped Tavily search,
 * filter irrelevant / noisy hits, and avoid showing synthesis that ignores the selected country.
 */
export async function tavilyAssistantFallbackReply(
  input: AssistantTavilyFallbackInput | string
): Promise<{ text: string; hasSynthesis: boolean }> {
  const ctx: AssistantTavilyFallbackInput =
    typeof input === "string" ? { message: input } : input;
  const { message, countryName, cca3, platformSectionMarkdown, tavilyApiKey } = ctx;
  const metricLike = isMetricLikeQuestion(message);

  const qParts: string[] = [message.trim()];
  if (countryName) {
    qParts.push(`${countryName} (${cca3 ?? ""})`.trim());
    if (metricLike) {
      qParts.push(`${countryName} poverty national poverty line international poverty line World Bank WDI`);
    }
  }
  if (metricLike) qParts.push("official statistics");
  const searchQuery = qParts.join(" ").replace(/\s+/g, " ").slice(0, 400);

  const meta = await tavilySearchWithMeta(searchQuery, 6, {
    searchDepth: "advanced",
    includeAnswer: "advanced",
    topic: "general",
    timeRange: "year",
    preferNewestSourcesFirst: true,
    apiKey: tavilyApiKey,
  });

  const filtered = pickTopTavilyWebResults(meta.results ?? [], message, countryName, cca3, 1);

  let synth = meta.synthesizedAnswer;
  if (synth && countryName && !synthesisMentionsCountry(synth, countryName, cca3)) {
    synth = null;
  }

  if (!platformSectionMarkdown?.trim() && !filtered.length && !synth) {
    return {
      text: "Live web search did not return usable results, and the language model is temporarily unavailable. Please try again shortly or check your API quotas (Groq / Tavily).",
      hasSynthesis: false,
    };
  }

  const lines: string[] = [];
  const includePlatformSection = metricLike && Boolean(platformSectionMarkdown?.trim());
  if (includePlatformSection) {
    lines.push(
      "**Platform figures below** are from this app’s database. **Web:** one excerpt was selected for relevance—double-check anything material on the linked page."
    );
    lines.push("");
    lines.push(platformSectionMarkdown!.trim());
    lines.push("");
  }

  if (synth) {
    lines.push(synth);
    lines.push("");
  } else if (countryName && filtered.length && includePlatformSection) {
    lines.push(
      `**Context:** Results below mention **${countryName}** or official economic statistics where possible. There was no safe auto-summary for your exact question—use the platform table and open the links for narrative context.`
    );
    lines.push("");
  }

  if (filtered.length) {
    lines.push(includePlatformSection ? "**Web source**" : "**Source**");
    for (const r of filtered) {
      const label = escapeMdLinkLabel(r.title || r.url);
      const sum = compactSnippetForSourceList(r.content);
      lines.push(`- [${label}](${r.url}) — ${sum}`);
    }
  } else if (!platformSectionMarkdown?.trim() && meta.formattedBlock.trim()) {
    lines.push(meta.formattedBlock.slice(0, 3500));
  }

  return { text: lines.join("\n").trim(), hasSynthesis: Boolean(synth) };
}
