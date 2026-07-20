import type { PorterAnalysis } from "../../types/porter";

type Props = {
  analysis: PorterAnalysis;
};

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

/** Takeaways, market notes, and recommendations in a compact grid. */
export default function PorterInsightsPanel({ analysis }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
      <InsightBlock title="Market entry notes" items={analysis.newMarketAnalysis} hint="Practical implications for entering this sector." />
      <InsightBlock title="Key takeaways" items={analysis.keyTakeaways} hint="What matters most from the five forces." />
      <InsightBlock title="Recommendations" items={analysis.recommendations} hint="Suggested next moves for strategy and diligence." />
    </div>
  );
}
