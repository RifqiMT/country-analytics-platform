import type { StrategicSection } from "../../types/pestel";

export default function PestelStrategicCard({ sections }: { sections: StrategicSection[] }) {
  if (!sections.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Strategic implications</h2>
        <p className="text-xs text-slate-500">From PESTEL and SWOT</p>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Action-oriented reading of strengths, weaknesses, opportunities, and threats for business decisions.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-5">
        {sections.map((s, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
            <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-slate-600">
              {s.paragraphs.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
