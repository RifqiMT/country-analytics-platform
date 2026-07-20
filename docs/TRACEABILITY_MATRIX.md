# Enterprise Traceability Matrix (Product Requirements → Implementation)

This matrix helps teams answer a simple enterprise question:

> “When we promise a capability in the product, where is it implemented, and how do we know it works?”

It is not meant to replace testing. Instead, it provides a release-ready mapping for QA planning, engineering review, and product governance.

## How to read this document

- **FR** = Functional requirement (feature behavior visible to users)
- **NFR** = Non-functional requirement (reliability, performance, safety, maintainability)
- **Implementation** lists the primary code locations that deliver the requirement
- **Validation** describes practical verification steps (manual QA + automated checks where applicable)

## 1) Functional requirements (FR)

| Req ID | Requirement | Primary Implementation | Supporting Files | Validation |
| --- | --- | --- | --- | --- |
| FR-01 | Country dashboard shows metric KPIs, trends, and comparison blocks | `frontend/src/pages/Dashboard.tsx` | `backend/src/index.ts` routes for country series + dashboard comparison | Manual UI review + API contract checks for year range and metric scope |
| FR-02 | Global analytics supports map, global tables, and world aggregate charts | `frontend/src/pages/GlobalAnalytics.tsx` | `backend/src/globalTable.ts`, `backend/src/globalSnapshot.ts`, `backend/src/dashboardComparison.ts`, world chart components | Year fallback tests and category filter checks |
| FR-03 | Country/series API validates metric IDs and returns series bundles | `backend/src/index.ts` (`/api/country/:cca3/series`) | `backend/src/worldBank.ts` bundle assembly | Unknown metric → 400; valid metrics → series payload schema |
| FR-04 | Assistant provides grounded ranking and comparison answers within platform metric scope | `backend/src/index.ts` (`/api/assistant/chat`) | `backend/src/assistantRankingBlock.ts`, `backend/src/assistantReplyPolish.ts`, `backend/src/assistantReplyTableDedupe.ts` | Benchmark ranking/comparison prompts; verify deterministic table outputs |
| FR-05 | Assistant includes `% of top` relative values in country comparisons | `backend/src/index.ts` comparison reply builder | `backend/src/dashboardComparison.ts` | Table output validation in Assistant comparison UI |
| FR-06 | Assistant supports web-grounded mode for time-sensitive non-metric questions | `backend/src/index.ts` (verified-web deterministic path) | `backend/src/assistantTavilyFallback.ts`, `backend/src/assistantCitationContext.ts` | Prompt suite QA for officeholder/current-events questions; verify web-only claims are cited |
| FR-07 | Assistant enforces citation presence and sanitizes placeholder citations | `backend/src/index.ts` + `backend/src/assistantReplyPolish.ts` | `backend/src/assistantReplyPolish.ts` | Regression prompts: ensure no `[D#]`/`[W#]` placeholders leak to user-visible text |
| FR-08 | Assistant verified-web badge shows correct mode for users | `frontend/src/pages/Assistant.tsx` | `frontend/src/lib/assistantAnswerPresentation.ts` | Visual + behavior QA: badge appears only for verified-web deterministic path |
| FR-09 | PESTEL generates structured narrative sections (with two-paragraph comprehensive sections) | `frontend/src/pages/Pestel.tsx` | `backend/src/pestelAnalysis.ts`, `backend/src/pestelDigestKeys.ts` | JSON schema validation + UI render + fallback behavior without Groq key |
| FR-10 | Porter Five Forces generates force-level analysis and narrative sections | `frontend/src/pages/Porter.tsx` | `backend/src/porterAnalysis.ts`, `backend/src/porterTavily.ts` | Grounding checks and fallback behavior with thin web context |
| FR-11 | PNG export is available for Porter and PESTEL charts/cards | `frontend/src/components/ExportPngButton.tsx` | `frontend/src/lib/exportPng.ts` | Visual QA: PNG export produces non-empty output at normal + fullscreen sizes |
| FR-12 | Standardized PESTEL SWOT card layout and bullet formatting | `frontend/src/components/pestel/*` | `backend/src/pestelAnalysis.ts` output shape | UI snapshot checks + semantic review of SWOT bullet formatting |
| FR-13 | Business Analytics correlation computes r, p-value, regression diagnostics, and plot data | `backend/src/index.ts` (`/api/analysis/correlation-global`) | `backend/src/correlationGlobal.ts` | Numeric sanity QA: outlier counts, r/r² consistency, regression line plausibility |
| FR-14 | Business Analytics narrative generation is triggered only when user clicks generate | `frontend/src/pages/BusinessAnalytics.tsx` | `backend/src/index.ts` (`/api/analysis/business/correlation-narrative`) | UX QA: narrative not generated on filter changes until “Generate analysis” |
| FR-15 | Business Analytics analysis persists across navigation until user regenerates | `frontend/src/lib/businessCorrelationCache.ts` | `sessionStorage` persistence + cache load/save | Navigation QA: confirm restored analysis is still visible after route changes |
| FR-16 | Fullscreen mode resizes tables/charts to avoid blank space and nested action bugs | `frontend/src/components/charts/ChartTableToggle.tsx` | fullscreen CSS rules in `frontend/src/index.css` | Responsive QA in fullscreen + export-from-fullscreen checks |
| FR-17 | Sources explorer lists metric definitions with units, formulas, and source links | `frontend/src/pages/Sources.tsx` | `backend/src/index.ts` `/api/metrics`, `/api/data-providers` | Spot checks: metric formula and source links match catalog entries |
| FR-18 | App-wide AI key manager reuses user keys across AI modules | `frontend/src/components/assistant/UserApiKeysHeaderPanel.tsx`, `frontend/src/lib/userApiKeys.ts`, `frontend/src/api.ts` | backend key resolver in `backend/src/index.ts` | Enter keys once, run Assistant/PESTEL/Porter/Business narrative, verify provider usage and successful responses |
| FR-19 | Key validation endpoint returns provider-specific status | `backend/src/index.ts` (`POST /api/keys/validate`) | header panel validate flow | Validate valid/invalid keys and confirm per-provider status text |
| FR-20 | PESTEL strict grounding gate rejects weak LLM output | `backend/src/pestelGrounding.ts`, `backend/src/index.ts` | `backend/src/pestelTavily.ts`, `backend/src/pestelAnalysis.ts` | Prompt tests on high-risk countries/topics: verify fallback to deterministic blend when grounding QA fails |
| FR-21 | SWOT cards render stable five bullet items per quadrant without truncation artifacts | `frontend/src/components/pestel/PestelSwotGrid.tsx` | `backend/src/pestelAnalysis.ts` SWOT normalization | Visual QA: no sentence-fragment splitting, no line-clamp clipping, exactly five usable bullets |
| FR-22 | Country dashboard exchange-rate card returns source-aware USD quote with institutional fallback | `backend/src/index.ts` (`fetchUsdFxSnapshot`, `fetchBestUsdFxSnapshot`) | `frontend/src/pages/Dashboard.tsx`, `frontend/src/api.ts` | Validate sample countries show `1 USD = ...` with source/date; verify fallback path when ECB quote unavailable |
| FR-23 | Business Analytics supports strict mode vs reliability fallback delivery | `frontend/src/pages/BusinessAnalytics.tsx` | `backend/src/correlationGlobal.ts` batched fetch, `/api/analysis/correlation-global` | QA both modes: strict (no fallback), reliability (narrow-window fallback with delivery note) |
| FR-24 | Business Analytics presentation mode and keyboard toggle | `frontend/src/pages/BusinessAnalytics.tsx` | keydown handler + view toggle | Keyboard `P` toggles mode; typing in input/select/textarea/contenteditable does not toggle |
| FR-25 | Sources page supports collapsible major sections and metric sub-sections | `frontend/src/pages/Sources.tsx` | accordion state controls (`providersOpen`, `accordionOpen`, category + card disclosure states) | Verify top sections collapsed by default and all chevrons toggle open/close states |
| FR-26 | Dashboard crime & public safety section with KPI cards and trend charts | `frontend/src/pages/Dashboard.tsx` (crime accordion, chart groups) | `backend/src/metrics.ts` (crime category), `backend/src/index.ts` series routes | Select country with crime data; verify 9 KPI cards and 3 chart groups render with correct units |
| FR-27 | Global Analytics crime table tab and homicide choropleth | `frontend/src/pages/GlobalAnalytics.tsx` | `backend/src/globalTable.ts` (crime category), `backend/src/globalSnapshot.ts` | Switch to Crime & safety tab; select homicide_rate on map; verify sortable table columns |
| FR-28 | Crime metrics documented in Sources with institutional source attribution | `frontend/src/pages/Sources.tsx` | `GET /api/metrics`, `GET /api/data-providers` | Verify crime category shows UNODC/IDMC/UCDP/WGI source chips and metric definitions match catalog |
| FR-29 | Dashboard FX trend chart loads USD/EUR exchange-rate time series | `frontend/src/pages/Dashboard.tsx` | `GET /api/country/:cca3/fx-series`, `backend/src/fxSeries.ts` | Select country with FX data; verify chart renders dual-series USD/EUR lines with source labels |
| FR-30 | Country profile returns USD/EUR snapshot quotes with source transparency | `backend/src/index.ts` (`fetchUsdFxSnapshot`, `fetchBestUsdFxSnapshot`) | `frontend/src/api.ts` `CountrySummary` | Verify hero FX card shows rate, currency, as-of date, and source institution |

### Legacy / internal endpoints

| Endpoint | Status | Notes |
| --- | --- | --- |
| `POST /api/analysis/correlation` | Legacy | Single-country correlation; not consumed by current frontend; prefer `GET /api/analysis/correlation-global` |

## 2) Non-functional requirements (NFR)

| Req ID | Requirement | Primary Implementation | Validation |
| --- | --- | --- | --- |
| NFR-01 | Reliability through deterministic fallbacks when LLM/web evidence is insufficient | `backend/src/index.ts` fallback gates | Prompt suite: failure modes return stable scaffold outputs |
| NFR-02 | Safety through citation and drift controls for assistant replies | `backend/src/index.ts`, `backend/src/assistantCitationContext.ts`, `backend/src/assistantReplyPolish.ts` | Regression prompts: placeholder tokens do not leak |
| NFR-03 | Performance for interactive use cases | caching + reduced metric fetching in assistant | Manual timing QA + backend timing logs for endpoints |
| NFR-04 | Explainability with attribution and visible context | assistant attribution + UI presentation | UI QA on attribution text + citation behavior |
| NFR-05 | Maintainability through documented APIs and variables | docs set + metric catalog alignment | Doc drift review + catalog sync checks |
| NFR-06 | Accessibility in UI states (focus, keyboard, contrast) | consistent component styling | Accessibility review (keyboard + contrast) |
| NFR-07 | PESTEL hallucination containment through snippet-only retrieval + strict grounding QA | `backend/src/pestelTavily.ts`, `backend/src/pestelGrounding.ts`, `backend/src/index.ts` | Controlled prompt set shows grounded output or deterministic fallback with attribution signal |
| NFR-08 | Business analytics timeout resilience for large year windows | `backend/src/correlationGlobal.ts` (batched year processing + per-year tolerance), `frontend/src/pages/BusinessAnalytics.tsx` (retry/fallback delivery logic) | Long-window regression checks: successful completion under reliability mode with explicit fallback disclosure |

## 3) Governance controls and release rule

Release changes that affect any assistant/analysis output behavior must be accompanied by:
- An update to the corresponding documentation in `docs/`
- A review in `TRACEABILITY_MATRIX.md` mapping for the touched requirement(s)
- A guardrails alignment check in `docs/GUARDRAILS.md`
