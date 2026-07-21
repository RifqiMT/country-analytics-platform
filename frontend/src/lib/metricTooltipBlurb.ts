/**
 * One-line plain-English summary for map tooltips.
 * Prefers curated copy; falls back to the first sentence of the catalog description.
 */
const MAP_METRIC_BLURBS: Record<string, string> = {
  gdp: "Total value of goods and services the country produces, in US dollars.",
  gdp_ppp: "Economic output adjusted for local price levels.",
  gdp_per_capita: "Average economic output per person.",
  gdp_per_capita_ppp: "Average output per person, adjusted for local prices.",
  gni_per_capita_atlas: "Average income per person, including earnings from abroad.",
  gdp_growth: "How fast the economy grew or shrank over the year.",
  population: "Total number of people living in the country.",
  life_expectancy: "Average years a newborn is expected to live.",
  mortality_under5: "Share of children who die before age five.",
  homicide_rate: "Murders per 100,000 people each year.",
  gov_debt_pct_gdp: "Government debt as a share of the economy.",
  inflation: "How fast everyday consumer prices are rising.",
  unemployment_ilo: "Share of the workforce looking for a job.",
  poverty_headcount: "Share of people living below the national poverty line.",
  lending_rate: "Typical interest rate banks charge on loans.",
  interest_real: "Interest rate after accounting for inflation.",
  health_expenditure_gdp: "Health spending as a share of the economy.",
  rule_of_law_wgi: "How reliably laws are applied and enforced.",
  political_stability_wgi: "Likelihood of government instability or violence.",
};

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  return (match?.[0] ?? trimmed).trim();
}

function tightenSentence(sentence: string, maxLen = 108): string {
  let s = sentence.replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s.endsWith(".") ? s : `${s}.`;

  const comma = s.lastIndexOf(",", maxLen - 1);
  if (comma > 52) {
    s = `${s.slice(0, comma).trim()}.`;
    return s;
  }

  return `${s.slice(0, maxLen - 1).replace(/\s+\S*$/, "")}…`;
}

export function metricTooltipBlurb(metricId: string, description: string): string {
  const curated = MAP_METRIC_BLURBS[metricId];
  if (curated) return curated;
  const first = firstSentence(description);
  if (!first) return "";
  return tightenSentence(first);
}
