/** Trim trailing zeros after the decimal (e.g. `4.60` → `4.6`, `12.00` → `12`). */
function trimFixed(s: string): string {
  if (!s.includes(".")) return s;
  let t = s.replace(/(\.\d*?)0+$/, "$1");
  if (t.endsWith(".")) t = t.slice(0, -1);
  return t;
}

/**
 * Compact scale for dashboards: `1.25 K`, `1.90 Mn`, `1.85 Bn`, `4.6 Tn` (space before unit).
 * `suffix` is appended after a space if it does not already start with one (e.g. `" km²"` → `… Mn km²`).
 */
export function formatCompactNumber(value: number, opts?: { suffix?: string; maxFrac?: number }): string {
  if (!Number.isFinite(value)) return "—";
  const frac = Math.max(0, Math.min(20, opts?.maxFrac ?? 2));
  let suf = opts?.suffix ?? "";
  if (suf && !suf.startsWith(" ")) suf = ` ${suf}`;

  const neg = value < 0;
  const abs = Math.abs(value);
  const f = (n: number) => trimFixed(n.toFixed(frac));

  let body: string;
  if (abs >= 1e12) body = `${f(abs / 1e12)} Tn`;
  else if (abs >= 1e9) body = `${f(abs / 1e9)} Bn`;
  else if (abs >= 1e6) body = `${f(abs / 1e6)} Mn`;
  else if (abs >= 1e3) body = `${f(abs / 1e3)} K`;
  else body = trimFixed(abs.toFixed(frac));

  const sign = neg ? "-" : "";
  return `${sign}${body}${suf}`;
}

/** Integer-style counts (e.g. sample size n): same scales, usually no decimals. */
export function formatCompactCount(value: number, opts?: { suffix?: string }): string {
  return formatCompactNumber(value, { ...opts, maxFrac: 0 });
}

export type YoYDisplay = { text: string; tone: "up" | "down" | "flat" };

export function formatYoY(
  pct: number | null,
  bps: number | null,
  preferBps: boolean
): YoYDisplay {
  if (preferBps && bps !== null && !Number.isNaN(bps)) {
    const rounded = Math.round(bps);
    if (rounded === 0) return { text: "0 bps YoY", tone: "flat" };
    const tone = rounded > 0 ? "up" : "down";
    return { text: `${rounded > 0 ? "+" : ""}${rounded} bps YoY`, tone };
  }
  if (pct !== null && !Number.isNaN(pct)) {
    if (Math.abs(pct) < 1e-6) return { text: "0.0% YoY", tone: "flat" };
    const tone = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
    return { text: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}% YoY`, tone };
  }
  return { text: "—", tone: "flat" };
}

export function yoYClass(tone: "up" | "down" | "flat"): string {
  if (tone === "up") return "text-emerald-600";
  if (tone === "down") return "text-red-600";
  return "text-slate-400";
}
