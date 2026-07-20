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
  for (const chunk of chunks) {
    const part = await withTimeout(
      getJson<Record<string, SeriesPoint[]>>(buildSeriesPath(country, start, end, chunk)),
      52_000,
      `Country metrics batch (${completed + 1}/${chunks.length})`
    );
    Object.assign(merged, part);
    completed += 1;
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
    if (p.year <= year && p.value !== null && !Number.isNaN(p.value)) {
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
