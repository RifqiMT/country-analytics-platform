import type { ChartGranularity } from "./chartGranularity";
import type { ChartRow } from "./chartSeries";
import { formatYoY, type YoYDisplay } from "./formatValue";

const BPS_PREFERRED_KEYS = new Set([
  "inflation",
  "unemployment_ilo",
  "lending_rate",
  "poverty_headcount",
  "poverty_national",
  "gov_debt_pct_gdp",
  "health_expenditure_gdp",
  "smoking_prevalence",
  "gbv_women_pct",
  "undernourishment",
  "immunization_dpt",
  "immunization_measles",
]);

export function growthLabelForGranularity(granularity: ChartGranularity): string {
  switch (granularity) {
    case "quarterly":
      return "QoQ";
    case "monthly":
      return "MoM";
    case "weekly":
      return "WoW";
    default:
      return "YoY";
  }
}

function numericCell(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

/**
 * Period-over-period change vs the prior chart row (prior year/quarter/month/week).
 */
export function computeChartPointGrowth(
  chartData: ChartRow[],
  currentRow: ChartRow | undefined,
  metricKey: string,
  granularity: ChartGranularity,
  opts?: { preferBps?: boolean }
): (YoYDisplay & { label: string }) | null {
  if (!currentRow || chartData.length < 2) return null;
  const pk = currentRow.periodKey;
  if (pk == null || !Number.isFinite(Number(pk))) return null;

  const idx = chartData.findIndex((r) => r.periodKey === pk);
  if (idx <= 0) return null;

  const prevRow = chartData[idx - 1]!;
  const cur = numericCell(currentRow[metricKey]);
  const prev = numericCell(prevRow[metricKey]);
  if (cur === null || prev === null || prev === 0) return null;

  const preferBps = opts?.preferBps ?? BPS_PREFERRED_KEYS.has(metricKey);
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const bps = preferBps ? (cur - prev) * 100 : null;
  const change = formatYoY(pct, bps, preferBps);
  if (change.text === "—") return null;

  const suffix = growthLabelForGranularity(granularity);
  const text = change.text.replace(/\sYoY$/, ` ${suffix}`);
  return { ...change, text, label: suffix };
}
