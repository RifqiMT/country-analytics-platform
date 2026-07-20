# User Stories and Acceptance Guidance

This document defines the platform’s primary user stories and includes acceptance guidance aligned to current implementation behavior.

Stories are written in user language, but each acceptance section is specific enough to guide QA and engineering verification.

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
