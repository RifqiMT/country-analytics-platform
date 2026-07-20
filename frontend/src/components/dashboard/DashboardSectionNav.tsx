import { useCallback, useEffect, useState } from "react";

export type DashboardNavItem = {
  id: string;
  label: string;
};

type Props = {
  items: DashboardNavItem[];
  className?: string;
};

function openSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  if (el instanceof HTMLDetailsElement) el.open = true;
  else if (el.tagName === "DETAILS") (el as HTMLDetailsElement).open = true;
}

export default function DashboardSectionNav({ items, className = "" }: Props) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el != null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-12% 0px -60% 0px", threshold: [0, 0.12, 0.35] }
    );
    for (const el of sections) observer.observe(el);
    return () => observer.disconnect();
  }, [items]);

  const scrollTo = useCallback((id: string) => {
    openSection(id);
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }, []);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Dashboard sections"
      className={`sticky top-0 z-20 rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="flex gap-0.5 overflow-x-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              aria-current={active ? "true" : undefined}
              className={`relative shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
                active ? "text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {active ? (
                <span
                  className="pointer-events-none absolute inset-x-2 bottom-0.5 h-0.5 rounded-full bg-slate-900"
                  aria-hidden
                />
              ) : null}
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
