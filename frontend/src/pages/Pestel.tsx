import { useEffect, useState } from "react";
import PageIntro from "../components/layout/PageIntro";
import { PAGE_INTRO } from "../lib/platformCopy";
import LoadingProgressSection from "../components/ui/LoadingProgressSection";
import { postJson } from "../api";
import { startSimulatedLoadProgress } from "../lib/loadProgress";
import type { PestelAnalysis } from "../types/pestel";
import { loadPestelFromCache, savePestelToCache } from "../lib/pestelAnalysisCache";
import PestelAnalysisToolbar from "../components/pestel/PestelAnalysisToolbar";
import PestelDimensionsHub from "../components/pestel/PestelDimensionsHub";
import PestelSwotGrid from "../components/pestel/PestelSwotGrid";
import PestelComprehensiveCard from "../components/pestel/PestelComprehensiveCard";
import PestelStrategicCard from "../components/pestel/PestelStrategicCard";
import PestelInsightsPanel from "../components/pestel/PestelInsightsPanel";
import { maxSelectableYear } from "../lib/yearBounds";
import { readStoredDashboardCountry } from "../dashboardCountryStorage";

export default function Pestel() {
  const [country, setCountry] = useState(() => readStoredDashboardCountry() ?? "IDN");
  const year = maxSelectableYear();
  const [analysis, setAnalysis] = useState<PestelAnalysis | null>(
    () => loadPestelFromCache(readStoredDashboardCountry() ?? "IDN")?.analysis ?? null
  );
  const [attr, setAttr] = useState<string[]>(
    () => loadPestelFromCache(readStoredDashboardCountry() ?? "IDN")?.attribution ?? []
  );
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const cached = loadPestelFromCache(country);
    if (cached) {
      setAnalysis(cached.analysis);
      setAttr(cached.attribution);
      setErr(null);
    } else {
      setAnalysis(null);
      setAttr([]);
    }
  }, [country]);

  const run = async () => {
    if (!country) return;
    setLoading(true);
    setErr(null);
    const stopProgress = startSimulatedLoadProgress(setLoadProgress);
    try {
      const res = await postJson<{ analysis: PestelAnalysis; attribution: string[] }>("/api/analysis/pestel", {
        countryCode: country,
        year,
      });
      setAnalysis(res.analysis);
      setAttr(res.attribution);
      savePestelToCache(country, res.analysis, res.attribution);
      setLoadProgress(100);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setLoadProgress(0);
    } finally {
      stopProgress();
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageIntro {...PAGE_INTRO.pestel} />

      <PestelAnalysisToolbar
        country={country}
        onCountryChange={setCountry}
        year={year}
        loading={loading}
        onGenerate={run}
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {err.replace(/^Error:\s*/i, "")}
        </div>
      ) : null}

      {loading ? <LoadingProgressSection label="Generating PESTEL analysis…" progress={loadProgress} /> : null}

      {!loading && !analysis && !err ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-900">Ready when you are</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Select a country, then generate a PESTEL report with SWOT, strategic implications, and recommendations.
          </p>
        </div>
      ) : null}

      {analysis && !loading ? (
        <div className="space-y-6 lg:space-y-8">
          {attr.length > 0 ? (
            <p className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Sources</span>
              <span className="mx-1.5 text-slate-300">·</span>
              {attr.join(" · ")}
            </p>
          ) : null}
          <PestelDimensionsHub dimensions={analysis.pestelDimensions} />
          <PestelSwotGrid swot={analysis.swot} />
          <PestelComprehensiveCard sections={analysis.comprehensiveSections} />
          <PestelStrategicCard sections={analysis.strategicBusiness} />
          <PestelInsightsPanel analysis={analysis} />
        </div>
      ) : null}
    </div>
  );
}
