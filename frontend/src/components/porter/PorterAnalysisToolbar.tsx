import CountrySelect from "../CountrySelect";
import { writeStoredDashboardCountry } from "../../dashboardCountryStorage";
import type { IloIsicDivision } from "../../types/porter";

type Props = {
  country: string;
  onCountryChange: (cca3: string) => void;
  industry: string;
  onIndustryChange: (value: string) => void;
  industryOptions: IloIsicDivision[];
  industryLabel: string;
  loading: boolean;
  onGenerate: () => void;
};

const LightningIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

/** Country and ILO-ISIC industry controls for Porter analysis. */
export default function PorterAnalysisToolbar({
  country,
  onCountryChange,
  industry,
  onIndustryChange,
  industryOptions,
  industryLabel,
  loading,
  onGenerate,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <div className="min-w-0">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Country</label>
          <p className="mt-0.5 text-xs text-slate-500">Market context for the five forces assessment.</p>
          <div className="mt-1.5 min-w-0">
            <CountrySelect
              value={country}
              onChange={(cca3) => {
                writeStoredDashboardCountry(cca3);
                onCountryChange(cca3);
              }}
              variant="light"
              showLabel={false}
            />
          </div>
        </div>

        <div className="min-w-0">
          <label htmlFor="porter-industry" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Industry (ILO-ISIC)
          </label>
          <p className="mt-0.5 text-xs text-slate-500">Sector focus within the selected country.</p>
          <select
            id="porter-industry"
            value={industry}
            onChange={(e) => onIndustryChange(e.target.value)}
            title={industryLabel}
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
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
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Analysis uses platform indicators and optional web or LLM enrichment when keys are set.
        </p>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!country || loading}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LightningIcon />
          {loading ? "Generating…" : "Generate analysis"}
        </button>
      </div>
    </div>
  );
}
