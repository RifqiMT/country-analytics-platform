import { createHash } from "node:crypto";
import { setCache } from "./cache.js";
import { listCountries } from "./restCountries.js";
import { fetchCountryBundle, allMetricIds } from "./worldBank.js";
import { shouldSkipBootstrapWarmup } from "./serverlessBudget.js";
import { MIN_DATA_YEAR, currentDataYear } from "./yearBounds.js";

/** Align with `countrySeriesCacheKey` in `index.ts` so warmed entries match GET `/api/country/:cca3/series`. */
function countrySeriesCacheKey(cca3: string, start: number, end: number, metricIds: string[]): string {
  const sorted = [...metricIds].sort().join("\0");
  const h = createHash("sha256").update(sorted).digest("hex").slice(0, 20);
  return `country:series:v3:${cca3}:${start}:${end}:${h}`;
}

const WARM_TTL_MS = 1000 * 60 * 60 * 2;
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 120;

let warmupPromise: Promise<{ warmed: number; failed: number; skipped: boolean }> | null = null;

/** Call after `clearAllCache()` so the next `/api/bootstrap/warm` can run again. */
export function resetDataWarmupGate(): void {
  warmupPromise = null;
}

/**
 * Fetches full metric bundles for WLD + every REST country and stores them under the same cache keys
 * as `/api/country/:cca3/series` (all metrics, MIN_DATA_YEAR–current). Runs best-effort in the background.
 */
export function startDataWarmup(): Promise<{ warmed: number; failed: number; skipped: boolean }> {
  if (shouldSkipBootstrapWarmup()) {
    return Promise.resolve({ warmed: 0, failed: 0, skipped: true });
  }
  if (warmupPromise) return warmupPromise;

  warmupPromise = (async () => {
    const start = MIN_DATA_YEAR;
    const end = currentDataYear();
    const metricIds = allMetricIds();
    let warmed = 0;
    let failed = 0;

    const warmOne = async (cca3: string) => {
      const u = cca3.toUpperCase();
      if (!/^[A-Z]{3}$/.test(u)) return;
      try {
        const bundle = await fetchCountryBundle(u, metricIds, start, end);
        setCache(countrySeriesCacheKey(u, start, end, metricIds), bundle, WARM_TTL_MS);
        warmed += 1;
      } catch {
        failed += 1;
      }
    };

    try {
      await warmOne("WLD");

      const countries = await listCountries();
      const codes = [
        ...new Set(
          countries
            .map((c) => c.cca3?.toUpperCase())
            .filter((c): c is string => typeof c === "string" && /^[A-Z]{3}$/.test(c))
        ),
      ].filter((c) => c !== "WLD");

      for (let i = 0; i < codes.length; i += BATCH_SIZE) {
        const batch = codes.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((c) => warmOne(c)));
        if (i + BATCH_SIZE < codes.length) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }
    } catch {
      failed += 1;
    }

    return { warmed, failed, skipped: false };
  })();

  return warmupPromise;
}
