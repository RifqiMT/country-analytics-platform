import { useState } from "react";
import type { ApiTransportEvent } from "../api";
import { requestKindLabel, requestLogBrief, requestLogOutcomeLine } from "../lib/toastPresentation";

function formatClock(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(sec: number): string {
  if (sec < 1) return `${Math.round(sec * 1000)} ms`;
  if (sec < 10) return `${sec.toFixed(2)} s`;
  return `${sec.toFixed(1)} s`;
}

type Props = {
  event: ApiTransportEvent;
  isLatest?: boolean;
};

export default function RequestLogRow({ event, isLatest = false }: Props) {
  const [open, setOpen] = useState(false);
  const ok = event.outcome === "success";
  const kind = requestKindLabel(event.path);
  const brief = requestLogBrief(event.path);

  return (
    <li
      className={`border-b border-slate-100 last:border-b-0 ${isLatest ? "bg-teal-50/30" : "bg-white"}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50/90 sm:gap-3 sm:px-4"
        aria-expanded={open}
      >
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-slate-900">{kind}</span>
            <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-slate-600">
              {event.method}
            </span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${ok ? "text-emerald-700" : "text-red-700"}`}
            >
              {ok ? "Completed" : "Failed"}
            </span>
          </span>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{brief}</p>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums text-slate-500">
            <span>{formatDuration(event.durationSec)}</span>
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <span>Status {event.status ?? "n/a"}</span>
            {ok ? (
              <>
                <span className="text-slate-300" aria-hidden>
                  |
                </span>
                <span>{formatBytes(event.responseBytes)} returned</span>
              </>
            ) : null}
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <time className="text-slate-400" dateTime={new Date(event.at).toISOString()}>
              {formatClock(event.at)}
            </time>
          </span>
        </span>
        <span className="mt-1 shrink-0 text-slate-400" aria-hidden>
          <svg
            className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5 sm:px-4">
          <p className="text-xs leading-relaxed text-slate-700">
            {requestLogOutcomeLine(event.path, event.outcome)}
          </p>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Technical path</p>
            <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-slate-800">{event.path}</p>
          </div>
          {!ok ? (
            <div className="rounded-lg border border-red-200/80 bg-red-50/80 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-800">What went wrong</p>
              <p className="mt-1 text-xs leading-relaxed text-red-900">{event.error}</p>
              {event.bodyExcerpt ? (
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-slate-900 p-2 font-mono text-[10px] leading-relaxed text-slate-100">
                  {event.bodyExcerpt}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
