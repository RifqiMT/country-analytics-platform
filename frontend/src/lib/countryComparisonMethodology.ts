/** Anchor id: `/sources#country-comparison-methodology` */
export const COUNTRY_COMPARISON_METHODOLOGY_ID = "country-comparison-methodology";

export const COUNTRY_COMPARISON_METHODOLOGY_PATH = `/sources#${COUNTRY_COMPARISON_METHODOLOGY_ID}`;

export const COUNTRY_COMPARISON_METHODOLOGY_SECTIONS = [
  {
    title: "Avg country column",
    items: [
      "Uses REST sovereign countries only — WDI “all” rows for WLD and regions are excluded.",
      "GDP levels: median across economies at the snapshot year.",
      "GDP per capita: Σ GDP ÷ Σ population at the snapshot year.",
      "GNI per capita (Atlas): median economy at the snapshot year.",
      "Inflation, lending, poverty, and unemployment (%): population- or labour-force–weighted mean.",
      "Labour force: median national level.",
      "Unemployed (count): median national count.",
    ],
  },
  {
    title: "Global column",
    items: [
      "Prefers WLD (world aggregate) at the same snapshot year when World Bank publishes it.",
      "Otherwise uses the sum of countries for level totals, or the same weighted / implied aggregate as the avg column.",
      "Unemployed (number): WLD unemployment rate × WLD labour force at the snapshot year when possible; else sum of national counts.",
    ],
  },
  {
    title: "Snapshot year & gaps",
    items: [
      "WDI values use the selected comparison year, stepping back up to ~14 years when a series is missing for that year.",
      "EEZ area is not connected to a live data feed yet — see metric cards for current status.",
    ],
  },
] as const;
