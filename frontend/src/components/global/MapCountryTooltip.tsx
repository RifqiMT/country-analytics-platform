import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CHOROPLETH_TIER_GRADIENT } from "../../lib/choroplethTiers";
import { metricTooltipBlurb } from "../../lib/metricTooltipBlurb";

export type MapTooltipPayload = {
  name: string;
  iso3: string;
  emoji: string;
  flagPng?: string;
  value: number | null;
  x: number;
  y: number;
};

export type MapScopeStats = {
  count: number;
  min: number;
  max: number;
  median: number;
  mean: number;
  mode: number | null;
};

export type MapCountryRank = {
  rank: number;
  total: number;
};

type MapTierBadge = {
  shortLabel: string;
  rankLabel: string;
};

type Props = {
  hover: MapTooltipPayload;
  metricLabel: string;
  metricId: string;
  metricDescription: string;
  year: number;
  formatValue: (v: number) => string;
  accentColor: string;
  scopeStats: MapScopeStats | null;
  countryRank: MapCountryRank | null;
  tierBadge: MapTierBadge | null;
  visible: boolean;
};

const STAT_ORDER = [
  { key: "min", label: "Lowest", hint: "on this map" },
  { key: "max", label: "Highest", hint: "on this map" },
  { key: "median", label: "Median", hint: "middle value" },
  { key: "mean", label: "Average", hint: "across countries" },
  { key: "mode", label: "Most common", hint: "shared value" },
  { key: "rank", label: "Rank", hint: null },
] as const;

function countriesOutrankedPercent(rank: MapCountryRank): number {
  if (rank.total <= 1) return 0;
  return Math.round(((rank.total - rank.rank) / (rank.total - 1)) * 100);
}

function comparisonLine(countryRank: MapCountryRank | null, economyCount: number): string | null {
  if (countryRank && countryRank.rank > 0) {
    if (countryRank.rank === 1) return "Highest value on this map";
    if (countryRank.rank === countryRank.total) return "Lowest value on this map";
    const beaten = countriesOutrankedPercent(countryRank);
    return `#${countryRank.rank} of ${countryRank.total} · outranks ${beaten}%`;
  }
  if (economyCount > 0) {
    return `${economyCount} countries on this map`;
  }
  return null;
}

function clampPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  offset = 20
): { left: number; top: number } {
  const pad = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x + offset;
  let top = y + offset;
  if (left + w > vw - pad) left = x - w - offset;
  if (top + h > vh - pad) top = y - h - offset;
  left = Math.max(pad, Math.min(left, vw - w - pad));
  top = Math.max(pad, Math.min(top, vh - h - pad));
  return { left, top };
}

function rangePosition(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  const ratio = max / Math.max(min, Number.MIN_VALUE);
  if (ratio > 40 && min > 0 && value > 0) {
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logVal = Math.log10(Math.max(value, min));
    if (logMax <= logMin) return 50;
    return ((logVal - logMin) / (logMax - logMin)) * 100;
  }
  return ((value - min) / (max - min)) * 100;
}

function SelectedValuePanel({
  valueText,
  hasValue,
  value,
  scopeStats,
  accentColor,
  formatValue,
  countryRank,
}: {
  valueText: string;
  hasValue: boolean;
  value: number | null;
  scopeStats: MapScopeStats;
  accentColor: string;
  formatValue: (v: number) => string;
  countryRank: MapCountryRank | null;
}) {
  const { min, max, median, count } = scopeStats;
  const showRange = hasValue && value != null && max > min;
  const markerPct = showRange ? rangePosition(value, min, max) : 50;
  const medianPct = showRange ? rangePosition(median, min, max) : 50;
  const clamped = Math.max(5, Math.min(95, markerPct));
  const compareLine = comparisonLine(countryRank, count);

  return (
    <section className="cap-map-value-panel mb-3 rounded-lg border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-3.5 py-3">
        <p className="text-[0.625rem] font-medium uppercase tracking-wide text-slate-500">
          This country&apos;s value
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p
            className={`text-[1.5rem] font-bold tabular-nums leading-none tracking-tight sm:text-[1.625rem] ${
              hasValue ? "text-slate-900" : "text-slate-400"
            }`}
          >
            {valueText}
          </p>
          {hasValue ? (
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: accentColor }}
              aria-hidden
            />
          ) : null}
        </div>
      </div>

      {showRange ? (
        <div className="px-3.5 py-3">
          {compareLine ? (
            <p className="text-[0.6875rem] font-medium leading-snug text-slate-700">{compareLine}</p>
          ) : null}

          <div
            className={`relative ${compareLine ? "mt-3" : ""} pt-1`}
            role="img"
            aria-label={`Country value compared with bottom ${formatValue(min)} and top ${formatValue(max)} on this map`}
          >
            <div className="relative h-2 overflow-hidden rounded-full border border-slate-200 bg-slate-200">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${clamped}%`, background: CHOROPLETH_TIER_GRADIENT }}
                aria-hidden
              />
              <span
                className="absolute inset-y-0 w-px -translate-x-1/2 bg-slate-600"
                style={{ left: `${Math.max(3, Math.min(97, medianPct))}%`, opacity: 0.35 }}
                title="Middle country (median)"
                aria-hidden
              />
            </div>

            <span
              className="cap-map-tooltip-marker absolute top-0 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white shadow-md"
              style={{
                left: `calc(${clamped}% + 2px)`,
                backgroundColor: accentColor,
              }}
              aria-hidden
            />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-[0.625rem] tabular-nums">
            <div className="min-w-0">
              <p className="font-semibold text-slate-700">Lowest</p>
              <p className="mt-0.5 truncate font-medium text-slate-900">{formatValue(min)}</p>
            </div>
            <div className="min-w-0 text-center">
              <p className="font-semibold text-slate-700">Median</p>
              <p className="mt-0.5 whitespace-nowrap font-medium text-slate-900">{formatValue(median)}</p>
            </div>
            <div className="min-w-0 text-right">
              <p className="font-semibold text-slate-700">Highest</p>
              <p className="mt-0.5 truncate font-medium text-slate-900">{formatValue(max)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function MapCountryTooltip({
  hover,
  metricLabel,
  metricId,
  metricDescription,
  year,
  formatValue,
  accentColor,
  scopeStats,
  countryRank,
  tierBadge,
  visible,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: hover.x + 20, top: hover.y + 20 });

  const metricBlurb = useMemo(
    () => metricTooltipBlurb(metricId, metricDescription),
    [metricId, metricDescription]
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos(clampPosition(hover.x, hover.y, width, height));
  }, [hover.x, hover.y, hover.name, hover.value, metricLabel, metricBlurb, scopeStats, countryRank, tierBadge]);

  const hasValue = hover.value !== null && !Number.isNaN(hover.value);
  const valueText = hasValue ? formatValue(hover.value!) : "No data";
  const isoBadge = hover.iso3 && hover.iso3 !== "—" ? hover.iso3 : null;

  const fmt = (v: number | null | undefined) =>
    v === null || v === undefined || Number.isNaN(v) ? "—" : formatValue(v);

  const rankText =
    countryRank && countryRank.rank > 0
      ? `#${countryRank.rank} / ${countryRank.total}`
      : "—";

  const statValues: Record<(typeof STAT_ORDER)[number]["key"], string> = {
    min: scopeStats ? fmt(scopeStats.min) : "—",
    max: scopeStats ? fmt(scopeStats.max) : "—",
    median: scopeStats ? fmt(scopeStats.median) : "—",
    mean: scopeStats ? fmt(scopeStats.mean) : "—",
    mode: scopeStats ? fmt(scopeStats.mode) : "—",
    rank: rankText,
  };

  return (
    <div
      className="cap-map-tooltip-track pointer-events-none fixed left-0 top-0 z-[100]"
      style={{
        transform: `translate3d(${pos.left}px, ${pos.top}px, 0)`,
        visibility: visible ? "visible" : "hidden",
      }}
    >
      <div
        ref={ref}
        className={`cap-map-tooltip w-[min(21rem,calc(100vw-1.25rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ${
          visible ? "cap-map-tooltip--visible" : ""
        }`}
        role="status"
        aria-live="polite"
        aria-label={`${hover.name}, ${metricLabel}, ${metricBlurb || valueText}, ${valueText}, rank ${rankText}`}
      >
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: accentColor }} aria-hidden />

        <div className="p-3.5 sm:p-4">
          <header className="grid grid-cols-[auto_1fr_auto] gap-x-2.5 gap-y-1.5 border-b border-slate-100 pb-3">
            <span
              className="row-span-2 self-center flex aspect-[3/2] w-8 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-slate-100 shadow-sm ring-1 ring-slate-200/90"
              aria-hidden
            >
              {hover.flagPng ? (
                <img src={hover.flagPng} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : hover.emoji ? (
                <span className="text-[1.125rem] leading-none">{hover.emoji}</span>
              ) : (
                <span className="text-[0.5rem] font-bold uppercase tracking-wide text-slate-400">
                  {isoBadge?.slice(0, 2) ?? "—"}
                </span>
              )}
            </span>

            <h3
              className="min-w-0 self-center truncate text-sm font-semibold leading-tight text-slate-900"
              title={hover.name}
            >
              {hover.name}
            </h3>

            <time
              dateTime={String(year)}
              className="self-center shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums leading-none text-slate-600"
            >
              {year}
            </time>

            {(isoBadge || tierBadge) && (
              <div className="col-start-2 col-span-2 flex min-w-0 flex-wrap items-center gap-1.5">
                {isoBadge ? (
                  <span className="inline-flex shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80">
                    {isoBadge}
                  </span>
                ) : null}
                {tierBadge ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-slate-50 px-2 py-0.5 text-[0.625rem] font-medium text-slate-700 ring-1 ring-slate-200/80">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px] ring-1 ring-slate-200/80"
                      style={{ backgroundColor: accentColor }}
                      aria-hidden
                    />
                    <span className="truncate">
                      {tierBadge.shortLabel}
                      <span className="text-slate-400"> · </span>
                      {tierBadge.rankLabel}
                    </span>
                  </span>
                ) : null}
              </div>
            )}
          </header>

          <section className="border-b border-slate-100 py-3">
            <p className="text-xs font-semibold text-slate-800">{metricLabel}</p>
            {metricBlurb ? (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{metricBlurb}</p>
            ) : null}
          </section>

          {scopeStats ? (
            <SelectedValuePanel
              valueText={valueText}
              hasValue={hasValue}
              value={hover.value}
              scopeStats={scopeStats}
              accentColor={accentColor}
              formatValue={formatValue}
              countryRank={countryRank}
            />
          ) : (
            <section className="my-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
              <p className="text-[1.5rem] font-bold tabular-nums leading-none text-slate-400">{valueText}</p>
            </section>
          )}

          {scopeStats ? (
            <section className="pt-1" aria-label="Per-country distribution statistics">
              <p className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide text-slate-500">
                Map comparison
              </p>
              <div className="cap-map-tooltip-stats overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="grid grid-cols-3 divide-x divide-slate-200">
                  {STAT_ORDER.slice(0, 3).map(({ key, label, hint }) => (
                    <StatCell key={key} label={label} hint={hint} value={statValues[key]} />
                  ))}
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200">
                  {STAT_ORDER.slice(3).map(({ key, label, hint }) => (
                    <StatCell key={key} label={label} hint={hint} value={statValues[key]} />
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[0.625rem] leading-relaxed text-slate-400">
                Each value is for one country — not a world total.
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatCell({
  label,
  hint,
  value,
}: {
  label: string;
  hint?: string | null;
  value: string;
}) {
  return (
    <div className="min-w-0 bg-slate-50 px-2 py-2 sm:px-2.5 sm:py-2.5">
      <p className="text-[0.5625rem] font-semibold leading-snug text-slate-600">{label}</p>
      {hint ? <p className="text-[0.5rem] leading-snug text-slate-400">{hint}</p> : null}
      <p className="mt-1 truncate text-[0.6875rem] font-semibold tabular-nums leading-snug text-slate-900" title={value}>
        {value}
      </p>
    </div>
  );
}

/** Values in the current map scope (respects region filter). */
export function mapScopeValues(
  valueByIso3: Map<string, number>,
  allowedIso3: Set<string>,
  regionFilter: string
): number[] {
  const out: number[] = [];
  for (const [iso, val] of valueByIso3) {
    if (val === null || Number.isNaN(val)) continue;
    if (regionFilter !== "All" && !allowedIso3.has(iso)) continue;
    out.push(val);
  }
  return out;
}

function roundForMode(v: number): number {
  if (v === 0) return 0;
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const factor = 10 ** Math.max(exp - 2, -2);
  return Math.round(v / factor) * factor;
}

function computeMode(values: number[]): number | null {
  if (values.length < 2) return null;
  const counts = new Map<number, number>();
  for (const v of values) {
    const key = roundForMode(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 1;
  for (const [val, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = val;
    }
  }
  return bestCount > 1 ? best : null;
}

export function computeMapScopeStats(values: number[]): MapScopeStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  const mode = computeMode(values);
  return { count: values.length, min, max, median, mean, mode };
}

/** Rank by value descending (1 = highest). */
export function computeCountryRank(
  iso3: string,
  valueByIso3: Map<string, number>,
  allowedIso3: Set<string>,
  regionFilter: string
): MapCountryRank | null {
  if (!iso3 || iso3 === "—") return null;
  const v = valueByIso3.get(iso3);
  if (v === undefined || v === null || Number.isNaN(v)) return null;

  const ranked: number[] = mapScopeValues(valueByIso3, allowedIso3, regionFilter);
  if (ranked.length === 0) return null;

  ranked.sort((a, b) => b - a);
  const rank = ranked.filter((n) => n > v).length + 1;
  return { rank, total: ranked.length };
}
