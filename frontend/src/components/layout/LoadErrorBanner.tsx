type Props = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/** Inline alert for data load failures with optional retry. */
export default function LoadErrorBanner({ message, onRetry, retryLabel = "Retry" }: Props) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
      role="alert"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-red-900">Could not load data</p>
        <p className="mt-1 text-sm leading-relaxed text-red-800">{message}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-100"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
