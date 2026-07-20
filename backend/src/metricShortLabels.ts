/**
 * Canonical short labels for UI (charts, map, tables, cards).
 * Full definitions stay in metrics.ts (`label`); use these everywhere a compact name is shown.
 * Style: sentence case, `GDP / capita`, `Gov.`, `Pop.`, en dashes in ranges (0–14).
 */

const SHORT: Record<string, string> = {
  // Financial
  gdp: "GDP (nominal)",
  gdp_ppp: "GDP (PPP)",
  gdp_per_capita: "GDP / capita (nominal)",
  gdp_per_capita_ppp: "GDP / capita (PPP)",
  gni_per_capita_atlas: "GNI / capita (Atlas, US$)",
  gdp_growth: "GDP growth (%)",
  gov_debt_usd: "Gov. debt (USD)",
  gov_debt_pct_gdp: "Gov. debt (% GDP)",
  inflation: "Inflation (CPI %)",
  interest_real: "Real interest rate (%)",
  lending_rate: "Lending rate (%)",
  unemployment_ilo: "Unemployment (%)",
  poverty_headcount: "Poverty headcount ($2.15, %)",
  poverty_national: "Poverty (national line, %)",

  // Demographics & labour
  population: "Population",
  pop_age_0_14: "Pop. ages 0–14 (%)",
  pop_15_64_pct: "Pop. ages 15–64 (%)",
  pop_age_65_plus: "Pop. ages 65+ (%)",
  labour_force_participation: "Labour force participation (%)",
  labor_force_total: "Labour force (total)",

  // Health
  life_expectancy: "Life expectancy",
  mortality_under5: "Under-5 mortality",
  maternal_mortality: "Maternal mortality",
  undernourishment: "Undernourishment (%)",
  birth_rate: "Birth rate (per 1,000)",
  tb_incidence: "TB incidence (per 100k)",
  uhc_service_coverage: "UHC service coverage index",
  hospital_beds: "Hospital beds (per 1,000)",
  physicians_density: "Physicians (per 1,000)",
  nurses_midwives_density: "Nurses & midwives (per 1,000)",
  immunization_dpt: "DPT immunization (%)",
  immunization_measles: "Measles immunization (%)",
  health_expenditure_gdp: "Health expenditure (% GDP)",
  smoking_prevalence: "Smoking prevalence (%)",

  // Education
  literacy_adult: "Adult literacy (%)",
  school_primary_completion: "Primary completion (%)",
  enrollment_secondary: "Secondary enrollment (%)",
  enrollment_primary_pct: "Primary enrollment (%)",
  enrollment_tertiary_pct: "Tertiary enrollment (%)",
  enrollment_primary_count: "Primary enrollment (count)",
  enrollment_secondary_count: "Secondary enrollment (count)",
  enrollment_tertiary_count: "Tertiary enrollment (count)",
  teachers_primary: "Pupil–teacher ratio (primary)",
  teachers_primary_count: "Teachers, primary (count)",
  teachers_secondary_count: "Teachers, secondary (count)",
  teachers_tertiary_count: "Teachers, tertiary (count)",
  oosc_primary: "Out-of-school (primary, %)",
  oosc_secondary: "Out-of-school (secondary, %)",
  oosc_tertiary: "Out-of-school (tertiary, %)",
  completion_secondary: "Secondary completion (%)",
  completion_tertiary: "Tertiary completion (%)",
  reading_proficiency: "Learning poverty, reading (%)",
  gpi_primary: "GPI, primary",
  gpi_secondary: "GPI, secondary",
  gpi_tertiary: "GPI, tertiary",
  trained_teachers_pri: "Trained teachers, primary (%)",
  trained_teachers_sec: "Trained teachers, secondary (%)",
  trained_teachers_ter: "Trained teachers, tertiary (%)",
  edu_expenditure_gdp: "Education expenditure (% GDP)",

  // Crime & public safety
  homicide_rate: "Homicide rate (per 100k)",
  homicide_rate_female: "Homicide rate, female (per 100k)",
  homicide_rate_male: "Homicide rate, male (per 100k)",
  gbv_women_pct: "Intimate-partner violence, women (%)",
  idp_conflict_violence: "IDP displacement, conflict (cases)",
  battle_related_deaths: "Battle-related deaths",
  rule_of_law_wgi: "Rule of law (WGI)",
  political_stability_wgi: "Political stability (WGI)",
  corruption_control_wgi: "Control of corruption (WGI)",

  // Geography / derived (not always in METRICS)
  land_area: "Land area (km²)",
  total_area: "Total area (km²)",
  eez: "EEZ (km²)",
  unemployed_number: "Unemployed (number)",
  unemployed: "Unemployed (number)",
  labour: "Labour force (total)",
};

function titleCaseFromId(id: string): string {
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function getMetricShortLabel(id: string): string {
  return SHORT[id] ?? titleCaseFromId(id);
}
