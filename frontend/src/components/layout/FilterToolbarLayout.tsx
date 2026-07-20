import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = {
  /** Country selector(s). */
  countries: ReactNode;
  /** Year inputs and presets. */
  range?: ReactNode;
  /** Refresh, export, and similar actions. */
  actions?: ReactNode;
  /** Wider country area for compare (two selectors + swap). */
  variant?: "default" | "compare";
};

/**
 * Single-row filter bar on large screens; wraps cleanly on smaller viewports.
 * overflow-visible keeps combobox / dropdown panels from being clipped.
 */
export default function FilterToolbarLayout({ countries, range, actions, variant = "default" }: Props) {
  const countryBasis =
    variant === "compare"
      ? "min-w-0 w-full basis-full xl:basis-auto xl:min-w-[22rem] xl:flex-[1.6]"
      : "min-w-0 w-full basis-full sm:max-w-md lg:basis-auto lg:min-w-[12rem] lg:max-w-[18rem] xl:max-w-xs";

  const nowrapAt = variant === "compare" ? "xl:flex-nowrap" : "lg:flex-nowrap";
  const dividerAt = variant === "compare" ? "hidden xl:flex" : "hidden lg:flex";

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2.5 overflow-visible ${nowrapAt} lg:gap-x-4`}>
      <div className={`${countryBasis} overflow-visible`}>{countries}</div>

      {range ? (
        <>
          <FilterToolbarDivider className={dividerAt} />
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{range}</div>
        </>
      ) : null}

      {actions ? (
        <>
          <FilterToolbarDivider className={dividerAt} />
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">{actions}</div>
        </>
      ) : null}
    </div>
  );
}

function FilterToolbarDivider({ className = "" }: { className?: string }) {
  return <div className={`h-8 w-px shrink-0 bg-slate-200/90 ${className}`} aria-hidden />;
}

/** Grouped year range + preset controls. */
export function FilterToolbarRangeGroup({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/70 p-1 shadow-sm">
      {children}
    </div>
  );
}

type YearRangeProps = {
  start: number;
  end: number;
  minStart: number;
  maxEnd: number;
  onStartChange: (year: number) => void;
  onEndChange: (year: number) => void;
  startId?: string;
  endId?: string;
};

export function FilterToolbarYearInputs({
  start,
  end,
  minStart,
  maxEnd,
  onStartChange,
  onEndChange,
  startId = "filter-year-from",
  endId = "filter-year-to",
}: YearRangeProps) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg bg-white px-1 shadow-sm ring-1 ring-slate-200/80">
      <label className="sr-only" htmlFor={startId}>
        From year
      </label>
      <input
        id={startId}
        type="number"
        className="w-[4.25rem] min-w-[4.25rem] border-0 bg-transparent px-1 text-center text-sm font-medium tabular-nums text-slate-800 [appearance:textfield] focus:outline-none focus:ring-0 xl:w-[4.5rem] xl:min-w-[4.5rem] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={start}
        min={minStart}
        max={end}
        onChange={(e) => onStartChange(Number(e.target.value))}
      />
      <span className="select-none px-0.5 text-xs text-slate-300" aria-hidden>
        –
      </span>
      <label className="sr-only" htmlFor={endId}>
        To year
      </label>
      <input
        id={endId}
        type="number"
        className="w-[4.25rem] min-w-[4.25rem] border-0 bg-transparent px-1 text-center text-sm font-medium tabular-nums text-slate-800 [appearance:textfield] focus:outline-none focus:ring-0 xl:w-[4.5rem] xl:min-w-[4.5rem] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={end}
        min={start}
        max={maxEnd}
        onChange={(e) => onEndChange(Number(e.target.value))}
      />
    </div>
  );
}

/** Segmented action button group. */
export function FilterToolbarActions({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white p-1 shadow-sm">
      {children}
    </div>
  );
}

const ACTION_PRIMARY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-40";
const ACTION_SECONDARY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40";

export function FilterToolbarPrimaryAction({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={ACTION_PRIMARY} {...props}>
      {children}
    </button>
  );
}

export function FilterToolbarSecondaryAction({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={ACTION_SECONDARY} {...props}>
      {children}
    </button>
  );
}

/** Shared styling for country comboboxes in toolbars. */
export const TOOLBAR_COUNTRY_SELECT_CLASS =
  "min-w-0 w-full gap-0 [&_input]:min-h-9 [&_input]:rounded-lg [&_input]:border-slate-200/90 [&_input]:bg-white [&_input]:py-2 [&_input]:pl-3 [&_input]:pr-10 [&_input]:text-sm [&_input]:shadow-sm [&_input]:ring-1 [&_input]:ring-slate-200/60 [&_input]:transition [&_input]:hover:border-slate-300 [&_input]:focus:border-red-300 [&_input]:focus:ring-red-100";

/** Country A / swap / Country B — inline on sm+, stacked on very narrow screens. */
export function CompareCountrySelectRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 overflow-visible sm:flex-row sm:items-center">
      {children}
    </div>
  );
}

export function CompareCountrySelectSlot({ children }: { children: ReactNode }) {
  return <div className="min-w-0 flex-1 overflow-visible">{children}</div>;
}

export function CompareSwapButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-lg border border-slate-200/90 bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/60 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 sm:self-auto"
      {...props}
    >
      {children}
    </button>
  );
}
