import MessageContent, { type AssistantMessageCitations } from "./MessageContent";
import { resolveAssistantAnswerPresentation } from "../../lib/assistantAnswerPresentation";

type ChatMessage = {
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
  if (attribution.some((a) => a.toLowerCase().includes("tavily") || a.toLowerCase().includes("web"))) return "Web search";
  return "Dashboard data";
}

function PersonaHeader({
  attribution,
  citations,
}: {
  attribution: string[];
  citations?: AssistantMessageCitations;
}) {
  const pres = resolveAssistantAnswerPresentation(attribution, citations);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
      <span className="rounded-md bg-teal-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        {pres.categoryLabel}
      </span>
      <span className="text-xs font-semibold text-slate-800">{pres.personaName}</span>
      <span className="text-[11px] text-slate-500">{pres.personaTitle}</span>
    </div>
  );
}

type Props = {
  messages: ChatMessage[];
  loading: boolean;
};

export default function AssistantMessageList({ messages, loading }: Props) {
  return (
    <div className="space-y-4">
      {messages.map((msg) =>
        msg.role === "user" ? (
          <div key={msg.id} className="flex justify-end">
            <div className="max-w-[min(85%,32rem)] rounded-2xl rounded-br-md bg-slate-900 px-4 py-2.5 text-white shadow-sm">
              <p className="text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ) : (
          <div key={msg.id} className="flex gap-2.5 sm:gap-3">
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-100"
              aria-hidden
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div className="min-w-0 max-w-[min(85%,40rem)] flex-1 rounded-2xl rounded-tl-md border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
              {msg.attribution && msg.attribution.length > 0 ? (
                <PersonaHeader attribution={msg.attribution} citations={msg.citations} />
              ) : null}
              <MessageContent text={msg.content} citations={msg.citations} />
              {msg.attribution && msg.attribution.length > 0 ? (
                <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                  Source: {sourceLabel(msg.attribution)}
                </p>
              ) : null}
            </div>
          </div>
        )
      )}
      {loading ? (
        <div className="flex gap-2.5 sm:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-100">
            <span className="assistant-thinking-dot flex gap-0.5" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </div>
          <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-slate-500">Preparing your answer…</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
