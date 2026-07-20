import { useEffect, useMemo, useState } from "react";
import PageIntro from "../components/layout/PageIntro";
import { PAGE_INTRO } from "../lib/platformCopy";
import LoadingProgressSection from "../components/ui/LoadingProgressSection";
import { getJson, postJson } from "../api";
import { startSimulatedLoadProgress } from "../lib/loadProgress";
import type { PorterAnalysis, IloIsicDivision } from "../types/porter";
import PorterForcesHub from "../components/porter/PorterForcesHub";
import PorterComprehensiveCard from "../components/porter/PorterComprehensiveCard";
import PorterAnalysisToolbar from "../components/porter/PorterAnalysisToolbar";
import PorterInsightsPanel from "../components/porter/PorterInsightsPanel";
import { maxSelectableYear } from "../lib/yearBounds";
import { loadPorterFromCache, savePorterToCache } from "../lib/porterAnalysisCache";
import { readStoredDashboardCountry } from "../dashboardCountryStorage";

const defaultIndustry = "10 - Manufacture of food products";

function resolvedIndustrySector(industry: string, divisions: IloIsicDivision[]): string {
  if (industry.trim()) return industry;
  if (divisions.length) return `${divisions[0]!.code} - ${divisions[0]!.label}`;
  return defaultIndustry;
}

export default function Porter() {
  const [country, setCountry] = useState(() => readStoredDashboardCountry() ?? "IDN");
  const [industry, setIndustry] = useState(defaultIndustry);
  const [divisions, setDivisions] = useState<IloIsicDivision[]>([]);
  const year = maxSelectableYear();
  const [analysis, setAnalysis] = useState<PorterAnalysis | null>(null);
  const [attr, setAttr] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getJson<IloIsicDivision[]>("/api/ilo-isic-divisions")
      .then(setDivisions)
      .catch(() => setDivisions([]));
  }, []);

  const industryOptions = useMemo(
    () => (divisions.length ? divisions : [{ code: "10", label: "Manufacture of food products" }]),
    [divisions]
  );

  const industryForApi = resolvedIndustrySector(industry, divisions);

  useEffect(() => {
    if (!country) return;
    const hit = loadPorterFromCache(country, industryForApi);
    if (hit) {
      setAnalysis(hit.analysis);
      setAttr(hit.attribution);
      setErr(null);
    } else {
      setAnalysis(null);
      setAttr([]);
    }
  }, [country, industryForApi]);

  const run = async () => {
    if (!country) return;
    setLoading(true);
    setErr(null);
    const stopProgress = startSimulatedLoadProgress(setLoadProgress);
    try {
      const industryValue = industryForApi;
      const res = await postJson<{ analysis: PorterAnalysis; attribution: string[] }>("/api/analysis/porter", {
        countryCode: country,
        year,
        industrySector: industryValue,
      });
      setAnalysis(res.analysis);
      setAttr(res.attribution);
      savePorterToCache(country, industryValue, res.analysis, res.attribution);
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
      <PageIntro {...PAGE_INTRO.porter} />

      <PorterAnalysisToolbar
        country={country}
        onCountryChange={setCountry}
        industry={industry}
        onIndustryChange={setIndustry}
        industryOptions={industryOptions}
        industryLabel={industryForApi}
        loading={loading}
        onGenerate={run}
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {err.replace(/^Error:\s*/i, "")}
        </div>
      ) : null}

      {loading ? <LoadingProgressSection label="Generating five forces analysis…" progress={loadProgress} /> : null}

      {!loading && !analysis && !err ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-900">Ready when you are</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Choose a country and industry, then generate a structured five forces report for that sector.
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
          <PorterForcesHub forces={analysis.forces} />
          <PorterComprehensiveCard sections={analysis.comprehensiveSections} />
          <PorterInsightsPanel analysis={analysis} />
        </div>
      ) : null}
    </div>
  );
}
