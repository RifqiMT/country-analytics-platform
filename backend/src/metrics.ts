type MetricCategory =
  | "general"
  | "financial"
  | "health"
  | "education"
  | "labour"
  | "demographics"
  | "crime";

export interface MetricDef {
  id: string;
  label: string;
  unit: string;
  category: MetricCategory;
  worldBankCode: string;
  /** Secondary WB code tried if primary is empty */
  fallbackWorldBankCode?: string;
  /** IMF DataMapper indicator id (WEO); merged after WB primary + fallback for null years */
  imfWeoIndicator?: string;
  /** Multiply IMF DataMapper values (e.g. 1e9 when the series is in billions of US$). */
  imfWeoScale?: number;
  /** UNESCO UIS Data API indicator id; merged after WB (+ IMF) for null years only */
  uisIndicatorId?: string;
  formula?: string;
  sourceUrl: string;
  sourceName: string;
  description: string;
}

export const METRICS: MetricDef[] = [
  {
    id: "gdp",
    label: "GDP (Nominal, US$)",
    unit: "US$",
    category: "financial",
    worldBankCode: "NY.GDP.MKTP.CD",
    imfWeoIndicator: "NGDPD",
    imfWeoScale: 1_000_000_000,
    sourceName: "World Bank WDI; IMF WEO (NGDPD, billions US$) for gaps",
    sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD",
    description:
      "The total value of goods and services produced within a country, expressed in current US dollars. Where the World Bank series has a missing year, the platform may use IMF World Economic Outlook nominal GDP (NGDPD), converted from billions of US dollars.",
    formula: "GDP = consumption + investment + government spending + (exports − imports)",
  },
  {
    id: "gdp_per_capita",
    label: "GDP per capita (Nominal, US$)",
    unit: "US$",
    category: "financial",
    worldBankCode: "NY.GDP.PCAP.CD",
    imfWeoIndicator: "NGDPDPC",
    sourceName: "World Bank WDI; IMF WEO (NGDPDPC) for gaps",
    sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.PCAP.CD",
    description:
      "Average economic output per person, calculated as total GDP divided by midyear population in current US dollars. Missing World Bank values may be supplemented with IMF WEO GDP per capita at current prices (NGDPDPC).",
    formula: "GDP per capita = GDP ÷ population",
  },
  {
    id: "gdp_growth",
    label: "GDP growth (annual %)",
    unit: "%",
    category: "financial",
    worldBankCode: "NY.GDP.MKTP.KD.ZG",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG",
    description:
      "The annual percentage change in real (inflation-adjusted) gross domestic product, showing how quickly the economy is expanding or contracting from one year to the next.",
    formula: "GDP growth (%) = ((real GDP this year − real GDP prior year) ÷ real GDP prior year) × 100",
  },
  {
    id: "population",
    label: "Population, total",
    unit: "people",
    category: "demographics",
    worldBankCode: "SP.POP.TOTL",
    imfWeoIndicator: "LP",
    imfWeoScale: 1_000_000,
    sourceName: "World Bank WDI; IMF WEO population (LP, millions) for gaps",
    sourceUrl: "https://data.worldbank.org/indicator/SP.POP.TOTL",
    description:
      "The total number of people living in the country, based on national censuses and United Nations population projections. Where World Bank data is missing, IMF WEO population (LP) may be used, converted from millions of people.",
  },
  {
    id: "gov_debt_pct_gdp",
    label: "Central government debt, total (% of GDP)",
    unit: "% of GDP",
    category: "financial",
    worldBankCode: "GC.DOD.TOTL.GD.ZS",
    // Do NOT use GC.DOD.TOTL.CN here — that is a local-currency debt *level*, not a %.
    imfWeoIndicator: "GGXWDG_NGDP",
    sourceName: "World Bank WDI; IMF WEO (DataMapper) for gaps",
    sourceUrl: "https://data.worldbank.org/indicator/GC.DOD.TOTL.GD.ZS",
    description:
      "Central government debt expressed as a percentage of gross domestic product, indicating the scale of public borrowing relative to the size of the economy. Missing years may be filled from IMF WEO general government gross debt (GGXWDG_NGDP).",
    formula: "Debt (% of GDP) = (government debt ÷ GDP) × 100",
  },
  {
    id: "inflation",
    label: "Inflation, consumer prices (annual %)",
    unit: "%",
    category: "financial",
    worldBankCode: "FP.CPI.TOTL.ZG",
    imfWeoIndicator: "PCPIPCH",
    sourceName: "World Bank WDI; IMF WEO (PCPIPCH) for gaps",
    sourceUrl: "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG",
    description:
      "The annual rate of change in consumer prices, commonly used to track the cost of living and changes in purchasing power. Where World Bank CPI data is unavailable, IMF WEO average consumer price inflation (PCPIPCH) may supplement the series.",
    formula: "Inflation (%) ≈ ((CPI this year − CPI prior year) ÷ CPI prior year) × 100",
  },
  {
    id: "interest_real",
    label: "Real interest rate (%)",
    unit: "%",
    category: "financial",
    worldBankCode: "FR.INR.RINR",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/FR.INR.RINR",
    description:
      "The interest rate adjusted for inflation, reflecting the real return on saving or the real cost of borrowing once price changes are taken into account.",
    formula: "Real interest rate (%) ≈ nominal interest rate − inflation rate",
  },
  {
    id: "unemployment_ilo",
    label: "Unemployment, total (% of labour force) — modeled ILO",
    unit: "%",
    category: "labour",
    worldBankCode: "SL.UEM.TOTL.ZS",
    fallbackWorldBankCode: "SL.UEM.TOTL.NE.ZS",
    imfWeoIndicator: "LUR",
    sourceName: "World Bank WDI / ILO modeled; IMF WEO (LUR) for gaps",
    sourceUrl: "https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS",
    description:
      "The share of the labour force that is without work, available to work, and actively seeking employment, using ILO-modelled estimates. When the primary series is missing, national estimates or IMF WEO unemployment (LUR) may be used.",
    formula: "Unemployment rate (%) = (unemployed ÷ labour force) × 100",
  },
  {
    id: "poverty_headcount",
    label: "Poverty headcount ratio at $2.15 a day (2017 PPP)",
    unit: "%",
    category: "financial",
    worldBankCode: "SI.POV.DDAY",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SI.POV.DDAY",
    description:
      "The percentage of the population living on less than US$2.15 per day at 2017 purchasing power parity—the World Bank's international extreme poverty line.",
    formula: "Poverty headcount (%) = (people below poverty line ÷ total population) × 100",
  },
  {
    id: "life_expectancy",
    label: "Life expectancy at birth, total (years)",
    unit: "years",
    category: "health",
    worldBankCode: "SP.DYN.LE00.IN",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SP.DYN.LE00.IN",
    description:
      "The average number of years a newborn would be expected to live if current age-specific mortality patterns continued throughout their life. When the combined total is unavailable, male and female series may be averaged.",
  },
  {
    id: "mortality_under5",
    label: "Mortality rate, under-5 (per 1,000 live births)",
    unit: "per 1,000",
    category: "health",
    worldBankCode: "SH.DYN.MORT",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SH.DYN.MORT",
    description:
      "The probability that a child will die before reaching age five, expressed per 1,000 live births. When the total rate is missing, male and female rates may be averaged.",
    formula: "Under-five mortality = (deaths under age 5 ÷ live births) × 1,000",
  },
  {
    id: "literacy_adult",
    label: "Literacy rate, adult total (% ages 15+)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.ADT.LITR.ZS",
    uisIndicatorId: "LR.GALP.AG15T99",
    sourceName: "World Bank WDI; UNESCO UIS API (gap-fill)",
    sourceUrl: "https://data.worldbank.org/indicator/SE.ADT.LITR.ZS",
    description:
      "The percentage of people aged 15 and over who can read and write a short, simple statement about everyday life. Missing years may be supplemented with UNESCO UIS model estimates (LR.GALP.AG15T99).",
    formula: "Literacy rate (%) = (literate adults aged 15+ ÷ adult population aged 15+) × 100",
  },
  {
    id: "school_primary_completion",
    label: "Primary completion rate, total (% of relevant age group)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.PRM.CMPT.ZS",
    uisIndicatorId: "CR.1",
    sourceName: "World Bank WDI; UNESCO UIS API (gap-fill)",
    sourceUrl: "https://data.worldbank.org/indicator/SE.PRM.CMPT.ZS",
    description:
      "The share of children of primary graduation age who have completed the final grade of primary school. World Bank and UNESCO UIS (CR.1) definitions may differ slightly; UIS data is used only to fill gaps.",
    formula: "Completion rate (%) = (graduates of final primary grade ÷ primary graduation-age population) × 100",
  },
  {
    id: "enrollment_secondary",
    label: "School enrollment, secondary (% gross)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.SEC.ENRR",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.SEC.ENRR",
    description:
      "Total enrolment in secondary education as a percentage of the official secondary school-age population, including students who may be older or younger than the typical age group.",
    formula: "Gross enrolment (%) = (total secondary enrolment ÷ secondary school-age population) × 100",
  },
  {
    id: "teachers_primary",
    label: "Pupil-teacher ratio, primary",
    unit: "pupils per teacher",
    category: "education",
    worldBankCode: "SE.PRM.ENRL.TC.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.PRM.ENRL.TC.ZS",
    description:
      "The average number of pupils per teacher in primary education—a common measure of classroom capacity and teaching resources.",
    formula: "Pupil–teacher ratio = total primary pupils ÷ total primary teachers",
  },
  {
    id: "labour_force_participation",
    label: "Labor force participation rate, total (% pop 15+)",
    unit: "%",
    category: "labour",
    worldBankCode: "SL.TLF.ACTI.ZS",
    sourceName: "World Bank WDI / ILO modeled",
    sourceUrl: "https://data.worldbank.org/indicator/SL.TLF.ACTI.ZS",
    description:
      "The percentage of the population aged 15 and over that is either employed or actively seeking work.",
    formula: "Participation rate (%) = (labour force ÷ population aged 15+) × 100",
  },
  {
    id: "pop_age_0_14",
    label: "Population ages 0-14 (% of total)",
    unit: "%",
    category: "demographics",
    worldBankCode: "SP.POP.0014.TO.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SP.POP.0014.TO.ZS",
    description:
      "The share of the total population aged under 15 years, often used as a broad indicator of youth dependency.",
    formula: "Share (%) = (population aged 0–14 ÷ total population) × 100",
  },
  {
    id: "pop_age_65_plus",
    label: "Population ages 65+ (% of total)",
    unit: "%",
    category: "demographics",
    worldBankCode: "SP.POP.65UP.TO.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SP.POP.65UP.TO.ZS",
    description:
      "The share of the total population aged 65 and over, commonly used to assess population aging and elderly dependency.",
    formula: "Share (%) = (population aged 65+ ÷ total population) × 100",
  },
  {
    id: "gdp_ppp",
    label: "GDP (PPP, Intl$)",
    unit: "Intl$",
    category: "financial",
    worldBankCode: "NY.GDP.MKTP.PP.CD",
    imfWeoIndicator: "PPPGDP",
    imfWeoScale: 1_000_000_000,
    sourceName: "World Bank WDI; IMF WEO (PPPGDP, billions intl$) for gaps",
    sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.PP.CD",
    description:
      "Total economic output converted to international dollars using purchasing power parity (PPP) exchange rates, allowing more meaningful cross-country comparisons of living standards. Missing World Bank values may be supplemented with IMF WEO PPP GDP (PPPGDP).",
    formula: "GDP (PPP) = GDP in local currency × PPP conversion factor",
  },
  {
    id: "gdp_per_capita_ppp",
    label: "GDP per capita (PPP, Intl$)",
    unit: "Intl$",
    category: "financial",
    worldBankCode: "NY.GDP.PCAP.PP.CD",
    imfWeoIndicator: "PPPPC",
    sourceName: "World Bank WDI; IMF WEO (PPPPC) for gaps",
    sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.CD",
    description:
      "Average economic output per person in international dollars at PPP, adjusting for differences in price levels between countries. Missing years may use IMF WEO GDP per capita at PPP (PPPPC).",
    formula: "GDP per capita (PPP) = GDP (PPP) ÷ population",
  },
  {
    id: "gni_per_capita_atlas",
    label: "GNI per capita, Atlas method (current US$)",
    unit: "US$",
    category: "financial",
    worldBankCode: "NY.GNP.PCAP.CD",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/NY.GNP.PCAP.CD",
    description:
      "Average gross national income per person using the World Bank Atlas method and current US dollars. This series underpins the Bank's operational income classifications (low, lower-middle, upper-middle, and high income).",
    formula: "GNI per capita = gross national income ÷ midyear population",
  },
  {
    id: "gov_debt_usd",
    label: "Central government debt, total (current US$)",
    unit: "US$",
    category: "financial",
    worldBankCode: "GC.DOD.TOTL.CD",
    sourceName: "World Bank WDI; derived where level series is missing",
    sourceUrl: "https://data.worldbank.org/indicator/GC.DOD.TOTL.CD",
    description:
      "The outstanding stock of central government debt in current US dollars. When the direct level series is unavailable, debt in US dollars may be estimated from the debt-to-GDP ratio and nominal GDP.",
    formula: "Debt (US$) ≈ (debt % of GDP ÷ 100) × nominal GDP (US$)",
  },
  {
    id: "lending_rate",
    label: "Lending interest rate (%)",
    unit: "%",
    category: "financial",
    worldBankCode: "FR.INR.LEND",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/FR.INR.LEND",
    description:
      "The average interest rate charged by banks on loans to prime (low-risk) customers, reflecting the general cost of borrowing in the financial system.",
  },
  {
    id: "poverty_national",
    label: "Poverty headcount ratio at national poverty lines (% of population)",
    unit: "%",
    category: "financial",
    worldBankCode: "SI.POV.NAHC",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SI.POV.NAHC",
    description:
      "The percentage of the population living below each country's own nationally defined poverty line, which reflects local costs and social standards.",
    formula: "Poverty headcount (%) = (people below national poverty line ÷ total population) × 100",
  },
  {
    id: "maternal_mortality",
    label: "Maternal mortality ratio (per 100,000 live births)",
    unit: "per 100,000",
    category: "health",
    worldBankCode: "SH.STA.MMRT",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SH.STA.MMRT",
    description:
      "The number of women who die from pregnancy-related causes while pregnant or within 42 days of termination, per 100,000 live births.",
    formula: "Maternal mortality ratio = (maternal deaths ÷ live births) × 100,000",
  },
  {
    id: "undernourishment",
    label: "Prevalence of undernourishment (% of population)",
    unit: "%",
    category: "health",
    worldBankCode: "SN.ITK.DEFC.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SN.ITK.DEFC.ZS",
    description:
      "The proportion of the population whose food intake is insufficient to meet minimum dietary energy requirements over a year.",
    formula: "Prevalence (%) = (undernourished people ÷ total population) × 100",
  },
  {
    id: "birth_rate",
    label: "Birth rate, crude (per 1,000 people)",
    unit: "per 1,000",
    category: "health",
    worldBankCode: "SP.DYN.CBRT.IN",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SP.DYN.CBRT.IN",
    description:
      "The number of live births during a year per 1,000 people, based on midyear population estimates.",
    formula: "Crude birth rate = (live births ÷ midyear population) × 1,000",
  },
  {
    id: "tb_incidence",
    label: "Incidence of tuberculosis (per 100,000 people)",
    unit: "per 100,000",
    category: "health",
    worldBankCode: "SH.TBS.INCD",
    sourceName: "World Bank WDI (WHO Global TB Programme)",
    sourceUrl: "https://data.worldbank.org/indicator/SH.TBS.INCD",
    description:
      "The estimated number of new and relapse tuberculosis cases per 100,000 people, serving as a measure of TB morbidity in the population.",
    formula: "TB incidence = (new and relapse TB cases ÷ population) × 100,000",
  },
  {
    id: "uhc_service_coverage",
    label: "UHC service coverage index (0-100)",
    unit: "index",
    category: "health",
    worldBankCode: "SH.UHC.SRVS.CV.XD",
    sourceName: "WHO Global Health Observatory (SDG 3.8.1); World Bank WDI archive when available",
    sourceUrl: "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/uhc-index-of-service-coverage",
    description:
      "A composite index (0–100) measuring how well essential health services—such as reproductive, maternal, and infectious disease care—are covered for the population. The live WDI series is archived; the platform fills from WHO GHO UHC_INDEX_REPORTED.",
  },
  {
    id: "hospital_beds",
    label: "Hospital beds (per 1,000 people)",
    unit: "per 1,000",
    category: "health",
    worldBankCode: "SH.MED.BEDS.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SH.MED.BEDS.ZS",
    description:
      "The number of hospital beds available per 1,000 people, including general and specialised beds in public and private facilities.",
    formula: "Hospital beds per 1,000 = (total hospital beds ÷ population) × 1,000",
  },
  {
    id: "physicians_density",
    label: "Physicians (per 1,000 people)",
    unit: "per 1,000",
    category: "health",
    worldBankCode: "SH.MED.PHYS.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SH.MED.PHYS.ZS",
    description:
      "The number of medical doctors per 1,000 people, indicating the availability of physician-level health professionals.",
    formula: "Physicians per 1,000 = (total physicians ÷ population) × 1,000",
  },
  {
    id: "nurses_midwives_density",
    label: "Nurses and midwives (per 1,000 people)",
    unit: "per 1,000",
    category: "health",
    worldBankCode: "SH.MED.NUMW.P3",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SH.MED.NUMW.P3",
    description:
      "The number of professional nurses and midwives per 1,000 people, reflecting nursing capacity in the health system.",
    formula: "Nurses and midwives per 1,000 = (total nurses and midwives ÷ population) × 1,000",
  },
  {
    id: "immunization_dpt",
    label: "Immunization, DPT (% of children ages 12-23 months)",
    unit: "%",
    category: "health",
    worldBankCode: "SH.IMM.IDPT",
    sourceName: "World Bank WDI (WHO/UNICEF estimates)",
    sourceUrl: "https://data.worldbank.org/indicator/SH.IMM.IDPT",
    description:
      "The percentage of children aged 12–23 months who have received the recommended diphtheria, pertussis, and tetanus (DPT) vaccine doses.",
    formula: "DPT coverage (%) = (children aged 12–23 months with DPT doses ÷ children in cohort) × 100",
  },
  {
    id: "immunization_measles",
    label: "Immunization, measles (% of children ages 12-23 months)",
    unit: "%",
    category: "health",
    worldBankCode: "SH.IMM.MEAS",
    sourceName: "World Bank WDI (WHO/UNICEF estimates)",
    sourceUrl: "https://data.worldbank.org/indicator/SH.IMM.MEAS",
    description:
      "The percentage of children aged 12–23 months who have received at least one dose of measles-containing vaccine.",
    formula: "Measles coverage (%) = (children aged 12–23 months vaccinated ÷ children in cohort) × 100",
  },
  {
    id: "health_expenditure_gdp",
    label: "Current health expenditure (% of GDP)",
    unit: "% of GDP",
    category: "health",
    worldBankCode: "SH.XPD.CHEX.GD.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SH.XPD.CHEX.GD.ZS",
    description:
      "Total current spending on health care as a share of gross domestic product, including public and private sources.",
    formula: "Health expenditure (% of GDP) = (current health spending ÷ GDP) × 100",
  },
  {
    id: "smoking_prevalence",
    label: "Smoking prevalence, total (ages 15+)",
    unit: "%",
    category: "health",
    worldBankCode: "SH.PRV.SMOK",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SH.PRV.SMOK",
    description:
      "The percentage of people aged 15 and over who currently use any tobacco product on a daily or non-daily basis.",
    formula: "Smoking prevalence (%) = (current tobacco users aged 15+ ÷ population aged 15+) × 100",
  },
  {
    id: "oosc_primary",
    label: "Out-of-school rate for children of primary school age (%)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.PRM.OOSC.ZS",
    uisIndicatorId: "ROFST.1.CP",
    sourceName: "World Bank WDI; UNESCO UIS API (gap-fill)",
    sourceUrl: "https://data.worldbank.org/indicator/SE.PRM.OOSC.ZS",
    description:
      "The percentage of children of official primary school age who are not enrolled in primary or secondary education. UNESCO UIS data (ROFST.1.CP) may fill gaps; the global table may also derive an estimate from net enrolment when needed.",
    formula: "Out-of-school rate (%) = (primary-age children not in school ÷ primary school-age population) × 100",
  },
  {
    id: "oosc_secondary",
    label: "Out-of-school rate for adolescents of lower secondary school age (%)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.SEC.OOSC.ZS",
    uisIndicatorId: "ROFST.2.CP",
    sourceName: "World Bank WDI; UNESCO UIS API (gap-fill)",
    sourceUrl: "https://data.worldbank.org/indicator/SE.SEC.OOSC.ZS",
    description:
      "The percentage of adolescents of lower secondary school age who are not enrolled in school. Missing values may be supplemented with UNESCO UIS out-of-school rate (ROFST.2.CP).",
    formula: "Out-of-school rate (%) = (lower-secondary-age adolescents not in school ÷ relevant age population) × 100",
  },
  {
    id: "oosc_tertiary",
    label: "Out-of-school rate for youth of upper secondary school age (%)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.TER.OOSC.ZS",
    uisIndicatorId: "ROFST.3.CP",
    sourceName: "World Bank WDI; UNESCO UIS API (gap-fill)",
    sourceUrl: "https://data.worldbank.org/indicator/SE.TER.OOSC.ZS",
    description:
      "The percentage of youth of upper secondary school age who are not enrolled in school. UNESCO UIS (ROFST.3.CP) may fill gaps; tertiary enrolment may be used as a fallback in global views.",
    formula: "Out-of-school rate (%) = (upper-secondary-age youth not in school ÷ relevant age population) × 100",
  },
  {
    id: "completion_secondary",
    label: "Lower secondary completion rate, total (% of relevant age group)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.SEC.CMPT.ZS",
    uisIndicatorId: "CR.2",
    sourceName: "World Bank WDI; UNESCO UIS API (gap-fill)",
    sourceUrl: "https://data.worldbank.org/indicator/SE.SEC.CMPT.ZS",
    description:
      "The percentage of children of lower secondary graduation age who have completed the final grade of lower secondary education. UNESCO UIS completion rate (CR.2) may supplement missing years.",
    formula: "Completion rate (%) = (lower secondary graduates ÷ lower secondary graduation-age population) × 100",
  },
  {
    id: "completion_tertiary",
    label: "Gross graduation ratio, tertiary education",
    unit: "%",
    category: "education",
    worldBankCode: "SE.TER.GRAD.ZS",
    uisIndicatorId: "GGR.6T7",
    sourceName: "World Bank WDI; UNESCO UIS API (gap-fill)",
    sourceUrl: "https://data.worldbank.org/indicator/SE.TER.GRAD.ZS",
    description:
      "The gross graduation ratio from tertiary education programmes. UNESCO UIS (GGR.6T7) covers first-degree programmes (ISCED 6–7) and may differ slightly in scope from the World Bank series.",
    formula: "Graduation ratio (%) = (tertiary graduates ÷ relevant tertiary-age population) × 100",
  },
  {
    id: "reading_proficiency",
    label: "Learning poverty: reading (%)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.LPV.PRIM",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.LPV.PRIM",
    description:
      "The share of children at the end of primary school age who cannot read and understand a simple text—the World Bank's learning poverty measure for reading.",
    formula: "Learning poverty (%) = (children below minimum reading proficiency ÷ end-of-primary-age children) × 100",
  },
  {
    id: "gpi_primary",
    label: "GPI proxy — school enrollment, primary (gross), gender parity index",
    unit: "index",
    category: "education",
    worldBankCode: "SE.ENR.PRIM.FM.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.ENR.PRIM.FM.ZS",
    description:
      "The ratio of female to male gross primary enrolment. A value of 1.0 indicates gender parity; lower values suggest fewer girls enrolled relative to boys.",
    formula: "Gender parity index = female gross enrolment ÷ male gross enrolment",
  },
  {
    id: "gpi_secondary",
    label: "GPI proxy — school enrollment, secondary (gross), gender parity index",
    unit: "index",
    category: "education",
    worldBankCode: "SE.ENR.SEC.FM.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.ENR.SEC.FM.ZS",
    description:
      "The ratio of female to male gross secondary enrolment. A value of 1.0 indicates gender parity; lower values suggest fewer girls enrolled relative to boys.",
    formula: "Gender parity index = female gross enrolment ÷ male gross enrolment",
  },
  {
    id: "gpi_tertiary",
    label: "GPI proxy — school enrollment, tertiary (gross), gender parity index",
    unit: "index",
    category: "education",
    worldBankCode: "SE.ENR.TER.FM.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.ENR.TER.FM.ZS",
    description:
      "The ratio of female to male gross tertiary enrolment. A value of 1.0 indicates gender parity; lower values suggest fewer women enrolled relative to men.",
    formula: "Gender parity index = female gross enrolment ÷ male gross enrolment",
  },
  {
    id: "trained_teachers_pri",
    label: "Trained teachers in primary education (% of total teachers)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.PRM.TCAQ.LO.GE.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.PRM.TCAQ.LO.GE.ZS",
    description:
      "The percentage of primary teachers who meet the minimum national training or qualification standards required to teach at that level.",
    formula: "Trained teachers (%) = (qualified primary teachers ÷ total primary teachers) × 100",
  },
  {
    id: "trained_teachers_sec",
    label: "Trained teachers in lower secondary education (% of total teachers)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.SEC.TCAQ.LO.GE.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.SEC.TCAQ.LO.GE.ZS",
    description:
      "The percentage of lower secondary teachers who meet the minimum national training or qualification standards required to teach at that level.",
    formula: "Trained teachers (%) = (qualified lower secondary teachers ÷ total lower secondary teachers) × 100",
  },
  {
    id: "trained_teachers_ter",
    label: "Trained teachers in upper secondary education (% of total teachers)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.TER.TCAQ.LO.GE.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.TER.TCAQ.LO.GE.ZS",
    description:
      "The percentage of upper secondary teachers who meet the minimum national training or qualification standards required to teach at that level.",
    formula: "Trained teachers (%) = (qualified upper secondary teachers ÷ total upper secondary teachers) × 100",
  },
  {
    id: "edu_expenditure_gdp",
    label: "Government expenditure on education, total (% of GDP)",
    unit: "% of GDP",
    category: "education",
    worldBankCode: "SE.XPD.TOTL.GD.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.XPD.TOTL.GD.ZS",
    description:
      "Total public spending on education as a share of gross domestic product, covering all education levels and institutions.",
    formula: "Education expenditure (% of GDP) = (public education spending ÷ GDP) × 100",
  },
  {
    id: "enrollment_primary_pct",
    label: "School enrollment, primary (% gross)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.PRM.ENRR",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.PRM.ENRR",
    description:
      "Total enrolment in primary education as a percentage of the official primary school-age population, including over-age and under-age students.",
    formula: "Gross enrolment (%) = (total primary enrolment ÷ primary school-age population) × 100",
  },
  {
    id: "enrollment_tertiary_pct",
    label: "School enrollment, tertiary (% gross)",
    unit: "%",
    category: "education",
    worldBankCode: "SE.TER.ENRR",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.TER.ENRR",
    description:
      "Total enrolment in tertiary education as a percentage of the official tertiary-age population, including students outside the typical age range.",
    formula: "Gross enrolment (%) = (total tertiary enrolment ÷ tertiary-age population) × 100",
  },
  {
    id: "enrollment_primary_count",
    label: "Enrolment in primary education, both sexes (number)",
    unit: "people",
    category: "education",
    worldBankCode: "SE.PRM.ENRL",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.PRM.ENRL",
    description:
      "The total number of students enrolled in primary education, regardless of age or sex.",
  },
  {
    id: "enrollment_secondary_count",
    label: "Enrolment in secondary education, both sexes (number)",
    unit: "people",
    category: "education",
    worldBankCode: "SE.SEC.ENRL",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.SEC.ENRL",
    description:
      "The total number of students enrolled in secondary education, regardless of age or sex.",
  },
  {
    id: "enrollment_tertiary_count",
    label: "Enrolment in tertiary education, all programmes, both sexes (number)",
    unit: "people",
    category: "education",
    worldBankCode: "SE.TER.ENRL",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.TER.ENRL",
    description:
      "The total number of students enrolled in tertiary education programmes, regardless of age or sex.",
  },
  {
    id: "teachers_primary_count",
    label: "Teachers in primary education, total",
    unit: "people",
    category: "education",
    worldBankCode: "SE.PRM.TCHR",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.PRM.TCHR",
    description:
      "The total number of teachers working in primary education, including full-time and part-time staff.",
  },
  {
    id: "teachers_secondary_count",
    label: "Teachers in secondary education, total",
    unit: "people",
    category: "education",
    worldBankCode: "SE.SEC.TCHR",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.SEC.TCHR",
    description:
      "The total number of teachers working in secondary education, including full-time and part-time staff.",
  },
  {
    id: "teachers_tertiary_count",
    label: "Teachers in tertiary education programmes, total",
    unit: "people",
    category: "education",
    worldBankCode: "SE.TER.TCHR",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SE.TER.TCHR",
    description:
      "The total number of teaching staff in tertiary education programmes, including full-time and part-time personnel.",
  },
  {
    id: "pop_15_64_pct",
    label: "Population ages 15-64 (% of total)",
    unit: "%",
    category: "demographics",
    worldBankCode: "SP.POP.1564.TO.ZS",
    sourceName: "World Bank WDI",
    sourceUrl: "https://data.worldbank.org/indicator/SP.POP.1564.TO.ZS",
    description:
      "The share of the total population aged 15 to 64 years, commonly treated as the working-age population.",
    formula: "Share (%) = (population aged 15–64 ÷ total population) × 100",
  },
  {
    id: "labor_force_total",
    label: "Labor force, total",
    unit: "people",
    category: "labour",
    worldBankCode: "SL.TLF.TOTL.IN",
    sourceName: "World Bank WDI / ILO modeled",
    sourceUrl: "https://data.worldbank.org/indicator/SL.TLF.TOTL.IN",
    description:
      "The total number of people who are employed or actively seeking employment—the economically active population.",
    formula: "Labour force = employed people + unemployed people actively seeking work",
  },
  {
    id: "homicide_rate",
    label: "Intentional homicides (per 100,000 people)",
    unit: "per 100,000",
    category: "crime",
    worldBankCode: "VC.IHR.PSRC.P5",
    sourceName: "World Bank WDI (UNODC International Homicide Statistics)",
    sourceUrl: "https://data.worldbank.org/indicator/VC.IHR.PSRC.P5",
    description:
      "The number of unlawful deaths intentionally inflicted on a person by another, per 100,000 population (excluding deaths from armed conflict). Data are compiled by the UN Office on Drugs and Crime (UNODC) from criminal justice records, public health sources, and crime surveys.",
    formula: "Homicide rate = (intentional homicides ÷ population) × 100,000",
  },
  {
    id: "homicide_rate_female",
    label: "Intentional homicides, female (per 100,000 female)",
    unit: "per 100,000",
    category: "crime",
    worldBankCode: "VC.IHR.PSRC.FE.P5",
    sourceName: "World Bank WDI (UNODC International Homicide Statistics)",
    sourceUrl: "https://data.worldbank.org/indicator/VC.IHR.PSRC.FE.P5",
    description:
      "The number of intentional homicides among females per 100,000 female population, as reported through UNODC International Homicide Statistics via the World Bank.",
    formula: "Female homicide rate = (female intentional homicides ÷ female population) × 100,000",
  },
  {
    id: "homicide_rate_male",
    label: "Intentional homicides, male (per 100,000 male)",
    unit: "per 100,000",
    category: "crime",
    worldBankCode: "VC.IHR.PSRC.MA.P5",
    sourceName: "World Bank WDI (UNODC International Homicide Statistics)",
    sourceUrl: "https://data.worldbank.org/indicator/VC.IHR.PSRC.MA.P5",
    description:
      "The number of intentional homicides among males per 100,000 male population, as reported through UNODC International Homicide Statistics via the World Bank.",
    formula: "Male homicide rate = (male intentional homicides ÷ male population) × 100,000",
  },
  {
    id: "gbv_women_pct",
    label: "Women subjected to physical and/or sexual violence in last 12 months (% of ever-partnered women ages 15-49)",
    unit: "%",
    category: "crime",
    worldBankCode: "SG.VAW.1549.ZS",
    sourceName: "World Bank WDI (UN/WHO household surveys)",
    sourceUrl: "https://data.worldbank.org/indicator/SG.VAW.1549.ZS",
    description:
      "The percentage of ever-partnered women aged 15–49 who experienced physical and/or sexual violence by a current or former intimate partner in the past 12 months, based on household surveys.",
    formula: "Prevalence (%) = (women reporting partner violence in past 12 months ÷ ever-partnered women aged 15–49) × 100",
  },
  {
    id: "idp_conflict_violence",
    label: "Internally displaced persons, new displacement associated with conflict and violence (number of cases)",
    unit: "cases",
    category: "crime",
    worldBankCode: "VC.IDP.NWCV",
    sourceName: "World Bank WDI (Internal Displacement Monitoring Centre)",
    sourceUrl: "https://data.worldbank.org/indicator/VC.IDP.NWCV",
    description:
      "The number of new internal displacements triggered by conflict and violence during the reference year, as reported by the Internal Displacement Monitoring Centre (IDMC).",
  },
  {
    id: "battle_related_deaths",
    label: "Battle-related deaths (number of people)",
    unit: "people",
    category: "crime",
    worldBankCode: "VC.BTL.DETH",
    sourceName: "World Bank WDI (Uppsala Conflict Data Program)",
    sourceUrl: "https://data.worldbank.org/indicator/VC.BTL.DETH",
    description:
      "The number of fatalities from organised armed conflict during the year, as recorded in the Uppsala Conflict Data Program (UCDP) Battle-Related Deaths Dataset.",
  },
  {
    id: "rule_of_law_wgi",
    label: "Rule of Law — governance estimate (approx. -2.5 to +2.5)",
    unit: "index",
    category: "crime",
    worldBankCode: "GOV_WGI_RL_EST",
    sourceName: "World Bank WDI (Worldwide Governance Indicators)",
    sourceUrl: "https://data.worldbank.org/indicator/GOV_WGI_RL_EST",
    description:
      "A composite estimate of confidence in and adherence to the rules of society—including contract enforcement, property rights, police, courts, and crime—from the World Bank Worldwide Governance Indicators. Higher values indicate stronger rule of law.",
  },
  {
    id: "political_stability_wgi",
    label: "Political Stability — governance estimate (approx. -2.5 to +2.5)",
    unit: "index",
    category: "crime",
    worldBankCode: "GOV_WGI_PV_EST",
    sourceName: "World Bank WDI (Worldwide Governance Indicators)",
    sourceUrl: "https://data.worldbank.org/indicator/GOV_WGI_PV_EST",
    description:
      "An estimate of the likelihood that a government will be destabilised or overthrown by violence or terrorism, from the World Bank Worldwide Governance Indicators. Higher values indicate greater political stability.",
  },
  {
    id: "corruption_control_wgi",
    label: "Control of Corruption — governance estimate (approx. -2.5 to +2.5)",
    unit: "index",
    category: "crime",
    worldBankCode: "GOV_WGI_CC_EST",
    sourceName: "World Bank WDI (Worldwide Governance Indicators)",
    sourceUrl: "https://data.worldbank.org/indicator/GOV_WGI_CC_EST",
    description:
      "An estimate of the extent to which public power is exercised for private gain, including petty and grand corruption, from the World Bank Worldwide Governance Indicators. Higher values indicate better control of corruption.",
  },
];

export const METRIC_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m]));
