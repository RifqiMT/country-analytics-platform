# Architecture

## Overview

The system has frontend, backend, data, and AI/web-context layers.

## Frontend
- Dashboard
- Global Analytics
- Assistant
- Pestel
- Porter
- BusinessAnalytics

## Backend
- Route orchestration in `index.ts`
- Data modules for country/global views
- Assistant modules for intent and grounding
- Strategy and correlation modules

## Runtime flow (simple)
1. User selects context
2. Frontend calls API
3. Backend validates and fetches data
4. Optional AI generation + safety checks
5. Response rendered with attribution context

## Enterprise Architecture Details (Expanded)

### 1) High-level module map

The system is structured into:
- **Frontend SPA**: React + TypeScript pages and components render dashboards, global analytics, assistant chat, strategy outputs, and business analytics.
- **Backend API**: Express + TypeScript routes validate inputs, fetch metric series, run analytics logic, and orchestrate evidence-aware AI behavior.
- **Indicator/data pipeline**: Metric definitions live in `backend/src/metrics.ts` and series bundles are assembled consistently across modules.
- **LLM + web augmentation (optional)**: Groq (narrative generation) and Tavily (verified web grounding) are used only when configured and when evidence gates allow it.

### 2) Deterministic evidence hierarchy

When the assistant or analysis modules need to answer, they follow an evidence hierarchy:
1. Platform evidence (metric series + deterministic tables)
2. Verified web evidence (live retrieval with citations)
3. AI synthesis constrained by grounding and drift controls

If evidence quality or scope constraints fail, the system uses deterministic fallback/scaffold outputs rather than guessing.

### 3) Runtime flows (more detailed)

#### A) Country dashboard series and comparisons

1. UI selects `cca3` and a year window.
2. Frontend requests country series bundles:
   - `GET /api/country/:cca3/series` with `metrics`, `start`, `end`
3. Backend validates:
   - ISO3 format
   - metric IDs exist in the canonical metric catalog
   - year range is clamped
4. Backend assembles series data and returns the payload.
5. Frontend renders charts/tables and supports export in normal and fullscreen modes.

#### B) Global analytics (snapshot/table/world series)

1. UI selects a `metric`, `year`, and optionally `region`/`category` (including `crime`).
2. Frontend requests:
   - `GET /api/global/snapshot`
   - `GET /api/global/table`
   - `GET /api/global/wld-series`
3. Backend applies year fallback resolution and returns rows aligned to the resolved data year.
4. Frontend builds a **quintile tier model** from scoped snapshot values (`choroplethTiers.ts`) and renders choropleth + legend + tooltip (with tier badge).
5. Global and comparison tables render via shared **DataTable** components with sticky labels and sortable headers.

#### C) Assistant chat (`POST /api/assistant/chat`)

1. Backend classifies intent and determines evidence mode (platform-grounded vs verified-web).
2. If platform evidence is needed, backend builds platform evidence blocks from dashboard/ranking/comparison structures.
3. If verified web evidence is required, backend retrieves live context from Tavily and compacts it into web evidence blocks.
4. Safety gates apply:
   - citation/grounding checks
   - drift control (detect scope mismatch)
   - fallback activation when output is weak or evidence is thin
5. Backend returns a stable response with attribution/routing signals for the UI.

#### C.1) App-wide BYOK key flow

1. User enters keys in header panel (`AI API Keys (App-wide)`).
2. Frontend stores keys (session/persistent per user choice) and attaches request headers.
3. Backend resolves key precedence: request header key -> server env key -> deterministic fallback path.
4. Optional `/api/keys/validate` endpoint provides provider-specific key health checks.

#### D) Strategy generation (PESTEL, Porter)

1. UI selects `countryCode` and year. Porter also includes `industrySector`.
2. Backend chooses generation path:
   - if Groq is configured and evidence quality passes: structured narrative output
   - else: data-only scaffold output with stable UI sections
3. Frontend renders the narrative sections and standardized bullet formatting.

##### PESTEL strict grounding architecture

- Retrieval context is snippet-based (no provider-synthesized answer injection).
- LLM partial output passes:
  1) fragment-level grounding sanitizer
  2) final analysis grounding validator (ratio/section checks)
- If either gate fails, backend returns deterministic Tavily+data blend or data-only scaffold.

#### E) Business analytics correlation and narrative

1. UI selects metricX/metricY, year window, and optional IQR outlier exclusion.
2. Frontend calls:
   - `GET /api/analysis/correlation-global`
3. Backend computes:
   - Pearson correlation and regression diagnostics
   - residuals and IQR outlier flags
   - subgroup diagnostics by region
4. Frontend may request narrative:
   - `POST /api/analysis/business/correlation-narrative`

#### F) FX exchange-rate pipeline

1. Dashboard loads country profile via `GET /api/country/:cca3` for snapshot USD/EUR quotes.
2. Dashboard loads FX trend chart via `GET /api/country/:cca3/fx-series?start=&end=`.
3. Backend resolves currency candidates from REST Countries metadata + `country-to-currency` fallback.
4. `backend/src/fxSeries.ts` merges:
   - ECB daily quotes (via Frankfurter) for recent years
   - World Bank official annual FX (`PA.NUS.FCRF`) for gaps and validation
5. Anomaly guard: if daily quote deviates significantly from WB baseline, fallback is applied.
6. Response includes `usdToLocal`, `eurToLocal` series arrays with source labels.

#### G) Bootstrap and data warmup

1. On first app load, frontend calls `POST /api/bootstrap/warm` (once per tab via `cap-app-bootstrap-v1` flag).
2. Backend `dataWarmup.ts` prefetches metric bundles for all countries in background.
3. On serverless (`VERCEL=1` or `AWS_LAMBDA_FUNCTION_NAME`), warmup is **skipped** to avoid timeout.
4. Disable locally with `DISABLE_BOOTSTRAP_WARMUP=1`.

#### H) Serverless budget and timeout governance

- `backend/src/serverlessBudget.ts` caps outbound work to stay within Vercel/Lambda limits.
- Default budget: 55s on serverless, 120s locally (`CAP_SERVERLESS_BUDGET_MS` override).
- Correlation year loops respect `correlationDeadlineFromBudget()` so work stops before the serverless wall clock expires.
- Individual route timeouts (e.g. FX series 22s) use `settleWithin()` pattern.

### 4) Frontend observability layer

- `frontend/src/api.ts` — HTTP client with transport event dispatch for toast/diagnostics panel
- `frontend/src/components/ApiToastStack.tsx` — surfaces request success/failure to users
- Request timing and status visible in header API transport widget

### 5) Evidence model (what the user sees)

The system uses labeled evidence blocks conceptually:
- `[D#]` platform evidence references (metric series and deterministic comparison structures)
- `[W#]` web evidence references (live excerpts, when verified-web mode is used)

Internal citation placeholders are sanitized before user-visible output is rendered.
