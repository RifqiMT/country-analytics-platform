import { useEffect, useRef, useState } from "react";
import CollapsibleToolbar from "../components/layout/CollapsibleToolbar";
import PageIntro from "../components/layout/PageIntro";
import CountrySelect from "../components/CountrySelect";
import { postJson } from "../api";
import type { PestelAnalysis } from "../types/pestel";
import { loadPestelFromCache, savePestelToCache } from "../lib/pestelAnalysisCache";
import PestelDimensionCard from "../components/pestel/PestelDimensionCard";
import PestelSwotGrid from "../components/pestel/PestelSwotGrid";
import PestelComprehensiveCard from "../components/pestel/PestelComprehensiveCard";
import PestelStrategicCard from "../components/pestel/PestelStrategicCard";
import PestelBulletCard from "../components/pestel/PestelBulletCard";
import { maxSelectableYear } from "../lib/yearBounds";
import ExportPngButton from "../components/ExportPngButton";

const WandIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.5 4.5L19 12l-5.5 3L10 19l-2.5-4L2 12l5.5-3L10 5z"
    />
  </svg>
);

export default function Pestel() {
  const [country, setCountry] = useState("IDN");
  const year = maxSelectableYear();
  const [analysis, setAnalysis] = useState<PestelAnalysis | null>(() => loadPestelFromCache("IDN")?.analysis ?? null);
  const [attr, setAttr] = useState<string[]>(() => loadPestelFromCache("IDN")?.attribution ?? []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pestelChartRef = useRef<HTMLDivElement | null>(null);

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
    try {
      const res = await postJson<{ analysis: PestelAnalysis; attribution: string[] }>("/api/analysis/pestel", {
        countryCode: country,
        year,
      });
      setAnalysis(res.analysis);
      setAttr(res.attribution);
      savePestelToCache(country, res.analysis, res.attribution);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro title="PESTEL Analysis">
        <p>
          Comprehensive macro-environmental analysis (Political, Economic, Social, Technological, Environmental,
          Legal) with PESTEL-SWOT matrix, new market analysis, key takeaways, and actionable recommendations.
          Uses platform data (World Bank, UN, WHO, IMF; 2000 – latest) and supplements with web search where
          dashboard data is limited.
        </p>
      </PageIntro>

      <CollapsibleToolbar title="Run analysis" summary={country || "Select country"} forceOpen={loading}>
        <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full flex-nowrap items-center gap-2 sm:gap-3">
            <div className="min-w-[10rem] flex-1 shrink-0 sm:min-w-[12rem] md:max-w-sm">
              <label className="sr-only">Country</label>
              <CountrySelect
                value={country}
                onChange={setCountry}
                variant="light"
                showLabel={false}
                className="gap-0 [&_input]:h-9 [&_input]:truncate [&_input]:py-1.5 [&_input]:pl-2.5 [&_input]:pr-8 [&_input]:text-xs sm:[&_input]:pl-3 sm:[&_input]:pr-10 sm:[&_input]:text-sm"
              />
            </div>
            <button
              type="button"
              onClick={run}
              disabled={!country || loading}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:ml-auto"
              title="Generate PESTEL analysis"
            >
              <WandIcon />
              {loading ? (
                <span className="whitespace-nowrap">…</span>
              ) : (
                <>
                  <span className="hidden whitespace-nowrap sm:inline">Generate PESTEL</span>
                  <span className="sr-only sm:hidden">Generate PESTEL analysis</span>
                </>
              )}
            </button>
          </div>
        </div>
      </CollapsibleToolbar>

      {err && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
      )}

      {attr.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
          <span className="font-semibold text-slate-600">Sources · </span>
          {attr.join(" · ")}
        </div>
      )}

      {analysis && (
        <div className="space-y-10">
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">PESTEL Analysis</h2>
                <p className="mt-1 text-sm text-slate-500">Summarized bullet points by macro-environmental factor.</p>
              </div>
              <div className="sm:self-end">
                <ExportPngButton
                  getTarget={() => pestelChartRef.current}
                  filename="pestel_analysis.png"
                  size="md"
                  title="Export PESTEL Analysis (PNG)"
                />
              </div>
            </div>
            <div ref={(n) => (pestelChartRef.current = n)} className="mt-6 space-y-4">
              {analysis.pestelDimensions.map((dim) => (
                <PestelDimensionCard key={`${dim.label}-${dim.letter}`} dim={dim} />
              ))}
            </div>
          </div>

          <PestelSwotGrid swot={analysis.swot} />
          <PestelComprehensiveCard sections={analysis.comprehensiveSections} />
          <PestelStrategicCard sections={analysis.strategicBusiness} />
          <PestelBulletCard title="New Market Analysis" items={analysis.newMarketAnalysis} />
          <PestelBulletCard title="Key Takeaways" items={analysis.keyTakeaways} />
          <PestelBulletCard title="Key recommendations" items={analysis.recommendations} />
        </div>
      )}
    </div>
  );
}
