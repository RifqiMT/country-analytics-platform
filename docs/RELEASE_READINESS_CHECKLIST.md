# Release Readiness Checklist

Use this checklist before production releases to keep analytics quality, guardrails, and documentation synchronized.

**Release date:** _______________  
**Release owner:** _______________  
**Version/tag:** _______________

---

## 1. Product and UX checks

- [ ] All eight modules load without console errors: Dashboard, Compare Countries, Global Analytics, Assistant, PESTEL, Porter, Business Analytics, Sources
- [ ] Country Dashboard: country select, year range, all accordion sections (incl. Crime & public safety) render KPI cards and charts
- [ ] Country Dashboard: head-of-government card shows name/title or clear “Not reported” state
- [ ] Country Dashboard: FX snapshot card shows rate, currency, as-of date, and source label
- [ ] Country Dashboard: FX trend chart loads via `/api/country/:cca3/fx-series`
- [ ] Compare Countries: dual-country charts, pair tables, A/B colors, PNG/CSV export
- [ ] Global Analytics: choropleth map with quintile tier legend, analytics tooltip (rank/stats/blurb), compact toolbar
- [ ] Series resilience: large metric loads complete via chunking/retry without unhandled UI crash
- [ ] Assistant, PESTEL, Porter, and Business Analytics complete primary user flows
- [ ] App-wide AI key manager: save, clear, validate, and reuse keys across all AI modules
- [ ] Business Analytics: presentation mode toggle (button + keyboard `P`) works; ignored while typing in inputs
- [ ] Business Analytics: empty correlation returns governed empty-state (no silent cache of `n=0`)
- [ ] Sources page: top sections collapsed by default; metric cards expand/collapse correctly
- [ ] Shared PageIntro chrome (eyebrow/lead/highlights) consistent across modules
- [ ] Error states are user-readable (no raw stack traces or internal prompt artifacts)

---

## 2. AI and data quality checks

- [ ] Assistant verified-web behavior uses citation-safe output and deterministic fallback when evidence is thin
- [ ] Assistant ranking/comparison tables return deterministic metric-scoped outputs
- [ ] PESTEL output passes strict grounding gate or falls back to deterministic data/web blend
- [ ] Porter output renders with stable schema even when Groq key is absent
- [ ] SWOT cards render exactly five readable bullets per quadrant without truncation artifacts
- [ ] Business Analytics narrative generates only on explicit "Generate" click
- [ ] Correlation results include r, p-value, r², slope, intercept, and residual diagnostics

---

## 3. API and integration checks

- [ ] `GET /api/health` returns `{ ok: true }`
- [ ] `GET /api/metrics` returns 68 metric definitions with correct categories
- [ ] `GET /api/country/:cca3/fx-series` returns valid `FxSeriesPayload` for test countries (e.g. IDN, USA)
- [ ] `POST /api/keys/validate` returns provider-specific status for Groq and Tavily
- [ ] Header-based user keys (`X-User-Groq-Api-Key`, `X-User-Tavily-Api-Key`) honored by all AI endpoints
- [ ] Global table `category=crime` returns crime metrics for valid year
- [ ] Endpoint contracts in `docs/API_REFERENCE.md` match current request/response behavior

---

## 4. Performance and reliability checks

- [ ] `npm run build` passes for both backend and frontend workspaces
- [ ] Serverless deployment: API responses complete within Vercel `maxDuration` (60s) and `CAP_SERVERLESS_BUDGET_MS` (default 55s)
- [ ] Business Analytics long-range correlation completes or falls back with explicit delivery note
- [ ] Bootstrap warmup behavior verified (skipped on serverless; optional locally via `DISABLE_BOOTSTRAP_WARMUP=1`)
- [ ] Fallback paths are deterministic when keys are missing or provider calls fail
- [ ] API transport panel shows healthy request execution for core workflows

---

## 5. Crime & safety feature checks (if crime metrics touched)

- [ ] Dashboard Crime & public safety section: 9 KPI cards with correct units
- [ ] Three crime chart groups render (homicide, conflict, governance)
- [ ] Global Analytics Crime & safety tab sortable and region-filtered
- [ ] Choropleth tier legend updates when region filter changes
- [ ] Map tooltip shows rank and distribution stats; no rank for no-data countries
- [ ] Sources page crime category shows UNODC, IDMC, UCDP, WGI attribution

---

## 6. Documentation and governance checks

- [ ] `docs/CHANGELOG.md` includes dated release entry with impact summary
- [ ] `docs/TRACEABILITY_MATRIX.md` updated for new/changed FR/NFR rows
- [ ] `docs/VARIABLES.md` synchronized if env vars, request fields, or storage keys changed
- [ ] `docs/METRIC_CATALOG.md` synchronized if metrics added/removed/renamed
- [ ] `docs/GUARDRAILS.md` updated if AI behavior or data interpretation boundaries changed
- [ ] `docs/API_REFERENCE.md` updated if endpoints or response shapes changed
- [ ] Root `README.md` highlights section updated for user-visible changes
- [ ] In-app Sources/Methodology content matches catalog and provider documentation

---

## 7. Deployment checks (Vercel)

- [ ] Environment variables set: `GROQ_API_KEY`, `TAVILY_API_KEY` (if AI features required)
- [ ] `VITE_API_BASE_URL` left empty for same-origin deploy (unless split-host intentional)
- [ ] Post-deploy: `/api/health` returns 200
- [ ] Post-deploy: Dashboard and Global Analytics load data from production API
- [ ] See `docs/DEPLOYMENT_VERCEL.md` for full deployment runbook

---

## Sign-off

| Role | Name | Date | Approved |
| --- | --- | --- | --- |
| Product | | | ☐ |
| Engineering | | | ☐ |
| QA | | | ☐ |
| Design (if UI changed) | | | ☐ |
