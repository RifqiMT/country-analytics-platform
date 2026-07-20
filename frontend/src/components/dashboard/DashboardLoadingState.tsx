import LoadingProgressSection from "../ui/LoadingProgressSection";

type Props = {
  label: string;
  progress: number;
};

export default function DashboardLoadingState({ label, progress }: Props) {
  return (
    <LoadingProgressSection label={label} progress={progress} variant="default" className="shadow-sm">
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="h-2 w-16 rounded bg-slate-200" />
            <div className="mt-3 h-6 w-24 rounded bg-slate-200" />
            <div className="mt-2 h-2 w-12 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </LoadingProgressSection>
  );
}
