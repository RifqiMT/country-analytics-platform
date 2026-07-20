import { useMemo } from "react";
import type { PairComparisonRow } from "./CountryPairTable";
import { countryAIsAhead, describeCompareDeltaCompact } from "../../lib/compareMetricFormat";
import { COMPARE_COLOR_A, COMPARE_COLOR_B } from "../../lib/compareChartMerge";

type Props = {
  rows: PairComparisonRow[];
  nameA: string;
  nameB: string;
  snapshotYear: number;
};

function topGaps(rows: PairComparisonRow[], favorA: boolean, nameA: string, nameB: string, limit = 3) {
  return rows
    .filter((r) => {
      if (r.delta == null) return false;
      const ahead = countryAIsAhead(r.id, r.delta);
      return favorA ? ahead === true : ahead === false;
    })
    .sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0))
    .slice(0, limit)
    .map((r) => ({
      ...r,
      summary: describeCompareDeltaCompact({
        metricId: r.id,
        delta: r.delta!,
        deltaPct: r.deltaPct,
        nameA,
        nameB,
      }),
    }));
}

export default function CompareSummaryBar({ rows, nameA, nameB, snapshotYear }: Props) {
  const stats = useMemo(() => {
    let aLeads = 0;
    let bLeads = 0;
    let tied = 0;
    let unreported = 0;
    let noDirection = 0;
    for (const r of rows) {
      if (r.countryA.value == null || r.countryB.value == null) {
        unreported += 1;
        continue;
      }
      if (r.delta === 0) {
        tied += 1;
        continue;
      }
      const ahead = countryAIsAhead(r.id, r.delta!);
      if (ahead === true) aLeads += 1;
      else if (ahead === false) bLeads += 1;
      else noDirection += 1;
    }
    return {
      aLeads,
      bLeads,
      tied,
      unreported,
      noDirection,
      comparable: aLeads + bLeads + tied + noDirection,
    };
  }, [rows]);

  const aGaps = useMemo(() => topGaps(rows, true, nameA, nameB), [rows, nameA, nameB]);
  const bGaps = useMemo(() => topGaps(rows, false, nameA, nameB), [rows, nameA, nameB]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-900">Comparison snapshot</h2>
        <p className="text-xs leading-relaxed text-slate-500">
          At year {snapshotYear}, we compared {stats.comparable} indicators where both countries reported data.
          {stats.noDirection > 0
            ? ` ${stats.noDirection} indicators have no clear “better” direction (for example, population size).`
            : null}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{nameA} ahead</p>
          <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: COMPARE_COLOR_A }}>
            {stats.aLeads}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Indicators where {nameA} performs better</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{nameB} ahead</p>
          <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: COMPARE_COLOR_B }}>
            {stats.bLeads}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Indicators where {nameB} performs better</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Even</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">{stats.tied}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Both countries report the same value</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Missing data</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">{stats.unreported}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">One or both countries did not report</p>
        </div>
      </div>

      {(aGaps.length > 0 || bGaps.length > 0) && (
        <div className="grid gap-4 border-t border-slate-100 px-4 py-4 sm:grid-cols-2 sm:px-5">
          {aGaps.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Largest advantages for {nameA}
              </p>
              <ul className="mt-2 space-y-2">
                {aGaps.map((r) => (
                  <li key={r.id} className="text-sm">
                    <p className="font-medium text-slate-800">{r.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{r.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {bGaps.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Largest advantages for {nameB}
              </p>
              <ul className="mt-2 space-y-2">
                {bGaps.map((r) => (
                  <li key={r.id} className="text-sm">
                    <p className="font-medium text-slate-800">{r.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{r.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
