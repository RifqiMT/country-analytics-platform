/**
 * Serverless invocation budgets — keep outbound work under Vercel/Lambda limits so the
 * platform returns a JSON response instead of FUNCTION_INVOCATION_TIMEOUT.
 */

const SERVERLESS_HEADROOM_MS = 5_000;
const DEFAULT_SERVERLESS_BUDGET_MS = 55_000;

/** True when running inside Vercel or AWS Lambda (not local `npm run dev`). */
export function isServerlessRuntime(): boolean {
  return process.env.VERCEL === "1" || typeof process.env.AWS_LAMBDA_FUNCTION_NAME === "string";
}

/** Max wall-clock budget for a single serverless invocation (ms). */
export function serverlessInvocationBudgetMs(): number {
  const fromEnv = process.env.CAP_SERVERLESS_BUDGET_MS;
  if (fromEnv) {
    const parsed = parseInt(fromEnv, 10);
    if (Number.isFinite(parsed) && parsed > 1_000) {
      return Math.min(parsed, 300_000);
    }
  }
  if (!isServerlessRuntime()) return 120_000;
  return DEFAULT_SERVERLESS_BUDGET_MS;
}

/** Cap a desired timeout so it cannot exceed the serverless invocation budget. */
export function capServerlessTimeout(desiredMs: number, reserveMs = 1_500): number {
  if (!isServerlessRuntime()) return desiredMs;
  const ceiling = Math.max(3_000, serverlessInvocationBudgetMs() - reserveMs);
  return Math.min(desiredMs, ceiling);
}

export type RequestBudget = {
  startedAt: number;
  budgetMs: number;
  elapsedMs: () => number;
  remainingMs: (reserveMs?: number) => number;
  isExpired: (reserveMs?: number) => boolean;
};

export function createRequestBudget(totalMs?: number): RequestBudget {
  const startedAt = Date.now();
  const budgetMs = totalMs ?? serverlessInvocationBudgetMs();
  return {
    startedAt,
    budgetMs,
    elapsedMs: () => Date.now() - startedAt,
    remainingMs: (reserveMs = 0) => Math.max(0, budgetMs - (Date.now() - startedAt) - reserveMs),
    isExpired: (reserveMs = 0) => Date.now() - startedAt >= budgetMs - reserveMs,
  };
}

/**
 * Background full-catalog warmup can run for many minutes locally but will hit
 * FUNCTION_INVOCATION_TIMEOUT on Vercel if started inside a serverless invocation.
 */
export function shouldSkipBootstrapWarmup(): boolean {
  return process.env.DISABLE_BOOTSTRAP_WARMUP === "1" || isServerlessRuntime();
}

/** Recommended year-batch concurrency for global correlation on serverless. */
export function correlationYearConcurrency(): number {
  return isServerlessRuntime() ? 8 : 4;
}

/** Hard deadline (epoch ms) for correlation year loops, or null when unbounded. */
export function correlationDeadlineFromBudget(budget: RequestBudget, reserveMs = 2_000): number | null {
  if (!isServerlessRuntime()) return null;
  const remaining = budget.remainingMs(reserveMs);
  if (remaining <= 0) return Date.now();
  return Date.now() + remaining;
}
