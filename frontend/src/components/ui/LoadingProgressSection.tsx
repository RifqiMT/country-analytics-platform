import type { ReactNode } from "react";
import LoadingProgressBar from "./LoadingProgressBar";

type Variant = "default" | "muted" | "card";

type Props = {
  label: string;
  progress: number;
  variant?: Variant;
  showPercent?: boolean;
  className?: string;
  children?: ReactNode;
};

const VARIANT_CLASS: Record<Variant, string> = {
  default: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5",
  muted: "rounded-xl border border-slate-200 bg-slate-50/60 p-4",
  card: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
};

export default function LoadingProgressSection({
  label,
  progress,
  variant = "default",
  showPercent = true,
  className = "",
  children,
}: Props) {
  return (
    <section
      className={`${VARIANT_CLASS[variant]} ${className}`.trim()}
      aria-busy="true"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <LoadingProgressBar
        label={label}
        progress={progress}
        showPercent={showPercent}
        className="mt-3"
      />
      {children}
    </section>
  );
}
