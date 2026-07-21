/**
 * Identifies outbound requests to public statistics APIs (recommended by several providers).
 */
export const OUTBOUND_USER_AGENT =
  "CountryAnalyticsPlatform/1.0 (country analytics dashboard; contact via product maintainer)";

const DEFAULT_RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Retries transient HTTP failures so brief outages at WDI, IMF, or REST Countries do not fail the whole dashboard.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts?: { attempts?: number; baseDelayMs?: number; retryOn?: Set<number>; timeoutMs?: number }
): Promise<Response> {
  const attempts = Math.max(1, opts?.attempts ?? 3);
  const baseDelayMs = opts?.baseDelayMs ?? 400;
  const retryOn = opts?.retryOn ?? DEFAULT_RETRY_STATUS;
  const timeoutMs = opts?.timeoutMs;

  const headers = new Headers(init?.headers);
  if (!headers.has("User-Agent")) headers.set("User-Agent", OUTBOUND_USER_AGENT);

  let last: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    const ac = new AbortController();
    const parentSignal = init?.signal;
    const onParentAbort = () => ac.abort(parentSignal?.reason);
    if (parentSignal) {
      if (parentSignal.aborted) {
        ac.abort(parentSignal.reason);
      } else {
        parentSignal.addEventListener("abort", onParentAbort, { once: true });
      }
    }
    const timer =
      timeoutMs && timeoutMs > 0
        ? setTimeout(() => ac.abort(new Error(`HTTP timeout after ${timeoutMs}ms`)), timeoutMs)
        : undefined;
    try {
      last = await fetch(url, { ...init, headers, signal: ac.signal });
    } catch (e) {
      if (timer) clearTimeout(timer);
      if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
        continue;
      }
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
      if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
    }
    if (last.ok) return last;
    const shouldRetry = retryOn.has(last.status) && i < attempts - 1;
    if (!shouldRetry) return last;
    await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
  }
  return last!;
}
