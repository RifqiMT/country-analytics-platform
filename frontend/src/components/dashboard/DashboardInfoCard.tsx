import type { ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
  accent?: "default" | "rose" | "teal" | "amber";
};

const ACCENT_BAR: Record<NonNullable<Props["accent"]>, string> = {
  default: "bg-slate-300",
  rose: "bg-rose-400",
  teal: "bg-teal-500",
  amber: "bg-amber-400",
};

export default function DashboardInfoCard({ label, children, hint, className = "", accent = "default" }: Props) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-3.5 transition hover:border-slate-300 sm:p-4 ${className}`}
    >
      <div className="flex gap-2.5">
        <span className={`mt-0.5 w-0.5 shrink-0 self-stretch rounded-full ${ACCENT_BAR[accent]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <div className="mt-2 break-words">{children}</div>
          {hint ? <p className="mt-2 text-[11px] leading-snug text-slate-400">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
