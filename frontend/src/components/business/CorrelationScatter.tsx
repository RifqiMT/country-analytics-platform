import { useCallback, useMemo, useState } from "react";
import { cmpNullableNumber, cmpString, toggleColumnSort, type SortDir } from "../../lib/tableSort";
import SortableTh from "../ui/SortableTh";
import {
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactNumber } from "../../lib/formatValue";
import {
  ChartTooltipHeading,
  ChartTooltipSeriesList,
  ChartTooltipSeriesRow,
  ChartTooltipShell,
  RECHARTS_TOOLTIP_WRAPPER,
} from "../charts/ChartTooltipShell";
import ChartTableToggle from "../charts/ChartTableToggle";

type Point = {
  countryIso3: string;
  countryName: string;
  year: number;
  x: number;
  y: number;
  isHighlight: boolean;
};

function CorrelationTooltip({
  active,
  payload,
  labelX,
  labelY,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  labelX: string;
  labelY: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as Point | undefined;
  if (!p) return null;
  return (
    <ChartTooltipShell>
      <ChartTooltipHeading>
        {p.countryName}
        <span className="font-medium text-slate-500"> · </span>
        <span className="font-medium tabular-nums text-slate-600">{p.year}</span>
      </ChartTooltipHeading>
      <ChartTooltipSeriesList>
        <ChartTooltipSeriesRow
          label={labelX}
          value={formatCompactNumber(p.x, { maxFrac: 2 })}
          color="#0d9488"
        />
        <ChartTooltipSeriesRow
          label={labelY}
          value={formatCompactNumber(p.y, { maxFrac: 2 })}
          color="#38bdf8"
        />
      </ChartTooltipSeriesList>
    </ChartTooltipShell>
  );
}

function padDomain(min: number, max: number, frac = 0.06): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const d = Math.abs(min) * frac || 1;
    return [min - d, max + d];
  }
  const span = max - min;
  const pad = Math.max(span * frac, span * 0.02);
  return [min - pad, max + pad];
}

type Props = {
  points: Point[];
  ciBand: { x: number; yLower: number; yUpper: number }[];
  slope: number | null;
  intercept: number | null;
  labelX: string;
  labelY: string;
  highlightName: string;
  correlation: number | null;
};

export default function CorrelationScatter({
  points,
  ciBand,
  slope,
  intercept,
  labelX,
  labelY,
  highlightName,
  correlation,
}: Props) {
  const regLine =
    slope !== null && intercept !== null && points.length > 0
      ? (() => {
          const xs = points.map((p) => p.x);
          const xMin = Math.min(...xs);
          const xMax = Math.max(...xs);
          return [
            { x: xMin, y: intercept + slope * xMin },
            { x: xMax, y: intercept + slope * xMax },
          ];
        })()
      : [];

  const xDomain = useMemo((): [number, number] | ["auto", "auto"] => {
    if (points.length === 0) return ["auto", "auto"];
    const xs: number[] = points.map((p) => p.x);
    for (const row of ciBand) {
      xs.push(row.x);
    }
    for (const row of regLine) {
      xs.push(row.x);
    }
    return padDomain(Math.min(...xs), Math.max(...xs));
  }, [points, ciBand, regLine]);

  const yDomain = useMemo((): [number, number] | ["auto", "auto"] => {
    if (points.length === 0) return ["auto", "auto"];
    const ys: number[] = points.map((p) => p.y);
    for (const row of ciBand) {
      ys.push(row.yLower, row.yUpper);
    }
    for (const row of regLine) {
      ys.push(row.y);
    }
    return padDomain(Math.min(...ys), Math.max(...ys));
  }, [points, ciBand, regLine]);

  const corrStr = correlation !== null ? correlation.toFixed(3) : "—";
  const highlightStr = highlightName && highlightName !== "None" ? highlightName : "None";

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const onSort = useCallback(
    (key: string) => {
      const n = toggleColumnSort(sortKey, sortDir, key);
      setSortKey(n.col);
      setSortDir(n.dir);
    },
    [sortKey, sortDir]
  );

  const tableRows = useMemo(() => {
    const copy = [...points];
    if (sortKey === null) {
      copy.sort((a, b) => a.countryName.localeCompare(b.countryName));
      return copy;
    }
    copy.sort((a, b) => {
      if (sortKey === "countryName") return cmpString(a.countryName, b.countryName, sortDir);
      if (sortKey === "year") return cmpNullableNumber(a.year, b.year, sortDir);
      if (sortKey === "x") return cmpNullableNumber(a.x, b.x, sortDir);
      if (sortKey === "y") return cmpNullableNumber(a.y, b.y, sortDir);
      if (sortKey === "selected") return cmpNullableNumber(a.isHighlight ? 1 : 0, b.isHighlight ? 1 : 0, sortDir);
      return 0;
    });
    return copy;
  }, [points, sortKey, sortDir]);

  const scatterData = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        __key: `${p.countryIso3}-${p.year}`,
      })),
    [points]
  );

  return (
    <div className="min-h-[400px] w-full">
      {points.length === 0 ? (
        <div className="flex h-[360px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center">
          <p className="text-sm font-semibold text-slate-800">No overlapping country-year points</p>
          <p className="max-w-md text-sm text-slate-500">
            Try a different metric pair or a shorter year range, then generate again.
          </p>
        </div>
      ) : (
      <ChartTableToggle
        className="h-[400px] w-full"
        vizTitle={`${labelX} vs ${labelY}`}
        chart={
          <ResponsiveContainer width="100%" height="100%" minHeight={320}>
            <ComposedChart margin={{ top: 8, right: 12, bottom: 28, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                type="number"
                dataKey="x"
                name={labelX}
                domain={xDomain}
                tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 1 })}
                stroke="#94a3b8"
                fontSize={11}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={labelY}
                domain={yDomain}
                tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 1 })}
                stroke="#94a3b8"
                fontSize={11}
              />
              <Tooltip
                wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                cursor={{ strokeDasharray: "4 4", stroke: "#94a3b8", strokeWidth: 1 }}
                content={(props) => (
                  <CorrelationTooltip
                    active={props.active}
                    payload={props.payload}
                    labelX={labelX}
                    labelY={labelY}
                  />
                )}
              />
              {ciBand.length > 0 && (
                <>
                  <Line
                    type="monotone"
                    data={ciBand}
                    dataKey="yUpper"
                    stroke="#cbd5e1"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                    name="95% CI (upper)"
                  />
                  <Line
                    type="monotone"
                    data={ciBand}
                    dataKey="yLower"
                    stroke="#cbd5e1"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                    name="95% CI (lower)"
                  />
                </>
              )}
              {regLine.length > 0 && (
                <Line
                  type="linear"
                  data={regLine}
                  dataKey="y"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  name="Trend line"
                />
              )}
              <Scatter
                name={`Countries (highlight: ${highlightName})`}
                data={scatterData}
                dataKey="y"
                fill="#14b8a6"
                line={false}
                isAnimationActive={false}
                legendType="circle"
                shape="circle"
              >
                {scatterData.map((entry) => (
                  <Cell
                    key={entry.__key}
                    fill={entry.isHighlight ? "#ca8a04" : "#14b8a6"}
                    fillOpacity={entry.isHighlight ? 1 : 0.55}
                    stroke={entry.isHighlight ? "#a16207" : "#0f766e"}
                    strokeWidth={entry.isHighlight ? 2 : 0.5}
                  />
                ))}
              </Scatter>
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value) => <span className="text-slate-600">{value}</span>}
              />
            </ComposedChart>
          </ResponsiveContainer>
        }
        table={
          <table className="w-full min-w-[320px] border-collapse text-left text-xs">
            <thead>
              <tr className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50">
                <SortableTh
                  columnKey="countryName"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="whitespace-nowrap px-3 py-2 text-slate-600"
                >
                  Country
                </SortableTh>
                <SortableTh
                  columnKey="year"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="whitespace-nowrap px-3 py-2 text-slate-600"
                >
                  Year
                </SortableTh>
                <SortableTh
                  columnKey="x"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="whitespace-nowrap px-3 py-2 text-slate-600"
                >
                  {labelX}
                </SortableTh>
                <SortableTh
                  columnKey="y"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="whitespace-nowrap px-3 py-2 text-slate-600"
                >
                  {labelY}
                </SortableTh>
                <SortableTh
                  columnKey="selected"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="whitespace-nowrap px-3 py-2 text-slate-600"
                >
                  Selected
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((p) => (
                <tr
                  key={`${p.countryIso3}-${p.year}`}
                  className="border-b border-slate-100 hover:bg-slate-50/80"
                >
                  <td className="px-3 py-1.5 text-slate-800">{p.countryName}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-600">{p.year}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums text-slate-800">
                    {formatCompactNumber(p.x, { maxFrac: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums text-slate-800">
                    {formatCompactNumber(p.y, { maxFrac: 2 })}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600">{p.isHighlight ? "Yes" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />
      )}
      {points.length > 0 ? (
        <p className="mt-2 text-center text-sm font-medium text-slate-600">
          Scatter plot: {labelX} vs {labelY} | Corr = {corrStr} | Highlight = {highlightStr} | n = {points.length}
        </p>
      ) : null}
    </div>
  );
}
