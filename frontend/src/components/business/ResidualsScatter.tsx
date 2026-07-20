import { useCallback, useMemo, useState } from "react";
import { cmpNullableNumber, cmpString, toggleColumnSort, type SortDir } from "../../lib/tableSort";
import SortableTh from "../ui/SortableTh";
import {
  ComposedChart,
  ReferenceLine,
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
import type { TooltipProps } from "recharts";

function ResidualsTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as {
    countryName?: string;
    year?: number;
    fitted?: number;
    residual?: number;
  };
  if (!p?.countryName) return null;
  return (
    <ChartTooltipShell>
      <ChartTooltipHeading>
        {p.countryName}
        <span className="font-medium text-slate-500"> · </span>
        <span className="font-medium tabular-nums text-slate-600">{p.year ?? "—"}</span>
      </ChartTooltipHeading>
      <ChartTooltipSeriesList>
        <ChartTooltipSeriesRow
          label="Fitted value"
          value={formatCompactNumber(Number(p.fitted), { maxFrac: 2 })}
          color="#64748b"
        />
        <ChartTooltipSeriesRow
          label="Residual"
          value={formatCompactNumber(Number(p.residual), { maxFrac: 2 })}
          color="#0d9488"
        />
      </ChartTooltipSeriesList>
    </ChartTooltipShell>
  );
}

type Point = { fitted: number; residual: number; countryName: string; year: number };

export default function ResidualsScatter({ points }: { points: Point[] }) {
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

  const data = points.map((p) => ({
    x: p.fitted,
    y: p.residual,
    fitted: p.fitted,
    residual: p.residual,
    countryName: p.countryName,
    year: p.year,
  }));

  const tableRows = useMemo(() => {
    const copy = [...points];
    if (sortKey === null) {
      copy.sort((a, b) => a.countryName.localeCompare(b.countryName));
      return copy;
    }
    copy.sort((a, b) => {
      if (sortKey === "countryName") return cmpString(a.countryName, b.countryName, sortDir);
      if (sortKey === "year") return cmpNullableNumber(a.year, b.year, sortDir);
      if (sortKey === "fitted") return cmpNullableNumber(a.fitted, b.fitted, sortDir);
      if (sortKey === "residual") return cmpNullableNumber(a.residual, b.residual, sortDir);
      return 0;
    });
    return copy;
  }, [points, sortKey, sortDir]);

  return (
    <div className="min-h-[260px] w-full">
      <ChartTableToggle
        className="h-[260px] w-full"
        vizTitle="Residuals vs fitted"
        chart={
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
              <XAxis
                type="number"
                dataKey="x"
                tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 1 })}
                stroke="#94a3b8"
                fontSize={11}
              />
              <YAxis
                type="number"
                dataKey="y"
                tickFormatter={(v) => formatCompactNumber(Number(v), { maxFrac: 1 })}
                stroke="#94a3b8"
                fontSize={11}
              />
              <Tooltip
                wrapperStyle={RECHARTS_TOOLTIP_WRAPPER}
                cursor={{ strokeDasharray: "4 4", stroke: "#94a3b8", strokeWidth: 1 }}
                content={ResidualsTooltip}
              />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
              <Scatter
                data={data}
                dataKey="y"
                fill="#14b8a6"
                fillOpacity={0.55}
                line={false}
                isAnimationActive={false}
                shape="circle"
              />
            </ComposedChart>
          </ResponsiveContainer>
        }
        table={
          <table className="w-full min-w-[280px] border-collapse text-left text-xs">
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
                  columnKey="fitted"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="whitespace-nowrap px-3 py-2 text-slate-600"
                >
                  Fitted
                </SortableTh>
                <SortableTh
                  columnKey="residual"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="whitespace-nowrap px-3 py-2 text-slate-600"
                >
                  Residual
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((p) => (
                <tr
                  key={`${p.countryName}-${p.year}`}
                  className="border-b border-slate-100 hover:bg-slate-50/80"
                >
                  <td className="px-3 py-1.5 text-slate-800">{p.countryName}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-600">{p.year}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums text-slate-800">
                    {formatCompactNumber(p.fitted, { maxFrac: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums text-slate-800">
                    {formatCompactNumber(p.residual, { maxFrac: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />
    </div>
  );
}
