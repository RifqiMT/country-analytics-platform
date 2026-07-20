import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CollapsibleToolbar from "../components/layout/CollapsibleToolbar";
import FilterToolbarLayout, {
  CompareCountrySelectRow,
  CompareCountrySelectSlot,
  CompareSwapButton,
  FilterToolbarActions,
  FilterToolbarPrimaryAction,
  FilterToolbarRangeGroup,
  FilterToolbarSecondaryAction,
  FilterToolbarYearInputs,
  TOOLBAR_COUNTRY_SELECT_CLASS,
} from "../components/layout/FilterToolbarLayout";
import CountrySelect from "../components/CountrySelect";
import AccordionSection from "../components/dashboard/AccordionSection";
import DashboardLoadingState from "../components/dashboard/DashboardLoadingState";
import DashboardSectionNav, { type DashboardNavItem } from "../components/dashboard/DashboardSectionNav";
import YearRangePresetDropdown, {
  type YearPresetKind,
} from "../components/dashboard/YearRangePresetDropdown";
import CompareHero, { type CompareHeroKpi } from "../components/compare/CompareHero";
import CompareSummaryBar from "../components/compare/CompareSummaryBar";
import CompareMetricRow from "../components/compare/CompareMetricRow";
import CompareDualLineChart from "../components/compare/CompareDualLineChart";
import CompareOverviewSection from "../components/compare/CompareOverviewSection";
import CompareChartLegend from "../components/compare/CompareChartLegend";
import { ComparePairHeader } from "../components/compare/ComparePairField";
import CountryPairTable, {
  buildPairComparisonRows,
} from "../components/compare/CountryPairTable";
import { VisualizationStepperFromChildren } from "../components/charts/VisualizationStepper";
import { getJson, postJson, type CountrySummary, type MetricDef, type SeriesPoint } from "../api";
import { writeStoredCompareCountries, readStoredCompareCountryA, readStoredCompareCountryB } from "../lib/compareCountryStorage";
import { fetchCountrySeriesBatched, latestAtOrBefore, yoyAtSnapshot, yoyBpsAtSnapshot } from "../lib/countrySeriesFetch";
import { downloadCsv } from "../lib/csv";
import { metricDisplayLabelFromId } from "../lib/metricDisplay";
import { formatYoY } from "../lib/formatValue";
import { formatCompareMetricValue, preferBpsForMetric } from "../lib/compareMetricFormat";
import {
  MIN_DATA_YEAR,
  clampSpanEnd,
  clampSpanStart,
  maxSelectableYear,
} from "../lib/yearBounds";

const COMPARE_SECTION_IDS = {
  overview: "compare-overview",
  table: "compare-table",
  financial: "compare-financial",
  health: "compare-health",
  education: "compare-education",
  labour: "compare-labour",
  demographics: "compare-demographics",
  crime: "compare-crime",
} as const;

const CATEGORY_ORDER = ["financial", "health", "education", "labour", "demographics", "crime"] as const;

const CATEGORY_META: Record<
  string,
  { title: string; subtitle: string; accent: "rose" | "teal" | "amber" | "slate" | "indigo" }
> = {
  financial: {
    title: "Financial metrics",
    subtitle: "GDP, debt, inflation, poverty & rates",
    accent: "rose",
  },
  health: {
    title: "Health & demographics",
    subtitle: "Population, mortality, systems & coverage",
    accent: "teal",
  },
  education: {
    title: "Education",
    subtitle: "Enrollment, completion, literacy & investment",
    accent: "amber",
  },
  labour: {
    title: "Labour market",
    subtitle: "Unemployment & labour force",
    accent: "slate",
  },
  demographics: {
    title: "Demographics",
    subtitle: "Population structure & age shares",
    accent: "indigo",
  },
  crime: {
    title: "Crime & public safety",
    subtitle: "UNODC, IDMC, UCDP & governance",
    accent: "indigo",
  },
};

/** Headline metrics charted individually (one chart = one metric = two lines). */
const CHART_METRICS_BY_CATEGORY: Record<string, readonly string[]> = {
  financial: [
    "gdp_per_capita",
    "gdp_per_capita_ppp",
    "inflation",
    "gov_debt_pct_gdp",
    "unemployment_ilo",
    "poverty_headcount",
  ],
  health: [
    "life_expectancy",
    "mortality_under5",
    "hospital_beds",
    "physicians_density",
    "health_expenditure_gdp",
  ],
  education: ["literacy_adult", "enrollment_primary_pct", "school_primary_completion"],
  labour: ["unemployment_ilo", "labour_force_participation", "labor_force_total"],
  demographics: ["population", "pop_age_0_14", "pop_age_65_plus"],
  crime: ["homicide_rate", "rule_of_law_wgi", "political_stability_wgi"],
};

function readParam(searchParams: URLSearchParams, key: string, fallback: string): string {
  const v = searchParams.get(key);
  return v && /^[A-Za-z]{3}$/.test(v) ? v.toUpperCase() : fallback;
}

export default function CountryCompare() {
  const maxYear = maxSelectableYear();
  const [searchParams, setSearchParams] = useSearchParams();

  const [countryA, setCountryA] = useState(() =>
    readParam(searchParams, "a", readStoredCompareCountryA() ?? "IDN")
  );
  const [countryB, setCountryB] = useState(() =>
    readParam(searchParams, "b", readStoredCompareCountryB() ?? "MYS")
  );
  const [start, setStart] = useState(MIN_DATA_YEAR);
  const [end, setEnd] = useState(maxYear);

  const [metaA, setMetaA] = useState<CountrySummary | null>(null);
  const [metaB, setMetaB] = useState<CountrySummary | null>(null);
  const [bundleA, setBundleA] = useState<Record<string, SeriesPoint[]>>({});
  const [bundleB, setBundleB] = useState<Record<string, SeriesPoint[]>>({});
  const [metricCatalog, setMetricCatalog] = useState<MetricDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getJson<MetricDef[]>("/api/metrics").then(setMetricCatalog).catch(console.error);
  }, []);

  useEffect(() => {
    writeStoredCompareCountries(countryA, countryB);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("a", countryA);
        next.set("b", countryB);
        return next;
      },
      { replace: true }
    );
  }, [countryA, countryB, setSearchParams]);

  const lbl = useCallback(
    (id: string) => metricDisplayLabelFromId(id, metricCatalog),
    [metricCatalog]
  );

  const allMetricIds = useMemo(() => metricCatalog.map((m) => m.id), [metricCatalog]);

  const metricsByCategory = useMemo(() => {
    const acc: Record<string, MetricDef[]> = {};
    for (const m of metricCatalog) {
      acc[m.category] = acc[m.category] ?? [];
      acc[m.category].push(m);
    }
    for (const cat of Object.keys(acc)) {
      acc[cat].sort((a, b) => a.label.localeCompare(b.label));
    }
    return acc;
  }, [metricCatalog]);

  const load = useCallback(async () => {
    if (!countryA || !countryB || allMetricIds.length === 0) return;
    if (countryA === countryB) {
      setErr("Please select two different countries.");
      return;
    }
    setLoading(true);
    setProgress(6);
    setErr(null);
    let progA = 0;
    let progB = 0;
    const syncProgress = () => setProgress(Math.round((progA + progB) / 2));

    try {
      const [mA, mB, seriesA, seriesB] = await Promise.all([
        getJson<CountrySummary>(`/api/country/${countryA}`),
        getJson<CountrySummary>(`/api/country/${countryB}`),
        fetchCountrySeriesBatched(countryA, start, end, allMetricIds, (p) => {
          progA = p;
          syncProgress();
        }),
        fetchCountrySeriesBatched(countryB, start, end, allMetricIds, (p) => {
          progB = p;
          syncProgress();
        }),
      ]);
      setMetaA(mA);
      setMetaB(mB);
      setBundleA(seriesA);
      setBundleB(seriesB);
      setProgress(100);
    } catch (e) {
      setErr(String(e));
      setProgress(0);
    } finally {
      setLoading(false);
    }
  }, [countryA, countryB, start, end, allMetricIds, tick]);

  useEffect(() => {
    if (metricCatalog.length > 0) void load();
  }, [load, metricCatalog.length]);

  const refreshAll = async () => {
    await postJson("/api/cache/clear", {});
    setTick((t) => t + 1);
  };

  const setPreset = (kind: YearPresetKind) => {
    const hi = maxSelectableYear();
    if (kind === "full") {
      setStart(MIN_DATA_YEAR);
      setEnd(hi);
    } else if (kind === "current") {
      setStart(hi);
      setEnd(hi);
    } else {
      const span =
        kind === "y2" ? 2 : kind === "y3" ? 3 : kind === "y5" ? 5 : kind === "y8" ? 8 : kind === "y10" ? 10 : kind === "y15" ? 15 : 20;
      setStart(Math.max(MIN_DATA_YEAR, hi - (span - 1)));
      setEnd(hi);
    }
  };

  const comparisonRows = useMemo(() => {
    if (metricCatalog.length === 0) return [];
    return buildPairComparisonRows(
      metricCatalog.map((m) => ({ id: m.id, label: lbl(m.id), category: m.category, unit: m.unit })),
      bundleA,
      bundleB,
      end
    );
  }, [metricCatalog, bundleA, bundleB, end, lbl]);

  const heroKpis = useMemo((): CompareHeroKpi[] => {
    const ids = ["population", "gdp_per_capita", "life_expectancy", "inflation"] as const;
    return ids.map((id) => {
      const ptA = latestAtOrBefore(bundleA[id] ?? [], end);
      const ptB = latestAtOrBefore(bundleB[id] ?? [], end);
      const unit = metricCatalog.find((m) => m.id === id)?.unit ?? "";
      const preferBps = preferBpsForMetric(id);
      return {
        id,
        label: lbl(id),
        valueA: ptA ? formatCompareMetricValue(id, ptA.value, unit) : "—",
        valueB: ptB ? formatCompareMetricValue(id, ptB.value, unit) : "—",
        subA:
          ptA != null
            ? formatYoY(yoyAtSnapshot(bundleA[id] ?? [], end), yoyBpsAtSnapshot(bundleA[id] ?? [], end), preferBps).text
            : undefined,
        subToneA:
          ptA != null
            ? formatYoY(yoyAtSnapshot(bundleA[id] ?? [], end), yoyBpsAtSnapshot(bundleA[id] ?? [], end), preferBps).tone
            : undefined,
        subB:
          ptB != null
            ? formatYoY(yoyAtSnapshot(bundleB[id] ?? [], end), yoyBpsAtSnapshot(bundleB[id] ?? [], end), preferBps).text
            : undefined,
        subToneB:
          ptB != null
            ? formatYoY(yoyAtSnapshot(bundleB[id] ?? [], end), yoyBpsAtSnapshot(bundleB[id] ?? [], end), preferBps).tone
            : undefined,
      };
    });
  }, [bundleA, bundleB, end, lbl, metricCatalog]);

  const swapCountries = () => {
    setCountryA(countryB);
    setCountryB(countryA);
  };

  const sectionNavItems = useMemo((): DashboardNavItem[] => {
    const items: DashboardNavItem[] = [
      { id: COMPARE_SECTION_IDS.overview, label: "Overview" },
      { id: COMPARE_SECTION_IDS.table, label: "All metrics" },
    ];
    for (const cat of CATEGORY_ORDER) {
      if ((metricsByCategory[cat]?.length ?? 0) > 0) {
        items.push({
          id: COMPARE_SECTION_IDS[cat as keyof typeof COMPARE_SECTION_IDS],
          label: CATEGORY_META[cat]?.title.split(" ")[0] ?? cat,
        });
      }
    }
    return items;
  }, [metricsByCategory]);

  const exportComparison = () => {
    const headers = ["metric", "category", countryA, countryB, "delta_a_minus_b", "relative_diff_pct"];
    const rows = comparisonRows.map((r) => [
      r.label,
      r.category,
      r.countryA.value ?? "",
      r.countryB.value ?? "",
      r.delta ?? "",
      r.deltaPct ?? "",
    ]);
    downloadCsv(`${countryA}_vs_${countryB}_compare_${end}.csv`, headers, rows);
  };

  const exportCategoryComparison = (cat: string) => {
    const catRows = comparisonRows.filter((r) => r.category === cat);
    const headers = ["metric", countryA, countryB, "delta_a_minus_b", "relative_diff_pct"];
    const rows = catRows.map((r) => [
      r.label,
      r.countryA.value ?? "",
      r.countryB.value ?? "",
      r.delta ?? "",
      r.deltaPct ?? "",
    ]);
    downloadCsv(`${countryA}_vs_${countryB}_${cat}_${end}.csv`, headers, rows);
  };

  const nameA = metaA?.name ?? countryA;
  const nameB = metaB?.name ?? countryB;

  return (
    <div className="space-y-4">
      <CollapsibleToolbar
        title="Compare controls"
        summary={`${countryA} vs ${countryB} · ${start}–${end}`}
        forceOpen={loading}
        className="border-slate-200/80 shadow-sm"
      >
        <FilterToolbarLayout
          variant="compare"
          countries={
            <CompareCountrySelectRow>
              <CompareCountrySelectSlot>
                <CountrySelect
                  value={countryA}
                  onChange={setCountryA}
                  variant="light"
                  showLabel={false}
                  displayMode="compact"
                  className={TOOLBAR_COUNTRY_SELECT_CLASS}
                />
              </CompareCountrySelectSlot>
              <CompareSwapButton
                onClick={swapCountries}
                disabled={loading}
                title="Swap countries"
                aria-label="Swap Country A and Country B"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </CompareSwapButton>
              <CompareCountrySelectSlot>
                <CountrySelect
                  value={countryB}
                  onChange={setCountryB}
                  variant="light"
                  showLabel={false}
                  displayMode="compact"
                  className={TOOLBAR_COUNTRY_SELECT_CLASS}
                />
              </CompareCountrySelectSlot>
            </CompareCountrySelectRow>
          }
          range={
            <FilterToolbarRangeGroup>
              <FilterToolbarYearInputs
                start={start}
                end={end}
                minStart={MIN_DATA_YEAR}
                maxEnd={maxYear}
                onStartChange={(y) => setStart(clampSpanStart(y, end))}
                onEndChange={(y) => setEnd(clampSpanEnd(y, start))}
                startId="compare-year-from"
                endId="compare-year-to"
              />
              <YearRangePresetDropdown start={start} end={end} maxYear={maxYear} onSelect={setPreset} compact embedded />
            </FilterToolbarRangeGroup>
          }
          actions={
            <FilterToolbarActions>
              <FilterToolbarPrimaryAction
                onClick={() => void refreshAll()}
                disabled={loading}
                title="Clear cache and refresh"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5 9a7 7 0 0114 0M19 15a7 7 0 01-14 0" />
                </svg>
                Refresh
              </FilterToolbarPrimaryAction>
              <FilterToolbarSecondaryAction
                onClick={exportComparison}
                disabled={loading || comparisonRows.length === 0}
                title="Export comparison CSV"
              >
                <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </FilterToolbarSecondaryAction>
            </FilterToolbarActions>
          }
        />
      </CollapsibleToolbar>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {err}
        </div>
      ) : null}

      {loading ? (
        <DashboardLoadingState label="Loading both countries & all metrics…" progress={progress} />
      ) : null}

      {metaA && metaB && !loading ? (
        <>
          <CompareHero
            metaA={metaA}
            metaB={metaB}
            yearStart={start}
            yearEnd={end}
            metricCount={metricCatalog.length}
            kpis={heroKpis}
            onSwap={swapCountries}
          />

          {comparisonRows.length > 0 ? (
            <CompareSummaryBar rows={comparisonRows} nameA={nameA} nameB={nameB} snapshotYear={end} />
          ) : null}

          <DashboardSectionNav items={sectionNavItems} />

          <div className="space-y-3">
            <AccordionSection
              id={COMPARE_SECTION_IDS.overview}
              title="Country overview"
              subtitle="Location, income classification & geography"
              accent="teal"
              defaultOpen
            >
              <CompareOverviewSection metaA={metaA} metaB={metaB} nameA={nameA} nameB={nameB} />
            </AccordionSection>

            <AccordionSection
              id={COMPARE_SECTION_IDS.table}
              title="All metrics comparison"
              subtitle={`Full snapshot table · ${comparisonRows.length} indicators at ${end}`}
              accent="slate"
              defaultOpen={false}
              onDownload={exportComparison}
            >
              <CountryPairTable
                snapshotYear={end}
                countryAName={nameA}
                countryBName={nameB}
                rows={comparisonRows}
                onExport={exportComparison}
              />
            </AccordionSection>

            {CATEGORY_ORDER.map((cat) => {
              const metrics = metricsByCategory[cat];
              if (!metrics?.length) return null;
              const meta = CATEGORY_META[cat];
              const chartMetrics = (CHART_METRICS_BY_CATEGORY[cat] ?? []).filter(
                (id) =>
                  (bundleA[id] ?? []).some((p) => p.value != null) ||
                  (bundleB[id] ?? []).some((p) => p.value != null)
              );
              const chartMeta = chartMetrics.map((id) => ({
                title: lbl(id),
                summary: `Trend for ${lbl(id)} — ${nameA} vs ${nameB}.`,
              }));

              return (
                <AccordionSection
                  key={cat}
                  id={COMPARE_SECTION_IDS[cat as keyof typeof COMPARE_SECTION_IDS]}
                  title={meta.title}
                  subtitle={meta.subtitle}
                  accent={meta.accent}
                  defaultOpen={false}
                  onDownload={() => exportCategoryComparison(cat)}
                >
                  <div className="space-y-6">
                    <ComparePairHeader nameA={nameA} nameB={nameB} />
                    <div>
                      <p className="dash-section-label">Snapshot ({end})</p>
                      <div className="dash-subsection-grid lg:grid-cols-2 xl:grid-cols-3">
                        {metrics.map((m) => (
                          <CompareMetricRow
                            key={m.id}
                            label={lbl(m.id)}
                            metricId={m.id}
                            unit={m.unit}
                            seriesA={bundleA[m.id] ?? []}
                            seriesB={bundleB[m.id] ?? []}
                            snapshotYear={end}
                            nameA={nameA}
                            nameB={nameB}
                          />
                        ))}
                      </div>
                    </div>

                    {chartMetrics.length > 0 ? (
                      <div className="space-y-4 border-t border-slate-100 pt-4">
                        <CompareChartLegend nameA={nameA} nameB={nameB} />
                        <VisualizationStepperFromChildren
                          groupLabel={`${meta.title} trends`}
                          meta={chartMeta}
                        >
                          {chartMetrics.map((metricId) => (
                            <CompareDualLineChart
                              key={metricId}
                              metricId={metricId}
                              metricLabel={lbl(metricId)}
                              bundleA={bundleA}
                              bundleB={bundleB}
                              start={start}
                              end={end}
                              nameA={nameA}
                              nameB={nameB}
                            />
                          ))}
                        </VisualizationStepperFromChildren>
                      </div>
                    ) : null}
                  </div>
                </AccordionSection>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
