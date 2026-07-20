import { useCallback, useEffect, useRef, useState } from "react";
import {
  subscribeApiTransport,
  subscribeClientToast,
  type ApiTransportEvent,
  type ClientToastEvent,
} from "../api";
import {
  shouldShowApiToast,
  toastDetail,
  toastDismissMs,
  toastHeadline,
  toastMeta,
  toastTitle,
  type ToastStackEvent,
} from "../lib/toastPresentation";

type VisibleToast = {
  id: string;
  event: ToastStackEvent;
  dismissMs: number;
};

function nextToastId(event: ToastStackEvent): string {
  const sourceId = event.channel === "api" ? event.e.id : event.e.id;
  return `${sourceId}-${Date.now()}`;
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: VisibleToast;
  onDismiss: () => void;
}) {
  const ok =
    item.event.channel === "api" ? item.event.e.outcome === "success" : item.event.e.outcome === "success";
  const headline = toastHeadline(item.event);
  const title = toastTitle(item.event);
  const detail = toastDetail(item.event);
  const meta = toastMeta(item.event);
  const [expanded, setExpanded] = useState(false);

  const palette = ok
    ? {
        shell: "border-emerald-200/80 bg-white/95 ring-emerald-900/[0.04]",
        accent: "from-emerald-500 to-teal-600",
        icon: "bg-emerald-600 text-white",
        badge: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
        progress: "bg-emerald-500",
        headline: "text-emerald-800",
      }
    : {
        shell: "border-red-200/80 bg-white/95 ring-red-900/[0.04]",
        accent: "from-red-500 to-rose-600",
        icon: "bg-red-600 text-white",
        badge: "bg-red-50 text-red-800 ring-red-200/80",
        progress: "bg-red-500",
        headline: "text-red-800",
      };

  return (
    <article
      className={`toast-slide-in group pointer-events-auto overflow-hidden rounded-2xl border shadow-[0_16px_48px_-12px_rgba(15,23,42,0.28)] ring-1 backdrop-blur-md ${palette.shell}`}
      role="status"
    >
      <div className={`h-0.5 w-full bg-gradient-to-r ${palette.accent}`} aria-hidden />
      <div className="flex gap-3 px-4 py-3.5">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${palette.icon}`} aria-hidden>
          {ok ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${palette.headline}`}>{headline}</p>
            <button
              type="button"
              onClick={onDismiss}
              className="-mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Dismiss notification"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{title}</p>
          {detail ? (
            <p className={`mt-1 text-xs leading-relaxed text-slate-600 ${expanded ? "" : "line-clamp-2"}`}>{detail}</p>
          ) : null}
          {!ok && detail && detail.length > 120 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[11px] font-semibold text-red-700 hover:underline"
            >
              {expanded ? "Show less" : "Show details"}
            </button>
          ) : null}
          {(meta.duration || meta.status || meta.size) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {meta.duration ? (
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ${palette.badge}`}>
                  {meta.duration}
                </span>
              ) : null}
              {meta.status ? (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200/80">
                  HTTP {meta.status}
                </span>
              ) : null}
              {meta.size ? (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200/80">
                  {meta.size}
                </span>
              ) : null}
              {item.event.channel === "api" && item.event.e.method ? (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80">
                  {item.event.e.method}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <div className="h-1 overflow-hidden bg-slate-100/80" aria-hidden>
        <div
          className={`toast-progress h-full ${palette.progress}`}
          style={{ animationDuration: `${item.dismissMs}ms` }}
        />
      </div>
    </article>
  );
}

export default function ApiToastStack() {
  const [toast, setToast] = useState<VisibleToast | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const pushToast = useCallback(
    (event: ToastStackEvent) => {
      clearTimer();
      const id = nextToastId(event);
      const dismissMs = toastDismissMs(event);
      setToast({ id, event, dismissMs });
      timerRef.current = window.setTimeout(dismiss, dismissMs);
    },
    [clearTimer, dismiss]
  );

  useEffect(() => {
    const onApi = (e: ApiTransportEvent) => {
      if (!shouldShowApiToast(e)) return;
      pushToast({ channel: "api", e });
    };
    const onClient = (e: ClientToastEvent) => pushToast({ channel: "client", e });
    const unsubApi = subscribeApiTransport(onApi);
    const unsubClient = subscribeClientToast(onClient);
    return () => {
      unsubApi();
      unsubClient();
      clearTimer();
    };
  }, [pushToast, clearTimer]);

  if (!toast) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-[60] w-[min(calc(100vw-1.5rem),22rem)] sm:w-[min(calc(100vw-2rem),24rem)] lg:bottom-4 lg:right-4"
      aria-live="polite"
      aria-atomic="true"
    >
      <ToastCard key={toast.id} item={toast} onDismiss={dismiss} />
    </div>
  );
}
