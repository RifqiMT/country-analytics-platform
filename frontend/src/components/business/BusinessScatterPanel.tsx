import LoadingProgressSection from "../ui/LoadingProgressSection";
import CorrelationScatter from "./CorrelationScatter";

type ScatterPoint = {
  countryIso3: string;
  countryName: string;
  year: number;
  x: number;
  y: number;
  isHighlight: boolean;
};

type Props = {
  loading: boolean;
  loadProgress: number;
  yearCount: number;
  err: string | null;
  onRetry: () => void;
  hasResult: boolean;
  analysisRestoredFromCache: boolean;
  analysisDeliveryNote: string | null;
  highlightName: string;
  highlight: string;
  labelX: string;
  labelY: string;
  scatterPoints: ScatterPoint[];
  ciBand: { x: number; yLower: number; yUpper: number }[];
  slope: number | null;
  intercept: number | null;
  correlation: number | null;
};

export default function BusinessScatterPanel({
  loading,
  loadProgress,
  yearCount,
  err,
  onRetry,
  hasResult,
  analysisRestoredFromCache,
  analysisDeliveryNote,
  highlightName,
  highlight,
  labelX,
  labelY,
  scatterPoints,
  ciBand,
  slope,
  intercept,
  correlation,
}: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Correlation scatter</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {labelX} vs {labelY}. Each point is one country in one year.
        </p>
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="flex min-h-[380px] items-center justify-center">
            <LoadingProgressSection
              className="w-full max-w-xl"
              variant="card"
              label={`Loading metrics for ${yearCount} years…`}
              progress={loadProgress}
            />
          </div>
        ) : err ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <div className="max-w-md space-y-1.5">
              <p className="text-sm font-semibold text-slate-900">Analysis could not finish</p>
              <p className="text-sm leading-relaxed text-slate-600">{err.replace(/^Error:\s*/i, "")}</p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
            >
              Retry analysis
            </button>
          </div>
        ) : hasResult ? (
          <div className="space-y-3">
            {analysisRestoredFromCache ? (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-sm text-slate-700">
                Showing your last generated analysis. Click <span className="font-semibold">Generate analysis</span> to refresh.
              </p>
            ) : null}
            {analysisDeliveryNote ? (
              <p className="rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-2 text-sm text-sky-900">{analysisDeliveryNote}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold text-teal-900">Highlight</span>
              <span className="font-semibold text-slate-900">
                {highlightName && highlightName !== highlight ? highlightName : highlight || "None"}
              </span>
              {highlight && highlightName && highlightName !== highlight ? (
                <span className="font-mono text-xs text-teal-800/80">({highlight})</span>
              ) : null}
            </div>
            {scatterPoints.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center">
                <p className="text-sm font-semibold text-slate-800">No points to plot</p>
                <p className="max-w-md text-sm text-slate-500">
                  The analysis returned no overlapping country-year values for this metric pair. Shorten the year range or pick different metrics, then generate again.
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
                >
                  Retry analysis
                </button>
              </div>
            ) : (
            <CorrelationScatter
              points={scatterPoints}
              ciBand={ciBand}
              slope={slope}
              intercept={intercept}
              labelX={labelX}
              labelY={labelY}
              highlightName={highlightName}
              correlation={correlation}
            />
            )}
          </div>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center px-4 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">
              Choose two metrics and a year range, then click <span className="font-semibold text-slate-700">Generate analysis</span> to view the scatter plot.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
