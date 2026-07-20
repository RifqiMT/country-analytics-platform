import type { StripStatItem } from "../lib/apiTransportStats";

type Props = {
  items: StripStatItem[];
  className?: string;
};

/** Four compact stat cells for the request log strip. */
export default function TransportStripStats({ items, className = "" }: Props) {
  return (
    <dl className={`grid grid-cols-4 gap-1.5 ${className}`}>
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0 rounded-md bg-slate-50 px-1.5 py-1 text-center ring-1 ring-slate-100 sm:px-2">
          <dt className="truncate text-[9px] font-medium text-slate-400">{label}</dt>
          <dd className="truncate text-[11px] font-semibold tabular-nums text-slate-800" title={value}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
