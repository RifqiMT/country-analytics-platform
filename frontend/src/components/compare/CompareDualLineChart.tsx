import ToggleLineChart from "../dashboard/ToggleLineChart";
import {
  buildComparePairChart,
  isComparePercentMetric,
} from "../../lib/compareChartMerge";
import type { SeriesPoint } from "../../api";
import { formatCompactNumber } from "../../lib/formatValue";

type Props = {
  metricId: string;
  metricLabel: string;
  bundleA: Record<string, SeriesPoint[]>;
  bundleB: Record<string, SeriesPoint[]>;
  start: number;
  end: number;
  nameA: string;
  nameB: string;
  /** When false, omit per-chart footnote (use category-level legend instead). */
  showFootnote?: boolean;
};

export default function CompareDualLineChart({
  metricId,
  metricLabel,
  bundleA,
  bundleB,
  start,
  end,
  nameA,
  nameB,
  showFootnote = false,
}: Props) {
  const hasData =
    (bundleA[metricId] ?? []).some((p) => p.value != null) ||
    (bundleB[metricId] ?? []).some((p) => p.value != null);

  if (!hasData) return null;

  const { data, series } = buildComparePairChart(bundleA, bundleB, metricId, start, end, nameA, nameB);
  const isPct = isComparePercentMetric(metricId);
  const tickFmt = isPct
    ? (v: number) => `${v.toFixed(0)}%`
    : (v: number) => formatCompactNumber(v, { maxFrac: 1 });

  return (
    <ToggleLineChart
      title={metricLabel}
      data={data}
      series={series}
      dualAxis={false}
      leftTickFormatter={tickFmt}
      footnote={showFootnote ? `Solid line = ${nameA} · Dashed line = ${nameB}` : undefined}
    />
  );
}
