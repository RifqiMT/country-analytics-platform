/** Anchor id: `/sources#country-comparison-methodology` */
export const COUNTRY_COMPARISON_METHODOLOGY_ID = "country-comparison-methodology";

export const COUNTRY_COMPARISON_METHODOLOGY_PATH = `/sources#${COUNTRY_COMPARISON_METHODOLOGY_ID}`;

export const COUNTRY_COMPARISON_METHODOLOGY_SECTIONS = [
  {
    title: "Avg country column",
    items: [
      "Uses REST sovereign countries only — WDI “all” rows for WLD and regions are excluded.",
      "GDP levels: median across economies at the snapshot year.",
      "GDP per capita: Σ GDP ÷ Σ population at the snapshot year (implied aggregate).",
      "GNI per capita (Atlas): median economy at the snapshot year.",
      "Inflation, lending, poverty, unemployment, health rates, literacy, age shares, homicide, and GBV: population-weighted mean where WDI publishes both series.",
      "Labour force: median national level; unemployment %: labour-force–weighted mean.",
      "Crime & safety: homicide rates population-weighted; IDP/battle deaths median; WGI indices median.",
      "Unemployed (count): median national count across reporting economies.",
    ],
  },
  {
    title: "Global column",
    items: [
      "Prefers WLD (World Bank world aggregate) at the same snapshot year when published.",
      "Level totals (GDP, population, labour force, IDP, battle deaths): sum of countries when WLD is missing.",
      "Rates and per-capita metrics: same population- or labour-weighted aggregate as avg country, then median/mean fallback.",
      "Unemployed (number): WLD unemployment rate × WLD labour force when possible; else sum of national counts.",
    ],
  },
  {
    title: "Snapshot year & gaps",
    items: [
      "WDI values use the selected comparison year, stepping back up to ~14 years when a series is missing for that year.",
      "Cells show “Not reported” when no credible aggregate can be computed — never imputed as zero.",
      "Per-cell method notes (median, population-weighted, WLD) appear under Avg country and Global values.",
    ],
  },
] as const;
