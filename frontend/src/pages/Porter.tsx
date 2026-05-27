import { useEffect, useMemo, useState } from "react";
import CollapsibleToolbar from "../components/layout/CollapsibleToolbar";
import PageIntro from "../components/layout/PageIntro";
import CountrySelect from "../components/CountrySelect";
import { getJson, postJson } from "../api";
import type { PorterAnalysis, IloIsicDivision } from "../types/porter";
import PorterForcesHub from "../components/porter/PorterForcesHub";
import PorterComprehensiveCard from "../components/porter/PorterComprehensiveCard";
import PestelBulletCard from "../components/pestel/PestelBulletCard";
import { maxSelectableYear } from "../lib/yearBounds";
import { loadPorterFromCache, savePorterToCache } from "../lib/porterAnalysisCache";

const LightningIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);

const defaultIndustry = "10 - Manufacture of food products";

function resolvedIndustrySector(industry: string, divisions: IloIsicDivision[]): string {
  if (industry.trim()) return industry;
  if (divisions.length) return `${divisions[0]!.code} - ${divisions[0]!.label}`;
  return defaultIndustry;
}

export default function Porter() {
  const [country, setCountry] = useState("IDN");
  const [industry, setIndustry] = useState(defaultIndustry);
  const [divisions, setDivisions] = useState<IloIsicDivision[]>([]);
  const year = maxSelectableYear();
  const [analysis, setAnalysis] = useState<PorterAnalysis | null>(null);
  const [attr, setAttr] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
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
    } else {
      setAnalysis(null);
      setAttr([]);
    }
  }, [country, industryForApi]);

  const run = async () => {
    if (!country) return;
    setLoading(true);
    setErr(null);
    try {
      const industryValue = industryForApi;
      const res = await postJson<{ analysis: PorterAnalysis; attribution: string[] }>(
        "/api/analysis/porter",
        { countryCode: country, year, industrySector: industryValue }
      );
      setAnalysis(res.analysis);
      setAttr(res.attribution);
      savePorterToCache(country, industryValue, res.analysis, res.attribution);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro title="Porter Five Forces">
        <p>
          Industry attractiveness analysis for the selected country and ILO-ISIC industry sector. Uses platform
          data (World Bank, UN, WHO, IMF; 2000–{maxSelectableYear()}) and supplementary information from Tavily,
          Groq, or other LLMs when configured.
        </p>
      </PageIntro>

      <CollapsibleToolbar
        title="Run analysis"
        summary={`${country} · ${industryForApi.split(" - ")[0] ?? industryForApi}`}
        forceOpen={loading}
      >
        <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full flex-nowrap items-center gap-2 sm:gap-3">
            <div className="w-[min(100%,10rem)] shrink-0 sm:w-[12rem] md:max-w-[14rem]">
              <label className="sr-only">Country</label>
              <CountrySelect
                value={country}
                onChange={setCountry}
                variant="light"
                showLabel={false}
                className="gap-0 [&_input]:h-9 [&_input]:truncate [&_input]:py-1.5 [&_input]:pl-2.5 [&_input]:pr-8 [&_input]:text-xs sm:[&_input]:pl-3 sm:[&_input]:pr-10 sm:[&_input]:text-sm"
              />
            </div>

            <div className="hidden h-9 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />

            <div className="w-[min(100%,11rem)] shrink-0 sm:w-[13rem] md:w-[16rem] lg:w-[18rem]">
              <label htmlFor="porter-industry" className="sr-only">
                Industry / sector (ILO-ISIC)
              </label>
              <select
                id="porter-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                title={industryForApi}
                className="h-9 w-full truncate rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 shadow-sm focus:border-red-300 focus:outline-none focus:ring-1 focus:ring-red-300 sm:px-3 sm:text-sm"
              >
                {industryOptions.map((d) => {
                  const val = `${d.code} - ${d.label}`;
                  return (
                    <option key={d.code} value={val}>
                      {val}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              type="button"
              onClick={run}
              disabled={!country || loading}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:ml-auto"
              title="Generate Porter Five Forces analysis"
            >
              <LightningIcon />
              {loading ? (
                <span className="whitespace-nowrap">…</span>
              ) : (
                <>
                  <span className="hidden whitespace-nowrap md:inline">Generate Porter 5 Forces</span>
                  <span className="hidden whitespace-nowrap sm:inline md:hidden">Generate Porter</span>
                  <span className="sr-only sm:hidden">Generate Porter Five Forces analysis</span>
                </>
              )}
            </button>
          </div>
        </div>
      </CollapsibleToolbar>

      {err && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </p>
      )}

      {attr.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
          <span className="font-semibold text-slate-600">Sources · </span>
          {attr.join(" · ")}
        </div>
      )}

      {analysis && (
        <div className="space-y-10">
          <PorterForcesHub forces={analysis.forces} />
          <PorterComprehensiveCard sections={analysis.comprehensiveSections} />
          <PestelBulletCard title="New Market Analysis" items={analysis.newMarketAnalysis} />
          <PestelBulletCard title="Key Takeaways" items={analysis.keyTakeaways} />
          <PestelBulletCard title="Key Recommendations" items={analysis.recommendations} />
        </div>
      )}
    </div>
  );
}
