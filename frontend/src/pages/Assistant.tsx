import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageIntro from "../components/layout/PageIntro";
import { postJson } from "../api";
import CountrySelect from "../components/CountrySelect";
import MessageContent, { type AssistantMessageCitations } from "../components/assistant/MessageContent";
import { readStoredDashboardCountry, writeStoredDashboardCountry } from "../dashboardCountryStorage";
import { resolveAssistantAnswerPresentation } from "../lib/assistantAnswerPresentation";
import {
  ASSISTANT_SUGGESTION_CATEGORIES,
  ASSISTANT_SUGGESTION_COUNT,
} from "../lib/assistantSuggestionCategories";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attribution?: string[];
  citations?: AssistantMessageCitations;
};

function sourceLabel(attribution: string[]): string {
  const intent = attribution.find((a) => a.startsWith("Intent:"));
  const llm = attribution.find((a) => a.startsWith("LLM:"));
  const mode = intent?.replace(/^Intent:\s*/, "") ?? "";
  const model = llm?.replace(/^LLM:\s*/, "") ?? "";
  if (model && mode) return `${mode} · ${model}`;
  if (model) return model;
  if (mode) return mode;
  if (attribution.some((a) => a.toLowerCase().includes("tavily") || a.toLowerCase().includes("web")))
    return "Web search";
  return "Dashboard";
}

function isVerifiedWebAnswerMode(attribution: string[]): boolean {
  return attribution.some((a) =>
    a.toLowerCase().includes("deterministic: verified-web reply path")
  );
}

function AssistantPersonaBanner({
  attribution,
  citations,
}: {
  attribution: string[];
  citations?: AssistantMessageCitations;
}) {
  const pres = resolveAssistantAnswerPresentation(attribution, citations);
  return (
    <div className="mb-3 rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50/90 to-teal-50/30 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-md bg-teal-700/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {pres.categoryLabel}
        </span>
        <span className="text-sm font-semibold text-slate-900">{pres.personaName}</span>
        <span className="text-xs text-slate-500">· {pres.personaTitle}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-600">{pres.personaDescription}</p>
    </div>
  );
}

function VerifiedWebModeBadge({ attribution }: { attribution: string[] }) {
  if (!isVerifiedWebAnswerMode(attribution)) return null;
  return (
    <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        Verified Web Answer Mode
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-emerald-900">
        Time-sensitive answer generated from retrieved live-web evidence only.
      </p>
    </div>
  );
}

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** `groq` = server auto-routing; `tavily` = always run fresh web retrieval when the key is set. */
  /** Default Web-first so leadership and newsy questions use live search without requiring a manual toggle. */
  const [model, setModel] = useState<"groq" | "tavily">("tavily");
  const [country, setCountry] = useState(() => readStoredDashboardCountry() ?? "IDN");
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());
  /** Empty-state list: show all groups or one category chosen from the composer “Prompts” control. */
  const [promptGroupFilter, setPromptGroupFilter] = useState<string | "all">("all");
  const [promptMenuOpen, setPromptMenuOpen] = useState(false);
  const [menuExpandedCategoryId, setMenuExpandedCategoryId] = useState<string | null>(null);
  const promptMenuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepsPanelRef = useRef<HTMLDetailsElement>(null);
  const composerSectionRef = useRef<HTMLDivElement>(null);
  const emptyStartersRef = useRef<HTMLDivElement>(null);

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

  const closeStepsPanel = () => {
    const el = stepsPanelRef.current;
    if (el) el.open = false;
  };

  const focusCountrySelector = () => {
    closeStepsPanel();
    composerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      const input = composerSectionRef.current?.querySelector<HTMLInputElement>(
        'input[type="text"], input:not([type])'
      );
      input?.focus();
    }, 280);
  };

  const expandStartersAndScroll = () => {
    closeStepsPanel();
    if (messages.length === 0) {
      expandAllCategories();
      window.setTimeout(() => {
        emptyStartersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } else {
      setPromptMenuOpen(true);
      window.setTimeout(() => {
        promptMenuRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    }
  };

  const applyWebFirstMode = () => {
    setModel("tavily");
    closeStepsPanel();
  };

  const applyAutoMode = () => {
    setModel("groq");
    closeStepsPanel();
  };

  const openStarterPromptMenu = () => {
    closeStepsPanel();
    setPromptMenuOpen(true);
    window.setTimeout(() => {
      promptMenuRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!promptMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (promptMenuRef.current && !promptMenuRef.current.contains(e.target as Node)) {
        setPromptMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPromptMenuOpen(false);
        setMenuExpandedCategoryId(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [promptMenuOpen]);

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
          content: `Error: ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-3">
        <PageIntro title="Analytics Assistant">
          <p>
            The assistant answers in clear, analyst-style prose. For <strong className="font-semibold text-slate-800">numbers and rankings</strong>, it anchors to the{" "}
            <strong className="font-semibold text-slate-800">same indicator series as the dashboard</strong> (World Bank
            WDI and configured extensions). For <strong className="font-semibold text-slate-800">news and general knowledge</strong>, it blends
            live web retrieval (when Tavily is configured) with the model.
          </p>
          <p className="text-xs text-slate-500">
            API keys are managed in the header <span className="font-semibold">Tools</span> panel on mobile/tablet, or inline on desktop.
          </p>
        </PageIntro>
        <div className="flex flex-row flex-wrap items-end gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 sm:max-w-[240px]">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Answer style</p>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value === "tavily" ? "tavily" : "groq")}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              title="Auto uses dashboard-first rules for metrics; Web-first always fetches Tavily when configured."
            >
              <option value="groq">Auto — balanced routing</option>
              <option value="tavily">Web-first — always search</option>
            </select>
          </div>
          <details ref={stepsPanelRef} className="group relative shrink-0">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Steps &amp; actions
            </summary>
            <div className="absolute right-0 z-30 mt-1 w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-slate-200 bg-white p-3 text-left text-sm text-slate-600 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Suggested workflow</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                Tap an action to run it. Links open in-app routes; the country control matches the dashboard.
              </p>
              <ol className="mt-3 list-none space-y-3 p-0">
                <li className="rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                  <p className="text-[11px] font-medium text-slate-700">1 · Focus country</p>
                  <button
                    type="button"
                    onClick={focusCountrySelector}
                    className="mt-1.5 w-full rounded-lg border border-teal-200 bg-white px-2.5 py-2 text-left text-xs font-semibold text-teal-900 shadow-sm transition hover:bg-teal-50"
                  >
                    Scroll to country &amp; focus selector
                  </button>
                  <Link
                    to="/"
                    onClick={closeStepsPanel}
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-center text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    Open Country Dashboard
                  </Link>
                </li>
                <li className="rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                  <p className="text-[11px] font-medium text-slate-700">2 · Metric definitions</p>
                  <Link
                    to="/sources"
                    onClick={closeStepsPanel}
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-center text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    Open Sources
                  </Link>
                </li>
                <li className="rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                  <p className="text-[11px] font-medium text-slate-700">3 · Starter prompts</p>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={expandStartersAndScroll}
                      className="w-full rounded-lg border border-teal-200 bg-white px-2.5 py-2 text-left text-xs font-semibold text-teal-900 shadow-sm transition hover:bg-teal-50"
                    >
                      {messages.length === 0
                        ? "Expand all categories and scroll to list"
                        : "Open Prompts menu (chat has messages)"}
                    </button>
                    <button
                      type="button"
                      onClick={openStarterPromptMenu}
                      disabled={loading}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-45"
                    >
                      Open Prompts menu (composer)
                    </button>
                  </div>
                </li>
                <li className="rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                  <p className="text-[11px] font-medium text-slate-700">4 · Answer style</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Web-first needs a Tavily key from either server env or your own key below.
                  </p>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={applyWebFirstMode}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      Set Web-first (always search)
                    </button>
                    <button
                      type="button"
                      onClick={applyAutoMode}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      Set Auto (balanced routing)
                    </button>
                  </div>
                </li>
              </ol>
            </div>
          </details>
        </div>
      </div>

      <div className="mt-4 flex min-h-[min(400px,70vh)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          ref={scrollRef}
          className="flex flex-1 flex-col overflow-auto p-4 sm:p-5"
        >
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center py-6 sm:py-8">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-100 text-teal-700 shadow-sm ring-1 ring-teal-100">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h2 className="max-w-lg text-center text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                Ask in natural language — metrics, rankings, comparisons, or context
              </h2>
              <p className="mt-2 max-w-md text-center text-sm text-slate-500">
                Replies use the same series as your dashboard. Rankings return a table. Expand a category
                below to try one of{" "}
                <span className="font-medium text-slate-700">
                  {promptGroupFilter === "all"
                    ? ASSISTANT_SUGGESTION_COUNT
                    : visibleSuggestionCount}{" "}
                  starter prompts
                  {promptGroupFilter !== "all" ? " in this group" : ""}
                </span>
                , or type your own.
              </p>
              <p className="mt-3 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-center text-xs text-slate-400">
                <span>
                  Focus country matches the{" "}
                  <Link to="/" className="font-medium text-teal-700 underline-offset-2 hover:underline">
                    dashboard
                  </Link>{" "}
                  selector below
                </span>
                <span className="text-slate-300">·</span>
                <Link to="/sources" className="font-medium text-teal-700 underline-offset-2 hover:underline">
                  Metric sources
                </Link>
              </p>

              <div ref={emptyStartersRef} className="mt-8 w-full max-w-lg px-1 sm:px-0">
                <div className="mb-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
                  <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Starter prompts by category
                  </p>
                  {promptGroupFilter !== "all" ? (
                    <button
                      type="button"
                      onClick={() => setPromptGroupFilter("all")}
                      className="rounded-lg border border-teal-200 bg-teal-50/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-800 shadow-sm hover:bg-teal-100"
                    >
                      Show all groups
                    </button>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={expandAllCategories}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm hover:bg-slate-50"
                    >
                      Expand all
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllCategories}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm hover:bg-slate-50"
                    >
                      Collapse all
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {visibleSuggestionCategories.map((cat) => {
                    const open = openCategories.has(cat.id);
                    return (
                      <div
                        key={cat.id}
                        className="overflow-hidden rounded-xl border border-slate-200/90 bg-white text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
                      >
                        <button
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          aria-expanded={open}
                          className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left sm:items-center sm:py-3"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900">{cat.title}</span>
                            <span className="mt-0.5 block text-xs leading-snug text-slate-500">{cat.subtitle}</span>
                          </span>
                          <svg
                            className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ease-out sm:mt-0 ${open ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {open ? (
                          <div className="border-t border-slate-100 bg-slate-50/40 px-2 py-2 sm:px-3 sm:py-3">
                            <ul className="space-y-1">
                              {cat.prompts.map((q) => (
                                <li key={q}>
                                  <button
                                    type="button"
                                    onClick={() => send(q)}
                                    disabled={loading}
                                    className="w-full rounded-lg border border-transparent px-3 py-2.5 text-left text-sm leading-snug text-slate-700 transition hover:border-slate-200 hover:bg-white hover:shadow-sm active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
                                  >
                                    {q}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="flex justify-end gap-3">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-red-50 px-4 py-3 shadow-sm">
                      <p className="text-sm text-slate-800">{msg.content}</p>
                    </div>
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"
                      aria-hidden
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600"
                      aria-hidden
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    </div>
                    <div className="max-w-[85%] flex-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      {msg.attribution && msg.attribution.length > 0 ? (
                        <>
                          <VerifiedWebModeBadge attribution={msg.attribution} />
                          <AssistantPersonaBanner attribution={msg.attribution} citations={msg.citations} />
                        </>
                      ) : null}
                      <MessageContent text={msg.content} citations={msg.citations} />
                      {msg.attribution && msg.attribution.length > 0 && (
                        <>
                          <div className="mt-4 border-t border-slate-100 pt-3" />
                          <p className="text-[11px] text-slate-400">
                            Routing: {sourceLabel(msg.attribution)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )
              )}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                    <svg className="h-4 w-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3">
                    <p className="text-sm text-slate-500">Thinking…</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div ref={composerSectionRef} className="border-t border-slate-200 p-4">
          {err && (
            <p className="mb-3 text-sm text-red-600">{err}</p>
          )}
          <div className="mb-3 grid min-w-0 gap-1 sm:max-w-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Country</p>
            <p className="text-xs text-slate-500">
              Same focus as the Country Dashboard; metrics and briefings use this ISO3 unless your question names other
              countries.
            </p>
            <div className="mt-1 min-w-0">
              <CountrySelect
                value={country}
                onChange={(cca3) => {
                  writeStoredDashboardCountry(cca3);
                  setCountry(cca3);
                }}
                variant="light"
                showLabel={false}
              />
            </div>
          </div>
          <div className="relative flex gap-2 sm:gap-3">
            <div className="relative shrink-0" ref={promptMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setPromptMenuOpen((o) => {
                    const next = !o;
                    if (!next) setMenuExpandedCategoryId(null);
                    return next;
                  });
                }}
                className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 sm:w-auto sm:flex-row sm:gap-2 sm:px-3 ${
                  promptMenuOpen ? "border-teal-400 ring-2 ring-teal-100" : "border-slate-200"
                }`}
                aria-expanded={promptMenuOpen}
                aria-haspopup="dialog"
                aria-label="Starter prompts by group"
                title="Browse starter prompts by category"
              >
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h7"
                  />
                </svg>
                <span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-600 sm:inline">
                  Prompts
                </span>
              </button>
              {promptMenuOpen ? (
                <div
                  className="absolute bottom-full left-0 z-50 mb-2 w-[min(calc(100vw-2rem),22rem)] max-h-[min(70vh,26rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 text-left shadow-xl"
                  role="dialog"
                  aria-label="Starter prompt groups"
                >
                  <p className="border-b border-slate-100 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Suggestive questions
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPromptGroupFilter("all");
                      setMenuExpandedCategoryId(null);
                    }}
                    className={`mt-1 flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium transition hover:bg-slate-50 ${
                      promptGroupFilter === "all" ? "bg-teal-50 text-teal-900" : "text-slate-800"
                    }`}
                  >
                    All groups
                    <span className="text-xs font-normal text-slate-400">{ASSISTANT_SUGGESTION_COUNT}</span>
                  </button>
                  {ASSISTANT_SUGGESTION_CATEGORIES.map((cat) => {
                    const expanded = menuExpandedCategoryId === cat.id;
                    return (
                      <div key={cat.id} className="border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuExpandedCategoryId(expanded ? null : cat.id);
                            setPromptGroupFilter(cat.id);
                          }}
                          className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50 ${
                            promptGroupFilter === cat.id && !expanded ? "bg-slate-50" : ""
                          }`}
                          aria-expanded={expanded}
                        >
                          <svg
                            className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900">{cat.title}</span>
                            <span className="mt-0.5 block text-xs leading-snug text-slate-500">{cat.subtitle}</span>
                          </span>
                          <span className="shrink-0 text-xs text-slate-400">{cat.prompts.length}</span>
                        </button>
                        {expanded ? (
                          <ul className="space-y-0.5 border-t border-slate-50 bg-slate-50/80 px-2 py-2">
                            {cat.prompts.map((q) => (
                              <li key={q}>
                                <button
                                  type="button"
                                  onClick={() => send(q)}
                                  disabled={loading}
                                  className="w-full rounded-lg border border-transparent px-2.5 py-2 text-left text-xs leading-snug text-slate-700 transition hover:border-slate-200 hover:bg-white hover:shadow-sm disabled:pointer-events-none disabled:opacity-50"
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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask about metrics, sources, methodology, or location..."
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition hover:bg-red-700 disabled:opacity-40"
              aria-label="Send"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
