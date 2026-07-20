import { useRef } from "react";
import type { PorterForce } from "../../types/porter";
import { PORTER_ACCENT_COLORS } from "./porterTheme";
import ExportPngButton from "../ExportPngButton";

export default function PorterForceCard({ force }: { force: PorterForce }) {
  const color = PORTER_ACCENT_COLORS[force.accent] ?? "#64748b";
  const cardRef = useRef<HTMLElement | null>(null);
  const filename = `porter_force_${force.number}_${force.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.png`;

  return (
    <article
      ref={(n) => {
        cardRef.current = n;
      }}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: color }}
              aria-hidden
            >
              {force.number}
            </div>
            <h3 className="text-sm font-semibold leading-snug text-slate-900 sm:text-[15px]">{force.title}</h3>
          </div>
          <div className="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <ExportPngButton
              getTarget={() => cardRef.current}
              filename={filename}
              size="sm"
              title={`Export ${force.title} (PNG)`}
            />
          </div>
        </div>
        <ul className="mt-3 flex-1 space-y-2">
          {force.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-600">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
