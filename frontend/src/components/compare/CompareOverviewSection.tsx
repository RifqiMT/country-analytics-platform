import ComparePairField, { ComparePairHeader } from "./ComparePairField";
import type { CountrySummary } from "../../api";
import { formatCompactNumber } from "../../lib/formatValue";

type Props = {
  metaA: CountrySummary;
  metaB: CountrySummary;
  nameA: string;
  nameB: string;
};

function pill(text: string, tone: "slate" | "rose" | "teal" = "slate") {
  const tones = {
    slate: "bg-slate-100 text-slate-800 ring-slate-200",
    rose: "bg-rose-50 text-rose-800 ring-rose-100",
    teal: "bg-teal-50 text-teal-800 ring-teal-100",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}>
      {text}
    </span>
  );
}

export default function CompareOverviewSection({ metaA, metaB, nameA, nameB }: Props) {
  return (
    <div className="space-y-6">
      <ComparePairHeader nameA={nameA} nameB={nameB} />

      <div>
        <p className="dash-section-label">Location & classification</p>
        <div className="dash-subsection-grid lg:grid-cols-2">
          <ComparePairField
            label="Region"
            nameA={nameA}
            nameB={nameB}
            valueA={pill(metaA.region || "—", "rose")}
            valueB={pill(metaB.region || "—", "rose")}
          />
          <ComparePairField
            label="Income level"
            nameA={nameA}
            nameB={nameB}
            valueA={pill(metaA.worldBankProfile?.incomeLevel || "—", "teal")}
            valueB={pill(metaB.worldBankProfile?.incomeLevel || "—", "teal")}
          />
        </div>
      </div>

      <div>
        <p className="dash-section-label">Administrative</p>
        <ComparePairField
          label="Capital city"
          nameA={nameA}
          nameB={nameB}
          valueA={<p className="text-base font-semibold text-slate-900">{metaA.capital?.[0] ?? "—"}</p>}
          valueB={<p className="text-base font-semibold text-slate-900">{metaB.capital?.[0] ?? "—"}</p>}
        />
      </div>

      <div>
        <p className="dash-section-label">Geography</p>
        <div className="dash-subsection-grid lg:grid-cols-2">
          <ComparePairField
            label="Land area"
            nameA={nameA}
            nameB={nameB}
            valueA={
              <p className="text-base font-semibold tabular-nums text-slate-900">
                {formatCompactNumber(metaA.landAreaKm2 ?? metaA.area, { suffix: " km²", maxFrac: 2 })}
              </p>
            }
            valueB={
              <p className="text-base font-semibold tabular-nums text-slate-900">
                {formatCompactNumber(metaB.landAreaKm2 ?? metaB.area, { suffix: " km²", maxFrac: 2 })}
              </p>
            }
          />
          <ComparePairField
            label="Total area"
            nameA={nameA}
            nameB={nameB}
            valueA={
              <p className="text-base font-semibold tabular-nums text-slate-900">
                {formatCompactNumber(metaA.totalAreaKm2 ?? metaA.area, { suffix: " km²", maxFrac: 2 })}
              </p>
            }
            valueB={
              <p className="text-base font-semibold tabular-nums text-slate-900">
                {formatCompactNumber(metaB.totalAreaKm2 ?? metaB.area, { suffix: " km²", maxFrac: 2 })}
              </p>
            }
          />
        </div>
      </div>
    </div>
  );
}
