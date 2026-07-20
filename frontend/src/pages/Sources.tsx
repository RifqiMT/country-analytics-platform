import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import AccordionSection from "../components/dashboard/AccordionSection";
import SourceMetricCard from "../components/sources/SourceMetricCard";
import SourceProviderCard from "../components/sources/SourceProviderCard";
import SourcesFilterPanel from "../components/sources/SourcesFilterPanel";
import SourcesHero from "../components/sources/SourcesHero";
import SourcesLoadingState from "../components/sources/SourcesLoadingState";
import SourcesSectionNav from "../components/sources/SourcesSectionNav";
import {
  CATEGORY_ACCENT,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  filterMetrics,
  SOURCE_CHIP_DEFS,
  SOURCES_SECTION_IDS,
} from "../components/sources/sourcesConstants";
import {
  COUNTRY_COMPARISON_METHODOLOGY_ID,
  COUNTRY_COMPARISON_METHODOLOGY_SECTIONS,
} from "../lib/countryComparisonMethodology";
import { getJson, type DataProvidersPayload, type MetricDef } from "../api";

const USAGE_SECTIONS = [
  {
    title: "Country Dashboard",
    body: "Summary KPI cards, timeline accordions (Financial, Population, Macro, Unemployment), and the country comparison table. Some territories use alternate ISO mappings or proxy series where WDI coverage is partial. Exchange-rate display (1 USD = …) uses ECB daily quotes first, then falls back to World Bank official annual FX (PA.NUS.FCRF) with source/date shown in the UI.",
  },
  {
    title: "Global Analytics (Map, Table, Charts)",
    body: "Region filters apply to the map and table. Choropleth metrics mirror core global financial and demographic indicators from the catalog. Map shapes come from world-atlas; the app resolves each polygon to ISO3 using REST Countries plus World Bank country labels. The global table groups columns by category. EEZ area comes from Sea Around Us plus a bundled reference table.",
  },
  {
    title: "Global Charts",
    body: "Aggregated world (WLD) time series for macro and thematic comparisons across years.",
  },
  {
    title: "PESTEL & Porter's Five Forces",
    body: "Narrative sections use an LLM when API keys are configured, grounded on dashboard series and optional web search; otherwise structured data-only templates from World Bank bundles and REST Countries metadata.",
  },
  {
    title: "Business Analytics",
    body: "Multi-metric scatter plots over country–year observations; Pearson correlation coefficients, regression lines, residual plots, and subgroup summaries are computed in the API from the same indicator definitions as elsewhere.",
  },
  {
    title: "Analytics Assistant",
    body: "Injects latest dashboard metrics for a focus country when provided, optional Tavily web context, and Groq for synthesis, with source lines echoed in the chat.",
  },
] as const;

export default function Sources() {
  const location = useLocation();
  const [metrics, setMetrics] = useState<MetricDef[]>([]);
  const [dataProviders, setDataProviders] = useState<DataProvidersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      getJson<MetricDef[]>("/api/metrics"),
      getJson<DataProvidersPayload>("/api/data-providers"),
    ])
      .then(([m, p]) => {
        setMetrics(m);
        setDataProviders(p);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (location.hash !== `#${COUNTRY_COMPARISON_METHODOLOGY_ID}`) return;
    const usageEl = document.getElementById(SOURCES_SECTION_IDS.usage);
    if (usageEl instanceof HTMLDetailsElement) usageEl.open = true;
    const timer = window.setTimeout(() => {
      document.getElementById(COUNTRY_COMPARISON_METHODOLOGY_ID)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  const activeChips = useMemo(() => {
    return SOURCE_CHIP_DEFS.filter(
      (c) =>
        c.id === "rest" ||
        c.id === "sau" ||
        c.id === "marine" ||
        c.id === "wikidata" ||
        metrics.some(c.test)
    );
  }, [metrics]);

  const filtered = useMemo(
    () => filterMetrics(metrics, query, selectedSources),
    [metrics, query, selectedSources]
  );

  const byCat = useMemo(() => {
    const acc: Record<string, MetricDef[]> = {};
    for (const m of filtered) {
      acc[m.category] = acc[m.category] ?? [];
      acc[m.category].push(m);
    }
    return acc;
  }, [filtered]);

  const hasActiveFilters = query.trim().length > 0 || selectedSources.size > 0;

  const categoriesWithResults = useMemo(
    () => CATEGORY_ORDER.filter((cat) => (byCat[cat]?.length ?? 0) > 0),
    [byCat]
  );

  const navItems = useMemo(() => {
    const items = [];
    if (dataProviders) {
      items.push({ id: SOURCES_SECTION_IDS.providers, label: "Providers" });
    }
    items.push({ id: SOURCES_SECTION_IDS.usage, label: "Usage" });
    items.push({ id: SOURCES_SECTION_IDS.catalog, label: "Dictionary" });
    return items;
  }, [dataProviders]);

  const toggleChip = (id: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setQuery("");
    setSelectedSources(new Set());
  };

  if (loading) return <SourcesLoadingState />;

  return (
    <div className="space-y-6 lg:space-y-8">
      <SourcesHero
        metricCount={metrics.length}
        providerCount={dataProviders?.providers.length ?? 0}
        categoryCount={categoriesWithResults.length || CATEGORY_ORDER.length}
        filteredCount={filtered.length}
        hasActiveFilters={hasActiveFilters}
      />

      <SourcesSectionNav items={navItems} />

      {dataProviders ? (
        <AccordionSection
          id={SOURCES_SECTION_IDS.providers}
          title="Provider stack & merge pipeline"
          subtitle="Institutions, APIs, and how time-series are merged"
          accent="teal"
          defaultOpen={false}
        >
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Country time-series merge order
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{dataProviders.seriesMergePipeline}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dataProviders.providers.map((p) => (
              <SourceProviderCard key={p.id} provider={p} />
            ))}
          </div>
        </AccordionSection>
      ) : null}

      <AccordionSection
        id={SOURCES_SECTION_IDS.usage}
        title="Where metrics appear"
        subtitle="Dashboard, global analytics, PESTEL, business tools & assistant"
        accent="indigo"
        defaultOpen={location.hash === `#${COUNTRY_COMPARISON_METHODOLOGY_ID}`}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {USAGE_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300"
            >
              <p className="text-sm font-semibold text-slate-900">{section.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{section.body}</p>
            </div>
          ))}
        </div>

        <div
          id={COUNTRY_COMPARISON_METHODOLOGY_ID}
          className="mt-4 scroll-mt-24 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5"
        >
          <p className="text-sm font-semibold text-slate-900">Country comparison table — how columns are built</p>
          <p className="mt-1 text-xs text-slate-500">
            Values in the dashboard comparison table (your country vs avg country vs global) use these rules at your
            selected snapshot year.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {COUNTRY_COMPARISON_METHODOLOGY_SECTIONS.map((section) => (
              <div key={section.title}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{section.title}</p>
                <ul className="mt-2 space-y-1.5">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-slate-600">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </AccordionSection>

      <section id={SOURCES_SECTION_IDS.catalog} className="scroll-mt-24 space-y-3">
        <SourcesFilterPanel
          query={query}
          onQueryChange={setQuery}
          chips={activeChips}
          selectedSources={selectedSources}
          onToggleChip={toggleChip}
          onClearFilters={clearFilters}
          resultCount={filtered.length}
          totalCount={metrics.length}
        />

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No metrics match your filters</p>
            <p className="mt-1 text-xs text-slate-500">Try a different search term or clear provider filters.</p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const list = byCat[cat];
            if (!list?.length) return null;
            return (
              <AccordionSection
                key={cat}
                id={`sources-cat-${cat}`}
                title={CATEGORY_LABEL[cat] ?? cat}
                subtitle={`${list.length} indicator${list.length === 1 ? "" : "s"}`}
                accent={CATEGORY_ACCENT[cat] ?? "slate"}
                defaultOpen={hasActiveFilters || cat === "general"}
              >
                <div className="space-y-3">
                  {list.map((m) => (
                    <SourceMetricCard key={m.id} metric={m} />
                  ))}
                </div>
              </AccordionSection>
            );
          })
        )}
      </section>
    </div>
  );
}
