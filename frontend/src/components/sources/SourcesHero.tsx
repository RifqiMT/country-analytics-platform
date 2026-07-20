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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="inline-flex rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Reference
          </span>
          <span className="inline-flex rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
            Methodology
          </span>
        </div>
        <h1 className="font-display mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
          Data Sources & Methodology
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Credible public institutions power every indicator — World Bank WDI, IMF WEO, REST Countries,
          UNESCO UIS, and more. Search the metric dictionary below for codes, formulas, and outbound links.
        </p>
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
