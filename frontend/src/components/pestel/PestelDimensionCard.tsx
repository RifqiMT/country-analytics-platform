import { useRef } from "react";
import type { PestelDimension } from "../../types/pestel";
import { PESTEL_DIMENSION_STYLES } from "./pestelTheme";
import ExportPngButton from "../ExportPngButton";

export default function PestelDimensionCard({ dim }: { dim: PestelDimension }) {
  const style = PESTEL_DIMENSION_STYLES[dim.label] ?? {
    header: "#475569",
    tint: "#f8fafc",
  };
  const cardRef = useRef<HTMLElement | null>(null);
  const filename = `pestel_${dim.label.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.png`;

  return (
    <article
      ref={(n) => {
        cardRef.current = n;
      }}
      className="group relative flex overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div
        className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 px-2 py-5 text-center text-white sm:w-24"
        style={{ backgroundColor: style.header }}
      >
        <span className="text-2xl font-bold leading-none sm:text-3xl">{dim.letter}</span>
        <span className="hidden text-[0.6rem] font-semibold uppercase tracking-wider sm:block">
          {dim.label.slice(0, 4)}
        </span>
      </div>
      <div className="relative min-w-0 flex-1 p-4" style={{ backgroundColor: style.tint }}>
        <div className="absolute right-2 top-2 z-10 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <ExportPngButton
            getTarget={() => cardRef.current}
            filename={filename}
            size="sm"
            title={`Export ${dim.label} (PNG)`}
          />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:hidden">{dim.label}</p>
        <ul className="space-y-2 pr-8 sm:pr-10">
          {dim.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: style.header }} aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
