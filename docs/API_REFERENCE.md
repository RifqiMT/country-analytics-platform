# API Reference (Implementation-Aligned Contracts)

This document describes the backend API endpoints exposed by the Country Analytics Platform.

It is written to be practical for product/design/QA readers and to support integration work.

## 1) Conventions

- Base URL (local): `http://localhost:4000`
- Request/response format: JSON
- Common error response shape:
  - `{ "error": "message" }`
- Metric IDs:
  - Must exist in the canonical metric catalog in `docs/METRIC_CATALOG.md` / `backend/src/metrics.ts`.
- Year handling:
  - Inputs are validated and clamped to platform-supported bounds.
  - Many endpoints resolve a **data year** that may differ from the requested year due to coverage and fallback rules.

## 2) Endpoints

### Health & metadata

#### GET `/api/health`

Purpose: liveness check.

Response:
```json
{ "ok": true }
```

#### POST `/api/keys/validate`

Purpose: validate user-provided Groq/Tavily API keys from request headers.

Headers (optional):
- `X-User-Groq-Api-Key`
- `X-User-Tavily-Api-Key`

Response:
```json
{
  "groq": { "ok": true, "message": "Groq key is valid." },
  "tavily": { "ok": false, "message": "No Tavily key provided." },
  "checkedAt": 1714240000000
}
```

#### GET `/api/metrics`

Purpose: return the metric catalog used across the app.

Response (array of metric definitions). Each item is based on `frontend/src/api.ts` `MetricDef`:
```json
[
  {
    "id": "gdp_per_capita",
    "label": "GDP per capita (Nominal, US$)",
    "unit": "US$",
    "category": "financial",
    "worldBankCode": "NY.GDP.PCAP.CD",
    "fallbackWorldBankCode": null,
    "imfWeoIndicator": "NGDPDPC",
    "uisIndicatorId": null,
    "formula": "GDP per capita = GDP / Population",
    "sourceUrl": "https://data.worldbank.org/indicator/NY.GDP.PCAP.CD",
    "sourceName": "World Bank WDI; IMF WEO (NGDPDPC) for gaps",
    "shortLabel": "GDP per capita"
  }
]
```

#### GET `/api/data-providers`

Purpose: metadata describing how series are merged and enriched across providers.

Response shape (based on `frontend/src/api.ts` `DataProvidersPayload`):
```json
{
  "seriesMergePipeline": "string describing merge pipeline",
  "providers": [
    {
      "id": "wb",
      "institution": "World Bank",
      "name": "WDI",
      "role": "Primary indicator source",
      "url": "https://data.worldbank.org",
      "seriesMergeOrder": 1,
      "usedFor": ["gap filling", "fallbacks"],
      "notes": "optional"
    }
  ]
}
```

#### GET `/api/ilo-isic-divisions`

Purpose: return available ILO-ISIC divisions for Porter Five Forces context selection.

Response:
```json
[
  { "code": "10", "label": "Manufacture of food products" }
]
```

#### GET `/api/countries`

Purpose: return country list (ISO3) sorted by name.

Response: array of country summary objects. (Fields align with `frontend/src/api.ts` `CountrySummary`.)

Possible error:
- `502` if upstream enrichment fails

### Country & dashboard analytics

#### GET `/api/country/:cca3`

Purpose: return enriched country profile.

Path params:
- `cca3`: ISO3 code

Response (high-level; full shape in `frontend/src/api.ts` `CountrySummary`):
```json
{
  "cca3": "IDN",
  "name": "Indonesia",
  "region": "Asia",
  "subregion": "Southeast Asia",
  "capital": ["Jakarta"],
  "population": 274000000,
  "area": 1910000,
  "government": "Presidential republic",
  "headOfGovernmentTitle": "President",
  "headOfGovernmentName": "Prabowo Subianto",
  "ianaTimezone": "Asia/Jakarta",
  "eezSqKm": 6150000,
  "usdFxRate": 15420,
  "usdFxRateAsOf": "2026-04-29",
  "usdFxCurrency": "IDR",
  "usdFxSource": "ECB via Frankfurter",
  "eurFxRate": 16850,
  "eurFxRateAsOf": "2026-04-29",
  "eurFxCurrency": "IDR",
  "eurFxSource": "ECB via Frankfurter",
  "worldBankProfile": {
    "iso3": "IDN",
    "name": "Indonesia",
    "incomeLevel": "Upper middle income",
    "lendingType": "IBRD",
    "latitude": "-6.17",
    "longitude": "106.82"
  }
}
```

Errors:
- `404` if the country is not found
- `500` internal retrieval error

#### GET `/api/country/:cca3/wb-profile`

Purpose: return only the World Bank country profile object.

Errors:
- `500` internal retrieval error

#### GET `/api/country/:cca3/fx-series`

Purpose: return annual USD/EUR → local currency exchange-rate time series for dashboard FX trend charts.

Path params:
- `cca3`: ISO3 code

Query params:
- `start` (optional): start year (clamped; default `2000`)
- `end` (optional): end year (clamped; default `currentDataYear()`)
- `currency` (optional): ISO 4217 override (e.g. `IDR`); skips auto-detection when valid

Response (`FxSeriesPayload` from `frontend/src/api.ts`):
```json
{
  "currency": "IDR",
  "usdToLocal": [
    { "year": 2022, "value": 14800, "provenance": "reported" },
    { "year": 2023, "value": 15420, "provenance": "reported" }
  ],
  "eurToLocal": [
    { "year": 2022, "value": 16200 },
    { "year": 2023, "value": 16850 }
  ],
  "usdSource": "World Bank PA.NUS.FCRF",
  "eurSource": "World Bank PA.NUS.FCRF"
}
```

Errors:
- `400` invalid ISO3
- `404` FX series unavailable for economy
- `502` upstream retrieval failure

Notes:
- Used by Dashboard FX trend chart (`frontend/src/pages/Dashboard.tsx`)
- Serverless timeout capped at ~22s via `settleWithin`

#### GET `/api/dashboard/comparison`

Purpose: return deterministic comparison table for a focus country vs cross-country aggregates + world benchmarks.

Query params:
- `cca3` (required): ISO3
- `year` (optional): requested year (clamped; defaults to `currentDataYear()-1`)

Response:
```json
{
  "year": 2023,
  "countryName": "Indonesia",
  "rows": [
    {
      "id": "gdp_per_capita",
      "label": "GDP per capita (Nominal, US$)",
      "country": { "value": 4200, "yoyPct": 3.1, "yoyBps": null },
      "avgCountry": { "value": 3800, "yoyPct": 2.0, "yoyBps": null },
      "global": { "value": 5100, "yoyPct": 1.2, "yoyBps": null }
    }
  ]
}
```

Errors:
- `400` if `cca3` is missing/invalid
- `500` internal error

#### GET `/api/country/:cca3/series`

Purpose: return time series bundles for a country and a set of metric IDs.

Query params:
- `metrics` (optional): comma-separated metric IDs; defaults to all metrics
- `start` (optional): start year (clamped; defaults to `MIN_DATA_YEAR`)
- `end` (optional): end year (clamped; defaults to `currentDataYear()`)

**Timeout / resilience behavior:**
- Soft timeout scales with metric count: base `14_000` ms + `5_500 × N`, ceiling `68s` (≤4 metrics), `62s` (≤8), `58s` (else), or `95s` (≥40), then capped by serverless budget.
- When the client sends an explicit `metrics` list (batched requests), the server sets `skipWldFallback: true` (no world-aggregate proxy fill).
- If the fetch times out with an all-null bundle and `N > 1`, the server bisects the metric list and refetches both halves in parallel.
- Response headers may include:
  - `x-cap-warning: country-series-partial-timeout` when timed out but some values returned
  - existing dense-null fallback markers when applicable

Response:
```json
{
  "gdp_per_capita": [
    { "year": 2000, "value": 1200.5, "provenance": "reported" }
  ],
  "life_expectancy": [
    { "year": 2000, "value": 70.1 }
  ]
}
```

Errors:
- `400` unknown metric IDs
- `504` with `code: "SERIES_TIMEOUT"` when the series call cannot complete in budget (client retries with smaller batches automatically)
- `500` internal error

**Head-of-government enrichment** (on `GET /api/country/:cca3`, not series):
- `headOfGovernmentTitle`: Wikidata P1313 or inferred from government type
- `headOfGovernmentName`: Tavily+Groq (when both keys present) preferred, else Wikidata P6; 14s settle budget; 6h cache key `head-gov-person:{ISO3}`

### Global analytics

#### GET `/api/global/snapshot`

Purpose: return global cross-country values for one metric at the resolved data year.

Query params:
- `metric` (optional): metric ID; default `gdp`
- `year` (optional): requested year; default `currentDataYear()-1`

Response:
```json
{
  "metricId": "gdp",
  "requestedYear": 2024,
  "dataYear": 2023,
  "year": 2023,
  "rows": [
    { "cca3": "IDN", "countryName": "Indonesia", "value": 1391141234567.8 }
  ]
}
```

Errors:
- `400` unknown metric
- `500` internal error

#### GET `/api/global/table`

Purpose: return a global analytics table for a `year`, `region`, and `category`.

Query params:
- `year` (optional): requested year (clamped; defaults to `currentDataYear()-1`)
- `region` (optional): defaults to `"All"`
- `category` (optional): one of `general|financial|health|education|crime` (defaults to `"general"`)

**Implementation notes:**
- Built via `loadMetricMatrices` → `composeMetricMatrix` (WDI range → IMF bulk → UIS bulk → WHO GHO for UHC).
- Internal build deadline: ~55s serverless / ~120s otherwise (no outer `settleWithin` empty fallback).
- `wdiLookbackYears` reflects the ladder span from `dataYear` back toward `MIN_DATA_YEAR` (2000), not a fixed zero.

Response shape:
```json
{
  "requestedYear": 2023,
  "dataYear": 2022,
  "category": "health",
  "wdiLookbackYears": 23,
  "columns": [
    { "id": "life_expectancy", "label": "Life expectancy", "format": "number", "yoyBps": false, "description": "..." }
  ],
  "rows": [
    {
      "iso3": "IDN",
      "name": "Indonesia",
      "flagPng": "https://...",
      "cells": {
        "life_expectancy": { "value": 71.2, "yoyPct": 1.1, "yoyBps": null }
      }
    }
  ]
}
```

Warnings (response header):
- `x-cap-warning: global-table-empty` when `rows` is empty (frontend surfaces an amber retry note via `getJsonWithMeta`)

Errors:
- `400` invalid category
- `500` internal error

#### GET `/api/global/wld-series`

Purpose: return world aggregate (`WLD`) time series for selected metrics via `buildWldSeriesBundle`.

**Pipeline:**
1. Official WLD country bundle (`completionMode: "dense_only"`, `skipWldFallback`) for metrics not in the matrix-first skip set
2. Sovereign-country panel fill from metric matrices when filled points &lt; 95% of year span (`fillWldBundleFromMatrices`)
3. Identity reconcile: `gdp_per_capita = gdp÷population` (and PPP analogue)
4. Polish: interior interpolate ≤ 4 years; trailing carry ≤ 2 years; clamp; re-reconcile

Query params:
- `metrics` (required): comma-separated metric IDs
- `start` (optional): start year (clamped; defaults to `MIN_DATA_YEAR`)
- `end` (optional): end year (clamped; defaults to `currentDataYear()`)

Response:
```json
{
  "start": 2000,
  "end": 2024,
  "series": {
    "gdp": [{ "year": 2000, "value": 1.2e13, "provenance": "reported" }],
    "gov_debt_usd": [{ "year": 2000, "value": 3.4e12, "provenance": "derived_cross_metric" }]
  }
}
```

Warnings (`x-cap-warning`):
- `global-wld-series-fallback-null` — all requested series empty
- `global-wld-series-partial` — some series empty, others filled

Errors:
- `400` missing metrics or unknown metric IDs
- `500` internal error

#### GET `/api/global/wld-charts`

Purpose: return a chart-group catalog slice plus pre-bundled WLD series for that group (bulk companion to per-chart `wld-series` fetches).

Query params:
- `group` (required): one of `financial|health|education|crime|labour`
- `start` / `end` (optional): year range (clamped)

Response (high-level):
```json
{
  "group": "financial",
  "title": "Financial",
  "description": "...",
  "charts": [{ "id": "gdp-levels", "title": "...", "metricIds": ["gdp", "gdp_ppp"] }],
  "start": 2000,
  "end": 2024,
  "series": { "gdp": [{ "year": 2000, "value": 1.2e13 }] }
}
```

Notes:
- Metric sets come from `backend/src/globalData/wldChartCatalog.ts` (mirrored in `frontend/.../wldCharts/catalog.ts`).
- Current UI loads per chart via `wld-series` after accordion open; this endpoint is available for bulk loads / transport toasts.
- Same `x-cap-warning` values as `wld-series`.

Errors:
- `400` invalid or missing group
- `500` internal error

#### GET `/api/compare`

Purpose: return one-metric series bundles for multiple countries.

Query params:
- `countries` (required): comma-separated ISO3 codes
- `metric` (optional): metric ID; default `gdp_per_capita`
- `start` (optional)
- `end` (optional)

Response:
```json
{
  "metricId": "gdp_per_capita",
  "series": {
    "IDN": [{ "year": 2020, "value": 3870.56 }],
    "BRA": [{ "year": 2020, "value": 6796.84 }]
  }
}
```

Errors:
- `400` if `countries` missing/empty
- `400` unknown metric
- `500` internal error

### Operational endpoints

#### POST `/api/cache/clear`

Purpose: clear in-memory cache and reset warmup gate.

Response:
```json
{ "ok": true }
```

#### POST `/api/bootstrap/warm`

Purpose: trigger background warmup for server-side caches.

If warmup disabled (`DISABLE_BOOTSTRAP_WARMUP=1`), response:
```json
{ "status": "skipped", "reason": "DISABLE_BOOTSTRAP_WARMUP" }
```

If enabled, response:
```json
{ "status": "started", "message": "Prefetching full country metric bundles ..."}
```

## 3) AI and analysis endpoints

### Assistant

#### POST `/api/assistant/chat`

Purpose: generate a grounded response for ranking/comparison/overview/general web questions.

Request body:
```json
{
  "message": "Rank Indonesia and Brazil by GDP per capita and compare their YoY change",
  "countryCode": "IDN",
  "webSearchPriority": false,
  "assistantMode": "web_priority"
}
```

Fields:
- `message` (required): user question
- `countryCode` (optional): focus ISO3 for grounding
- `webSearchPriority` (optional): boolean; when true, biases toward fresh web retrieval
- `assistantMode` (optional): legacy alias for web-priority mode (`"web_priority"`)
- Header override support for BYOK:
  - `X-User-Groq-Api-Key`
  - `X-User-Tavily-Api-Key`

Response:
```json
{
  "reply": "string (assistant answer)",
  "attribution": ["Intent: ...", "LLM: ...", "Web: ..."],
  "citations": {
    "D": { "1": "platform evidence ...", "2": "..." },
    "W": { "1": { "title": "...", "url": "...", "snippet": "..." } }
  }
}
```

Errors:
- `400` if `message` missing/empty
- `500` internal errors

### Strategy modules

#### POST `/api/analysis/pestel`

Purpose: generate PESTEL structured narrative output.

Request body:
```json
{ "countryCode": "IDN", "year": 2025 }
```

Header override support for BYOK:
- `X-User-Groq-Api-Key`
- `X-User-Tavily-Api-Key`

Response:
```json
{
  "analysis": {
    "pestelDimensions": [
      { "letter": "P", "label": "POLITICAL", "bullets": ["...","...","...","...","..."] },
      { "letter": "E", "label": "ECONOMIC", "bullets": ["...","...","...","...","..."] },
      { "letter": "S", "label": "SOCIOCULTURAL", "bullets": ["...","...","...","...","..."] },
      { "letter": "T", "label": "TECHNOLOGICAL", "bullets": ["...","...","...","...","..."] },
      { "letter": "E", "label": "ENVIRONMENTAL", "bullets": ["...","...","...","...","..."] },
      { "letter": "L", "label": "LEGAL", "bullets": ["...","...","...","...","..."] }
    ],
    "swot": {
      "strengths": ["...","...","...","...","..."],
      "weaknesses": ["...","...","...","...","..."],
      "opportunities": ["...","...","...","...","..."],
      "threats": ["...","...","...","...","..."]
    },
    "comprehensiveSections": [
      { "title": "Executive summary", "body": "..." }
    ],
    "strategicBusiness": [
      { "title": "Strengths", "paragraphs": ["...","..."] },
      { "title": "Weaknesses", "paragraphs": ["...","..."] },
      { "title": "Opportunities", "paragraphs": ["...","..."] },
      { "title": "Threats", "paragraphs": ["...","..."] }
    ],
    "newMarketAnalysis": ["...","...","...","...","..."],
    "keyTakeaways": ["...","...","...","...","..."],
    "recommendations": ["...","...","...","...","..."]
  },
  "attribution": ["PESTEL anchored on World Bank development indicators ..."]
}
```

When Groq/Tavily keys are missing or evidence is insufficient, the backend returns a deterministic scaffold/blend (stable UI shape). PESTEL now uses snippet-only web evidence and strict grounding QA before accepting LLM output.

Errors:
- `400` invalid `countryCode`
- `500` internal errors

#### POST `/api/analysis/porter`

Purpose: generate Porter Five Forces analysis and strategy sections.

Request body:
```json
{ "countryCode": "IDN", "year": 2025, "industrySector": "10 - Manufacture of food products" }
```

Header override support for BYOK:
- `X-User-Groq-Api-Key`
- `X-User-Tavily-Api-Key`

Response:
```json
{
  "analysis": {
    "forces": [
      { "number": 1, "title": "Threat of new entrants", "bullets": ["...","...","...","...","..."], "accent": "threat_new_entry" }
    ],
    "comprehensiveSections": [ { "title": "New Market Analysis", "body": "..." } ],
    "newMarketAnalysis": ["..."],
    "keyTakeaways": ["..."],
    "recommendations": ["..."]
  },
  "attribution": ["Porter scaffold from macro/demographic indicators ..."]
}
```

Errors:
- `400` invalid `countryCode`
- `500` internal errors

### Business Analytics

#### GET `/api/analysis/correlation-global`

Purpose: compute correlation/regression diagnostics across countries and years, optionally excluding IQR outliers.

Query params:
- `metricX` (optional): metric ID; default `gdp_per_capita`
- `metricY` (optional): metric ID; default `life_expectancy`
- `start` (optional): start year
- `end` (optional): end year
- `excludeIqr` (optional): boolean string (`"true"` enables)
- `highlight` (optional): ISO3 code to highlight on plots

Response:
```json
{
  "points": [
    { "countryIso3": "IDN", "countryName": "Indonesia", "region": "Asia", "year": 2020, "x": 4000, "y": 71.2, "fitted": 70.8, "residual": 0.4, "isIqrOutlier": false }
  ],
  "n": 240,
  "nMissing": 60,
  "nIqrFlagged": 18,
  "excludeIqr": true,
  "correlation": 0.62,
  "pValue": "<0.001",
  "rSquared": 0.38,
  "slope": 0.012,
  "intercept": -14.7,
  "subgroups": [{ "region": "Southeast Asia", "r": 0.51, "n": 30, "pValue": "0.020" }],
  "ciBand": [{ "x": 4000, "yLower": 69.2, "yUpper": 72.5 }],
  "metricX": "gdp_per_capita",
  "metricY": "life_expectancy",
  "labelX": "GDP per capita",
  "labelY": "Life expectancy at birth",
  "startYear": 2000,
  "endYear": 2023
}
```

Errors:
- `400` unknown metric IDs
- `503` with `code: "CORRELATION_EMPTY"` when `n === 0` (body includes `metricX`, `metricY`, `startYear`, `endYear`); empty results are **not** cached
- `500` internal errors

**Implementation notes:**
- Uses year-range WDI snapshots (`fetchGlobalYearSnapshotsForRange`) rather than per-year concurrency loops
- Respects `correlationDeadlineFromBudget()` so work stops before serverless wall-clock expiry
- Cache key `corr:global:v4:...` (TTL 30m); highlight country is a presentation concern and is not part of the cache key

#### POST `/api/analysis/business/correlation-narrative`

Purpose: generate a narrative interpretation of an already-computed correlation (exploratory hypothesis guidance).

Request body (key fields):
```json
{
  "metricX": "gdp_per_capita",
  "metricY": "life_expectancy",
  "labelX": "GDP per capita",
  "labelY": "Life expectancy at birth",
  "startYear": 2000,
  "endYear": 2023,
  "excludeIqr": true,
  "highlightCountryIso3": "IDN",
  "highlightCountryName": "Indonesia",
  "correlation": 0.62,
  "pValue": "<0.001",
  "rSquared": 0.38,
  "slope": 0.012,
  "intercept": -14.7,
  "n": 240,
  "nMissing": 60,
  "nIqrFlagged": 18,
  "subgroups": [{ "region": "Asia", "r": 0.55, "n": 80, "pValue": "0.012" }],
  "highlightStats": { "pointCount": 22, "meanX": 4000, "meanY": 71.2, "meanResidual": 0.3, "meanFitted": 70.9, "nIqrOutliers": 1 },
  "residualDiagnostics": { "meanAbsResidual": 2.4, "medianResidual": -0.1, "residualIqr": 1.6 }
}
```

Header override support for BYOK:
- `X-User-Groq-Api-Key`

Response:
```json
{
  "narrative": {
    "associationParagraphs": ["...", "..."],
    "correlationBullets": ["...", "...", "..."],
    "causationParagraph": "...",
    "causationHypotheses": ["...", "...", "..."],
    "recommendedAnalyses": ["...", "...", "..."]
  },
  "modelUsed": null,
  "triedModels": []
}
```

Errors:
- `400` unknown metrics
- `500` internal errors

#### POST `/api/analysis/correlation`

Purpose: compute a single-country correlation between two metrics across years in a fixed window.

Request body:
```json
{ "countryCode": "IDN", "metricX": "gdp_per_capita", "metricY": "life_expectancy" }
```

Response (high level):
```json
{
  "n": 12,
  "correlation": 0.33,
  "points": [
    { "year": 2010, "x": 4000, "y": 70.0 }
  ],
  "metricX": "gdp_per_capita",
  "metricY": "life_expectancy",
  "labelX": "GDP per capita",
  "labelY": "Life expectancy at birth"
}
```

Errors:
- `400` invalid countryCode or unknown metric IDs
- `500` internal errors
