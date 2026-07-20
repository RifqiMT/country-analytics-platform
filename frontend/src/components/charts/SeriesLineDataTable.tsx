import { useCallback, useMemo, useState } from "react";
import { downloadCsv } from "../../lib/csv";
import { formatCompactNumber } from "../../lib/formatValue";
import { cmpNullableNumber, cmpString, toggleColumnSort, type SortDir } from "../../lib/tableSort";
import SortableTh from "../ui/SortableTh";

export type SeriesTableColumn = { key: string; label: string; format?: "compact" | "percent" };

/** Download the visible series table as CSV (raw numeric values). */
export function exportSeriesTableCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns: SeriesTableColumn[]
) {
  const headers = ["Period", ...columns.map((c) => c.label)];
  const csvRows = rows.map((row) => {
    const period = periodLabel(row);
    return [
      period,
      ...columns.map((c) => {
        const v = row[c.key];
        if (v === null || v === undefined) return null;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : null;
      }),
    ];
  });
  downloadCsv(filename, headers, csvRows);
}

function formatCell(col: SeriesTableColumn, raw: unknown): string {
  if (raw === null || raw === undefined) return "—";
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return "—";
  if (col.format === "percent") return `${n.toFixed(1)}%`;
  return formatCompactNumber(n, { maxFrac: 2 });
}

function periodLabel(row: Record<string, unknown>): string {
  const pl = row.periodLabel;
  if (pl != null && pl !== "") return String(pl);
  const y = row.year;
  if (y != null) return String(y);
  const pk = row.periodKey;
  if (pk != null) return String(pk);
  return "—";
}

function periodSortNumber(row: Record<string, unknown>): number | null {
  const y = row.year;
  if (typeof y === "number" && Number.isFinite(y)) return y;
  const pk = row.periodKey;
  if (typeof pk === "number" && Number.isFinite(pk)) return pk;
  const pl = row.periodLabel;
  if (pl != null && pl !== "") {
    const n = Number(pl);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function periodCompare(a: Record<string, unknown>, b: Record<string, unknown>, dir: SortDir): number {
  const na = periodSortNumber(a);
  const nb = periodSortNumber(b);
  if (na !== null || nb !== null) {
    return cmpNullableNumber(na, nb, dir);
  }
  return cmpString(periodLabel(a), periodLabel(b), dir);
}

function coerceNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const PERIOD_KEY = "__period";

type Props = {
  rows: Record<string, unknown>[];
  columns: SeriesTableColumn[];
};

export default function SeriesLineDataTable({ rows, columns }: Props) {
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

  const sortedRows = useMemo(() => {
    if (sortKey === null) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === PERIOD_KEY) return periodCompare(a, b, sortDir);
      return cmpNullableNumber(coerceNumber(a[sortKey]), coerceNumber(b[sortKey]), sortDir);
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return (
    <table className="w-full min-w-[280px] border-collapse text-left text-xs">
      <thead>
        <tr className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50">
          <SortableTh
            columnKey={PERIOD_KEY}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            className="whitespace-nowrap px-3 py-2 text-slate-600"
          >
            Period
          </SortableTh>
          {columns.map((c) => (
            <SortableTh
              key={c.key}
              columnKey={c.key}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className="whitespace-nowrap px-3 py-2 text-slate-600"
            >
              {c.label}
            </SortableTh>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row, i) => (
          <tr key={String(row.periodKey ?? row.year ?? i)} className="border-b border-slate-100 hover:bg-slate-50/80">
            <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{periodLabel(row)}</td>
            {columns.map((c) => (
              <td key={c.key} className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums text-slate-800">
                {formatCell(c, row[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
