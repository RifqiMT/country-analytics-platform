import CountrySelect from "../CountrySelect";
import { writeStoredDashboardCountry } from "../../dashboardCountryStorage";

type Props = {
  country: string;
  onCountryChange: (cca3: string) => void;
  model: "groq" | "tavily";
  onModelChange: (model: "groq" | "tavily") => void;
};

/** Country focus and answer routing mode. */
export default function AssistantToolbar({ country, onCountryChange, model, onModelChange }: Props) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 lg:grid-cols-2 lg:items-end lg:gap-4">
        <div className="min-w-0">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Focus country</label>
          <p className="mt-0.5 text-xs text-slate-500">Used for dashboard metrics unless your question names others.</p>
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
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Answer mode</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Auto prefers dashboard data. Web-first always searches when Tavily is configured.
          </p>
          <div
            className="mt-1.5 inline-flex w-full rounded-lg bg-slate-100 p-0.5 sm:w-auto"
            role="group"
            aria-label="Answer mode"
          >
            <button
              type="button"
              onClick={() => onModelChange("groq")}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 ${
                model === "groq" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => onModelChange("tavily")}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 ${
                model === "tavily" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Web-first
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
