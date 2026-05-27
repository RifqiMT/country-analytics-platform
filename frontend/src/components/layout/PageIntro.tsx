import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Page title + description. Long copy collapses on phones/tablets to save vertical space. */
export default function PageIntro({ title, children, actions, className = "" }: Props) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 lg:p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 className="min-w-0 text-lg font-bold uppercase tracking-wide text-slate-900 sm:text-xl lg:text-2xl">
          {title}
        </h1>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <details className="group mt-2 lg:hidden">
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">
            About this view
            <svg
              className="h-3.5 w-3.5 transition group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </summary>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
      </details>
      <div className="mt-2 hidden space-y-2 text-sm leading-relaxed text-slate-600 lg:block">{children}</div>
    </div>
  );
}
