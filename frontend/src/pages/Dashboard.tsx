import { useCallback, useEffect, useMemo, useState } from "react";
import CollapsibleToolbar from "../components/layout/CollapsibleToolbar";
import CountrySelect from "../components/CountrySelect";
import AccordionSection from "../components/dashboard/AccordionSection";
import DashboardComparisonTable, {
  type ComparisonRow,
} from "../components/dashboard/DashboardComparisonTable";
import DashboardHero, { type HeroKpi } from "../components/dashboard/DashboardHero";
import DashboardInfoCard from "../components/dashboard/DashboardInfoCard";
import DashboardLoadingState from "../components/dashboard/DashboardLoadingState";
import DashboardSectionNav, { type DashboardNavItem } from "../components/dashboard/DashboardSectionNav";
import MetricCard from "../components/dashboard/MetricCard";
import TimezoneClockCard from "../components/dashboard/TimezoneClockCard";
import YearRangePresetDropdown, {
  type YearPresetKind,
} from "../components/dashboard/YearRangePresetDropdown";
import ToggleLineChart, { type SeriesSpec } from "../components/dashboard/ToggleLineChart";
import { VisualizationStepperFromChildren } from "../components/charts/VisualizationStepper";
import { getJson, postJson, type CountrySummary, type FxSeriesPayload, type MetricDef, type SeriesPoint } from "../api";
import { downloadCsv } from "../lib/csv";
import { metricDisplayLabelFromId } from "../lib/metricDisplay";
import { formatCompactNumber, formatYoY } from "../lib/formatValue";
import {
  MIN_DATA_YEAR,
  clampSpanEnd,
  clampSpanStart,
  maxSelectableYear,
} from "../lib/yearBounds";
import { labourChartRows, mergeSeriesForLineChart } from "../lib/chartSeries";
import { chunkMetricIds, COUNTRY_SERIES_CHUNK_SIZE } from "../lib/metricChunks";
import { readStoredDashboardCountry, writeStoredDashboardCountry } from "../dashboardCountryStorage";

const DASHBOARD_SECTION_IDS = {
  general: "section-general",
  financial: "section-financial",
  health: "section-health",
  education: "section-education",
  crime: "section-crime",
  labour: "section-labour",
  comparison: "section-comparison",
} as const;

const LINE_CHARTS_NOTE_SHORT =
  "Series are densified across your year range; sparse tails use last published values, with WLD fallback where national data is missing.";

const DASHBOARD_FIN_VIZ_META = [
  {
    title: "GDP & government debt (US$)",
    summary: "Nominal and PPP GDP with government debt in US dollars.",
  },
  {
    title: "GDP / GNI per capita & population",
    summary: "Income per person (nominal & PPP), GNI per capita (Atlas — WB classification input), and population.",
  },
  {
    title: "Macro, poverty & rates",
    summary: "Inflation, unemployment, poverty lines, debt-to-GDP, and lending rate (% scale).",
  },
] as const;

const DASHBOARD_HEALTH_VIZ_META = [
  {
    title: "Mortality (maternal & under-five)",
    summary: "Maternal and under-five mortality over time.",
  },
  {
    title: "Life expectancy & undernourishment",
    summary: "Life expectancy in years vs undernourishment prevalence.",
  },
  {
    title: "Health systems capacity",
    summary: "Hospital beds and health workforce density indicators.",
  },
  {
    title: "Coverage, prevention & risk factors",
    summary: "UHC, immunization, spending share, smoking prevalence, and birth/TB burden.",
  },
  {
    title: "Age structure shares (%)",
    summary: "Youth, working-age, and older population as shares of total.",
  },
] as const;

const DASHBOARD_EDU_VIZ_META = [
  {
    title: "Out-of-school & completion",
    summary: "Out-of-school rates by level and school completion rates.",
  },
  {
    title: "Enrollment & gross ratios",
    summary: "Enrollment headcounts and gross enrollment–style percentage series.",
  },
] as const;

const DASHBOARD_CRIME_VIZ_META = [
  {
    title: "Intentional homicide rates (UNODC)",
    summary: "Total, female, and male homicide rates per 100,000 population.",
  },
  {
    title: "Gender-based violence & conflict harm",
    summary: "Intimate-partner violence, conflict displacement, and battle-related deaths.",
  },
  {
    title: "Governance & rule of law (WGI)",
    summary: "Rule of law, political stability, and corruption control estimates.",
  },
] as const;

/** Core financial/labour + population metrics for the first dashboard paint. */
const DASHBOARD_CORE_METRIC_IDS: readonly string[] = [
  "population",
  "gdp",
  "gdp_ppp",
  "gdp_per_capita",
  "gdp_per_capita_ppp",
  "gni_per_capita_atlas",
  "gov_debt_usd",
  "gov_debt_pct_gdp",
  "inflation",
  "lending_rate",
  "unemployment_ilo",
  "labor_force_total",
  "poverty_headcount",
  "poverty_national",
  "life_expectancy",
  "mortality_under5",
  "maternal_mortality",
  "undernourishment",
  "birth_rate",
  "tb_incidence",
  "uhc_service_coverage",
  "hospital_beds",
  "physicians_density",
  "nurses_midwives_density",
  "immunization_dpt",
  "immunization_measles",
  "health_expenditure_gdp",
  "smoking_prevalence",
];

/** Health and demographics group (loaded in a separate request). */
const DASHBOARD_HEALTH_METRIC_IDS: readonly string[] = [
  "population",
  "life_expectancy",
  "mortality_under5",
  "maternal_mortality",
  "undernourishment",
  "birth_rate",
  "tb_incidence",
  "uhc_service_coverage",
  "hospital_beds",
  "physicians_density",
  "nurses_midwives_density",
  "immunization_dpt",
  "immunization_measles",
  "health_expenditure_gdp",
  "smoking_prevalence",
  "pop_age_0_14",
  "pop_15_64_pct",
  "pop_age_65_plus",
];

/** Education group (loaded in a separate request). */
const DASHBOARD_EDU_METRIC_IDS: readonly string[] = [
  "oosc_primary",
  "oosc_secondary",
  "oosc_tertiary",
  "school_primary_completion",
  "completion_secondary",
  "completion_tertiary",
  "reading_proficiency",
  "literacy_adult",
  "gpi_primary",
  "gpi_secondary",
  "gpi_tertiary",
  "trained_teachers_pri",
  "trained_teachers_sec",
  "trained_teachers_ter",
  "edu_expenditure_gdp",
  "enrollment_primary_count",
  "enrollment_secondary_count",
  "enrollment_tertiary_count",
  "enrollment_primary_pct",
  "enrollment_secondary",
  "enrollment_tertiary_pct",
  "teachers_primary_count",
  "teachers_secondary_count",
  "teachers_tertiary_count",
];

/** Crime & public safety (UNODC, IDMC, UCDP, WGI via WDI). */
const DASHBOARD_CRIME_METRIC_IDS: readonly string[] = [
  "homicide_rate",
  "homicide_rate_female",
  "homicide_rate_male",
  "gbv_women_pct",
  "idp_conflict_violence",
  "battle_related_deaths",
  "rule_of_law_wgi",
  "political_stability_wgi",
  "corruption_control_wgi",
];

const DASHBOARD_ALL_METRIC_IDS: readonly string[] = Array.from(
  new Set([
    ...DASHBOARD_CORE_METRIC_IDS,
    ...DASHBOARD_HEALTH_METRIC_IDS,
    ...DASHBOARD_EDU_METRIC_IDS,
    ...DASHBOARD_CRIME_METRIC_IDS,
  ])
);

function buildSeriesPath(country: string, start: number, end: number, metricIds: readonly string[]): string {
  const q = new URLSearchParams({ start: String(start), end: String(end) });
  q.set("metrics", metricIds.join(","));
  return `/api/country/${country}/series?${q}`;
}

async function fetchCountrySeriesBatched(
  country: string,
  start: number,
  end: number,
  metricIds: readonly string[],
  onProgress?: (pct: number) => void
): Promise<Record<string, SeriesPoint[]>> {
  const chunks = chunkMetricIds(metricIds, COUNTRY_SERIES_CHUNK_SIZE);
  const merged: Record<string, SeriesPoint[]> = {};
  let completed = 0;
  for (const chunk of chunks) {
    const part = await withTimeout(
      getJson<Record<string, SeriesPoint[]>>(buildSeriesPath(country, start, end, chunk)),
      52_000,
      `Country metrics batch (${completed + 1}/${chunks.length})`
    );
    Object.assign(merged, part);
    completed += 1;
    onProgress?.(Math.min(95, Math.round((completed / chunks.length) * 95)));
  }
  return merged;
}

function latest(series: SeriesPoint[]): { year: number; value: number } | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i].value;
    if (v !== null && !Number.isNaN(v)) return { year: series[i].year, value: v };
  }
  return null;
}

function yoyPct(series: SeriesPoint[]): number | null {
  const l = latest(series);
  if (!l) return null;
  const prev = series.find((p) => p.year === l.year - 1 && p.value !== null);
  if (!prev || prev.value === null || prev.value === 0) return null;
  return ((l.value - prev.value) / Math.abs(prev.value)) * 100;
}

function yoyBpsRate(series: SeriesPoint[]): number | null {
  const l = latest(series);
  if (!l) return null;
  const prev = series.find((p) => p.year === l.year - 1 && p.value !== null);
  if (prev?.value === null || prev?.value === undefined) return null;
  return (l.value - prev.value) * 100;
}

function headOfGovernment(gov?: string): string {
  if (!gov) return "—";
  const s = gov.toLowerCase();
  if (s.includes("parliamentary")) return "Prime Minister";
  if (s.includes("constitutional monarchy") || s.includes("monarchy")) return "Monarch";
  if (s.includes("republic") || s.includes("presidential")) return "President";
  if (s.includes("federation") || s.includes("federal")) return "Head of government";
  return "—";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export default function Dashboard() {
  const maxYear = maxSelectableYear();
  const [country, setCountry] = useState(() => readStoredDashboardCountry() ?? "IDN");
  const [start, setStart] = useState(MIN_DATA_YEAR);
  const [end, setEnd] = useState(maxYear);
  const [meta, setMeta] = useState<CountrySummary | null>(null);
  const [fxSeries, setFxSeries] = useState<FxSeriesPayload | null>(null);
  const [bundle, setBundle] = useState<Record<string, SeriesPoint[]>>({});
  const [comparison, setComparison] = useState<ComparisonRow[]>([]);
  const [compYear, setCompYear] = useState(maxYear);
  const [compDataYear, setCompDataYear] = useState<number | undefined>(undefined);
  const [compMembersCount, setCompMembersCount] = useState<number | undefined>(undefined);
  const [compName, setCompName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [mainLoadProgress, setMainLoadProgress] = useState(0);
  const [extrasLoadProgress, setExtrasLoadProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [metricCatalog, setMetricCatalog] = useState<MetricDef[]>([]);

  useEffect(() => {
    getJson<MetricDef[]>("/api/metrics").then(setMetricCatalog).catch(console.error);
  }, []);

  useEffect(() => {
    writeStoredDashboardCountry(country);
  }, [country]);

  const lbl = useCallback(
    (id: string) => metricDisplayLabelFromId(id, metricCatalog),
    [metricCatalog]
  );

  const wbProfile = meta?.worldBankProfile ?? null;

  const heroKpis = useMemo((): HeroKpi[] => {
    const pop = latest(bundle.population ?? []);
    const gdpPc = latest(bundle.gdp_per_capita ?? []);
    const life = latest(bundle.life_expectancy ?? []);
    const infl = latest(bundle.inflation ?? []);
    const yoyPop = yoyPct(bundle.population ?? []);
    const yoyGdp = yoyPct(bundle.gdp_per_capita ?? []);
    const yoyLife = yoyPct(bundle.life_expectancy ?? []);
    const yoyInfl = yoyPct(bundle.inflation ?? []);
    return [
      {
        id: "population",
        label: lbl("population"),
        value: pop ? formatCompactNumber(pop.value, { maxFrac: 2 }) : "—",
        sub: yoyPop != null ? formatYoY(yoyPop, null, false).text : undefined,
        subTone: yoyPop != null ? formatYoY(yoyPop, null, false).tone : undefined,
      },
      {
        id: "gdp_pc",
        label: lbl("gdp_per_capita"),
        value: gdpPc ? formatCompactNumber(gdpPc.value, { maxFrac: 2 }) : "—",
        sub: yoyGdp != null ? formatYoY(yoyGdp, null, false).text : undefined,
        subTone: yoyGdp != null ? formatYoY(yoyGdp, null, false).tone : undefined,
      },
      {
        id: "life",
        label: lbl("life_expectancy"),
        value: life ? `${life.value.toFixed(1)} yrs` : "—",
        sub: yoyLife != null ? formatYoY(yoyLife, null, false).text : undefined,
        subTone: yoyLife != null ? formatYoY(yoyLife, null, false).tone : undefined,
      },
      {
        id: "inflation",
        label: lbl("inflation"),
        value: infl ? `${infl.value.toFixed(1)}%` : "—",
        sub: yoyInfl != null ? formatYoY(yoyInfl, yoyBpsRate(bundle.inflation ?? []), true).text : undefined,
        subTone: yoyInfl != null ? formatYoY(yoyInfl, yoyBpsRate(bundle.inflation ?? []), true).tone : undefined,
      },
    ];
  }, [bundle, lbl]);

  const sectionNavItems = useMemo((): DashboardNavItem[] => {
    const base: DashboardNavItem[] = [
      { id: DASHBOARD_SECTION_IDS.general, label: "Overview" },
      { id: DASHBOARD_SECTION_IDS.financial, label: "Financial" },
      { id: DASHBOARD_SECTION_IDS.health, label: "Health" },
      { id: DASHBOARD_SECTION_IDS.education, label: "Education" },
      { id: DASHBOARD_SECTION_IDS.crime, label: "Safety" },
      { id: DASHBOARD_SECTION_IDS.labour, label: "Labour" },
    ];
    if (comparison.length > 0 || loadingExtras) {
      base.push({ id: DASHBOARD_SECTION_IDS.comparison, label: "Compare" });
    }
    return base;
  }, [comparison.length, loadingExtras]);

  const fxCurrencyCode =
    fxSeries?.currency ?? meta?.usdFxCurrency ?? meta?.eurFxCurrency ?? meta?.currencies?.[0] ?? "LCU";

  const fxChartData = useMemo(() => {
    if (!fxSeries) return [];
    return mergeSeriesForLineChart(
      { usd_to_local: fxSeries.usdToLocal, eur_to_local: fxSeries.eurToLocal },
      ["usd_to_local", "eur_to_local"],
      start,
      end
    );
  }, [fxSeries, start, end]);

  const fxChartSeries: SeriesSpec[] = useMemo(
    () => [
      {
        key: "usd_to_local",
        label: `1 USD → ${fxCurrencyCode}`,
        color: "#2563eb",
        yAxisId: "left" as const,
      },
      {
        key: "eur_to_local",
        label: `1 EUR → ${fxCurrencyCode}`,
        color: "#059669",
        yAxisId: "left" as const,
      },
    ],
    [fxCurrencyCode]
  );

  const fxChartHasData = useMemo(
    () =>
      fxSeries != null &&
      (fxSeries.usdToLocal.some((p) => p.value != null) || fxSeries.eurToLocal.some((p) => p.value != null)),
    [fxSeries]
  );

  const fxChartFootnote = fxSeries
    ? `USD: ${fxSeries.usdSource}. EUR: ${fxSeries.eurSource}. Annual year-end ECB reference rates where available; World Bank PA.NUS.FCRF for longer USD history.`
    : undefined;

  const load = useCallback(async () => {
    if (!country) return;
    setLoading(true);
    setLoadingExtras(true);
    setMainLoadProgress(8);
    setExtrasLoadProgress(0);
    setErr(null);
    setFxSeries(null);
    const mainProgressTimer = window.setInterval(() => {
      setMainLoadProgress((prev) => (prev < 92 ? prev + 6 : 92));
    }, 250);
    try {
      const [m, allSeriesBundle, fx] = await Promise.all([
        getJson<CountrySummary>(`/api/country/${country}`),
        fetchCountrySeriesBatched(country, start, end, DASHBOARD_ALL_METRIC_IDS, setMainLoadProgress),
        getJson<FxSeriesPayload>(`/api/country/${country}/fx-series?start=${start}&end=${end}`).catch(() => null),
      ]);
      setMeta(m);
      setFxSeries(fx);
      setBundle(allSeriesBundle);
      setMainLoadProgress(100);
    } catch (e) {
      setErr(String(e));
      setMainLoadProgress(0);
      setLoadingExtras(false);
      return;
    } finally {
      window.clearInterval(mainProgressTimer);
      setLoading(false);
    }

    setExtrasLoadProgress(10);
    const extrasProgressTimer = window.setInterval(() => {
      setExtrasLoadProgress((prev) => (prev < 94 ? prev + 5 : 94));
    }, 250);
    try {
      const cmp = await withTimeout(
        getJson<{
          rows: ComparisonRow[];
          year: number;
          dataYear?: number;
          membersCount?: number;
          countryName: string;
        }>(`/api/dashboard/comparison?cca3=${country}&year=${end}`),
        35_000,
        "Dashboard comparison"
      );
      setComparison(cmp.rows);
      setCompYear(cmp.year);
      setCompDataYear(cmp.dataYear);
      setCompMembersCount(cmp.membersCount);
      setCompName(cmp.countryName);
      setExtrasLoadProgress(100);
    } catch (e) {
      console.warn("Comparison table unavailable for this request", e);
      setComparison([]);
      setExtrasLoadProgress(0);
    } finally {
      window.clearInterval(extrasProgressTimer);
      setLoadingExtras(false);
    }
  }, [country, start, end, tick]);

  useEffect(() => {
    void load();
  }, [load]);

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
        kind === "y2"
          ? 2
          : kind === "y3"
            ? 3
            : kind === "y5"
              ? 5
              : kind === "y8"
                ? 8
                : kind === "y10"
                  ? 10
                  : kind === "y15"
                    ? 15
                    : 20;
      setStart(Math.max(MIN_DATA_YEAR, hi - (span - 1)));
      setEnd(hi);
    }
  };

  const exportAll = () => {
    const headers = ["year", ...Object.keys(bundle)];
    const years = new Set<number>();
    Object.values(bundle).forEach((arr) => arr.forEach((p) => years.add(p.year)));
    const rows = [...years]
      .sort((a, b) => a - b)
      .map((year) => [
        year,
        ...Object.keys(bundle).map((k) => {
          const pt = bundle[k]?.find((p) => p.year === year);
          return pt?.value ?? "";
        }),
      ]);
    downloadCsv(`${country}_dashboard_${start}_${end}.csv`, headers, rows);
  };

  const exportKeys = (name: string, keys: string[]) => {
    const years = new Set<number>();
    keys.forEach((k) => bundle[k]?.forEach((p) => years.add(p.year)));
    const headers = ["year", ...keys];
    const rows = [...years]
      .sort((a, b) => a - b)
      .map((year) => [
        year,
        ...keys.map((k) => {
          const pt = bundle[k]?.find((p) => p.year === year);
          return pt?.value ?? "";
        }),
      ]);
    downloadCsv(`${country}_${name}_${start}_${end}.csv`, headers, rows);
  };

  const exportComparison = () => {
    const headers = ["metric", "country", "avgCountry", "global"];
    const rows = comparison.map((r) => [
      r.label,
      r.country.value ?? "",
      r.avgCountry.value ?? "",
      r.global.value ?? "",
    ]);
    downloadCsv(`${country}_comparison_${compYear}.csv`, headers, rows);
  };

  const pop = bundle.population ?? [];
  const popLatest = latest(pop);

  const finCards = useMemo(() => {
    const pctYoY = (s: SeriesPoint[]) => formatYoY(yoyPct(s), yoyBpsRate(s), true);
    const numYoY = (s: SeriesPoint[]) => formatYoY(yoyPct(s), null, false);
    const base = [
      {
        metricId: "gdp",
        series: bundle.gdp ?? [],
        fmt: (v: number) => formatCompactNumber(v, { maxFrac: 2 }),
        yoy: numYoY,
      },
      {
        metricId: "gdp_ppp",
        series: bundle.gdp_ppp ?? [],
        fmt: (v: number) => formatCompactNumber(v, { maxFrac: 2 }),
        yoy: numYoY,
      },
      {
        metricId: "gdp_per_capita",
        series: bundle.gdp_per_capita ?? [],
        fmt: (v: number) => formatCompactNumber(v, { maxFrac: 2 }),
        yoy: numYoY,
      },
      {
        metricId: "gdp_per_capita_ppp",
        series: bundle.gdp_per_capita_ppp ?? [],
        fmt: (v: number) => formatCompactNumber(v, { maxFrac: 2 }),
        yoy: numYoY,
      },
      {
        metricId: "gni_per_capita_atlas",
        series: bundle.gni_per_capita_atlas ?? [],
        fmt: (v: number) => formatCompactNumber(v, { maxFrac: 2 }),
        yoy: numYoY,
      },
      {
        metricId: "gov_debt_usd",
        series: bundle.gov_debt_usd ?? [],
        fmt: (v: number) => formatCompactNumber(v, { maxFrac: 2 }),
        yoy: numYoY,
      },
      {
        metricId: "gov_debt_pct_gdp",
        series: bundle.gov_debt_pct_gdp ?? [],
        fmt: (v: number) => `${v.toFixed(1)}%`,
        yoy: pctYoY,
      },
      {
        metricId: "inflation",
        series: bundle.inflation ?? [],
        fmt: (v: number) => `${v.toFixed(1)}%`,
        yoy: pctYoY,
      },
      {
        metricId: "lending_rate",
        series: bundle.lending_rate ?? [],
        fmt: (v: number) => `${v.toFixed(1)}%`,
        yoy: pctYoY,
      },
      {
        metricId: "unemployment_ilo",
        series: bundle.unemployment_ilo ?? [],
        fmt: (v: number) => `${v.toFixed(1)}%`,
        yoy: pctYoY,
      },
      {
        metricId: "unemployed_number",
        series: [],
        fmt: () => {
          const u = latest(bundle.unemployment_ilo ?? []);
          const lf = latest(bundle.labor_force_total ?? []);
          if (!u || !lf) return "—";
          const n = (u.value / 100) * lf.value;
          return formatCompactNumber(n, { maxFrac: 2 });
        },
        yoy: () => {
          const ys = bundle.unemployment_ilo ?? [];
          const ls = bundle.labor_force_total ?? [];
          const curY = latest(ys)?.year;
          if (!curY) return { text: "—", tone: "flat" as const };
          const prev = ys.find((p) => p.year === curY - 1)?.value;
          const curU = ys.find((p) => p.year === curY)?.value;
          const curL = ls.find((p) => p.year === curY)?.value;
          const prevL = ls.find((p) => p.year === curY - 1)?.value;
          if (
            prev === null ||
            prev === undefined ||
            curU === null ||
            curU === undefined ||
            curL === null ||
            curL === undefined ||
            prevL === null ||
            prevL === undefined
          )
            return { text: "—", tone: "flat" as const };
          const now = (curU / 100) * curL;
          const was = (prev / 100) * prevL;
          if (was === 0) return { text: "—", tone: "flat" as const };
          const pct = ((now - was) / Math.abs(was)) * 100;
          return formatYoY(pct, null, false);
        },
      },
      {
        metricId: "labor_force_total",
        series: bundle.labor_force_total ?? [],
        fmt: (v: number) => formatCompactNumber(v, { maxFrac: 2 }),
        yoy: numYoY,
      },
      {
        metricId: "poverty_headcount",
        series: bundle.poverty_headcount ?? [],
        fmt: (v: number) => `${v.toFixed(1)}%`,
        yoy: pctYoY,
      },
      {
        metricId: "poverty_national",
        series: bundle.poverty_national ?? [],
        fmt: (v: number) => `${v.toFixed(1)}%`,
        yoy: pctYoY,
      },
    ];
    return base.map((c) => ({
      ...c,
      label: metricDisplayLabelFromId(c.metricId, metricCatalog),
    }));
  }, [bundle, metricCatalog]);

  const macroChartData = useMemo(
    () =>
      mergeSeriesForLineChart(bundle, [
        "inflation",
        "gov_debt_pct_gdp",
        "lending_rate",
        "unemployment_ilo",
        "poverty_headcount",
        "poverty_national",
      ], start, end),
    [bundle, start, end]
  );

  const macroSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "inflation", color: "#ea580c", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "gov_debt_pct_gdp", color: "#78350f", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "lending_rate", color: "#2563eb", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "unemployment_ilo", color: "#16a34a", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "poverty_headcount", color: "#dc2626", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "poverty_national", color: "#7f1d1d", yAxisId: "left" as const, tooltipFormat: "percent" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const gdpLevelsChartData = useMemo(
    () => mergeSeriesForLineChart(bundle, ["gdp", "gdp_ppp", "gov_debt_usd"], start, end),
    [bundle, start, end]
  );

  const gdpLevelsSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "gdp", color: "#991b1b", yAxisId: "left" as const },
        { key: "gdp_ppp", color: "#92400e", yAxisId: "left" as const },
        { key: "gov_debt_usd", color: "#b91c1c", yAxisId: "left" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const gdpPcPopChartData = useMemo(
    () =>
      mergeSeriesForLineChart(
        bundle,
        ["gdp_per_capita", "gdp_per_capita_ppp", "gni_per_capita_atlas", "population"],
        start,
        end
      ),
    [bundle, start, end]
  );

  const gdpPcPopSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "gdp_per_capita", color: "#ea580c", yAxisId: "left" as const },
        { key: "gdp_per_capita_ppp", color: "#ca8a04", yAxisId: "left" as const },
        { key: "gni_per_capita_atlas", color: "#0d9488", yAxisId: "left" as const },
        { key: "population", color: "#0f172a", yAxisId: "right" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const healthMortalityChartData = useMemo(
    () => mergeSeriesForLineChart(bundle, ["maternal_mortality", "mortality_under5"], start, end),
    [bundle, start, end]
  );

  const healthMortalitySeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "maternal_mortality", color: "#dc2626", yAxisId: "left" as const },
        { key: "mortality_under5", color: "#ea580c", yAxisId: "left" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const healthLifeChartData = useMemo(
    () => mergeSeriesForLineChart(bundle, ["life_expectancy", "undernourishment"], start, end),
    [bundle, start, end]
  );

  const healthLifeSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "life_expectancy", color: "#0f766e", yAxisId: "left" as const },
        { key: "undernourishment", color: "#22c55e", yAxisId: "right" as const, tooltipFormat: "percent" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const healthSystemChartData = useMemo(
    () =>
      mergeSeriesForLineChart(
        bundle,
        ["hospital_beds", "physicians_density", "nurses_midwives_density"],
        start,
        end
      ),
    [bundle, start, end]
  );

  const healthSystemSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "hospital_beds", color: "#2563eb", yAxisId: "left" as const },
        { key: "physicians_density", color: "#059669", yAxisId: "left" as const },
        { key: "nurses_midwives_density", color: "#7c3aed", yAxisId: "left" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const healthCoverageChartData = useMemo(
    () =>
      mergeSeriesForLineChart(
        bundle,
        [
          "uhc_service_coverage",
          "immunization_dpt",
          "immunization_measles",
          "health_expenditure_gdp",
          "smoking_prevalence",
          "birth_rate",
          "tb_incidence",
        ],
        start,
        end
      ),
    [bundle, start, end]
  );

  const healthCoverageSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "uhc_service_coverage", color: "#0f766e", yAxisId: "left" as const },
        { key: "immunization_dpt", color: "#16a34a", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "immunization_measles", color: "#22c55e", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "health_expenditure_gdp", color: "#ea580c", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "smoking_prevalence", color: "#b91c1c", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "birth_rate", color: "#1d4ed8", yAxisId: "left" as const },
        { key: "tb_incidence", color: "#7c2d12", yAxisId: "left" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const eduOoscChart = useMemo(
    () =>
      mergeSeriesForLineChart(
        bundle,
        ["oosc_primary", "oosc_secondary", "oosc_tertiary", "school_primary_completion", "completion_secondary", "completion_tertiary"],
        start,
        end
      ),
    [bundle, start, end]
  );

  const eduOoscSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "oosc_primary", color: "#be123c", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "oosc_secondary", color: "#e11d48", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "oosc_tertiary", color: "#fb7185", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "school_primary_completion", color: "#15803d", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "completion_secondary", color: "#16a34a", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "completion_tertiary", color: "#4ade80", yAxisId: "left" as const, tooltipFormat: "percent" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const eduEnrollChart = useMemo(
    () =>
      mergeSeriesForLineChart(bundle, [
        "enrollment_primary_count",
        "enrollment_secondary_count",
        "enrollment_tertiary_count",
        "enrollment_primary_pct",
        "enrollment_secondary",
        "enrollment_tertiary_pct",
      ], start, end),
    [bundle, start, end]
  );

  const eduEnrollSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "enrollment_primary_count", color: "#0d9488", yAxisId: "left" as const },
        { key: "enrollment_secondary_count", color: "#b45309", yAxisId: "left" as const },
        { key: "enrollment_tertiary_count", color: "#1d4ed8", yAxisId: "left" as const },
        { key: "enrollment_primary_pct", color: "#115e59", yAxisId: "right" as const, tooltipFormat: "percent" as const },
        { key: "enrollment_secondary", color: "#92400e", yAxisId: "right" as const, tooltipFormat: "percent" as const },
        { key: "enrollment_tertiary_pct", color: "#4338ca", yAxisId: "right" as const, tooltipFormat: "percent" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const labourChartData = useMemo(() => labourChartRows(bundle, start, end), [bundle, start, end]);
  const labourSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "unemployed", color: "#dc2626", yAxisId: "left" as const },
        { key: "labour", color: "#38bdf8", yAxisId: "right" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const crimeHomicideChartData = useMemo(
    () =>
      mergeSeriesForLineChart(
        bundle,
        ["homicide_rate", "homicide_rate_female", "homicide_rate_male"],
        start,
        end
      ),
    [bundle, start, end]
  );

  const crimeHomicideSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "homicide_rate", color: "#b91c1c", yAxisId: "left" as const },
        { key: "homicide_rate_female", color: "#db2777", yAxisId: "left" as const },
        { key: "homicide_rate_male", color: "#1d4ed8", yAxisId: "left" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const crimeConflictChartData = useMemo(
    () =>
      mergeSeriesForLineChart(
        bundle,
        ["gbv_women_pct", "idp_conflict_violence", "battle_related_deaths"],
        start,
        end
      ),
    [bundle, start, end]
  );

  const crimeConflictSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "gbv_women_pct", color: "#be185d", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "idp_conflict_violence", color: "#ea580c", yAxisId: "right" as const },
        { key: "battle_related_deaths", color: "#7c2d12", yAxisId: "right" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const crimeGovernanceChartData = useMemo(
    () =>
      mergeSeriesForLineChart(
        bundle,
        ["rule_of_law_wgi", "political_stability_wgi", "corruption_control_wgi"],
        start,
        end
      ),
    [bundle, start, end]
  );

  const crimeGovernanceSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "rule_of_law_wgi", color: "#0f766e", yAxisId: "left" as const },
        { key: "political_stability_wgi", color: "#2563eb", yAxisId: "left" as const },
        { key: "corruption_control_wgi", color: "#7c3aed", yAxisId: "left" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const ageChartData = useMemo(
    () => mergeSeriesForLineChart(bundle, ["pop_age_0_14", "pop_15_64_pct", "pop_age_65_plus"], start, end),
    [bundle, start, end]
  );

  const ageSeries: SeriesSpec[] = useMemo(
    () =>
      [
        { key: "pop_age_0_14", color: "#dc2626", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "pop_15_64_pct", color: "#2563eb", yAxisId: "left" as const, tooltipFormat: "percent" as const },
        { key: "pop_age_65_plus", color: "#ea580c", yAxisId: "left" as const, tooltipFormat: "percent" as const },
      ].map((s) => ({ ...s, label: lbl(s.key) })),
    [lbl]
  );

  const pill = (text: string, tone: "rose" | "slate" | "teal" = "rose") => {
    const tones = {
      rose: "bg-rose-50 text-rose-800 ring-rose-100",
      slate: "bg-slate-100 text-slate-700 ring-slate-200",
      teal: "bg-teal-50 text-teal-800 ring-teal-100",
    };
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}>
        {text}
      </span>
    );
  };

  const hasUsdFx =
    typeof meta?.usdFxRate === "number" && Number.isFinite(meta.usdFxRate) && meta.usdFxRate > 0;
  const hasEurFx =
    typeof meta?.eurFxRate === "number" && Number.isFinite(meta.eurFxRate) && meta.eurFxRate > 0;

  return (
    <div className="cap-dashboard-page mx-auto max-w-7xl space-y-4 pb-8 sm:space-y-5">
      <CollapsibleToolbar
        title="Dashboard controls"
        summary={`${country} · ${start}–${end}`}
        forceOpen={loading || loadingExtras}
        className="border-slate-200/80 shadow-sm"
      >
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:gap-2 md:gap-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="min-w-[6.5rem] flex-1 shrink basis-0 sm:min-w-[8rem] md:max-w-md lg:max-w-lg">
            <CountrySelect
              value={country}
              onChange={setCountry}
              variant="light"
              showLabel={false}
              className="gap-0 [&_input]:h-9 [&_input]:truncate [&_input]:rounded-lg [&_input]:border-slate-200 [&_input]:py-1.5 [&_input]:pl-2.5 [&_input]:pr-8 [&_input]:text-xs sm:[&_input]:pl-3 sm:[&_input]:pr-10 sm:[&_input]:text-sm"
            />
          </div>

          <div className="hidden h-9 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />

          <div
            className="flex shrink-0 items-center gap-1 sm:gap-1.5"
            title={`Default span is 2000–${maxYear}. Typical WDI/IMF releases lag slightly; the API may extend sparse series from the last observation.`}
          >
            <span className="sr-only">Years</span>
            <div className="inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50/90 px-1 shadow-sm sm:px-1.5">
              <label className="sr-only" htmlFor="dashboard-year-from">
                From year
              </label>
              <input
                id="dashboard-year-from"
                type="number"
                className="w-[4rem] min-w-[4rem] border-0 bg-transparent px-0.5 text-center text-xs font-medium tabular-nums text-slate-800 [appearance:textfield] focus:outline-none focus:ring-0 sm:w-[4.5rem] sm:min-w-[4.5rem] sm:px-1 sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={start}
                min={MIN_DATA_YEAR}
                max={Math.min(end, maxYear)}
                onChange={(e) => setStart(clampSpanStart(Number(e.target.value), end))}
              />
              <span className="select-none px-0.5 text-[10px] text-slate-300 sm:text-xs" aria-hidden>
                –
              </span>
              <label className="sr-only" htmlFor="dashboard-year-to">
                To year
              </label>
              <input
                id="dashboard-year-to"
                type="number"
                className="w-[4rem] min-w-[4rem] border-0 bg-transparent px-0.5 text-center text-xs font-medium tabular-nums text-slate-800 [appearance:textfield] focus:outline-none focus:ring-0 sm:w-[4.5rem] sm:min-w-[4.5rem] sm:px-1 sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={end}
                min={Math.max(start, MIN_DATA_YEAR)}
                max={maxYear}
                onChange={(e) => setEnd(clampSpanEnd(Number(e.target.value), start))}
              />
            </div>
            <YearRangePresetDropdown start={start} end={end} maxYear={maxYear} onSelect={setPreset} compact />
          </div>

          <div className="hidden h-9 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />

          <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:ml-auto">
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] sm:w-auto sm:gap-1.5 sm:px-3"
              title="Refresh all data"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h5M20 20v-5h-5M5 9a7 7 0 0114 0M19 15a7 7 0 01-14 0"
                />
              </svg>
              <span className="hidden text-sm font-semibold md:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={exportAll}
              disabled={loading}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40 sm:w-auto sm:gap-1.5 sm:px-3"
              title="Export dashboard CSV"
            >
              <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span className="hidden text-sm font-semibold md:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </CollapsibleToolbar>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {err}
        </div>
      ) : null}

      {(loading || loadingExtras) && (
        <DashboardLoadingState
          label={loading ? "Loading country profile & metrics…" : "Loading cross-country comparison…"}
          progress={loading ? mainLoadProgress : extrasLoadProgress}
        />
      )}

      {meta ? (
        <>
          <DashboardHero
            meta={meta}
            yearStart={start}
            yearEnd={end}
            kpis={heroKpis}
            incomeLevel={wbProfile?.incomeLevel}
          />
          <DashboardSectionNav items={sectionNavItems} />

          <div className="space-y-3">
            <AccordionSection
              id={DASHBOARD_SECTION_IDS.general}
              title="Country overview"
              subtitle="Location, government, economy & geography"
              accent="teal"
              defaultOpen
              onDownload={() => exportKeys("general", ["population", "gdp", "life_expectancy"])}
            >
              <div className="space-y-6">
                <div>
                  <p className="dash-section-label">Location & classification</p>
                  <div className="dash-subsection-grid lg:grid-cols-2">
                    <DashboardInfoCard label="Region" accent="rose">
                      {pill(meta.region || "—")}
                    </DashboardInfoCard>
                    <DashboardInfoCard
                      label="Income level"
                      accent="teal"
                      hint="World Bank operational group from the Country API."
                    >
                      <div className="space-y-1">
                        {pill(wbProfile?.incomeLevel || "—", "teal")}
                        {wbProfile?.incomeLevelId ? (
                          <p className="text-xs font-mono text-slate-500">WB code: {wbProfile.incomeLevelId}</p>
                        ) : null}
                      </div>
                    </DashboardInfoCard>
                  </div>
                </div>

                <div>
                  <p className="dash-section-label">Government</p>
                  <div className="dash-subsection-grid lg:grid-cols-2">
                    <DashboardInfoCard label="Government type">{pill(meta.government || "—", "slate")}</DashboardInfoCard>
                    <DashboardInfoCard label="Head of government">
                      <p className="text-base font-semibold text-slate-900">
                        {meta.headOfGovernmentTitle ?? headOfGovernment(meta.government)}
                      </p>
                    </DashboardInfoCard>
                  </div>
                </div>

                <div>
                  <p className="dash-section-label">Administrative</p>
                  <div className="dash-subsection-grid lg:grid-cols-2">
                    <DashboardInfoCard label="Capital city">
                      <p className="text-base font-semibold text-slate-900">
                        {meta.capital?.[0] ?? wbProfile?.capitalCity ?? "—"}
                      </p>
                    </DashboardInfoCard>
                    <TimezoneClockCard timezone={meta.ianaTimezone ?? meta.timezones?.[0]} />
                  </div>
                </div>

                <div>
                  <p className="dash-section-label">Economy</p>
                  <div className="dash-subsection-grid lg:grid-cols-2">
                    <DashboardInfoCard label="Currency" accent="amber">
                      <p className="text-base font-semibold text-slate-900">
                        {meta.currencyDisplay?.trim() ||
                          (meta.currencies && meta.currencies.length > 0 ? meta.currencies.join(", ") : "—")}
                      </p>
                    </DashboardInfoCard>
                    <DashboardInfoCard label="Exchange rates" className="sm:col-span-2 lg:col-span-1">
                      <div className="space-y-2.5">
                        {hasUsdFx ? (
                          <div>
                            <p className="text-sm font-semibold tabular-nums text-slate-900">
                              {`1 USD = ${meta.usdFxRate!.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} ${meta.usdFxCurrency ?? meta.currencies?.[0] ?? ""}`}
                            </p>
                            {meta.usdFxRateAsOf ? (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {meta.usdFxRateAsOf}
                                {meta.usdFxSource ? ` · ${meta.usdFxSource}` : ""}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {hasEurFx ? (
                          <div>
                            <p className="text-sm font-semibold tabular-nums text-slate-900">
                              {`1 EUR = ${meta.eurFxRate!.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} ${meta.eurFxCurrency ?? meta.currencies?.[0] ?? ""}`}
                            </p>
                            {meta.eurFxRateAsOf ? (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {meta.eurFxRateAsOf}
                                {meta.eurFxSource ? ` · ${meta.eurFxSource}` : ""}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {!hasUsdFx && !hasEurFx ? <p className="text-sm text-slate-500">—</p> : null}
                      </div>
                    </DashboardInfoCard>
                  </div>
                  {fxChartHasData ? (
                    <div className="mt-4">
                      <ToggleLineChart
                        title={`Exchange rate evolution (${fxCurrencyCode})`}
                        data={fxChartData}
                        series={fxChartSeries}
                        dualAxis={false}
                        leftTickFormatter={(v) =>
                          formatCompactNumber(v, { maxFrac: v >= 1000 ? 0 : 2 })
                        }
                        footnote={fxChartFootnote}
                      />
                    </div>
                  ) : null}
                </div>

                <div>
                  <p className="dash-section-label">Geography</p>
                  <div className="dash-subsection-grid">
                    <DashboardInfoCard label="Land area">
                      <p className="text-base font-semibold tabular-nums text-slate-900">
                        {formatCompactNumber(meta.landAreaKm2 ?? meta.area, { suffix: " km²", maxFrac: 2 })}
                      </p>
                    </DashboardInfoCard>
                    <DashboardInfoCard label="Total area">
                      <p className="text-base font-semibold tabular-nums text-slate-900">
                        {formatCompactNumber(meta.totalAreaKm2 ?? meta.area, { suffix: " km²", maxFrac: 2 })}
                      </p>
                    </DashboardInfoCard>
                    <DashboardInfoCard
                      label="EEZ"
                      hint={
                        meta.landlocked
                          ? "Landlocked — no exclusive economic zone."
                          : "Sea Around Us or public maritime references."
                      }
                    >
                      {meta.landlocked ? (
                        <p className="text-base font-semibold text-slate-500">—</p>
                      ) : meta.eezSqKm != null && Number.isFinite(meta.eezSqKm) ? (
                        <p className="text-base font-semibold tabular-nums text-slate-900">
                          {formatCompactNumber(meta.eezSqKm, { suffix: " km²", maxFrac: 2 })}
                        </p>
                      ) : (
                        <p className="text-base font-semibold text-slate-400">—</p>
                      )}
                    </DashboardInfoCard>
                  </div>
                </div>
              </div>
            </AccordionSection>

            <AccordionSection
              id={DASHBOARD_SECTION_IDS.financial}
              title="Financial metrics"
              subtitle="GDP, debt, inflation, poverty & trends"
              accent="rose"
              defaultOpen={false}
              onDownload={() =>
                exportKeys("financial", [
                  "gdp",
                  "gdp_ppp",
                  "gdp_per_capita",
                  "gdp_per_capita_ppp",
                  "gni_per_capita_atlas",
                  "gov_debt_usd",
                  "gov_debt_pct_gdp",
                  "inflation",
                  "lending_rate",
                  "unemployment_ilo",
                  "labor_force_total",
                  "poverty_headcount",
                  "poverty_national",
                ])
              }
            >
              <div className="space-y-8">
                <div>
                  <p className="dash-section-label">GDP &amp; income</p>
                  <div className="dash-subsection-grid lg:grid-cols-2 xl:grid-cols-3">
                    {finCards.slice(0, 5).map((c) => {
                      const lv = c.series.length ? latest(c.series) : null;
                      const isComputed = c.metricId === "unemployed_number";
                      const val =
                        lv ? c.fmt(lv.value) : isComputed ? (c.fmt as () => string)() : "—";
                      const yoy =
                        lv
                          ? c.yoy(c.series)
                          : isComputed
                            ? (c.yoy as () => ReturnType<typeof formatYoY>)()
                            : { text: "—", tone: "flat" as const };
                      return <MetricCard key={c.label} label={c.label} value={val} yoy={yoy} />;
                    })}
                  </div>
                </div>
                <div>
                  <p className="dash-section-label">Debt</p>
                  <div className="dash-subsection-grid lg:grid-cols-2">
                    {finCards.slice(5, 7).map((c) => {
                      const lv = latest(c.series);
                      const val = lv ? c.fmt(lv.value) : "—";
                      const yoy = c.yoy(c.series);
                      return <MetricCard key={c.label} label={c.label} value={val} yoy={yoy} />;
                    })}
                  </div>
                </div>
                <div>
                  <p className="dash-section-label">Inflation &amp; rates</p>
                  <div className="dash-subsection-grid lg:grid-cols-3">
                    {finCards.slice(7, 12).map((c) => {
                      const lv = c.series.length ? latest(c.series) : null;
                      const isComputed = c.metricId === "unemployed_number";
                      const val =
                        lv ? c.fmt(lv.value) : isComputed ? (c.fmt as () => string)() : "—";
                      const yoy =
                        lv
                          ? c.yoy(c.series)
                          : isComputed
                            ? (c.yoy as () => ReturnType<typeof formatYoY>)()
                            : { text: "—", tone: "flat" as const };
                      return <MetricCard key={c.label} label={c.label} value={val} yoy={yoy} />;
                    })}
                  </div>
                </div>
                <div>
                  <p className="dash-section-label">Poverty</p>
                  <div className="dash-subsection-grid lg:grid-cols-2">
                    {finCards.slice(12, 14).map((c) => {
                      const lv = latest(c.series);
                      const val = lv ? c.fmt(lv.value) : "—";
                      const yoy = c.yoy(c.series);
                      return <MetricCard key={c.label} label={c.label} value={val} yoy={yoy} />;
                    })}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">{LINE_CHARTS_NOTE_SHORT}</p>
                <VisualizationStepperFromChildren groupLabel="Financial charts" meta={DASHBOARD_FIN_VIZ_META}>
                  <ToggleLineChart
                    title="GDP & government debt (US$)"
                    data={gdpLevelsChartData}
                    series={gdpLevelsSeries}
                    dualAxis={false}
                    leftTickFormatter={(v) => formatCompactNumber(v, { maxFrac: 1 })}
                  />
                  <ToggleLineChart
                    title="GDP / GNI per capita & population"
                    data={gdpPcPopChartData}
                    series={gdpPcPopSeries}
                    leftTickFormatter={(v) => formatCompactNumber(v, { maxFrac: 1 })}
                    rightTickFormatter={(v) => formatCompactNumber(v, { maxFrac: 1 })}
                  />
                  <ToggleLineChart
                    title="Macro, poverty & rates"
                    data={macroChartData}
                    series={macroSeries}
                    dualAxis={false}
                  />
                </VisualizationStepperFromChildren>
              </div>
            </AccordionSection>

            <AccordionSection
              id={DASHBOARD_SECTION_IDS.health}
              title="Health & demographics"
              subtitle="Population, mortality, systems & age structure"
              accent="teal"
              defaultOpen={false}
              onDownload={() =>
                exportKeys("health", [
                  "population",
                  "life_expectancy",
                  "mortality_under5",
                  "maternal_mortality",
                  "undernourishment",
                  "birth_rate",
                  "tb_incidence",
                  "uhc_service_coverage",
                  "hospital_beds",
                  "physicians_density",
                  "nurses_midwives_density",
                  "immunization_dpt",
                  "immunization_measles",
                  "health_expenditure_gdp",
                  "smoking_prevalence",
                  "pop_age_0_14",
                  "pop_15_64_pct",
                  "pop_age_65_plus",
                ])
              }
            >
              <div className="space-y-8">
                <div>
                  <p className="dash-section-label">Population</p>
                  <div className="mt-3 max-w-xs sm:max-w-sm">
                    <MetricCard
                      label={lbl("population")}
                      value={popLatest ? formatCompactNumber(popLatest.value, { maxFrac: 2 }) : "—"}
                      yoy={formatYoY(yoyPct(pop), null, false)}
                    />
                  </div>
                </div>
                <div>
                  <p className="dash-section-label">Health</p>
                  <div className="dash-subsection-grid lg:grid-cols-2">
                    <MetricCard
                      label={lbl("life_expectancy")}
                      value={
                        latest(bundle.life_expectancy ?? [])?.value != null
                          ? `${latest(bundle.life_expectancy ?? [])!.value.toFixed(1)} years`
                          : "—"
                      }
                      yoy={formatYoY(yoyPct(bundle.life_expectancy ?? []), null, false)}
                    />
                    <MetricCard
                      label={lbl("mortality_under5")}
                      value={
                        latest(bundle.mortality_under5 ?? [])?.value != null
                          ? `${latest(bundle.mortality_under5 ?? [])!.value.toFixed(1)}`
                          : "—"
                      }
                      yoy={formatYoY(yoyPct(bundle.mortality_under5 ?? []), null, false)}
                    />
                    <MetricCard
                      label={lbl("maternal_mortality")}
                      value={
                        latest(bundle.maternal_mortality ?? [])?.value != null
                          ? `${Math.round(latest(bundle.maternal_mortality ?? [])!.value)}`
                          : "—"
                      }
                      yoy={formatYoY(yoyPct(bundle.maternal_mortality ?? []), null, false)}
                    />
                    <MetricCard
                      label={lbl("undernourishment")}
                      value={
                        latest(bundle.undernourishment ?? [])?.value != null
                          ? `${latest(bundle.undernourishment ?? [])!.value.toFixed(1)}%`
                          : "—"
                      }
                      yoy={formatYoY(
                        yoyPct(bundle.undernourishment ?? []),
                        yoyBpsRate(bundle.undernourishment ?? []),
                        true
                      )}
                    />
                  </div>
                </div>
                <div>
                  <p className="dash-section-label">Health systems, coverage & risk</p>
                  <div className="dash-subsection-grid lg:grid-cols-2">
                    {(
                      [
                        "birth_rate",
                        "tb_incidence",
                        "uhc_service_coverage",
                        "hospital_beds",
                        "physicians_density",
                        "nurses_midwives_density",
                        "immunization_dpt",
                        "immunization_measles",
                        "health_expenditure_gdp",
                        "smoking_prevalence",
                      ] as const
                    ).map((key) => {
                      const s = bundle[key] ?? [];
                      const lv = latest(s);
                      const pctMetric =
                        key === "immunization_dpt" ||
                        key === "immunization_measles" ||
                        key === "health_expenditure_gdp" ||
                        key === "smoking_prevalence";
                      const val =
                        lv == null
                          ? "—"
                          : pctMetric
                            ? `${lv.value.toFixed(1)}%`
                            : formatCompactNumber(lv.value, { maxFrac: 2 });
                      return (
                        <MetricCard
                          key={key}
                          label={lbl(key)}
                          value={val}
                          yoy={formatYoY(yoyPct(s), pctMetric ? yoyBpsRate(s) : null, pctMetric)}
                        />
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="dash-section-label">Age structure</p>
                  <div className="dash-subsection-grid">
                    {(["pop_age_0_14", "pop_15_64_pct", "pop_age_65_plus"] as const).map((key) => {
                      const s = bundle[key] ?? [];
                      const lv = latest(s);
                      const pct = lv?.value;
                      const popt = latest(pop)?.value;
                      const count =
                        pct != null && popt != null ? (pct / 100) * popt : null;
                      return (
                        <MetricCard
                          key={key}
                          label={lbl(key)}
                          value={
                            pct != null && count != null
                              ? `${pct.toFixed(1)}% · ${formatCompactNumber(count, { maxFrac: 2 })}`
                              : "—"
                          }
                          yoy={formatYoY(yoyPct(s), yoyBpsRate(s), true)}
                        />
                      );
                    })}
                  </div>
                </div>
                <VisualizationStepperFromChildren
                  groupLabel="Health & demographics charts"
                  meta={DASHBOARD_HEALTH_VIZ_META}
                >
                  <ToggleLineChart
                    title="Mortality (maternal & under-five)"
                    data={healthMortalityChartData}
                    series={healthMortalitySeries}
                    dualAxis={false}
                  />
                  <ToggleLineChart
                    title="Life expectancy & undernourishment"
                    data={healthLifeChartData}
                    series={healthLifeSeries}
                    leftTickFormatter={(v) => `${v.toFixed(0)} yrs`}
                    rightTickFormatter={(v) => `${v.toFixed(1)}%`}
                  />
                  <ToggleLineChart
                    title="Health systems capacity"
                    data={healthSystemChartData}
                    series={healthSystemSeries}
                    dualAxis={false}
                  />
                  <ToggleLineChart
                    title="Coverage, prevention & risk factors"
                    data={healthCoverageChartData}
                    series={healthCoverageSeries}
                    dualAxis={false}
                  />
                  <ToggleLineChart
                    title="Age structure shares (%)"
                    data={ageChartData}
                    series={ageSeries}
                    dualAxis={false}
                  />
                </VisualizationStepperFromChildren>
              </div>
            </AccordionSection>

            <AccordionSection
              id={DASHBOARD_SECTION_IDS.education}
              title="Education"
              subtitle="Enrollment, completion, literacy & investment"
              accent="amber"
              defaultOpen={false}
              onDownload={() =>
                exportKeys("education", [
                  "oosc_primary",
                  "oosc_secondary",
                  "oosc_tertiary",
                  "school_primary_completion",
                  "completion_secondary",
                  "completion_tertiary",
                  "reading_proficiency",
                  "literacy_adult",
                  "gpi_primary",
                  "gpi_secondary",
                  "gpi_tertiary",
                  "trained_teachers_pri",
                  "trained_teachers_sec",
                  "trained_teachers_ter",
                  "edu_expenditure_gdp",
                  "enrollment_primary_count",
                  "enrollment_secondary_count",
                  "enrollment_tertiary_count",
                  "enrollment_primary_pct",
                  "enrollment_secondary",
                  "enrollment_tertiary_pct",
                  "teachers_primary_count",
                  "teachers_secondary_count",
                  "teachers_tertiary_count",
                ])
              }
            >
              <div className="space-y-8">
                {(
                  [
                    {
                      title: "Out-of-school & completion",
                      keys: [
                        "oosc_primary",
                        "oosc_secondary",
                        "oosc_tertiary",
                        "school_primary_completion",
                        "completion_secondary",
                        "completion_tertiary",
                      ] as const,
                    },
                    {
                      title: "Learning & literacy",
                      keys: ["reading_proficiency", "literacy_adult"] as const,
                    },
                    {
                      title: "Quality & investment",
                      keys: [
                        "gpi_primary",
                        "gpi_secondary",
                        "gpi_tertiary",
                        "trained_teachers_pri",
                        "trained_teachers_sec",
                        "trained_teachers_ter",
                        "edu_expenditure_gdp",
                      ] as const,
                    },
                    {
                      title: "Enrollment & staff",
                      keys: [
                        "enrollment_primary_count",
                        "enrollment_secondary_count",
                        "enrollment_tertiary_count",
                        "enrollment_primary_pct",
                        "enrollment_secondary",
                        "enrollment_tertiary_pct",
                        "teachers_primary_count",
                        "teachers_secondary_count",
                        "teachers_tertiary_count",
                      ] as const,
                    },
                  ] as const
                ).map((block) => (
                  <div key={block.title}>
                    <p className="dash-section-label">{block.title}</p>
                    <div className="dash-subsection-grid lg:grid-cols-2">
                      {block.keys.map((key) => {
                        const s = bundle[key] ?? [];
                        const lv = latest(s);
                        const isPct =
                          key.includes("oosc") ||
                          key.includes("completion") ||
                          key.includes("literacy") ||
                          key.includes("trained") ||
                          key.includes("enrollment_primary_pct") ||
                          key.includes("enrollment_tertiary_pct") ||
                          key === "enrollment_secondary" ||
                          key === "reading_proficiency" ||
                          key === "edu_expenditure_gdp";
                        const isGpi = key.startsWith("gpi_");
                        const val =
                          lv == null
                            ? "No data"
                            : isPct
                              ? `${lv.value.toFixed(1)}%`
                              : isGpi
                                ? lv.value.toFixed(2)
                                : formatCompactNumber(lv.value, { maxFrac: 2 });
                        const yoy = formatYoY(yoyPct(s), yoyBpsRate(s), isPct && !isGpi);
                        return (
                          <MetricCard
                            key={key}
                            label={lbl(key)}
                            value={val}
                            yoy={yoy.text === "—" ? undefined : yoy}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
                <VisualizationStepperFromChildren groupLabel="Education charts" meta={DASHBOARD_EDU_VIZ_META}>
                  <ToggleLineChart
                    title="Out-of-school & completion"
                    data={eduOoscChart}
                    series={eduOoscSeries}
                    dualAxis={false}
                  />
                  <ToggleLineChart
                    title="Enrollment & gross ratios"
                    data={eduEnrollChart}
                    series={eduEnrollSeries}
                    leftTickFormatter={(v) => formatCompactNumber(v, { maxFrac: 0 })}
                    rightTickFormatter={(v) => `${v.toFixed(1)}%`}
                  />
                </VisualizationStepperFromChildren>
              </div>
            </AccordionSection>

            <AccordionSection
              id={DASHBOARD_SECTION_IDS.crime}
              title="Crime & public safety"
              subtitle="UNODC, IDMC, UCDP & governance indicators"
              accent="indigo"
              defaultOpen={false}
              onDownload={() =>
                exportKeys("crime", [
                  "homicide_rate",
                  "homicide_rate_female",
                  "homicide_rate_male",
                  "gbv_women_pct",
                  "idp_conflict_violence",
                  "battle_related_deaths",
                  "rule_of_law_wgi",
                  "political_stability_wgi",
                  "corruption_control_wgi",
                ])
              }
            >
              <div className="space-y-8">
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Homicide rates from UNODC (WDI); gender-based violence from UN/WHO; conflict data from IDMC & UCDP;
                  governance from World Bank WGI.
                </p>
                <div>
                  <p className="dash-section-label">Key indicators</p>
                  <div className="dash-subsection-grid lg:grid-cols-2">
                    <MetricCard
                      label={lbl("homicide_rate")}
                      value={
                        latest(bundle.homicide_rate ?? [])?.value != null
                          ? `${latest(bundle.homicide_rate ?? [])!.value.toFixed(1)} per 100k`
                          : "—"
                      }
                      yoy={formatYoY(yoyPct(bundle.homicide_rate ?? []), null, false)}
                    />
                    <MetricCard
                      label={lbl("gbv_women_pct")}
                      value={
                        latest(bundle.gbv_women_pct ?? [])?.value != null
                          ? `${latest(bundle.gbv_women_pct ?? [])!.value.toFixed(1)}%`
                          : "—"
                      }
                      yoy={formatYoY(
                        yoyPct(bundle.gbv_women_pct ?? []),
                        yoyBpsRate(bundle.gbv_women_pct ?? []),
                        true
                      )}
                    />
                    <MetricCard
                      label={lbl("rule_of_law_wgi")}
                      value={
                        latest(bundle.rule_of_law_wgi ?? [])?.value != null
                          ? latest(bundle.rule_of_law_wgi ?? [])!.value.toFixed(2)
                          : "—"
                      }
                      yoy={formatYoY(yoyPct(bundle.rule_of_law_wgi ?? []), null, false)}
                    />
                    <MetricCard
                      label={lbl("political_stability_wgi")}
                      value={
                        latest(bundle.political_stability_wgi ?? [])?.value != null
                          ? latest(bundle.political_stability_wgi ?? [])!.value.toFixed(2)
                          : "—"
                      }
                      yoy={formatYoY(yoyPct(bundle.political_stability_wgi ?? []), null, false)}
                    />
                  </div>
                </div>
                <VisualizationStepperFromChildren groupLabel="Crime & safety charts" meta={DASHBOARD_CRIME_VIZ_META}>
                  <ToggleLineChart
                    title="Intentional homicide rates (UNODC)"
                    data={crimeHomicideChartData}
                    series={crimeHomicideSeries}
                    dualAxis={false}
                  />
                  <ToggleLineChart
                    title="Gender-based violence & conflict harm"
                    data={crimeConflictChartData}
                    series={crimeConflictSeries}
                    leftTickFormatter={(v) => `${v.toFixed(1)}%`}
                    rightTickFormatter={(v) => formatCompactNumber(v, { maxFrac: 0 })}
                  />
                  <ToggleLineChart
                    title="Governance & rule of law (WGI)"
                    data={crimeGovernanceChartData}
                    series={crimeGovernanceSeries}
                    dualAxis={false}
                  />
                </VisualizationStepperFromChildren>
              </div>
            </AccordionSection>

            <AccordionSection
              id={DASHBOARD_SECTION_IDS.labour}
              title="Labour market"
              subtitle="Unemployment & labour force trends"
              accent="slate"
              defaultOpen={false}
              onDownload={() => exportKeys("labour", ["unemployment_ilo", "labor_force_total"])}
            >
              <ToggleLineChart
                data={labourChartData}
                series={labourSeries}
                leftTickFormatter={(v) => formatCompactNumber(v, { maxFrac: 2 })}
                rightTickFormatter={(v) => formatCompactNumber(v, { maxFrac: 2 })}
              />
            </AccordionSection>
          </div>
        </>
      ) : null}

      {(comparison.length > 0 || loadingExtras) && (
        <div id={DASHBOARD_SECTION_IDS.comparison} className="scroll-mt-24 space-y-2">
          {loadingExtras && comparison.length === 0 && (
            <p className="text-sm text-slate-400">Preparing comparison table…</p>
          )}
          {comparison.length > 0 && (
            <DashboardComparisonTable
              year={compYear}
              dataYear={compDataYear}
              membersCount={compMembersCount}
              countryName={compName || meta?.name || country}
              rows={comparison}
              onExport={exportComparison}
            />
          )}
        </div>
      )}
    </div>
  );
}
