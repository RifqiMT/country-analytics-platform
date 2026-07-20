import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { getJson, type CountrySummary } from "../api";

function formatCountryLine(c: CountrySummary): string {
  return `${c.name} (${c.cca3}) — ${c.region}`;
}

function formatCountryDisplay(c: CountrySummary, mode: "full" | "compact"): string {
  if (mode === "compact") return `${c.name} (${c.cca3})`;
  return formatCountryLine(c);
}

type Props = {
  value: string;
  onChange: (cca3: string) => void;
  className?: string;
  variant?: "light" | "dark";
  /** When false, omit the built-in "Country" label (page supplies its own). Default true. */
  showLabel?: boolean;
  /** Show a Clear action when a country is selected. */
  allowClear?: boolean;
  /** `below` = link under field; `inline` = × inside field (for single-row toolbars). */
  clearPlacement?: "below" | "inline";
  placeholder?: string;
  /** Closed-field label: compact omits region to avoid truncation in toolbars. */
  displayMode?: "full" | "compact";
};

const DEFAULT_PLACEHOLDER = "Search name, ISO3, or region…";

export default function CountrySelect({
  value,
  onChange,
  className = "",
  variant = "dark",
  showLabel = true,
  allowClear = false,
  clearPlacement = "below",
  placeholder = DEFAULT_PLACEHOLDER,
  displayMode = "full",
}: Props) {
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadGen, setLoadGen] = useState(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listIdRaw = useId();
  const listId = `country-combobox-${listIdRaw.replace(/:/g, "")}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    getJson<CountrySummary[]>("/api/countries")
      .then((list) => {
        if (!cancelled) setCountries(list);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadGen]);

  const selected = useMemo(() => countries.find((c) => c.cca3 === value), [countries, value]);

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.cca3.toLowerCase().includes(s) ||
        c.region.toLowerCase().includes(s)
    );
  }, [countries, query]);

  const listSlice = filtered.length > 400 ? filtered.slice(0, 400) : filtered;

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }, []);

  const pick = useCallback(
    (c: CountrySummary) => {
      onChange(c.cca3);
      closeMenu();
      inputRef.current?.blur();
    },
    [onChange, closeMenu]
  );

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open, closeMenu]);

  useEffect(() => {
    if (open) setActiveIndex((i) => (listSlice.length === 0 ? -1 : Math.min(Math.max(i, 0), listSlice.length - 1)));
  }, [open, listSlice.length, query]);

  const inputCls =
    variant === "light"
      ? "rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
      : "rounded-xl border border-white/10 bg-ink-900 py-2 pl-3 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-sea-500 focus:outline-none focus:ring-1 focus:ring-sea-500";

  const labelCls = variant === "light" ? "text-slate-500" : "text-slate-400";
  const errCls =
    variant === "light"
      ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
      : "rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200";

  const listPanelCls =
    variant === "light"
      ? "absolute z-[120] mt-1 max-h-60 w-full min-w-[16rem] overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
      : "absolute z-[120] mt-1 max-h-60 w-full min-w-[16rem] overflow-auto rounded-xl border border-white/10 bg-ink-900 py-1 shadow-lg";

  const itemCls = (active: boolean, isSel: boolean) =>
    variant === "light"
      ? `flex w-full cursor-pointer px-3 py-2 text-left text-sm transition ${
          active ? "bg-red-50 text-slate-900" : isSel ? "bg-slate-50 text-slate-800" : "text-slate-700 hover:bg-slate-50"
        }`
      : `flex w-full cursor-pointer px-3 py-2 text-left text-sm transition ${
          active ? "bg-white/10 text-white" : isSel ? "bg-white/5 text-slate-200" : "text-slate-300 hover:bg-white/5"
        }`;

  const hintCls = variant === "light" ? "text-slate-500" : "text-slate-500";
  const displayValue = open ? query : selected ? formatCountryDisplay(selected, displayMode) : "";
  const fullSelectedTitle = selected ? formatCountryLine(selected) : undefined;

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
    setActiveIndex(0);
  };

  const onInputFocus = () => {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      inputRef.current?.blur();
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
      setQuery("");
      setActiveIndex(0);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, listSlice.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < listSlice.length) {
        pick(listSlice[activeIndex]);
      }
    }
  };

  const disabled = loading || (!!loadErr && countries.length === 0);

  const showInlineClear = allowClear && clearPlacement === "inline" && Boolean(value);
  const inputPadRight = showInlineClear ? "pr-16" : "pr-10";

  return (
    <div ref={rootRef} className={`relative flex flex-col gap-2 ${className}`}>
      {showLabel && (
        <label className={`text-xs font-medium uppercase tracking-wider ${labelCls}`}>Country</label>
      )}
      {loading && (
        <p className={`text-xs ${variant === "light" ? "text-slate-500" : "text-slate-500"}`}>
          Loading country list…
        </p>
      )}
      {loadErr && (
        <div className={errCls}>
          <p className="font-medium">Could not load countries</p>
          <p className="mt-1 opacity-90">{loadErr}</p>
          <button
            type="button"
            onClick={() => setLoadGen((g) => g + 1)}
            className={
              variant === "light"
                ? "mt-2 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-900 hover:bg-red-200"
                : "mt-2 rounded-md bg-red-900/60 px-2 py-1 text-xs font-medium text-red-100 hover:bg-red-800/60"
            }
          >
            Retry
          </button>
        </div>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          name="cap_country_selector"
          data-lpignore="true"
          data-form-type="other"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={!selected ? placeholder : open ? placeholder : undefined}
          value={displayValue}
          title={!open && displayMode === "compact" ? fullSelectedTitle : undefined}
          onChange={onInputChange}
          onFocus={onInputFocus}
          onKeyDown={onKeyDown}
          className={`${inputCls} w-full disabled:cursor-not-allowed disabled:opacity-60 ${inputPadRight}`}
        />
        {showInlineClear ? (
          <button
            type="button"
            aria-label="Clear selection"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              closeMenu();
            }}
            className={`absolute right-9 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition hover:bg-black/5 ${
              variant === "light" ? "text-slate-400 hover:text-red-600" : "text-slate-400 hover:text-red-300"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Close suggestions" : "Open suggestions"}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) {
              closeMenu();
              inputRef.current?.blur();
            } else {
              inputRef.current?.focus();
            }
          }}
          className={`absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition hover:bg-black/5 disabled:opacity-40 ${
            variant === "light" ? "text-slate-500" : "text-slate-400 hover:bg-white/10"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>

        {open && listSlice.length > 0 && (
          <ul id={listId} role="listbox" className={listPanelCls}>
            {selected && !query.trim() && (
              <li
                className={`border-b px-3 py-2 text-xs ${
                  variant === "light" ? "border-slate-100 text-slate-500" : "border-white/10 text-slate-400"
                }`}
              >
                Current:{" "}
                <span className={variant === "light" ? "font-medium text-slate-800" : "font-medium text-slate-200"}>
                  {selected.name} ({selected.cca3})
                </span>
                <span className="text-slate-400"> — type to search others</span>
              </li>
            )}
            {listSlice.map((c, i) => {
              const isSel = c.cca3 === value;
              const isActive = i === activeIndex;
              return (
                <li key={c.cca3} id={`${listId}-opt-${i}`} role="option" aria-selected={isSel}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(c)}
                    className={itemCls(isActive, isSel && !isActive)}
                  >
                    {formatCountryLine(c)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {open && query.trim() && listSlice.length === 0 && (
          <div
            className={`absolute z-[120] mt-1 w-full min-w-[16rem] rounded-xl border px-3 py-4 text-center text-sm shadow-lg ${
              variant === "light"
                ? "border-slate-200 bg-white text-slate-500"
                : "border-white/10 bg-ink-900 text-slate-400"
            }`}
          >
            No matches. Try another spelling or ISO3 code.
          </div>
        )}
      </div>

      {filtered.length > 400 && (
        <p className={`text-xs ${hintCls}`}>Showing first 400 matches — refine search.</p>
      )}

      {allowClear && value && clearPlacement === "below" ? (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              onChange("");
              closeMenu();
            }}
            className="text-xs font-medium text-red-600 hover:text-red-700"
          >
            Clear selection
          </button>
        </div>
      ) : null}
    </div>
  );
}
