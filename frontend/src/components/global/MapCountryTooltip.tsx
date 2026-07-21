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
  visible: boolean;
};

const STAT_ORDER = [
  { key: "min", label: "Bottom country", hint: "lowest on map" },
  { key: "max", label: "Top country", hint: "largest on map" },
  { key: "median", label: "Middle country", hint: "median value" },
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
    const beaten = countriesOutrankedPercent(countryRank);
    if (countryRank.rank === 1) return "Ranks 1st among countries on this map";
    return `Outranks ${beaten}% of countries on this map (#${countryRank.rank} of ${countryRank.total})`;
  }
  if (economyCount > 0) {
    return `Compared with ${economyCount} countries on this map`;
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

function valueContextInsight(value: number, stats: MapScopeStats): string | null {
  const { mean, median, max } = stats;
  if (!Number.isFinite(value) || max <= 0) return null;

  if (mean > 0) {
    const ratio = value / mean;
    if (ratio >= 2.5) return `${ratio.toFixed(1)}× the average`;
    if (ratio >= 1.15) return "Well above average";
    if (ratio >= 1.02) return "Above average";
    if (ratio <= 0.4) return `${ratio.toFixed(1)}× the average`;
    if (ratio <= 0.85) return "Below average";
    if (ratio <= 0.98) return "Slightly below average";
  }

  if (median > 0) {
    if (value > median * 1.08) return "Above median";
    if (value < median * 0.92) return "Below median";
    return "Near the median";
  }

  return null;
}

function rankPercentileLabel(rank: MapCountryRank): string {
  if (rank.total <= 1) return "";
  const topPct = Math.round((rank.rank / rank.total) * 100);
  if (rank.rank === 1) return "Highest globally";
  if (rank.rank <= 3) return `Top ${rank.rank} worldwide`;
  if (topPct <= 10) return `Top ${topPct}% worldwide`;
  if (topPct <= 25) return `Top ${topPct}% worldwide`;
  return `Top ${topPct}%`;
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
              <p className="font-semibold text-slate-700">Bottom</p>
              <p className="mt-0.5 truncate font-medium text-slate-900">{formatValue(min)}</p>
            </div>
            <div className="min-w-0 text-center">
              <p className="font-semibold text-slate-700">Middle</p>
              <p className="mt-0.5 whitespace-nowrap font-medium text-slate-900">{formatValue(median)}</p>
            </div>
            <div className="min-w-0 text-right">
              <p className="font-semibold text-slate-700">Top</p>
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
  }, [hover.x, hover.y, hover.name, hover.value, metricLabel, metricBlurb, scopeStats, countryRank]);

  const hasValue = hover.value !== null && !Number.isNaN(hover.value);
  const valueText = hasValue ? formatValue(hover.value!) : "No data";
  const isoBadge = hover.iso3 && hover.iso3 !== "—" ? hover.iso3 : null;

  const fmt = (v: number | null | undefined) =>
    v === null || v === undefined || Number.isNaN(v) ? "—" : formatValue(v);

  const rankText =
    countryRank && countryRank.rank > 0
      ? `#${countryRank.rank} / ${countryRank.total}`
      : "—";

  const rankSub =
    countryRank && countryRank.rank > 0 ? rankPercentileLabel(countryRank) : null;

  const contextInsight =
    hasValue && scopeStats && hover.value != null
      ? valueContextInsight(hover.value, scopeStats)
      : null;

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
        className={`cap-map-tooltip w-[min(19.5rem,calc(100vw-1.25rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ${
          visible ? "cap-map-tooltip--visible" : ""
        }`}
        role="status"
        aria-live="polite"
        aria-label={`${hover.name}, ${metricLabel}, ${metricBlurb || valueText}, ${valueText}, rank ${rankText}`}
      >
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: accentColor }} aria-hidden />

        <div className="p-3.5 sm:p-4">
          <header className="flex items-start gap-3 border-b border-slate-100 pb-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              aria-hidden
            >
              {hover.flagPng ? (
                <img src={hover.flagPng} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : hover.emoji ? (
                <span className="text-[1.25rem] leading-none">{hover.emoji}</span>
              ) : (
                <span className="text-[0.625rem] font-bold uppercase tracking-wide text-slate-400">
                  {isoBadge?.slice(0, 2) ?? "—"}
                </span>
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-sm font-semibold leading-tight text-slate-900">{hover.name}</h3>
                <time
                  dateTime={String(year)}
                  className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-slate-600"
                >
                  {year}
                </time>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {isoBadge ? (
                  <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-px text-[0.5625rem] font-semibold uppercase tracking-wide text-slate-500">
                    {isoBadge}
                  </span>
                ) : null}
                {contextInsight ? (
                  <span className="inline-flex rounded-md border border-teal-200 bg-teal-50 px-1.5 py-px text-[0.5625rem] font-semibold text-teal-800">
                    {contextInsight}
                  </span>
                ) : null}
              </div>
            </div>
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
                    <StatCell
                      key={key}
                      label={label}
                      hint={hint}
                      value={statValues[key]}
                      sub={key === "rank" ? rankSub : null}
                      highlight={key === "rank" && countryRank != null}
                    />
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
  sub,
  highlight,
}: {
  label: string;
  hint?: string | null;
  value: string;
  sub?: string | null;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 bg-slate-50 px-2 py-2 sm:px-2.5 sm:py-2.5">
      <p className="text-[0.5625rem] font-semibold leading-snug text-slate-600">{label}</p>
      {hint ? <p className="text-[0.5rem] leading-snug text-slate-400">{hint}</p> : null}
      <p
        className={`mt-1 truncate text-[0.6875rem] font-semibold tabular-nums leading-snug ${
          highlight ? "text-teal-700" : "text-slate-900"
        }`}
        title={value}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 truncate text-[0.5625rem] font-medium leading-snug text-teal-700">{sub}</p>
      ) : null}
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
