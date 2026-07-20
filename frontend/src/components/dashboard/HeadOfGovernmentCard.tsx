type Props = {
  role?: string;
  name?: string;
};

function normalizeRole(role?: string): string | undefined {
  const t = role?.trim();
  if (!t || t === "—") return undefined;
  return t;
}

/** Leadership card — name-first hierarchy with role as a compact badge. */
export default function HeadOfGovernmentCard({ role, name }: Props) {
  const displayRole = normalizeRole(role);
  const displayName = name?.trim() || undefined;

  return (
    <article className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:p-4">
      <div className="flex min-w-0 gap-3">
        <span
          className="mt-1 w-1 shrink-0 self-stretch rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Head of government</p>

          {displayName ? (
            <div className="mt-2.5 min-w-0">
              <p className="break-words text-lg font-bold leading-snug tracking-tight text-slate-900 sm:text-xl">
                {displayName}
              </p>
              {displayRole ? (
                <p className="mt-1.5">
                  <span className="inline-flex max-w-full items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/80">
                    {displayRole}
                  </span>
                </p>
              ) : null}
            </div>
          ) : displayRole ? (
            <p className="mt-2.5 text-base font-semibold text-slate-900">{displayRole}</p>
          ) : (
            <p className="mt-2.5 text-sm text-slate-400">Not reported</p>
          )}
        </div>
      </div>
    </article>
  );
}
