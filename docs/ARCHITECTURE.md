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
4. Frontend renders map/table and preserves filter context in fullscreen views.

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

### 4) Evidence model (what the user sees)

The system uses labeled evidence blocks conceptually:
- `[D#]` platform evidence references (metric series and deterministic comparison structures)
- `[W#]` web evidence references (live excerpts, when verified-web mode is used)

Internal citation placeholders are sanitized before user-visible output is rendered.
