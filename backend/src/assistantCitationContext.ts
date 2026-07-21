/** Compact platform + web retrieval into [D#] / [W#] lines for the LLM and a parallel map for the UI. */

import {
  mergeAssistantWebHeadAndResults,
  pickTopTavilyWebResults,
  splitAssistantWebContextHeadAndBullets,
} from "./assistantTavilyFallback.js";

type AssistantWebCitation = { title: string; url: string; snippet: string };

export type AssistantChatCitations = {
  /** Tooltip text per id (keys "1", "2", … match [D1], [D2] in the model reply). */
  D: Record<string, string>;
  W: Record<string, AssistantWebCitation>;
};

const MAX_WEB_SNIP = 240;

type CiteState = { nextD: number; citations: AssistantChatCitations };

function createState(): CiteState {
  return { nextD: 1, citations: { D: {}, W: {} } };
}

function nextDId(state: CiteState): string {
  return String(state.nextD++);
}

/** Country dashboard / comparison blocks from `buildAssistantPrimaryDataBlock`. */
function citePrimaryDataBlock(raw: string, state: CiteState): string {
  if (!raw.trim()) return "";
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push("");
      continue;
    }
    if (/^Country:\s/.test(t)) {
      const id = nextDId(state);
      state.citations.D[id] = t;
      out.push(`[D${id}] ${t}`);
      continue;
    }
    if (/^Region:\s/.test(t)) {
      const id = nextDId(state);
      state.citations.D[id] = t;
      out.push(`[D${id}] ${t}`);
      continue;
    }
    if (/^The following values match/.test(t)) {
      out.push(t);
      continue;
    }
    if (/^•\s/.test(t)) {
      const id = nextDId(state);
      const rest = t.replace(/^•\s+/, "");
      state.citations.D[id] = rest;
      out.push(`[D${id}] ${rest}`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** World-aggregate digest from `buildAssistantWldAggregateBlock` (Global Analytics WLD pipeline). */
function citeWldAggregateBlock(raw: string, state: CiteState): string {
  if (!raw.trim()) return "";
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push("");
      continue;
    }
    if (/^•\s/.test(t)) {
      const id = nextDId(state);
      const rest = t.replace(/^•\s+/, "");
      state.citations.D[id] = rest;
      out.push(`[D${id}] ${rest}`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** Global ranking `plainBlock` from `assistantRankingBlock`. */
function citeRankingPlainBlock(raw: string, state: CiteState): string {
  if (!raw.trim()) return "";
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push("");
      continue;
    }
    if (/^\d+\.\s/.test(t)) {
      const id = nextDId(state);
      state.citations.D[id] = t;
      out.push(`[D${id}] ${t}`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Tavily `formattedBlock`: synthesis line, optional retrieval window, `- title (url) · published/updated: …: content` rows.
 * Only **one** web source ([W1]) is emitted for sharper, less contradictory grounding.
 */
function citeWebBlock(raw: string, state: CiteState, maxWebCitations = 1): string {
  if (!raw.trim()) return "";
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let w = 1;
  let webEmitted = 0;
  for (const line of lines) {
    const t = line;
    const trim = t.trim();
    if (!trim) {
      out.push("");
      continue;
    }
    if (/^\[Retrieval window:/.test(trim)) {
      out.push(trim);
      continue;
    }
    if (/^Brief synthesis/.test(trim)) {
      out.push(trim);
      continue;
    }
    const m = trim.match(
      /^- (.+) \((https?:\/\/[^)]+)\)(?: · published\/updated:\s*([^\n:]+))?: (.+)$/
    );
    if (m) {
      if (webEmitted >= maxWebCitations) continue;
      webEmitted++;
      const title = m[1]!.trim();
      const url = m[2]!;
      const pub = (m[3] ?? "").trim();
      const when = pub ? ` · published/updated: ${pub}` : "";
      const content = m[4]!.trim();
      const id = String(w++);
      const snippet = content.length > MAX_WEB_SNIP ? `${content.slice(0, MAX_WEB_SNIP)}…` : content;
      state.citations.W[id] = { title, url, snippet: content };
      out.push(`[W${id}] ${title} (${url})${when}`);
      out.push(`   ${snippet.replace(/\s+/g, " ")}`);
      continue;
    }
    out.push(t);
  }
  return out.join("\n");
}

export function compactAssistantRetrievalForLlm(opts: {
  dashboardForPrompt: string;
  comparisonBlock: string;
  rankingSection: string;
  /** World / global totals from Global Analytics WLD pipeline. */
  wldAggregateSection?: string;
  webContext: string;
  /** When set, Tavily bullets are scored and only the single best hit is kept before [W1] tagging. */
  webRelevance?: { message: string; countryName?: string; cca3?: string };
  /** Max Tavily citations to keep in context (default 1). */
  webTopK?: number;
}): {
  dashboardForPrompt: string;
  comparisonBlock: string;
  rankingSection: string;
  wldAggregateSection: string;
  webContext: string;
  citations: AssistantChatCitations;
} {
  const state = createState();

  const dashboardForPrompt = citePrimaryDataBlock(opts.dashboardForPrompt, state);

  let comparisonBlock = "";
  if (opts.comparisonBlock.trim()) {
    const chunks = opts.comparisonBlock.split(/\n\n────────\n\n/);
    comparisonBlock = chunks.map((c) => citePrimaryDataBlock(c, state)).join("\n\n────────\n\n");
  }

  const rankingSection = citeRankingPlainBlock(opts.rankingSection, state);
  const wldAggregateSection = citeWldAggregateBlock(opts.wldAggregateSection ?? "", state);

  let webRaw = opts.webContext;
  const webTopK = Math.max(1, Math.min(3, opts.webTopK ?? 1));
  if (opts.webRelevance?.message?.trim() && webRaw.trim()) {
    const { head, resultLines } = splitAssistantWebContextHeadAndBullets(webRaw);
    if (resultLines.length > 1) {
      const one = pickTopTavilyWebResults(
        resultLines,
        opts.webRelevance.message,
        opts.webRelevance.countryName,
        opts.webRelevance.cca3,
        webTopK
      );
      webRaw = mergeAssistantWebHeadAndResults(head, one);
    }
  }
  const webContext = citeWebBlock(webRaw, state, webTopK);

  return {
    dashboardForPrompt,
    comparisonBlock,
    rankingSection,
    wldAggregateSection,
    webContext,
    citations: state.citations,
  };
}
