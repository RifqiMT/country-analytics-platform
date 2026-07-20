# Changelog

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
