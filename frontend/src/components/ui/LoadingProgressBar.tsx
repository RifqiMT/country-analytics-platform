import { clampLoadProgress } from "../../lib/loadProgress";

type Props = {
  progress: number;
  label: string;
  showPercent?: boolean;
  className?: string;
};

export default function LoadingProgressBar({ progress, label, showPercent = true, className }: Props) {
  const value = clampLoadProgress(progress);

  return (
    <div className={className}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all duration-500 ease-out"
          style={{ width: `${value}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
      {showPercent ? <p className="mt-2 text-xs tabular-nums text-slate-500">{value}%</p> : null}
    </div>
  );
}
