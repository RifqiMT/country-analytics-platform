# User Stories and Acceptance Guidance

This document defines the platform’s primary user stories and includes acceptance guidance aligned to current implementation behavior.

Stories are written in user language, but each acceptance section is specific enough to guide QA and engineering verification.

## Epic overview and traceability

| Epic | Stories | Traceability (FR) | Primary persona |
| --- | --- | --- | --- |
| Dashboard & Global Analytics | D1–D9 | FR-01, FR-02, FR-22, FR-29–FR-32, FR-37–FR-39 | Policy Analyst, Research Associate |
| Compare Countries | CP1–CP2 | FR-36, FR-32, FR-33, FR-38 | Policy Analyst, Research Associate |
| Analytics Assistant | A1–A4 | FR-04–FR-08, FR-18, FR-19 | Strategy Manager, BYOK User |
| Strategy Modules | S1–S3 | FR-09–FR-12, FR-20, FR-21, FR-34 | Strategy Manager |
| Business Analytics | B1–B4 | FR-13–FR-15, FR-23, FR-24, FR-35 | Research Associate, Executive Reviewer |
| Crime & Public Safety | C1–C4 | FR-26–FR-28 | Security & Risk Analyst |

---

## 1) Dashboard and Global Analytics

### Story D1: Control country and year range

**Story:** As an analyst, I want to control the country and year range so I can evaluate trends with correct time context.

**Acceptance criteria:**
- Users can select a country focus and a year window.
- Series display and comparisons reflect the **actual data year** used by the backend after clamping/fallback.
- The UI keeps units visible and consistent in all views.

### Story D2: Metric-scoped comparisons

**Story:** As a researcher, I want metric-scoped comparison views so I can benchmark countries on requested indicators.

**Acceptance criteria:**
- Comparison/ranking views are driven by metric IDs from the metric catalog.
- Values render in unit-correct format, including missingness handling (no implicit “zero”).
- Sorting works reliably and produces stable ordering.

### Story D3: Export-ready outputs

**Story:** As a decision-maker, I want export-ready outputs so I can share findings in reports.

**Acceptance criteria:**
- Exports reflect the current filters and selection state (year range, regions/categories, and metrics).
- Exports function in both normal and fullscreen modes.

### Story D4: FX exchange-rate transparency

**Story:** As a financial analyst, I want to see current USD/EUR exchange rates and historical trends with source attribution so I can trust the currency context for country analysis.

**Acceptance criteria:**
- Country profile card shows `1 USD = local currency` and `1 EUR = local currency` with as-of date and source institution.
- FX trend chart loads dual-series USD/EUR data from `/api/country/:cca3/fx-series`.
- When ECB daily quote is unavailable, World Bank institutional fallback is used and labeled.
- Chart supports table toggle, PNG export, and fullscreen mode.

### Story D5: Dashboard comparison benchmarking

**Story:** As a policy analyst, I want a comparison table showing my focus country against regional average and global benchmark so I can contextualize performance.

**Acceptance criteria:**
- Comparison table loads via `/api/dashboard/comparison` with country, regional avg, and global columns.
- YoY percentage and basis-point deltas display where prior-year data exists.
- Table is sortable and reflects the actual data year returned by the backend.

### Story D6: Head of government context

**Story:** As a policy analyst, I want to see the current head of government name and office title on the country dashboard so I can orient briefings without leaving the app.

**Acceptance criteria:**
- Dashboard shows a dedicated head-of-government card with name (when available) and role/title badge.
- When name is unavailable, UI shows a clear “Not reported” (or equivalent) state—not a blank card.
- Values come from `GET /api/country/:cca3` (`headOfGovernmentName`, `headOfGovernmentTitle`).

### Story D7: Choropleth tier legend and map tooltip analytics

**Story:** As a global analyst, I want the choropleth map to show rank-based color tiers and a rich country tooltip so I can interpret how a country compares to peers without exporting data.

**Acceptance criteria:**
- Map uses five quantile tiers within the active region scope; legend shows tier labels, rank bands, and economy count.
- Hover tooltip displays country value, curated metric blurb, **tier badge** (short label + rank band), rank (#N of M), distribution stats (lowest/median/highest/mean/mode), and a comparison line.
- Comparison line uses concise copy at extremes (“Highest/Lowest value on this map”) or `#N of M · outranks X%`.
- Tooltip repositions to stay in viewport; `prefers-reduced-motion` disables entrance animation.
- “No data” countries use `CHOROPLETH_NO_DATA` fill and do not show fabricated ranks.

### Story D8: Consistent analytical table UX

**Story:** As an analyst reviewing multiple modules, I want comparison and global tables to share the same sorting, sticky labels, and missing-value treatment so I can scan results quickly.

**Acceptance criteria:**
- Dashboard comparison, Compare pair, Global category, and chart/table series views use the shared `DataTable` component system.
- First metric/country column is sticky on wide tables; sortable headers show active state and `aria-sort`.
- Missing values render as `DataTableEmpty` (`—`); row-count footer displays filtered totals.
- Compare pair table uses A/B accent column tints and highlights the leading country value per row.

### Story D9: Global table matrix load and sparse-data honesty

**Story:** As a global analyst, I want Global Analytics tables to load complete category matrices (including UHC from WHO when WDI is archived) and to show clear empty/Not reported states when data is missing.

**Acceptance criteria:**
- Health/education/financial/crime tables load via metric-matrix composition (not per-cell country series backfill).
- `uhc_service_coverage` can show WHO GHO-sourced values when WDI is empty; Sources lists WHO GHO.
- Empty table responses show amber warning for `global-table-empty` and an empty-state panel — not a silent blank table.
- Missing cells show “Not reported”; map side table lists all scoped countries even with null values.

## 1.1) Compare Countries

### Story CP1: Dual-country trend comparison

**Story:** As a researcher, I want to compare two countries on the same metrics over time so I can prepare peer benchmarks quickly.

**Acceptance criteria:**
- Users can select Country A and Country B on `/compare`.
- Dual-line charts and pair tables render with distinct A/B colors (`#1d4ed8` / `#c2410c`).
- KPI deltas use unit-correct formatting (including bps where applicable).
- Country pair selection persists for the browser tab (`sessionStorage`).

### Story CP2: Export compare outputs

**Story:** As a decision-maker, I want export-ready compare charts and tables for stakeholder packs.

**Acceptance criteria:**
- PNG export works for chart mode; CSV export works for table mode.
- Exports respect current country pair, year window, and metric selection.

## 2) Analytics Assistant

### Story A1: Scope fidelity for metric questions

**Story:** As a strategy user, I want assistant responses to stay within the requested metric scope so I can trust scope fidelity.

**Acceptance criteria:**
- For metric-scoped intents, replies are anchored to platform evidence using deterministic comparison/ranking outputs where applicable.
- Drift detection triggers fallback when the reply risks leaving the approved metric scope.

### Story A2: Web grounding for time-sensitive questions

**Story:** As a user, I want time-sensitive/current-event questions to be grounded in verified live web evidence when needed.

**Acceptance criteria:**
- Verified-web deterministic path activates for eligible time-sensitive questions when web evidence is required.
- Web evidence is cited and treated as excerpt text supporting specific claims.
- If web context is too thin, the response uses fallback behavior and avoids unsupported assertions.

### Story A3: Attribution transparency

**Story:** As a user, I want attribution transparency so I can evaluate trust.

**Acceptance criteria:**
- The UI exposes routing/category signals (dashboard vs web vs verified web).
- Citation behavior is consistent with the evidence model and does not leak placeholder tokens.

### Story A4: App-wide BYOK key usage

**Story:** As a power user, I want my Groq/Tavily keys entered once and reused across all AI modules.

**Acceptance criteria:**
- Header key manager accepts and stores user keys according to session/persistent preference.
- Backend receives keys via request headers and applies them to Assistant, PESTEL, Porter, and Business narrative routes.
- Key validation endpoint returns provider-specific pass/fail feedback.

## 3) Strategy Modules (PESTEL / Porter)

### Story S1: Coherent PESTEL and Porter narratives

**Story:** As a manager, I want coherent PESTEL/Porter narratives so I can use them in planning meetings.

**Acceptance criteria:**
- Output is structured into stable sections suitable for stakeholder review.
- The UI renders the narrative even when AI generation is not available (data-only scaffold fallback).

### Story S2: Reliable fallback when AI output is weak

**Story:** As a stakeholder, I want reliable fallback behavior when AI output is weak so the app remains dependable.

**Acceptance criteria:**
- If generation fails grounding/safety checks (or AI keys are missing), deterministic scaffold output is returned.
- Attribution indicates when fallback/scaffold mode was used.

### Story S3: PESTEL strict grounding quality gate

**Story:** As a strategy stakeholder, I want PESTEL output to reject unsupported claims and return only evidence-backed content.

**Acceptance criteria:**
- PESTEL web context uses snippet-only retrieval evidence.
- LLM output is sanitized and validated by grounding ratio/section checks.
- If quality gate fails, backend returns deterministic Tavily+data blend or data-only scaffold with stable schema.

## 4) Business Analytics

### Story B1: Correlation diagnostics and relative interpretation

**Story:** As an analyst, I want variable-focused correlation analysis and relative comparison so I can interpret risks and opportunities using consistent statistics.

**Acceptance criteria:**
- The module computes and displays Pearson correlation `r`, p-value approximation, `r²` proxy, regression slope/intercept, and residual-based diagnostics.
- Optional IQR outlier exclusion is applied and reflected in results.
- The UI clearly labels correlation as correlation (not causation).

### Story B2: Persist analysis until regenerate

**Story:** As a user, I want analysis persistence across navigation until I regenerate it so I can keep my workflow intact.

**Acceptance criteria:**
- Generated correlation/narrative data is restored when returning to the module.
- Changing filters invalidates prior results and clears until the user clicks “Generate analysis” again.

### Story B3: Survive timeout and still deliver analysis

**Story:** As an analyst, I want business analytics to still return usable output when long queries are slow.

**Acceptance criteria:**
- Progress indicators are visible during analysis and narrative generation.
- If reliability mode is enabled, the frontend can automatically retry with narrower windows.
- If strict mode is enabled, only the selected range is attempted.
- When fallback range is used, the UI explicitly tells users which window was delivered.

### Story B4: Executive-ready presentation mode

**Story:** As an executive reviewer, I want to view business results without control-panel noise.

**Acceptance criteria:**
- Presentation mode hides diagnostics and filter chrome while keeping core results visible.
- Users can toggle presentation mode via button and keyboard shortcut (`P`).
- Shortcut is ignored while typing in editable controls.

## 5) Crime & Public Safety Analytics

### Story C1: Dashboard crime & safety section

**Story:** As a security analyst, I want a dedicated crime & public safety section on the country dashboard so I can assess violence, conflict, and governance indicators for a focus country.

**Acceptance criteria:**
- Dashboard accordion includes a **Crime & public safety** section with KPI cards for all 9 crime metrics.
- Three trend chart groups render: homicide rates, conflict indicators, and governance indices.
- Charts support chart/table toggle, PNG export, and fullscreen mode.
- Metric values display with correct units (per 100,000, %, cases, people, index).

### Story C2: Global crime table and map

**Story:** As a risk analyst, I want to compare crime & safety indicators across countries in a global table and map so I can benchmark regional safety profiles.

**Acceptance criteria:**
- Global Analytics table includes a **Crime & safety** category tab.
- Table displays all crime-category metrics with sortable columns.
- Choropleth map supports `homicide_rate` as a selectable metric.
- Region filter and year selection apply consistently to crime table rows.

### Story C3: Crime metric transparency in Sources

**Story:** As a researcher, I want crime metrics documented with source attribution so I can cite credible institutions in reports.

**Acceptance criteria:**
- Sources page lists crime category metrics with UNODC, IDMC, UCDP, and WGI source chips.
- Each metric card shows formula (if derived), World Bank code, and source URL.
- Metric definitions match `docs/METRIC_CATALOG.md` and `backend/src/metrics.ts`.

### Story C4: Responsible crime data interpretation

**Story:** As a product user, I want clear guardrails on crime data interpretation so I do not over-interpret sparse or perception-based indicators.

**Acceptance criteria:**
- GBV and survey-based metrics are not presented as complete country coverage.
- WGI indices are labeled as perception-based governance estimates.
- Conflict metrics reflect documented source definitions (IDMC displacement cases, UCDP battle deaths).
- Guardrails documented in `docs/GUARDRAILS.md` (BG-04) are reflected in Sources methodology text.
