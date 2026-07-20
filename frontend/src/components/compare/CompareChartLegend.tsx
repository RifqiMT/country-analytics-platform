import CompareCountryLegend from "./CompareCountryLegend";

type Props = {
  nameA: string;
  nameB: string;
  className?: string;
};

export default function CompareChartLegend({ nameA, nameB, className = "" }: Props) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 ${className}`}
      role="note"
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Chart key</p>
      <CompareCountryLegend nameA={nameA} nameB={nameB} />
    </div>
  );
}
