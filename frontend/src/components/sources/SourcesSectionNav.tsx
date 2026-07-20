import DashboardSectionNav, { type DashboardNavItem } from "../dashboard/DashboardSectionNav";

type Props = {
  items: DashboardNavItem[];
  className?: string;
};

/** Sticky section nav — reuses dashboard nav (opens collapsed `<details>` on click). */
export default function SourcesSectionNav({ items, className }: Props) {
  return <DashboardSectionNav items={items} className={className} />;
}
