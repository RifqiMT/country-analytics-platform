import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useScrollCompact } from "../../hooks/useScrollCompact";
import HeaderToolsStrip from "./HeaderToolsStrip";
import { APP_NAV, APP_TAGLINE } from "./navConfig";

export default function AppHeader() {
  const compact = useScrollCompact(28);
  const location = useLocation();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    setToolsOpen(false);
    setAboutOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={`sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur transition-[padding] duration-200 ${
        compact ? "shadow-md" : ""
      }`}
    >
      <div
        className={`w-full px-3 sm:px-4 lg:px-6 xl:px-8 ${compact ? "py-2" : "py-2.5 sm:py-3"}`}
      >
        {/* Brand row */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h1
              className={`font-display truncate font-bold tracking-tight text-slate-900 transition-all duration-200 ${
                compact ? "text-base sm:text-lg" : "text-lg sm:text-xl lg:text-2xl"
              }`}
            >
              <span className="lg:hidden">Country Analytics</span>
              <span className="hidden lg:inline">Country Analytics Platform</span>
            </h1>
            {!compact && (
              <p className="mt-0.5 hidden text-sm leading-snug text-slate-600 xl:block">{APP_TAGLINE}</p>
            )}
          </div>

          {/* Mobile / tablet: toggle tools & about */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 lg:hidden">
            <button
              type="button"
              onClick={() => {
                setAboutOpen((v) => !v);
                if (!aboutOpen) setToolsOpen(false);
              }}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-slate-600 transition hover:bg-slate-50 ${
                aboutOpen ? "border-slate-300 bg-slate-100" : "border-slate-200 bg-white"
              }`}
              aria-expanded={aboutOpen}
              aria-label={aboutOpen ? "Hide platform overview" : "Show platform overview"}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setToolsOpen((v) => !v);
                if (!toolsOpen) setAboutOpen(false);
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 ${
                toolsOpen ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-white"
              }`}
              aria-expanded={toolsOpen}
              aria-label={toolsOpen ? "Hide tools panel" : "Show API keys and request log"}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              Keys &amp; API
            </button>
          </div>
        </div>

        {/* Mobile about blurb */}
        {aboutOpen && !compact && (
          <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs leading-relaxed text-slate-600 lg:hidden">
            {APP_TAGLINE}
          </p>
        )}

        {/* Mobile / tablet tools */}
        {toolsOpen && <HeaderToolsStrip className="mt-2 lg:hidden" />}

        {/* Desktop tools */}
        <HeaderToolsStrip className={`mt-2.5 hidden lg:block ${compact ? "shadow-none" : ""}`} />

        {/* Tablet tagline — desktop nav lives below on lg+ only */}
        {!compact && (
          <p className="mt-2 hidden text-sm leading-snug text-slate-600 md:block lg:hidden">{APP_TAGLINE}</p>
        )}

        {/* Desktop navigation — segmented control */}
        <nav
          className={`mt-2.5 hidden lg:block ${compact ? "mt-2" : ""}`}
          aria-label="Main navigation"
        >
          <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-slate-100/90 p-1">
            {APP_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-white text-red-600 shadow-sm ring-1 ring-slate-200/80"
                        : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                    }`
                  }
                >
                  <Icon />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
