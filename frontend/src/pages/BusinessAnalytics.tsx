import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getJson, postJson, type MetricDef } from "../api";
import { metricDisplayLabel } from "../lib/metricDisplay";
import { formatCompactCount } from "../lib/formatValue";
import { cmpNullableNumber, cmpString, toggleColumnSort, type SortDir } from "../lib/tableSort";
import SortableTh from "../components/ui/SortableTh";
import {
  MIN_DATA_YEAR,
  clampSpanEnd,
  clampSpanStart,
  maxSelectableYear,
} from "../lib/yearBounds";
import CollapsibleToolbar from "../components/layout/CollapsibleToolbar";
import PageIntro from "../components/layout/PageIntro";
import HighlightCountrySelect from "../components/HighlightCountrySelect";
import CorrelationScatter from "../components/business/CorrelationScatter";
import ResidualsScatter from "../components/business/ResidualsScatter";
import {
  loadBusinessCorrelationFromCache,
  saveBusinessCorrelationToCache,
  type BusinessAnalysisConfig,
  type BusinessCorrelationNarrative,
} from "../lib/businessCorrelationCache";

type CorrelationPoint = {
  countryIso3: string;
  countryName: string;
  region: string;
  year: number;
  x: number;
  y: number;
  fitted: number;
  residual: number;
  isIqrOutlier: boolean;
};

type SubgroupResult = { region: string; r: number; n: number; pValue: string };

type CorrResult = {
  points: CorrelationPoint[];
  n: number;
  nMissing: number;
  nIqrFlagged: number;
  excludeIqr: boolean;
  correlation: number | null;
  pValue: string | null;
  rSquared: number | null;
  slope: number | null;
  intercept: number | null;
  subgroups: SubgroupResult[];
  ciBand: { x: number; yLower: number; yUpper: number }[];
  metricX: string;
  metricY: string;
  labelX: string;
  labelY: string;
  startYear: number;
  endYear: number;
};

function strengthLabel(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.7) return "strong";
  if (a >= 0.4) return "moderate";
  if (a >= 0.2) return "weak";
  return "negligible";
}

function parsePValueSort(s: string | null): number | null {
  if (!s || s === "—") return null;
  if (s.startsWith("<")) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  const s = values.reduce((acc, v) => acc + v, 0);
  return s / values.length;
}

function quantile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo] ?? null;
  const vLo = sorted[lo] ?? null;
  const vHi = sorted[hi] ?? null;
  if (vLo === null || vHi === null) return null;
  return vLo + (idx - lo) * (vHi - vLo);
}

function median(values: number[]): number | null {
  return quantile(values, 0.5);
}

export default function BusinessAnalytics() {
  const withTimeout = async <T,>(promise: Promise<T>, ms: number, msg: string): Promise<T> => {
    let timer: number | null = null;
    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((_, reject) => {
          timer = window.setTimeout(() => reject(new Error(msg)), ms);
        }),
      ]);
    } finally {
      if (timer !== null) window.clearTimeout(timer);
    }
  };

  const maxY = maxSelectableYear();
  const [metrics, setMetrics] = useState<MetricDef[]>([]);
  const [startYear, setStartYear] = useState(MIN_DATA_YEAR);
  const [endYear, setEndYear] = useState(() => maxSelectableYear());
  const [strictSelectedRange, setStrictSelectedRange] = useState(true);
  const [excludeIqr, setExcludeIqr] = useState(false);
  const [highlight, setHighlight] = useState("IDN");
  const [xId, setXId] = useState("gdp_per_capita");
  const [yId, setYId] = useState("life_expectancy");
  const [res, setRes] = useState<CorrResult | null>(null);
  const [bizNarrative, setBizNarrative] = useState<BusinessCorrelationNarrative | null>(null);
  const [analysisRestoredFromCache, setAnalysisRestoredFromCache] = useState(false);
  const [bizNarrativeLoading, setBizNarrativeLoading] = useState(false);
  const [bizNarrativeErr, setBizNarrativeErr] = useState<string | null>(null);
  const [execSortKey, setExecSortKey] = useState<string | null>(null);
  const [execSortDir, setExecSortDir] = useState<SortDir>("asc");
  const [subgroupSortKey, setSubgroupSortKey] = useState<string | null>(null);
  const [subgroupSortDir, setSubgroupSortDir] = useState<SortDir>("asc");
  const [loading, setLoading] = useState(false);
  const [analysisLoadProgress, setAnalysisLoadProgress] = useState(0);
  const [narrativeLoadProgress, setNarrativeLoadProgress] = useState(0);
  const [analysisDiag, setAnalysisDiag] = useState<{ status: "idle" | "running" | "ok" | "error"; ms?: number }>({
    status: "idle",
  });
  const [narrativeDiag, setNarrativeDiag] = useState<{ status: "idle" | "running" | "ok" | "error"; ms?: number }>({
    status: "idle",
  });
  const [presentationMode, setPresentationMode] = useState(false);
  const [analysisDeliveryNote, setAnalysisDeliveryNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [analysisConfig, setAnalysisConfig] = useState<BusinessAnalysisConfig | null>(null);

  const restoringFromCacheRef = useRef(false);
  const skipNextFilterClearRef = useRef(false);
  const analysisReqSeqRef = useRef(0);
  const narrativeReqSeqRef = useRef(0);

  useEffect(() => {
    getJson<MetricDef[]>("/api/metrics").then(setMetrics).catch(console.error);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName ?? "").toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        Boolean(target?.isContentEditable);
      if (isEditable) return;
      if ((e.key === "p" || e.key === "P") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setPresentationMode((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const hit = loadBusinessCorrelationFromCache();
    if (!hit) return;
    try {
      // Prevent the filter-change effect from immediately clearing the restored analysis.
      skipNextFilterClearRef.current = true;
      restoringFromCacheRef.current = true;

      const cfg = hit.config;
      setAnalysisConfig(cfg);
      setStartYear(cfg.startYear);
      setEndYear(cfg.endYear);
      setExcludeIqr(cfg.excludeIqr);
      setHighlight(cfg.highlight);
      setXId(cfg.metricX);
      setYId(cfg.metricY);

      setRes(hit.res as CorrResult);
      setBizNarrative(hit.narrative as any);
      setBizNarrativeErr(null);
      setErr(null);
      setAnalysisRestoredFromCache(true);
    } finally {
      // restored refs are consumed by downstream effects
    }
  }, []);

  const fetchData = useCallback(async () => {
    const reqSeq = ++analysisReqSeqRef.current;
    const startedAt = performance.now();
    setLoading(true);
    setAnalysisLoadProgress(8);
    setAnalysisDiag({ status: "running" });
    setAnalysisDeliveryNote(null);
    setErr(null);
    const progressTimer = window.setInterval(() => {
      setAnalysisLoadProgress((prev) => (prev < 92 ? prev + 6 : 92));
    }, 250);
    try {
      const attemptRanges: Array<{ start: number; end: number; timeoutMs: number; note?: string }> = [
        { start: startYear, end: endYear, timeoutMs: 55_000 },
      ];
      const selectedSpan = endYear - startYear + 1;
      const y12Start = Math.max(MIN_DATA_YEAR, endYear - 11);
      const y6Start = Math.max(MIN_DATA_YEAR, endYear - 5);
      if (!strictSelectedRange && selectedSpan > 12) {
        attemptRanges.push({
          start: y12Start,
          end: endYear,
          timeoutMs: 40_000,
          note: `Primary request timed out; automatically using last ${endYear - y12Start + 1} years.`,
        });
      }
      if (!strictSelectedRange && selectedSpan > 6 && y6Start > startYear) {
        attemptRanges.push({
          start: y6Start,
          end: endYear,
          timeoutMs: 30_000,
          note: `Still slow; automatically using last ${endYear - y6Start + 1} years for a reliable result.`,
        });
      }

      let delivered = false;
      let lastErr: unknown = null;
      for (const attempt of attemptRanges) {
        try {
          const params = new URLSearchParams({
            metricX: xId,
            metricY: yId,
            start: String(attempt.start),
            end: String(attempt.end),
            excludeIqr: String(excludeIqr),
            highlight: highlight,
          });
          const r = await withTimeout(
            getJson<CorrResult>(`/api/analysis/correlation-global?${params}`),
            attempt.timeoutMs,
            "Correlation analysis timed out."
          );
          if (reqSeq !== analysisReqSeqRef.current) return;
          setRes(r);
          if (attempt.note) setAnalysisDeliveryNote(attempt.note);
          delivered = true;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!delivered) {
        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? "Correlation analysis failed"));
      }
      setAnalysisLoadProgress(100);
      setAnalysisDiag({ status: "ok", ms: Math.round(performance.now() - startedAt) });
    } catch (e) {
      if (reqSeq !== analysisReqSeqRef.current) return;
      setErr(String(e));
      setRes(null);
      setAnalysisLoadProgress(0);
      setAnalysisDiag({ status: "error", ms: Math.round(performance.now() - startedAt) });
    } finally {
      window.clearInterval(progressTimer);
      if (reqSeq !== analysisReqSeqRef.current) return;
      setLoading(false);
    }
  }, [xId, yId, startYear, endYear, excludeIqr, highlight, strictSelectedRange]);

  const onGenerateAnalysis = useCallback(() => {
    // Only generate analysis when user explicitly requests it.
    const nextCfg: BusinessAnalysisConfig = {
      metricX: xId,
      metricY: yId,
      startYear,
      endYear,
      excludeIqr,
      highlight,
    };
    setAnalysisConfig(nextCfg);
    setAnalysisRestoredFromCache(false);
    setRes(null);
    setBizNarrative(null);
    setBizNarrativeErr(null);
    setAnalysisDeliveryNote(null);
    setErr(null);
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setExecSortKey(null);
    setSubgroupSortKey(null);
    if (restoringFromCacheRef.current) {
      restoringFromCacheRef.current = false;
      setBizNarrativeErr(null);
      return;
    }
    setBizNarrative(null);
    setBizNarrativeErr(null);
  }, [res]);

  useEffect(() => {
    // If the user changes filters, clear the previous analysis so the UI
    // always matches the "last generated" dataset.
    if (skipNextFilterClearRef.current) {
      skipNextFilterClearRef.current = false;
      return;
    }
    if (loading) return;
    setRes(null);
    setBizNarrative(null);
    setBizNarrativeErr(null);
    setErr(null);
    setAnalysisRestoredFromCache(false);
  }, [xId, yId, startYear, endYear, excludeIqr, highlight]);

  const onExecSort = useCallback(
    (key: string) => {
      const n = toggleColumnSort(execSortKey, execSortDir, key);
      setExecSortKey(n.col);
      setExecSortDir(n.dir);
    },
    [execSortKey, execSortDir]
  );

  const onSubgroupSort = useCallback(
    (key: string) => {
      const n = toggleColumnSort(subgroupSortKey, subgroupSortDir, key);
      setSubgroupSortKey(n.col);
      setSubgroupSortDir(n.dir);
    },
    [subgroupSortKey, subgroupSortDir]
  );

  const execTableRows = useMemo(() => {
    if (!res) return [];
    const pInterp =
      res.pValue && res.pValue !== "—"
        ? res.pValue === "<0.001" || (Number(res.pValue) > 0 && Number(res.pValue) < 0.05)
          ? "Significant"
          : "Not significant"
        : "—";
    return [
      {
        key: "pearson",
        sortMetric: "pearson r",
        sortValueNum: res.correlation,
        sortValueStr: res.correlation !== null ? res.correlation.toFixed(3) : "—",
        sortInterp: res.correlation !== null ? strengthLabel(res.correlation) : "—",
        metric: "Pearson r",
        value: res.correlation !== null ? res.correlation.toFixed(3) : "—",
        interp: res.correlation !== null ? strengthLabel(res.correlation) : "—",
      },
      {
        key: "pvalue",
        sortMetric: "p-value",
        sortValueNum: parsePValueSort(res.pValue),
        sortValueStr: res.pValue ?? "—",
        sortInterp: pInterp,
        metric: "P-value",
        value: res.pValue ?? "—",
        interp: pInterp,
      },
      {
        key: "rsq",
        sortMetric: "r²",
        sortValueNum: res.rSquared,
        sortValueStr: res.rSquared !== null ? res.rSquared.toFixed(3) : "—",
        sortInterp:
          res.rSquared !== null ? `Explained variance: ${(res.rSquared * 100).toFixed(1)}%` : "—",
        metric: "R²",
        value: res.rSquared !== null ? res.rSquared.toFixed(3) : "—",
        interp:
          res.rSquared !== null ? `Explained variance: ${(res.rSquared * 100).toFixed(1)}%` : "—",
      },
      {
        key: "slope",
        sortMetric: "beta (slope)",
        sortValueNum: res.slope,
        sortValueStr: res.slope !== null ? res.slope.toExponential(2) : "—",
        sortInterp: res.slope !== null ? "1-unit increase in Variable 1 predicts change in Variable 2" : "—",
        metric: "Beta (slope)",
        value: res.slope !== null ? res.slope.toExponential(2) : "—",
        interp: res.slope !== null ? "1-unit increase in Variable 1 predicts change in Variable 2" : "—",
      },
    ];
  }, [res]);

  const sortedExecRows = useMemo(() => {
    if (execTableRows.length === 0) return [];
    if (execSortKey === null) return execTableRows;
    const copy = [...execTableRows];
    copy.sort((a, b) => {
      if (execSortKey === "metric") return cmpString(a.sortMetric, b.sortMetric, execSortDir);
      if (execSortKey === "value") {
        if (a.sortValueNum !== null && b.sortValueNum !== null) {
          return cmpNullableNumber(a.sortValueNum, b.sortValueNum, execSortDir);
        }
        return cmpString(a.sortValueStr, b.sortValueStr, execSortDir);
      }
      return cmpString(a.sortInterp, b.sortInterp, execSortDir);
    });
    return copy;
  }, [execTableRows, execSortKey, execSortDir]);

  const sortedSubgroups = useMemo(() => {
    if (!res) return [];
    if (subgroupSortKey === null) return res.subgroups;
    const copy = [...res.subgroups];
    copy.sort((a, b) => {
      if (subgroupSortKey === "region") return cmpString(a.region, b.region, subgroupSortDir);
      if (subgroupSortKey === "r") return cmpNullableNumber(a.r, b.r, subgroupSortDir);
      if (subgroupSortKey === "n") return cmpNullableNumber(a.n, b.n, subgroupSortDir);
      return cmpString(a.pValue, b.pValue, subgroupSortDir);
    });
    return copy;
  }, [res, subgroupSortKey, subgroupSortDir]);

  const defX = metrics.find((m) => m.id === xId);
  const defY = metrics.find((m) => m.id === yId);
  const labelX = res?.labelX ?? (defX ? metricDisplayLabel(defX) : xId);
  const labelY = res?.labelY ?? (defY ? metricDisplayLabel(defY) : yId);
  const analysisStartYear = res?.startYear ?? startYear;
  const analysisEndYear = res?.endYear ?? endYear;
  const analysisYearCount = analysisEndYear - analysisStartYear + 1;
  const highlightName = highlight
    ? (res?.points?.find((p) => p.countryIso3 === highlight)?.countryName ?? highlight)
    : "None";
  const yearCount = endYear - startYear + 1;

  const scatterPoints =
    res?.points.map((p) => ({
      ...p,
      isHighlight: p.countryIso3 === highlight,
    })) ?? [];

  const highlightPoints = useMemo(() => {
    if (!res) return [];
    if (!highlight) return [];
    return res.points.filter((p) => p.countryIso3 === highlight);
  }, [res, highlight]);

  const highlightStats = useMemo(() => {
    if (!highlightPoints.length) return null;
    const xs = highlightPoints.map((p) => p.x).filter((v) => Number.isFinite(v));
    const ys = highlightPoints.map((p) => p.y).filter((v) => Number.isFinite(v));
    const residuals = highlightPoints.map((p) => p.residual).filter((v) => Number.isFinite(v));
    const fitted = highlightPoints.map((p) => p.fitted).filter((v) => Number.isFinite(v));

    return {
      pointCount: highlightPoints.length,
      meanX: mean(xs),
      meanY: mean(ys),
      meanResidual: mean(residuals),
      meanFitted: mean(fitted),
      nIqrOutliers: highlightPoints.filter((p) => p.isIqrOutlier).length,
    };
  }, [highlightPoints]);

  const residualDiagnostics = useMemo(() => {
    if (!res) return null;
    const residuals = res.points.map((p) => p.residual).filter((v) => Number.isFinite(v));
    if (!residuals.length) return null;
    const absResiduals = residuals.map((v) => Math.abs(v));
    const mAbs = mean(absResiduals);
    const med = median(residuals);
    const q1 = quantile(residuals, 0.25);
    const q3 = quantile(residuals, 0.75);
    const residualIqr = q1 !== null && q3 !== null ? q3 - q1 : null;
    return {
      meanAbsResidual: mAbs,
      medianResidual: med,
      residualIqr,
    };
  }, [res]);

  useEffect(() => {
    if (!res || loading || bizNarrative) return;
    const reqSeq = ++narrativeReqSeqRef.current;
    const startedAt = performance.now();
    setBizNarrativeLoading(true);
    setNarrativeLoadProgress(10);
    setNarrativeDiag({ status: "running" });
    setBizNarrativeErr(null);
    const progressTimer = window.setInterval(() => {
      setNarrativeLoadProgress((prev) => (prev < 94 ? prev + 5 : 94));
    }, 250);

    void (async () => {
      try {
        const r = await withTimeout(
          postJson<{ narrative: BusinessCorrelationNarrative }>(
            "/api/analysis/business/correlation-narrative",
            {
              metricX: xId,
              metricY: yId,
              labelX,
              labelY,
              startYear: res.startYear,
              endYear: res.endYear,
              excludeIqr,
              highlightCountryIso3: highlight,
              highlightCountryName: highlightName,
              correlation: res.correlation,
              pValue: res.pValue,
              rSquared: res.rSquared,
              slope: res.slope,
              intercept: res.intercept,
              n: res.n,
              nMissing: res.nMissing,
              nIqrFlagged: res.nIqrFlagged,
              subgroups: res.subgroups,
              highlightStats,
              residualDiagnostics,
            }
          ),
          30000,
          "Business narrative timed out. Statistical tables are still available."
        );
        if (reqSeq !== narrativeReqSeqRef.current) return;
        setBizNarrative(r.narrative);
        setNarrativeLoadProgress(100);
        setNarrativeDiag({ status: "ok", ms: Math.round(performance.now() - startedAt) });
      } catch (e) {
        if (reqSeq !== narrativeReqSeqRef.current) return;
        setBizNarrativeErr(e instanceof Error ? e.message : String(e));
        setNarrativeLoadProgress(0);
        setNarrativeDiag({ status: "error", ms: Math.round(performance.now() - startedAt) });
      } finally {
        window.clearInterval(progressTimer);
        if (reqSeq !== narrativeReqSeqRef.current) return;
        setBizNarrativeLoading(false);
      }
    })();
    return () => {
      window.clearInterval(progressTimer);
    };
  }, [
    res,
    loading,
    xId,
    yId,
    labelX,
    labelY,
    startYear,
    endYear,
    excludeIqr,
    highlight,
    highlightName,
    highlightStats,
    residualDiagnostics,
  ]);

  useEffect(() => {
    if (!res || !analysisConfig) return;
    saveBusinessCorrelationToCache({
      v: 1,
      config: analysisConfig,
      res,
      narrative: bizNarrative ?? null,
    });
  }, [res, bizNarrative, analysisConfig]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        title="Business Analytics"
        actions={
          <button
            type="button"
            onClick={() => setPresentationMode((v) => !v)}
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              presentationMode
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {presentationMode ? "Exit presentation" : "Presentation"}
          </button>
        }
      >
        <p>
          Multi-metric correlation analysis: compare countries across two metrics to explore market
          positioning and correlations. Uses the same analyst-grade data as the platform (World Bank,
          UN, WHO, IMF; 2000 – latest). Each country–year in the range is a scatter point.
        </p>
      </PageIntro>

      {!presentationMode && (
        <>
          <div className="flex flex-wrap gap-2 md:hidden">
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
              Analysis: <span className="font-semibold text-slate-800">{analysisDiag.status}</span>
              {typeof analysisDiag.ms === "number" ? ` · ${analysisDiag.ms}ms` : ""}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
              Narrative: <span className="font-semibold text-slate-800">{narrativeDiag.status}</span>
              {typeof narrativeDiag.ms === "number" ? ` · ${narrativeDiag.ms}ms` : ""}
            </span>
          </div>

          <CollapsibleToolbar
            title="Analysis filters"
            summary={`${labelX} vs ${labelY} · ${yearCount}y (${startYear}–${endYear})`}
            forceOpen={loading}
          >
            <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max min-w-full flex-nowrap items-center gap-1.5 sm:gap-2 md:gap-3">
              <div
                className="inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50/90 px-1 shadow-sm sm:px-1.5"
                title={`Coverage ${MIN_DATA_YEAR}–${maxY}`}
              >
                <label className="sr-only" htmlFor="business-year-from">
                  From year
                </label>
                <input
                  id="business-year-from"
                  type="number"
                  value={startYear}
                  min={MIN_DATA_YEAR}
                  max={Math.min(endYear, maxY)}
                  onChange={(e) => setStartYear(clampSpanStart(Number(e.target.value), endYear))}
                  className="w-[4.25rem] min-w-[4.25rem] border-0 bg-transparent px-0.5 text-center text-xs font-medium tabular-nums text-slate-900 [appearance:textfield] focus:outline-none sm:w-[4.5rem] sm:min-w-[4.5rem] sm:px-1 sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="select-none px-0.5 text-[10px] text-slate-300 sm:text-xs" aria-hidden>
                  –
                </span>
                <label className="sr-only" htmlFor="business-year-to">
                  To year
                </label>
                <input
                  id="business-year-to"
                  type="number"
                  value={endYear}
                  min={Math.max(startYear, MIN_DATA_YEAR)}
                  max={maxY}
                  onChange={(e) => setEndYear(clampSpanEnd(Number(e.target.value), startYear))}
                  className="w-[4.25rem] min-w-[4.25rem] border-0 bg-transparent px-0.5 text-center text-xs font-medium tabular-nums text-slate-900 [appearance:textfield] focus:outline-none sm:w-[4.5rem] sm:min-w-[4.5rem] sm:px-1 sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>

              <label
                className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 has-[:checked]:border-red-200 has-[:checked]:bg-red-50 has-[:checked]:text-red-900"
                title="Exclude IQR outliers — removes points outside 1.5×IQR on both variables"
              >
                <input
                  type="checkbox"
                  checked={excludeIqr}
                  onChange={(e) => setExcludeIqr(e.target.checked)}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="whitespace-nowrap">IQR</span>
              </label>

              <label
                className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 has-[:checked]:border-red-200 has-[:checked]:bg-red-50 has-[:checked]:text-red-900"
                title="Strict selected range only — disables automatic fallback to shorter windows on timeout"
              >
                <input
                  type="checkbox"
                  checked={strictSelectedRange}
                  onChange={(e) => setStrictSelectedRange(e.target.checked)}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="whitespace-nowrap">Strict</span>
              </label>

              <div className="hidden h-9 w-px shrink-0 bg-slate-200 md:block" aria-hidden />

              <div className="w-[min(100%,11rem)] shrink-0 sm:w-[12rem] md:w-[14rem]">
                <label className="sr-only">Focus country</label>
                <HighlightCountrySelect
                  value={highlight}
                  onChange={setHighlight}
                  clearPlacement="inline"
                  className="gap-0 [&_input]:h-9 [&_input]:truncate [&_input]:py-1.5 [&_input]:pl-2.5 [&_input]:text-xs sm:[&_input]:pl-3 sm:[&_input]:text-sm"
                />
              </div>

              <div className="hidden h-9 w-px shrink-0 bg-slate-200 md:block" aria-hidden />

              <div className="w-[min(100%,9.5rem)] shrink-0 sm:w-[10.5rem] md:w-[12rem]">
                <label htmlFor="business-var-x" className="sr-only">
                  Variable 1
                </label>
                <select
                  id="business-var-x"
                  value={xId}
                  onChange={(e) => setXId(e.target.value)}
                  title={labelX}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 shadow-sm focus:border-red-300 focus:outline-none focus:ring-1 focus:ring-red-300 sm:px-3 sm:text-sm"
                >
                  {metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {metricDisplayLabel(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-[min(100%,9.5rem)] shrink-0 sm:w-[10.5rem] md:w-[12rem]">
                <label htmlFor="business-var-y" className="sr-only">
                  Variable 2
                </label>
                <select
                  id="business-var-y"
                  value={yId}
                  onChange={(e) => setYId(e.target.value)}
                  title={labelY}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 shadow-sm focus:border-red-300 focus:outline-none focus:ring-1 focus:ring-red-300 sm:px-3 sm:text-sm"
                >
                  {metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {metricDisplayLabel(m)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={onGenerateAnalysis}
                disabled={loading}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:gap-1.5 sm:px-3 md:ml-auto"
                title="Generate correlation analysis"
              >
                {loading ? (
                  <span className="text-sm font-semibold">…</span>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4 shrink-0 sm:hidden"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.5 4.5L19 12l-5.5 3L10 19l-2.5-4L2 12l5.5-3L10 5z"
                      />
                    </svg>
                    <span className="hidden whitespace-nowrap text-sm font-semibold sm:inline">Generate</span>
                  </>
                )}
              </button>
            </div>
            </div>
          </CollapsibleToolbar>

          <div className="hidden flex-wrap gap-2 md:flex">
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
              Analysis request: <span className="font-semibold text-slate-800">{analysisDiag.status}</span>
              {typeof analysisDiag.ms === "number" ? ` · ${analysisDiag.ms} ms` : ""}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
              Narrative request: <span className="font-semibold text-slate-800">{narrativeDiag.status}</span>
              {typeof narrativeDiag.ms === "number" ? ` · ${narrativeDiag.ms} ms` : ""}
            </span>
          </div>
        </>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-bold text-slate-900">Multi-metric correlation analysis</h2>
        <p className="mt-1 text-sm text-slate-500">
          Compare countries across two metrics to explore market positioning and correlations. The
          selected country is highlighted in gold on the scatter.
        </p>
        <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
          {loading ? (
            <div className="flex h-[420px] items-center justify-center">
              <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-700">
                  Loading global metrics for {yearCount} years…
                </p>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-red-600 transition-all duration-300"
                    style={{ width: `${analysisLoadProgress}%` }}
                    role="progressbar"
                    aria-valuenow={analysisLoadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Business analytics loading progress"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">{analysisLoadProgress}% loaded</p>
              </div>
            </div>
          ) : err ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-red-600">{err}</p>
              <button
                type="button"
                onClick={onGenerateAnalysis}
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Retry analysis
              </button>
            </div>
          ) : res ? (
            <div className="space-y-3">
              {analysisRestoredFromCache ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2 text-sm text-slate-700">
                  Showing <span className="font-semibold text-slate-900">last generated</span> analysis (it stays visible until you click{" "}
                  <span className="font-semibold">Generate analysis</span> again).
                </div>
              ) : null}
              {analysisDeliveryNote ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2 text-sm text-blue-900">
                  {analysisDeliveryNote}
                </div>
              ) : null}
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2 text-sm text-slate-700">
                <span className="font-semibold text-amber-900">Highlighted country:</span>{" "}
                <span className="font-semibold text-slate-900">{highlightName}</span>{" "}
                <span className="font-mono text-amber-900/80">({highlight || "—"})</span>
              </div>
              <CorrelationScatter
                points={scatterPoints}
                ciBand={res.ciBand}
                slope={res.slope}
                intercept={res.intercept}
                labelX={labelX}
                labelY={labelY}
                highlightName={highlightName}
                correlation={res.correlation}
              />
            </div>
          ) : (
            <p className="flex h-[420px] items-center justify-center text-sm text-slate-500">
              Select variables and filters above, then click{" "}
              <span className="font-semibold">Generate analysis</span> to view the correlation plot.
            </p>
          )}
        </div>
      </div>

      {res && !loading && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-slate-900">
              Correlation &amp; causation analysis
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Statistical summary and interpretation for the selected pair: {labelX} (Variable 1) vs{" "}
              {labelY} (Variable 2). Years: {analysisStartYear}–{analysisEndYear} ({analysisYearCount} years, each country–year is a point).
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Points used</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatCompactCount(res.n)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Pearson r</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {res.correlation !== null ? res.correlation.toFixed(3) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">P-value</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{res.pValue ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">R²</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {res.rSquared !== null ? res.rSquared.toFixed(3) : "—"}
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-xl border-l-4 border-red-400 bg-red-50/80 px-4 py-3 text-sm text-slate-700">
              <strong>Correlation does NOT imply causation.</strong> The following describes
              association and strength of linear relationship. Causal claims require additional
              evidence (e.g. temporality, experiments).
            </div>
            <div className="mt-6">
              <h3 className="font-bold text-slate-900">Data preparation</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>Missing: {res.nMissing} point(s) removed.</li>
                <li>
                  IQR outliers: {res.nIqrFlagged} flagged (&gt;1.5×IQR).
                  {res.excludeIqr ? " Excluded." : " Included; toggle 'Exclude IQR outliers' to remove."}
                </li>
                <li>Points used: n = {formatCompactCount(res.n)}.</li>
              </ul>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70 sm:p-5">
              <h3 className="font-bold text-slate-900">Executive summary</h3>
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <SortableTh
                        columnKey="metric"
                        sortKey={execSortKey}
                        sortDir={execSortDir}
                        onSort={onExecSort}
                        className="px-4 py-2 text-slate-700"
                      >
                        Metric
                      </SortableTh>
                      <SortableTh
                        columnKey="value"
                        sortKey={execSortKey}
                        sortDir={execSortDir}
                        onSort={onExecSort}
                        className="px-4 py-2 text-slate-700"
                      >
                        Value
                      </SortableTh>
                      <SortableTh
                        columnKey="interpretation"
                        sortKey={execSortKey}
                        sortDir={execSortDir}
                        onSort={onExecSort}
                        className="px-4 py-2 text-slate-700"
                      >
                        Interpretation
                      </SortableTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedExecRows.map((row) => (
                      <tr key={row.key}>
                        <td className="px-4 py-2 text-slate-600">{row.metric}</td>
                        <td className="px-4 py-2 font-medium">{row.value}</td>
                        <td className="px-4 py-2 text-slate-600">{row.interp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70 sm:p-5">
              <h3 className="font-bold text-slate-900">Correlation (Pearson)</h3>
              <p className="mt-3 text-sm text-slate-600">
                {res.correlation !== null && (
                  <>
                    <strong>r = {res.correlation.toFixed(3)}</strong> (n = {formatCompactCount(res.n)})
                    {" · "}
                    p-value {res.pValue ?? "—"} · Strength:{" "}
                    <strong>{strengthLabel(res.correlation)}</strong>
                  </>
                )}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {res.correlation !== null ? (
                  <>
                    There is a {strengthLabel(res.correlation)} linear relationship across{" "}
                    {formatCompactCount(res.n)} points:{" "}
                    {res.correlation >= 0
                      ? "higher Variable 1 aligns with higher Variable 2"
                      : "higher Variable 1 aligns with lower Variable 2"}.{" "}
                  </>
                ) : (
                  <>Insufficient overlap to estimate a stable linear association across {formatCompactCount(res.n)} points.</>
                )}{" "}
                {res.nIqrFlagged > 0 &&
                  `${res.nIqrFlagged} point(s) flagged as IQR outliers (1.5×IQR rule).`}
              </p>
              {res.slope !== null && (
                <p className="mt-2 text-sm font-medium text-slate-700">
                  A 1-unit increase in Variable 1 predicts {res.slope.toExponential(2)} change in{" "}
                  Variable 2 (p = {res.pValue ?? "—"}).
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70 sm:p-5">
            <h3 className="font-bold text-slate-900">Residuals vs fitted</h3>
            <p className="mt-1 text-sm text-slate-500">
              Check for heteroscedasticity: residuals should be scattered around zero.
            </p>
            <div className="mt-4">
              <ResidualsScatter
                points={res.points.map((p) => ({
                  fitted: p.fitted,
                  residual: p.residual,
                  countryName: p.countryName,
                  year: p.year,
                }))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70 sm:p-5">
            <h3 className="font-bold text-slate-900">Subgroup analysis (by region)</h3>
            <p className="mt-1 text-sm text-slate-500">
              Consistency across regions (Bradford Hill).
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <SortableTh
                      columnKey="region"
                      sortKey={subgroupSortKey}
                      sortDir={subgroupSortDir}
                      onSort={onSubgroupSort}
                      className="px-4 py-2 text-slate-700"
                    >
                      Region
                    </SortableTh>
                    <SortableTh
                      columnKey="r"
                      sortKey={subgroupSortKey}
                      sortDir={subgroupSortDir}
                      onSort={onSubgroupSort}
                      className="px-4 py-2 text-slate-700"
                    >
                      r
                    </SortableTh>
                    <SortableTh
                      columnKey="n"
                      sortKey={subgroupSortKey}
                      sortDir={subgroupSortDir}
                      onSort={onSubgroupSort}
                      className="px-4 py-2 text-slate-700"
                    >
                      n
                    </SortableTh>
                    <SortableTh
                      columnKey="pValue"
                      sortKey={subgroupSortKey}
                      sortDir={subgroupSortDir}
                      onSort={onSubgroupSort}
                      className="px-4 py-2 text-slate-700"
                    >
                      p-value
                    </SortableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedSubgroups.map((s) => (
                    <tr key={s.region}>
                      <td className="px-4 py-2 text-slate-600">{s.region}</td>
                      <td className="px-4 py-2 font-medium">{s.r.toFixed(3)}</td>
                      <td className="px-4 py-2">{formatCompactCount(s.n)}</td>
                      <td className="px-4 py-2">{s.pValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70 sm:p-5">
              <h3 className="font-bold text-slate-900">Causation &amp; context</h3>
              {bizNarrativeLoading ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-600">Generating analyst narrative...</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-red-600 transition-all duration-300"
                      style={{ width: `${narrativeLoadProgress}%` }}
                      role="progressbar"
                      aria-valuenow={narrativeLoadProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Narrative generation loading progress"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{narrativeLoadProgress}% loaded</p>
                </div>
              ) : bizNarrative ? (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{bizNarrative.causationParagraph}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    Use this data for hypothesis generation; confirm with subgroup analysis and
                    robustness checks.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    Correlation does not imply causation. Omitted variables (institutions, education,
                    infrastructure, governance, and geography) may confound the relationship between{" "}
                    {labelX} and {labelY}. In other words, both metrics can move together because they
                    respond to shared drivers rather than because changes in {labelX} directly cause
                    changes in {labelY}.
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    Use this data for hypothesis generation; confirm with subgroup analysis and
                    robustness checks.
                  </p>
                  {bizNarrativeErr ? (
                    <p className="mt-3 text-xs text-red-600">Narrative unavailable: {bizNarrativeErr}</p>
                  ) : null}
                </>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70 sm:p-5">
              <h3 className="font-bold text-slate-900">Actionable insight</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {res.slope !== null && (
                  <>
                    A 1-unit increase in Variable 1 ({labelX}) predicts a change of{" "}
                    {res.slope.toExponential(2)} in Variable 2 ({labelY}) (p={res.pValue ?? "—"}).{" "}
                    {strengthLabel(res.correlation ?? 0)} correlation. Use for hypothesis generation;
                    confirm with subgroup analysis and robustness checks.
                  </>
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70 sm:p-5">
              <h3 className="font-bold text-slate-900">If causation is not supported</h3>
              {bizNarrative ? (
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
                  {bizNarrative.recommendedAnalyses.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              ) : (
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
                  <li>Subgroup analysis by region or income.</li>
                  <li>Time-lagged or panel analysis.</li>
                  <li>Control for confounders (e.g. multiple regression).</li>
                  <li>Use experiments (RCTs) or instrumental variables.</li>
                </ol>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70 sm:p-5">
              <h3 className="font-bold text-slate-900">
                Comprehensive hypothesis for business analysis
              </h3>
              {bizNarrative ? (
                <>
                  <p className="mt-2 text-sm text-slate-600">
                    Analyst narrative for <strong>{labelX}</strong> (Variable 1) vs{" "}
                    <strong>{labelY}</strong> (Variable 2) across {analysisYearCount} years ({analysisStartYear}–{analysisEndYear}):
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {bizNarrative.associationParagraphs[0]}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {bizNarrative.associationParagraphs[1]}
                  </p>
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
                    {bizNarrative.correlationBullets.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                    {bizNarrative.causationHypotheses.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-slate-500">
                    This hypothesis is exploratory. Stress-test before driving capital allocation or
                    policy decisions.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-slate-600">
                    Working hypothesis for <strong>{labelX}</strong> (Variable 1) vs{" "}
                    <strong>{labelY}</strong> (Variable 2) across {analysisYearCount} years ({analysisStartYear}–{analysisEndYear}):
                  </p>
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
                    <li>
                      <strong>Statistical trend:</strong> Higher Variable 1 values tend to align with
                      higher Variable 2 values based on scatter and Pearson statistics (
                      {formatCompactCount(res.n)} points with valid data).
                    </li>
                    <li>
                      <strong>Strategic implication:</strong> Shifts in Variable 1 may be informative
                      of movements in Variable 2 within target segments.
                    </li>
                    <li>
                      <strong>Outlier analysis:</strong> Countries far above the main cloud as potential
                      out-performers; those below as structural risks.
                    </li>
                    <li>
                      <strong>Limitations:</strong> Sample size, multicollinearity, non-linear effects.
                    </li>
                  </ul>
                  <p className="mt-4 text-xs text-slate-500">
                    This hypothesis is exploratory. Stress-test before driving capital allocation or
                    policy decisions.
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
