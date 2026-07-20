import { useEffect, useState } from "react";

/** Matches `UTC+7`, `UTC+07:00`, `GMT-05:30`, etc. */
const UTC_OFFSET_RE = /^(?:UTC|GMT)\s*([+-])(\d{1,2})(?::(\d{2}))?$/i;

function fixedOffsetMinutes(tz: string): number | null {
  const s = tz.trim();
  if (/^UTC$/i.test(s) || /^GMT$/i.test(s)) return 0;
  const m = s.match(UTC_OFFSET_RE);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const h = Number(m[2]);
  const min = m[3] ? Number(m[3]) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return sign * (h * 60 + min);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatFixedOffsetTime(date: Date, offsetMinutes: number): string {
  const utcMs = date.getTime();
  const totalSec = Math.floor(utcMs / 1000) + offsetMinutes * 60;
  const daySec = ((totalSec % 86400) + 86400) % 86400;
  const h = Math.floor(daySec / 3600);
  const mi = Math.floor((daySec % 3600) / 60);
  const s = daySec % 60;
  return `${pad2(h)}:${pad2(mi)}:${pad2(s)}`;
}

function formatIanaTime24h(date: Date, iana: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: iana,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).format(date);
  } catch {
    return null;
  }
}

type Props = {
  timezone: string | undefined;
};

export default function TimezoneClockCard({ timezone }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const label = timezone?.trim() ?? "";
  const offsetMin = label ? fixedOffsetMinutes(label) : null;
  const clock =
    label === ""
      ? null
      : offsetMin !== null
        ? formatFixedOffsetTime(now, offsetMin)
        : formatIanaTime24h(now, label);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-4">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-400 to-indigo-200" aria-hidden />
      <div className="flex flex-wrap items-end justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Timezone</p>
          <p className="mt-2 truncate text-base font-semibold text-slate-900">{label || "—"}</p>
        </div>
        {clock ? (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Local time</p>
            <p
              className="mt-1 font-mono text-xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-2xl"
              suppressHydrationWarning
            >
              {clock}
            </p>
          </div>
        ) : label ? (
          <p className="shrink-0 max-w-[10rem] text-right text-[10px] text-slate-400">Clock unavailable</p>
        ) : null}
      </div>
    </div>
  );
}
