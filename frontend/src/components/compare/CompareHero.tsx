import type { CountrySummary } from "../../api";
import { yoYClass, type YoYDisplay } from "../../lib/formatValue";
import { COMPARE_COLOR_A, COMPARE_COLOR_B } from "../../lib/compareChartMerge";

export type CompareHeroKpi = {
  id: string;
  label: string;
  valueA: string;
  valueB: string;
  subA?: string;
  subToneA?: YoYDisplay["tone"];
  subB?: string;
  subToneB?: YoYDisplay["tone"];
};

type Props = {
  metaA: CountrySummary;
  metaB: CountrySummary;
  yearStart: number;
  yearEnd: number;
  metricCount: number;
  kpis: CompareHeroKpi[];
  onSwap?: () => void;
};

function FlagBadge({ meta }: { meta: CountrySummary }) {
  if (meta.flags?.png) {
    return (
      <img
        src={meta.flags.png}
        alt=""
        className="h-8 w-auto shrink-0 rounded border border-slate-200 bg-white object-cover sm:h-9"
      />
    );
  }
  return (
    <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1 text-[10px] font-bold text-slate-500 sm:h-9">
      {meta.cca3}
    </span>
  );
}

export default function CompareHero({
  metaA,
  metaB,
  yearStart,
  yearEnd,
  metricCount,
  kpis,
  onSwap,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Compare
              </span>
              <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-700">
                {yearStart}–{yearEnd}
              </span>
              <span className="inline-flex rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                {metricCount} metrics
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <FlagBadge meta={metaA} />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900 sm:text-lg">{metaA.name}</p>
                  {metaA.region ? <p className="truncate text-xs text-slate-500">{metaA.region}</p> : null}
                </div>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">vs</span>
              <div className="flex items-center gap-2">
                <FlagBadge meta={metaB} />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900 sm:text-lg">{metaB.name}</p>
                  {metaB.region ? <p className="truncate text-xs text-slate-500">{metaB.region}</p> : null}
                </div>
              </div>
            </div>
          </div>
          {onSwap ? (
            <button
              type="button"
              onClick={onSwap}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              title="Swap countries"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Swap
            </button>
          ) : null}
        </div>
      </div>

      {kpis.length > 0 ? (
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 lg:grid-cols-4 lg:divide-y-0">
          {kpis.map((k) => (
            <div key={k.id} className="px-3 py-3 sm:px-4 sm:py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k.label}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-[10px] font-medium text-slate-500">
                    <span className="h-0 w-2.5 shrink-0 border-t-2" style={{ borderColor: COMPARE_COLOR_A }} aria-hidden />
                    {metaA.cca3}
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900 sm:text-base">{k.valueA}</p>
                  {k.subA ? (
                    <p className={`text-[11px] font-medium tabular-nums ${yoYClass(k.subToneA ?? "flat")}`}>{k.subA}</p>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-[10px] font-medium text-slate-500">
                    <span
                      className="h-0 w-2.5 shrink-0 border-t-2 border-dashed"
                      style={{ borderColor: COMPARE_COLOR_B }}
                      aria-hidden
                    />
                    {metaB.cca3}
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900 sm:text-base">{k.valueB}</p>
                  {k.subB ? (
                    <p className={`text-[11px] font-medium tabular-nums ${yoYClass(k.subToneB ?? "flat")}`}>{k.subB}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
