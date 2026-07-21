import { isServerlessRuntime } from "../serverlessBudget.js";
import { composeMetricMatrix } from "./composeMetricMatrix.js";
import { emptyYearIsoMatrix, type YearIsoMatrix } from "./matrixTypes.js";

const LOAD_CONCURRENCY = isServerlessRuntime() ? 2 : 3;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Load (or reuse cached) country×year matrices for many metrics.
 * Each metric is composed once across the full year span — scalable for table + map reuse.
 */
export async function loadMetricMatrices(
  metricIds: string[],
  startYear: number,
  endYear: number,
  opts?: { concurrency?: number; deadlineMs?: number }
): Promise<Map<string, YearIsoMatrix>> {
  const concurrency = opts?.concurrency ?? LOAD_CONCURRENCY;
  const deadlineMs = opts?.deadlineMs ?? Date.now() + (isServerlessRuntime() ? 55_000 : 120_000);
  const unique = [...new Set(metricIds.filter(Boolean))];

  const results = await mapPool(unique, concurrency, async (id) => {
    if (Date.now() >= deadlineMs) {
      return { id, matrix: emptyYearIsoMatrix(startYear, endYear) };
    }
    try {
      const matrix = await composeMetricMatrix(id, startYear, endYear);
      return { id, matrix };
    } catch (e) {
      console.error(
        `[metric-matrix-store] failed for ${id}:`,
        e instanceof Error ? e.message : e
      );
      return { id, matrix: emptyYearIsoMatrix(startYear, endYear) };
    }
  });

  return new Map(results.map((r) => [r.id, r.matrix] as const));
}
