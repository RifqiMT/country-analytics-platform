import type { MetricDef } from "../../api";

export const SOURCES_SECTION_IDS = {
  providers: "sources-providers",
  usage: "sources-usage",
  catalog: "sources-catalog",
} as const;

export const CATEGORY_ORDER = ["general", "financial", "health", "education", "labour", "demographics", "crime"] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  financial: "Financial",
  health: "Health & demographics",
  education: "Education",
  labour: "Labour",
  demographics: "Demographics",
  crime: "Crime & public safety",
};

export const CATEGORY_ACCENT: Record<
  string,
  "slate" | "rose" | "teal" | "amber" | "indigo"
> = {
  general: "slate",
  financial: "rose",
  health: "teal",
  education: "amber",
  labour: "slate",
  demographics: "indigo",
  crime: "indigo",
};

export const SOURCE_CHIP_DEFS: { id: string; label: string; test: (m: MetricDef) => boolean }[] = [
  {
    id: "wb",
    label: "World Bank",
    test: (m) =>
      /world bank|wdi|wb\b/i.test(m.sourceName + m.description) ||
      m.sourceUrl.includes("worldbank.org"),
  },
  { id: "imf", label: "IMF", test: (m) => /imf|weo/i.test(m.sourceName + m.description) },
  { id: "rest", label: "REST Countries", test: () => false },
  { id: "sau", label: "Sea Around Us", test: () => false },
  { id: "wikidata", label: "Wikidata", test: () => false },
  { id: "marine", label: "Marine Regions", test: () => false },
  { id: "ilo", label: "ILO", test: (m) => /ilo/i.test(m.sourceName + m.description) },
  { id: "who", label: "WHO", test: (m) => /who|world health/i.test(m.sourceName + m.description) },
  { id: "un", label: "UN", test: (m) => /\bun\b|united nations|wpp/i.test(m.sourceName + m.description) },
  { id: "fao", label: "FAO", test: (m) => /fao|food and agriculture/i.test(m.sourceName + m.description) },
  { id: "unesco", label: "UNESCO", test: (m) => /unesco|uis/i.test(m.sourceName + m.description) },
  {
    id: "unodc",
    label: "UNODC",
    test: (m) => /unodc|homicide|drugs and crime/i.test(m.sourceName + m.description),
  },
  {
    id: "idmc",
    label: "IDMC",
    test: (m) => /idmc|displacement monitoring/i.test(m.sourceName + m.description),
  },
  {
    id: "ucdp",
    label: "UCDP",
    test: (m) => /ucdp|uppsala conflict/i.test(m.sourceName + m.description),
  },
  {
    id: "wgi",
    label: "WGI",
    test: (m) => /governance indicators|wgi/i.test(m.sourceName + m.description),
  },
];

export function metricSourceLinks(m: MetricDef): { name: string; url: string }[] {
  const links: { name: string; url: string }[] = [{ name: m.sourceName, url: m.sourceUrl }];
  if (/imf|weo/i.test(m.sourceName + m.description) && !m.sourceUrl.includes("imf.org")) {
    links.push({
      name: "IMF World Economic Outlook",
      url: "https://www.imf.org/en/Publications/WEO",
    });
  }
  if (m.uisIndicatorId) {
    links.push({
      name: `UNESCO UIS (${m.uisIndicatorId})`,
      url: "https://api.uis.unesco.org/api/public/documentation/",
    });
  }
  return links;
}

export function filterMetrics(
  metrics: MetricDef[],
  query: string,
  selectedSources: Set<string>
): MetricDef[] {
  const q = query.trim().toLowerCase();
  return metrics.filter((m) => {
    if (q) {
      const hay = `${m.label} ${m.shortLabel ?? ""} ${m.description} ${m.formula ?? ""} ${m.sourceName} ${m.worldBankCode}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (selectedSources.size > 0) {
      const matches = [...selectedSources].some((id) => {
        const def = SOURCE_CHIP_DEFS.find((d) => d.id === id);
        return def?.test(m);
      });
      if (!matches) return false;
    }
    return true;
  });
}
