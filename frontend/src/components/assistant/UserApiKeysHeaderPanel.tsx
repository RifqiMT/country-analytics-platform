import { useEffect, useState } from "react";
import { postJson } from "../../api";
import { keysSummary } from "../../lib/apiTransportStats";
import {
  clearUserApiKeys,
  loadUserApiKeys,
  saveUserApiKeys,
  USER_API_KEYS_CHANGED_EVENT,
  type UserApiKeysScope,
} from "../../lib/userApiKeys";

const GROQ_KEYS_URL = "https://console.groq.com/keys";
const TAVILY_KEYS_URL = "https://app.tavily.com/";

function GetKeyLink({ href, provider }: { href: string; provider: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 text-[10px] font-semibold normal-case tracking-normal text-teal-700 hover:text-teal-900 hover:underline"
    >
      Get {provider} key
      <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

export default function UserApiKeysHeaderPanel({ variant = "default" }: { variant?: "default" | "embedded" }) {
  const [groqApiKey, setGroqApiKey] = useState("");
  const [tavilyApiKey, setTavilyApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [scope, setScope] = useState<UserApiKeysScope>("session");
  const [validating, setValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [groqStatus, setGroqStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [tavilyStatus, setTavilyStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      const v = loadUserApiKeys();
      setGroqApiKey(v.groqApiKey);
      setTavilyApiKey(v.tavilyApiKey);
      setRemember(v.remember);
      setScope(v.scope);
      setHydrated(true);
    };
    sync();
    window.addEventListener(USER_API_KEYS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(USER_API_KEYS_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveUserApiKeys({ groqApiKey, tavilyApiKey, remember, scope });
  }, [groqApiKey, tavilyApiKey, remember, scope, hydrated]);

  const onClear = () => {
    setGroqApiKey("");
    setTavilyApiKey("");
    setRemember(false);
    setScope("session");
    clearUserApiKeys();
    setValidationMessage(null);
    setGroqStatus("idle");
    setTavilyStatus("idle");
  };

  const hasAnyKey = groqApiKey.trim().length > 0 || tavilyApiKey.trim().length > 0;
  const canValidate = hasAnyKey && !validating;

  const runValidation = async () => {
    if (!canValidate) return;
    setValidating(true);
    setValidationMessage(null);
    if (groqApiKey.trim()) setGroqStatus("checking");
    if (tavilyApiKey.trim()) setTavilyStatus("checking");
    try {
      const result = await postJson<{
        groq: { ok: boolean; message: string };
        tavily: { ok: boolean; message: string };
      }>("/api/keys/validate", {});
      setGroqStatus(groqApiKey.trim() ? (result.groq.ok ? "valid" : "invalid") : "idle");
      setTavilyStatus(tavilyApiKey.trim() ? (result.tavily.ok ? "valid" : "invalid") : "idle");
      const parts: string[] = [
        `Groq: ${result.groq.ok ? "OK" : "Not valid"}. ${result.groq.message}`,
        `Tavily: ${result.tavily.ok ? "OK" : "Not valid"}. ${result.tavily.message}`,
      ];
      setValidationMessage(parts.join(" | "));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGroqStatus(groqApiKey.trim() ? "invalid" : "idle");
      setTavilyStatus(tavilyApiKey.trim() ? "invalid" : "idle");
      setValidationMessage(`Validation request failed: ${msg}`);
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    setGroqStatus((prev) => (prev === "checking" ? prev : "idle"));
  }, [groqApiKey]);

  useEffect(() => {
    setTavilyStatus((prev) => (prev === "checking" ? prev : "idle"));
  }, [tavilyApiKey]);

  const statusChipClass = (status: "idle" | "checking" | "valid" | "invalid"): string => {
    if (status === "valid") return "bg-emerald-100 text-emerald-700";
    if (status === "invalid") return "bg-red-100 text-red-700";
    if (status === "checking") return "bg-amber-100 text-amber-700";
    return "bg-slate-200 text-slate-600";
  };
  const statusLabel = (status: "idle" | "checking" | "valid" | "invalid"): string => {
    if (status === "valid") return "Valid";
    if (status === "invalid") return "Invalid";
    if (status === "checking") return "Checking";
    return "Not checked";
  };

  const embedded = variant === "embedded";
  const summary = keysSummary(groqApiKey, tavilyApiKey);
  const badgeClass =
    summary.tone === "ready"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
      : summary.tone === "partial"
        ? "bg-amber-50 text-amber-900 ring-amber-200/80"
        : "bg-slate-100 text-slate-600 ring-slate-200/80";

  return (
    <details
      className={`group w-full [&::-webkit-details-marker]:hidden ${
        embedded
          ? "rounded-none border-0 bg-transparent p-0"
          : "rounded-xl border border-slate-200 bg-slate-50/60 p-2.5"
      }`}
    >
      <summary
        className={`flex cursor-pointer list-none items-center gap-2.5 transition-colors [&::-webkit-details-marker]:hidden ${
          embedded
            ? "px-3 py-2.5 hover:bg-slate-50 sm:px-4"
            : "text-xs font-semibold uppercase tracking-wide text-slate-600"
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            embedded ? "bg-slate-100 text-slate-600" : ""
          }`}
          aria-hidden
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`truncate ${embedded ? "text-sm font-semibold text-slate-900" : "text-xs font-semibold uppercase tracking-wide text-slate-600"}`}>
              AI keys
            </span>
            {embedded ? (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badgeClass}`}>
                {summary.badge}
              </span>
            ) : (
              <>
                <span className="hidden sm:inline">(App-wide)</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badgeClass}`}>
                  {summary.badge}
                </span>
              </>
            )}
          </span>
          {embedded ? (
            <span className="mt-0.5 block truncate text-xs text-slate-500">{summary.subtitle}</span>
          ) : null}
        </span>
        <svg
          className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className={`grid grid-cols-1 gap-2 ${embedded ? "border-t border-slate-100 bg-slate-50/40 p-3 sm:p-4" : "mt-2"}`}>
        <label className="min-w-0">
          <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span className="inline-flex items-center gap-2">
              Groq key
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusChipClass(groqStatus)}`}>
                {statusLabel(groqStatus)}
              </span>
            </span>
            <GetKeyLink href={GROQ_KEYS_URL} provider="Groq" />
          </span>
          <input
            type="password"
            id="cap-groq-api-key"
            name="cap_groq_api_key"
            value={groqApiKey}
            onChange={(e) => setGroqApiKey(e.target.value)}
            autoComplete="new-password"
            data-lpignore="true"
            data-form-type="other"
            spellCheck={false}
            placeholder="gsk_..."
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />
          <p className="mt-1 text-[10px] leading-snug text-slate-500">
            Used for Assistant, PESTEL, Porter, and Business narrative LLM calls.
          </p>
        </label>
        <label className="min-w-0">
          <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span className="inline-flex items-center gap-2">
              Tavily key
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusChipClass(tavilyStatus)}`}>
                {statusLabel(tavilyStatus)}
              </span>
            </span>
            <GetKeyLink href={TAVILY_KEYS_URL} provider="Tavily" />
          </span>
          <input
            type="password"
            id="cap-tavily-api-key"
            name="cap_tavily_api_key"
            value={tavilyApiKey}
            onChange={(e) => setTavilyApiKey(e.target.value)}
            autoComplete="new-password"
            data-lpignore="true"
            data-form-type="other"
            spellCheck={false}
            placeholder="tvly-..."
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />
          <p className="mt-1 text-[10px] leading-snug text-slate-500">
            Used for live web retrieval in Assistant and analysis modules when search is enabled.
          </p>
        </label>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-red-600"
            />
            Remember keys in this browser
          </label>
          {remember ? (
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value === "local" ? "local" : "session")}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
            >
              <option value="session">Session only</option>
              <option value="local">Persistent</option>
            </select>
          ) : null}
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Clear keys
          </button>
          <button
            type="button"
            onClick={runValidation}
            disabled={!canValidate}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {validating ? "Validating..." : "Validate keys"}
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Keys stay in this browser and are sent with Assistant, PESTEL, Porter, and Business narrative requests.
        </p>
        {validationMessage ? (
          <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] leading-relaxed text-slate-600">
            {validationMessage}
          </p>
        ) : null}
      </div>
    </details>
  );
}
