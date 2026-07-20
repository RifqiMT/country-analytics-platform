import type { MetricDef } from "../../api";
import { metricDisplayLabel } from "../../lib/metricDisplay";
import ExternalLinkIcon from "./ExternalLinkIcon";
import { metricSourceLinks } from "./sourcesConstants";

type Props = {
  metric: MetricDef;
};

export default function SourceMetricCard({ metric: m }: Props) {
  const links = metricSourceLinks(m);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900 sm:text-base">{m.label}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Chart label:{" "}
            <span className="font-medium text-slate-700">{metricDisplayLabel(m)}</span>
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-700">
          {m.unit}
        </span>
      </div>

      {m.worldBankCode ? (
        <p className="mt-2 font-mono text-[11px] text-slate-400">{m.worldBankCode}</p>
      ) : null}

      <p className="mt-3 text-sm leading-relaxed text-slate-600">{m.description}</p>

      <div className="mt-4 space-y-2">
        <details className="group rounded-lg border border-slate-200">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Formula</span>
            <svg
              className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-800">
            {m.formula ?? (
              <span className="font-sans text-slate-500">
                Defined by the primary source indicator; please refer to the official documentation linked below.
              </span>
            )}
          </div>
        </details>

        <details className="group rounded-lg border border-slate-200" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left [&::-webkit-details-marker]:hidden">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Sources ({links.length})
            </span>
            <svg
              className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <ul className="space-y-1.5 border-t border-slate-100 px-3 py-2.5">
            {links.map((l, i) => (
              <li key={i}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline"
                >
                  {l.name}
                  <ExternalLinkIcon />
                </a>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </article>
  );
}
