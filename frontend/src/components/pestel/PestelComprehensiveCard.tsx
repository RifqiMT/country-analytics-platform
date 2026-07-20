import type { ComprehensiveSection } from "../../types/pestel";

export default function PestelComprehensiveCard({ sections }: { sections: ComprehensiveSection[] }) {
  if (!sections.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Comprehensive brief</h2>
        <p className="text-xs text-slate-500">{sections.length} sections</p>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        What the dashboard series show for each theme, and what that implies for the country context.
      </p>
      <div className="mt-5 space-y-6 border-t border-slate-100 pt-5">
        {sections.map((s, i) => (
          <div key={i} className="scroll-mt-24">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-50 text-[11px] font-bold text-teal-800">
                {i + 1}
              </span>
              <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{s.title}</h3>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-slate-600">
              {s.body.split(/\n\n+/).map((para, j) => (
                <p key={j}>{para}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
