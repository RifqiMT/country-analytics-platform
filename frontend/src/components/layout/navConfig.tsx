import type { ComponentType } from "react";

const PinIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const GlobeIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v6a2 2 0 002 2h2M15 11h4.945M15 11V9a2 2 0 00-2-2h-2M9 11V9a2 2 0 012-2h2m-6 4v6a2 2 0 002 2h2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const DocIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M5 5h8l4 4v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
  </svg>
);
const GridIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h4v4H4V6zm6 0h4v4h-4V6zm6 0h4v4h-4V6zM4 12h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" />
  </svg>
);
const ChartIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19V5m4 14V9m4 10V7m4 12v-8" />
  </svg>
);
const SparkIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.5 4.5L19 12l-5.5 3L10 19l-2.5-4L2 12l5.5-3L10 5z" />
  </svg>
);

export type NavItem = {
  to: string;
  end?: boolean;
  label: string;
  shortLabel: string;
  /** Ultra-short label for bottom tab bar on phones/tablets. */
  tabLabel: string;
  icon: ComponentType;
};

export const APP_NAV: NavItem[] = [
  { to: "/", end: true, label: "Country Dashboard", shortLabel: "Dashboard", tabLabel: "Home", icon: PinIcon },
  { to: "/global", label: "Global Analytics", shortLabel: "Global", tabLabel: "Global", icon: GlobeIcon },
  { to: "/pestel", label: "PESTEL", shortLabel: "PESTEL", tabLabel: "PESTEL", icon: DocIcon },
  { to: "/porter", label: "Porter 5 Forces", shortLabel: "Porter", tabLabel: "Porter", icon: GridIcon },
  { to: "/business", label: "Business Analytics", shortLabel: "Business", tabLabel: "Business", icon: ChartIcon },
  { to: "/assistant", label: "Analytics Assistant", shortLabel: "Assistant", tabLabel: "Assistant", icon: SparkIcon },
  { to: "/sources", label: "Source", shortLabel: "Sources", tabLabel: "Sources", icon: DocIcon },
];

/** Primary destinations in the mobile/tablet bottom tab bar. */
export const MOBILE_PRIMARY_NAV: NavItem[] = [
  APP_NAV[0]!,
  APP_NAV[1]!,
  APP_NAV[4]!,
  APP_NAV[5]!,
];

/** Secondary destinations opened from the “More” tab. */
export const MOBILE_MORE_NAV: NavItem[] = [APP_NAV[2]!, APP_NAV[3]!, APP_NAV[6]!];

export const APP_TAGLINE =
  "Analyst-grade financial, demographic, and health metrics for every country (2000 – latest), powered by World Bank, UN, UNESCO, WHO, and IMF data.";
