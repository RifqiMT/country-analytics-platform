import UserApiKeysHeaderPanel from "../assistant/UserApiKeysHeaderPanel";
import ApiTransportPanel from "../ApiTransportPanel";

/** AI keys + request log in a compact two-column strip. */
export default function HeaderToolsStrip({ className = "" }: { className?: string }) {
  return (
    <section
      className={`overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
      aria-label="Session tools"
    >
      <div className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <UserApiKeysHeaderPanel variant="embedded" />
        <ApiTransportPanel variant="inline" inlineAlign="end" embedded />
      </div>
    </section>
  );
}
