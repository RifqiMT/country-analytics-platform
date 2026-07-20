import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getJson, postJson, type MetricDef } from "../api";
import { metricDisplayLabel } from "../lib/metricDisplay";
import { cmpNullableNumber, cmpString, toggleColumnSort, type SortDir } from "../lib/tableSort";
import { startSimulatedLoadProgress } from "../lib/loadProgress";
import { MIN_DATA_YEAR, maxSelectableYear } from "../lib/yearBounds";
import PageIntro from "../components/layout/PageIntro";
import { PAGE_INTRO } from "../lib/platformCopy";
import { strengthLabel, parsePValueSort } from "../lib/businessCorrelationUi";
import BusinessAnalysisToolbar from "../components/business/BusinessAnalysisToolbar";
import BusinessScatterPanel from "../components/business/BusinessScatterPanel";
import BusinessAnalysisResults from "../components/business/BusinessAnalysisResults";
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

  const [metrics, setMetrics] = useState<MetricDef[]>([]);
  const [startYear, setStartYear] = useState(MIN_DATA_YEAR);
  const [endYear, setEndYear] = useState(() => maxSelectableYear());
  const [strictSelectedRange, setStrictSelectedRange] = useState(false);
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
    setLoading(true);
    setAnalysisLoadProgress(8);
    setAnalysisDeliveryNote(null);
    setErr(null);
    const stopAnalysisProgress = startSimulatedLoadProgress(setAnalysisLoadProgress);
    try {
      const attemptRanges: Array<{ start: number; end: number; timeoutMs: number; note?: string }> = [
        { start: startYear, end: endYear, timeoutMs: 90_000 },
      ];
      const selectedSpan = endYear - startYear + 1;
      const y12Start = Math.max(MIN_DATA_YEAR, endYear - 11);
      const y6Start = Math.max(MIN_DATA_YEAR, endYear - 5);
      // Auto-narrow on timeout unless the user locked the exact year span.
      if (!strictSelectedRange && selectedSpan > 12) {
        attemptRanges.push({
          start: y12Start,
          end: endYear,
          timeoutMs: 60_000,
          note: `Primary request timed out; using the last ${endYear - y12Start + 1} years instead.`,
        });
      }
      if (!strictSelectedRange && selectedSpan > 6 && y6Start > startYear) {
        attemptRanges.push({
          start: y6Start,
          end: endYear,
          timeoutMs: 45_000,
          note: `Still slow; using the last ${endYear - y6Start + 1} years for a reliable result.`,
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
        const raw = lastErr instanceof Error ? lastErr.message : String(lastErr ?? "Correlation analysis failed");
        const cleaned = raw.replace(/^Error:\s*/i, "");
        if (/timed?\s*out|CORRELATION_TIMEOUT/i.test(cleaned)) {
          throw new Error(
            strictSelectedRange
              ? "Correlation analysis timed out. Uncheck Strict year range, or shorten the years and try again."
              : "Correlation analysis timed out. Shorten the year range and try again."
          );
        }
        throw new Error(cleaned);
      }
      setAnalysisLoadProgress(100);
    } catch (e) {
      if (reqSeq !== analysisReqSeqRef.current) return;
      setErr(String(e));
      setRes(null);
      setAnalysisLoadProgress(0);
    } finally {
      stopAnalysisProgress();
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
    setBizNarrativeLoading(true);
    setNarrativeLoadProgress(8);
    setBizNarrativeErr(null);
    const stopNarrativeProgress = startSimulatedLoadProgress(setNarrativeLoadProgress);

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
      } catch (e) {
        if (reqSeq !== narrativeReqSeqRef.current) return;
        setBizNarrativeErr(e instanceof Error ? e.message : String(e));
        setNarrativeLoadProgress(0);
      } finally {
        stopNarrativeProgress();
        if (reqSeq !== narrativeReqSeqRef.current) return;
        setBizNarrativeLoading(false);
      }
    })();
    return () => {
      stopNarrativeProgress();
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
      v: 2,
      config: analysisConfig,
      res,
      narrative: bizNarrative ?? null,
    });
  }, [res, bizNarrative, analysisConfig]);

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageIntro
        {...PAGE_INTRO.business}
        actions={
          <button
            type="button"
            onClick={() => setPresentationMode((v) => !v)}
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              presentationMode
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            title="Toggle presentation mode (P)"
          >
            {presentationMode ? "Exit presentation" : "Presentation"}
          </button>
        }
      />

      {!presentationMode ? (
        <BusinessAnalysisToolbar
          metrics={metrics}
          startYear={startYear}
          endYear={endYear}
          onStartYearChange={setStartYear}
          onEndYearChange={setEndYear}
          excludeIqr={excludeIqr}
          onExcludeIqrChange={setExcludeIqr}
          strictSelectedRange={strictSelectedRange}
          onStrictSelectedRangeChange={setStrictSelectedRange}
          highlight={highlight}
          onHighlightChange={setHighlight}
          xId={xId}
          yId={yId}
          onXIdChange={setXId}
          onYIdChange={setYId}
          loading={loading}
          onGenerate={onGenerateAnalysis}
          labelX={labelX}
          labelY={labelY}
        />
      ) : null}

      <BusinessScatterPanel
        loading={loading}
        loadProgress={analysisLoadProgress}
        yearCount={yearCount}
        err={err}
        onRetry={onGenerateAnalysis}
        hasResult={Boolean(res)}
        analysisRestoredFromCache={analysisRestoredFromCache}
        analysisDeliveryNote={analysisDeliveryNote}
        highlightName={highlightName}
        highlight={highlight}
        labelX={labelX}
        labelY={labelY}
        scatterPoints={scatterPoints}
        ciBand={res?.ciBand ?? []}
        slope={res?.slope ?? null}
        intercept={res?.intercept ?? null}
        correlation={res?.correlation ?? null}
      />

      {res && !loading ? (
        <BusinessAnalysisResults
          res={{
            n: res.n,
            nMissing: res.nMissing,
            nIqrFlagged: res.nIqrFlagged,
            excludeIqr: res.excludeIqr,
            correlation: res.correlation,
            pValue: res.pValue,
            rSquared: res.rSquared,
            slope: res.slope,
            points: res.points.map((p) => ({
              fitted: p.fitted,
              residual: p.residual,
              countryName: p.countryName,
              year: p.year,
            })),
            subgroups: res.subgroups,
          }}
          labelX={labelX}
          labelY={labelY}
          analysisStartYear={analysisStartYear}
          analysisEndYear={analysisEndYear}
          analysisYearCount={analysisYearCount}
          execSortKey={execSortKey}
          execSortDir={execSortDir}
          onExecSort={onExecSort}
          sortedExecRows={sortedExecRows}
          subgroupSortKey={subgroupSortKey}
          subgroupSortDir={subgroupSortDir}
          onSubgroupSort={onSubgroupSort}
          sortedSubgroups={sortedSubgroups}
          bizNarrative={bizNarrative}
          bizNarrativeLoading={bizNarrativeLoading}
          narrativeLoadProgress={narrativeLoadProgress}
          bizNarrativeErr={bizNarrativeErr}
        />
      ) : null}
    </div>
  );
}
