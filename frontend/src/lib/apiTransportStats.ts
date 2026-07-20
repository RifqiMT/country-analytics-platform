import type { ApiTransportEvent } from "../api";
import { requestKindLabel } from "./toastPresentation";

export type TransportSummaryTone = "neutral" | "ok" | "fail" | "busy";

export type TransportStats = {
  total: number;
  successes: number;
  failures: number;
  successRate: number;
  avgDurationSec: number;
  lastDurationSec: number;
  lastKind: string;
  lastOutcome: ApiTransportEvent["outcome"];
};

function computeTransportStats(events: ApiTransportEvent[]): TransportStats | null {
  if (events.length === 0) return null;
  const last = events[0]!;
  const successes = events.filter((e) => e.outcome === "success").length;
  const failures = events.length - successes;
  const avgDurationSec = events.reduce((sum, e) => sum + e.durationSec, 0) / events.length;
  return {
    total: events.length,
    successes,
    failures,
    successRate: Math.round((successes / events.length) * 100),
    avgDurationSec,
    lastDurationSec: last.durationSec,
    lastKind: requestKindLabel(last.path),
    lastOutcome: last.outcome,
  };
}

function formatDurationPlain(sec: number): string {
  if (sec < 1) return `${Math.round(sec * 1000)} ms`;
  if (sec < 10) return `${sec.toFixed(2)} s`;
  return `${sec.toFixed(1)} s`;
}

export function transportSummary(events: ApiTransportEvent[]): {
  title: string;
  subtitle: string;
  meta: string;
  tone: TransportSummaryTone;
  stats: TransportStats | null;
} {
  const stats = computeTransportStats(events);
  if (!stats) {
    return {
      title: "Request log",
      subtitle: "No calls yet",
      meta: "Calls appear as you browse",
      tone: "neutral",
      stats: null,
    };
  }

  const countLabel = stats.total === 1 ? "1 call" : `${stats.total} calls`;

  if (stats.lastOutcome === "failure") {
    return {
      title: "Request log",
      subtitle: countLabel,
      meta: `${stats.failures} failed. Last: ${stats.lastKind}.`,
      tone: "fail",
      stats,
    };
  }

  const recentBusy = stats.lastDurationSec > 2.5;
  return {
    title: "Request log",
    subtitle: countLabel,
    meta: `All successful. Last: ${stats.lastKind}.`,
    tone: recentBusy ? "busy" : "ok",
    stats,
  };
}

/** Compact stat cells for the header tools strip and log panel header. */
export type StripStatItem = { label: string; value: string };

export function transportStripStats(events: ApiTransportEvent[]): StripStatItem[] {
  const stats = computeTransportStats(events);
  if (!stats) {
    return [
      { label: "Calls", value: "0" },
      { label: "Success", value: "—" },
      { label: "Avg time", value: "—" },
      { label: "Latest", value: "—" },
    ];
  }
  return [
    { label: "Calls", value: String(stats.total) },
    { label: "Success", value: `${stats.successRate}%` },
    { label: "Avg time", value: formatDurationPlain(stats.avgDurationSec) },
    { label: "Latest", value: stats.lastKind },
  ];
}

/** One-line summary for the header tools strip. */
export function transportStripLine(events: ApiTransportEvent[]): string {
  const stats = computeTransportStats(events);
  if (!stats) return "No calls yet.";
  if (stats.failures > 0) {
    return `${stats.total} calls, ${stats.failures} failed. Last: ${stats.lastKind}.`;
  }
  return `${stats.total} calls, all successful. Last: ${stats.lastKind}.`;
}

export function keysSummary(groqKey: string, tavilyKey: string): {
  subtitle: string;
  badge: string;
  tone: "neutral" | "partial" | "ready";
} {
  const groq = groqKey.trim().length > 0;
  const tavily = tavilyKey.trim().length > 0;
  if (!groq && !tavily) {
    return {
      subtitle: "Optional. Not configured.",
      badge: "Not set",
      tone: "neutral",
    };
  }
  if (groq && tavily) {
    return {
      subtitle: "Groq and Tavily connected.",
      badge: "Ready",
      tone: "ready",
    };
  }
  if (groq) {
    return {
      subtitle: "Groq connected. Tavily not set.",
      badge: "Partial",
      tone: "partial",
    };
  }
  return {
    subtitle: "Tavily connected. Groq not set.",
    badge: "Partial",
    tone: "partial",
  };
}
