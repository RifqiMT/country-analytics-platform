import type { ReactNode } from "react";
import { yoYClass, type YoYDisplay } from "../../lib/formatValue";

type Props = {
  icon?: ReactNode;
  label: string;
  value: string;
  yoy?: YoYDisplay;
  compact?: boolean;
};

export default function MetricCard({ icon, label, value, yoy, compact = false }: Props) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white transition hover:border-slate-300 ${compact ? "p-3" : "p-3.5 sm:p-4"}`}
    >
      <div className="flex items-start gap-2">
        {icon ? <div className="mt-0.5 shrink-0 text-teal-600">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p
            className={`mt-1 break-words font-semibold tabular-nums leading-tight text-slate-900 ${
              compact ? "text-base" : "text-lg"
            }`}
          >
            {value}
          </p>
          {yoy && yoy.text !== "—" ? (
            <p className={`mt-1 text-xs font-medium tabular-nums ${yoYClass(yoy.tone)}`}>{yoy.text}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
