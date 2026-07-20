export type BusinessAnalysisConfig = {
  metricX: string;
  metricY: string;
  startYear: number;
  endYear: number;
  excludeIqr: boolean;
  highlight: string;
};

export type BusinessCorrelationNarrative = {
  associationParagraphs: [string, string];
  correlationBullets: [string, string, string];
  causationParagraph: string;
  causationHypotheses: [string, string, string];
  recommendedAnalyses: [string, string, string];
};

type CacheEntry = {
  v: 2;
  config: BusinessAnalysisConfig;
  // CorrResult is intentionally typed as unknown to avoid coupling this helper
  // to the page-local CorrResult type. Consumers cast on read.
  res: unknown;
  narrative: BusinessCorrelationNarrative | null;
};

const STORAGE_KEY = "cap_business_correlation_v2";

function safeRead(): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const e = p as Partial<CacheEntry>;
    if (e.v !== 2 || !e.config || !("res" in e)) return null;
    const res = e.res as { n?: number; points?: unknown[] } | null;
    // Ignore empty / broken analyses so the UI does not restore a blank chart.
    if (!res || typeof res !== "object" || !Array.isArray(res.points) || res.points.length === 0) {
      return null;
    }
    return e as CacheEntry;
  } catch {
    return null;
  }
}

export function loadBusinessCorrelationFromCache(): CacheEntry | null {
  return safeRead();
}

export function saveBusinessCorrelationToCache(entry: CacheEntry): void {
  try {
    const res = entry.res as { points?: unknown[] } | null;
    if (!res || !Array.isArray(res.points) || res.points.length === 0) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...entry, v: 2 }));
  } catch {
    /* ignore quota/private mode */
  }
}

