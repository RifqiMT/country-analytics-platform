import {
  countryAIsAhead,
  describeCompareDelta,
  formatCompareMetricValue,
  preferBpsForMetric,
} from "../../lib/compareMetricFormat";
import { formatYoY, yoYClass } from "../../lib/formatValue";
import { latestAtOrBefore, yoyAtSnapshot, yoyBpsAtSnapshot } from "../../lib/countrySeriesFetch";
import type { SeriesPoint } from "../../api";
import ComparePairField from "./ComparePairField";

type Props = {
  label: string;
  metricId: string;
  unit: string;
  seriesA: SeriesPoint[];
  seriesB: SeriesPoint[];
  snapshotYear: number;
  nameA: string;
  nameB: string;
};

export default function CompareMetricRow({
  label,
  metricId,
  unit,
  seriesA,
  seriesB,
  snapshotYear,
  nameA,
  nameB,
}: Props) {
  const ptA = latestAtOrBefore(seriesA, snapshotYear);
  const ptB = latestAtOrBefore(seriesB, snapshotYear);
  const preferBps = preferBpsForMetric(metricId);

  const valA = ptA ? formatCompareMetricValue(metricId, ptA.value, unit) : "—";
  const valB = ptB ? formatCompareMetricValue(metricId, ptB.value, unit) : "—";

  const yoyA = formatYoY(yoyAtSnapshot(seriesA, snapshotYear), yoyBpsAtSnapshot(seriesA, snapshotYear), preferBps);
  const yoyB = formatYoY(yoyAtSnapshot(seriesB, snapshotYear), yoyBpsAtSnapshot(seriesB, snapshotYear), preferBps);

  let delta: number | null = null;
  let deltaPct: number | null = null;
  let aLeads = false;
  let bLeads = false;
  let comparison: ReturnType<typeof describeCompareDelta> | null = null;

  if (ptA && ptB) {
    delta = ptA.value - ptB.value;
    if (ptB.value !== 0) deltaPct = (delta / Math.abs(ptB.value)) * 100;
    const ahead = countryAIsAhead(metricId, delta);
    aLeads = ahead === true;
    bLeads = ahead === false;
    comparison = describeCompareDelta({ metricId, delta, deltaPct, nameA, nameB });
  }

  const valueNode = (value: string, yoy: ReturnType<typeof formatYoY>) => (
    <>
      <p className="text-base font-bold tabular-nums leading-tight text-slate-900">{value}</p>
      {yoy.text !== "—" ? (
        <p className={`mt-0.5 text-[11px] font-medium tabular-nums ${yoYClass(yoy.tone)}`}>{yoy.text}</p>
      ) : null}
    </>
  );

  const footer = comparison ? (
    <div className="rounded-md bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-600">
      <p className="text-slate-700">{comparison.primary}</p>
      {comparison.secondary ? <p className="mt-0.5 text-slate-500">{comparison.secondary}</p> : null}
    </div>
  ) : undefined;

  const badge = aLeads ? (
    <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
      {nameA} ahead
    </span>
  ) : bLeads ? (
    <span className="shrink-0 rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800">
      {nameB} ahead
    </span>
  ) : null;

  return (
    <ComparePairField
      label={label}
      nameA={nameA}
      nameB={nameB}
      valueA={valueNode(valA, yoyA)}
      valueB={valueNode(valB, yoyB)}
      highlightA={aLeads}
      highlightB={bLeads}
      trailing={badge}
      footer={footer}
    />
  );
}
