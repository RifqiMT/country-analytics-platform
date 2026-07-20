import { useEffect, useRef } from "react";
import type { AssistantSuggestionCategory } from "../../lib/assistantSuggestionCategories";

type Props = {
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  promptMenuOpen: boolean;
  onTogglePromptMenu: () => void;
  onClosePromptMenu: () => void;
  categories: AssistantSuggestionCategory[];
  menuExpandedCategoryId: string | null;
  onMenuExpandedCategoryIdChange: (id: string | null) => void;
  promptGroupFilter: string | "all";
  onPromptGroupFilterChange: (id: string | "all") => void;
  onSelectPrompt: (prompt: string) => void;
  totalPromptCount: number;
};

export default function AssistantComposer({
  input,
  loading,
  onInputChange,
  onSend,
  promptMenuOpen,
  onTogglePromptMenu,
  onClosePromptMenu,
  categories,
  menuExpandedCategoryId,
  onMenuExpandedCategoryIdChange,
  promptGroupFilter,
  onPromptGroupFilterChange,
  onSelectPrompt,
  totalPromptCount,
}: Props) {
  const promptMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!promptMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (promptMenuRef.current && !promptMenuRef.current.contains(e.target as Node)) {
        onClosePromptMenu();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClosePromptMenu();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [promptMenuOpen, onClosePromptMenu]);

  return (
    <div className="border-t border-slate-200 bg-slate-50/50 p-3 sm:p-4">
      <div className="relative flex gap-2">
        <div className="relative shrink-0" ref={promptMenuRef}>
          <button
            type="button"
            onClick={onTogglePromptMenu}
            className={`flex h-11 items-center gap-1.5 rounded-xl border bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 ${
              promptMenuOpen ? "border-teal-400 ring-2 ring-teal-100" : "border-slate-200"
            }`}
            aria-expanded={promptMenuOpen}
            aria-label="Starter prompts"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <span className="hidden sm:inline">Prompts</span>
          </button>
          {promptMenuOpen ? (
            <div
              className="absolute bottom-full left-0 z-50 mb-2 w-[min(calc(100vw-2rem),22rem)] max-h-[min(70vh,24rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
              role="dialog"
              aria-label="Starter prompts"
            >
              <button
                type="button"
                onClick={() => {
                  onPromptGroupFilterChange("all");
                  onMenuExpandedCategoryIdChange(null);
                }}
                className={`flex w-full px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-50 ${
                  promptGroupFilter === "all" ? "bg-teal-50 text-teal-900" : "text-slate-800"
                }`}
              >
                All groups
                <span className="ml-auto text-xs text-slate-400">{totalPromptCount}</span>
              </button>
              {categories.map((cat) => {
                const expanded = menuExpandedCategoryId === cat.id;
                return (
                  <div key={cat.id} className="border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        onMenuExpandedCategoryIdChange(expanded ? null : cat.id);
                        onPromptGroupFilterChange(cat.id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      aria-expanded={expanded}
                    >
                      <svg
                        className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${expanded ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{cat.title}</span>
                      <span className="text-xs text-slate-400">{cat.prompts.length}</span>
                    </button>
                    {expanded ? (
                      <ul className="space-y-0.5 border-t border-slate-50 bg-slate-50/80 px-2 py-1.5">
                        {cat.prompts.map((q) => (
                          <li key={q}>
                            <button
                              type="button"
                              onClick={() => {
                                onSelectPrompt(q);
                                onClosePromptMenu();
                              }}
                              disabled={loading}
                              className="w-full rounded-lg px-2 py-1.5 text-left text-xs leading-snug text-slate-700 hover:bg-white disabled:opacity-50"
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
          ) : null}
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          placeholder="Ask a question…"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
          disabled={loading}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={loading || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-40"
          aria-label="Send message"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
