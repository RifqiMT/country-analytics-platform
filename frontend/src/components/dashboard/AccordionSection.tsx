import type { ReactNode, SyntheticEvent } from "react";

type Props = {
  id?: string;
  title: string;
  subtitle?: string;
  accent?: "slate" | "rose" | "teal" | "amber" | "indigo";
  defaultOpen?: boolean;
  /** Controlled open state — when set with onOpenChange, replaces defaultOpen. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDownload?: () => void;
  children: ReactNode;
};

const ACCENT: Record<NonNullable<Props["accent"]>, string> = {
  slate: "group-open:bg-slate-100 group-open:text-slate-700",
  rose: "group-open:bg-rose-50 group-open:text-rose-700",
  teal: "group-open:bg-teal-50 group-open:text-teal-700",
  amber: "group-open:bg-amber-50 group-open:text-amber-800",
  indigo: "group-open:bg-indigo-50 group-open:text-indigo-700",
};

export default function AccordionSection({
  id,
  title,
  subtitle,
  accent = "slate",
  defaultOpen = false,
  open,
  onOpenChange,
  onDownload,
  children,
}: Props) {
  const controlled = open !== undefined && onOpenChange !== undefined;
  return (
    <details
      id={id}
      {...(controlled
        ? {
            open,
            onToggle: (e: SyntheticEvent<HTMLDetailsElement>) => {
              onOpenChange(e.currentTarget.open);
            },
          }
        : { open: defaultOpen })}
      className="group scroll-mt-24 rounded-xl border border-slate-200 bg-white shadow-sm transition-colors open:border-slate-300"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-colors ${ACCENT[accent]}`}
            aria-hidden
          >
            <svg
              className="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900 sm:text-base">{title}</span>
            {subtitle ? (
              <span className="mt-0.5 block break-words text-xs leading-snug text-slate-500">{subtitle}</span>
            ) : null}
          </span>
        </span>
        {onDownload ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onDownload();
            }}
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            title="Download CSV"
            aria-label={`Download ${title} CSV`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
              />
            </svg>
          </button>
        ) : null}
      </summary>
      <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">{children}</div>
    </details>
  );
}
