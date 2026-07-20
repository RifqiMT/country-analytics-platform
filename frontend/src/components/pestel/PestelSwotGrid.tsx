import { useRef } from "react";
import type { PestelSwot } from "../../types/pestel";
import { SWOT_STYLES } from "./pestelTheme";
import ExportPngButton from "../ExportPngButton";

type Key = keyof PestelSwot;

export default function PestelSwotGrid({ swot }: { swot: PestelSwot }) {
  const keys: Key[] = ["strengths", "weaknesses", "opportunities", "threats"];
  const swotRef = useRef<HTMLElement | null>(null);
  const MAX_ITEMS_PER_CARD = 5;

  return (
    <section ref={(n) => (swotRef.current = n)} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Positioning</p>
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">SWOT matrix</h2>
          <p className="mt-0.5 text-sm text-slate-500">Internal vs external, helpful vs harmful.</p>
        </div>
        <ExportPngButton
          getTarget={() => swotRef.current}
          filename="pestel_swot_analysis.png"
          size="md"
          title="Export SWOT analysis (PNG)"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {keys.map((k) => {
          const cfg = SWOT_STYLES[k];
          const items = swot[k]
            .map((line) => String(line).replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .slice(0, MAX_ITEMS_PER_CARD);
          return (
            <article
              key={k}
              className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
            >
              <div
                className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: cfg.header }}
              >
                <span>{cfg.title}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 p-4" style={{ backgroundColor: cfg.tint }}>
                <ul className="space-y-2">
                  {items.map((bullet, i) => (
                    <li key={`${k}-b-${i}`} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cfg.header }}
                        aria-hidden
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
