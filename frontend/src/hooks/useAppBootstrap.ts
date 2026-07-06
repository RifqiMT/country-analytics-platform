import { useEffect } from "react";
import { getJson, postJson } from "../api";

const SESSION_KEY = "cap-app-bootstrap-v1";

/**
 * Once per browser tab session: prefetch catalogs. Backend cache warmup is skipped on
 * Vercel serverless (would exceed invocation limits); local dev still warms in background.
 */
export function useAppBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* private mode — still try network */
    }

    void getJson<unknown[]>("/api/countries").catch(() => {});
    void getJson<unknown[]>("/api/metrics").catch(() => {});
    void getJson<unknown>("/api/data-providers").catch(() => {});
    void postJson<{ status: string }>("/api/bootstrap/warm", {}).catch(() => {});
  }, []);
}
