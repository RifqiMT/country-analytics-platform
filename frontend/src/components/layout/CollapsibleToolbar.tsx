import type { ReactNode } from "react";

type Props = {
  title: string;
  /** Shown in the collapsed mobile summary (e.g. current filter values). */
  summary: string;
  children: ReactNode;
  className?: string;
  /** When true, toolbar stays open on mobile (e.g. while loading). */
  forceOpen?: boolean;
};

/** Filter/control bars: collapsed chip on phones, full panel from md upward. */
export default function CollapsibleToolbar({ title, summary, children, className = "", forceOpen }: Props) {
  return (
    <>
      <details
        open={forceOpen || undefined}
        className={`group rounded-2xl border border-slate-200 bg-white shadow-sm md:hidden ${className}`}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 sm:px-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
            <p className="truncate text-sm font-medium text-slate-800">{summary}</p>
          </div>
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
        <div className="border-t border-slate-100 px-2 py-2 sm:px-3 md:border-0 md:p-0">{children}</div>
      </details>
      <div className={`hidden rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm md:block ${className}`}>
        {children}
      </div>
    </>
  );
}
