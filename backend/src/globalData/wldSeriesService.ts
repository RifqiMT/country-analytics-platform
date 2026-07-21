import type { SeriesPoint } from "../series.js";
import { fetchCountryBundle } from "../worldBank.js";
import { METRIC_BY_ID } from "../metrics.js";
import { isServerlessRuntime } from "../serverlessBudget.js";
import { fillWldBundleFromMatrices, polishWldChartSeries, wldSeriesFilledCount } from "./wldSeriesFromMatrix.js";

function makeNullSeries(start: number, end: number): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let y = start; y <= end; y++) out.push({ year: y, value: null });
  return out;
}

function isFiniteNum(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && Number.isFinite(v);
}

/**
 * Keep per-capita identities consistent with level series in the same bundle:
 * GDP/capita = GDP ÷ population (and PPP analogue) whenever both levels exist.
 */
function reconcileWldBundleIdentities(series: Record<string, SeriesPoint[]>): void {
  const setRatio = (outId: string, numId: string, denId: string) => {
    const out = series[outId];
    const num = series[numId];
    const den = series[denId];
    if (!out || !num || !den) return;
    const numByY = new Map(num.map((p) => [p.year, p.value] as const));
    const denByY = new Map(den.map((p) => [p.year, p.value] as const));
    series[outId] = out.map((p) => {
      const n = numByY.get(p.year);
      const d = denByY.get(p.year);
      if (isFiniteNum(n) && isFiniteNum(d) && d !== 0) {
        return { year: p.year, value: n / d, provenance: "derived_cross_metric" as const };
      }
      return p;
    });
  };
  setRatio("gdp_per_capita", "gdp", "population");
  setRatio("gdp_per_capita_ppp", "gdp_ppp", "population");
}

/** Prefer country-panel aggregates when official WLD is empty or not a coherent world total. */
const SKIP_OFFICIAL_WLD = new Set([
  "gov_debt_pct_gdp",
  "gov_debt_usd",
  "uhc_service_coverage",
  "poverty_headcount",
  "poverty_national",
  "lending_rate",
  // Education OOSC/completion — WLD often empty; use UIS/WDI country matrix
  "oosc_primary",
  "oosc_secondary",
  "oosc_tertiary",
  "school_primary_completion",
  "completion_secondary",
  "completion_tertiary",
  // Crime / governance — no meaningful official WLD series
  "homicide_rate",
  "homicide_rate_female",
  "homicide_rate_male",
  "gbv_women_pct",
  "idp_conflict_violence",
  "battle_related_deaths",
  "rule_of_law_wgi",
  "political_stability_wgi",
  "corruption_control_wgi",
]);

export type WldSeriesBundleResult = {
  start: number;
  end: number;
  series: Record<string, SeriesPoint[]>;
  warning: "global-wld-series-fallback-null" | "global-wld-series-partial" | null;
};

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

/**
 * Modular World (WLD) series builder used by Global Analytics charts.
 * Official WLD first (when useful), then country×year aggregates for gaps.
 */
export async function buildWldSeriesBundle(
  metricIds: string[],
  start: number,
  end: number,
  opts?: {
    perMetricTimeoutMs?: number;
    aggregateDeadlineMs?: number;
    settleWithin?: <T>(promise: Promise<T>, ms: number, fallback: T) => Promise<T>;
  }
): Promise<WldSeriesBundleResult> {
  const ids = [...new Set(metricIds.filter((id) => Boolean(METRIC_BY_ID[id])))];
  const series: Record<string, SeriesPoint[]> = Object.fromEntries(
    ids.map((id) => [id, makeNullSeries(start, end)])
  );
  if (ids.length === 0) {
    return { start, end, series, warning: "global-wld-series-fallback-null" };
  }

  const settle =
    opts?.settleWithin ??
    (async <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          promise,
          new Promise<T>((resolve) => {
            timer = setTimeout(() => resolve(fallback), ms);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    });

  const officialIds = ids.filter((id) => !SKIP_OFFICIAL_WLD.has(id));
  const perMetricMs = opts?.perMetricTimeoutMs ?? (isServerlessRuntime() ? 12_000 : 16_000);
  const concurrency = isServerlessRuntime() ? 2 : 4;

  await mapPool(officialIds, concurrency, async (id) => {
    const fallback = { [id]: makeNullSeries(start, end) } as Record<string, SeriesPoint[]>;
    const part = await settle(
      fetchCountryBundle("WLD", [id], start, end, {
        skipWldFallback: true,
        // Dense published points only — do not invent years before country aggregation.
        completionMode: "dense_only",
      }),
      perMetricMs,
      fallback
    );
    series[id] = part[id] ?? makeNullSeries(start, end);
  });

  const aggregateDeadlineMs =
    opts?.aggregateDeadlineMs ?? Date.now() + (isServerlessRuntime() ? 28_000 : 75_000);
  await fillWldBundleFromMatrices(series, ids, start, end, { deadlineMs: aggregateDeadlineMs });
  reconcileWldBundleIdentities(series);

  for (const id of ids) {
    series[id] = polishWldChartSeries(id, series[id] ?? makeNullSeries(start, end));
  }
  // Re-apply identities after polish so trailing carry cannot desync ratios.
  reconcileWldBundleIdentities(series);

  const allNull = ids.every((id) => wldSeriesFilledCount(series[id]) === 0);
  const partial = !allNull && ids.some((id) => wldSeriesFilledCount(series[id]) === 0);

  return {
    start,
    end,
    series,
    warning: allNull ? "global-wld-series-fallback-null" : partial ? "global-wld-series-partial" : null,
  };
}
