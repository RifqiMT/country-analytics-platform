import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { subscribeApiTransport, type ApiTransportEvent } from "../api";

function formatClock(ts: number): string {
  try {
    const d = new Date(ts);
    return `${d.toLocaleTimeString(undefined, { hour12: false })}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  } catch {
    return String(ts);
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Short summary for the collapsed chip (no paths or raw errors). */
function collapsedSummary(events: ApiTransportEvent[]): { line1: string; line2: string; tone: "neutral" | "ok" | "fail" } {
  if (events.length === 0) {
    return { line1: "API activity", line2: "No requests yet", tone: "neutral" };
  }
  const last = events[0]!;
  const n = events.length;
  const countLabel = n === 1 ? "1 call" : `${n} calls`;
  if (last.outcome === "success") {
    return {
      line1: "API activity",
      line2: `${countLabel} · last ${last.durationSec.toFixed(2)}s · OK`,
      tone: "ok",
    };
  }
  return {
    line1: "API activity",
    line2: `${countLabel} · last failed (${last.durationSec.toFixed(2)}s)`,
    tone: "fail",
  };
}

export type ApiTransportPanelVariant = "floating" | "inline";

type Props = {
  variant?: ApiTransportPanelVariant;
  /** When `inline`, dock the popover to the end (right) for header placement under the blurb. */
  inlineAlign?: "start" | "end";
  /** Compact single-row chip inside the unified header tools strip. */
  embedded?: boolean;
};

export default function ApiTransportPanel({
  variant = "floating",
  inlineAlign = "start",
  embedded = false,
}: Props) {
  const [events, setEvents] = useState<ApiTransportEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [expandedPathIds, setExpandedPathIds] = useState<Set<string>>(() => new Set());
  const [portalStyle, setPortalStyle] = useState<CSSProperties>({});
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inline = variant === "inline";
  const inlineEnd = inline && inlineAlign === "end";
  const usePortal = inline && embedded;

  useEffect(() => {
    return subscribeApiTransport((e) => {
      setEvents((prev) => [e, ...prev].slice(0, 100));
    });
  }, []);

  const updatePortalPosition = useCallback(() => {
    const el = toggleRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(448, window.innerWidth - 24);
    const right = Math.max(12, window.innerWidth - rect.right);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openBelow = spaceBelow >= 240 || spaceBelow >= rect.top;
    setPortalStyle(
      openBelow
        ? {
            position: "fixed",
            top: rect.bottom + margin,
            right,
            width,
            maxHeight: "min(75vh, 620px)",
            zIndex: 250,
          }
        : {
            position: "fixed",
            bottom: window.innerHeight - rect.top + margin,
            right,
            width,
            maxHeight: "min(75vh, 620px)",
            zIndex: 250,
          }
    );
  }, []);

  useLayoutEffect(() => {
    if (!usePortal || !open) return;
    updatePortalPosition();
    window.addEventListener("scroll", updatePortalPosition, true);
    window.addEventListener("resize", updatePortalPosition);
    return () => {
      window.removeEventListener("scroll", updatePortalPosition, true);
      window.removeEventListener("resize", updatePortalPosition);
    };
  }, [open, usePortal, updatePortalPosition, events.length]);

  useEffect(() => {
    if (!usePortal || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [usePortal, open]);

  const toggleExcerpt = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    setExpandedIds(new Set());
    setExpandedPathIds(new Set());
  }, []);

  const togglePathExpanded = useCallback((id: string) => {
    setExpandedPathIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { line1, line2, tone } = collapsedSummary(events);

  const chipStyles =
    tone === "fail"
      ? "border-red-200 bg-red-50/95 text-red-950 hover:bg-red-100/95"
      : tone === "ok"
        ? "border-slate-200 bg-white/95 text-slate-900 hover:bg-slate-50/95"
        : "border-slate-200 bg-white/95 text-slate-700 hover:bg-slate-50/95";

  const panel = open ? (
        <div
          id="api-transport-log-panel"
          className={`pointer-events-auto flex max-h-[min(75vh,620px)] w-[min(100vw-1.25rem,28rem)] max-w-[calc(100vw-1.25rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.28)] ${
            usePortal
              ? ""
              : inline
                ? `absolute z-[200] ${inlineEnd ? "right-0 left-auto" : "left-0"} ${embedded ? "bottom-full mb-2" : "top-full mt-2"}`
                : "relative"
          }`}
          style={usePortal ? portalStyle : undefined}
          role="region"
          aria-label="API request log — full detail"
        >
          <header className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Request log</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Client <code className="rounded bg-white px-1 py-px font-mono text-[10px] text-slate-700 ring-1 ring-slate-200/80">getJson</code>{" "}
                  / <code className="rounded bg-white px-1 py-px font-mono text-[10px] text-slate-700 ring-1 ring-slate-200/80">postJson</code>
                  — duration, status, size. Scroll long URLs inside each row.
                </p>
              </div>
              {events.length > 0 ? (
                <button
                  type="button"
                  onClick={clear}
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                >
                  Clear all
                </button>
              ) : null}
            </div>
          </header>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-contain bg-slate-50 p-2 sm:p-3">
            {events.length === 0 ? (
              <li className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">No requests yet</p>
                <p className="mt-1 text-xs text-slate-500">Calls appear here as you use the app.</p>
              </li>
            ) : (
              events.map((e) => {
                const pathLong = e.path.length > 96;
                const pathOpen = expandedPathIds.has(e.id);
                return (
                  <li
                    key={e.id}
                    className={`rounded-lg border bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.04] ${
                      e.outcome === "success"
                        ? "border-slate-200 border-l-[3px] border-l-emerald-500"
                        : "border-slate-200 border-l-[3px] border-l-red-500"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            e.outcome === "success"
                              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                              : "bg-red-50 text-red-800 ring-1 ring-red-200"
                          }`}
                        >
                          {e.outcome === "success" ? "Success" : "Failed"}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                          {e.method}
                        </span>
                      </div>
                      <time
                        className="font-mono text-[10px] tabular-nums text-slate-400"
                        dateTime={new Date(e.at).toISOString()}
                      >
                        {formatClock(e.at)}
                      </time>
                    </div>

                    <div className="mt-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Endpoint</p>
                      <div
                        className={`rounded-md border border-slate-200 bg-slate-50 font-mono text-[11px] leading-snug text-slate-800 ${
                          pathLong && !pathOpen ? "max-h-[3.25rem] overflow-hidden" : "max-h-[min(12rem,40vh)] overflow-y-auto"
                        } break-all px-2 py-1.5`}
                      >
                        {pathLong && !pathOpen ? `${e.path.slice(0, 96)}…` : e.path}
                      </div>
                      {pathLong ? (
                        <button
                          type="button"
                          onClick={() => togglePathExpanded(e.id)}
                          className="mt-1 text-[10px] font-semibold text-teal-700 hover:text-teal-800 hover:underline"
                        >
                          {pathOpen ? "Show less" : "Show full URL"}
                        </button>
                      ) : null}
                    </div>

                    <dl className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
                      <div className="rounded-md bg-slate-50 px-1.5 py-1.5 text-center ring-1 ring-slate-100 sm:px-2">
                        <dt className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Duration</dt>
                        <dd className="mt-0.5 font-mono text-[11px] font-semibold tabular-nums text-slate-900 sm:text-xs">
                          {e.durationSec.toFixed(3)}s
                        </dd>
                      </div>
                      <div className="rounded-md bg-slate-50 px-1.5 py-1.5 text-center ring-1 ring-slate-100 sm:px-2">
                        <dt className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">HTTP</dt>
                        <dd className="mt-0.5 font-mono text-[11px] font-semibold text-slate-900 sm:text-xs">{e.status ?? "—"}</dd>
                      </div>
                      <div className="rounded-md bg-slate-50 px-1.5 py-1.5 text-center ring-1 ring-slate-100 sm:px-2">
                        <dt className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Size</dt>
                        <dd className="mt-0.5 font-mono text-[11px] font-semibold tabular-nums text-slate-900 sm:text-xs">
                          {e.outcome === "success" ? formatBytes(e.responseBytes) : "—"}
                        </dd>
                      </div>
                    </dl>

                    {e.outcome === "failure" && (
                      <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2">
                        <p className="text-xs font-medium text-red-900">{e.error}</p>
                        {e.bodyExcerpt ? (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => toggleExcerpt(e.id)}
                              className="text-xs font-semibold text-red-800 underline decoration-red-300 underline-offset-2 hover:decoration-red-600"
                            >
                              {expandedIds.has(e.id) ? "Hide response body" : "Show response body"}
                            </button>
                            {expandedIds.has(e.id) ? (
                              <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-slate-700 bg-slate-900 p-2 font-mono text-[10px] leading-relaxed text-slate-100">
                                {e.bodyExcerpt}
                              </pre>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
  ) : null;

  const bolt = (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  const chevron = (
    <span className={`shrink-0 text-slate-400 transition-transform ${open ? "-rotate-180" : ""}`} aria-hidden>
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </span>
  );

  const toggleButton = inline ? (
    <button
      ref={toggleRef}
      type="button"
      onClick={() => {
        setOpen((o) => !o);
      }}
      className={`flex w-full items-center gap-2 text-left transition ${
        embedded
          ? `min-h-[2.75rem] px-3 py-2.5 hover:bg-slate-100/80 sm:px-4 ${open ? "bg-slate-100/80" : ""}`
          : `pointer-events-auto max-w-full rounded-lg border px-2.5 py-1.5 shadow-sm ${chipStyles}`
      }`}
      aria-expanded={open}
      aria-controls={open ? "api-transport-log-panel" : undefined}
      title={open ? "Hide request log" : "Show API request log"}
      aria-label={`API requests: ${line2}. ${open ? "Expanded" : "Collapsed"}.`}
      id="api-transport-toggle"
    >
      <span className={tone === "fail" ? "text-red-600" : "text-slate-500"}>{bolt}</span>
      <span className="min-w-0 flex-1">
        {embedded ? (
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold uppercase tracking-wide text-slate-600">Request log</span>
            {chevron}
          </span>
        ) : (
          <span className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">API</span>
            {chevron}
          </span>
        )}
        <span className={`block truncate font-medium leading-tight text-slate-800 ${embedded ? "mt-0.5 text-xs" : "mt-0.5 text-xs"}`}>
          {line2}
        </span>
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={`pointer-events-auto flex min-w-[11rem] max-w-[min(18rem,calc(100vw-1.5rem))] items-center gap-2 rounded-2xl border px-3 py-2.5 text-left shadow-md ring-1 ring-black/5 transition ${chipStyles}`}
      aria-expanded={open}
      aria-controls={open ? "api-transport-log-panel" : undefined}
      id="api-transport-toggle"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900/[0.06] text-slate-600"
        aria-hidden
      >
        {bolt}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{line1}</span>
          {chevron}
        </span>
        <span className="mt-0.5 block text-[12px] font-medium leading-snug text-slate-800">{line2}</span>
        <span className="mt-1 block text-[10px] text-slate-500">Tap to {open ? "collapse" : "expand"} details</span>
      </span>
    </button>
  );

  if (inline) {
    const portalBackdrop =
      usePortal && open
        ? createPortal(
            <button
              type="button"
              className="fixed inset-0 z-[240] cursor-default bg-transparent"
              aria-label="Close request log"
              onClick={() => setOpen(false)}
            />,
            document.body
          )
        : null;

    const portalPanel = usePortal && panel ? createPortal(panel, document.body) : null;

    return (
      <>
        {portalBackdrop}
        {portalPanel}
        <div
          className={
            embedded
              ? "relative flex h-full w-full min-w-0 items-stretch"
              : `pointer-events-none relative z-[170] flex max-w-[min(18rem,calc(100vw-2rem))] flex-col gap-1.5 ${inlineEnd ? "items-end" : "items-start"}`
          }
        >
          {!usePortal ? panel : null}
          {toggleButton}
        </div>
      </>
    );
  }

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-[180] flex max-w-[calc(100vw-1.5rem)] flex-col-reverse items-start gap-2 sm:bottom-4 sm:left-4">
      {panel}
      {toggleButton}
    </div>
  );
}
