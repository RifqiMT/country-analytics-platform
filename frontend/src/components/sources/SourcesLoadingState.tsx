export default function SourcesLoadingState() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="mt-4 h-8 w-2/3 max-w-md rounded bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-xl rounded bg-slate-100" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-50" />
          ))}
        </div>
      </div>
      <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-10 rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}
