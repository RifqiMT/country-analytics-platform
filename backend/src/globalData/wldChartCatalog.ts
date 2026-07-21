/**
 * Server-side catalog of Global Analytics → Charts groups.
 * Keep in sync with frontend `wldCharts/catalog.ts` (metricIds + group ids).
 * Mirrors Country Dashboard line charts; FX exchange-rate is country-only and omitted.
 */
export type WldChartGroupId = "financial" | "health" | "education" | "crime" | "labour";

type WldChartDef = {
  id: string;
  title: string;
  summary: string;
  metricIds: readonly string[];
};

type WldChartGroupDef = {
  id: WldChartGroupId;
  title: string;
  description: string;
  charts: readonly WldChartDef[];
};

export const WLD_CHART_GROUPS: readonly WldChartGroupDef[] = [
  {
    id: "financial",
    title: "Financial metrics",
    description:
      "World aggregate (WLD) GDP, debt, per-capita income, population, and macro / poverty rates — same charts as the country dashboard Financial section.",
    charts: [
      {
        id: "gdp-debt",
        title: "GDP & government debt (US$)",
        summary: "World nominal and PPP GDP plus government debt in US dollars.",
        metricIds: ["gdp", "gdp_ppp", "gov_debt_usd"],
      },
      {
        id: "gdp-pc-pop",
        title: "GDP / GNI per capita & population",
        summary: "Per-capita income (nominal & PPP) with total population on a second axis.",
        metricIds: ["gdp_per_capita", "gdp_per_capita_ppp", "gni_per_capita_atlas", "population"],
      },
      {
        id: "macro-poverty",
        title: "Macro, poverty & rates",
        summary: "Inflation, unemployment, poverty, debt-to-GDP, and lending rate.",
        metricIds: [
          "inflation",
          "gov_debt_pct_gdp",
          "lending_rate",
          "unemployment_ilo",
          "poverty_headcount",
          "poverty_national",
        ],
      },
    ],
  },
  {
    id: "health",
    title: "Health & demographics",
    description:
      "Mortality, life expectancy, health systems, coverage, and age structure — same charts as the country dashboard Health section.",
    charts: [
      {
        id: "mortality",
        title: "Mortality (maternal & under-five)",
        summary:
          "Maternal mortality (per 100k births, left) vs under-five mortality (per 1,000, right).",
        metricIds: ["maternal_mortality", "mortality_under5"],
      },
      {
        id: "life-undernourish",
        title: "Life expectancy & undernourishment",
        summary: "Life expectancy in years vs undernourishment prevalence (%).",
        metricIds: ["life_expectancy", "undernourishment"],
      },
      {
        id: "systems",
        title: "Health systems capacity",
        summary: "Hospital beds, physicians, and nurses/midwives density.",
        metricIds: ["hospital_beds", "physicians_density", "nurses_midwives_density"],
      },
      {
        id: "coverage",
        title: "Coverage, prevention & risk factors",
        summary:
          "Shares / index (left) vs birth rate and TB incidence (right) — different units and scales.",
        metricIds: [
          "uhc_service_coverage",
          "immunization_dpt",
          "immunization_measles",
          "health_expenditure_gdp",
          "smoking_prevalence",
          "birth_rate",
          "tb_incidence",
        ],
      },
      {
        id: "age-structure",
        title: "Age structure shares (%)",
        summary: "Working-age, youth, and older population as shares of total.",
        metricIds: ["pop_age_0_14", "pop_15_64_pct", "pop_age_65_plus"],
      },
    ],
  },
  {
    id: "education",
    title: "Education",
    description:
      "Out-of-school, completion, enrollment headcounts and gross ratios — same charts as the country dashboard Education section.",
    charts: [
      {
        id: "oosc-completion",
        title: "Out-of-school & completion",
        summary: "Out-of-school rates (left) vs completion rates (right) — often different magnitudes.",
        metricIds: [
          "oosc_primary",
          "oosc_secondary",
          "oosc_tertiary",
          "school_primary_completion",
          "completion_secondary",
          "completion_tertiary",
        ],
      },
      {
        id: "enrollment",
        title: "Enrollment & gross ratios",
        summary: "Enrollment headcounts and gross enrollment ratios by level.",
        metricIds: [
          "enrollment_primary_count",
          "enrollment_secondary_count",
          "enrollment_tertiary_count",
          "enrollment_primary_pct",
          "enrollment_secondary",
          "enrollment_tertiary_pct",
        ],
      },
    ],
  },
  {
    id: "crime",
    title: "Crime & public safety",
    description:
      "Homicide, GBV & conflict harm, and WGI governance — same charts as the country dashboard Crime section.",
    charts: [
      {
        id: "homicide",
        title: "Intentional homicide rates (UNODC)",
        summary: "Total, female, and male homicide rates per 100,000 population.",
        metricIds: ["homicide_rate", "homicide_rate_female", "homicide_rate_male"],
      },
      {
        id: "gbv-conflict",
        title: "Gender-based violence & conflict harm",
        summary: "GBV prevalence with IDP conflict displacement and battle-related deaths.",
        metricIds: ["gbv_women_pct", "idp_conflict_violence", "battle_related_deaths"],
      },
      {
        id: "governance",
        title: "Governance & rule of law (WGI)",
        summary: "Worldwide Governance Indicators: rule of law, political stability, control of corruption.",
        metricIds: ["rule_of_law_wgi", "political_stability_wgi", "corruption_control_wgi"],
      },
    ],
  },
  {
    id: "labour",
    title: "Labour market",
    description:
      "Derived unemployed count versus labour force — same chart and formula as the country dashboard Labour section.",
    charts: [
      {
        id: "labour-force",
        title: "Unemployment & labour force",
        summary:
          "Unemployed count = (ILO unemployment % ÷ 100) × labour force; labour force on the right axis.",
        metricIds: ["unemployment_ilo", "labor_force_total"],
      },
    ],
  },
] as const;

export function metricIdsForWldChartGroup(groupId: WldChartGroupId): string[] {
  const g = WLD_CHART_GROUPS.find((x) => x.id === groupId);
  if (!g) return [];
  return [...new Set(g.charts.flatMap((c) => [...c.metricIds]))];
}
