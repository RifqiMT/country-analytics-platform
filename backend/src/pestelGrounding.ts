import type { SeriesPoint } from "./series.js";
import type {
  ComprehensiveSection,
  PestelAnalysis,
  PestelDimension,
  StrategicSection,
} from "./pestelAnalysis.js";
import { PESTEL_DIGEST_KEYS } from "./pestelDigestKeys.js";

export type PestelGroundingContext = {
  bundle: Record<string, SeriesPoint[]>;
  digest: string;
  staticProfile: string;
  web: string;
};

/** Heuristic: text appears to assert dashboard-style statistics (not just a casual year). */
const STAT_ASSERTION =
  /\b(gdp|inflation|population|unemployment|debt|literacy|growth|per\s+capita|trillion|billion|million\s+people|life\s+expectancy|enrollment|poverty|undernourishment|wdi|indicator)\b|\d+(?:\.\d+)?%|\$[\d,]|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:million|billion|trillion)\b/i;

function extractYears(s: string): number[] {
  const out: number[] = [];
  for (const m of s.matchAll(/\b(19|20)\d{2}\b/g)) {
    out.push(parseInt(m[0], 10));
  }
  return out;
}

function collectDataYearsFromBundle(bundle: Record<string, SeriesPoint[]>): Set<number> {
  const s = new Set<number>();
  for (const k of PESTEL_DIGEST_KEYS) {
    for (const p of bundle[k] ?? []) {
      if (p.value !== null && p.value !== undefined && Number.isFinite(p.value)) s.add(p.year);
    }
  }
  return s;
}

function buildAllowedYears(ctx: PestelGroundingContext): Set<number> {
  const s = collectDataYearsFromBundle(ctx.bundle);
  for (const y of extractYears(ctx.digest)) s.add(y);
  for (const y of extractYears(ctx.web)) s.add(y);
  for (const y of extractYears(ctx.staticProfile)) s.add(y);
  return s;
}

function buildCorpus(ctx: PestelGroundingContext): string {
  return `${ctx.digest}\n${ctx.staticProfile}\n${ctx.web}`.toLowerCase();
}

function tokenizeInformative(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t));
}

function lexicalGroundedness(text: string, corpus: string): number {
  const toks = tokenizeInformative(text);
  if (toks.length === 0) return 0;
  let hits = 0;
  for (const t of toks) {
    if (corpus.includes(t)) hits += 1;
  }
  return hits / toks.length;
}

/** Percent token in prose is allowed if it matches digest/web/profile (with small float tolerance). */
function percentagesGrounded(s: string, corpus: string): boolean {
  const tokens = s.match(/\d+(?:\.\d+)?%/g);
  if (!tokens?.length) return true;
  const numsInCorpus: number[] = [];
  for (const m of corpus.matchAll(/(\d+(?:\.\d+)?)%/g)) {
    const n = parseFloat(m[1]!);
    if (Number.isFinite(n)) numsInCorpus.push(n);
  }
  for (const t of tokens) {
    const n = parseFloat(t);
    if (!Number.isFinite(n)) return false;
    if (corpus.includes(t.toLowerCase())) continue;
    const rounded = `${n.toFixed(1)}%`;
    if (corpus.includes(rounded)) continue;
    const intp = `${Math.round(n)}%`;
    if (corpus.includes(intp)) continue;
    const ok = numsInCorpus.some((x) => Math.abs(x - n) < 0.35);
    if (!ok) return false;
  }
  return true;
}

/** Dollar-style magnitudes must appear verbatim (normalized spacing) in corpus. */
function dollarSnippetsGrounded(s: string, corpus: string): boolean {
  const re = /\$[\d,.]+(?:\s*(?:trillion|billion|million|bn|mn|b))?/gi;
  const hits = s.match(re);
  if (!hits?.length) return true;
  const c = corpus.replace(/\s+/g, " ");
  for (let h of hits) {
    h = h.trim();
    const norm = h.toLowerCase().replace(/\s+/g, " ");
    const norm2 = norm.replace(/,/g, "");
    if (c.includes(norm) || c.includes(norm2)) continue;
    return false;
  }
  return true;
}

/** e.g. "287.20 million" or "1.55 trillion" without $ — numeric core must appear in corpus (digest uses Mn/Bn). */
function populationOrScaleMagnitudesGrounded(s: string, corpus: string): boolean {
  const re = /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:million|billion|trillion)\b/gi;
  const c = corpus.replace(/,/g, "");
  let m: RegExpExecArray | null;
  const re2 = new RegExp(re.source, re.flags);
  while ((m = re2.exec(s)) !== null) {
    const raw = m[1]!.replace(/,/g, "");
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return false;
    if (c.includes(raw)) continue;
    const forms = [n.toFixed(2), n.toFixed(1), String(Math.round(n))];
    if (!forms.some((f) => c.includes(f))) return false;
  }
  return true;
}

/**
 * Drop LLM prose that cites years or figures absent from SOURCE A / static profile / web corpus.
 * Qualitative-only lines (no stat heuristics) pass through.
 */
function proseIsGrounded(text: string, ctx: PestelGroundingContext, corpus: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const lexical = lexicalGroundedness(t, corpus);
  if (!STAT_ASSERTION.test(t)) {
    // Qualitative prose still needs lexical support from retrieved evidence/context.
    return lexical >= 0.28;
  }

  const allowedYears = buildAllowedYears(ctx);
  for (const y of extractYears(t)) {
    if (!allowedYears.has(y)) return false;
  }
  if (!percentagesGrounded(t, corpus)) return false;
  if (!dollarSnippetsGrounded(t, corpus)) return false;
  if (!populationOrScaleMagnitudesGrounded(t, corpus)) return false;
  if (lexical < 0.2) return false;
  return true;
}

function filterBulletList(llm: string[], ctx: PestelGroundingContext, corpus: string, dropped: { n: number }): string[] {
  const out: string[] = [];
  for (const b of llm) {
    if (proseIsGrounded(b, ctx, corpus)) out.push(b);
    else dropped.n += 1;
  }
  return out;
}

function filterParagraphList(llm: string[], ctx: PestelGroundingContext, corpus: string, dropped: { n: number }): string[] {
  return filterBulletList(llm, ctx, corpus, dropped);
}

export function sanitizePestelPartial(
  partial: Partial<PestelAnalysis>,
  ctx: PestelGroundingContext
): { partial: Partial<PestelAnalysis>; droppedFragments: number } {
  const dropped = { n: 0 };
  const corpus = buildCorpus(ctx);
  const out: Partial<PestelAnalysis> = { ...partial };

  if (partial.pestelDimensions?.length) {
    out.pestelDimensions = partial.pestelDimensions.map((d: PestelDimension) => ({
      ...d,
      bullets: filterBulletList(d.bullets, ctx, corpus, dropped),
    }));
  }

  if (partial.swot) {
    const sw = partial.swot;
    out.swot = {
      strengths: filterBulletList(sw.strengths, ctx, corpus, dropped),
      weaknesses: filterBulletList(sw.weaknesses, ctx, corpus, dropped),
      opportunities: filterBulletList(sw.opportunities, ctx, corpus, dropped),
      threats: filterBulletList(sw.threats, ctx, corpus, dropped),
    };
  }

  if (partial.comprehensiveSections?.length) {
    out.comprehensiveSections = partial.comprehensiveSections.map((sec: ComprehensiveSection) => {
      const paras = sec.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      const kept = filterParagraphList(paras, ctx, corpus, dropped);
      return { ...sec, body: kept.join("\n\n") };
    });
  }

  if (partial.strategicBusiness?.length) {
    out.strategicBusiness = partial.strategicBusiness.map((sec: StrategicSection) => ({
      ...sec,
      paragraphs: filterParagraphList(sec.paragraphs, ctx, corpus, dropped),
    }));
  }

  if (partial.newMarketAnalysis?.length) {
    out.newMarketAnalysis = filterBulletList(partial.newMarketAnalysis, ctx, corpus, dropped);
  }
  if (partial.keyTakeaways?.length) {
    out.keyTakeaways = filterBulletList(partial.keyTakeaways, ctx, corpus, dropped);
  }
  if (partial.recommendations?.length) {
    out.recommendations = filterBulletList(partial.recommendations, ctx, corpus, dropped);
  }

  return { partial: out, droppedFragments: dropped.n };
}
