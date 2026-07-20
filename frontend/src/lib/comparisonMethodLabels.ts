/** Human-readable labels for dashboard comparison aggregation codes (backend `avgMethod` / `globalMethod`). */
const METHOD_LABELS: Record<string, string> = {
  median_economies: "Median across economies",
  median_economies_wdi: "Median across WDI reporting economies",
  wld_wdi: "World Bank WLD (WDI)",
  sum_economies_wdi: "Sum across WDI reporting economies",
  sum_economies_rest: "Sum across REST Countries areas",
  mean_unweighted: "Mean across reporting economies",
  pop_weighted_mean: "Population-weighted mean",
  lf_weighted_mean: "Labour-force–weighted mean",
  sum_gdp_over_sum_pop: "Σ GDP ÷ Σ population",
  sum_gdp_ppp_over_sum_pop: "Σ GDP (PPP) ÷ Σ population",
  wld_aggregate: "World Bank WLD aggregate",
  sum_economies: "Sum across economies",
  median_coastal_eez: "Median coastal EEZ",
  sum_coastal_eez: "Sum coastal EEZ",
  median_national_counts: "Median national count",
  wld_or_sum_derived: "WLD derived or sum of national counts",
  weighted_countries: "Cross-country weighted aggregate",
  none: "Not available",
};

export function comparisonMethodLabel(code: string | undefined): string | undefined {
  if (!code || code === "none") return undefined;
  return METHOD_LABELS[code] ?? code.replace(/_/g, " ");
}
