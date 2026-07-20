import { Children, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  VizGalleryBusContext,
  VizGalleryNestedFsContext,
  VizGalleryOverlayInnerContext,
  VizGalleryStepIndexContext,
} from "./VizGalleryContext";

type VizStep = {
  id: string;
  title: string;
  /** One line for prev/next hints (what the neighbour shows). */
  summary: string;
  content: ReactNode;
};

type Props = {
  steps: VizStep[];
  className?: string;
  /** Shown above the counter, e.g. "Financial charts" */
  groupLabel?: string;
};

function StepperNavFooter(props: {
  safeIndex: number;
  n: number;
  steps: VizStep[];
  goPrev: () => void;
  goNext: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  navLabel: string;
}) {
  const { safeIndex, n, steps, goPrev, goNext, onKeyDown, navLabel } = props;
  const prev = safeIndex > 0 ? steps[safeIndex - 1] : null;
  const next = safeIndex < n - 1 ? steps[safeIndex + 1] : null;

  const btnBase =
    "flex min-w-0 flex-col items-start rounded-xl border px-3 py-2.5 text-left transition sm:px-4";
  const btnActive = "border-red-200 bg-red-50/80 hover:border-red-300 hover:bg-red-50";
  const btnIdle = "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";
  const btnDisabled = "cursor-not-allowed border-slate-100 bg-slate-50 opacity-50";

  return (
    <div
      className="shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
      tabIndex={0}
      role="region"
      aria-label={navLabel}
      aria-roledescription="carousel"
      onKeyDown={onKeyDown}
    >
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={!prev}
          className={`${btnBase} ${!prev ? btnDisabled : btnActive}`}
        >
          <span className="text-xs font-bold uppercase tracking-wide text-red-700">← Previous</span>
          {prev ? (
            <div className="mt-1 min-w-0 sm:mt-0">
              <span className="block text-xs font-semibold text-slate-900">{prev.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{prev.summary}</span>
            </div>
          ) : (
            <span className="mt-1 text-sm text-slate-400 sm:mt-0">You’re on the first view.</span>
          )}
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={!next}
          className={`${btnBase} ${!next ? btnDisabled : btnIdle} sm:items-end sm:text-right`}
        >
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Next →</span>
          {next ? (
            <div className="mt-1 min-w-0 sm:mt-0 sm:ml-auto sm:text-right">
              <span className="block text-xs font-semibold text-slate-900">{next.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{next.summary}</span>
            </div>
          ) : (
            <span className="mt-1 text-sm text-slate-400 sm:mt-0">You’re on the last view.</span>
          )}
        </button>
      </div>

      <p className="mt-2 text-center text-[10px] text-slate-400">Use ← → arrow keys when this bar is focused</p>
    </div>
  );
}

function VisualizationStepper({ steps, className = "", groupLabel }: Props) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [nestedFsOpen, setNestedFsOpen] = useState(false);

  const n = steps.length;
  const safeIndex = n === 0 ? 0 : Math.min(Math.max(0, slideIndex), n - 1);
  const current = steps[safeIndex];

  useEffect(() => {
    setSlideIndex((i) => (n === 0 ? 0 : Math.min(i, n - 1)));
  }, [n]);

  const openGroupFullscreen = useCallback(
    (stepIndex: number) => {
      const i = Math.max(0, Math.min(stepIndex, Math.max(0, n - 1)));
      setSlideIndex(i);
      setGalleryOpen(true);
    },
    [n]
  );

  const closeGallery = useCallback(() => {
    setGalleryOpen(false);
    setNestedFsOpen(false);
  }, []);

  const galleryBus = useMemo(() => ({ openGroupFullscreen }), [openGroupFullscreen]);

  const goPrev = useCallback(() => {
    setSlideIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setSlideIndex((i) => Math.min(n - 1, i + 1));
  }, [n]);

  const onNavKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    },
    [goPrev, goNext]
  );

  useEffect(() => {
    if (!galleryOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [galleryOpen]);

  useEffect(() => {
    if (!galleryOpen || nestedFsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeGallery();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galleryOpen, nestedFsOpen, closeGallery]);

  if (n === 0) return null;

  if (n === 1) {
    return <div className={className}>{steps[0].content}</div>;
  }

  const navLabel = groupLabel ?? "Chart navigation";
  const nestedReporter = useMemo(() => ({ setNestedFullscreenOpen: setNestedFsOpen }), []);

  return (
    <div className={`space-y-4 ${className}`}>
      <VizGalleryBusContext.Provider value={galleryBus}>
        <div className="space-y-1">
          {groupLabel ? (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{groupLabel}</p>
          ) : null}
          <p className="text-xs leading-relaxed text-slate-500">
            All views are shown below. Open <span className="font-semibold text-slate-600">Full screen</span> on any chart
            or table to browse this group with Previous / Next.
          </p>
        </div>
        <div className="space-y-6">
          {steps.map((s, i) => (
            <VizGalleryStepIndexContext.Provider key={s.id} value={i}>
              <div className="min-h-0">{s.content}</div>
            </VizGalleryStepIndexContext.Provider>
          ))}
        </div>
      </VizGalleryBusContext.Provider>

      {galleryOpen && current ? (
        <div
          className="fixed inset-0 z-[240] flex flex-col overflow-hidden bg-slate-100 p-2 sm:p-3"
          role="dialog"
          aria-modal
          aria-label={groupLabel ? `${groupLabel}: ${current.title}` : current.title}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
            <div className="min-w-0">
              {groupLabel ? (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{groupLabel}</p>
              ) : null}
              <p className="text-xs font-medium text-slate-500">
                {safeIndex + 1} of {n}
              </p>
              <h2 className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                {current.title}
              </h2>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{current.summary}</p>
            </div>
            <button
              type="button"
              onClick={closeGallery}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-3">
            <VizGalleryOverlayInnerContext.Provider value>
              <VizGalleryNestedFsContext.Provider value={nestedReporter}>
                <div className="cap-viz-gallery-step flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
                  {current.content}
                </div>
              </VizGalleryNestedFsContext.Provider>
            </VizGalleryOverlayInnerContext.Provider>

            <StepperNavFooter
              safeIndex={safeIndex}
              n={n}
              steps={steps}
              goPrev={goPrev}
              goNext={goNext}
              onKeyDown={onNavKeyDown}
              navLabel={navLabel}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type VizStepMeta = Pick<VizStep, "title" | "summary">;

/** Pair ordered `children` with `meta` by index (first child = first step). */
export function VisualizationStepperFromChildren({
  meta,
  groupLabel,
  className,
  children,
}: {
  meta: readonly VizStepMeta[];
  groupLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const parts = Children.toArray(children);
  const n = Math.min(meta.length, parts.length);
  const steps: VizStep[] = Array.from({ length: n }, (_, i) => ({
    id: `viz-${i}`,
    title: meta[i]!.title,
    summary: meta[i]!.summary,
    content: parts[i],
  }));
  return <VisualizationStepper className={className} groupLabel={groupLabel} steps={steps} />;
}
