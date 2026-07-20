import { APP_TAGLINE_DETAIL, APP_TAGLINE_LEAD, PLATFORM_DATA_SOURCES } from "../../lib/platformCopy";

type Variant = "compact" | "full" | "panel";

type Props = {
  variant?: Variant;
  className?: string;
};

function SourcePills({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Data sources">
      {PLATFORM_DATA_SOURCES.map((name) => (
        <li key={name}>
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/80">
            {name}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Platform tagline — header, mobile about panel, and tablet banner. */
export default function PlatformTagline({ variant = "compact", className = "" }: Props) {
  if (variant === "compact") {
    return (
      <p className={`text-sm leading-relaxed text-slate-600 ${className}`}>
        <span className="text-slate-700">{APP_TAGLINE_LEAD}</span>{" "}
        <span className="text-slate-500">{APP_TAGLINE_DETAIL}</span>
      </p>
    );
  }

  if (variant === "panel") {
    return (
      <div className={`space-y-2.5 ${className}`}>
        <p className="text-sm font-medium leading-relaxed text-slate-800">{APP_TAGLINE_LEAD}</p>
        <p className="text-sm leading-relaxed text-slate-600">{APP_TAGLINE_DETAIL}</p>
        <SourcePills />
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-sm leading-relaxed text-slate-700">{APP_TAGLINE_LEAD}</p>
      <SourcePills />
    </div>
  );
}

