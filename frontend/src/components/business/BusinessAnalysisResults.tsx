import SortableTh from "../ui/SortableTh";
import LoadingProgressSection from "../ui/LoadingProgressSection";
import { formatCompactCount } from "../../lib/formatValue";
import { strengthLabel } from "../../lib/businessCorrelationUi";
import type { SortDir } from "../../lib/tableSort";
import type { BusinessCorrelationNarrative } from "../../lib/businessCorrelationCache";
import ResidualsScatter from "./ResidualsScatter";

type ExecRow = {
  key: string;
  metric: string;
  value: string;
  interp: string;
};

type SubgroupRow = { region: string; r: number; n: number; pValue: string };

type CorrResultSlice = {
  n: number;
  nMissing: number;
  nIqrFlagged: number;
  excludeIqr: boolean;
  correlation: number | null;
  pValue: string | null;
  rSquared: number | null;
  slope: number | null;
  points: { fitted: number; residual: number; countryName: string; year: number }[];
  subgroups: SubgroupRow[];
};

type Props = {
  res: CorrResultSlice;
  labelX: string;
  labelY: string;
  analysisStartYear: number;
  analysisEndYear: number;
  analysisYearCount: number;
  execSortKey: string | null;
  execSortDir: SortDir;
  onExecSort: (key: string) => void;
  sortedExecRows: ExecRow[];
  subgroupSortKey: string | null;
  subgroupSortDir: SortDir;
  onSubgroupSort: (key: string) => void;
  sortedSubgroups: SubgroupRow[];
  bizNarrative: BusinessCorrelationNarrative | null;
  bizNarrativeLoading: boolean;
  narrativeLoadProgress: number;
  bizNarrativeErr: string | null;
};

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

export default function BusinessAnalysisResults({
  res,
  labelX,
  labelY,
  analysisStartYear,
  analysisEndYear,
  analysisYearCount,
  execSortKey,
  execSortDir,
  onExecSort,
  sortedExecRows,
  subgroupSortKey,
  subgroupSortDir,
  onSubgroupSort,
  sortedSubgroups,
  bizNarrative,
  bizNarrativeLoading,
  narrativeLoadProgress,
  bizNarrativeErr,
}: Props) {
  return (
    <div className="space-y-5 lg:space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Statistical summary</h2>
          <p className="text-xs text-slate-500">
            {analysisStartYear}–{analysisEndYear} · {analysisYearCount} years · {formatCompactCount(res.n)} points
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <StatCell label="Points used" value={formatCompactCount(res.n)} />
          <StatCell label="Pearson r" value={res.correlation !== null ? res.correlation.toFixed(3) : "—"} />
          <StatCell label="P-value" value={res.pValue ?? "—"} />
          <StatCell label="R²" value={res.rSquared !== null ? res.rSquared.toFixed(3) : "—"} />
        </div>
        <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-sm text-slate-700">
          <strong className="text-amber-900">Correlation does not imply causation.</strong> The results below describe
          association only. Causal claims need additional evidence such as temporality or controlled experiments.
        </div>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          <li>{res.nMissing} point(s) removed for missing data.</li>
          <li>
            {res.nIqrFlagged} IQR outlier(s) flagged.
            {res.excludeIqr ? " Excluded from the analysis." : " Included; enable Exclude IQR outliers to remove them."}
          </li>
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="font-semibold text-slate-900">Key metrics</h3>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <SortableTh columnKey="metric" sortKey={execSortKey} sortDir={execSortDir} onSort={onExecSort} className="px-3 py-2 text-slate-700">
                    Metric
                  </SortableTh>
                  <SortableTh columnKey="value" sortKey={execSortKey} sortDir={execSortDir} onSort={onExecSort} className="px-3 py-2 text-slate-700">
                    Value
                  </SortableTh>
                  <SortableTh columnKey="interpretation" sortKey={execSortKey} sortDir={execSortDir} onSort={onExecSort} className="px-3 py-2 text-slate-700">
                    Reading
                  </SortableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedExecRows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-3 py-2 text-slate-600">{row.metric}</td>
                    <td className="px-3 py-2 font-medium tabular-nums">{row.value}</td>
                    <td className="px-3 py-2 text-slate-600">{row.interp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="font-semibold text-slate-900">Interpretation</h3>
          {res.correlation !== null ? (
            <>
              <p className="mt-3 text-sm text-slate-600">
                <strong className="text-slate-800">r = {res.correlation.toFixed(3)}</strong> (n = {formatCompactCount(res.n)}) · p-value {res.pValue ?? "—"} ·{" "}
                <strong>{strengthLabel(res.correlation)}</strong> linear relationship
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Across {formatCompactCount(res.n)} points, higher {labelX} tends to align with{" "}
                {res.correlation >= 0 ? "higher" : "lower"} {labelY}.
                {res.nIqrFlagged > 0 ? ` ${res.nIqrFlagged} point(s) flagged as IQR outliers.` : ""}
              </p>
              {res.slope !== null ? (
                <p className="mt-2 text-sm font-medium text-slate-700">
                  A 1-unit increase in {labelX} predicts {res.slope.toExponential(2)} change in {labelY} (p = {res.pValue ?? "—"}).
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Not enough overlapping data to estimate a stable linear association across {formatCompactCount(res.n)} points.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="font-semibold text-slate-900">Residuals vs fitted</h3>
        <p className="mt-1 text-sm text-slate-500">Points should scatter evenly around zero if the linear model fits well.</p>
        <div className="mt-4">
          <ResidualsScatter points={res.points} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="font-semibold text-slate-900">By region</h3>
        <p className="mt-1 text-sm text-slate-500">Check whether the relationship holds across geographic groups.</p>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <SortableTh columnKey="region" sortKey={subgroupSortKey} sortDir={subgroupSortDir} onSort={onSubgroupSort} className="px-3 py-2 text-slate-700">
                  Region
                </SortableTh>
                <SortableTh columnKey="r" sortKey={subgroupSortKey} sortDir={subgroupSortDir} onSort={onSubgroupSort} className="px-3 py-2 text-slate-700">
                  r
                </SortableTh>
                <SortableTh columnKey="n" sortKey={subgroupSortKey} sortDir={subgroupSortDir} onSort={onSubgroupSort} className="px-3 py-2 text-slate-700">
                  n
                </SortableTh>
                <SortableTh columnKey="pValue" sortKey={subgroupSortKey} sortDir={subgroupSortDir} onSort={onSubgroupSort} className="px-3 py-2 text-slate-700">
                  p-value
                </SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSubgroups.map((s) => (
                <tr key={s.region}>
                  <td className="px-3 py-2 text-slate-600">{s.region}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{s.r.toFixed(3)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatCompactCount(s.n)}</td>
                  <td className="px-3 py-2">{s.pValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 p-4 shadow-sm sm:p-5">
        <h3 className="font-semibold text-slate-900">Analyst narrative</h3>
        {bizNarrativeLoading ? (
          <LoadingProgressSection className="mt-3" variant="muted" label="Generating narrative…" progress={narrativeLoadProgress} />
        ) : bizNarrative ? (
          <div className="mt-4 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Causation and context</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{bizNarrative.causationParagraph}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Association</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{bizNarrative.associationParagraphs[0]}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{bizNarrative.associationParagraphs[1]}</p>
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
              {bizNarrative.correlationBullets.map((s) => (
                <li key={s}>{s}</li>
              ))}
              {bizNarrative.causationHypotheses.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended next steps</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
                {bizNarrative.recommendedAnalyses.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
            <p className="text-xs text-slate-500">Exploratory only. Stress-test before capital allocation or policy decisions.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-relaxed text-slate-600">
              Correlation does not imply causation. Omitted variables such as institutions, education, infrastructure, and
              governance may confound the relationship between {labelX} and {labelY}.
            </p>
            {res.slope !== null ? (
              <p className="text-sm leading-relaxed text-slate-600">
                A 1-unit increase in {labelX} predicts {res.slope.toExponential(2)} change in {labelY} (p = {res.pValue ?? "—"}). Use
                this for hypothesis generation and confirm with subgroup and robustness checks.
              </p>
            ) : null}
            <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
              <li>Subgroup analysis by region or income group.</li>
              <li>Time-lagged or panel analysis.</li>
              <li>Control for confounders with multivariate models.</li>
              <li>Validate with experiments or instrumental variables where possible.</li>
            </ol>
            {bizNarrativeErr ? <p className="text-xs text-red-600">Narrative unavailable: {bizNarrativeErr}</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}
