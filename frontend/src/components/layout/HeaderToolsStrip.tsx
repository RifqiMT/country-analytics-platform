import UserApiKeysHeaderPanel from "../assistant/UserApiKeysHeaderPanel";
import ApiTransportPanel from "../ApiTransportPanel";

/** Unified AI keys + API request log — one card, balanced layout on all breakpoints. */
export default function HeaderToolsStrip({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
      aria-label="Platform tools"
    >
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <div className="min-w-0 flex-1 border-b border-slate-100 sm:border-b-0 sm:border-r">
          <UserApiKeysHeaderPanel variant="embedded" />
        </div>
        <div className="relative flex shrink-0 items-stretch bg-slate-50/50 sm:w-[min(100%,13.5rem)]">
          <ApiTransportPanel variant="inline" inlineAlign="end" embedded />
        </div>
      </div>
    </div>
  );
}
