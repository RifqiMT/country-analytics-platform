import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { subscribeApiTransport, type ApiTransportEvent } from "../api";
import { transportSummary, transportStripLine, transportStripStats, type TransportSummaryTone } from "../lib/apiTransportStats";
import RequestLogRow from "./RequestLogRow";
import TransportStripStats from "./TransportStripStats";

function toneStyles(tone: TransportSummaryTone, embedded: boolean): string {
  if (tone === "fail") {
    return embedded
      ? "hover:bg-red-50/80"
      : "border-red-200 bg-red-50/95 text-red-950 hover:bg-red-100/95";
  }
  if (tone === "busy") {
    return embedded
      ? "hover:bg-amber-50/60"
      : "border-amber-200 bg-amber-50/90 text-amber-950 hover:bg-amber-100/90";
  }
  if (tone === "ok") {
    return embedded ? "hover:bg-slate-50/80" : "border-slate-200 bg-white/95 text-slate-900 hover:bg-slate-50/95";
  }
  return embedded ? "hover:bg-slate-50/80" : "border-slate-200 bg-white/95 text-slate-700 hover:bg-slate-50/95";
}

type ApiTransportPanelVariant = "floating" | "inline";

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
  const [livePulse, setLivePulse] = useState(false);
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

  useEffect(() => {
    if (events.length === 0) return;
    setLivePulse(true);
    const t = window.setTimeout(() => setLivePulse(false), 1400);
    return () => window.clearTimeout(t);
  }, [events[0]?.id]);

  const updatePortalPosition = useCallback(() => {
    const el = toggleRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(480, window.innerWidth - 24);
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

  const clear = useCallback(() => {
    setEvents([]);
  }, []);

  const summary = transportSummary(events);
  const stripLine = transportStripLine(events);
  const stripStats = transportStripStats(events);
  const { line1, tone } = {
    line1: summary.title,
    tone: summary.tone,
  };

  const chipStyles = toneStyles(tone, false);

  const panel = open ? (
        <div
          id="api-transport-log-panel"
          className={`pointer-events-auto flex max-h-[min(75vh,640px)] w-[min(100vw-1.25rem,30rem)] max-w-[calc(100vw-1.25rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/[0.04] ${
            usePortal
              ? ""
              : inline
                ? `absolute z-[200] ${inlineEnd ? "right-0 left-auto" : "left-0"} ${embedded ? "bottom-full mb-2" : "top-full mt-2"}`
                : "relative"
          }`}
          style={usePortal ? portalStyle : undefined}
          role="region"
          aria-label="Request log"
        >
          <header className="shrink-0 border-b border-slate-100 px-3 py-3 sm:px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-slate-900">Request log</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{stripLine}</p>
              </div>
              {events.length > 0 ? (
                <button
                  type="button"
                  onClick={clear}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Clear log
                </button>
              ) : null}
            </div>
            <TransportStripStats items={stripStats} className="mt-3" />
          </header>
          <ul className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            {events.length === 0 ? (
              <li className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No requests recorded yet</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Open a country dashboard or run an analysis. Each network call will appear here.
                </p>
              </li>
            ) : (
              events.map((e, index) => <RequestLogRow key={e.id} event={e} isLatest={index === 0} />)
            )}
          </ul>
        </div>
  ) : null;

  const bolt = (
    <span
      className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        tone === "fail"
          ? "bg-red-100 text-red-700"
          : tone === "busy"
            ? "bg-amber-100 text-amber-800"
            : tone === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
      } ${livePulse && embedded ? "tools-live-pulse" : ""}`}
      aria-hidden
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      {livePulse && embedded && events.length > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
      ) : null}
    </span>
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
      className={`flex w-full items-center gap-2.5 text-left transition ${toneStyles(tone, embedded)} ${
        embedded
          ? `px-3 py-2.5 sm:px-4 ${open ? "bg-slate-50" : ""}`
          : `pointer-events-auto max-w-full rounded-lg border px-2.5 py-1.5 shadow-sm ${chipStyles}`
      }`}
      aria-expanded={open}
      aria-controls={open ? "api-transport-log-panel" : undefined}
      title={open ? "Hide request log" : "Show request log"}
      aria-label={`${line1}: ${stripLine}. ${open ? "Expanded" : "Collapsed"}.`}
      id="api-transport-toggle"
    >
      {embedded ? bolt : <span className={tone === "fail" ? "text-red-600" : "text-slate-500"}>{bolt}</span>}
      {embedded ? (
        <>
          <span className="min-w-0 shrink-0 sm:w-[7.5rem]">
            <span className="block truncate text-sm font-semibold text-slate-900">{line1}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">{stripLine}</span>
          </span>
          <TransportStripStats items={stripStats} className="min-w-0 flex-1" />
          {chevron}
        </>
      ) : (
        <span className="min-w-0 flex-1">
          <>
            <span className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">API</span>
              {chevron}
            </span>
            <span className="mt-0.5 block truncate text-xs font-medium leading-tight text-slate-800">{summary.subtitle}</span>
            <span className="mt-0.5 block truncate text-[10px] text-slate-500">{stripLine}</span>
          </>
        </span>
      )}
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
        <span className="mt-0.5 block text-[12px] font-medium leading-snug text-slate-800">{summary.subtitle}</span>
        <span className="mt-0.5 block truncate text-[10px] text-slate-500">{stripLine}</span>
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
