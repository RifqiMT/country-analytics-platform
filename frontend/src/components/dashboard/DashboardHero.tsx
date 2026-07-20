import type { CountrySummary } from "../../api";
import { yoYClass, type YoYDisplay } from "../../lib/formatValue";

export type HeroKpi = {
  id: string;
  label: string;
  value: string;
  sub?: string;
  subTone?: YoYDisplay["tone"];
};

type Props = {
  meta: CountrySummary;
  yearStart: number;
  yearEnd: number;
  kpis: HeroKpi[];
  incomeLevel?: string | null;
};

export default function DashboardHero({ meta, yearStart, yearEnd, kpis, incomeLevel }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          {meta.flags?.png ? (
            <img
              src={meta.flags.png}
              alt=""
              className="h-12 w-auto shrink-0 rounded-md border border-slate-200 bg-white object-cover sm:h-14"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500 sm:h-14 sm:w-14">
              {meta.cca3}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                {meta.cca3}
              </span>
              <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-700">
                {yearStart}–{yearEnd}
              </span>
              {meta.region ? (
                <span className="inline-flex rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                  {meta.region}
                </span>
              ) : null}
              {incomeLevel ? (
                <span className="inline-flex rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                  {incomeLevel}
                </span>
              ) : null}
            </div>
            <h1 className="font-display mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
              {meta.name}
            </h1>
            {meta.subregion ? <p className="mt-1 text-sm text-slate-500">{meta.subregion}</p> : null}
          </div>
        </div>
      </div>

      {kpis.length > 0 ? (
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-t border-slate-100 lg:grid-cols-4 lg:divide-y-0">
          {kpis.map((k) => (
            <div key={k.id} className="px-3 py-3 sm:px-4 sm:py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k.label}</p>
              <p className="mt-1 break-words text-base font-bold tabular-nums leading-tight text-slate-900 sm:text-lg">
                {k.value}
              </p>
              {k.sub ? (
                <p className={`mt-1 text-[11px] font-medium tabular-nums ${yoYClass(k.subTone ?? "flat")}`}>{k.sub}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
