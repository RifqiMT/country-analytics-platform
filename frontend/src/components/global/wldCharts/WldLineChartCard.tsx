import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { MetricDef } from "../../../api";
import { metricDisplayLabelFromId } from "../../../lib/metricDisplay";
import { formatCompactNumber } from "../../../lib/formatValue";
import type { ChartRow } from "../../../lib/chartSeries";
import { labourChartRows, mergeSeriesForLineChart } from "../../../lib/chartSeries";
import {
  applyChartGranularity,
  GRANULARITY_DISCLAIMER,
  yearAxisTicksFromAnnualRows,
  type ChartGranularity,
} from "../../../lib/chartGranularity";
import {
  ChartTooltipHeading,
  ChartTooltipSeriesList,
  ChartTooltipSeriesRow,
  ChartTooltipShell,
  RECHARTS_TOOLTIP_WRAPPER,
} from "../../charts/ChartTooltipShell";
import ChartGranularityToggle from "../../charts/ChartGranularityToggle";
import ChartTableToggle from "../../charts/ChartTableToggle";
import SeriesLineDataTable, { type SeriesTableColumn } from "../../charts/SeriesLineDataTable";
import LoadingProgressSection from "../../ui/LoadingProgressSection";
import { WLD_PERCENT_KEYS, type WldChartDef } from "./catalog";
import { resolveWldChartAxes } from "./axisScale";
import { useWldChartSeries } from "./useWldChartSeries";

/** Explicit px height — percent height collapses inside stepper / flex hosts. */
const CHART_HEIGHT_PX = 288;

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
  if (WLD_PERCENT_KEYS.has(key)) return [`${n.toFixed(1)}%`, label];
  return [formatCompactNumber(n, { maxFrac: 2 }), label];
}

function wldTableColumn(key: string, label: string): SeriesTableColumn {
  return {
    key,
    label,
    format: WLD_PERCENT_KEYS.has(key) ? "percent" : "compact",
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

type CardRenderCtx = {
  data: ChartRow[];
  xAxis: ReactElement;
  vizTitle: string;
};

function WldGranulatedShell({
  title,
  annualData,
  valueKeys,
  children,
}: {
  title: string;
  annualData: ChartRow[];
  valueKeys: readonly string[];
  children: (ctx: CardRenderCtx) => ReactNode;
}) {
  const [granularity, setGranularity] = useState<ChartGranularity>("annual");
  const data = useMemo(
    () => applyChartGranularity(annualData, valueKeys, granularity),
    [annualData, valueKeys, granularity]
  );
  const hasPlottable = useMemo(
    () =>
      annualData.some((row) =>
        valueKeys.some((k) => {
          const v = row[k];
          return typeof v === "number" && Number.isFinite(v);
        })
      ),
    [annualData, valueKeys]
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
    <div className="flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">{title}</h3>
        {hasPlottable ? (
          <ChartGranularityToggle value={granularity} onChange={setGranularity} />
        ) : null}
      </div>
      <div
        className="cap-wld-chart-host mt-3 w-full min-w-0"
        style={{ height: CHART_HEIGHT_PX, minHeight: CHART_HEIGHT_PX }}
      >
        {hasPlottable ? (
          children({ data, xAxis, vizTitle: title })
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
            No world-aggregate (WLD) values available for this chart yet.
          </div>
        )}
      </div>
      {hasPlottable && granularity !== "annual" ? (
        <p className="mt-2 shrink-0 text-[10px] leading-relaxed text-slate-400">{GRANULARITY_DISCLAIMER}</p>
      ) : null}
    </div>
  );
}

export default function WldLineChartCard({
  def,
  metricCatalog,
  enabled,
}: {
  def: WldChartDef;
  metricCatalog: MetricDef[];
  /** When false, skip fetch (accordion still closed). */
  enabled: boolean;
}) {
  const state = useWldChartSeries(def.metricIds, enabled);
  const L = (id: string) => metricDisplayLabelFromId(id, metricCatalog);

  const annualData = useMemo(() => {
    if (!state.loaded) return [];
    if (def.kind === "labour") {
      // Backend already applies short terminal carry; do not invent further on the client.
      return labourChartRows(state.series, state.start, state.end);
    }
    return mergeSeriesForLineChart(state.series, def.valueKeys, state.start, state.end);
  }, [def, state]);

  const { dual, lines } = useMemo(
    () => resolveWldChartAxes(def, annualData),
    [def, annualData]
  );

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        Open this section to load chart data.
      </div>
    );
  }

  if (state.loading || !state.loaded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">{def.title}</h3>
        <LoadingProgressSection
          variant="muted"
          label={`Loading ${def.title}…`}
          progress={state.progress || 10}
        />
      </div>
    );
  }

  if (state.err) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="font-semibold">{def.title}</p>
        <p className="mt-1">{state.err}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {state.warning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {state.warning}
        </div>
      ) : null}
      <WldGranulatedShell title={def.title} annualData={annualData} valueKeys={def.valueKeys}>
        {({ data, xAxis, vizTitle }) => (
          <ChartTableToggle
            className="flex h-full w-full flex-col"
            vizTitle={vizTitle}
            chart={
              <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
                <LineChart data={data} margin={{ top: 8, right: dual ? 12 : 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 0 })}
                    width={52}
                  />
                  {dual ? (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 0 })}
                      width={52}
                    />
                  ) : null}
                  <Tooltip
                    wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                    content={WldRechartsTooltip}
                  />
                  {lines.map((line) => (
                    <Line
                      key={line.key}
                      yAxisId={line.yAxisId ?? "left"}
                      type="monotone"
                      dataKey={line.key}
                      name={
                        line.key === "unemployed"
                          ? "Unemployed (number)"
                          : line.key === "labour"
                            ? "Labour force (total)"
                            : L(line.key)
                      }
                      stroke={line.color}
                      dot={false}
                      strokeWidth={2}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            }
            table={
              <SeriesLineDataTable
                rows={data as Record<string, unknown>[]}
                columns={def.valueKeys.map((k) =>
                  wldTableColumn(
                    k,
                    k === "unemployed"
                      ? "Unemployed (number)"
                      : k === "labour"
                        ? "Labour force (total)"
                        : L(k)
                  )
                )}
              />
            }
          />
        )}
      </WldGranulatedShell>
    </div>
  );
}
