import { useEffect, useRef, useState } from "react";
import PageIntro from "../components/layout/PageIntro";
import { PAGE_INTRO } from "../lib/platformCopy";
import { postJson } from "../api";
import { readStoredDashboardCountry } from "../dashboardCountryStorage";
import type { AssistantMessageCitations } from "../components/assistant/MessageContent";
import {
  ASSISTANT_SUGGESTION_CATEGORIES,
  ASSISTANT_SUGGESTION_COUNT,
} from "../lib/assistantSuggestionCategories";
import AssistantToolbar from "../components/assistant/AssistantToolbar";
import AssistantEmptyState from "../components/assistant/AssistantEmptyState";
import AssistantMessageList from "../components/assistant/AssistantMessageList";
import AssistantComposer from "../components/assistant/AssistantComposer";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attribution?: string[];
  citations?: AssistantMessageCitations;
};

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [model, setModel] = useState<"groq" | "tavily">("tavily");
  const [country, setCountry] = useState(() => readStoredDashboardCountry() ?? "IDN");
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());
  const [promptGroupFilter, setPromptGroupFilter] = useState<string | "all">("all");
  const [promptMenuOpen, setPromptMenuOpen] = useState(false);
  const [menuExpandedCategoryId, setMenuExpandedCategoryId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleSuggestionCategories =
    promptGroupFilter === "all"
      ? ASSISTANT_SUGGESTION_CATEGORIES
      : ASSISTANT_SUGGESTION_CATEGORIES.filter((c) => c.id === promptGroupFilter);

  const visibleSuggestionCount = visibleSuggestionCategories.reduce((n, c) => n + c.prompts.length, 0);

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAllCategories = () =>
    setOpenCategories(new Set(visibleSuggestionCategories.map((c) => c.id)));

  const collapseAllCategories = () => setOpenCategories(new Set());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const sync = () => {
      const s = readStoredDashboardCountry();
      if (s) setCountry(s);
    };
    sync();
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const send = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || loading) return;

    setInput("");
    setPromptMenuOpen(false);
    setMenuExpandedCategoryId(null);
    setErr(null);
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    setLoading(true);
    try {
      const res = await postJson<{
        reply: string;
        attribution: string[];
        citations?: AssistantMessageCitations;
      }>("/api/assistant/chat", {
        message: text,
        countryCode: country || undefined,
        ...(model === "tavily" ? { webSearchPriority: true as const } : {}),
      });
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.reply,
        attribution: res.attribution,
        citations: res.citations,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Something went wrong: ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-3">
        <PageIntro {...PAGE_INTRO.assistant}>
          <p className="text-xs leading-relaxed text-slate-500">
            API keys are managed in the header tools panel. Tap{" "}
            <span className="font-semibold text-slate-700">Keys &amp; API</span> on mobile, or expand the inline panel on desktop.
          </p>
        </PageIntro>
        <AssistantToolbar
          country={country}
          onCountryChange={setCountry}
          model={model}
          onModelChange={setModel}
        />
      </div>

      <div className="mt-4 flex min-h-[min(420px,72vh)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div ref={scrollRef} className="flex flex-1 flex-col overflow-auto p-4 sm:p-5">
          {messages.length === 0 ? (
            <AssistantEmptyState
              categories={visibleSuggestionCategories}
              openCategories={openCategories}
              onToggleCategory={toggleCategory}
              onExpandAll={expandAllCategories}
              onCollapseAll={collapseAllCategories}
              onSelectPrompt={send}
              loading={loading}
              totalCount={ASSISTANT_SUGGESTION_COUNT}
              visibleCount={visibleSuggestionCount}
              groupFilter={promptGroupFilter}
              onShowAllGroups={() => setPromptGroupFilter("all")}
            />
          ) : (
            <AssistantMessageList messages={messages} loading={loading} />
          )}
        </div>

        {err ? (
          <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
            {err}
          </p>
        ) : null}

        <AssistantComposer
          input={input}
          loading={loading}
          onInputChange={setInput}
          onSend={() => send()}
          promptMenuOpen={promptMenuOpen}
          onTogglePromptMenu={() => {
            setPromptMenuOpen((o) => {
              const next = !o;
              if (!next) setMenuExpandedCategoryId(null);
              return next;
            });
          }}
          onClosePromptMenu={() => {
            setPromptMenuOpen(false);
            setMenuExpandedCategoryId(null);
          }}
          categories={ASSISTANT_SUGGESTION_CATEGORIES}
          menuExpandedCategoryId={menuExpandedCategoryId}
          onMenuExpandedCategoryIdChange={setMenuExpandedCategoryId}
          promptGroupFilter={promptGroupFilter}
          onPromptGroupFilterChange={setPromptGroupFilter}
          onSelectPrompt={send}
          totalPromptCount={ASSISTANT_SUGGESTION_COUNT}
        />
      </div>
    </div>
  );
}
