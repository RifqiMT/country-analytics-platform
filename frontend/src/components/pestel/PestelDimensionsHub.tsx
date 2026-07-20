import { useRef } from "react";
import type { PestelDimension } from "../../types/pestel";
import PestelDimensionCard from "./PestelDimensionCard";
import ExportPngButton from "../ExportPngButton";
import { PESTEL_DIMENSION_STYLES } from "./pestelTheme";

/** Six PESTEL pillars with overview chips and export. */
export default function PestelDimensionsHub({ dimensions }: { dimensions: PestelDimension[] }) {
  const sectionRef = useRef<HTMLElement | null>(null);

  return (
    <section ref={(n) => (sectionRef.current = n)} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Macro environment</p>
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Six PESTEL pillars</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Political, economic, social, technological, environmental, and legal forces at a glance.
          </p>
        </div>
        <ExportPngButton
          getTarget={() => sectionRef.current}
          filename="pestel_analysis.png"
          size="md"
          title="Export PESTEL analysis (PNG)"
        />
      </div>

      <div className="flex flex-wrap gap-2" aria-label="PESTEL overview">
        {dimensions.map((dim) => {
          const style = PESTEL_DIMENSION_STYLES[dim.label] ?? { header: "#475569", tint: "#f1f5f9" };
          return (
            <span
              key={`${dim.label}-${dim.letter}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-white"
                style={{ backgroundColor: style.header }}
                aria-hidden
              >
                {dim.letter}
              </span>
              {dim.label.charAt(0) + dim.label.slice(1).toLowerCase()}
            </span>
          );
        })}
      </div>

      <div className="grid gap-3 sm:gap-4">
        {dimensions.map((dim) => (
          <PestelDimensionCard key={`${dim.label}-${dim.letter}`} dim={dim} />
        ))}
      </div>
    </section>
  );
}
