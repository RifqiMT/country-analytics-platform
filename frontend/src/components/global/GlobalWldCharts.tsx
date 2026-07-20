import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getJson, type MetricDef, type SeriesPoint } from "../../api";
import { metricDisplayLabelFromId } from "../../lib/metricDisplay";
import { formatCompactNumber } from "../../lib/formatValue";
import { MIN_DATA_YEAR, maxSelectableYear } from "../../lib/yearBounds";
import { chunkMetricIds, COUNTRY_SERIES_CHUNK_SIZE } from "../../lib/metricChunks";
import { chunkLoadProgress } from "../../lib/loadProgress";
import LoadingProgressSection from "../ui/LoadingProgressSection";
import type { ChartRow } from "../../lib/chartSeries";
import { labourChartRows, mergeSeriesForLineChart } from "../../lib/chartSeries";
import {
  applyChartGranularity,
  GRANULARITY_DISCLAIMER,
  yearAxisTicksFromAnnualRows,
  type ChartGranularity,
} from "../../lib/chartGranularity";
import {
  ChartTooltipHeading,
  ChartTooltipSeriesList,
  ChartTooltipSeriesRow,
  ChartTooltipShell,
  RECHARTS_TOOLTIP_WRAPPER,
} from "../charts/ChartTooltipShell";
import ChartGranularityToggle from "../charts/ChartGranularityToggle";
import ChartTableToggle from "../charts/ChartTableToggle";
import SeriesLineDataTable, { type SeriesTableColumn } from "../charts/SeriesLineDataTable";
import { VisualizationStepperFromChildren } from "../charts/VisualizationStepper";
import AccordionSection from "../dashboard/AccordionSection";
import type { TooltipProps } from "recharts";

/** WLD chart tooltip: show % for share/rate series, compact K/Mn/Bn/Tn for levels. */
const WLD_TOOLTIP_PERCENT_KEYS = new Set([
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
]);

function wldTooltipFormatter(
  value: unknown,
  name: string,
  item: { dataKey?: string | number | undefined }
): [string, string] {
  const key = String(item?.dataKey ?? "");
  const label = String(name ?? "");
  if (value === null || value === undefined) return ["—", label];
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return ["—", label];
  if (WLD_TOOLTIP_PERCENT_KEYS.has(key)) return [`${n.toFixed(1)}%`, label];
  return [formatCompactNumber(n, { maxFrac: 2 }), label];
}

function wldTableColumn(key: string, label: string): SeriesTableColumn {
  return {
    key,
    label,
    format: WLD_TOOLTIP_PERCENT_KEYS.has(key) ? "percent" : "compact",
  };
}

function WldRechartsTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  const title =
    row && typeof row.periodLabel === "string" ? row.periodLabel : `Year ${label ?? ""}`;
  return (
    <ChartTooltipShell>
      <ChartTooltipHeading>{title}</ChartTooltipHeading>
      <ChartTooltipSeriesList>
        {payload.map((entry, i) => {
          const [valueStr, nameStr] = wldTooltipFormatter(entry.value, String(entry.name ?? ""), {
            dataKey: entry.dataKey,
          });
          const stroke = typeof entry.color === "string" ? entry.color : undefined;
          return (
            <ChartTooltipSeriesRow key={i} label={nameStr} value={valueStr} color={stroke} />
          );
        })}
      </ChartTooltipSeriesList>
    </ChartTooltipShell>
  );
}

type WldCardRenderCtx = {
  data: ChartRow[];
  xAxis: ReactElement;
  vizTitle: string;
};

function WldGranulatedCard({
  title,
  annualData,
  valueKeys,
  children,
}: {
  title: string;
  annualData: ChartRow[];
  valueKeys: readonly string[];
  children: (ctx: WldCardRenderCtx) => ReactNode;
}) {
  const [granularity, setGranularity] = useState<ChartGranularity>("annual");
  const data = useMemo(
    () => applyChartGranularity(annualData, valueKeys, granularity),
    [annualData, valueKeys, granularity]
  );
  const ticks = useMemo(
    () => (granularity === "annual" ? undefined : yearAxisTicksFromAnnualRows(annualData)),
    [granularity, annualData]
  );
  const xAxis = (
    <XAxis
      type="number"
      dataKey="periodKey"
      domain={["dataMin", "dataMax"]}
      ticks={ticks}
      tick={{ fontSize: 11, fill: "#64748b" }}
      tickFormatter={(v) => String(Math.round(v))}
    />
  );
  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">{title}</h3>
        <ChartGranularityToggle value={granularity} onChange={setGranularity} />
      </div>
      <div className="cap-wld-chart-host mt-3 flex h-72 min-h-[18rem] w-full min-w-0 flex-1 flex-col">
        {children({ data, xAxis, vizTitle: title })}
      </div>
      {granularity !== "annual" ? (
        <p className="mt-2 shrink-0 text-[10px] leading-relaxed text-slate-400">{GRANULARITY_DISCLAIMER}</p>
      ) : null}
    </div>
  );
}

type Bundle = Record<string, SeriesPoint[]>;

const WLD_REQUIRED_METRIC_IDS = [
  "gdp",
  "gdp_ppp",
  "gov_debt_usd",
  "gdp_per_capita",
  "gdp_per_capita_ppp",
  "gni_per_capita_atlas",
  "population",
  "inflation",
  "unemployment_ilo",
  "poverty_headcount",
  "poverty_national",
  "gov_debt_pct_gdp",
  "lending_rate",
  "maternal_mortality",
  "mortality_under5",
  "life_expectancy",
  "undernourishment",
  "hospital_beds",
  "physicians_density",
  "nurses_midwives_density",
  "uhc_service_coverage",
  "immunization_dpt",
  "immunization_measles",
  "health_expenditure_gdp",
  "smoking_prevalence",
  "birth_rate",
  "tb_incidence",
  "enrollment_primary_count",
  "enrollment_secondary_count",
  "enrollment_tertiary_count",
  "enrollment_primary_pct",
  "enrollment_secondary",
  "enrollment_tertiary_pct",
  "labor_force_total",
  "pop_age_0_14",
  "pop_15_64_pct",
  "pop_age_65_plus",
] as const;

const WLD_VIZ_META = [
  {
    title: "Global GDP & debt (WLD, US$)",
    summary: "World nominal and PPP GDP plus government debt in US dollars.",
  },
  {
    title: "Global GDP per capita & population (WLD)",
    summary: "Per-capita income (nominal & PPP) with total population on a second axis.",
  },
  {
    title: "Macro & poverty (WLD, % scale)",
    summary: "Inflation, unemployment, poverty, debt-to-GDP, and lending rate as shares or rates.",
  },
  {
    title: "Health — mortality (WLD)",
    summary: "Maternal mortality and under-five mortality over time.",
  },
  {
    title: "Health — life expectancy & undernourishment (WLD)",
    summary: "Life expectancy in years vs undernourishment prevalence (%).",
  },
  {
    title: "Health — systems capacity (WLD)",
    summary: "Hospital beds, physicians, and nurses/midwives density.",
  },
  {
    title: "Health — coverage, prevention & risk (WLD)",
    summary: "UHC index, vaccination rates, health spending, smoking prevalence, birth rate, and TB incidence.",
  },
  {
    title: "Education enrollment (WLD)",
    summary: "Enrollment headcounts and gross enrollment ratios by level.",
  },
  {
    title: "Labour (WLD, derived unemployed)",
    summary: "Derived unemployed count versus labour force size.",
  },
  {
    title: "Age structure shares (WLD, %)",
    summary: "Working-age, youth, and older population as shares of total.",
  },
] as const;

const WLD_FIN_META = WLD_VIZ_META.slice(0, 3);
const WLD_HEALTH_META = WLD_VIZ_META.slice(3, 7);
const WLD_EDU_META: readonly (typeof WLD_VIZ_META)[number][] = [WLD_VIZ_META[7]!];
const WLD_LABOUR_META = WLD_VIZ_META.slice(8, 10);

export default function GlobalWldCharts() {
  const [bundle, setBundle] = useState<Bundle>({});
  const [metricCatalog, setMetricCatalog] = useState<MetricDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);
  const chartEnd = maxSelectableYear();

  useEffect(() => {
    getJson<MetricDef[]>("/api/metrics").then(setMetricCatalog).catch(console.error);
  }, []);

  const L = (id: string) => metricDisplayLabelFromId(id, metricCatalog);

  useEffect(() => {
    const end = maxSelectableYear();
    let active = true;
    setLoading(true);
    setLoadProgress(8);
    setErr(null);
    setPartialWarning(null);
    const metricIds = WLD_REQUIRED_METRIC_IDS.filter((id) => metricCatalog.some((m) => m.id === id));
    if (metricIds.length === 0) {
      setBundle({});
      setLoading(false);
      setLoadProgress(0);
      return;
    }

    const metricChunks = chunkMetricIds(metricIds, COUNTRY_SERIES_CHUNK_SIZE);
    const run = async () => {
      const merged: Bundle = {};
      let successChunks = 0;
      for (let i = 0; i < metricChunks.length; i++) {
        const chunk = metricChunks[i]!;
        const query = encodeURIComponent(chunk.join(","));
        try {
          const r = await getJson<{ series: Bundle }>(
            `/api/global/wld-series?metrics=${query}&start=${MIN_DATA_YEAR}&end=${end}`
          );
          Object.assign(merged, r.series ?? {});
          successChunks += 1;
        } catch {
          // Continue loading remaining chunks so one failure does not blank charts.
        } finally {
          if (!active) return;
          const pct = chunkLoadProgress(i + 1, metricChunks.length);
          setLoadProgress(pct);
        }
      }
      if (!active) return;
      if (successChunks === 0) {
        setErr("Global chart data failed to load. Please retry.");
        setBundle({});
        setLoadProgress(0);
      } else {
        setBundle(merged);
        const failedChunks = metricChunks.length - successChunks;
        if (failedChunks > 0) {
          setPartialWarning(
            `Partial data loaded: ${failedChunks} of ${metricChunks.length} data batches failed. Charts show available series; retry for full coverage.`
          );
        }
        setLoadProgress(100);
      }
      setLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, [metricCatalog]);

  const labour = useMemo(() => labourChartRows(bundle, MIN_DATA_YEAR, chartEnd), [bundle, chartEnd]);

  const gdpLevels = useMemo(
    () => mergeSeriesForLineChart(bundle, ["gdp", "gdp_ppp", "gov_debt_usd"], MIN_DATA_YEAR, chartEnd),
    [bundle, chartEnd]
  );
  const gdpPcPop = useMemo(
    () =>
      mergeSeriesForLineChart(
        bundle,
        ["gdp_per_capita", "gdp_per_capita_ppp", "gni_per_capita_atlas", "population"],
        MIN_DATA_YEAR,
        chartEnd
      ),
    [bundle, chartEnd]
  );
  const macro = useMemo(
    () =>
      mergeSeriesForLineChart(bundle, [
        "inflation",
        "unemployment_ilo",
        "poverty_headcount",
        "poverty_national",
        "gov_debt_pct_gdp",
        "lending_rate",
      ], MIN_DATA_YEAR, chartEnd),
    [bundle, chartEnd]
  );
  const healthMortality = useMemo(
    () => mergeSeriesForLineChart(bundle, ["maternal_mortality", "mortality_under5"], MIN_DATA_YEAR, chartEnd),
    [bundle, chartEnd]
  );
  const healthLife = useMemo(
    () => mergeSeriesForLineChart(bundle, ["life_expectancy", "undernourishment"], MIN_DATA_YEAR, chartEnd),
    [bundle, chartEnd]
  );
  const healthSystems = useMemo(
    () =>
      mergeSeriesForLineChart(
        bundle,
        ["hospital_beds", "physicians_density", "nurses_midwives_density"],
        MIN_DATA_YEAR,
        chartEnd
      ),
    [bundle, chartEnd]
  );
  const healthCoverage = useMemo(
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
        MIN_DATA_YEAR,
        chartEnd
      ),
    [bundle, chartEnd]
  );
  const edu = useMemo(
    () =>
      mergeSeriesForLineChart(bundle, [
        "enrollment_primary_count",
        "enrollment_secondary_count",
        "enrollment_tertiary_count",
        "enrollment_primary_pct",
        "enrollment_secondary",
        "enrollment_tertiary_pct",
      ], MIN_DATA_YEAR, chartEnd),
    [bundle, chartEnd]
  );
  const age = useMemo(
    () => mergeSeriesForLineChart(bundle, ["pop_age_0_14", "pop_15_64_pct", "pop_age_65_plus"], MIN_DATA_YEAR, chartEnd),
    [bundle, chartEnd]
  );

  const hasAnyChartData = useMemo(
    () => Object.values(bundle).some((arr) => arr.some((p) => p.value !== null && !Number.isNaN(p.value))),
    [bundle]
  );

  if (loading) {
    return (
      <LoadingProgressSection
        variant="muted"
        label="Loading global chart data…"
        progress={loadProgress}
      />
    );
  }
  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!hasAnyChartData) {
    return <p className="text-sm text-slate-500">Global chart data is temporarily unavailable. Please retry.</p>;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-1">
      {partialWarning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {partialWarning}
        </div>
      ) : null}
      <p className="text-xs leading-relaxed text-slate-500">
        WLD series use the same API as the country dashboard: the last published value may be carried forward by up to
        three years at the end of the range. GDP levels and per-capita scales are split so lines stay readable. Groups
        mirror the country dashboard: Financial, Health &amp; demographics, Education, and Labour.
      </p>

      <AccordionSection title="Financial metrics" defaultOpen>
        <p className="mb-3 text-xs text-slate-500">
          World aggregate (WLD) GDP, debt, per-capita income, population, and macro / poverty rates — same themes as the
          financial block on the country dashboard.
        </p>
        <VisualizationStepperFromChildren groupLabel="Financial (WLD)" meta={WLD_FIN_META}>
      <WldGranulatedCard
        title="Global GDP & debt (WLD, US$)"
        annualData={gdpLevels}
        valueKeys={["gdp", "gdp_ppp", "gov_debt_usd"]}
      >
        {({ data, xAxis, vizTitle }) => (
          <ChartTableToggle
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            vizTitle={vizTitle}
            chart={
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 0 })}
                  />
                  <Tooltip
                    wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                    content={WldRechartsTooltip}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="gdp_ppp"
                    name={L("gdp_ppp")}
                    stroke="#c0713d"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="gdp"
                    name={L("gdp")}
                    stroke="#d13d54"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="gov_debt_usd"
                    name={L("gov_debt_usd")}
                    stroke="#913030"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
            table={
              <SeriesLineDataTable
                rows={data as Record<string, unknown>[]}
                columns={[
                  wldTableColumn("gdp_ppp", L("gdp_ppp")),
                  wldTableColumn("gdp", L("gdp")),
                  wldTableColumn("gov_debt_usd", L("gov_debt_usd")),
                ]}
              />
            }
          />
        )}
      </WldGranulatedCard>

      <WldGranulatedCard
        title="Global GDP / GNI per capita & population (WLD)"
        annualData={gdpPcPop}
        valueKeys={["gdp_per_capita", "gdp_per_capita_ppp", "gni_per_capita_atlas", "population"]}
      >
        {({ data, xAxis, vizTitle }) => (
          <ChartTableToggle
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            vizTitle={vizTitle}
            chart={
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 0 })}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 1 })}
                  />
                  <Tooltip
                    wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                    content={WldRechartsTooltip}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="gdp_per_capita"
                    name={L("gdp_per_capita")}
                    stroke="#ea580c"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="gdp_per_capita_ppp"
                    name={L("gdp_per_capita_ppp")}
                    stroke="#ca8a04"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="gni_per_capita_atlas"
                    name={L("gni_per_capita_atlas")}
                    stroke="#0d9488"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="population"
                    name={L("population")}
                    stroke="#333d47"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
            table={
              <SeriesLineDataTable
                rows={data as Record<string, unknown>[]}
                columns={[
                  wldTableColumn("gdp_per_capita", L("gdp_per_capita")),
                  wldTableColumn("gdp_per_capita_ppp", L("gdp_per_capita_ppp")),
                  wldTableColumn("gni_per_capita_atlas", L("gni_per_capita_atlas")),
                  wldTableColumn("population", L("population")),
                ]}
              />
            }
          />
        )}
      </WldGranulatedCard>

      <WldGranulatedCard
        title="Macro & poverty (WLD, % scale)"
        annualData={macro}
        valueKeys={[
          "inflation",
          "unemployment_ilo",
          "poverty_headcount",
          "poverty_national",
          "gov_debt_pct_gdp",
          "lending_rate",
        ]}
      >
        {({ data, xAxis, vizTitle }) => (
          <ChartTableToggle
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            vizTitle={vizTitle}
            chart={
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                    content={WldRechartsTooltip}
                  />
                  <Line
                    type="monotone"
                    dataKey="gov_debt_pct_gdp"
                    name={L("gov_debt_pct_gdp")}
                    stroke="#78350f"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="poverty_headcount"
                    name={L("poverty_headcount")}
                    stroke="#b91c1c"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="poverty_national"
                    name={L("poverty_national")}
                    stroke="#991b1b"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="inflation"
                    name={L("inflation")}
                    stroke="#ea580c"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="unemployment_ilo"
                    name={L("unemployment_ilo")}
                    stroke="#16a34a"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="lending_rate"
                    name={L("lending_rate")}
                    stroke="#2563eb"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
            table={
              <SeriesLineDataTable
                rows={data as Record<string, unknown>[]}
                columns={[
                  wldTableColumn("gov_debt_pct_gdp", L("gov_debt_pct_gdp")),
                  wldTableColumn("poverty_headcount", L("poverty_headcount")),
                  wldTableColumn("poverty_national", L("poverty_national")),
                  wldTableColumn("inflation", L("inflation")),
                  wldTableColumn("unemployment_ilo", L("unemployment_ilo")),
                  wldTableColumn("lending_rate", L("lending_rate")),
                ]}
              />
            }
          />
        )}
      </WldGranulatedCard>
        </VisualizationStepperFromChildren>
      </AccordionSection>

      <AccordionSection title="Health & demographics" defaultOpen>
        <p className="mb-3 text-xs text-slate-500">
          Mortality, life expectancy, and nutrition — aligned with the health &amp; demographics section on the country
          dashboard.
        </p>
        <VisualizationStepperFromChildren groupLabel="Health (WLD)" meta={WLD_HEALTH_META}>
      <WldGranulatedCard
        title="Health — mortality (WLD)"
        annualData={healthMortality}
        valueKeys={["maternal_mortality", "mortality_under5"]}
      >
        {({ data, xAxis, vizTitle }) => (
          <ChartTableToggle
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            vizTitle={vizTitle}
            chart={
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                    content={WldRechartsTooltip}
                  />
                  <Line
                    type="monotone"
                    dataKey="maternal_mortality"
                    name={L("maternal_mortality")}
                    stroke="#dc2626"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="mortality_under5"
                    name={L("mortality_under5")}
                    stroke="#ea580c"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
            table={
              <SeriesLineDataTable
                rows={data as Record<string, unknown>[]}
                columns={[
                  wldTableColumn("maternal_mortality", L("maternal_mortality")),
                  wldTableColumn("mortality_under5", L("mortality_under5")),
                ]}
              />
            }
          />
        )}
      </WldGranulatedCard>

      <WldGranulatedCard
        title="Health — life expectancy & undernourishment (WLD)"
        annualData={healthLife}
        valueKeys={["life_expectancy", "undernourishment"]}
      >
        {({ data, xAxis, vizTitle }) => (
          <ChartTableToggle
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            vizTitle={vizTitle}
            chart={
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => `${v}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                    content={WldRechartsTooltip}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="life_expectancy"
                    name={L("life_expectancy")}
                    stroke="#0f766e"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="undernourishment"
                    name={L("undernourishment")}
                    stroke="#22c55e"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
            table={
              <SeriesLineDataTable
                rows={data as Record<string, unknown>[]}
                columns={[
                  wldTableColumn("life_expectancy", L("life_expectancy")),
                  wldTableColumn("undernourishment", L("undernourishment")),
                ]}
              />
            }
          />
        )}
      </WldGranulatedCard>
      <WldGranulatedCard
        title="Health — systems capacity (WLD)"
        annualData={healthSystems}
        valueKeys={["hospital_beds", "physicians_density", "nurses_midwives_density"]}
      >
        {({ data, xAxis, vizTitle }) => (
          <ChartTableToggle
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            vizTitle={vizTitle}
            chart={
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                    content={WldRechartsTooltip}
                  />
                  <Line type="monotone" dataKey="hospital_beds" name={L("hospital_beds")} stroke="#2563eb" dot={false} strokeWidth={2} connectNulls={false} />
                  <Line type="monotone" dataKey="physicians_density" name={L("physicians_density")} stroke="#059669" dot={false} strokeWidth={2} connectNulls={false} />
                  <Line type="monotone" dataKey="nurses_midwives_density" name={L("nurses_midwives_density")} stroke="#7c3aed" dot={false} strokeWidth={2} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            }
            table={
              <SeriesLineDataTable
                rows={data as Record<string, unknown>[]}
                columns={[
                  wldTableColumn("hospital_beds", L("hospital_beds")),
                  wldTableColumn("physicians_density", L("physicians_density")),
                  wldTableColumn("nurses_midwives_density", L("nurses_midwives_density")),
                ]}
              />
            }
          />
        )}
      </WldGranulatedCard>
      <WldGranulatedCard
        title="Health — coverage, prevention & risk (WLD)"
        annualData={healthCoverage}
        valueKeys={[
          "uhc_service_coverage",
          "immunization_dpt",
          "immunization_measles",
          "health_expenditure_gdp",
          "smoking_prevalence",
          "birth_rate",
          "tb_incidence",
        ]}
      >
        {({ data, xAxis, vizTitle }) => (
          <ChartTableToggle
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            vizTitle={vizTitle}
            chart={
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                    content={WldRechartsTooltip}
                  />
                  <Line type="monotone" dataKey="uhc_service_coverage" name={L("uhc_service_coverage")} stroke="#0f766e" dot={false} strokeWidth={2} connectNulls={false} />
                  <Line type="monotone" dataKey="immunization_dpt" name={L("immunization_dpt")} stroke="#16a34a" dot={false} strokeWidth={2} connectNulls={false} />
                  <Line type="monotone" dataKey="immunization_measles" name={L("immunization_measles")} stroke="#22c55e" dot={false} strokeWidth={2} connectNulls={false} />
                  <Line type="monotone" dataKey="health_expenditure_gdp" name={L("health_expenditure_gdp")} stroke="#ea580c" dot={false} strokeWidth={2} connectNulls={false} />
                  <Line type="monotone" dataKey="smoking_prevalence" name={L("smoking_prevalence")} stroke="#b91c1c" dot={false} strokeWidth={2} connectNulls={false} />
                  <Line type="monotone" dataKey="birth_rate" name={L("birth_rate")} stroke="#1d4ed8" dot={false} strokeWidth={2} connectNulls={false} />
                  <Line type="monotone" dataKey="tb_incidence" name={L("tb_incidence")} stroke="#7c2d12" dot={false} strokeWidth={2} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            }
            table={
              <SeriesLineDataTable
                rows={data as Record<string, unknown>[]}
                columns={[
                  wldTableColumn("uhc_service_coverage", L("uhc_service_coverage")),
                  wldTableColumn("immunization_dpt", L("immunization_dpt")),
                  wldTableColumn("immunization_measles", L("immunization_measles")),
                  wldTableColumn("health_expenditure_gdp", L("health_expenditure_gdp")),
                  wldTableColumn("smoking_prevalence", L("smoking_prevalence")),
                  wldTableColumn("birth_rate", L("birth_rate")),
                  wldTableColumn("tb_incidence", L("tb_incidence")),
                ]}
              />
            }
          />
        )}
      </WldGranulatedCard>
        </VisualizationStepperFromChildren>
      </AccordionSection>

      <AccordionSection title="Education" defaultOpen>
        <p className="mb-3 text-xs text-slate-500">WLD enrollment headcounts and gross enrollment ratios by level.</p>
        <VisualizationStepperFromChildren groupLabel="Education (WLD)" meta={WLD_EDU_META}>
      <WldGranulatedCard
        title="Education enrollment (WLD)"
        annualData={edu}
        valueKeys={[
          "enrollment_primary_count",
          "enrollment_secondary_count",
          "enrollment_tertiary_count",
          "enrollment_primary_pct",
          "enrollment_secondary",
          "enrollment_tertiary_pct",
        ]}
      >
        {({ data, xAxis, vizTitle }) => (
          <ChartTableToggle
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            vizTitle={vizTitle}
            chart={
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 0 })}
                  />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                    content={WldRechartsTooltip}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="enrollment_primary_count"
                    name={L("enrollment_primary_count")}
                    stroke="#0d9488"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="enrollment_secondary_count"
                    name={L("enrollment_secondary_count")}
                    stroke="#b45309"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="enrollment_tertiary_count"
                    name={L("enrollment_tertiary_count")}
                    stroke="#1d4ed8"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="enrollment_primary_pct"
                    name={L("enrollment_primary_pct")}
                    stroke="#115e59"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="enrollment_secondary"
                    name={L("enrollment_secondary")}
                    stroke="#92400e"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="enrollment_tertiary_pct"
                    name={L("enrollment_tertiary_pct")}
                    stroke="#4338ca"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
            table={
              <SeriesLineDataTable
                rows={data as Record<string, unknown>[]}
                columns={[
                  wldTableColumn("enrollment_primary_count", L("enrollment_primary_count")),
                  wldTableColumn("enrollment_secondary_count", L("enrollment_secondary_count")),
                  wldTableColumn("enrollment_tertiary_count", L("enrollment_tertiary_count")),
                  wldTableColumn("enrollment_primary_pct", L("enrollment_primary_pct")),
                  wldTableColumn("enrollment_secondary", L("enrollment_secondary")),
                  wldTableColumn("enrollment_tertiary_pct", L("enrollment_tertiary_pct")),
                ]}
              />
            }
          />
        )}
      </WldGranulatedCard>
        </VisualizationStepperFromChildren>
      </AccordionSection>

      <AccordionSection title="Labour" defaultOpen>
        <p className="mb-3 text-xs text-slate-500">
          Derived unemployed count vs labour force and age-structure shares — same labour framing as the country
          dashboard.
        </p>
        <VisualizationStepperFromChildren groupLabel="Labour (WLD)" meta={WLD_LABOUR_META}>
      <WldGranulatedCard title="Labour (WLD, derived unemployed)" annualData={labour} valueKeys={["unemployed", "labour"]}>
        {({ data, xAxis, vizTitle }) => (
          <ChartTableToggle
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            vizTitle={vizTitle}
            chart={
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 1 })}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 1 })}
                  />
                  <Tooltip
                    wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                    content={WldRechartsTooltip}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="unemployed"
                    name={L("unemployed")}
                    stroke="#dc2626"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="labour"
                    name={L("labour")}
                    stroke="#38bdf8"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
            table={
              <SeriesLineDataTable
                rows={data as Record<string, unknown>[]}
                columns={[
                  wldTableColumn("unemployed", L("unemployed")),
                  wldTableColumn("labour", L("labour")),
                ]}
              />
            }
          />
        )}
      </WldGranulatedCard>

      <WldGranulatedCard title="Age structure shares (WLD, %)" annualData={age} valueKeys={["pop_15_64_pct", "pop_age_0_14", "pop_age_65_plus"]}>
        {({ data, xAxis, vizTitle }) => (
          <ChartTableToggle
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            vizTitle={vizTitle}
            chart={
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  <YAxis domain={[0, 90]} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                    content={WldRechartsTooltip}
                  />
                  <Line
                    type="monotone"
                    dataKey="pop_15_64_pct"
                    name={L("pop_15_64_pct")}
                    stroke="#2563eb"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pop_age_0_14"
                    name={L("pop_age_0_14")}
                    stroke="#dc2626"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pop_age_65_plus"
                    name={L("pop_age_65_plus")}
                    stroke="#ea580c"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
            table={
              <SeriesLineDataTable
                rows={data as Record<string, unknown>[]}
                columns={[
                  wldTableColumn("pop_15_64_pct", L("pop_15_64_pct")),
                  wldTableColumn("pop_age_0_14", L("pop_age_0_14")),
                  wldTableColumn("pop_age_65_plus", L("pop_age_65_plus")),
                ]}
              />
            }
          />
        )}
      </WldGranulatedCard>
        </VisualizationStepperFromChildren>
      </AccordionSection>
    </div>
  );
}
