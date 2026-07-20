import { useCallback, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesProvenance } from "../../api";
import { CHART_POINT_PROVENANCE_KEY, type ChartRow } from "../../lib/chartSeries";
import { provenanceLabel } from "../../lib/provenanceLabels";
import {
  applyChartGranularity,
  GRANULARITY_DISCLAIMER,
  yearAxisTicksFromAnnualRows,
  type ChartGranularity,
} from "../../lib/chartGranularity";
import { growthLabelForGranularity } from "../../lib/chartTooltipGrowth";
import { formatCompactNumber } from "../../lib/formatValue";
import { computeChartPointGrowth } from "../../lib/chartTooltipGrowth";
import { ChartTooltipPortal } from "../charts/ChartTooltipPortal";
import {
  ChartTooltipFootnote,
  ChartTooltipHeading,
  ChartTooltipSeriesList,
  ChartTooltipSeriesRow,
  ChartTooltipShell,
  RECHARTS_TOOLTIP_WRAPPER,
} from "../charts/ChartTooltipShell";
import ChartGranularityToggle from "../charts/ChartGranularityToggle";
import ChartTableToggle from "../charts/ChartTableToggle";
import SeriesLineDataTable, {
  exportSeriesTableCsv,
  type SeriesTableColumn,
} from "../charts/SeriesLineDataTable";

export type SeriesSpec = {
  key: string;
  label: string;
  color: string;
  yAxisId?: "left" | "right";
  tickFormatter?: (v: number) => string;
  /** Tooltip: `percent` → fixed decimals + %; default compact K / Mn / Bn / Tn. */
  tooltipFormat?: "compact" | "percent";
  /** Use basis points for tooltip growth badge on rate-like metrics. */
  changePreferBps?: boolean;
  /** SVG stroke dash pattern, e.g. `"6 4"` for dashed lines. */
  strokeDasharray?: string;
  strokeWidth?: number;
};

type Props = {
  title?: string;
  data: Record<string, number | string | null | undefined>[];
  series: SeriesSpec[];
  leftTickFormatter?: (v: number) => string;
  rightTickFormatter?: (v: number) => string;
  dualAxis?: boolean;
  /** When false (default), gaps in the source data break the line instead of bridging across nulls. */
  connectNulls?: boolean;
  /** Shown under the chart (e.g. how sparse WDI series are extended for display). */
  footnote?: string;
};

function LineChartTooltipBody(props: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    name?: string | number;
    value?: unknown;
    payload?: ChartRow;
  }>;
  specByKey: Record<string, SeriesSpec>;
  formatTooltipValue: (dataKey: string, raw: unknown) => string;
  chartData: ChartRow[];
  granularity: ChartGranularity;
}) {
  const { active, payload, label, specByKey, formatTooltipValue, chartData, granularity } = props;
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const provBag = row
    ? ((row as Record<string, unknown>)[CHART_POINT_PROVENANCE_KEY] as
        | Partial<Record<string, SeriesProvenance>>
        | undefined)
    : undefined;
  const periodLabel =
    row && typeof row.periodLabel === "string" ? row.periodLabel : `Year ${label ?? ""}`;
  const scrollable = payload.length > 4;
  const growthHint = growthLabelForGranularity(granularity);

  const rows = payload
    .map((item, i) => {
      const key = String(item.dataKey ?? "");
      const name = String(item.name ?? specByKey[key]?.label ?? key);
      const pl = provenanceLabel(provBag?.[key]);
      const entry = item as { color?: string };
      const dot = specByKey[key]?.color ?? entry.color;
      const growth = computeChartPointGrowth(chartData, row, key, granularity, {
        preferBps: specByKey[key]?.changePreferBps,
      });
      const formatted = formatTooltipValue(key, item.value);
      return { i, key, name, pl, dot, growth, formatted, raw: item.value };
    })
    .filter((r) => r.formatted !== "—" || r.growth != null)
    .sort((a, b) => {
      const av = Number(a.raw);
      const bv = Number(b.raw);
      if (Number.isFinite(av) && Number.isFinite(bv)) return bv - av;
      if (Number.isFinite(av)) return -1;
      if (Number.isFinite(bv)) return 1;
      return 0;
    });

  if (rows.length === 0) return null;

  return (
    <ChartTooltipShell>
      <ChartTooltipHeading
        sticky={scrollable}
        hint="Period"
        trailing={
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-slate-600">
            {growthHint}
          </span>
        }
      >
        {periodLabel}
      </ChartTooltipHeading>
      <ChartTooltipSeriesList scrollable={scrollable}>
        {rows.map((r) => (
          <ChartTooltipSeriesRow
            key={r.i}
            label={r.name}
            value={r.formatted}
            color={typeof r.dot === "string" ? r.dot : undefined}
            meta={r.pl ?? undefined}
            change={r.growth}
          />
        ))}
      </ChartTooltipSeriesList>
      {granularity !== "annual" ? (
        <ChartTooltipFootnote>Sub-annual points are interpolated from annual source data.</ChartTooltipFootnote>
      ) : null}
    </ChartTooltipShell>
  );
}

export default function ToggleLineChart({
  title = "Metrics displayed",
  data,
  series,
  leftTickFormatter,
  rightTickFormatter,
  dualAxis = true,
  connectNulls = false,
  footnote,
}: Props) {
  const chartAnchorRef = useRef<HTMLDivElement>(null);
  const [granularity, setGranularity] = useState<ChartGranularity>("annual");
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(series.map((s) => [s.key, true]))
  );

  const valueKeys = useMemo(() => series.map((s) => s.key), [series]);
  const chartData = useMemo(
    () => applyChartGranularity(data as ChartRow[], valueKeys, granularity),
    [data, valueKeys, granularity]
  );
  const yearTicks = useMemo(() => yearAxisTicksFromAnnualRows(data as ChartRow[]), [data]);

  const hasRight = useMemo(
    () => series.some((s) => (s.yAxisId ?? "left") === "right"),
    [series]
  );

  const specByKey = useMemo(() => Object.fromEntries(series.map((s) => [s.key, s])), [series]);

  const toggle = (key: string) => setOn((o) => ({ ...o, [key]: !o[key] }));

  const formatTooltipValue = (dataKey: string, raw: unknown): string => {
    if (raw === null || raw === undefined) return "—";
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return "—";
    const spec = specByKey[dataKey];
    if (spec?.tooltipFormat === "percent") return `${n.toFixed(1)}%`;
    return formatCompactNumber(n, { maxFrac: 2 });
  };

  const tableColumns: SeriesTableColumn[] = useMemo(
    () =>
      series
        .filter((s) => on[s.key])
        .map((s) => ({
          key: s.key,
          label: s.label,
          format: s.tooltipFormat === "percent" ? ("percent" as const) : ("compact" as const),
        })),
    [series, on]
  );

  const exportTableCsv = useCallback(() => {
    const base = title
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase()
      .slice(0, 80);
    exportSeriesTableCsv(
      `${base || "metrics"}_table.csv`,
      chartData as Record<string, unknown>[],
      tableColumns
    );
  }, [title, chartData, tableColumns]);

  return (
    <div className="cap-line-chart-root rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <ChartGranularityToggle value={granularity} onChange={setGranularity} />
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {series.map((s) => {
          const active = on[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "border-slate-300 bg-slate-50 text-slate-800"
                  : "border-transparent bg-transparent text-slate-400 line-through opacity-60"
              }`}
            >
              <span
                className="h-0 w-4 shrink-0"
                style={{
                  borderTop: `${s.strokeWidth ?? 2}px ${s.strokeDasharray ? "dashed" : "solid"} ${active ? s.color : "#cbd5e1"}`,
                }}
                aria-hidden
              />
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>
      <div className="cap-line-chart-shell h-80 w-full">
        <ChartTableToggle
          className="h-full w-full"
          vizTitle={title}
          onExportCsv={exportTableCsv}
          chart={
            <div ref={chartAnchorRef} className="h-full w-full min-h-0 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: dualAxis && hasRight ? 20 : 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="periodKey"
                  domain={["dataMin", "dataMax"]}
                  ticks={granularity === "annual" ? undefined : yearTicks}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => String(Math.round(v))}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={leftTickFormatter}
                />
                {dualAxis && hasRight && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={rightTickFormatter}
                  />
                )}
                <Tooltip
                  wrapperStyle={{ ...RECHARTS_TOOLTIP_WRAPPER, display: "none" }}
                  allowEscapeViewBox={{ x: true, y: true }}
                  isAnimationActive={false}
                  cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "5 5" }}
                  content={(tooltipProps) => (
                    <ChartTooltipPortal
                      active={tooltipProps.active}
                      coordinate={tooltipProps.coordinate}
                      anchorRef={chartAnchorRef}
                    >
                      <LineChartTooltipBody
                        active={tooltipProps.active}
                        label={tooltipProps.label}
                        payload={tooltipProps.payload}
                        specByKey={specByKey}
                        formatTooltipValue={formatTooltipValue}
                        chartData={chartData}
                        granularity={granularity}
                      />
                    </ChartTooltipPortal>
                  )}
                />
                {series.map((s) =>
                  on[s.key] ? (
                    <Line
                      key={s.key}
                      yAxisId={dualAxis ? s.yAxisId ?? "left" : "left"}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={s.strokeWidth ?? 2}
                      strokeDasharray={s.strokeDasharray}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, fill: s.color }}
                      connectNulls={connectNulls}
                    />
                  ) : null
                )}
              </LineChart>
            </ResponsiveContainer>
            </div>
          }
          table={
            <SeriesLineDataTable rows={chartData as Record<string, unknown>[]} columns={tableColumns} />
          }
        />
      </div>
      {granularity !== "annual" ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">{GRANULARITY_DISCLAIMER}</p>
      ) : null}
      {footnote ? (
        <p className={`text-xs leading-relaxed text-slate-400 ${granularity !== "annual" ? "mt-1" : "mt-3"}`}>
          {footnote}
        </p>
      ) : null}
    </div>
  );
}
