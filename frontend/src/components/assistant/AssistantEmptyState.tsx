import { Link } from "react-router-dom";
import type { AssistantSuggestionCategory } from "../../lib/assistantSuggestionCategories";

type Props = {
  categories: AssistantSuggestionCategory[];
  openCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onSelectPrompt: (prompt: string) => void;
  loading: boolean;
  totalCount: number;
  visibleCount: number;
  groupFilter: string | "all";
  onShowAllGroups: () => void;
};

export default function AssistantEmptyState({
  categories,
  openCategories,
  onToggleCategory,
  onExpandAll,
  onCollapseAll,
  onSelectPrompt,
  loading,
  totalCount,
  visibleCount,
  groupFilter,
  onShowAllGroups,
}: Props) {
  return (
    <div className="flex flex-1 flex-col items-center py-6 sm:py-8">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-100 text-teal-700 ring-1 ring-teal-100">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
      <h2 className="max-w-md text-center text-base font-semibold text-slate-900 sm:text-lg">
        Ask about metrics, rankings, or country context
      </h2>
      <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-slate-500">
        Answers use the same data as your dashboard. Pick a starter prompt below or type your own question.
      </p>
      <p className="mt-2 text-center text-xs text-slate-400">
        <Link to="/" className="font-medium text-teal-700 hover:underline">
          Dashboard
        </Link>
        {" · "}
        <Link to="/sources" className="font-medium text-teal-700 hover:underline">
          Sources
        </Link>
      </p>

      <div className="mt-7 w-full max-w-lg">
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Starter prompts ({groupFilter === "all" ? totalCount : visibleCount})
          </p>
          {groupFilter !== "all" ? (
            <button
              type="button"
              onClick={onShowAllGroups}
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-teal-700 hover:bg-teal-50"
            >
              Show all
            </button>
          ) : null}
          <button type="button" onClick={onExpandAll} className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100">
            Expand all
          </button>
          <button type="button" onClick={onCollapseAll} className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100">
            Collapse all
          </button>
        </div>
        <div className="space-y-2">
          {categories.map((cat) => {
            const open = openCategories.has(cat.id);
            return (
              <div key={cat.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => onToggleCategory(cat.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50/80"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{cat.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{cat.subtitle}</span>
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {open ? (
                  <ul className="space-y-1 border-t border-slate-100 bg-slate-50/50 p-2">
                    {cat.prompts.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => onSelectPrompt(q)}
                          disabled={loading}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm leading-snug text-slate-700 transition hover:bg-white hover:shadow-sm disabled:opacity-50"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
