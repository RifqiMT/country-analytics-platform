import { useRef } from "react";
import type { PorterForce } from "../../types/porter";
import PorterForceCard from "./PorterForceCard";
import ExportPngButton from "../ExportPngButton";
import { PORTER_ACCENT_COLORS, PORTER_FORCE_SHORT } from "./porterTheme";

/** Classic hub layout: rivalry center, other forces around it. Stacks cleanly on mobile. */
export default function PorterForcesHub({ forces }: { forces: PorterForce[] }) {
  const byNum = new Map(forces.map((f) => [f.number, f]));
  const f1 = byNum.get(1);
  const f2 = byNum.get(2);
  const f3 = byNum.get(3);
  const f4 = byNum.get(4);
  const f5 = byNum.get(5);
  const sectionRef = useRef<HTMLElement | null>(null);

  const ordered = [f1, f2, f5, f3, f4].filter(Boolean) as PorterForce[];

  return (
    <section ref={(n) => (sectionRef.current = n)} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Competitive structure</p>
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Five forces</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Rivalry sits at the center. Surrounding forces shape industry attractiveness.
          </p>
        </div>
        <ExportPngButton
          getTarget={() => sectionRef.current}
          filename="porter_5_forces_analysis.png"
          size="md"
          title="Export Porter five forces (PNG)"
        />
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Force overview">
        {ordered.map((f) => {
          const color = PORTER_ACCENT_COLORS[f.accent] ?? "#64748b";
          return (
            <span
              key={f.number}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              {PORTER_FORCE_SHORT[f.number] ?? f.title}
            </span>
          );
        })}
      </div>

      {/* Mobile: simple stack in Porter order */}
      <div className="grid gap-3 sm:hidden">
        {ordered.map((f) => (
          <PorterForceCard key={f.number} force={f} />
        ))}
      </div>

      {/* Desktop: hub-and-spoke grid */}
      <div className="relative hidden gap-3 sm:grid sm:grid-cols-3 sm:grid-rows-3 sm:gap-4">
        {f1 ? (
          <div className="sm:col-start-2 sm:row-start-1">
            <PorterForceCard force={f1} />
          </div>
        ) : null}
        {f2 ? (
          <div className="sm:col-start-1 sm:row-start-2">
            <PorterForceCard force={f2} />
          </div>
        ) : null}
        {f5 ? (
          <div className="sm:col-start-2 sm:row-start-2">
            <PorterForceCard force={f5} />
          </div>
        ) : null}
        {f3 ? (
          <div className="sm:col-start-3 sm:row-start-2">
            <PorterForceCard force={f3} />
          </div>
        ) : null}
        {f4 ? (
          <div className="sm:col-start-2 sm:row-start-3">
            <PorterForceCard force={f4} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
