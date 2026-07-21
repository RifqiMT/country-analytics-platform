import { METRIC_BY_ID } from "./metrics.js";
import type { SeriesPoint } from "./series.js";
import { buildWldSeriesBundle } from "./globalData/wldSeriesService.js";
import { MIN_DATA_YEAR, currentDataYear } from "./yearBounds.js";
import { isServerlessRuntime } from "./serverlessBudget.js";

/**
 * True when the user asks for world / global totals (not a country ranking table).
 * Rankings stay on `buildAssistantRankingPayload`; this path feeds Global Analytics–style WLD series.
 */
export function looksLikeWorldAggregateQuery(message: string): boolean {
  const ql = message.toLowerCase();
  const worldScope =
    /\b(world|worldwide|globally|global|planet|earth)\b/i.test(ql) ||
    /\b(world\s+total|global\s+total|world\s+aggregate|global\s+aggregate)\b/i.test(ql) ||
    /\b(wld|world\s+bank\s+world)\b/i.test(ql) ||
    /\bin\s+the\s+world\s+(as\s+a\s+whole|overall|combined)\b/i.test(ql);
  if (!worldScope) return false;
  // Rankings (“top 10 countries in the world”) are handled separately.
  if (
    /\btop\s+(\d+|ten|five|twenty)\b/i.test(ql) ||
    /\bbottom\s+(\d+|ten|five)\b/i.test(ql) ||
    /\b(highest|lowest|largest|smallest)\s+\d*\s*countries\b/i.test(ql) ||
    /\brank(ing)?\s+(of\s+)?(countries|nations)\b/i.test(ql)
  ) {
    return false;
  }
  const metricHint =
    /\b(gdp|gni|debt|population|inflation|unemployment|poverty|life\s+expectancy|enrollment|homicide|trade|growth|per\s+capita)\b/i.test(
      ql
    );
  return metricHint || /\b(how\s+large|how\s+much|what\s+is\s+the)\b/i.test(ql);
}

function latestFinite(
  points: SeriesPoint[] | undefined
): { year: number; value: number; provenance?: string } | null {
  if (!points?.length) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]!;
    if (p.value !== null && p.value !== undefined && Number.isFinite(p.value)) {
      return { year: p.year, value: p.value, provenance: p.provenance };
    }
  }
  return null;
}

/**
 * World-aggregate digest using the same builder as Global Analytics → Charts
 * (`dense_only` official WLD + country-panel matrix fill + conservative polish).
 */
export async function buildAssistantWldAggregateBlock(
  metricIds: string[],
  formatMetricValue: (metricId: string, value: number) => string,
  opts?: {
    settleWithin?: <T>(promise: Promise<T>, ms: number, fallback: T) => Promise<T>;
  }
): Promise<string> {
  const ids = [...new Set(metricIds.filter((id) => Boolean(METRIC_BY_ID[id])))].slice(0, 12);
  if (ids.length === 0) return "";

  const start = Math.max(MIN_DATA_YEAR, currentDataYear() - 15);
  const end = currentDataYear();
  const settle =
    opts?.settleWithin ??
    (async <T>(promise: Promise<T>, _ms: number, fallback: T): Promise<T> => {
      try {
        return await promise;
      } catch {
        return fallback;
      }
    });

  const empty = {
    start,
    end,
    series: Object.fromEntries(ids.map((id) => [id, [] as SeriesPoint[]])),
    warning: "global-wld-series-fallback-null" as const,
  };

  const result = await settle(
    buildWldSeriesBundle(ids, start, end, {
      settleWithin: opts?.settleWithin,
      perMetricTimeoutMs: isServerlessRuntime() ? 10_000 : 14_000,
      aggregateDeadlineMs: Date.now() + (isServerlessRuntime() ? 22_000 : 45_000),
    }),
    isServerlessRuntime() ? 28_000 : 55_000,
    empty
  );

  const lines: string[] = [
    "World aggregates (WLD) — same pipeline as Global Analytics → Charts:",
    "official world series where published, otherwise sovereign-country panel sums / weighted means",
    "(debt US$ = Σ(GDP×debt%); debt% = Σdebt÷ΣGDP; per-capita = GDP÷population when levels exist).",
    "",
  ];
  let any = false;
  for (const id of ids) {
    const lv = latestFinite(result.series[id]);
    if (!lv) continue;
    any = true;
    const label = METRIC_BY_ID[id]?.label ?? id;
    const prov =
      lv.provenance && lv.provenance !== "reported" ? `; method: ${lv.provenance}` : "";
    lines.push(`• ${label}: ${formatMetricValue(id, lv.value)} (data year ${lv.year}${prov})`);
  }
  if (!any) return "";
  return lines.join("\n");
}
