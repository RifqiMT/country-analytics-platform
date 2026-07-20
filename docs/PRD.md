# Product Requirements Document (PRD)

## 1) Product Overview

Country Analytics Platform is an analytics and decision-support web app that helps users explore country-level indicators and generate evidence-based explanations for strategic planning.

The platform combines:
- Country dashboard indicator analytics (cards + time trends + comparison)
- Global analytics (map, global tables, and world aggregate series)
- An AI analytics assistant (grounded responses anchored to platform evidence; optional verified live web grounding)
- Strategy modules (PESTEL and Porter Five Forces narrative output with structured scaffolding and fallbacks)
- Business analytics (multi-metric correlation + regression diagnostics with optional narrative interpretation)

## 2) Problem Statement

Teams working on markets, policy, or research often need answers such as:
- How has a country’s performance changed over time?
- How does one country compare against peers?
- What risks and opportunities are suggested by a set of indicators?

Traditional approaches require manual indicator lookup, inconsistent year handling, and fragile interpretation.

This product solves that by standardizing metric definitions and by presenting analyses with explicit evidence boundaries.

## 3) Target Users (and what they need)

| User group | Primary need | Why it matters |
| --- | --- | --- |
| Policy analysts | Reliable indicator trends and clear data-year context | Avoid misinterpretation and “out-of-date” decisions |
| Strategy managers | Structured strategy outputs tied to indicator evidence | Speed up synthesis for planning cycles |
| Research associates | Reproducible comparisons and auditable methodology | Reduce cleanup and reconciliation work |
| Product / operations leaders | Measurable quality, performance, and governance | Keep releases dependable and traceable |
| Security & risk analysts | Standardized crime, governance, and conflict indicators | Country safety profiling and regional benchmarking |
| Enterprise power users (BYOK) | Personal API key reuse across AI modules | Avoid server key provisioning delays |
| Executive reviewers | Clean presentation-ready analysis views | Leadership review without analyst UI clutter |

For persona details, see `docs/USER_PERSONAS.md`.

## 4) Product Goals

1. **Trustworthy analytics**: Keep metric scope fidelity, data-year transparency, and evidence attribution consistent.
2. **Faster time-to-insight**: Reduce the manual steps required to produce usable comparisons and strategic narratives.
3. **Explainability for review**: Provide traceability (where outputs came from) so users can evaluate confidence.
4. **Operational governance**: Release changes with traceability and documentation alignment.

## 5) Scope

### In scope (current)

- Country dashboard indicators and comparison views (including head-of-government name/title)
- Compare Countries dual-country trends, KPI deltas, and pair tables (`/compare`)
- Global analytics (map, global tables, and world aggregate series)
- Analytics Assistant (platform-grounded responses; optional verified-web mode)
- Strategy modules: PESTEL and Porter Five Forces
- Business Analytics: correlation/regression diagnostics + narrative interpretation (year-range snapshots; empty-result governance)
- Source and metric definitions explorer
- Crime & public safety indicators (9 metrics: homicide, GBV, conflict displacement, battle deaths, WGI governance) in dashboard accordion, global crime table, and choropleth map
- Resilient metric series delivery (client chunking + server bisect on timeout)

### Out of scope (current)

- Intraday streaming financial market feeds
- User-generated content ingestion (no unverified datasets)
- Fully autonomous decision-making without human review

## 6) Functional Requirements (FR)

Functional requirements are mapped to implementation and validation in `docs/TRACEABILITY_MATRIX.md`.

Examples of core FR capabilities:
- Deterministic comparison tables for requested metrics
- Assistant grounding with citation/safety gates
- Verified-web deterministic path for time-sensitive non-metric questions
- PESTEL and Porter structured output with fallback scaffolds
- Business Analytics: correlation diagnostics (r, p-value, r², slope, intercept, residuals) and narrative generation
- Persisted analysis across navigation until user regenerates
- Cross-app BYOK (Bring Your Own Key): users can supply Groq/Tavily keys in one header panel and reuse them across AI modules
- PESTEL strict grounding QA: low-evidence LLM outputs are rejected and replaced by deterministic evidence blends
- Crime & public safety dashboard section with 9 KPI metrics and 3 trend chart groups
- FX exchange-rate snapshot (USD/EUR) with ECB primary and World Bank fallback
- FX trend chart via dedicated time-series endpoint

## 7) Non-Functional Requirements (NFR)

Non-functional requirements are also mapped in `docs/TRACEABILITY_MATRIX.md`, and the AI/data boundaries are defined in `docs/GUARDRAILS.md`.

Primary NFR themes:
- Reliability: deterministic fallback when evidence quality is insufficient
- Performance: low-latency for interactive flows, with caching where appropriate; serverless budget governance (`CAP_SERVERLESS_BUDGET_MS`)
- Explainability: citation/routing transparency and data-year clarity
- Maintainability: docs, traceability, and metric catalogs remain synchronized
- Accessibility: keyboard operable controls, visible focus states, adequate contrast
- Security: BYOK keys never stored server-side; client-side storage only

## 7.1) Technical constraints

| Constraint | Value | Rationale |
| --- | --- | --- |
| Node.js runtime | ≥ 20 | Workspace engine requirement |
| Data year range | 2000 – current | WDI coverage alignment |
| Metric catalog size | 68 indicators | Canonical in `backend/src/metrics.ts` |
| Serverless max duration | 60s (Vercel) | Platform limit via `vercel.json` |
| Serverless app budget | 55s default | `CAP_SERVERLESS_BUDGET_MS` with reserve |
| API routes | 23 endpoints | Documented in `docs/API_REFERENCE.md` |

## 8) Key User Journeys (UX logic)

### Journey A: Dashboard → Comparison → Evidence check
1. Select country(s) and year window.
2. Choose metric(s) using catalog-defined IDs.
3. Compare values and interpret within unit + data-year context.

### Journey A2: Compare Countries pair analysis
1. Select Country A and Country B on `/compare`.
2. Review dual-line charts and pair tables by domain.
3. Interpret KPI deltas with unit-correct formatting.
4. Export PNG/CSV for stakeholder packs.

### Journey B: Assistant → Ranking/Comparison → Citations → Readiness
1. Ask a metric-scoped question (ranking/comparison) in natural language.
2. Assistant returns deterministic ranking tables where applicable.
3. Users review attribution/routing signals and citation context.

### Journey C: Strategy module output
1. Choose a focus country and (for Porter) an industry sector.
2. Generate PESTEL/Porter narrative output.
3. If AI keys are missing or evidence is thin, fall back to structured data-only templates.

### Journey D: Business Analytics correlation → Diagnostics → Hypothesis
1. Select metricX/metricY and year window.
2. Generate correlation diagnostics and residual plots.
3. Use narrative (when generated) as hypothesis guidance; confirm with robustness checks.
4. If long-range requests are slow, users can choose strict-range mode or reliability mode (automatic shorter-window fallback).

### Journey E: Crime & safety assessment
1. Select a focus country on the Dashboard.
2. Open the **Crime & public safety** accordion section.
3. Review homicide, conflict, and governance KPI cards and trend charts.
4. Switch to Global Analytics **Crime & safety** tab for regional benchmarking.
5. Export or screenshot findings for risk reports; consult Sources for institutional attribution.

## 9) Evidence and AI Strategy (high level)

The platform uses an evidence hierarchy:
1. **Platform evidence**: standardized metric series and deterministic tables
2. **Verified web evidence**: live retrieval and explicit citations for time-sensitive contexts
3. **AI synthesis**: only after scope + grounding controls apply

When evidence quality fails gates, the system uses deterministic fallbacks instead of unsupported claims.

### 9.1 BYOK operating model

- Users can provide personal API keys for Groq and Tavily in the header-level `AI API Keys (App-wide)` panel.
- Keys are attached to API requests through headers and can be validated via `/api/keys/validate`.
- Backend resolves key priority as: request-level user key -> server environment key -> deterministic fallback.

### 9.2 PESTEL quality strategy

- Web context for PESTEL uses snippet-only retrieval blocks (not synthesized web answers).
- LLM PESTEL output is filtered by grounding sanitizer, then validated by strict grounding QA.
- If grounded ratio/section quality fails thresholds, output is replaced by deterministic Tavily+data blend or data-only scaffold.

## 10) Metrics of Success

See `docs/METRICS_AND_OKRS.md` for:
- product metrics (trust/quality, performance, usage/outcomes, governance)
- OKRs for the product team

## 11) Risks and Mitigations

- Hallucination risk: mitigated with grounding, citation enforcement, and deterministic fallbacks.
- Data lag risk: mitigated with data-year transparency and clamped year handling.
- Misinterpretation risk: mitigated with units, evidence labeling, and explicit “correlation != causation” guidance.

Additional AI and technical constraints are documented in `docs/GUARDRAILS.md`.

## 12) Dependencies and operational prerequisites

- Data providers: World Bank WDI, with controlled enrichments/gap-fill behavior.
- LLM provider keys (optional): Groq for narrative generation paths.
- Web retrieval key (optional): Tavily for verified-web grounding paths.

For environment variable definitions, see `docs/VARIABLES.md`.

## 13) Release principles

Release changes that affect evidence behavior must update:
- `docs/TRACEABILITY_MATRIX.md`
- `docs/GUARDRAILS.md`
- any impacted API/assistant/variable documentation

For governance details, see `docs/PRODUCT_DOCUMENTATION_STANDARD.md`.

## 14) Current-state implementation notes (2026-04-29)

### 14.1 Exchange-rate requirement behavior

- Country dashboard exchange-rate card returns `1 USD = local currency` with source/date transparency.
- Source priority:
  1. ECB daily quote (via Frankfurter)
  2. World Bank official annual FX (`PA.NUS.FCRF`) fallback
- Validation/fallback logic prevents clearly anomalous values from being surfaced without fallback.

### 14.2 Business Analytics timeout-resilience behavior

- Correlation computation backend uses batched year processing with per-year fault tolerance.
- Frontend delivery applies timeout-aware multi-attempt logic:
  - full selected range first,
  - optional fallback to shorter recent windows when reliability mode is enabled,
  - strict selected-range mode available for exact-window analysis governance.
- Narrative generation has deterministic fallback if LLM JSON shape/timeout gates fail.

### 14.3 Crime & public safety metrics (2026-07-20)

- Platform metric catalog expanded to **68 indicators** across **6 data categories** (financial, demographics, health, education, labour, crime) plus a **UI-only `general` global table grouping**.
- Dashboard adds **Crime & public safety** accordion section with KPI cards and three trend chart groups:
  - Homicide rates (total, female, male)
  - Conflict indicators (IDP displacement, battle-related deaths)
  - Governance indices (rule of law, political stability, control of corruption)
- Global Analytics adds **Crime & safety** table tab; homicide rate selectable on choropleth map.
- Sources page includes crime category with UNODC, IDMC, UCDP, and WGI source attribution.
### 14.4 Head of government, Compare module, and series resilience (2026-07-20)

- Dashboard `HeadOfGovernmentCard` shows officeholder **name** and **title** from `GET /api/country/:cca3`.
- Name resolution: Tavily+Groq (when both keys present) preferred; else Wikidata P6; title from Wikidata P1313 or government-type inference.
- Compare Countries (`/compare`) is a first-class dual-country analysis surface with shared series resilience.
- Country series client uses chunk size 4, parallel waves of 2, retries, and recursive half-split; server bisects timed-out all-null batches and skips WLD proxy on batched calls.
- Business correlation uses year-range WDI snapshots; empty results return `503 CORRELATION_EMPTY` and are not cached.
- PESTEL/Porter/SWOT color tokens refreshed; shared `PageIntro` / `platformCopy` for module chrome.
