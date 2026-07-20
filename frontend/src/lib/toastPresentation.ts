import type { ApiTransportEvent, ClientToastEvent } from "../api";

export type ToastStackEvent =
  | { channel: "api"; e: ApiTransportEvent }
  | { channel: "client"; e: ClientToastEvent };

function formatToastDuration(sec: number): string {
  if (sec < 1) return `${Math.round(sec * 1000)} ms`;
  if (sec < 10) return `${sec.toFixed(2)} s`;
  return `${sec.toFixed(1)} s`;
}

function formatToastBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Human label for API paths (no query strings). */
export function requestKindLabel(path: string): string {
  const base = path.split("?")[0] ?? path;
  if (base.includes("/api/country/") && base.endsWith("/series")) return "Country metrics";
  if (base.includes("/fx-series")) return "Exchange rate history";
  if (base.includes("/wb-profile")) return "World Bank profile";
  if (base.includes("/dashboard/comparison")) return "Peer comparison";
  if (base.includes("/api/metrics")) return "Metrics catalog";
  if (base.includes("/api/countries")) return "Country directory";
  if (base.includes("/api/country/") && !base.endsWith("/series")) return "Country profile";
  if (base.includes("/api/global/snapshot")) return "Global snapshot";
  if (base.includes("/api/global/table")) return "Global data table";
  if (base.includes("/api/global/wld-series")) return "World aggregates";
  if (base.includes("/api/analysis/correlation")) return "Correlation analysis";
  if (base.includes("/api/analysis/business/correlation-narrative")) return "Business narrative";
  if (base.includes("/api/cache/clear")) return "Cache refresh";
  if (base.includes("/pestel")) return "PESTEL analysis";
  if (base.includes("/porter")) return "Porter five forces";
  if (base.includes("/assistant") || base.includes("/chat")) return "Analytics assistant";
  if (base.includes("/data-providers")) return "Data sources";
  if (base.includes("/validate-keys")) return "API key check";
  return "Platform request";
}

function countryCodeFromPath(base: string): string | null {
  const match = base.match(/\/api\/country\/([A-Za-z]{3})(?:\/|$)/);
  return match?.[1]?.toUpperCase() ?? null;
}

/** Brief plain-English explanation of what a logged request does. */
export function requestLogBrief(path: string): string {
  const base = path.split("?")[0] ?? path;
  const country = countryCodeFromPath(base);

  if (base.includes("/api/country/") && base.endsWith("/series")) {
    return country
      ? `Loaded historical indicator values for ${country} to populate charts and tables.`
      : "Loaded historical indicator values for the selected country.";
  }
  if (base.includes("/fx-series")) {
    return "Retrieved exchange rate history for the country's currency.";
  }
  if (base.includes("/wb-profile")) {
    return country
      ? `Fetched World Bank income and lending classification for ${country}.`
      : "Fetched World Bank income and lending classification metadata.";
  }
  if (base.includes("/dashboard/comparison")) {
    return country
      ? `Compared ${country} against regional peers on key dashboard indicators.`
      : "Built a regional peer comparison for the selected country.";
  }
  if (base.includes("/api/metrics")) {
    return "Downloaded the catalog of available metrics, units, and source references.";
  }
  if (base.includes("/api/countries")) {
    return "Refreshed the master list of countries used in search and filters.";
  }
  if (base.includes("/api/country/") && !base.endsWith("/series")) {
    return country
      ? `Loaded profile details for ${country}, including region, capital, and flag.`
      : "Loaded general profile details for the selected country.";
  }
  if (base.includes("/api/global/snapshot")) {
    return "Pulled the latest available values for the global map view.";
  }
  if (base.includes("/api/global/table")) {
    return "Loaded country-level figures for the global sortable table.";
  }
  if (base.includes("/api/global/wld-series")) {
    return "Retrieved world aggregate (WLD) time series for macro charts.";
  }
  if (base.includes("/api/analysis/correlation")) {
    return "Calculated the statistical relationship between two selected metrics.";
  }
  if (base.includes("/api/analysis/business/correlation-narrative")) {
    return "Generated a written summary interpreting the correlation results.";
  }
  if (base.includes("/api/cache/clear")) {
    return "Cleared server-side cache so subsequent requests use fresh data.";
  }
  if (base.includes("/pestel")) {
    return "Requested a PESTEL macro-environment report for the chosen country.";
  }
  if (base.includes("/porter")) {
    return "Requested a Porter five forces industry analysis for the chosen sector.";
  }
  if (base.includes("/assistant") || base.includes("/chat")) {
    return "Sent a message to the analytics assistant and waited for a reply.";
  }
  if (base.includes("/data-providers")) {
    return "Loaded information about data providers and how series are merged.";
  }
  if (base.includes("/validate-keys")) {
    return "Checked whether the Groq and Tavily API keys in this browser are valid.";
  }
  return "Completed a background request to keep the platform data in sync.";
}

/** Outcome-aware one-liner for expanded log detail. */
export function requestLogOutcomeLine(path: string, outcome: "success" | "failure"): string {
  const brief = requestLogBrief(path);
  if (outcome === "success") {
    return `This call finished normally. ${brief}`;
  }
  return `This call did not finish as expected. ${brief}`;
}

function apiSuccessMessage(path: string): string {
  const base = path.split("?")[0] ?? path;
  if (base.includes("/api/analysis/pestel")) return "PESTEL report generated successfully.";
  if (base.includes("/api/analysis/porter")) return "Porter analysis generated successfully.";
  if (base.includes("/assistant") || base.includes("/chat")) return "Assistant reply received.";
  if (base.includes("/api/cache/clear")) return "Server cache cleared. Fresh data will load on the next request.";
  if (base.includes("/dashboard/comparison")) return "Regional comparison table is ready.";
  if (base.includes("/fx-series")) return "Exchange rate series loaded.";
  if (base.includes("/api/country/") && !base.endsWith("/series")) return "Country profile loaded.";
  return "Request completed successfully.";
}

function apiFailureMessage(path: string, error: string): string {
  const kind = requestKindLabel(path);
  if (/timed out|504|SERIES_TIMEOUT/i.test(error)) {
    return `${kind} took too long. Retry or narrow the year range if this continues.`;
  }
  return error;
}

export function toastHeadline(event: ToastStackEvent): string {
  const ok = event.channel === "api" ? event.e.outcome === "success" : event.e.outcome === "success";
  if (!ok) return "Something went wrong";
  if (event.channel === "client") return "Completed";
  const base = event.e.path.split("?")[0] ?? "";
  if (base.includes("/api/analysis/pestel") || base.includes("/api/analysis/porter")) return "Analysis ready";
  if (base.includes("/assistant") || base.includes("/chat")) return "Assistant replied";
  if (base.includes("/api/cache/clear")) return "Cache cleared";
  return "Success";
}

export function toastTitle(event: ToastStackEvent): string {
  if (event.channel === "client") return event.e.title;
  return requestKindLabel(event.e.path);
}

export function toastDetail(event: ToastStackEvent): string | null {
  if (event.channel === "client") {
    if (event.e.outcome === "failure" && event.e.error) {
      return event.e.error;
    }
    return event.e.detail ?? null;
  }
  if (event.e.outcome === "failure") {
    return apiFailureMessage(event.e.path, event.e.error);
  }
  return apiSuccessMessage(event.e.path);
}

export function toastMeta(event: ToastStackEvent): { duration?: string; status?: string; size?: string } {
  if (event.channel === "client") {
    return event.e.durationSec != null ? { duration: formatToastDuration(event.e.durationSec) } : {};
  }
  const meta: { duration?: string; status?: string; size?: string } = {
    duration: formatToastDuration(event.e.durationSec),
  };
  if (event.e.status != null) meta.status = String(event.e.status);
  if (event.e.outcome === "success") meta.size = formatToastBytes(event.e.responseBytes);
  return meta;
}

/** Skip noisy success toasts for high-volume background metric batches. */
export function shouldShowApiToast(e: ApiTransportEvent): boolean {
  if (e.outcome === "failure") return true;
  const base = e.path.split("?")[0] ?? "";
  if (base.includes("/series")) return false;
  return true;
}

export function toastDismissMs(event: ToastStackEvent): number {
  const ok = event.channel === "api" ? event.e.outcome === "success" : event.e.outcome === "success";
  if (!ok) return 12_000;
  if (event.channel === "client") return 5_500;
  const base = event.channel === "api" ? event.e.path.split("?")[0] ?? "" : "";
  if (base.includes("/pestel") || base.includes("/porter") || base.includes("/assistant")) return 7_000;
  return 4_500;
}
