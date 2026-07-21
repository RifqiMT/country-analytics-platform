import type { MetricDef } from "./metrics.js";
import { METRIC_BY_ID } from "./metrics.js";
import type { SeriesPoint, SeriesProvenance } from "./series.js";
import { isMissingMetricValue, isUsableNumber } from "./wdiParse.js";

/** Linear interpolation for interior gaps up to this many years; wider gaps use step (LOCF) fill. */
const DEFAULT_MAX_INTERIOR_INTERP_GAP = 8;

const METRICS_LOCF_ONLY_INTERIOR = new Set<string>(["gdp_growth"]);

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function unitSuggestsPctClamp(def: MetricDef): boolean {
  const u = def.unit;
  // "% of GDP" can exceed 100 (e.g. Japan, Singapore) — do not clamp to [0, 100].
  if (u === "% of GDP") return false;
  return u === "%" || u.includes("% of relevant") || u.includes("% of total");
}

/**
 * After merges, ensure every year in the dense range has a value when any anchor exists:
 * leading nulls ← first observation (optional); trailing nulls ← last; short interior gaps linearly interpolated.
 */
export function completeDenseSeries(
  points: SeriesPoint[],
  opts: { maxInteriorInterpGap: number; fillLeading?: boolean }
): SeriesPoint[] {
  const n = points.length;
  if (n === 0) return points;
  const out: SeriesPoint[] = points.map((p) => ({ ...p }));
  const fillLeading = opts.fillLeading !== false;

  let first = -1;
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (!isMissingMetricValue(out[i]!.value)) {
      first = i;
      break;
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    if (!isMissingMetricValue(out[i]!.value)) {
      last = i;
      break;
    }
  }
  if (first === -1) return out;

  const firstVal = out[first]!.value as number;
  if (fillLeading) {
    for (let i = 0; i < first; i++) {
      out[i] = { year: out[i]!.year, value: firstVal, provenance: "filled_range" };
    }
  }
  const lastVal = out[last]!.value as number;
  for (let i = last + 1; i < n; i++) {
    out[i] = { year: out[i]!.year, value: lastVal, provenance: "filled_range" };
  }

  let i = first;
  while (i < last) {
    let j = i + 1;
    while (j <= last && isMissingMetricValue(out[j]!.value)) j++;
    if (j > last) break;
    const gap = j - i - 1;
    const vi = out[i]!.value as number;
    const vj = out[j]!.value as number;
    if (gap > 0) {
      const useInterp = gap <= opts.maxInteriorInterpGap;
      const gapProv: SeriesProvenance = useInterp ? "interpolated" : "filled_range";
      for (let k = 1; k <= gap; k++) {
        const y = out[i + k]!.year;
        if (useInterp) {
          const t = k / (gap + 1);
          out[i + k] = { year: y, value: vi + t * (vj - vi), provenance: gapProv };
        } else {
          out[i + k] = { year: y, value: vi, provenance: gapProv };
        }
      }
    }
    i = j;
  }
  return out;
}

export function mergeWldFallbackDense(country: SeriesPoint[], wld: SeriesPoint[]): SeriesPoint[] {
  if (country.length === 0) return country;
  const wByYear = new Map(wld.map((p) => [p.year, p.value]));
  return country.map((p) => {
    if (!isMissingMetricValue(p.value)) return p;
    const v = wByYear.get(p.year);
    if (!isMissingMetricValue(v)) return { year: p.year, value: v as number, provenance: "wld_proxy" };
    return p;
  });
}

export function clampSeriesByMetricDef(metricId: string, points: SeriesPoint[]): SeriesPoint[] {
  const def = METRIC_BY_ID[metricId];
  if (!def || !unitSuggestsPctClamp(def)) return points;
  return points.map((p) => ({
    ...p,
    value: isUsableNumber(p.value) ? clamp(p.value, 0, 100) : p.value,
  }));
}

export function completionOptionsForMetric(metricId: string): { maxInteriorInterpGap: number } {
  if (METRICS_LOCF_ONLY_INTERIOR.has(metricId)) {
    return { maxInteriorInterpGap: 0 };
  }
  return { maxInteriorInterpGap: DEFAULT_MAX_INTERIOR_INTERP_GAP };
}
