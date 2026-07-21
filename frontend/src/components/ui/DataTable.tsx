import type { ReactNode, TableHTMLAttributes } from "react";

type ShellProps = {
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
  framed?: boolean;
  footer?: ReactNode;
  wide?: boolean;
};

/** Scroll container for data tables — sticky headers work inside this shell. */
export function DataTableShell({
  children,
  className = "",
  scrollClassName = "",
  framed = true,
  footer,
  wide = false,
}: ShellProps) {
  return (
    <div className={`cap-data-table-wrap ${framed ? "cap-data-table-wrap--framed" : ""} ${className}`.trim()}>
      <div
        className={`cap-data-table-shell overflow-auto ${wide ? "cap-data-table-shell--wide" : ""} ${scrollClassName}`.trim()}
      >
        {children}
      </div>
      {footer ? <div className="cap-data-table-footer">{footer}</div> : null}
    </div>
  );
}

type TableProps = TableHTMLAttributes<HTMLTableElement> & {
  compact?: boolean;
  wide?: boolean;
};

export function DataTable({ compact, wide, className = "", ...props }: TableProps) {
  const size = compact ? "cap-data-table--compact" : "";
  const layout = wide ? "cap-data-table--wide" : "";
  return <table className={`cap-data-table ${size} ${layout} ${className}`.trim()} {...props} />;
}

export function DataTableHead({ className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`cap-data-table-head ${className}`.trim()} {...props} />;
}

export function DataTableBody({ className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`cap-data-table-body ${className}`.trim()} {...props} />;
}

export function DataTableRow({ className = "", ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`cap-data-table-row ${className}`.trim()} {...props} />;
}

type CellProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
  label?: boolean;
  sticky?: boolean;
  muted?: boolean;
  accent?: "a" | "b";
  highlight?: boolean;
};

export function DataTableCell({
  numeric,
  label,
  sticky,
  muted,
  accent,
  highlight,
  className = "",
  ...props
}: CellProps) {
  const mods = [
    numeric ? "cap-data-table-cell--numeric" : "",
    label ? "cap-data-table-cell--label" : "",
    sticky ? "cap-data-table-cell--sticky" : "",
    muted ? "cap-data-table-cell--muted" : "",
    accent === "a" ? "cap-data-table-cell--accent-a" : "",
    accent === "b" ? "cap-data-table-cell--accent-b" : "",
    highlight ? "cap-data-table-cell--highlight" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <td className={`cap-data-table-cell ${mods}`.trim()} {...props} />;
}

export function DataTableGroupRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className="cap-data-table-group-row">
      <td colSpan={colSpan} className="cap-data-table-group-cell">
        {label}
      </td>
    </tr>
  );
}

export function DataTableEmpty({ children = "—" }: { children?: ReactNode }) {
  return <span className="cap-data-table-empty">{children}</span>;
}

/** Primary value with optional inline delta (e.g. YoY) — optimized for scanning. */
export function DataTableMetricValue({
  value,
  delta,
  deltaClassName = "cap-data-table-metric-delta--neutral",
  title,
  align = "right",
}: {
  value: ReactNode;
  delta?: ReactNode;
  deltaClassName?: string;
  title?: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`cap-data-table-metric ${align === "right" ? "cap-data-table-metric--right" : ""}`.trim()}
      title={title}
    >
      <span className="cap-data-table-metric-value">{value}</span>
      {delta != null && delta !== "" && delta !== "—" ? (
        <span className={`cap-data-table-metric-delta ${deltaClassName}`.trim()}>{delta}</span>
      ) : null}
    </div>
  );
}

function DataTableRowCount({ count, label = "rows" }: { count: number; label?: string }) {
  return (
    <span className="cap-data-table-row-count">
      {count.toLocaleString()} {label}
    </span>
  );
}

function DataTableScrollHint() {
  return <span className="cap-data-table-scroll-hint">Scroll for more columns</span>;
}

export function DataTableFooterBar({
  count,
  label,
  wide = false,
}: {
  count: number;
  label: string;
  wide?: boolean;
}) {
  return (
    <>
      <DataTableRowCount count={count} label={label} />
      {wide ? <DataTableScrollHint /> : null}
    </>
  );
}

const DATA_TABLE_TH_SORT = "cap-data-table-sort-th whitespace-nowrap";

export const DATA_TABLE_TH_SORT_RIGHT = `${DATA_TABLE_TH_SORT} text-right`;

export const DATA_TABLE_TH_LABEL = `${DATA_TABLE_TH_SORT} cap-data-table-sort-th--label`;
