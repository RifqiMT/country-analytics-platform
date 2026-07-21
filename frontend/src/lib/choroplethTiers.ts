/** Distinct quintile palette — wide luminance steps with a hue shift at the top tier. */
export const CHOROPLETH_NO_DATA = "#e2e8f0";
export const CHOROPLETH_EXCLUDED = "#f1f5f9";
export const CHOROPLETH_ANTARCTICA = "#f8fafc";

const CHOROPLETH_TIER_COLORS = [
  "#bae6fd", // sky-200 — light, clearly blue (vs gray no-data)
  "#0ea5e9", // sky-500 — bright mid-light
  "#0369a1", // sky-700 — medium-dark cyan-blue
  "#1e3a8a", // blue-900 — deep blue
  "#172554", // blue-950 — near-navy (hue shift from tier 3)
] as const;

export const CHOROPLETH_TIER_GRADIENT = `linear-gradient(to right, ${CHOROPLETH_TIER_COLORS.join(", ")})`;

const TIER_COLORS = CHOROPLETH_TIER_COLORS;

const TIER_SHORT = ["Lowest", "Low", "Mid", "High", "Highest"] as const;

const TIER_RANK = [
  "Bottom 20%",
  "Lower 20%",
  "Middle 20%",
  "Upper 20%",
  "Top 20%",
] as const;

export type ChoroplethTier = {
  index: number;
  color: string;
  shortLabel: string;
  rankLabel: string;
  min: number;
  max: number;
  count: number;
};

export type ChoroplethTierModel = {
  tiers: ChoroplethTier[];
  /** Upper bounds for tiers 0..3; tier 4 is everything above breaks[3]. */
  breaks: number[];
  total: number;
  colorForValue: (value: number) => string;
  tierIndexForValue: (value: number) => number;
};

function quantileBreaks(sorted: number[], n = 5): number[] {
  if (sorted.length === 0) return [];
  const breaks: number[] = [];
  for (let q = 1; q < n; q++) {
    const idx = Math.floor((q / n) * sorted.length) - 1;
    breaks.push(sorted[Math.max(0, Math.min(sorted.length - 1, idx))]!);
  }
  return breaks;
}

function tierIndexFromBreaks(value: number, breaks: number[]): number {
  if (breaks.length === 0) return 0;
  for (let i = 0; i < breaks.length; i++) {
    if (value <= breaks[i]!) return i;
  }
  return breaks.length;
}

export function buildChoroplethTierModel(values: number[]): ChoroplethTierModel | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const breaks = quantileBreaks(sorted);
  const n = TIER_COLORS.length;

  const tiers: ChoroplethTier[] = [];
  for (let i = 0; i < n; i++) {
    const inTier = sorted.filter((v) => tierIndexFromBreaks(v, breaks) === i);
    if (inTier.length === 0) {
      tiers.push({
        index: i,
        color: TIER_COLORS[i]!,
        shortLabel: TIER_SHORT[i]!,
        rankLabel: TIER_RANK[i]!,
        min: sorted[0]!,
        max: sorted[sorted.length - 1]!,
        count: 0,
      });
      continue;
    }
    tiers.push({
      index: i,
      color: TIER_COLORS[i]!,
      shortLabel: TIER_SHORT[i]!,
      rankLabel: TIER_RANK[i]!,
      min: inTier[0]!,
      max: inTier[inTier.length - 1]!,
      count: inTier.length,
    });
  }

  return {
    tiers,
    breaks,
    total: sorted.length,
    colorForValue: (value: number) => TIER_COLORS[tierIndexFromBreaks(value, breaks)]!,
    tierIndexForValue: (value: number) => tierIndexFromBreaks(value, breaks),
  };
}

export function formatTierRange(
  min: number,
  max: number,
  formatValue: (v: number) => string
): string {
  if (min === max) return formatValue(min);
  return `${formatValue(min)} – ${formatValue(max)}`;
}
