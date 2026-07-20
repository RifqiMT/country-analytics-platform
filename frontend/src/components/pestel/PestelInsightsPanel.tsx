import type { PestelAnalysis } from "../../types/pestel";

function InsightBlock({ title, items, hint }: { title: string; items: string[]; hint?: string }) {
  if (!items.length) return null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      <ul className="mt-3 space-y-2">
        {items.map((line, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-600">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Market notes, takeaways, and recommendations in one grid. */
export default function PestelInsightsPanel({ analysis }: { analysis: PestelAnalysis }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
      <InsightBlock
        title="Market entry notes"
        items={analysis.newMarketAnalysis}
        hint="What the environment implies for entering or expanding."
      />
      <InsightBlock title="Key takeaways" items={analysis.keyTakeaways} hint="The most important macro signals." />
      <InsightBlock
        title="Recommendations"
        items={analysis.recommendations}
        hint="Practical next steps for strategy and diligence."
      />
    </div>
  );
}
