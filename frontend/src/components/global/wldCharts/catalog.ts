/**
 * Global Analytics → Charts catalog.
 * Mirrors Country Dashboard line charts (same metric sets, axes, and derived logics).
 * FX exchange-rate chart is country-only and intentionally omitted.
 */
type WldChartGroupId = "financial" | "health" | "education" | "crime" | "labour";

export type WldLineSpec = {
  key: string;
  color: string;
  /** When set, plot on the right Y axis. */
  yAxisId?: "left" | "right";
};

export type WldChartDef = {
  id: string;
  title: string;
  summary: string;
  /** Metric ids fetched for this chart (labour also uses these for derived series). */
  metricIds: readonly string[];
  /** Keys passed to mergeSeriesForLineChart / table columns. */
  valueKeys: readonly string[];
  lines: readonly WldLineSpec[];
  /** Special builder: labour derives unemployed from unemployment_ilo × labor_force_total. */
  kind?: "lines" | "labour";
  dualAxis?: boolean;
};

export type WldChartGroupDef = {
  id: WldChartGroupId;
  title: string;
  description: string;
  charts: readonly WldChartDef[];
};

/** Percent / rate series for tooltip + table formatting (aligned with Dashboard tooltipFormat). */
export const WLD_PERCENT_KEYS = new Set([
  "gov_debt_pct_gdp",
  "poverty_headcount",
  "poverty_national",
  "inflation",
  "unemployment_ilo",
  "lending_rate",
  "undernourishment",
  "enrollment_primary_pct",
  "enrollment_secondary",
  "enrollment_tertiary_pct",
  "pop_15_64_pct",
  "pop_age_0_14",
  "pop_age_65_plus",
  "immunization_dpt",
  "immunization_measles",
  "health_expenditure_gdp",
  "smoking_prevalence",
  "oosc_primary",
  "oosc_secondary",
  "oosc_tertiary",
  "school_primary_completion",
  "completion_secondary",
  "completion_tertiary",
  "gbv_women_pct",
]);

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
        valueKeys: ["gdp", "gdp_ppp", "gov_debt_usd"],
        lines: [
          { key: "gdp", color: "#991b1b" },
          { key: "gdp_ppp", color: "#92400e" },
          { key: "gov_debt_usd", color: "#b91c1c" },
        ],
      },
      {
        id: "gdp-pc-pop",
        title: "GDP / GNI per capita & population",
        summary: "Per-capita income (nominal & PPP) with total population on a second axis.",
        metricIds: ["gdp_per_capita", "gdp_per_capita_ppp", "gni_per_capita_atlas", "population"],
        valueKeys: ["gdp_per_capita", "gdp_per_capita_ppp", "gni_per_capita_atlas", "population"],
        dualAxis: true,
        lines: [
          { key: "gdp_per_capita", color: "#ea580c", yAxisId: "left" },
          { key: "gdp_per_capita_ppp", color: "#ca8a04", yAxisId: "left" },
          { key: "gni_per_capita_atlas", color: "#0d9488", yAxisId: "left" },
          { key: "population", color: "#0f172a", yAxisId: "right" },
        ],
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
        valueKeys: [
          "inflation",
          "gov_debt_pct_gdp",
          "lending_rate",
          "unemployment_ilo",
          "poverty_headcount",
          "poverty_national",
        ],
        lines: [
          { key: "inflation", color: "#ea580c" },
          { key: "gov_debt_pct_gdp", color: "#78350f" },
          { key: "lending_rate", color: "#2563eb" },
          { key: "unemployment_ilo", color: "#16a34a" },
          { key: "poverty_headcount", color: "#dc2626" },
          { key: "poverty_national", color: "#7f1d1d" },
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
        valueKeys: ["maternal_mortality", "mortality_under5"],
        dualAxis: true,
        lines: [
          { key: "maternal_mortality", color: "#dc2626", yAxisId: "left" },
          { key: "mortality_under5", color: "#ea580c", yAxisId: "right" },
        ],
      },
      {
        id: "life-undernourish",
        title: "Life expectancy & undernourishment",
        summary: "Life expectancy in years vs undernourishment prevalence (%).",
        metricIds: ["life_expectancy", "undernourishment"],
        valueKeys: ["life_expectancy", "undernourishment"],
        dualAxis: true,
        lines: [
          { key: "life_expectancy", color: "#0f766e", yAxisId: "left" },
          { key: "undernourishment", color: "#22c55e", yAxisId: "right" },
        ],
      },
      {
        id: "systems",
        title: "Health systems capacity",
        summary: "Hospital beds, physicians, and nurses/midwives density.",
        metricIds: ["hospital_beds", "physicians_density", "nurses_midwives_density"],
        valueKeys: ["hospital_beds", "physicians_density", "nurses_midwives_density"],
        lines: [
          { key: "hospital_beds", color: "#2563eb" },
          { key: "physicians_density", color: "#059669" },
          { key: "nurses_midwives_density", color: "#7c3aed" },
        ],
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
        valueKeys: [
          "uhc_service_coverage",
          "immunization_dpt",
          "immunization_measles",
          "health_expenditure_gdp",
          "smoking_prevalence",
          "birth_rate",
          "tb_incidence",
        ],
        dualAxis: true,
        lines: [
          { key: "uhc_service_coverage", color: "#0f766e", yAxisId: "left" },
          { key: "immunization_dpt", color: "#16a34a", yAxisId: "left" },
          { key: "immunization_measles", color: "#22c55e", yAxisId: "left" },
          { key: "health_expenditure_gdp", color: "#ea580c", yAxisId: "left" },
          { key: "smoking_prevalence", color: "#b91c1c", yAxisId: "left" },
          { key: "birth_rate", color: "#1d4ed8", yAxisId: "right" },
          { key: "tb_incidence", color: "#7c2d12", yAxisId: "right" },
        ],
      },
      {
        id: "age-structure",
        title: "Age structure shares (%)",
        summary: "Working-age, youth, and older population as shares of total.",
        metricIds: ["pop_age_0_14", "pop_15_64_pct", "pop_age_65_plus"],
        valueKeys: ["pop_age_0_14", "pop_15_64_pct", "pop_age_65_plus"],
        lines: [
          { key: "pop_age_0_14", color: "#dc2626" },
          { key: "pop_15_64_pct", color: "#2563eb" },
          { key: "pop_age_65_plus", color: "#ea580c" },
        ],
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
        valueKeys: [
          "oosc_primary",
          "oosc_secondary",
          "oosc_tertiary",
          "school_primary_completion",
          "completion_secondary",
          "completion_tertiary",
        ],
        dualAxis: true,
        lines: [
          { key: "oosc_primary", color: "#be123c", yAxisId: "left" },
          { key: "oosc_secondary", color: "#e11d48", yAxisId: "left" },
          { key: "oosc_tertiary", color: "#fb7185", yAxisId: "left" },
          { key: "school_primary_completion", color: "#15803d", yAxisId: "right" },
          { key: "completion_secondary", color: "#16a34a", yAxisId: "right" },
          { key: "completion_tertiary", color: "#4ade80", yAxisId: "right" },
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
        valueKeys: [
          "enrollment_primary_count",
          "enrollment_secondary_count",
          "enrollment_tertiary_count",
          "enrollment_primary_pct",
          "enrollment_secondary",
          "enrollment_tertiary_pct",
        ],
        dualAxis: true,
        lines: [
          { key: "enrollment_primary_count", color: "#0d9488", yAxisId: "left" },
          { key: "enrollment_secondary_count", color: "#b45309", yAxisId: "left" },
          { key: "enrollment_tertiary_count", color: "#1d4ed8", yAxisId: "left" },
          { key: "enrollment_primary_pct", color: "#115e59", yAxisId: "right" },
          { key: "enrollment_secondary", color: "#92400e", yAxisId: "right" },
          { key: "enrollment_tertiary_pct", color: "#4338ca", yAxisId: "right" },
        ],
      },
    ],
  },
  {
    id: "crime",
    title: "Crime & public safety",
    description:
      "Homicide, GBV & conflict harm, and WGI governance — same charts as the country dashboard Crime section (world pop-weighted aggregates / sums).",
    charts: [
      {
        id: "homicide",
        title: "Intentional homicide rates (UNODC)",
        summary: "Total, female, and male homicide rates per 100,000 population.",
        metricIds: ["homicide_rate", "homicide_rate_female", "homicide_rate_male"],
        valueKeys: ["homicide_rate", "homicide_rate_female", "homicide_rate_male"],
        lines: [
          { key: "homicide_rate", color: "#b91c1c" },
          { key: "homicide_rate_female", color: "#db2777" },
          { key: "homicide_rate_male", color: "#1d4ed8" },
        ],
      },
      {
        id: "gbv-conflict",
        title: "Gender-based violence & conflict harm",
        summary: "GBV prevalence with IDP conflict displacement and battle-related deaths.",
        metricIds: ["gbv_women_pct", "idp_conflict_violence", "battle_related_deaths"],
        valueKeys: ["gbv_women_pct", "idp_conflict_violence", "battle_related_deaths"],
        dualAxis: true,
        lines: [
          { key: "gbv_women_pct", color: "#be185d", yAxisId: "left" },
          { key: "idp_conflict_violence", color: "#ea580c", yAxisId: "right" },
          { key: "battle_related_deaths", color: "#7c2d12", yAxisId: "right" },
        ],
      },
      {
        id: "governance",
        title: "Governance & rule of law (WGI)",
        summary: "Worldwide Governance Indicators: rule of law, political stability, control of corruption.",
        metricIds: ["rule_of_law_wgi", "political_stability_wgi", "corruption_control_wgi"],
        valueKeys: ["rule_of_law_wgi", "political_stability_wgi", "corruption_control_wgi"],
        lines: [
          { key: "rule_of_law_wgi", color: "#0f766e" },
          { key: "political_stability_wgi", color: "#2563eb" },
          { key: "corruption_control_wgi", color: "#7c3aed" },
        ],
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
        valueKeys: ["unemployed", "labour"],
        kind: "labour",
        dualAxis: true,
        lines: [
          { key: "unemployed", color: "#dc2626", yAxisId: "left" },
          { key: "labour", color: "#38bdf8", yAxisId: "right" },
        ],
      },
    ],
  },
] as const;
