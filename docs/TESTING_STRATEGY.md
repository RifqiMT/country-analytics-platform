# Testing Strategy — Manual QA and Future Automation

**Document version:** 2026-07-20  
**Status:** Manual QA is the current validation baseline (no automated test suite yet)

---

## 1. Purpose

Define how the Country Analytics Platform validates quality today and how automated testing should be introduced in future releases. This document supports governance claims in `TRACEABILITY_MATRIX.md` and `RELEASE_READINESS_CHECKLIST.md`.

---

## 2. Current state

| Aspect | Status |
| --- | --- |
| Automated unit tests | **Not present** (`*.test.ts`, `*.spec.ts` absent) |
| Automated integration tests | **Not present** |
| E2E tests (Playwright/Cypress) | **Not present** |
| Manual QA | **Primary validation method** |
| Release checklist | `docs/RELEASE_READINESS_CHECKLIST.md` |
| Traceability validation column | `docs/TRACEABILITY_MATRIX.md` FR/NFR rows |

---

## 3. Manual QA scope by module

### 3.1 Country Dashboard
- Country select persists (`cap-selected-country-cca3`)
- All accordion sections render (Financial, Demographics, Health, Education, Labour, Crime & safety)
- FX snapshot card: rate, currency, as-of date, source
- FX trend chart via `/api/country/:cca3/fx-series`
- Comparison table: country vs regional avg vs global
- Chart/table toggle, PNG export, fullscreen mode

### 3.2 Global Analytics
- Choropleth map with metric selector (incl. `homicide_rate`)
- Table tabs: general, financial, health, education, crime
- Region filter and sortable columns
- WLD aggregate charts

### 3.3 Analytics Assistant
- Metric ranking/comparison prompts → deterministic tables
- Verified-web prompts → citation behavior or fallback
- BYOK key validation and reuse
- No placeholder citation leakage (`[D#]`, `[W#]`)

### 3.4 PESTEL / Porter
- Generate with Groq key → structured output
- Generate without key → scaffold fallback
- PESTEL grounding QA → fallback on thin evidence
- SWOT: exactly 5 bullets per quadrant

### 3.5 Business Analytics
- Correlation: r, p-value, r², slope, intercept, residuals
- IQR outlier toggle
- Strict vs reliability mode
- Presentation mode (button + keyboard `P`)
- Session persistence until regenerate

### 3.6 Sources
- 68 metrics listed with correct categories
- Crime source chips (UNODC, IDMC, UCDP, WGI)
- Collapsible sections default collapsed

---

## 4. API contract validation (manual)

| Endpoint | Key assertions |
| --- | --- |
| `GET /api/health` | `{ ok: true }` |
| `GET /api/metrics` | 68 items; categories match code |
| `GET /api/country/IDN/series?metrics=gdp&start=2020&end=2023` | Valid series array |
| `GET /api/country/IDN/fx-series?start=2020&end=2023` | `usdToLocal`, `eurToLocal` arrays |
| `GET /api/analysis/correlation-global?metricX=gdp_per_capita&metricY=life_expectancy&start=2000&end=2023` | r, n, points array |
| `POST /api/assistant/chat` | Non-empty response; no internal placeholders |
| `POST /api/keys/validate` | Per-provider ok/message |

---

## 5. Recommended future automation (priority order)

| Priority | Test type | Target | Rationale |
| --- | --- | --- | --- |
| P1 | API integration | `correlationGlobal.ts`, `/api/country/:cca3/series` | Deterministic math; high regression risk |
| P1 | API integration | Metric catalog sync (`metrics.ts` ↔ `/api/metrics`) | Prevents doc/code drift |
| P2 | Unit | `pestelGrounding.ts`, `assistantReplyPolish.ts` | Safety-critical grounding gates |
| P2 | E2E smoke | Dashboard load + one API call | Catches deploy breakage |
| P3 | E2E workflow | Assistant ranking prompt | Validates end-to-end AI path |
| P3 | Snapshot | PESTEL SWOT rendering | Visual regression for bullet formatting |

When automated tests are added, update:
- `docs/TRACEABILITY_MATRIX.md` validation columns
- `docs/GUARDRAILS.md` OG-04
- This document's current-state table

---

## 6. Benchmark prompt suite (assistant quality)

Maintain a stable set of prompts for release regression:

1. "Rank top 5 countries by GDP per capita in 2023"
2. "Compare Indonesia and Brazil on population and life expectancy"
3. "What % of the global top is Indonesia's GDP per capita?"
4. "Who is the current head of government in Germany?" (verified-web)
5. "Explain correlation between GDP and life expectancy" (should stay metric-scoped or redirect)

Record grounded pass rate and fallback activation rate per release (see `docs/METRICS_AND_OKRS.md`).

---

## 7. Related documents

- `docs/RELEASE_READINESS_CHECKLIST.md` — pre-release manual gate
- `docs/TRACEABILITY_MATRIX.md` — requirement-to-validation mapping
- `docs/GUARDRAILS.md` — OG-04 manual QA baseline
- `docs/USER_STORIES.md` — acceptance criteria source
