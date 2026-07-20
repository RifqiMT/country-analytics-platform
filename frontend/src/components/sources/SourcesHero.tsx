import { PAGE_INTRO } from "../../lib/platformCopy";

type Props = {
  metricCount: number;
  providerCount: number;
  categoryCount: number;
  filteredCount?: number;
  hasActiveFilters?: boolean;
};

export default function SourcesHero({
  metricCount,
  providerCount,
  categoryCount,
  filteredCount,
  hasActiveFilters,
}: Props) {
  const showFiltered = hasActiveFilters && filteredCount != null;

  const copy = PAGE_INTRO.sources;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50/60 shadow-sm ring-1 ring-slate-900/[0.03]">
      <div className="h-0.5 bg-gradient-to-r from-teal-500/70 via-slate-200 to-red-500/50" aria-hidden />
      <div className="border-b border-slate-100 px-3 py-3 sm:px-4 sm:py-3.5 lg:px-5 lg:py-4">
        <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-6 xl:gap-x-8">
          <div className="min-w-0 lg:col-span-4 xl:col-span-3">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {copy.eyebrow ? (
                <span className="inline-flex rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-800">
                  {copy.eyebrow}
                </span>
              ) : null}
              <span className="inline-flex rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Methodology
              </span>
            </div>
            <h1 className="font-display mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-[1.5rem] xl:text-[1.65rem]">
              {copy.title}
            </h1>
          </div>

          <div className="mt-3 min-w-0 space-y-2.5 lg:col-span-8 lg:mt-0 xl:col-span-9">
            <p className="text-sm font-medium leading-relaxed text-slate-800 sm:text-[0.9375rem] lg:text-[0.9375rem] xl:text-base">
              {copy.lead}
            </p>
            {copy.detail ? (
              <p className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
                {copy.detail}
              </p>
            ) : null}
            {copy.highlights && copy.highlights.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Key features">
                {copy.highlights.map((item: string) => (
                  <li key={item}>
                    <span className="inline-flex rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/90">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-t border-slate-100 lg:grid-cols-4 lg:divide-y-0">
        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Metrics</p>
          <p className="mt-1 text-base font-bold tabular-nums text-slate-900 sm:text-lg">
            {showFiltered ? (
              <>
                {filteredCount}
                <span className="text-sm font-medium text-slate-400"> / {metricCount}</span>
              </>
            ) : (
              metricCount
            )}
          </p>
          {showFiltered ? <p className="mt-1 text-[11px] text-slate-500">Matching filters</p> : null}
        </div>
        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Providers</p>
          <p className="mt-1 text-base font-bold tabular-nums text-slate-900 sm:text-lg">{providerCount}</p>
        </div>
        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Categories</p>
          <p className="mt-1 text-base font-bold tabular-nums text-slate-900 sm:text-lg">{categoryCount}</p>
        </div>
        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pipeline</p>
          <p className="mt-1 text-sm font-semibold leading-snug text-slate-800">WDI → IMF → UIS</p>
          <p className="mt-1 text-[11px] text-slate-500">Server-side merge & cache</p>
        </div>
      </div>
    </section>
  );
}
