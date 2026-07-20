import CountrySelect from "../CountrySelect";
import { writeStoredDashboardCountry } from "../../dashboardCountryStorage";

type Props = {
  country: string;
  onCountryChange: (cca3: string) => void;
  year: number;
  loading: boolean;
  onGenerate: () => void;
};

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

/** Country control and generate action for PESTEL analysis. */
export default function PestelAnalysisToolbar({
  country,
  onCountryChange,
  year,
  loading,
  onGenerate,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-4">
        <div className="min-w-0">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Country</label>
          <p className="mt-0.5 text-xs text-slate-500">
            Macro environment for {year}. Uses the same focus country as the dashboard when available.
          </p>
          <div className="mt-1.5 min-w-0 max-w-md">
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
        <button
          type="button"
          onClick={onGenerate}
          disabled={!country || loading}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <WandIcon />
          {loading ? "Generating…" : "Generate analysis"}
        </button>
      </div>
    </div>
  );
}
