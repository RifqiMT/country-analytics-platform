type ChipDef = { id: string; label: string };

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  chips: ChipDef[];
  selectedSources: Set<string>;
  onToggleChip: (id: string) => void;
  onClearFilters: () => void;
  resultCount: number;
  totalCount: number;
};

export default function SourcesFilterPanel({
  query,
  onQueryChange,
  chips,
  selectedSources,
  onToggleChip,
  onClearFilters,
  resultCount,
  totalCount,
}: Props) {
  const hasFilters = query.trim().length > 0 || selectedSources.size > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Metric dictionary</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {hasFilters ? (
              <>
                Showing <span className="font-semibold tabular-nums text-slate-700">{resultCount}</span> of{" "}
                {totalCount} metrics
              </>
            ) : (
              <>Browse {totalCount} documented indicators by category</>
            )}
          </p>
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="shrink-0 self-start rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="relative mt-4">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by name, code, formula, or source…"
          aria-label="Search metrics"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
        />
      </div>

      {chips.length > 0 ? (
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Filter by provider</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => {
              const active = selectedSources.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onToggleChip(c.id)}
                  aria-pressed={active}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "border-slate-800 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
