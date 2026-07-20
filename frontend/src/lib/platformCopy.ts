/** Official data providers surfaced in product copy (order = display priority). */
export const PLATFORM_DATA_SOURCES = [
  "World Bank",
  "IMF",
  "UN",
  "WHO",
  "UNESCO",
  "ILO",
] as const;

const PLATFORM_YEAR_RANGE = "2000 through the latest available year";

/** Expanded platform description for mobile About panel and marketing surfaces. */
export const APP_TAGLINE_LEAD =
  "One workspace to explore how countries perform on the metrics analysts rely on every day.";

export const APP_TAGLINE_DETAIL = `Each indicator spans ${PLATFORM_YEAR_RANGE}. Data is pulled from public institutions, harmonised on the server, and presented so you can compare countries fairly.`;

export type PageIntroCopy = {
  eyebrow?: string;
  title: string;
  lead: string;
  detail?: string;
  highlights?: string[];
};

export const PAGE_INTRO: Record<
  "global" | "pestel" | "porter" | "business" | "assistant" | "sources",
  PageIntroCopy
> = {
  global: {
    eyebrow: "Cross-country view",
    title: "Global analytics",
    lead:
      "Compare every country on the same indicators, then move between map, table, and world charts.",
    detail:
      "Choose a year and region, pick a map metric, or open the country table by theme. All views use the same harmonised pipeline as the country dashboard so rankings stay consistent.",
    highlights: ["Interactive map", "Sortable table", "World charts"],
  },
  pestel: {
    eyebrow: "Macro environment",
    title: "PESTEL analysis",
    lead:
      "Review the political, economic, social, technological, environmental, and legal forces shaping a country.",
    detail:
      "The report pairs platform time series with SWOT, strategic implications, and practical recommendations. Live web search can fill gaps when Tavily is configured.",
    highlights: ["Six PESTEL pillars", "SWOT matrix", "Actionable recommendations"],
  },
  porter: {
    eyebrow: "Industry structure",
    title: "Porter five forces",
    lead:
      "Assess how attractive an industry is inside the country you select, force by force.",
    detail:
      "Choose a country and an ILO-ISIC sector. The report draws on platform indicators and can add live web context or LLM reasoning when API keys are configured.",
    highlights: ["Sector-specific", "Country context", "Actionable brief"],
  },
  business: {
    eyebrow: "Market positioning",
    title: "Business analytics",
    lead:
      "Plot countries on two metrics at once. Each point on the chart represents one country in a given year.",
    detail:
      "Use correlation views and narrative summaries to identify clusters, outliers, and relationships. You control the year range and metric pairing while the same harmonised dataset powers the dashboard.",
    highlights: ["Scatter and correlation", "Multi-country", "Narrative insights"],
  },
  assistant: {
    eyebrow: "Guided research",
    title: "Analytics assistant",
    lead:
      "Ask questions in plain English and receive answers grounded in the same data shown on the dashboard.",
    detail:
      "For numbers and rankings, replies anchor to World Bank WDI and configured extensions. For news and broader context, the assistant can combine live web retrieval when Tavily is configured.",
    highlights: ["Dashboard-grounded metrics", "Optional web search", "Analyst-style prose"],
  },
  sources: {
    eyebrow: "Reference",
    title: "Data sources and methodology",
    lead:
      "Every metric is fully documented: its source institution, calculation method, and guidance on how to interpret it.",
    detail:
      "Browse the complete indicator dictionary with World Bank codes, plain-English formulas, and direct links to the originating provider.",
    highlights: ["Provider links", "Metric formulas", "Searchable dictionary"],
  },
};
