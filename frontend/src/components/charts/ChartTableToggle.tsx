import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import ExportPngButton from "../ExportPngButton";
import {
  VizGalleryBusContext,
  VizGalleryNestedFsContext,
  VizGalleryOverlayInnerContext,
  VizGalleryStepIndexContext,
} from "./VizGalleryContext";

type Mode = "chart" | "table";

type Props = {
  chart: ReactNode;
  table: ReactNode;
  /** Root wrapper; use `h-full w-full` when parent fixes height (e.g. line charts). */
  className?: string;
  chartLabel?: string;
  tableLabel?: string;
  /** Shown in the full-screen header (Escape or Close to exit). */
  vizTitle?: string;
  /**
   * When Table view is selected, Export downloads CSV via this callback.
   * Chart view always exports PNG. If omitted, Table view falls back to PNG.
   */
  onExportCsv?: () => void;
};

function exportPngFilename(vizTitle: string | undefined): string {
  const base = (vizTitle ?? "visualization")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 80);
  return `${base || "visualization"}_chart.png`;
}

function DownloadIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v10m0 0l-4-4m4 4l4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
    </svg>
  );
}

const toolbarExportClass =
  "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

export default function ChartTableToggle({
  chart,
  table,
  className = "",
  chartLabel = "Chart",
  tableLabel = "Table",
  vizTitle,
  onExportCsv,
}: Props) {
  const [mode, setMode] = useState<Mode>("chart");
  const [fullscreen, setFullscreen] = useState(false);
  const exportPaneRef = useRef<HTMLDivElement | null>(null);

  const galleryBus = useContext(VizGalleryBusContext);
  const galleryStepIdx = useContext(VizGalleryStepIndexContext);
  const inGalleryOverlay = useContext(VizGalleryOverlayInnerContext);
  const nestedFsReporter = useContext(VizGalleryNestedFsContext);

  const exitFullscreen = useCallback(() => setFullscreen(false), []);

  const openFullscreen = useCallback(() => {
    if (!inGalleryOverlay && galleryBus && typeof galleryStepIdx === "number") {
      galleryBus.openGroupFullscreen(galleryStepIdx);
      return;
    }
    setFullscreen(true);
  }, [inGalleryOverlay, galleryBus, galleryStepIdx]);

  useEffect(() => {
    if (!nestedFsReporter) return;
    nestedFsReporter.setNestedFullscreenOpen(fullscreen);
    return () => nestedFsReporter.setNestedFullscreenOpen(false);
  }, [fullscreen, nestedFsReporter]);

  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen, exitFullscreen]);

  const btnSm = fullscreen
    ? "rounded-full px-3 py-1 text-xs font-semibold transition"
    : "rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition";

  const exportCsvMode = mode === "table" && typeof onExportCsv === "function";

  const exportBtn = exportCsvMode ? (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onExportCsv();
      }}
      className={toolbarExportClass}
      title="Export table as CSV"
      aria-label="Export table as CSV"
    >
      <DownloadIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden sm:inline">Export</span>
    </button>
  ) : (
    <ExportPngButton
      getTarget={() => exportPaneRef.current}
      filename={exportPngFilename(vizTitle)}
      size="toolbar"
      title="Export chart as PNG"
      label="Export"
    />
  );

  const toolbar = (
    <div
      className={`flex shrink-0 flex-wrap items-center justify-between gap-2 ${fullscreen ? "mb-2" : "mb-2"}`}
    >
      <div className="flex items-center gap-1.5">
        {!fullscreen && !inGalleryOverlay ? (
          <button
            type="button"
            onClick={openFullscreen}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            aria-label="Open full screen"
            title="Full screen"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
            <span className="hidden sm:inline">Full screen</span>
          </button>
        ) : null}
        {!fullscreen ? exportBtn : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span
          className={`mr-1 font-semibold uppercase tracking-wide text-slate-400 ${fullscreen ? "text-xs" : "text-[10px]"}`}
        >
          View
        </span>
        <button
          type="button"
          onClick={() => setMode("chart")}
          aria-pressed={mode === "chart"}
          className={`${btnSm} ${
            mode === "chart"
              ? "bg-slate-800 text-white"
              : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          {chartLabel}
        </button>
        <button
          type="button"
          onClick={() => setMode("table")}
          aria-pressed={mode === "table"}
          className={`${btnSm} ${
            mode === "table"
              ? "bg-slate-800 text-white"
              : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          {tableLabel}
        </button>
      </div>
    </div>
  );

  const dataPane = (
    <div
      ref={exportPaneRef}
      className={
        mode === "table"
          ? fullscreen
            ? "cap-viz-fs-table min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:p-2"
            : "min-h-0 flex-1 overflow-auto rounded-xl border border-slate-100 bg-white p-0.5"
          : fullscreen
            ? "cap-viz-fullscreen flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3"
            : "flex min-h-0 min-w-0 flex-1 flex-col overflow-visible"
      }
    >
      {fullscreen && mode === "chart" ? (
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="absolute inset-0 min-h-0 min-w-0">
            <div className="h-full w-full min-h-0 min-w-0 overflow-hidden">{chart}</div>
          </div>
        </div>
      ) : mode === "chart" ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-visible">
          <div className="cap-chart-inner-shell h-full min-h-[240px] w-full min-w-0 overflow-visible">{chart}</div>
        </div>
      ) : (
        table
      )}
    </div>
  );

  const main = (
    <>
      {toolbar}
      {dataPane}
    </>
  );

  const fsZ = inGalleryOverlay ? "z-[260]" : "z-[200]";

  return (
    <div
      className={
        fullscreen
          ? `cap-viz-fullscreen fixed inset-0 ${fsZ} box-border flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-slate-100 p-2 sm:p-3`
          : `relative flex min-h-0 flex-col ${className}`
      }
      role={fullscreen ? "dialog" : undefined}
      aria-modal={fullscreen || undefined}
      aria-label={fullscreen ? (vizTitle ?? "Chart and data view") : undefined}
    >
      {fullscreen ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
          <h2 className="min-w-0 truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
            {vizTitle ?? "Visualization"}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {exportBtn}
            <button
              type="button"
              onClick={exitFullscreen}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
      {fullscreen ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2">{main}</div> : main}
    </div>
  );
}
