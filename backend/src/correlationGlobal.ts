import { fetchGlobalYearSnapshotsForRange } from "./globalSnapshot.js";
import { listCountries } from "./restCountries.js";
import { METRIC_BY_ID } from "./metrics.js";
import { getCache, setCache } from "./cache.js";

export class CorrelationBudgetError extends Error {
  constructor(message = "CORRELATION_BUDGET_EXCEEDED") {
    super(message);
    this.name = "CorrelationBudgetError";
  }
}

interface CorrelationPoint {
  countryIso3: string;
  countryName: string;
  region: string;
  year: number;
  x: number;
  y: number;
  fitted: number;
  residual: number;
  isIqrOutlier: boolean;
}

interface SubgroupResult {
  region: string;
  r: number;
  n: number;
  pValue: string;
}

export interface CorrelationGlobalResult {
  points: CorrelationPoint[];
  n: number;
  nMissing: number;
  nIqrFlagged: number;
  excludeIqr: boolean;
  correlation: number | null;
  pValue: string | null;
  rSquared: number | null;
  slope: number | null;
  intercept: number | null;
  subgroups: SubgroupResult[];
  ciBand: { x: number; yLower: number; yUpper: number }[];
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

function isOutlier(v: number, q1: number, q3: number): boolean {
  const iqr = q3 - q1;
  if (iqr <= 0) return false;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return v < lower || v > upper;
}

function pearsonPValue(r: number, n: number): string {
  if (n < 3 || Math.abs(r) >= 1) return "—";
  const t = (r * Math.sqrt(n - 2)) / Math.sqrt(Math.max(1e-20, 1 - r * r));
  const p = 2 * (1 - normalCdf(Math.abs(t)));
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}

function normalCdf(x: number): number {
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return x >= 0 ? y : 1 - y;
}

function pearsonAndRegression(
  points: { x: number; y: number }[]
): { r: number | null; pValue: string; rSquared: number | null; slope: number | null; intercept: number | null } {
  const n = points.length;
  if (n < 3) return { r: null, pValue: "—", rSquared: null, slope: null, intercept: null };
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const p of points) {
    const zx = p.x - mx;
    const zy = p.y - my;
    num += zx * zy;
    dx += zx * zx;
    dy += zy * zy;
  }
  const denom = Math.sqrt(dx * dy);
  const r = denom === 0 ? null : num / denom;
  const pValue = r === null ? "—" : pearsonPValue(r, n);
  const slope = dx === 0 ? null : (r ?? 0) * Math.sqrt(dy / dx);
  const intercept = slope === null ? null : my - slope * mx;
  const rSquared = r === null ? null : r * r;
  return { r, pValue, rSquared, slope, intercept };
}

export async function computeCorrelationGlobal(
  metricX: string,
  metricY: string,
  startYear: number,
  endYear: number,
  excludeIqrOutliers: boolean,
  _highlightCountry: string,
  opts?: { deadlineAt?: number | null }
): Promise<CorrelationGlobalResult> {
  // Highlight is UI-only; omit from cache key so results are shared across focus countries.
  const cacheKey = `corr:global:v4:${metricX}:${metricY}:${startYear}:${endYear}:${excludeIqrOutliers ? 1 : 0}`;
  const hit = getCache<CorrelationGlobalResult>(cacheKey);
  if (hit && hit.n > 0) return hit;

  if (!METRIC_BY_ID[metricX] || !METRIC_BY_ID[metricY]) {
    throw new Error("Unknown metric");
  }

  const deadlineAt = opts?.deadlineAt ?? null;
  if (deadlineAt !== null && Date.now() >= deadlineAt) {
    throw new CorrelationBudgetError();
  }

  const countries = await listCountries();
  const members = new Set(countries.map((c) => c.cca3.toUpperCase()));
  const regionByIso = new Map(countries.map((c) => [c.cca3, c.region || "Unknown"]));
  const nameByIso = new Map(countries.map((c) => [c.cca3, c.name]));

  // Two range fetches (X and Y) replace dozens of per-year snapshot round-trips.
  const [byYearX, byYearY] = await Promise.all([
    fetchGlobalYearSnapshotsForRange(metricX, startYear, endYear),
    fetchGlobalYearSnapshotsForRange(metricY, startYear, endYear),
  ]);

  if (deadlineAt !== null && Date.now() >= deadlineAt) {
    throw new CorrelationBudgetError();
  }

  const rawPoints: {
    countryIso3: string;
    countryName: string;
    region: string;
    year: number;
    x: number;
    y: number;
  }[] = [];
  let nMissing = 0;

  for (let year = startYear; year <= endYear; year++) {
    const rowsX = byYearX.get(year) ?? [];
    const rowsY = byYearY.get(year) ?? [];
    const byCountryX = new Map(rowsX.map((r) => [r.countryIso3, r.value]));
    const byCountryY = new Map(rowsY.map((r) => [r.countryIso3, r.value]));
    const allIso = new Set([...byCountryX.keys(), ...byCountryY.keys()]);
    for (const iso of allIso) {
      const up = String(iso).toUpperCase();
      // Exclude WDI aggregates/regions (e.g. WLD, AFE, AFW) for country-only analytics.
      if (!members.has(up)) continue;
      const vx = byCountryX.get(iso);
      const vy = byCountryY.get(iso);
      if (
        vx === null ||
        vx === undefined ||
        Number.isNaN(vx) ||
        vy === null ||
        vy === undefined ||
        Number.isNaN(vy)
      ) {
        nMissing++;
        continue;
      }
      rawPoints.push({
        countryIso3: up,
        countryName: nameByIso.get(up) ?? up,
        region: regionByIso.get(up) ?? "Unknown",
        year,
        x: Number(vx),
        y: Number(vy),
      });
    }
  }

  const xs = rawPoints.map((p) => p.x).sort((a, b) => a - b);
  const ys = rawPoints.map((p) => p.y).sort((a, b) => a - b);
  const q1x = quantile(xs, 0.25);
  const q3x = quantile(xs, 0.75);
  const q1y = quantile(ys, 0.25);
  const q3y = quantile(ys, 0.75);

  let filtered = rawPoints;
  const iqrFlagged = rawPoints.filter((p) => isOutlier(p.x, q1x, q3x) || isOutlier(p.y, q1y, q3y));
  const nIqrFlagged = iqrFlagged.length;
  if (excludeIqrOutliers && nIqrFlagged > 0) {
    const iqrSet = new Set(iqrFlagged.map((p) => `${p.countryIso3}-${p.year}`));
    filtered = rawPoints.filter((p) => !iqrSet.has(`${p.countryIso3}-${p.year}`));
  }

  const { r, pValue, rSquared, slope, intercept } = pearsonAndRegression(
    filtered.map((p) => ({ x: p.x, y: p.y }))
  );

  const iqrSet = new Set(iqrFlagged.map((p) => `${p.countryIso3}-${p.year}`));
  const points: CorrelationPoint[] = filtered.map((p) => {
    const fitted = slope !== null && intercept !== null ? intercept + slope * p.x : p.y;
    const residual = p.y - fitted;
    return {
      ...p,
      fitted,
      residual,
      isIqrOutlier: iqrSet.has(`${p.countryIso3}-${p.year}`),
    };
  });

  const subgroups: SubgroupResult[] = [];
  const byRegion = new Map<string, { x: number; y: number }[]>();
  for (const p of filtered) {
    const key = p.region || "Unknown";
    if (!byRegion.has(key)) byRegion.set(key, []);
    byRegion.get(key)!.push({ x: p.x, y: p.y });
  }
  for (const [region, pts] of byRegion) {
    if (pts.length < 3) continue;
    const { r: rr, pValue: pp } = pearsonAndRegression(pts);
    subgroups.push({ region, r: rr ?? 0, n: pts.length, pValue: pp });
  }
  subgroups.sort((a, b) => b.n - a.n);

  let ciBand: { x: number; yLower: number; yUpper: number }[] = [];
  if (slope !== null && intercept !== null && points.length >= 3) {
    const xMin = Math.min(...points.map((p) => p.x));
    const xMax = Math.max(...points.map((p) => p.x));
    const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const ssx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    const sse = points.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
    const mse = sse / (points.length - 2);
    const tCrit = 1.96;
    for (let i = 0; i <= 20; i++) {
      const x = xMin + (i / 20) * (xMax - xMin);
      const yHat = intercept + slope * x;
      const se = Math.sqrt(mse * (1 / points.length + (x - mx) ** 2 / (ssx || 1)));
      ciBand.push({
        x,
        yLower: yHat - tCrit * se,
        yUpper: yHat + tCrit * se,
      });
    }
  }

  const out = {
    points,
    n: points.length,
    nMissing,
    nIqrFlagged,
    excludeIqr: excludeIqrOutliers,
    correlation: r,
    pValue: pValue === "—" ? null : pValue,
    rSquared,
    slope,
    intercept,
    subgroups,
    ciBand,
  };
  // Never cache empty failures — they poison the UI until TTL expires.
  if (out.n > 0) {
    setCache(cacheKey, out, 1000 * 60 * 30);
  }
  return out;
}
