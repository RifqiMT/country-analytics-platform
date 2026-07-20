import type { PestelAnalysis, PestelDimension } from "./pestelAnalysis.js";
import { tavilySearchWithMeta, utcDateDaysAgo, utcDateISO } from "./llm.js";

const EXEC_HEADER = "Tavily cross-dimension synthesis (answer field)";

export const PESTEL_CREDIBLE_DOMAINS: readonly string[] = [
  "worldbank.org",
  "imf.org",
  "oecd.org",
  "adb.org",
  "un.org",
  "undp.org",
  "who.int",
  "ilo.org",
  "fao.org",
  "wto.org",
  "bis.org",
  "asean.org",
  "go.id",
  "bps.go.id",
  "bi.go.id",
  "kemkeu.go.id",
  "reuters.com",
  "apnews.com",
  "ft.com",
  "bloomberg.com",
  "economist.com",
];

/** Shown to the model only; instruct it not to echo these headings in JSON output. */
const PESTEL_TEMPORAL_SECTION_MARKER = "## Multi-horizon web research";

/** Keep Groq JSON requests under provider limits; full `web` stays available for grounding / Tavily-only paths. */
export function truncatePestelSourceBForLlm(web: string, maxChars: number): { text: string; truncated: boolean } {
  if (!web || web.length <= maxChars) return { text: web, truncated: false };
  return {
    text: `${web.slice(0, maxChars)}\n\n[Model note: preceding research bundle truncated for API size.]`,
    truncated: true,
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extract markdown subsection body after `### Title` until next `###` or EOF. */
function extractTavilyWebSection(web: string, sectionTitle: string): string {
  const re = new RegExp(`### ${escapeRe(sectionTitle)}\\s*\\n([\\s\\S]*?)(?=\\n### |$)`);
  const m = web.match(re);
  return m ? m[1]!.trim() : "";
}

function dedupePush(out: string[], seen: Set<string>, s: string) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 22 || t.length > 520 || seen.has(t)) return;
  seen.add(t);
  out.push(t);
}

const PESTEL_RELEVANCE_RE =
  /\b(policy|government|regulat|law|court|tax|trade|tariff|fiscal|monetary|central bank|inflation|gdp|growth|debt|investment|market|employment|unemployment|education|health|demograph|population|labor|workforce|technology|digital|innovation|infrastructure|energy|climate|emission|sustainab|environment|geopolit|election|compliance)\b/i;
const NOISE_RE =
  /\b(dog|dogs|cat|cats|pet|flea|tick|collar|puppy|kitten|grooming|review site|coupon|casino|odds|recipe)\b/i;

function looksPestelRelevant(text: string): boolean {
  if (NOISE_RE.test(text)) return false;
  return PESTEL_RELEVANCE_RE.test(text);
}

function recencyScoreFromText(text: string): number {
  const m = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (!m) return 0;
  const ts = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (!Number.isFinite(ts)) return 0;
  const ageDays = Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24)));
  if (ageDays <= 30) return 3;
  if (ageDays <= 90) return 2;
  if (ageDays <= 365) return 1;
  return 0;
}

/**
 * Turn a Tavily formatted block (snippets + optional synthesis line) into short bullets.
 */
function chunkToTavilyBullets(block: string, max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const ranked: { text: string; score: number }[] = [];
  for (const line of block.split("\n")) {
    const lt = line.trim();
    if (lt.startsWith("[Model note")) continue;
    if (lt.startsWith("- ")) {
      const raw = lt.slice(2);
      const idx = raw.lastIndexOf(": ");
      const body = idx >= 0 ? raw.slice(idx + 2).trim() : raw;
      if (looksPestelRelevant(body)) {
        const t = body.replace(/\s+/g, " ").trim();
        if (!seen.has(t) && t.length >= 22 && t.length <= 520) {
          seen.add(t);
          ranked.push({ text: t, score: recencyScoreFromText(raw) });
        }
      }
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  for (const r of ranked) {
    out.push(r.text);
    if (out.length >= max) return out.slice(0, max);
  }
  const blob = block.replace(/\n+/g, " ").trim();
  if (out.length < max && blob.length > 40) {
    for (const sent of blob.split(/(?<=[.!?])\s+/)) {
      if (looksPestelRelevant(sent)) dedupePush(out, seen, sent);
      if (out.length >= max) break;
    }
  }
  return out.slice(0, max);
}

function techFilteredBlock(teBlock: string): string {
  const lines = teBlock.split("\n").filter((l) =>
    /digital|technology|innovation|research|internet|broadband|cyber|software|\bAI\b|ICT|fintech|startup|telecom|R&D/i.test(l)
  );
  const joined = lines.join("\n");
  return joined.trim().length >= 80 ? joined : teBlock;
}

function envFilteredBlock(teBlock: string): string {
  const lines = teBlock.split("\n").filter((l) =>
    /climate|environment|carbon|emission|renewable|energy|COP|biodiversity|water|deforestation|sustainability|green|fossil|net zero/i.test(l)
  );
  const joined = lines.join("\n");
  return joined.trim().length >= 60 ? joined : teBlock;
}

/**
 * When Groq is unavailable, assemble PESTEL **dimension** bullets from the same Tavily SOURCE B bundle
 * the API already built (6 topic blocks + optional executive synthesis section).
 */
export function buildPartialPestelFromTavilyWeb(web: string): Partial<PestelAnalysis> | null {
  if (!web.trim()) return null;

  const pBlock = extractTavilyWebSection(web, "Politics & institutions");
  const eBlock = [
    extractTavilyWebSection(web, "Economy & markets"),
    extractTavilyWebSection(web, "Multilateral & official economic context"),
  ]
    .filter(Boolean)
    .join("\n\n");
  const sBlock = extractTavilyWebSection(web, "Society & human capital");
  const teBlock = extractTavilyWebSection(web, "Technology, energy & environment");
  const lBlock = extractTavilyWebSection(web, "Legal, regulatory & compliance");
  const synthBlock = extractTavilyWebSection(web, EXEC_HEADER);

  const tUse = techFilteredBlock(teBlock);
  const eUse = envFilteredBlock(teBlock);

  const dims: PestelDimension[] = [
    { letter: "P", label: "POLITICAL", bullets: chunkToTavilyBullets(pBlock, 5) },
    { letter: "E", label: "ECONOMIC", bullets: chunkToTavilyBullets(eBlock, 5) },
    { letter: "S", label: "SOCIOCULTURAL", bullets: chunkToTavilyBullets(sBlock, 5) },
    { letter: "T", label: "TECHNOLOGICAL", bullets: chunkToTavilyBullets(tUse, 5) },
    { letter: "E", label: "ENVIRONMENTAL", bullets: chunkToTavilyBullets(eUse, 5) },
    { letter: "L", label: "LEGAL", bullets: chunkToTavilyBullets(lBlock, 5) },
  ];

  const temporalBlob = web.includes(PESTEL_TEMPORAL_SECTION_MARKER)
    ? web.slice(web.indexOf(PESTEL_TEMPORAL_SECTION_MARKER))
    : "";
  if (temporalBlob) {
    const pool = chunkToTavilyBullets(temporalBlob, 36);
    let pi = 0;
    for (const d of dims) {
      while (d.bullets.length < 3 && pi < pool.length) {
        const b = pool[pi++]!;
        if (!d.bullets.includes(b)) d.bullets.push(b);
      }
    }
  }

  const any = dims.some((d) => d.bullets.length > 0);
  if (!any && !synthBlock.trim()) return null;

  const partial: Partial<PestelAnalysis> = { pestelDimensions: dims };
  if (synthBlock.trim()) {
    const paras = synthBlock
      .split(/\n\s*\n+/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 3);
    if (paras.length) {
      partial.comprehensiveSections = [{ title: "Executive summary", body: paras.join("\n\n") }];
    }
  }
  return partial;
}

/** SWOT quadrants from a dedicated Tavily pass when Groq JSON is unavailable. */
export async function fetchPestelSwotPartialFromTavily(
  countryName: string,
  year: number,
  tavilyApiKey?: string
): Promise<Partial<PestelAnalysis> | null> {
  if (!(tavilyApiKey?.trim() || process.env.TAVILY_API_KEY?.trim())) return null;
  const today = utcDateISO();
  const start = utcDateDaysAgo(150);
  const q = `${countryName} SWOT analysis for business and investment: strengths, weaknesses, opportunities, threats. Use recent macro and policy context. Year context: ${year}.`;
  const meta = await tavilySearchWithMeta(q, 10, {
    searchDepth: "advanced",
    includeAnswer: "advanced",
    topic: "general",
    timeRange: "month",
    startDate: start,
    endDate: today,
    preferNewestSourcesFirst: true,
    allowedDomains: [...PESTEL_CREDIBLE_DOMAINS],
    apiKey: tavilyApiKey,
  });
  const blob = meta.formattedBlock;
  if (!blob.trim()) return null;
  const pool = chunkToTavilyBullets(blob, 24);
  if (pool.length < 4) return null;
  return {
    swot: {
      strengths: pool.slice(0, 5),
      weaknesses: pool.slice(5, 10),
      opportunities: pool.slice(10, 15),
      threats: pool.slice(15, 20),
    },
  };
}

/** Prefer overlay fields when present so e.g. SWOT from a second Tavily pass can augment dimension bullets from the web bundle. */
export function mergePestelPartials(base: Partial<PestelAnalysis>, overlay: Partial<PestelAnalysis>): Partial<PestelAnalysis> {
  return {
    ...base,
    ...overlay,
    pestelDimensions:
      overlay.pestelDimensions != null && overlay.pestelDimensions.some((d) => d.bullets.length > 0)
        ? overlay.pestelDimensions
        : base.pestelDimensions,
    swot: overlay.swot ?? base.swot,
    comprehensiveSections: overlay.comprehensiveSections?.length
      ? overlay.comprehensiveSections
      : base.comprehensiveSections,
    strategicBusiness: overlay.strategicBusiness?.length ? overlay.strategicBusiness : base.strategicBusiness,
    newMarketAnalysis: overlay.newMarketAnalysis?.length ? overlay.newMarketAnalysis : base.newMarketAnalysis,
    keyTakeaways: overlay.keyTakeaways?.length ? overlay.keyTakeaways : base.keyTakeaways,
    recommendations: overlay.recommendations?.length ? overlay.recommendations : base.recommendations,
  };
}
