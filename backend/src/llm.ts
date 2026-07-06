export type Attribution = {
  sources: string[];
  model?: string;
  webSearchUsed?: boolean;
};

/** Legacy default when no `GROQ_MODEL` / use-case override (e.g. ad-hoc `groqChat` without model). */
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

import { capServerlessTimeout, isServerlessRuntime } from "./serverlessBudget.js";

const DEFAULT_GROQ_TIMEOUT_MS = isServerlessRuntime() ? 25_000 : 120_000;
export type GroqUseCase = "pestel" | "porter" | "assistant" | "business";

const USE_CASE_DEFAULT_PRIMARY: Record<GroqUseCase, string> = {
  /** Long structured JSON + multi-section narrative */
  pestel: "llama-3.3-70b-versatile",
  /** Industry / competitive framing; distinct from PESTEL primary (see Groq deprecations for current ids). */
  porter: "openai/gpt-oss-120b",
  /** Interactive chat: latency-first, then scale up on retry */
  assistant: "llama-3.1-8b-instant",
  /** Analytics narrative: compact, low-hallucination statistical interpretation */
  business: "llama-3.3-70b-versatile",
};

const USE_CASE_BUILTIN_FALLBACKS: Record<GroqUseCase, readonly string[]> = {
  pestel: ["llama-3.1-8b-instant", "openai/gpt-oss-120b", "qwen/qwen3-32b"],
  porter: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen/qwen3-32b"],
  assistant: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "qwen/qwen3-32b"],
  business: ["llama-3.1-8b-instant", "openai/gpt-oss-120b", "qwen/qwen3-32b"],
};

function trimEnv(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

function parseModelList(raw: string | undefined): string[] {
  return raw?.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean) ?? [];
}

/** Primary model for a feature: `GROQ_MODEL_<USECASE>` → `GROQ_MODEL` (legacy) → built-in default for that use case. */
export function resolveGroqModelPrimaryForUseCase(useCase: GroqUseCase): string {
  const envKey =
    useCase === "pestel"
      ? "GROQ_MODEL_PESTEL"
      : useCase === "porter"
        ? "GROQ_MODEL_PORTER"
        : useCase === "business"
          ? "GROQ_MODEL_BUSINESS"
          : "GROQ_MODEL_ASSISTANT";
  return trimEnv(envKey) ?? trimEnv("GROQ_MODEL") ?? USE_CASE_DEFAULT_PRIMARY[useCase];
}

/**
 * Ordered model ids for Groq retries: primary → per-use-case fallbacks → global `GROQ_FALLBACK_MODELS` → built-ins for that use case.
 */
export function resolveGroqModelCandidatesForUseCase(useCase: GroqUseCase): string[] {
  const primary = resolveGroqModelPrimaryForUseCase(useCase);
  const fallbacksEnvKey =
    useCase === "pestel"
      ? "GROQ_FALLBACK_MODELS_PESTEL"
      : useCase === "porter"
        ? "GROQ_FALLBACK_MODELS_PORTER"
        : useCase === "business"
          ? "GROQ_FALLBACK_MODELS_BUSINESS"
          : "GROQ_FALLBACK_MODELS_ASSISTANT";
  const fromUseCase = parseModelList(process.env[fallbacksEnvKey]);
  const fromGlobal = parseModelList(process.env.GROQ_FALLBACK_MODELS);
  const builtIns = [...USE_CASE_BUILTIN_FALLBACKS[useCase]];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [primary, ...fromUseCase, ...fromGlobal, ...builtIns]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** @deprecated Prefer `resolveGroqModelPrimaryForUseCase` or use-case candidates. Legacy: `GROQ_MODEL` or default 70B. */
export function resolveGroqModel(): string {
  const raw = process.env.GROQ_MODEL?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_GROQ_MODEL;
}

function groqErrorMessage(status: number, bodyText: string): string {
  const trimmed = bodyText.trim();
  try {
    const j = JSON.parse(trimmed) as { error?: { message?: string } };
    const m = j?.error?.message;
    if (typeof m === "string" && m.length > 0) return m;
  } catch {
    /* use raw */
  }
  return trimmed || `HTTP ${status}`;
}

/**
 * Whether to try the next Groq model in the chain (or Tavily elsewhere).
 * Includes transient HTTP errors and 400s that indicate a bad/removed model id so env misconfig does not abort before later candidates.
 */
export function groqFailureIsRetryable(status: number, errMessage?: string): boolean {
  if ([408, 429, 500, 502, 503, 529].includes(status)) return true;
  if (status === 400 && errMessage) {
    const m = errMessage.toLowerCase();
    if (
      m.includes("decommissioned") ||
      m.includes("no longer supported") ||
      m.includes("invalid model") ||
      m.includes("model_not_found") ||
      m.includes("does not exist") ||
      m.includes("unknown model")
    ) {
      return true;
    }
    /** Context / token limits — trim prompt or switch model instead of aborting the whole chain. */
    if (
      m.includes("context") ||
      m.includes("too long") ||
      m.includes("token") ||
      m.includes("maximum") ||
      m.includes("length") ||
      m.includes("payload")
    ) {
      return true;
    }
  }
  return false;
}

/** Network / timeout / DNS — status parse fails so the fallback loop must still advance to the next model. */
export function groqTransportFailureIsRetryable(err: Error): boolean {
  const n = err.name || "";
  const m = (err.message || "").toLowerCase();
  if (n === "AbortError") return true;
  if (/aborted|timeout|timed out|etimedout|econnreset|econnrefused|enotfound|epipe|socket|network|fetch failed|und_err/i.test(m)) {
    return true;
  }
  return false;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseGroqErrorStatus(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/^Groq \((\d+)\):/);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Legacy candidate list (Assistant-oriented). Prefer `resolveGroqModelCandidatesForUseCase("assistant")` in new code.
 */
export function resolveGroqModelCandidates(): string[] {
  return resolveGroqModelCandidatesForUseCase("assistant");
}

export type TavilyTimeRange = "day" | "week" | "month" | "year";

export type TavilySearchOptions = {
  maxResults?: number;
  /** Default `advanced` for richer snippets (higher relevance; more API credits). */
  searchDepth?: "basic" | "advanced" | "fast" | "ultra-fast";
  /** `news` biases toward recent articles when supported by the API. */
  topic?: "general" | "news" | "finance";
  /**
   * Filter to sources published/updated within this window (Tavily `time_range`).
   * Pair with `startDate` for a hard floor on stale pages.
   */
  timeRange?: TavilyTimeRange | null;
  /** Inclusive YYYY-MM-DD (Tavily `start_date`) — strongest lever against outdated hits. */
  startDate?: string;
  /** YYYY-MM-DD upper bound (Tavily `end_date`), usually today. */
  endDate?: string;
  /** Ask Tavily for a short synthesized answer — boolean or `advanced` for a longer answer. */
  includeAnswer?: boolean | "basic" | "advanced";
  /** Sort hits by `published_date` when the API returns it (default true). */
  preferNewestSourcesFirst?: boolean;
  /** Optional domain allowlist; when set, non-matching hosts are dropped. */
  allowedDomains?: string[];
  /** Optional per-request API key override (e.g., user-provided key in Assistant). */
  apiKey?: string;
};

/** Today as YYYY-MM-DD (UTC). */
export function utcDateISO(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Calendar date N days ago (UTC), YYYY-MM-DD. */
export function utcDateDaysAgo(days: number, from = new Date()): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Appended to system prompts so the model weights retrieval over stale parametric knowledge. */
export function analyticsRecencySystemSuffix(): string {
  const iso = new Date().toISOString().slice(0, 10);
  return `Today’s date is ${iso} (UTC). The thread includes **live web excerpts**—treat them as the freshest evidence. For current officeholders, election outcomes, and fast-moving policy, prefer what those excerpts say (including any dates they cite) over undated training knowledge. Never “override” clearly dated reporting with stale guesses. If excerpts do not name who holds office, do not invent a name from memory—say verification is needed.`;
}

export type TavilyWebResult = {
  title: string;
  url: string;
  content: string;
  published_date?: string;
};

export type TavilySearchMeta = {
  formattedBlock: string;
  synthesizedAnswer: string | null;
  /** Raw hits (same order as formatted bullets when present). Used to filter / re-rank for assistant fallback. */
  results: TavilyWebResult[];
};

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function matchesAllowedDomain(url: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const host = hostFromUrl(url);
  if (!host) return false;
  return allowed.some((d) => {
    const dom = d.toLowerCase().replace(/^\*\./, "").trim();
    return host === dom || host.endsWith(`.${dom}`);
  });
}

function cleanTavilySnippet(raw: string): string {
  let t = raw;
  const drops: RegExp[] = [
    /^#{1,6}\s+.*$/gm,
    /\bKey Highlights\b/gi,
    /\bReasons to Buy\b/gi,
    /\bBuy Report\b/gi,
    /\$?\d{1,4}\s*Buy\b/gi,
    /\bDownload FREE Resources\b/gi,
    /\bReport Code:\s*[A-Z0-9\-]+\b/gi,
    /\bShare on [A-Za-z ]+\b/gi,
    /\bCopy Link\b/gi,
    /\bPublished:\s*[A-Za-z]+\s+\d{1,2},\s*\d{4}\b/gi,
    /\[Retrieval window:[^\]]*\]/gi,
  ];
  for (const re of drops) t = t.replace(re, " ");
  return t.replace(/\s+/g, " ").trim();
}

export async function tavilySearchWithMeta(
  query: string,
  maxResults = 5,
  options?: TavilySearchOptions
): Promise<TavilySearchMeta> {
  const key = options?.apiKey?.trim() || process.env.TAVILY_API_KEY?.trim();
  if (!key) return { formattedBlock: "", synthesizedAnswer: null, results: [] };
  const max_results = options?.maxResults ?? maxResults;
  const body: Record<string, unknown> = {
    api_key: key,
    query,
    search_depth: options?.searchDepth ?? "advanced",
    max_results,
    topic: options?.topic ?? "general",
    include_answer: options?.includeAnswer ?? true,
    chunks_per_source: 3,
  };
  if (options?.timeRange) body.time_range = options.timeRange;
  if (options?.startDate) body.start_date = options.startDate;
  if (options?.endDate) body.end_date = options.endDate;
  if (options?.allowedDomains?.length) body.include_domains = options.allowedDomains;

  let data: {
    answer?: string;
    results?: {
      title?: string;
      url?: string;
      content?: string;
      published_date?: string;
    }[];
  };
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { formattedBlock: "", synthesizedAnswer: null, results: [] };
    data = (await res.json()) as {
      answer?: string;
      results?: {
        title?: string;
        url?: string;
        content?: string;
        published_date?: string;
      }[];
    };
  } catch {
    // Network-level failures (e.g., DNS/TLS/socket) should degrade gracefully instead of failing the whole request.
    return { formattedBlock: "", synthesizedAnswer: null, results: [] };
  }
  const synth =
    typeof data.answer === "string" && data.answer.trim() ? data.answer.trim() : null;
  const chunks: string[] = [];
  // Keep generated answer separate from snippet blocks so downstream grounding paths
  // can stay strictly retrieval-based (title/url/content only).
  let rows = data.results ?? [];
  if (options?.preferNewestSourcesFirst !== false && rows.length > 1) {
    rows = [...rows].sort((a, b) => {
      const ta = a.published_date ? Date.parse(a.published_date) : NaN;
      const tb = b.published_date ? Date.parse(b.published_date) : NaN;
      if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
      if (!Number.isFinite(ta)) return 1;
      if (!Number.isFinite(tb)) return -1;
      return tb - ta;
    });
  }
  const allowed = options?.allowedDomains?.map((d) => d.trim()).filter(Boolean) ?? [];
  const results: TavilyWebResult[] = rows
    .map((r) => ({
      title: String(r.title ?? "").trim(),
      url: String(r.url ?? "").trim(),
      content: cleanTavilySnippet(String(r.content ?? "").trim()),
      published_date:
        r.published_date && String(r.published_date).trim() ? String(r.published_date).trim() : undefined,
    }))
    .filter((r) => r.url && r.content && matchesAllowedDomain(r.url, allowed));
  const parts = results.map((r) => {
    const when =
      r.published_date && r.published_date.length > 0
        ? ` · published/updated: ${r.published_date}`
        : "";
    return `- ${r.title} (${r.url})${when}: ${r.content}`;
  });
  if (parts.length) chunks.push(...parts);
  return { formattedBlock: chunks.join("\n"), synthesizedAnswer: synth, results };
}

export async function tavilySearch(
  query: string,
  maxResults = 5,
  options?: TavilySearchOptions
): Promise<string> {
  const { formattedBlock } = await tavilySearchWithMeta(query, maxResults, options);
  return formattedBlock;
}

export async function groqChat(
  system: string,
  user: string,
  options?: {
    jsonObject?: boolean;
    temperature?: number;
    /** Nucleus sampling; lower = more deterministic (e.g. 0.9 for structured JSON). Default 1. */
    topP?: number;
    analyticsRecencyHint?: boolean;
    /** Override resolved primary model (used by fallback chain). */
    model?: string;
    /** Abort slow requests so the assistant can try the next model (default 120s). */
    timeoutMs?: number;
    /** Cap completion length (default 8192). */
    maxTokens?: number;
    /** Optional per-request API key override (e.g., user-provided key in Assistant). */
    apiKey?: string;
  }
): Promise<{ text: string; model: string }> {
  const key = options?.apiKey?.trim() || process.env.GROQ_API_KEY;
  const model =
    options?.model?.trim() && options.model.trim().length > 0
      ? options.model.trim()
      : resolveGroqModel();
  if (!key) throw new Error("GROQ_API_KEY not set");
  const temperature =
    typeof options?.temperature === "number" && Number.isFinite(options.temperature)
      ? Math.min(1.5, Math.max(0, options.temperature))
      : 0.4;
  const systemContent =
    options?.analyticsRecencyHint === true ? `${system}\n\n${analyticsRecencySystemSuffix()}` : system;
  const topP =
    typeof options?.topP === "number" && Number.isFinite(options.topP)
      ? Math.min(1, Math.max(0.01, options.topP))
      : 1;
  const timeoutMs =
    typeof options?.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? capServerlessTimeout(Math.min(300_000, options.timeoutMs))
      : DEFAULT_GROQ_TIMEOUT_MS;
  const maxTokens =
    typeof options?.maxTokens === "number" && Number.isFinite(options.maxTokens) && options.maxTokens >= 256
      ? Math.min(8192, Math.floor(options.maxTokens))
      : 8192;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: user },
        ],
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        ...(options?.jsonObject ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: ac.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const err = e instanceof Error ? e : new Error(String(e));
    if (err.name === "AbortError") {
      throw new Error(`Groq (408): request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
  clearTimeout(timer);
  if (!res.ok) {
    const body = await res.text();
    const detail = groqErrorMessage(res.status, body);
    throw new Error(`Groq (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  return { text, model };
}

/**
 * Try primary + fallback Groq models for a specific product surface (PESTEL vs Porter vs Assistant each has its own stack).
 * Per-use-case env: `GROQ_MODEL_PESTEL`, `GROQ_MODEL_PORTER`, `GROQ_MODEL_ASSISTANT` and matching `GROQ_FALLBACK_MODELS_*`.
 * If unset, `GROQ_MODEL` / `GROQ_FALLBACK_MODELS` apply, then built-in defaults differ by use case.
 */
export async function groqChatWithFallbackForUseCase(
  useCase: GroqUseCase,
  system: string,
  user: string,
  options?: {
    jsonObject?: boolean;
    temperature?: number;
    topP?: number;
    analyticsRecencyHint?: boolean;
    timeoutMs?: number;
    maxTokens?: number;
    /** Limit how many model candidates are tried for this call. */
    maxModelAttempts?: number;
    /** Optional per-request API key override (e.g., user-provided key in Assistant). */
    apiKey?: string;
  }
): Promise<{
  text: string;
  model: string;
  triedModels: string[];
  primaryFailed: boolean;
  useCase: GroqUseCase;
}> {
  const candidatesAll = resolveGroqModelCandidatesForUseCase(useCase);
  const maxAttempts =
    typeof options?.maxModelAttempts === "number" &&
    Number.isFinite(options.maxModelAttempts) &&
    options.maxModelAttempts > 0
      ? Math.min(candidatesAll.length, Math.floor(options.maxModelAttempts))
      : candidatesAll.length;
  const candidates = candidatesAll.slice(0, maxAttempts);
  const tried: string[] = [];
  let lastErr: Error | null = null;
  let lastStatus: number | null = null;
  const assistantTimeout =
    useCase === "assistant" ? (options?.timeoutMs ?? DEFAULT_GROQ_TIMEOUT_MS) : options?.timeoutMs;

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i]!;
    if (i > 0 && lastStatus !== null && [408, 429, 500, 502, 503, 529].includes(lastStatus)) {
      const base = 800 + i * 700;
      await sleepMs(base + Math.floor(Math.random() * 450));
    } else if (i > 0 && lastErr && groqTransportFailureIsRetryable(lastErr)) {
      await sleepMs(250 + i * 200);
    }

    tried.push(model);
    try {
      const r = await groqChat(system, user, {
        ...options,
        model,
        timeoutMs: assistantTimeout ?? options?.timeoutMs,
      });
      return {
        text: r.text,
        model: r.model,
        triedModels: tried,
        primaryFailed: i > 0,
        useCase,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      lastStatus = parseGroqErrorStatus(lastErr);
      const httpRetry =
        lastStatus !== null && groqFailureIsRetryable(lastStatus, lastErr.message);
      const transportRetry = groqTransportFailureIsRetryable(lastErr);
      const retry = httpRetry || transportRetry;
      if (!retry || i === candidates.length - 1) {
        throw lastErr;
      }
    }
  }
  throw lastErr ?? new Error("Groq: no models to try");
}

/** @deprecated Use `groqChatWithFallbackForUseCase("assistant", ...)` for explicit routing. Alias: Assistant stack. */
export async function groqChatWithFallback(
  system: string,
  user: string,
  options?: { jsonObject?: boolean; temperature?: number; topP?: number; analyticsRecencyHint?: boolean }
): Promise<{ text: string; model: string; triedModels: string[]; primaryFailed: boolean }> {
  const r = await groqChatWithFallbackForUseCase("assistant", system, user, options);
  return {
    text: r.text,
    model: r.model,
    triedModels: r.triedModels,
    primaryFailed: r.primaryFailed,
  };
}
