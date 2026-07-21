# Changelog

## 2026-07-21 (Sixth pass — global choropleth analytics UX)

### Product & implementation alignment
- Documented **quintile choropleth tiers** (`choroplethTiers.ts`): 5 rank bands, semantic no-data/excluded fills, scope-aware breaks
- Documented **ChoroplethTierLegend** and **MapCountryTooltip** (rank, distribution stats, comparison line, distribution bar)
- Documented **metricTooltipBlurb** curated plain-English map metric summaries
- Documented compact **GlobalAnalyticsToolbar** single-row layout
- Added map tooltip motion tokens (`cap-map-tooltip*`) to `DESIGN_GUIDELINES.md`
- Extended traceability with **FR-37**; user story **D7**; guardrail **UG-05** (scope-dependent rank)
- Updated PRD Journey F, release checklist, testing strategy, architecture flow, variables §4.10

## 2026-07-20 (Fifth pass — sync docs to uncommitted UX/resilience release)

### Product & implementation alignment
- Documented **Compare Countries** (`/compare`) as a first-class module (8 modules total)
- Documented **head-of-government** name/title enrichment (`headOfGovernmentLookup.ts`, Dashboard card)
- Documented resilient country series loading (client chunk 4 + server bisect; `SERIES_TIMEOUT` / `x-cap-warning`)
- Documented Business Analytics year-range WDI snapshots + `CORRELATION_EMPTY` empty-result governance
- Updated PESTEL / Porter / SWOT / Compare color palettes in `DESIGN_GUIDELINES.md`
- Added motion tokens (toast progress, tools pulse, assistant thinking dots)
- Extended traceability with **FR-31–FR-36** and **NFR-09**
- Added user stories **D6**, **CP1–CP2**; updated personas module matrix
- Updated PRD journeys, API reference, variables dictionary, release checklist, analysis methods

## 2026-07-20 (Fourth pass — verification audit & final variable completion)

- Created **`docs/DOCUMENTATION_AUDIT_REPORT.md`** — formal audit report confirming 68 metrics, 23 routes, 23 doc files synchronized
- Completed **`docs/VARIABLES.md`** — added `SeriesPoint` provenance variables (§4.8) and dashboard comparison table variables (§4.9)
- Added documentation status stamp to root **`README.md`** with link to audit report
- Updated **`docs/PRODUCT_DOCUMENTATION_STANDARD.md`** — registry now lists 23 files including audit report
- Updated **`docs/README.md`** — catalog entry for audit report

## 2026-07-20 (Third pass — elaboration and cross-reference expansion)

- Rewrote **`docs/ASSISTANT_BEHAVIOR.md`** — full enterprise spec with routing diagram, evidence model, QA prompts
- Rewrote **`docs/ANALYSIS_METHODS.md`** — comprehensive correlation, PESTEL, Porter methodology with formulas and flowcharts
- Created **`docs/TESTING_STRATEGY.md`** — manual QA scope, API validation table, future automation roadmap
- Expanded **`docs/TRACEABILITY_MATRIX.md`** — PRD journey mapping, doc cross-reference, persona-to-FR matrix
- Expanded **`docs/USER_PERSONAS.md`** — persona-to-module matrix and workflow examples
- Expanded **`docs/USER_STORIES.md`** — epic overview table, stories D4 (FX) and D5 (comparison), FR traceability
- Expanded **`docs/PRD.md`** — additional personas, technical constraints table, NFR security/accessibility
- Expanded **`docs/GUARDRAILS.md`** — UX guardrails (UG-01–04), performance guardrails (PG-01–04)
- Expanded **`docs/PRODUCT_DOCUMENTATION_STANDARD.md`** — complete 22-file document registry

## 2026-07-20 (Second pass — comprehensive doc audit & gap closure)

### Documentation gaps closed
- **`docs/VARIABLES.md`**: Added `VITE_API_BASE_URL`, `CAP_SERVERLESS_BUDGET_MS`, `AWS_LAMBDA_FUNCTION_NAME`; fixed `GROQ_MODEL_PESTEL` default example; added EUR FX response fields, fx-series query/response vars, client storage keys (`cap.userApiKeys.v1`, session caches), `x-cap-warning` header, env variable relationship chart
- **`docs/API_REFERENCE.md`**: Added `GET /api/country/:cca3/fx-series` contract; expanded `GET /api/country/:cca3` response with USD/EUR FX, timezone, EEZ, WB profile fields
- **`docs/METRIC_CATALOG.md`**: Clarified 6 data categories + UI-only `general` grouping; added gap-fill fields section (`imfWeoIndicator`, `uisIndicatorId`, `shortLabel`)
- **`docs/DESIGN_GUIDELINES.md`**: Added dashboard chart series color conventions and choropleth map scale
- **`docs/TRACEABILITY_MATRIX.md`**: Added FR-29 (FX trend chart), FR-30 (FX snapshot quotes); documented legacy `POST /api/analysis/correlation` endpoint
- **`docs/RELEASE_READINESS_CHECKLIST.md`**: Expanded from 33 to full enterprise checklist with crime, FX, serverless, and sign-off sections
- **`docs/DEPLOYMENT_VERCEL.md`**: Expanded with timeout/budget alignment, troubleshooting, full env var table
- **`docs/ARCHITECTURE.md`**: Added FX pipeline, bootstrap/warmup, serverless budget, and frontend observability sections
- **`docs/PRD.md`**: Added Journey E (crime & safety assessment); corrected category count terminology
- **`.env.example`**: Added `GROQ_MODEL_BUSINESS`, `GROQ_FALLBACK_MODELS_BUSINESS`, `CAP_SERVERLESS_BUDGET_MS`

### Category terminology alignment
- Standardized language: **68 metrics in 6 data categories** + **1 UI-only `general` global table grouping** (not 7 metric categories)

## 2026-07-20 (Comprehensive documentation audit + crime metrics sync)

### Product & documentation
- Completed **full codebase audit**: 131 source files, 68 metrics, 7 app modules, 20+ API routes
- Created **`docs/PRODUCT_DOCUMENTATION.md`** — comprehensive product guide (overview, benefits, features, business/tech guidelines, stack)
- Expanded root **`README.md`** with metric coverage table, repository structure, role-based doc map, and latest highlights
- Updated **`docs/README.md`** with 2026-07-20 sync checkpoint and new document catalog entry
- Expanded **`docs/PRD.md`** with crime & public safety scope (§14.3) and in-scope feature list
- Added **Persona 7: Security & Risk Analyst** in `docs/USER_PERSONAS.md`
- Added **Section 5: Crime & Public Safety Analytics** user stories (C1–C4) in `docs/USER_STORIES.md`
- Expanded **`docs/VARIABLES.md`** with crime metric variable table and updated relationship chart
- Expanded **`docs/METRIC_CATALOG.md`** with category summary table and metric relationship Mermaid chart
- Expanded **`docs/DESIGN_GUIDELINES.md`** with brand tokens, PESTEL/Porter/SWOT palettes, crime dashboard patterns
- Added **FR-26–FR-28** to `docs/TRACEABILITY_MATRIX.md` for crime dashboard, global crime table, and Sources attribution
- Added **BG-04** crime interpretation guardrail to `docs/GUARDRAILS.md`
- Added **Objective 4** and crime adoption metrics to `docs/METRICS_AND_OKRS.md`
- Updated **`docs/EXECUTIVE_DOCUMENTATION_SUMMARY.md`** with 2026-07-20 release highlights

### Implementation (crime & public safety metrics)
- Added **9 crime & public safety metrics** sourced from credible institutions via World Bank WDI:
  - **UNODC**: intentional homicide rates (total, female, male)
  - **UN/WHO surveys**: intimate-partner violence against women
  - **IDMC**: new internal displacement from conflict and violence
  - **UCDP**: battle-related deaths
  - **World Bank WGI**: rule of law, political stability, control of corruption
- New **Crime & public safety** dashboard accordion with KPI cards and trend charts
- Global Analytics: new **Crime & safety** table tab; homicide rate available on choropleth map
- Sources page: crime category, UNODC/IDMC/UCDP/WGI source chips
- Updated `METRIC_CATALOG.md` (68 metrics total)

## 2026-04-29 (Business reliability + source governance sync)

- Upgraded Country Dashboard exchange-rate logic:
  - Added ECB daily quote path (via Frankfurter) with source/date transparency.
  - Added World Bank `PA.NUS.FCRF` institutional fallback and anomaly guard logic.
- Upgraded Business Analytics reliability and UX:
  - Added staged progress bars, request race guards, retry UX, and diagnostics badges.
  - Added strict selected-range mode and reliability fallback behavior for timeout scenarios.
  - Added presentation mode and keyboard shortcut (`P`) for executive review workflows.
  - Improved control-panel and results-area responsive design system.
- Upgraded Sources feature UX:
  - Added collapsible section/sub-section behavior (providers, category groups, metric formula/sources).
  - Set top Sources sections to collapsed-by-default for cleaner first view.
- Synchronized enterprise documentation:
  - Updated `README.md`, `docs/README.md`, `PRD.md`, `USER_PERSONAS.md`, `USER_STORIES.md`,
    `VARIABLES.md`, `METRICS_AND_OKRS.md`, `DESIGN_GUIDELINES.md`, `TRACEABILITY_MATRIX.md`,
    `GUARDRAILS.md`, and `PRODUCT_DOCUMENTATION_STANDARD.md`.

## 2026-04-27 (Documentation + Quality Revamp)

- Completed full documentation audit and synchronized enterprise docs to current implementation state.
- Added app-wide BYOK documentation: header key manager flow, request header contracts, and key validation endpoint (`POST /api/keys/validate`).
- Updated PRD/personas/stories to include cross-app key reuse and strict PESTEL grounding quality behavior.
- Expanded variables docs with request-header key variables and updated relationship chart.
- Updated architecture, guardrails, metrics/OKRs, and traceability matrix for:
  - strict PESTEL grounding QA gate,
  - snippet-only PESTEL web evidence policy,
  - SWOT rendering/quality stabilization,
  - deterministic fallback behavior under low evidence.
- Added `docs/RELEASE_READINESS_CHECKLIST.md` as operational governance artifact for release gate checks.
- Added `docs/EXECUTIVE_DOCUMENTATION_SUMMARY.md` as leadership-facing documentation status brief.

## 2026-04-27

- Added Vercel production deployment configuration via root `vercel.json` for static frontend output plus serverless API routing.
- Prepared backend for serverless runtime by exporting the Express app and guarding local listener startup when `VERCEL=1`.
- Added root serverless API handler at `api/index.ts` and documented rollout/validation in `docs/DEPLOYMENT_VERCEL.md`.
- Updated documentation index and root README to include the Vercel deployment runbook.

## 2026-03-21

- Expanded all markdown documentation for beginner-friendly readability.
- Reworked docs to include clearer explanations, practical structure, and easier onboarding flow.
- Updated README and docs to improve comprehension for users without prior project context.

## 2026-03-23
- Expanded enterprise documentation coverage for variables, full metric catalog, product metrics/OKRs, design guidelines, traceability, guardrails, and core product docs (PRD/personas/stories).
- Updated `docs/API_REFERENCE.md` to describe all exposed backend endpoints and key request/response contracts.
- Upgraded entry and governance documentation to enterprise level:
  - Expanded root `README.md` with product overview, benefits, feature logic, stack, and complete documentation map.
  - Expanded `docs/README.md` with role-based reading paths and document ownership intent.
  - Reworked `docs/PRODUCT_DOCUMENTATION_STANDARD.md` with mandatory structure, synchronization rules, and definition-of-done gates.
