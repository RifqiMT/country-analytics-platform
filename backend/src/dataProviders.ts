/**
 * Canonical list of external institutions and APIs used by the platform.
 * Shown in the UI (`/api/data-providers`) and summarized in the README.
 */
type DataProvider = {
  id: string;
  institution: string;
  name: string;
  role: string;
  url: string;
  /** Lower = earlier in the time-series merge pipeline (if applicable). */
  seriesMergeOrder?: number;
  usedFor: string[];
  notes?: string;
};

/** Order for country-level indicator series: primary WDI → alternate WDI code → IMF WEO (per metric). */
const SERIES_MERGE_PIPELINE =
  "World Bank WDI (primary) → WDI alternate code (fallbackWorldBankCode) → IMF WEO DataMapper (imfWeoIndicator) → UNESCO UIS Data API (uisIndicatorId, selected education metrics); only null years are filled at each step. After that, the API may derive values from other series in the same year: GDP ÷ population for per-capita metrics; one missing population age-band share from the other two; out-of-school rates from 100% minus adjusted net or gross enrollment where direct OOSC is null; life expectancy and under-five mortality from the mean of male and female WDI series when the total is null. Then: short terminal carry-forward, range completion (edge fill / interpolation / step), optional WLD world-aggregate proxy, and % clamping where applicable. Each yearly point may include a `provenance` field (`reported`, `imf_weo`, `interpolated`, `wld_proxy`, etc.) for audit trails and chart tooltips. Global Analytics tables compose multi-year country×metric matrices via `backend/src/globalData/` (WDI range → IMF bulk range → UIS range → WHO GHO for UHC service coverage when the live WDI series is archived).";

const DATA_PROVIDERS: DataProvider[] = [
  {
    id: "wb-wdi",
    institution: "World Bank",
    name: "World Development Indicators (WDI) API",
    role: "Primary time series for financial, demographic, health, education, and labour metrics",
    url: "https://data.worldbank.org/",
    seriesMergeOrder: 1,
    usedFor: [
      "Country dashboard charts and KPIs",
      "Global map/table snapshots",
      "Correlation and comparison tables",
    ],
    notes: "Indicators are paginated per country; responses are cached server-side. UNESCO UIS, WHO, UN, UNODC, IDMC, UCDP, ILO, and FAO series that the Bank republishes are consumed here as WDI indicator codes.",
  },
  {
    id: "wb-wdi-alt",
    institution: "World Bank",
    name: "WDI — alternate indicator code (per metric)",
    role: "Second WDI series merged only into years still null after the primary code",
    url: "https://data.worldbank.org/",
    seriesMergeOrder: 2,
    usedFor: ["Metrics that define `fallbackWorldBankCode` in `metrics.ts`"],
    notes: "Same API as primary WDI; applied in `worldBank.mergeSeries` after the primary fetch.",
  },
  {
    id: "wb-country",
    institution: "World Bank",
    name: "Country API (income level, region, capital)",
    role: "Country metadata aligned with WDI economy codes",
    url: "https://datahelpdesk.worldbank.org/knowledgebase/articles/898590-country-api-queries",
    usedFor: [
      "Dashboard “Income level” (operational group + WB code) and World Bank-aligned country facts",
      "Cross-linked in-app with WDI GNI per capita (Atlas, NY.GNP.PCAP.CD) as the published magnitude behind classifications",
    ],
    notes: "Complements REST Countries (which does not supply WB income groups); uses the same ISO3 identifiers as WDI where possible.",
  },
  {
    id: "imf-weo",
    institution: "IMF",
    name: "World Economic Outlook — DataMapper JSON API",
    role: "Gap-fill for selected macro series after WDI",
    url: "https://www.imf.org/external/datamapper/api/v1",
    seriesMergeOrder: 3,
    usedFor: ["General government gross debt (% of GDP) where WDI codes are null", "Any future metrics wired with imfWeoIndicator"],
    notes: "Merged only into years that remain null after primary and optional secondary WDI codes.",
  },
  {
    id: "unesco-uis-api",
    institution: "UNESCO Institute for Statistics",
    name: "UIS Data API (public JSON)",
    role: "Targeted gap-fill for selected SDG 4–style indicators after WDI + IMF",
    url: "https://api.uis.unesco.org/api/public/documentation/",
    seriesMergeOrder: 4,
    usedFor: [
      "Out-of-school rates (ROFST.*)",
      "Completion / graduation proxies (CR.*, GGR.*)",
      "Adult literacy GALP series (LR.GALP.AG15T99)",
    ],
    notes: "Configured per metric via `uisIndicatorId` in `metrics.ts`. WDI values always take precedence when present. Global tables use `fetchUisGlobalMatrixForRange` for bulk year×country fills.",
  },
  {
    id: "who-gho",
    institution: "World Health Organization (WHO)",
    name: "Global Health Observatory (GHO) OData API",
    role: "Gap-fill for UHC service coverage when the live WDI series is archived",
    url: "https://www.who.int/data/gho",
    seriesMergeOrder: 5,
    usedFor: [
      "UHC service coverage index (`uhc_service_coverage` → GHO `UHC_INDEX_REPORTED`)",
      "Global map/table and country series enrichment for UHC",
    ],
    notes: "Azure-hosted OData API (`ghoapi.azureedge.net`). Wired by metric id `uhc_service_coverage` (not a generic catalog field). Merged only into null cells after WDI/IMF/UIS. Cached as `who:gho:{indicator}:{year}`.",
  },
  {
    id: "rest-countries",
    institution: "REST Countries",
    name: "REST Countries v3.1",
    role: "Geography, flags, currencies, time zones, UN M.49 codes, landlocked flag",
    url: "https://restcountries.com/",
    usedFor: ["Country picker", "General panel (capital, currency, area, region)", "WLD/global tables — region labels"],
    notes: "The `/all` endpoint allows at most 10 `fields` per request; the backend loads multiple field sets in parallel and merges. The `government` field is often empty in v3.1 — see Wikidata enrichment.",
  },
  {
    id: "sea-around-us",
    institution: "Sea Around Us (University of British Columbia)",
    name: "Sea Around Us EEZ API",
    role: "Exclusive economic zone area (km²) where a UN M.49–keyed polygon exists",
    url: "https://www.seaaroundus.org/",
    usedFor: ["Dashboard EEZ card when `/api/v1/eez/{code}` returns data"],
    notes: "Respect SAU citation and use policies. Many large economies are missing from this API path; the backend falls back to a static reference table for common ISO3 codes.",
  },
  {
    id: "wikidata",
    institution: "Wikidata",
    name: "Wikidata Query Service",
    role: "Enrichment when REST Countries omits government / head-of-government context",
    url: "https://www.wikidata.org/",
    usedFor: ["Government type (P122) and head-of-government office (P1313) on `/api/country/:cca3`"],
    notes: "SPARQL results are cached; not used for financial or official statistical series.",
  },
  {
    id: "unesco-uis",
    institution: "UNESCO Institute for Statistics (UIS)",
    name: "UIS (via WDI + targeted API)",
    role: "Most education statistics through WDI; seven metrics also call the public UIS Data API for null years",
    url: "https://uis.unesco.org/",
    usedFor: ["Enrollment, completion, literacy, and related education metrics in the metric catalog"],
    notes: "See also `unesco-uis-api` for the explicit fallback chain on oosc_*, completion_*, school_primary_completion, and literacy_adult.",
  },
  {
    id: "unodc-wdi",
    institution: "UN Office on Drugs and Crime (UNODC)",
    name: "International Homicide Statistics (via WDI)",
    role: "Intentional homicide rates — total, male, and female",
    url: "https://dataunodc.un.org/",
    usedFor: ["Crime dashboard charts", "Global map/table for homicide metrics"],
    notes: "Republished in World Bank WDI as VC.IHR.PSRC.* series. Primary source for SDG 16.1.1 intentional homicide indicator.",
  },
  {
    id: "wgi-wdi",
    institution: "World Bank",
    name: "Worldwide Governance Indicators (via WDI)",
    role: "Rule of law, political stability, and corruption control estimates",
    url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators",
    usedFor: ["Crime & safety context metrics in dashboard and global table"],
    notes: "GOV_WGI_* estimate series in WDI; composite scores from surveys and expert assessments.",
  },
];

export function listDataProvidersResponse() {
  return {
    seriesMergePipeline: SERIES_MERGE_PIPELINE,
    providers: [...DATA_PROVIDERS].sort((a, b) => {
      const ao = a.seriesMergeOrder ?? 99;
      const bo = b.seriesMergeOrder ?? 99;
      if (ao !== bo) return ao - bo;
      return a.institution.localeCompare(b.institution);
    }),
  };
}
