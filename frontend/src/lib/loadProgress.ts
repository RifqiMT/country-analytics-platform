type SimulatedLoadProgressOptions = {
  initial?: number;
  cap?: number;
  step?: number;
  intervalMs?: number;
};

const DEFAULT_SIMULATED_LOAD_PROGRESS: Required<SimulatedLoadProgressOptions> = {
  initial: 8,
  cap: 92,
  step: 6,
  intervalMs: 250,
};

export function clampLoadProgress(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Map completed batch count to a 0–100 progress value (leaves headroom before completion). */
export function chunkLoadProgress(completed: number, total: number, cap = 95): number {
  if (total <= 0) return 0;
  return clampLoadProgress(Math.min(cap, Math.round((completed / total) * cap)));
}

type ProgressSetter = (value: number | ((prev: number) => number)) => void;

/** Fake progress for requests with unknown duration; call the returned stop function when done. */
export function startSimulatedLoadProgress(
  setProgress: ProgressSetter,
  options?: SimulatedLoadProgressOptions
): () => void {
  const { initial, cap, step, intervalMs } = { ...DEFAULT_SIMULATED_LOAD_PROGRESS, ...options };
  setProgress(initial);
  const timerId = window.setInterval(() => {
    setProgress((prev) => (prev < cap ? prev + step : cap));
  }, intervalMs);
  return () => window.clearInterval(timerId);
}
