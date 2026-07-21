import type { SortDir } from "../../lib/tableSort";

type Props = {
  columnKey: string;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  title?: string;
  sticky?: boolean;
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="ml-1 inline-flex shrink-0 flex-col gap-px" aria-hidden>
      <svg
        viewBox="0 0 8 5"
        className={`h-[5px] w-2 ${active && dir === "asc" ? "text-slate-800" : "text-slate-300"}`}
        fill="currentColor"
      >
        <path d="M4 0 8 5H0z" />
      </svg>
      <svg
        viewBox="0 0 8 5"
        className={`h-[5px] w-2 ${active && dir === "desc" ? "text-slate-800" : "text-slate-300"}`}
        fill="currentColor"
      >
        <path d="M4 5 0 0h8z" />
      </svg>
    </span>
  );
}

export default function SortableTh({
  columnKey,
  sortKey,
  sortDir,
  onSort,
  children,
  className = "",
  align = "left",
  title,
  sticky = false,
}: Props) {
  const active = sortKey === columnKey;
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const btnFlex =
    align === "right" ? "w-full justify-end" : align === "center" ? "w-full justify-center" : "inline-flex";
  const stickyCls = sticky ? "cap-data-table-cell--sticky" : "";
  const activeCls = active ? "cap-data-table-sort-th--active" : "";

  return (
    <th
      scope="col"
      title={title}
      className={`cap-data-table-cell cap-data-table-cell--head cap-data-table-sort-th ${alignCls} ${stickyCls} ${activeCls} ${className}`.trim()}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`${btnFlex} max-w-full items-center gap-0.5 rounded-md px-1.5 py-1 -mx-1 font-inherit transition hover:bg-slate-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 ${
          active ? "bg-white/80 shadow-sm ring-1 ring-slate-200/80" : ""
        }`}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span className="min-w-0 truncate">{children}</span>
        <SortIcon active={active} dir={sortDir} />
      </button>
    </th>
  );
}
