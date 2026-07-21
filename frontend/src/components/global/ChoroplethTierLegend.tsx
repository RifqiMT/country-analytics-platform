import {
  CHOROPLETH_NO_DATA,
  formatTierRange,
  type ChoroplethTier,
  type ChoroplethTierModel,
} from "../../lib/choroplethTiers";

type Props = {
  model: ChoroplethTierModel | null;
  formatValue: (v: number) => string;
  economyCount: number;
};

function tierTitle(tier: ChoroplethTier, formatValue: (v: number) => string): string {
  const range =
    tier.count > 0 ? formatTierRange(tier.min, tier.max, formatValue) : "No countries in tier";
  return `${tier.shortLabel} (${tier.rankLabel}): ${range} · ${tier.count} countries`;
}

export default function ChoroplethTierLegend({ model, formatValue, economyCount }: Props) {
  if (!model || model.tiers.length === 0) {
    return <p className="text-xs text-slate-500">No data available for the color scale.</p>;
  }

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-3 sm:p-3.5">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-semibold text-slate-800">Color scale</p>
        <p className="text-[0.625rem] tabular-nums text-slate-500">
          {economyCount} countries · 5 rank tiers
        </p>
      </div>

      <div
        className="flex h-5 gap-px overflow-hidden rounded-md border border-slate-200 bg-white p-px"
        role="list"
        aria-label="Map color scale by rank tier"
      >
        {model.tiers.map((tier) => (
          <div
            key={tier.index}
            role="listitem"
            className="min-w-0 flex-1 rounded-[2px]"
            style={{ backgroundColor: tier.color }}
            title={tierTitle(tier, formatValue)}
            aria-label={tierTitle(tier, formatValue)}
          />
        ))}
      </div>

      <div className="mt-2 hidden grid-cols-5 gap-1 sm:grid">
        {model.tiers.map((tier) => (
          <div key={tier.index} className="min-w-0 text-center">
            <p className="truncate text-[0.625rem] font-semibold text-slate-700">{tier.shortLabel}</p>
            <p className="truncate text-[0.5625rem] text-slate-400">{tier.rankLabel}</p>
          </div>
        ))}
      </div>

      <ul className="mt-2 space-y-1 sm:hidden">
        {model.tiers.map((tier) => (
          <li key={tier.index} className="flex min-w-0 items-center gap-2 text-[0.625rem]">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slate-300"
              style={{ backgroundColor: tier.color }}
              aria-hidden
            />
            <span className="font-semibold text-slate-700">{tier.shortLabel}</span>
            <span className="truncate text-slate-400">{tier.rankLabel}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2.5 text-[0.625rem] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 shrink-0 rounded-sm border border-slate-200"
            style={{ backgroundColor: CHOROPLETH_NO_DATA }}
            aria-hidden
          />
          No data
        </span>
        <span>Darker shades = higher values</span>
        <span className="hidden text-slate-400 md:inline">Hover a segment for value ranges</span>
      </div>
    </div>
  );
}
