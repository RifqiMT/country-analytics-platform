import type { ChartRow } from "../../../lib/chartSeries";
import type { WldChartDef, WldLineSpec } from "./catalog";

/** When the largest series max is this many × the smallest, prefer a second Y axis. */
const WLD_DUAL_AXIS_RATIO = 8;

export type AxisAssignment = {
  dual: boolean;
  lines: readonly WldLineSpec[];
};

function seriesMaxAbs(rows: ChartRow[], key: string): number {
  let m = 0;
  for (const row of rows) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) m = Math.max(m, Math.abs(v));
  }
  return m;
}

/**
 * Assign left/right Y axes when series magnitudes differ sharply.
 * Catalog `dualAxis` + explicit `yAxisId` always win; otherwise auto-split by geometric mean of maxima.
 */
export function resolveWldChartAxes(def: WldChartDef, annualData: ChartRow[]): AxisAssignment {
  const catalogDual =
    Boolean(def.dualAxis) || def.lines.some((l) => l.yAxisId === "right");
  if (catalogDual) {
    return {
      dual: true,
      lines: def.lines.map((l) => ({
        ...l,
        yAxisId: l.yAxisId ?? "left",
      })),
    };
  }

  const maxima = def.lines
    .map((l) => ({ key: l.key, max: seriesMaxAbs(annualData, l.key) }))
    .filter((x) => x.max > 0);
  if (maxima.length < 2) {
    return { dual: false, lines: def.lines };
  }

  const maxVals = maxima.map((x) => x.max);
  const globalMax = Math.max(...maxVals);
  const globalMin = Math.min(...maxVals);
  if (globalMin <= 0 || globalMax / globalMin < WLD_DUAL_AXIS_RATIO) {
    return { dual: false, lines: def.lines };
  }

  const geo = Math.exp(maxVals.reduce((s, v) => s + Math.log(v), 0) / maxVals.length);
  const byKey = new Map(maxima.map((x) => [x.key, x.max] as const));
  const lines: WldLineSpec[] = def.lines.map((l) => {
    const m = byKey.get(l.key);
    if (m == null) return { ...l, yAxisId: "left" as const };
    return { ...l, yAxisId: m >= geo ? ("left" as const) : ("right" as const) };
  });

  const hasLeft = lines.some((l) => (l.yAxisId ?? "left") === "left");
  const hasRight = lines.some((l) => l.yAxisId === "right");
  if (!hasLeft || !hasRight) {
    return { dual: false, lines: def.lines };
  }
  return { dual: true, lines };
}
