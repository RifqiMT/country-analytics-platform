import { formatCompactNumber } from "./formatValue";

const PCT_METRICS = new Set([
  "inflation",
  "unemployment_ilo",
  "poverty_headcount",
  "poverty_national",
  "lending_rate",
  "interest_real",
  "gov_debt_pct_gdp",
  "immunization_dpt",
  "immunization_measles",
  "health_expenditure_gdp",
  "smoking_prevalence",
  "gbv_women_pct",
  "gdp_growth",
  "labour_force_participation",
  "pop_age_0_14",
  "pop_age_65_plus",
  "pop_15_64_pct",
  "edu_expenditure_gdp",
  "enrollment_primary_pct",
  "enrollment_secondary",
  "enrollment_tertiary_pct",
  "school_primary_completion",
  "completion_secondary",
  "completion_tertiary",
  "reading_proficiency",
  "literacy_adult",
  "oosc_primary",
  "oosc_secondary",
  "oosc_tertiary",
  "trained_teachers_pri",
  "trained_teachers_sec",
  "trained_teachers_ter",
  "undernourishment",
]);

const RATE_PER_100K = new Set([
  "homicide_rate",
  "homicide_rate_female",
  "homicide_rate_male",
  "maternal_mortality",
  "tb_incidence",
]);

const WGI_METRICS = new Set(["rule_of_law_wgi", "political_stability_wgi", "corruption_control_wgi"]);

const YEARS_METRICS = new Set(["life_expectancy"]);

export function preferBpsForMetric(id: string): boolean {
  return [
    "inflation",
    "unemployment_ilo",
    "lending_rate",
    "interest_real",
    "poverty_headcount",
    "poverty_national",
    "immunization_dpt",
    "immunization_measles",
    "health_expenditure_gdp",
    "smoking_prevalence",
    "gbv_women_pct",
    "gov_debt_pct_gdp",
    "undernourishment",
  ].includes(id);
}

export function formatCompareMetricValue(id: string, v: number, unit?: string): string {
  if (WGI_METRICS.has(id)) return v.toFixed(2);
  if (YEARS_METRICS.has(id)) return `${v.toFixed(1)} yrs`;
  if (RATE_PER_100K.has(id)) return `${v.toFixed(1)} per 100k`;
  if (PCT_METRICS.has(id) || unit === "%" || unit === "% of GDP") return `${v.toFixed(1)}%`;
  if (id === "teachers_primary") return `${v.toFixed(1)} : 1`;
  return formatCompactNumber(v, { maxFrac: 2 });
}

/** Metrics where a lower value is generally preferable (e.g. inflation, mortality). */
const LOWER_IS_BETTER = new Set([
  "inflation",
  "unemployment_ilo",
  "poverty_headcount",
  "poverty_national",
  "lending_rate",
  "interest_real",
  "gov_debt_pct_gdp",
  "mortality_under5",
  "maternal_mortality",
  "tb_incidence",
  "homicide_rate",
  "homicide_rate_female",
  "homicide_rate_male",
  "undernourishment",
  "oosc_primary",
  "oosc_secondary",
  "oosc_tertiary",
  "gbv_women_pct",
  "smoking_prevalence",
  "idmc_displaced",
  "conflict_fatalities",
  "battle_deaths",
]);

/** Metrics where a higher value is generally preferable. */
const HIGHER_IS_BETTER = new Set([
  "gdp_per_capita",
  "gdp_per_capita_ppp",
  "gni_per_capita",
  "life_expectancy",
  "literacy_adult",
  "enrollment_primary_pct",
  "enrollment_secondary",
  "enrollment_tertiary_pct",
  "school_primary_completion",
  "completion_secondary",
  "completion_tertiary",
  "reading_proficiency",
  "immunization_dpt",
  "immunization_measles",
  "health_expenditure_gdp",
  "hospital_beds",
  "physicians_density",
  "labour_force_participation",
  "gdp_growth",
  "edu_expenditure_gdp",
  "trained_teachers_pri",
  "trained_teachers_sec",
  "trained_teachers_ter",
  "rule_of_law_wgi",
  "political_stability_wgi",
  "corruption_control_wgi",
  "voice_accountability_wgi",
  "gov_effectiveness_wgi",
  "regulatory_quality_wgi",
]);

type ComparePreference = "higher" | "lower" | "neutral";

function comparePreference(metricId: string): ComparePreference {
  if (LOWER_IS_BETTER.has(metricId)) return "lower";
  if (HIGHER_IS_BETTER.has(metricId) || WGI_METRICS.has(metricId)) return "higher";
  return "neutral";
}

/** Whether country A is ahead on this indicator, accounting for higher/lower-is-better semantics. */
export function countryAIsAhead(metricId: string, delta: number): boolean | null {
  if (delta === 0) return null;
  const pref = comparePreference(metricId);
  if (pref === "higher") return delta > 0;
  if (pref === "lower") return delta < 0;
  return null;
}

function absDeltaMagnitude(metricId: string, delta: number): string {
  const abs = Math.abs(delta);
  if (WGI_METRICS.has(metricId)) {
    const n = abs.toFixed(2);
    return n === "1.00" ? "1 index point" : `${n} index points`;
  }
  if (PCT_METRICS.has(metricId)) {
    const n = abs.toFixed(1);
    return n === "1.0" ? "1 percentage point" : `${n} percentage points`;
  }
  if (RATE_PER_100K.has(metricId)) {
    const n = abs.toFixed(1);
    return n === "1.0" ? "1 case per 100,000 people" : `${n} cases per 100,000 people`;
  }
  if (YEARS_METRICS.has(metricId)) {
    const n = abs.toFixed(1);
    return n === "1.0" ? "1 year" : `${n} years`;
  }
  if (metricId === "teachers_primary") {
    const n = abs.toFixed(1);
    return n === "1.0" ? "1 pupil per teacher" : `${n} pupils per teacher`;
  }
  const formatted = formatCompactNumber(abs, { maxFrac: 2 });
  return formatted;
}

function relativeChangePhrase(deltaPct: number, nameB: string): string {
  const pct = Math.abs(deltaPct).toFixed(1);
  if (deltaPct > 0) return `That is ${pct}% more than ${nameB}'s value.`;
  if (deltaPct < 0) return `That is ${pct}% less than ${nameB}'s value.`;
  return `That matches ${nameB}'s value.`;
}

export type CompareDeltaDescription = {
  /** Primary plain-English sentence comparing A to B. */
  primary: string;
  /** Optional second sentence with relative (% ) change. */
  secondary?: string;
  /** Country A is ahead, B is ahead, tied, or no directional judgment. */
  ahead: "a" | "b" | "tied" | null;
};

export function describeCompareDelta(opts: {
  metricId: string;
  delta: number;
  deltaPct: number | null;
  nameA: string;
  nameB: string;
}): CompareDeltaDescription {
  const { metricId, delta, deltaPct, nameA, nameB } = opts;

  if (delta === 0) {
    return {
      primary: `${nameA} and ${nameB} report the same value for this indicator.`,
      ahead: "tied",
    };
  }

  const direction = delta > 0 ? "higher" : "lower";
  const magnitude = absDeltaMagnitude(metricId, delta);
  const primary = `${nameA} is ${magnitude} ${direction} than ${nameB}.`;

  let secondary: string | undefined;
  if (deltaPct != null && Number.isFinite(deltaPct) && Math.abs(deltaPct) >= 0.05) {
    secondary = relativeChangePhrase(deltaPct, nameB);
  }

  const aheadVal = countryAIsAhead(metricId, delta);
  let ahead: CompareDeltaDescription["ahead"] = null;
  if (aheadVal === true) ahead = "a";
  else if (aheadVal === false) ahead = "b";

  return { primary, secondary, ahead };
}

/** Compact one-line comparison for tables and lists. */
export function describeCompareDeltaCompact(opts: {
  metricId: string;
  delta: number;
  deltaPct: number | null;
  nameA: string;
  nameB: string;
}): string {
  const d = describeCompareDelta(opts);
  const parts = [d.primary.replace(/\.$/, "")];
  if (d.secondary) parts.push(d.secondary.replace(/\.$/, ""));
  return `${parts.join("; ")}.`;
}
