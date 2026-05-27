import { useCallback, useEffect, useRef, useState } from "react";
import {
  subscribeApiTransport,
  subscribeClientToast,
  type ApiTransportEvent,
  type ClientToastEvent,
} from "../api";

const DISMISS_MS_SUCCESS = 5000;
const DISMISS_MS_FAILURE = 10000;

type StackEvent =
  | { channel: "api"; e: ApiTransportEvent }
  | { channel: "client"; e: ClientToastEvent };

/** Short, human label for the kind of request (no query strings). */
function requestKindLabel(path: string): string {
  const base = path.split("?")[0] ?? path;
  if (base.includes("/api/country/") && base.endsWith("/series")) return "Country data";
  if (base.includes("/wb-profile")) return "World Bank profile";
  if (base.includes("/dashboard/comparison")) return "Comparison";
  if (base.includes("/api/metrics")) return "Metrics catalog";
  if (base.includes("/api/countries")) return "Country list";
  if (base.includes("/api/global/snapshot")) return "Global snapshot";
  if (base.includes("/api/global/table")) return "Global table";
  if (base.includes("/api/global/wld-series")) return "World aggregates";
  if (base.includes("/api/analysis/correlation")) return "Correlation";
  if (base.includes("/api/analysis/business/correlation-narrative")) return "Business narrative";
  if (base.includes("/api/cache/clear")) return "Cache";
  if (base.includes("/pestel") || base.includes("pestel")) return "PESTEL analysis";
  if (base.includes("/porter") || base.includes("porter")) return "Porter 5 Forces analysis";
  if (base.includes("/assistant") || base.includes("chat")) return "Assistant";
  if (base.includes("/data-providers")) return "Sources";
  return "Data request";
}

function apiSuccessHeadline(path: string): string {
  const base = path.split("?")[0] ?? path;
  if (base.includes("/api/analysis/pestel")) return "Generated";
  if (base.includes("/api/analysis/porter")) return "Generated";
  if (base.includes("/assistant") || base.includes("/chat")) return "Replied";
  return "Loaded";
}

export default function ApiToastStack() {
  const [latest, setLatest] = useState<StackEvent | null>(null);
  const dismissTimer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (dismissTimer.current != null) {
      window.clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setLatest(null);
  }, [clearTimer]);

  const scheduleDismiss = useCallback(
    (e: StackEvent) => {
      clearTimer();
      setLatest(e);
      const ok = e.channel === "api" ? e.e.outcome === "success" : e.e.outcome === "success";
      const ms = ok ? DISMISS_MS_SUCCESS : DISMISS_MS_FAILURE;
      dismissTimer.current = window.setTimeout(() => {
        dismissTimer.current = null;
        setLatest(null);
      }, ms);
    },
    [clearTimer]
  );

  useEffect(() => {
    const unsubApi = subscribeApiTransport((e) => scheduleDismiss({ channel: "api", e }));
    const unsubClient = subscribeClientToast((e) => scheduleDismiss({ channel: "client", e }));
    return () => {
      unsubApi();
      unsubClient();
    };
  }, [scheduleDismiss]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  if (latest == null) return null;

  const ok = latest.channel === "api" ? latest.e.outcome === "success" : latest.e.outcome === "success";

  const headline =
    latest.channel === "api"
      ? ok
        ? apiSuccessHeadline(latest.e.path)
        : "Failed"
      : ok
        ? "Done"
        : "Failed";

  const mainLine =
    latest.channel === "api" ? requestKindLabel(latest.e.path) : latest.e.title;

  const subLine =
    latest.channel === "client" && latest.e.detail ? latest.e.detail : null;

  const durationSec =
    latest.channel === "api"
      ? latest.e.durationSec
      : latest.e.durationSec !== undefined
        ? latest.e.durationSec
        : null;

  const showTiming = durationSec !== null && durationSec !== undefined;

  const errorText =
    latest.channel === "api"
      ? latest.e.outcome === "failure"
        ? latest.e.error
        : null
      : latest.e.outcome === "failure"
        ? latest.e.error
        : null;

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-[60] w-[min(calc(100vw-1.5rem),17.5rem)] lg:bottom-4 lg:right-4"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`toast-slide-in pointer-events-auto rounded-2xl border px-4 py-3.5 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.35)] ring-1 backdrop-blur-md ${
          ok
            ? "border-emerald-200/90 bg-emerald-50/95 text-emerald-950 ring-emerald-900/5"
            : "border-red-200/90 bg-red-50/95 text-red-950 ring-red-900/5"
        }`}
        role="status"
      >
        <div className="flex gap-3">
          <div className="shrink-0 pt-0.5" aria-hidden>
            {ok ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">{headline}</p>
            <p className="mt-1 text-[0.8125rem] font-medium leading-snug text-slate-800">{mainLine}</p>
            {subLine ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{subLine}</p>
            ) : null}
            {showTiming ? (
              <>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                  {Number(durationSec).toFixed(3)}
                  <span className="ml-1 text-base font-semibold text-slate-600">s</span>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">Time to complete</p>
              </>
            ) : null}
            {errorText ? (
              <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-red-900">{errorText}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-black/5 hover:text-slate-800"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
