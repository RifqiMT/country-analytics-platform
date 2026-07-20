import { getJson, type SeriesPoint } from "../api";
import { chunkMetricIds, COUNTRY_SERIES_CHUNK_SIZE } from "./metricChunks";
import { chunkLoadProgress } from "./loadProgress";

function buildSeriesPath(
  country: string,
  start: number,
  end: number,
  metricIds: readonly string[]
): string {
  const q = new URLSearchParams({ start: String(start), end: String(end) });
  q.set("metrics", metricIds.join(","));
  return `/api/country/${country}/series?${q}`;
}

/** Per-chunk timeout — must exceed backend budget for split batches. */
const SERIES_CHUNK_TIMEOUT_MS = 68_000;
/** Fetch up to two metric batches in parallel (faster load, still server-safe). */
const PARALLEL_CHUNK_LIMIT = 2;
const CHUNK_RETRY_DELAYS_MS = [600, 1400] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRetriableSeriesError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /timed out/i.test(msg) ||
    /504/i.test(msg) ||
    /SERIES_TIMEOUT/i.test(msg) ||
    /failed to fetch/i.test(msg) ||
    /network/i.test(msg)
  );
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function fetchSeriesChunkOnce(
  country: string,
  start: number,
  end: number,
  metricIds: readonly string[],
  label: string
): Promise<Record<string, SeriesPoint[]>> {
  return withTimeout(
    getJson<Record<string, SeriesPoint[]>>(buildSeriesPath(country, start, end, metricIds)),
    SERIES_CHUNK_TIMEOUT_MS,
    label
  );
}

/** Fetch one chunk with retries; splits in half on persistent timeout. */
async function fetchSeriesChunkResilient(
  country: string,
  start: number,
  end: number,
  metricIds: readonly string[],
  label: string
): Promise<Record<string, SeriesPoint[]>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= CHUNK_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fetchSeriesChunkOnce(country, start, end, metricIds, label);
    } catch (e) {
      lastErr = e;
      if (!isRetriableSeriesError(e) || attempt >= CHUNK_RETRY_DELAYS_MS.length) break;
      await sleep(CHUNK_RETRY_DELAYS_MS[attempt]!);
    }
  }

  if (metricIds.length <= 1) {
    throw lastErr instanceof Error
      ? lastErr
      : new Error(`Could not load metric data for ${country}. ${String(lastErr)}`);
  }

  const mid = Math.ceil(metricIds.length / 2);
  const left = metricIds.slice(0, mid);
  const right = metricIds.slice(mid);
  const [a, b] = await Promise.all([
    fetchSeriesChunkResilient(country, start, end, left, `${label} (part 1)`),
    fetchSeriesChunkResilient(country, start, end, right, `${label} (part 2)`),
  ]);
  return { ...a, ...b };
}

export async function fetchCountrySeriesBatched(
  country: string,
  start: number,
  end: number,
  metricIds: readonly string[],
  onProgress?: (pct: number) => void
): Promise<Record<string, SeriesPoint[]>> {
  const chunks = chunkMetricIds(metricIds, COUNTRY_SERIES_CHUNK_SIZE);
  const merged: Record<string, SeriesPoint[]> = {};
  let completed = 0;

  for (let i = 0; i < chunks.length; i += PARALLEL_CHUNK_LIMIT) {
    const wave = chunks.slice(i, i + PARALLEL_CHUNK_LIMIT);
    const parts = await Promise.all(
      wave.map((chunk, j) =>
        fetchSeriesChunkResilient(
          country,
          start,
          end,
          chunk,
          `Country metrics batch (${i + j + 1}/${chunks.length})`
        )
      )
    );
    for (const part of parts) Object.assign(merged, part);
    completed += wave.length;
    onProgress?.(chunkLoadProgress(completed, chunks.length));
  }
  return merged;
}

export function latest(series: SeriesPoint[]): { year: number; value: number } | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i].value;
    if (v !== null && !Number.isNaN(v)) return { year: series[i].year, value: v };
  }
  return null;
}

/** Latest observation on or before the given snapshot year. */
export function latestAtOrBefore(
  series: SeriesPoint[],
  year: number
): { year: number; value: number } | null {
  let best: { year: number; value: number } | null = null;
  for (const p of series) {
    if (p.year <= year && p.value != null && !Number.isNaN(p.value)) {
      if (!best || p.year > best.year) best = { year: p.year, value: p.value };
    }
  }
  return best;
}

export function yoyPct(series: SeriesPoint[]): number | null {
  const l = latest(series);
  if (!l) return null;
  const prev = series.find((p) => p.year === l.year - 1 && p.value !== null);
  if (!prev || prev.value === null || prev.value === 0) return null;
  return ((l.value - prev.value) / Math.abs(prev.value)) * 100;
}

export function yoyBpsRate(series: SeriesPoint[]): number | null {
  const l = latest(series);
  if (!l) return null;
  const prev = series.find((p) => p.year === l.year - 1 && p.value !== null);
  if (prev?.value === null || prev?.value === undefined) return null;
  return (l.value - prev.value) * 100;
}

export function yoyAtSnapshot(series: SeriesPoint[], snapshotYear: number): number | null {
  const cur = latestAtOrBefore(series, snapshotYear);
  if (!cur) return null;
  const prev = series.find((p) => p.year === cur.year - 1 && p.value !== null);
  if (!prev || prev.value === null || prev.value === 0) return null;
  return ((cur.value - prev.value) / Math.abs(prev.value)) * 100;
}

export function yoyBpsAtSnapshot(series: SeriesPoint[], snapshotYear: number): number | null {
  const cur = latestAtOrBefore(series, snapshotYear);
  if (!cur) return null;
  const prev = series.find((p) => p.year === cur.year - 1 && p.value !== null);
  if (prev?.value === null || prev?.value === undefined) return null;
  return (cur.value - prev.value) * 100;
}

/** User-friendly message for series load failures. */
export function formatSeriesLoadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/timed out|504|SERIES_TIMEOUT/i.test(raw)) {
    return "Loading country metrics took too long. The platform will retry in smaller batches — use Retry below, or narrow the year range if this persists.";
  }
  return raw.replace(/^Error:\s*/i, "");
}
