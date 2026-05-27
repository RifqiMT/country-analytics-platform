import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { MOBILE_MORE_NAV, MOBILE_PRIMARY_NAV, type NavItem } from "./navConfig";

function MoreIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function TabItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors duration-200 ${
          isActive ? "text-red-600" : "text-slate-500 active:text-slate-700"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span
              className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-red-600 transition-all duration-200"
              aria-hidden
            />
          ) : null}
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-200 ${
              isActive ? "bg-red-50 text-red-600" : "text-slate-500 group-active:bg-slate-100"
            }`}
          >
            <Icon />
          </span>
          <span className="max-w-full truncate text-[10px] font-semibold leading-none sm:text-[11px]">
            {item.tabLabel}
          </span>
        </>
      )}
    </NavLink>
  );
}

/** Fixed bottom tab bar for phones and tablets — replaces cramped header pill scroll. */
export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = MOBILE_MORE_NAV.some((item) => isNavActive(location.pathname, item));

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[45] bg-slate-900/25 backdrop-blur-[1px] lg:hidden"
          aria-label="Close navigation menu"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}

      {moreOpen ? (
        <div
          className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[46] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.35)] transition-transform duration-200 lg:hidden sm:inset-x-auto sm:left-1/2 sm:w-[min(100vw-1.5rem,22rem)] sm:-translate-x-1/2"
          role="dialog"
          aria-label="More navigation"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">More modules</p>
            <p className="mt-0.5 text-sm text-slate-600">PESTEL, Porter, and data sources</p>
          </div>
          <ul className="divide-y divide-slate-100 p-2">
            {MOBILE_MORE_NAV.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(location.pathname, item);
              return (
                <li key={item.to}>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      navigate(item.to);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 active:bg-slate-100 ${
                      active ? "bg-red-50 text-red-700" : "text-slate-800"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        active ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block truncate text-xs text-slate-500">{item.shortLabel}</span>
                    </span>
                    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-[44] border-t border-slate-200/90 bg-white/95 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.18)] backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex h-[3.75rem] max-w-lg items-stretch sm:h-16 sm:max-w-none">
          {MOBILE_PRIMARY_NAV.map((item) => (
            <TabItem key={item.to} item={item} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors duration-200 ${
              moreActive || moreOpen ? "text-red-600" : "text-slate-500 active:text-slate-700"
            }`}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            {moreActive || moreOpen ? (
              <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-red-600" aria-hidden />
            ) : null}
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-200 ${
                moreActive || moreOpen ? "bg-red-50 text-red-600" : "text-slate-500"
              }`}
            >
              <MoreIcon />
            </span>
            <span className="text-[10px] font-semibold leading-none sm:text-[11px]">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
