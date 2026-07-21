import { getCache, setCache } from "../cache.js";
import { fetchGlobalYearSnapshotsForRange } from "../globalSnapshot.js";
import { fetchImfWeoGlobalRangeMatrix } from "../imfWeo.js";
import { METRIC_BY_ID } from "../metrics.js";
import { fetchUisGlobalMatrixForRange } from "../uisApi.js";
import { fetchWhoGhoGlobalMatrixForYears } from "../whoGho.js";
import { MIN_DATA_YEAR } from "../yearBounds.js";
import {
  countFiniteInMatrix,
  emptyYearIsoMatrix,
  matrixFromYearRows,
  mergeMatrixFill,
  type YearIsoMatrix,
} from "./matrixTypes.js";

const MATRIX_TTL_MS = 1000 * 60 * 60 * 6;
/** v2: drop GC.DOD.TOTL.CN pollution of debt-% matrices. */
const MATRIX_CACHE_PREFIX = "metric-matrix:v2";

function yearsInclusive(startYear: number, endYear: number): number[] {
  const out: number[] = [];
  for (let y = startYear; y <= endYear; y++) out.push(y);
  return out;
}

function imfMatrixToYearIso(
  imf: Map<number, Map<string, number>>,
  startYear: number,
  endYear: number
): YearIsoMatrix {
  const out = emptyYearIsoMatrix(startYear, endYear);
  for (let y = startYear; y <= endYear; y++) {
    const src = imf.get(y);
    if (!src) continue;
    const dest = out.get(y)!;
    for (const [iso, v] of src) dest.set(iso, v);
  }
  return out;
}

/**
 * Compose one metric × all countries × [startYear, endYear] from modular providers:
 * WDI range → IMF bulk range → UIS range → WHO (UHC) → sex-pair already in WDI range path.
 */
export async function composeMetricMatrix(
  metricId: string,
  startYear: number,
  endYear: number
): Promise<YearIsoMatrix> {
  const def = METRIC_BY_ID[metricId];
  if (!def) return emptyYearIsoMatrix(startYear, endYear);
  const lo = Math.max(MIN_DATA_YEAR, Math.min(startYear, endYear));
  const hi = Math.max(startYear, endYear);

  const cacheKey = `${MATRIX_CACHE_PREFIX}:${metricId}:${lo}:${hi}`;
  const cached = getCache<Array<[number, Array<[string, number | null]>]>>(cacheKey);
  if (cached) {
    const restored = emptyYearIsoMatrix(lo, hi);
    for (const [y, pairs] of cached) {
      const dest = restored.get(y) ?? new Map();
      for (const [iso, v] of pairs) dest.set(iso, v);
      restored.set(y, dest);
    }
    if (countFiniteInMatrix(restored) > 0) return restored;
  }

  let matrix = emptyYearIsoMatrix(lo, hi);

  try {
    const wdiByYear = await fetchGlobalYearSnapshotsForRange(metricId, lo, hi);
    matrix = mergeMatrixFill(matrix, matrixFromYearRows(wdiByYear, lo, hi));
  } catch (e) {
    console.error(
      `[metric-matrix] WDI range failed for ${metricId}:`,
      e instanceof Error ? e.message : e
    );
  }

  if (def.imfWeoIndicator) {
    try {
      const imf = await fetchImfWeoGlobalRangeMatrix(
        def.imfWeoIndicator,
        lo,
        hi,
        def.imfWeoScale ?? 1
      );
      matrix = mergeMatrixFill(matrix, imfMatrixToYearIso(imf, lo, hi));
    } catch (e) {
      console.error(
        `[metric-matrix] IMF range failed for ${metricId}:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  if (def.uisIndicatorId) {
    try {
      const uis = await fetchUisGlobalMatrixForRange(def.uisIndicatorId, lo, hi);
      matrix = mergeMatrixFill(matrix, imfMatrixToYearIso(uis, lo, hi));
    } catch (e) {
      console.error(
        `[metric-matrix] UIS range failed for ${metricId}:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  if (metricId === "uhc_service_coverage") {
    try {
      // WHO GHO publishes densely; fetch a recent long window (full WDI span is empty for this code).
      const whoStart = Math.max(lo, hi - 20);
      const who = await fetchWhoGhoGlobalMatrixForYears(
        "UHC_INDEX_REPORTED",
        yearsInclusive(whoStart, hi)
      );
      matrix = mergeMatrixFill(matrix, imfMatrixToYearIso(who, lo, hi));
    } catch (e) {
      console.error(
        `[metric-matrix] WHO UHC failed:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  if (countFiniteInMatrix(matrix) > 0) {
    setCache(
      cacheKey,
      [...matrix.entries()].map(
        ([y, m]) => [y, [...m.entries()]] as [number, Array<[string, number | null]>]
      ),
      MATRIX_TTL_MS
    );
  }

  return matrix;
}
