import type { DataProvidersPayload } from "../../api";
import ExternalLinkIcon from "./ExternalLinkIcon";

type Provider = DataProvidersPayload["providers"][number];

type Props = {
  provider: Provider;
};

export default function SourceProviderCard({ provider }: Props) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {provider.institution}
          </p>
          <h3 className="mt-1 text-sm font-bold text-slate-900 sm:text-base">{provider.name}</h3>
        </div>
        {provider.seriesMergeOrder != null ? (
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
            Step {provider.seriesMergeOrder}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{provider.role}</p>
      <ul className="mt-3 flex-1 space-y-1">
        {provider.usedFor.map((u) => (
          <li key={u} className="flex gap-2 text-xs text-slate-600">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden />
            <span>{u}</span>
          </li>
        ))}
      </ul>
      {provider.notes ? (
        <p className="mt-3 text-[11px] leading-snug text-slate-400">{provider.notes}</p>
      ) : null}
      <a
        href={provider.url}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline"
      >
        Official site / API
        <ExternalLinkIcon />
      </a>
    </article>
  );
}
