# Country Analytics Platform

Country Analytics Platform (CAP) is an enterprise analytics and decision-support web application for **country intelligence**. It unifies a deterministic metrics pipeline, analyst-grade visual analytics, and governed AI-assisted interpretation so teams can move from raw indicators to evidence-backed decisions in one workflow.

The platform is designed for policy analysts, strategy managers, researchers, security/risk teams, and executive reviewers who need **trustworthy, reproducible, and auditable** country comparisons—not ad hoc spreadsheet work or ungrounded AI summaries.

---

## Product overview

CAP delivers **eight integrated capabilities** across a single React application:

| # | Module | Route | Purpose |
|---|--------|-------|---------|
| 1 | **Country Dashboard** | `/` | Country KPI cards, multi-domain trend charts, comparison tables, FX rates, head of government, timezone, and EEZ context |
| 2 | **Compare Countries** | `/compare` | Side-by-side dual-country trends, KPI deltas, and pair tables with PNG/CSV export |
| 3 | **Global Analytics** | `/global` | Quintile choropleth map with analytics tooltip + legend, category-filtered global tables, and world aggregate (WLD) charts |
| 4 | **Analytics Assistant** | `/assistant` | Platform-grounded chat with ranking/comparison tables, citation controls, and optional verified-web mode |
| 5 | **PESTEL Analysis** | `/pestel` | Structured macro-environment analysis: six dimensions, SWOT, market implications, and recommendations |
| 6 | **Porter Five Forces** | `/porter` | Industry attractiveness analysis by country and ILO-ISIC sector |
| 7 | **Business Analytics** | `/business` | Cross-country correlation/regression diagnostics, scatter/residual plots, and optional LLM narrative |
| 8 | **Sources & Methodology** | `/sources` | Metric catalog explorer, data-provider documentation, formulas, and governance transparency |

Cross-cutting: **Bring Your Own Key (BYOK)** — app-wide Groq/Tavily key management in the header, validated once and reused across all AI modules.

---

## Product benefits

| Benefit | What it means for users |
|---------|-------------------------|
| **Trust and consistency** | One canonical metric catalog (68 indicators), one variable dictionary, one API contract—same definitions everywhere |
| **Faster decision cycles** | Dashboard analytics, strategic frameworks (PESTEL/Porter), and narratives generated in a single platform |
| **Evidence transparency** | Selected year vs actual data year is always distinguished; source and provenance behavior is documented |
| **Governed AI behavior** | Assistant, PESTEL, and Porter use grounding QA plus deterministic fallback paths—never unsupported certainty |
| **Portable enterprise controls** | BYOK enables personal API quotas without exposing keys in repository configuration |
| **Cross-functional alignment** | PRD, personas, stories, metrics/OKRs, guardrails, and traceability share one documentation baseline |
| **Security & safety context** | Crime & public safety metrics (UNODC, IDMC, UCDP, WGI) integrated into dashboard and global views |

---

## Feature logic and business rules (high level)

### Data-first logic
Platform analytics are grounded in **metric time series** and deterministic processing before any narrative generation. AI synthesis is always secondary to platform evidence.

### Year-bound logic
- Supported data window: **2000 – current calendar year**
- Input years are clamped to platform bounds
- Sparse series may use controlled gap-fill (IMF WEO, UNESCO UIS, WHO GHO for UHC) or carry-forward interpolation
- Global snapshots default to `currentYear − 1` when the current year is requested but not yet published

### Safety and fallback logic
When model/web dependencies are unavailable or evidence is thin, the product falls back to **deterministic scaffolds**—structured, data-only outputs that remain usable for review.

### Grounding QA logic
PESTEL outputs pass strict snippet-based grounding validation. Weak LLM output is replaced with deterministic evidence blends or data-only scaffolds.

### Governance logic
Requirement-to-code mapping, technical/business guardrails, and release readiness checklists are maintained in `/docs` and release-gated.

### Exchange-rate logic
Country dashboard FX prioritizes **ECB daily quotes** (via Frankfurter), with **World Bank official FX** (`PA.NUS.FCRF`) as institutional fallback. UI shows quote date and source.

### Series load resilience
Country metric series load in small client batches (chunk size 4, parallel waves of 2) with retries and automatic half-split on timeout. Server bisects timed-out all-null bundles and skips WLD world-proxy fill on batched client requests.

### Head-of-government enrichment
Dashboard resolves current officeholder name via Wikidata (P6) and optional Tavily+Groq when keys are available; office title falls back from government type when Wikidata P1313 is missing.

### Business Analytics resilience
Year-range WDI snapshot fetches (not per-year loops), deadline-aware serverless budgets, empty-result `CORRELATION_EMPTY` handling, optional strict-range mode, and presentation mode (`P`) for executive review.

### Global map analytics
Choropleth uses **five quantile tiers** within the active region scope, a dedicated color-scale legend, and a distribution-aware country tooltip (tier badge, rank, stats, curated metric blurbs).

### Shared analytical tables
Dashboard comparison, Compare pair, Global category, and chart/table series views use a unified **DataTable** system (sticky labels, sortable headers, row-count footers, A/B accent columns).

### Global metric matrices
Global Analytics tables compose multi-year country×metric matrices (`backend/src/globalData/`) with bulk IMF/UIS fills and WHO GHO for archived UHC coverage; empty loads surface `global-table-empty`.

### WLD charts + Assistant parity
World aggregate charts and Assistant world-total answers share `buildWldSeriesBundle`. Country digests never prefer World→country `wld_proxy` fills.

---

## Metric coverage (68 indicators, 6 data categories + UI grouping)

The catalog contains **68 metrics** in **6 data categories**, plus a **UI-only `general` grouping** for cross-domain global tables:

| Category | Count | Example metrics |
|----------|-------|-----------------|
| Financial | 13 | GDP, GDP per capita, inflation, gov debt, poverty |
| Demographics | 4 | Population, age-band shares |
| Health | 14 | Life expectancy, UHC index, hospital beds, immunization |
| Education | 25 | Literacy, enrollment, completion, GPI, OOSC |
| Labour | 3 | Unemployment, labour force participation, labour force total |
| Crime & public safety | 9 | Homicide rates, GBV, IDP displacement, battle deaths, WGI governance |

Canonical source: `backend/src/metrics.ts` · Full dictionary: `docs/METRIC_CATALOG.md`

---

## Tech stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 · TypeScript · Vite 6 · Tailwind CSS 3.4 · Recharts · react-simple-maps |
| **Backend** | Node.js ≥ 20 · Express 4 · TypeScript |
| **Primary data** | World Bank WDI API (with IMF WEO, UNESCO UIS, and WHO GHO UHC gap-fill) |
| **Enrichment** | REST Countries, Wikidata, Sea Around Us EEZ, Frankfurter (ECB FX) |
| **LLM** | Groq API (use-case-specific models + fallback chains) |
| **Web retrieval** | Tavily API (optional verified-web mode) |
| **Deployment** | Vercel (SPA + serverless Express via `api/index.ts`) |
| **Monorepo** | npm workspaces (`backend`, `frontend`) |

---

## Quick start

### 1) Install dependencies

```bash
npm install
npm -C backend install
npm -C frontend install
```

### 2) Configure environment

Copy `.env.example` to `backend/.env`:

```env
PORT=4000
GROQ_API_KEY=your_groq_key_here
TAVILY_API_KEY=your_tavily_key_here
```

Optional frontend override (local dev with separate API host):

```env
VITE_API_BASE_URL=http://localhost:4000
```

### 3) Run development servers

```bash
npm -C backend run dev    # API on :4000
npm -C frontend run dev   # SPA on :5173 (proxies /api → :4000)
```

Or both concurrently from root:

```bash
npm run dev
```

### 4) Build validation gate

```bash
npm run build
```

---

## Documentation map

Start with [`docs/README.md`](docs/README.md) for role-based reading paths.

### Product & strategy
| Document | Purpose |
|----------|---------|
| [`docs/PRODUCT_DOCUMENTATION.md`](docs/PRODUCT_DOCUMENTATION.md) | Comprehensive product guide (overview, benefits, features, logic, guidelines) |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements, scope, user journeys, risks |
| [`docs/USER_PERSONAS.md`](docs/USER_PERSONAS.md) | Target user archetypes and evidence needs |
| [`docs/USER_STORIES.md`](docs/USER_STORIES.md) | Epics, stories, and acceptance criteria |
| [`docs/EXECUTIVE_DOCUMENTATION_SUMMARY.md`](docs/EXECUTIVE_DOCUMENTATION_SUMMARY.md) | Leadership-level status snapshot |

### Architecture & API
| Document | Purpose |
|----------|---------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System layers, runtime flows, evidence hierarchy |
| [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | Full endpoint contracts |
| [`docs/VARIABLES.md`](docs/VARIABLES.md) | Environment, request, and derived variable dictionary |
| [`docs/METRIC_CATALOG.md`](docs/METRIC_CATALOG.md) | All 68 metrics with WDI codes, formulas, sources |

### AI, analysis & methods
| Document | Purpose |
|----------|---------|
| [`docs/ASSISTANT_BEHAVIOR.md`](docs/ASSISTANT_BEHAVIOR.md) | Routing, grounding, response controls |
| [`docs/ANALYSIS_METHODS.md`](docs/ANALYSIS_METHODS.md) | Correlation, PESTEL, Porter methodology |
| [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md) | Manual QA scope and automation roadmap |
| [`docs/DOCUMENTATION_AUDIT_REPORT.md`](docs/DOCUMENTATION_AUDIT_REPORT.md) | Formal audit verification report |

### Design, metrics & governance
| Document | Purpose |
|----------|---------|
| [`docs/DESIGN_GUIDELINES.md`](docs/DESIGN_GUIDELINES.md) | UI/UX standards, palettes, component rules |
| [`docs/METRICS_AND_OKRS.md`](docs/METRICS_AND_OKRS.md) | Product health metrics and OKR framework |
| [`docs/GUARDRAILS.md`](docs/GUARDRAILS.md) | Technical, business, and AI safety boundaries |
| [`docs/TRACEABILITY_MATRIX.md`](docs/TRACEABILITY_MATRIX.md) | Requirements-to-code mapping |
| [`docs/PRODUCT_DOCUMENTATION_STANDARD.md`](docs/PRODUCT_DOCUMENTATION_STANDARD.md) | Documentation governance rules |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Versioned development history |

### Operations
| Document | Purpose |
|----------|---------|
| [`docs/DEPLOYMENT_VERCEL.md`](docs/DEPLOYMENT_VERCEL.md) | Vercel deployment runbook |
| [`docs/RELEASE_READINESS_CHECKLIST.md`](docs/RELEASE_READINESS_CHECKLIST.md) | Release gate checklist |

---

## Most-used API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness check |
| GET | `/api/metrics` | Full metric catalog |
| GET | `/api/country/:cca3/series` | Metric time series |
| GET | `/api/dashboard/comparison` | Country vs regional avg vs global |
| GET | `/api/global/snapshot` | Choropleth snapshot |
| GET | `/api/country/:cca3/fx-series` | USD/EUR exchange-rate time series |
| GET | `/api/global/table` | Global country table (incl. crime category) |
| GET | `/api/global/wld-series` | World aggregate series (official WLD + matrix fill) |
| GET | `/api/global/wld-charts` | WLD chart-group bundle (optional bulk) |
| POST | `/api/assistant/chat` | Analytics assistant |
| POST | `/api/keys/validate` | BYOK key validation |
| POST | `/api/analysis/pestel` | PESTEL generation |
| POST | `/api/analysis/porter` | Porter Five Forces |
| GET | `/api/analysis/correlation-global` | Cross-country correlation |
| POST | `/api/analysis/business/correlation-narrative` | Business narrative |

Full contracts: [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)

---

## Latest implementation highlights

> **Documentation status:** Re-audited against uncommitted implementation as of **2026-07-21 (ninth pass)**. See [`docs/DOCUMENTATION_AUDIT_REPORT.md`](docs/DOCUMENTATION_AUDIT_REPORT.md).

### 2026-07-21 — WLD charts pipeline + Assistant parity
- **`buildWldSeriesBundle`**: official WLD + sovereign matrix fill + polish for Global Charts and Assistant world totals
- Modular **`wldCharts/*`** UI (lazy accordion groups); optional `GET /api/global/wld-charts`
- Assistant country digests use `skipWldFallback`; debt ranking band (0, 500]; debt-% LCU fallback removed

### 2026-07-21 — Global metric matrices + WHO GHO UHC
- Modular **`globalData/`** pipeline (`composeMetricMatrix`, `loadMetricMatrices`) for Global Analytics tables
- **WHO GHO** OData fill for `uhc_service_coverage` (`UHC_INDEX_REPORTED`) when WDI is archived
- Bulk IMF/UIS range fetches; outbound HTTP `timeoutMs`; `x-cap-warning: global-table-empty` + `getJsonWithMeta` UX
- Sources provider list includes `who-gho`

### 2026-07-21 — Shared DataTable system
- Canonical **DataTable** component for Dashboard comparison, Compare pair, Global tables, and chart/table series views
- Sticky label columns, sortable headers, row-count footers, A/B accent tints, inline metric deltas
- Map tooltip **tier badge** and refined comparison copy

### 2026-07-21 — Global choropleth analytics UX
- **Quintile tier coloring** on the global map with dedicated legend (`choroplethTiers.ts`, `ChoroplethTierLegend.tsx`)
- **Distribution-aware map tooltip** with rank, stats, comparison line, and curated metric blurbs (`MapCountryTooltip.tsx`, `metricTooltipBlurb.ts`)
- Compact **GlobalAnalyticsToolbar** single-row control strip
- Map tooltip motion tokens with `prefers-reduced-motion` support

### 2026-07-20 — UX modularization, HoG, and resilience
- **Compare Countries** (`/compare`) documented as a first-class module with dual-country charts and pair tables
- **Head of government** name + title on Dashboard (Wikidata P6 / Tavily+Groq enrichment)
- Resilient country series loading (client chunk 4 + server bisect on timeout)
- Global correlation uses year-range WDI snapshots; empty results return `CORRELATION_EMPTY` and are not cached
- PESTEL / Porter / SWOT palettes refreshed; shared `PageIntro` copy via `platformCopy.ts`
- Module toolbars extracted for Assistant, Business, Global, PESTEL, and Porter

### 2026-07-20 — Crime & public safety metrics
- Added **9 crime & public safety metrics** (UNODC, UN/WHO, IDMC, UCDP, World Bank WGI)
- New **Crime & public safety** dashboard accordion with KPI cards and trend charts
- Global Analytics: **Crime & safety** table tab; homicide rate on choropleth map
- Full enterprise documentation audit and synchronization (68-metric catalog)

### 2026-04-29 — Business reliability & FX governance
- Country dashboard FX: ECB daily quotes with World Bank institutional fallback
- Business Analytics: timeout resilience, presentation mode, strict-range governance
- Sources page: collapsible sections with collapsed-by-default top sections

---

## Repository structure

```
country-analytics-platform/
├── api/index.ts              # Vercel serverless handler
├── backend/src/              # Express API (45 TS modules)
├── frontend/src/             # React SPA (86 TS/TSX modules)
├── docs/                     # Enterprise documentation (21 files)
├── screenshots/              # UI reference captures
├── vercel.json               # Deployment config
└── package.json              # npm workspaces root
```

---

## License & usage

This is a private enterprise application. Outputs are **decision-support only**—correlation is not causation, and AI narratives require human review. See [`docs/GUARDRAILS.md`](docs/GUARDRAILS.md) for responsible-use boundaries.
