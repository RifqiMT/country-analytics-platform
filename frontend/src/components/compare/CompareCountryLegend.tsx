import { COMPARE_COLOR_A, COMPARE_COLOR_B } from "../../lib/compareChartMerge";

type Props = {
  nameA: string;
  nameB: string;
  className?: string;
};

/** Persistent A/B legend — use above tables and category sections. */
export default function CompareCountryLegend({ nameA, nameB, className = "" }: Props) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 ${className}`}
      aria-label="Country comparison legend"
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span className="h-0 w-4 border-t-2" style={{ borderColor: COMPARE_COLOR_A }} aria-hidden />
        <span className="font-semibold text-slate-800">{nameA}</span>
        <span className="text-slate-400">(A · solid)</span>
      </span>
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span
          className="h-0 w-4 border-t-2 border-dashed"
          style={{ borderColor: COMPARE_COLOR_B }}
          aria-hidden
        />
        <span className="font-semibold text-slate-800">{nameB}</span>
        <span className="text-slate-400">(B · dashed)</span>
      </span>
    </div>
  );
}
