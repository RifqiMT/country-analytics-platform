import type { ReactNode } from "react";

type Props = {
  title: string;
  /** Small label above the title, e.g. "Cross-country view". */
  eyebrow?: string;
  /** Primary description in plain English, always visible when set. */
  lead?: string;
  /** Optional secondary paragraph, collapsible on small screens. */
  detail?: string;
  /** Short feature chips below the copy. */
  highlights?: string[];
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

function HighlightPills({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Key features">
      {items.map((item) => (
        <li key={item}>
          <span className="inline-flex rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/90">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Page title and feature description. Two-column on large screens to avoid dead horizontal space. */
export default function PageIntro({
  title,
  eyebrow,
  lead,
  detail,
  highlights,
  children,
  actions,
  className = "",
}: Props) {
  const hasExpandable = Boolean(detail || children || (highlights && highlights.length > 0));

  const expandable = (
    <div className="space-y-2.5">
      {detail ? (
        <p className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
          {detail}
        </p>
      ) : null}
      {children}
      {highlights && highlights.length > 0 ? <HighlightPills items={highlights} /> : null}
    </div>
  );

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50/60 shadow-sm ring-1 ring-slate-900/[0.03] ${className}`}
    >
      <div className="h-0.5 bg-gradient-to-r from-teal-500/70 via-slate-200 to-red-500/50" aria-hidden />
      <div className="px-3 py-3 sm:px-4 sm:py-3.5 lg:px-5 lg:py-4">
        <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-6 xl:gap-x-8">
          <div className="min-w-0 lg:col-span-4 xl:col-span-3">
            <div className="flex items-start justify-between gap-3 lg:block">
              <div className="min-w-0">
                {eyebrow ? (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-teal-700">{eyebrow}</p>
                ) : null}
                <h1
                  className={`font-display font-bold tracking-tight text-slate-900 ${
                    eyebrow ? "mt-1 text-xl sm:text-2xl lg:text-[1.5rem] xl:text-[1.65rem]" : "text-xl sm:text-2xl lg:text-[1.5rem] xl:text-[1.65rem]"
                  }`}
                >
                  {title}
                </h1>
              </div>
              {actions ? <div className="shrink-0 lg:mt-3">{actions}</div> : null}
            </div>
          </div>

          <div className="mt-3 min-w-0 space-y-2.5 lg:col-span-8 lg:mt-0 xl:col-span-9">
            {lead ? (
              <p className="text-sm font-medium leading-relaxed text-slate-800 sm:text-[0.9375rem] lg:text-[0.9375rem] lg:leading-relaxed xl:text-base">
                {lead}
              </p>
            ) : null}

            {hasExpandable ? (
              <>
                <details className="group lg:hidden">
                  <summary className="cursor-pointer list-none rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-1.5">
                      Read more about this page
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
                  <div className="pt-2.5">{expandable}</div>
                </details>
                <div className="hidden lg:block">{expandable}</div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

