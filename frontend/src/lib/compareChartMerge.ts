import type { SeriesPoint } from "../api";
import type { SeriesSpec } from "../components/dashboard/ToggleLineChart";
import { mergeSeriesForLineChart } from "./chartSeries";

/** Country A — solid blue */
export const COMPARE_COLOR_A = "#1d4ed8";
/** Country B — dashed orange (distinct from A, readable on white) */
export const COMPARE_COLOR_B = "#c2410c";

const PERCENT_METRICS = new Set([
  "inflation",
  "gov_debt_pct_gdp",
  "lending_rate",
  "unemployment_ilo",
  "poverty_headcount",
  "poverty_national",
  "undernourishment",
  "health_expenditure_gdp",
  "pop_age_0_14",
  "pop_15_64_pct",
  "pop_age_65_plus",
  "labour_force_participation",
  "gdp_growth",
  "immunization_dpt",
  "immunization_measles",
  "smoking_prevalence",
  "gbv_women_pct",
]);

export function isComparePercentMetric(id: string): boolean {
  return PERCENT_METRICS.has(id);
}

/** One metric, two countries — solid vs dashed for clear visual encoding. */
export function buildComparePairChart(
  bundleA: Record<string, SeriesPoint[]>,
  bundleB: Record<string, SeriesPoint[]>,
  metricKey: string,
  start: number,
  end: number,
  nameA: string,
  nameB: string
): { data: ReturnType<typeof mergeSeriesForLineChart>; series: SeriesSpec[] } {
  const keyA = "country_a";
  const keyB = "country_b";
  const merged: Record<string, SeriesPoint[]> = {
    [keyA]: bundleA[metricKey] ?? [],
    [keyB]: bundleB[metricKey] ?? [],
  };
  const isPct = isComparePercentMetric(metricKey);
  return {
    data: mergeSeriesForLineChart(merged, [keyA, keyB], start, end),
    series: [
      {
        key: keyA,
        label: nameA,
        color: COMPARE_COLOR_A,
        yAxisId: "left",
        strokeWidth: 2.5,
        tooltipFormat: isPct ? "percent" : "compact",
        changePreferBps: isPct,
      },
      {
        key: keyB,
        label: nameB,
        color: COMPARE_COLOR_B,
        yAxisId: "left",
        strokeWidth: 2.5,
        strokeDasharray: "7 5",
        tooltipFormat: isPct ? "percent" : "compact",
        changePreferBps: isPct,
      },
    ],
  };
}
