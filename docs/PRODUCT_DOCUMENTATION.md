# Country Analytics Platform — Comprehensive Product Documentation

**Document version:** 2026-07-21 (ninth pass)  
**Audience:** Product managers, strategy leads, analysts, engineers, design, QA, and leadership  
**Status:** Implementation-aligned with current codebase

---

## 1. Executive summary

Country Analytics Platform (CAP) is an enterprise web application that helps organizations understand countries through **standardized indicators**, **visual analytics**, and **governed AI interpretation**. It replaces fragmented spreadsheet workflows with a single source of truth for 68 World Bank–anchored metrics spanning financial, demographic, health, education, labour, and crime & public safety domains.

CAP is built for teams that must answer questions such as:
- How has a country's economic or social performance changed over time?
- How does one country compare against regional peers or the global average?
- What macro-environment risks and opportunities does indicator evidence suggest?
- How do two indicators correlate across countries—and what hypotheses does that support?

The platform's core promise: **trustworthy analytics with explicit evidence boundaries**, not black-box AI conclusions.

---

## 2. Product vision and mission

### Vision
Every country-intelligence decision is backed by auditable, standardized, and transparent evidence.

### Mission
Deliver analyst-grade country analytics and strategic interpretation tools that reduce time-to-insight while maintaining governance, reproducibility, and responsible AI behavior.

---

## 3. Product benefits

### 3.1 For analysts and researchers
- **Single metric dictionary** — 68 indicators with consistent IDs, units, formulas, and source mapping
- **Reproducible comparisons** — Same inputs produce the same deterministic outputs
- **Data-year transparency** — Always know which year the numbers actually represent
- **Export-ready outputs** — CSV and PNG export from charts, tables, and strategy cards

### 3.2 For strategy and policy teams
- **Structured frameworks** — PESTEL and Porter outputs with SWOT, implications, and recommendations
- **Evidence-backed narratives** — AI synthesis constrained by platform metrics and grounding QA
- **Executive presentation mode** — Clean Business Analytics view for leadership review

### 3.3 For security and risk teams
- **Crime & public safety coverage** — Homicide rates, GBV prevalence, conflict displacement, battle deaths, and WGI governance indices
- **Global benchmarking** — Compare safety indicators across regions via global tables and choropleth maps

### 3.4 For product and engineering leaders
- **Traceability matrix** — Every requirement maps to implementation and validation
- **Guardrails documentation** — Technical, business, and AI safety boundaries are explicit
- **Release governance** — Checklists, changelogs, and doc-sync protocols are built in

---

## 4. Feature catalog

### 4.1 Country Dashboard (`/`)

**Purpose:** Primary country intelligence view for a selected ISO3 country.

**Capabilities:**
- Hero profile card: flag, region, income group, capital, population, land area, EEZ, government metadata
- **Head of government card:** current officeholder name + office title (Wikidata / optional Tavily+Groq)
- FX rate card: `1 USD = local currency` with source label (ECB/Frankfurter or World Bank) and as-of date
- Timezone clock card for capital city
- Accordion sections by domain:
  - Financial indicators (GDP, inflation, debt, poverty, etc.)
  - Demographics (population, age structure)
  - Health (life expectancy, UHC, hospital beds, immunization, etc.)
  - Education (literacy, enrollment, completion, GPI, OOSC)
  - Labour (unemployment, participation, labour force)
  - **Crime & public safety** (homicide, GBV, displacement, battle deaths, WGI governance)
- KPI metric cards with YoY delta badges
- Toggle line charts with chart/table view and PNG/CSV export
- Dashboard comparison table: country vs regional average vs global benchmark (shared **DataTable** UI with sticky metric column, inline YoY deltas, row-count footer)

**Business logic:**
- Metric series fetched via `GET /api/country/:cca3/series` with resilient chunked client loading
- Year range clamped to 2000–current
- Comparison table uses geography-aware regional aggregation

### 4.1.1 Compare Countries (`/compare`)

**Purpose:** Side-by-side dual-country analysis for peer benchmarking.

**Capabilities:**
- Select Country A and Country B (persisted selection)
- Dual-line trend charts with distinct A/B colors (`#1d4ed8` / `#c2410c`)
- Pair tables and KPI deltas with unit-aware formatting (shared **DataTable** with A/B accent columns and group rows by metric category)
- Mode-aware PNG/CSV export

**Business logic:**
- Reuses the same country series pipeline and resilience rules as the Dashboard
- Compare formatting helpers live in `frontend/src/lib/compareMetricFormat.ts`

### 4.2 Global Analytics (`/global`)

**Purpose:** Cross-country visualization and tabular comparison.

**Capabilities:**
- **Choropleth world map** with quintile tier coloring, dedicated legend, and analytics-rich country tooltip
- Selectable map metric (including homicide rate) with curated plain-English tooltip blurbs
- Compact single-row toolbar (year, region, view mode, inline map metric selector)
- Category-filtered global country tables: general, financial, health, education, **crime**
- World aggregate (WLD) time-series charts — modular accordion groups with lazy per-chart load
- Region filter and sortable columns
- Fullscreen visualization mode

**Map business logic:**
- Snapshot resolves actual data year (may step back from requested year)
- Tier breaks (`buildChoroplethTierModel`) are computed from countries in the **current map scope** (region filter aware)
- Tooltip shows country value, **tier badge** (short label + rank band with color swatch), rank (#N of M), distribution stats (lowest/median/highest/mean/mode), comparison line, and log-scaled position bar when spread is wide
- Comparison line: “Highest/Lowest value on this map” at extremes; otherwise `#N of M · outranks X%`
- Metric blurbs prefer curated copy in `metricTooltipBlurb.ts`; otherwise first catalog sentence (tightened)

**Table business logic:**
- Global category tables and map-side metric tables use shared **DataTable** (sticky label column, sortable headers, row-count footer, wide-table scroll hint)
- Table categories map to metric subsets in `backend/src/globalTable.ts`
- Tables load via **metric matrices** (`loadMetricMatrices` / `composeMetricMatrix`) with WDI → IMF → UIS → WHO (UHC) fills
- Empty table responses set `x-cap-warning: global-table-empty`; UI shows amber note and empty-state panel via `getJsonWithMeta`
- Missing cells display “Not reported” (no fabricated zeros); map side table includes all scoped countries even when values are null

**WLD charts business logic:**
- Charts mirror Dashboard metric groups (FX country-only chart omitted)
- Series from `buildWldSeriesBundle` (official WLD + sovereign matrix fill + polish); debt US$ = Σ(GDP×debt%) within (0, 500] band
- Accordion sections fetch only after open (`useWldChartSeries`); partial/null warnings map to user-visible copy
- Dual Y-axis when catalog marks `dualAxis` or value span ratio ≥ 8

### 4.3 Analytics Assistant (`/assistant`)

**Purpose:** Natural-language country intelligence with platform grounding.

**Capabilities:**
- Metric-scoped ranking and comparison queries
- World-total questions answered with the same WLD pipeline as Global Charts (`assistantWldBlock.ts`)
- `% of top` relative value calculations in comparison tables
- Verified-web mode for time-sensitive non-metric questions
- Citation and attribution transparency
- BYOK key support via header panel

**Evidence hierarchy:**
1. Platform metric evidence (deterministic tables / WLD aggregates)
2. Verified web evidence (Tavily with citations)
3. AI synthesis (grounding-gated)

**Parity rules:** focus/compare/PESTEL/Porter country digests use `skipWldFallback: true` (no World→country `wld_proxy` as preferred latest).

### 4.4 PESTEL Analysis (`/pestel`)

**Purpose:** Macro-environment strategic assessment for a focus country.

**Output structure:**
- Six dimensions: Political, Economic, Sociocultural, Technological, Environmental, Legal
- SWOT grid (Strengths, Weaknesses, Opportunities, Threats)
- Comprehensive narrative sections and market implications
- Strategic recommendations

**Quality controls:**
- Snippet-only web evidence (no synthesized web answers)
- Strict grounding QA gate
- Deterministic fallback when LLM output fails validation

### 4.5 Porter Five Forces (`/porter`)

**Purpose:** Industry attractiveness analysis by country and ILO-ISIC sector.

**Output structure:**
- Five forces: threat of new entry, supplier power, buyer power, threat of substitutes, competitive rivalry
- Comprehensive narrative sections
- Force-level digest from platform indicators + optional Tavily web context

### 4.6 Business Analytics (`/business`)

**Purpose:** Cross-country statistical analysis for metric pairs.

**Capabilities:**
- Pearson correlation (r), p-value, r², slope, intercept
- Scatter plot with regression line and confidence band
- Residual diagnostics and IQR outlier exclusion
- Optional LLM narrative interpretation
- Strict-range vs reliability fallback modes
- Presentation mode (keyboard `P`)
- Session-persisted analysis until regenerate

**Important:** Correlation supports hypothesis generation; it does not prove causation.

### 4.7 Sources & Methodology (`/sources`)

**Purpose:** In-app transparency for metrics, formulas, and data providers.

**Capabilities:**
- Data provider cards with source URLs
- Metric catalog grouped by category (including crime)
- Expandable formula and source sub-sections per metric
- Collapsible top-level sections (collapsed by default)

### 4.8 Cross-app BYOK (Bring Your Own Key)

**Purpose:** Enterprise-friendly API key management without server-side provisioning.

**Flow:**
1. User enters Groq and/or Tavily keys in header `AI API Keys (App-wide)` panel
2. Keys validated via `POST /api/keys/validate`
3. Keys attached as request headers to all AI routes
4. Backend resolves: user key → server env key → deterministic fallback

---

## 5. Business guidelines

### 5.1 Decision-support framing
All outputs—especially AI narratives and correlation interpretations—are **decision-support**, not automated decisions. Human review is required before policy, investment, or operational actions.

### 5.2 Metric scope discipline
Users and the system must stay within requested metric IDs. Substituting related indicators without disclosure is prohibited.

### 5.3 Year interpretation
- **Requested year** = what the user selected
- **Data year** = what the backend actually returned (may differ due to publication lag or gap-fill)
- Comparisons must use consistent data years within a single view

### 5.4 Crime & safety data interpretation
- Homicide and violence metrics vary in reporting quality across countries
- WGI governance indices are perception-based (-2.5 to +2.5 scale)
- GBV data comes from household surveys with limited country coverage
- Conflict metrics (IDP, battle deaths) reflect specific event definitions—see metric catalog for source details

### 5.5 AI narrative governance
- PESTEL/Porter/Business narratives require Groq key (user or server)
- When keys are missing or grounding fails, deterministic scaffolds are returned
- Users must review attribution signals to understand evidence mode

---

## 6. Technical guidelines

### 6.1 Architecture pattern
- **Monorepo:** npm workspaces (`backend`, `frontend`)
- **API:** Express REST on Node.js ≥ 20
- **SPA:** React 18 + Vite 6 + Tailwind CSS
- **Deployment:** Vercel (static frontend + serverless API handler)

### 6.2 Data pipeline

**Country-level series** (`worldBank.ts`):
```
World Bank WDI (primary)
  → WDI fallback code (if configured)
  → IMF WEO DataMapper gap-fill
  → UNESCO UIS API gap-fill
  → Derived calculations (GDP/population, debt US$, OOSC approximations)
  → Terminal carry-forward + interpolation
  → WLD world-aggregate proxy
  → Percentage clamping
```

**Global Analytics tables / multi-year matrices** (`backend/src/globalData/`):
```
composeMetricMatrix(metricId, startYear, endYear)
  → WDI year-range snapshots
  → IMF bulk range matrix (when imfWeoIndicator set)
  → UIS bulk range matrix (when uisIndicatorId set)
  → WHO GHO (uhc_service_coverage → UHC_INDEX_REPORTED)
  → loadMetricMatrices pools compose with concurrency + deadline
```

Each series point may carry a `provenance` field: `reported`, `imf_weo`, `interpolated`, `wld_proxy`, etc. WHO GHO fills are merged into null cells only (WDI wins when present).

### 6.3 Caching strategy
- Server-side in-memory TTL cache for expensive fetches
- Client-side session cache for Business Analytics persistence
- Background data warmup on server start (disable with `DISABLE_BOOTSTRAP_WARMUP=1`)

### 6.4 API validation rules
- ISO3 codes: `^[A-Z]{3}$`
- Metric IDs: must exist in `backend/src/metrics.ts`
- Years: clamped to `[2000, currentYear]`
- Global table category: `general|financial|health|education|crime`

### 6.5 AI model routing (Groq)
| Use case | Primary model | Fallback chain |
|----------|---------------|----------------|
| PESTEL | llama-3.3-70b-versatile | 8b-instant, gpt-oss-120b, qwen3-32b |
| Porter | openai/gpt-oss-120b | 70b-versatile, 8b-instant, qwen3-32b |
| Assistant | llama-3.1-8b-instant | 70b-versatile, gpt-oss-120b, qwen3-32b |
| Business | llama-3.3-70b-versatile | 8b-instant, gpt-oss-120b, qwen3-32b |

Override via environment variables (see `docs/VARIABLES.md`).

---

## 7. Technology stack reference

| Component | Technology | Version (approx.) |
|-----------|------------|-------------------|
| Runtime | Node.js | ≥ 20 |
| Frontend framework | React | 18.3 |
| Build tool | Vite | 6 |
| Styling | Tailwind CSS | 3.4 |
| Charts | Recharts | 2.15 |
| Maps | react-simple-maps | — |
| Backend | Express | 4.21 |
| Language | TypeScript | — |
| LLM | Groq API | — |
| Web search | Tavily API | — |
| Primary data | World Bank WDI | — |

---

## 8. Data sources and external dependencies

| Provider | Role | Required |
|----------|------|----------|
| World Bank WDI | Primary time series (68 metrics) | Yes |
| World Bank Country API | Income level, lending type | Yes |
| IMF WEO DataMapper | Macro gap-fill (incl. bulk global range for tables) | No (enhancement) |
| UNESCO UIS API | Education gap-fill (incl. bulk global range for tables) | No (enhancement) |
| WHO Global Health Observatory | UHC service coverage fill (`UHC_INDEX_REPORTED`) when WDI archived | No (enhancement) |
| REST Countries v3.1 | Geography, flags, currencies | Yes |
| Frankfurter (ECB) | Daily FX quotes | No (fallback to WB) |
| Sea Around Us | EEZ area | No (static fallback) |
| Wikidata | Government enrichment | No (enhancement) |
| Groq | LLM narratives | No (deterministic fallback) |
| Tavily | Verified web retrieval | No (web mode disabled) |

---

## 9. User roles and documentation paths

| Role | Start here | Then read |
|------|------------|-----------|
| Product manager | This document | PRD, USER_STORIES, METRICS_AND_OKRS |
| Analyst / researcher | README quick start | METRIC_CATALOG, VARIABLES, API_REFERENCE |
| Strategy lead | PRD §8 journeys | ANALYSIS_METHODS, GUARDRAILS |
| Engineer | ARCHITECTURE | API_REFERENCE, TRACEABILITY_MATRIX |
| Designer | DESIGN_GUIDELINES | USER_PERSONAS, PRD |
| QA | TRACEABILITY_MATRIX | USER_STORIES acceptance criteria |
| Leadership | EXECUTIVE_DOCUMENTATION_SUMMARY | GUARDRAILS, CHANGELOG |

---

## 10. Related documents

| Document | Relationship |
|----------|--------------|
| `PRD.md` | Formal requirements and scope |
| `USER_PERSONAS.md` | Target audience definitions |
| `USER_STORIES.md` | Acceptance criteria for QA |
| `METRIC_CATALOG.md` | Full 68-metric dictionary |
| `VARIABLES.md` | Request/env/derived variable specs |
| `GUARDRAILS.md` | Non-negotiable boundaries |
| `TRACEABILITY_MATRIX.md` | Requirements → code mapping |
| `PRODUCT_DOCUMENTATION_STANDARD.md` | How to maintain these docs |

---

## 11. Document maintenance

This document must be updated when:
- New modules or major features are added
- Metric catalog changes (add/remove/rename)
- Business rules or evidence hierarchy changes
- Tech stack or deployment model changes

Record updates in `CHANGELOG.md` with date and scope.

**Last synchronized:** 2026-07-20 (68 metrics, crime category, full doc audit)
