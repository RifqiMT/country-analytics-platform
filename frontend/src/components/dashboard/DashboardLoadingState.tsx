type Props = {
  label: string;
  progress: number;
};

export default function DashboardLoadingState({ label, progress }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-busy="true">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
          />
        </div>
        <p className="mt-2 text-xs tabular-nums text-slate-500">{progress}%</p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="h-2 w-16 rounded bg-slate-200" />
            <div className="mt-3 h-6 w-24 rounded bg-slate-200" />
            <div className="mt-2 h-2 w-12 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </section>
  );
}
