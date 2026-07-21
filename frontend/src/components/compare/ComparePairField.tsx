import type { ReactNode } from "react";
import { COMPARE_COLOR_A, COMPARE_COLOR_B } from "../../lib/compareChartMerge";

type CompareCountrySide = "a" | "b";

const SIDE_STYLE: Record<
  CompareCountrySide,
  { border: string; bg: string; line: string; label: string }
> = {
  a: {
    border: "border-solid",
    bg: "bg-blue-50/40",
    line: "border-t-2",
    label: "text-blue-800",
  },
  b: {
    border: "border-dashed",
    bg: "bg-orange-50/40",
    line: "border-t-2 border-dashed",
    label: "text-orange-900",
  },
};

type CellProps = {
  side: CompareCountrySide;
  name: string;
  children: ReactNode;
  highlight?: boolean;
  showName?: boolean;
  className?: string;
};

/** Single country column with consistent A/B color and line styling. */
function CompareCountryCell({
  side,
  name,
  children,
  highlight = false,
  showName = true,
  className = "",
}: CellProps) {
  const colors = side === "a" ? COMPARE_COLOR_A : COMPARE_COLOR_B;
  const style = SIDE_STYLE[side];
  return (
    <div
      className={`min-w-0 rounded-md border-l-2 pl-2.5 ${style.border} ${highlight ? style.bg : ""} ${className}`}
      style={{ borderColor: colors }}
    >
      {showName ? (
        <p className={`flex items-center gap-1 truncate text-[10px] font-semibold ${style.label}`}>
          <span className={`h-0 w-2.5 shrink-0 ${style.line}`} style={{ borderColor: colors }} aria-hidden />
          {name}
        </p>
      ) : null}
      <div className={showName ? "mt-1 min-w-0 break-words" : "min-w-0 break-words"}>{children}</div>
    </div>
  );
}

type PairProps = {
  label: string;
  nameA: string;
  nameB: string;
  valueA: ReactNode;
  valueB: ReactNode;
  highlightA?: boolean;
  highlightB?: boolean;
  footer?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

/** One metric shown as an explicit A | B pair in a single card. */
export default function ComparePairField({
  label,
  nameA,
  nameB,
  valueA,
  valueB,
  highlightA = false,
  highlightB = false,
  footer,
  trailing,
  className = "",
}: PairProps) {
  return (
    <article
      className={`rounded-lg border border-slate-200 bg-white p-3.5 transition hover:border-slate-300 sm:p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {trailing}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-3">
        <CompareCountryCell side="a" name={nameA} highlight={highlightA}>
          {valueA}
        </CompareCountryCell>
        <CompareCountryCell side="b" name={nameB} highlight={highlightB}>
          {valueB}
        </CompareCountryCell>
      </div>
      {footer ? <div className="mt-2.5">{footer}</div> : null}
    </article>
  );
}

type HeaderProps = {
  nameA: string;
  nameB: string;
  className?: string;
};

/** Compact two-country header strip for comparison sections. */
export function ComparePairHeader({ nameA, nameB, className = "" }: HeaderProps) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs ${className}`}
      aria-label="Compared countries"
    >
      <p className="flex items-center gap-1.5 font-semibold" style={{ color: COMPARE_COLOR_A }}>
        <span className="h-0 w-4 border-t-2" style={{ borderColor: COMPARE_COLOR_A }} aria-hidden />
        {nameA}
        <span className="font-normal text-slate-400">(A · solid)</span>
      </p>
      <p className="flex items-center gap-1.5 font-semibold" style={{ color: COMPARE_COLOR_B }}>
        <span
          className="h-0 w-4 border-t-2 border-dashed"
          style={{ borderColor: COMPARE_COLOR_B }}
          aria-hidden
        />
        {nameB}
        <span className="font-normal text-slate-400">(B · dashed)</span>
      </p>
    </div>
  );
}
