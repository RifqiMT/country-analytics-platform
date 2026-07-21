# Variables Documentation (Implementation-Aligned)

This document explains the variables that the application uses in API requests, UI interactions, and analysis computations.

It is written for readers who may be new to this codebase: each variable entry includes a technical name, a friendly explanation, the rule/formula used by the system, where it appears in the application, and an example value.

## 1) Glossary: “metric” vs “variable”

- A **metric** is an indicator definition (for example, `gdp_per_capita`). See `docs/METRIC_CATALOG.md`.
- A **variable** is a value flowing through the app and APIs (for example, `metricX`, `startYear`, `excludeIqr`, or derived analytics values like `residual`).

## 2) Environment Variables

Environment variables configure backend behavior and model/web retrieval access.

### Environment variable table

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `PORT` | API Port | Backend server listening port | Parsed as number; default `4000` if unset | `backend/src/index.ts` | `4000` |
| `DISABLE_BOOTSTRAP_WARMUP` | Warmup Switch | Disables background cache warmup | If equal to `"1"`, warmup is skipped | `backend/src/index.ts`, `backend/src/dataWarmup.ts` | `1` |
| `GROQ_API_KEY` | Groq API Key | Enables Groq model calls (assistant/PESTEL/Porter/business narratives) | If unset/empty, AI generation endpoints use deterministic/scaffold fallbacks | `backend/src/index.ts`, `backend/src/llm.ts` | `gsk_...` |
| `TAVILY_API_KEY` | Tavily Web Key | Enables Tavily live web retrieval | If unset/empty, web grounding paths are disabled | `backend/src/index.ts`, `backend/src/llm.ts`, `backend/src/*Tavily*.ts` | `tvly_...` |
| `GROQ_MODEL` | Legacy Groq Model Override | Legacy model override (used when no use-case override is set) | Use-case specific model env var overrides take priority | `backend/src/llm.ts` | `llama-3.3-70b-versatile` |
| `GROQ_MODEL_PESTEL` | PESTEL Primary Model | Primary Groq model used for PESTEL generation | Selected as primary candidate for `useCase="pestel"`; code default `llama-3.3-70b-versatile` | `backend/src/llm.ts` | `llama-3.3-70b-versatile` |
| `GROQ_MODEL_PORTER` | Porter Primary Model | Primary Groq model used for Porter generation | Selected as primary candidate for `useCase="porter"` | `backend/src/llm.ts` | `openai/gpt-oss-120b` |
| `GROQ_MODEL_BUSINESS` | Business Primary Model | Primary Groq model used for correlation narrative generation | Selected as primary candidate for `useCase="business"` | `backend/src/llm.ts` | `llama-3.3-70b-versatile` |
| `GROQ_MODEL_ASSISTANT` | Assistant Primary Model | Primary Groq model used for analytics assistant chat | Selected as primary candidate for `useCase="assistant"` | `backend/src/llm.ts` | `llama-3.1-8b-instant` |
| `GROQ_FALLBACK_MODELS` | Global Groq Fallback Models | Global list of fallback models (used after per-use-case fallbacks) | Parsed as comma/space separated list | `backend/src/llm.ts` | `qwen/qwen3-32b,llama-3.1-8b-instant` |
| `GROQ_FALLBACK_MODELS_PESTEL` | PESTEL Fallback Models | Per-use-case fallback list for PESTEL | Parsed as comma/space separated list | `backend/src/llm.ts` | `qwen/qwen3-32b` |
| `GROQ_FALLBACK_MODELS_PORTER` | Porter Fallback Models | Per-use-case fallback list for Porter | Parsed as comma/space separated list | `backend/src/llm.ts` | `qwen/qwen3-32b` |
| `GROQ_FALLBACK_MODELS_BUSINESS` | Business Fallback Models | Per-use-case fallback list for Business | Parsed as comma/space separated list | `backend/src/llm.ts` | `qwen/qwen3-32b` |
| `GROQ_FALLBACK_MODELS_ASSISTANT` | Assistant Fallback Models | Per-use-case fallback list for Assistant | Parsed as comma/space separated list | `backend/src/llm.ts` | `qwen/qwen3-32b` |
| `VERCEL` | Vercel Runtime Flag | Indicates serverless runtime in Vercel | When `VERCEL="1"`, backend does not open local listener | `backend/src/index.ts` | `1` |
| `CAP_SERVERLESS_BUDGET_MS` | Serverless Invocation Budget | Maximum wall-clock budget (ms) for a single serverless API invocation | Parsed as integer; clamped to `[1000, 300000]`; default `55000` on serverless, `120000` locally | `backend/src/serverlessBudget.ts` | `55000` |
| `AWS_LAMBDA_FUNCTION_NAME` | Lambda Runtime Flag | Set automatically on AWS Lambda; used with `VERCEL` to detect serverless runtime | When present, bootstrap warmup is skipped and timeouts are capped | `backend/src/serverlessBudget.ts` | `(auto-set by AWS)` |
| `VITE_API_BASE_URL` | Frontend API Base URL | Overrides the API host prefix for frontend HTTP calls | Empty string = same-origin (`/api/...`); trailing slash stripped | `frontend/src/api.ts` | `` or `http://localhost:4000` |

## 2.1) Environment variable relationship chart

```mermaid
flowchart LR
  subgraph Backend["Backend (.env)"]
    PORT --> IDX[index.ts listener]
    GROQ[GROQ_API_KEY + GROQ_MODEL_*] --> LLM[llm.ts model routing]
    TAVILY[TAVILY_API_KEY] --> WEB[Tavily retrieval modules]
    WARM[DISABLE_BOOTSTRAP_WARMUP] --> DW[dataWarmup.ts]
    VERCEL --> IDX
    BUDGET[CAP_SERVERLESS_BUDGET_MS] --> SB[serverlessBudget.ts]
    LAMBDA[AWS_LAMBDA_FUNCTION_NAME] --> SB
  end

  subgraph Frontend["Frontend (build-time)"]
    VITE[VITE_API_BASE_URL] --> API[api.ts HTTP client]
  end

  API -->|/api/* requests| IDX
```

## 3) Request Variables (API Inputs)

Request variables are the fields you send to endpoints. Backend validation rules are applied before data retrieval and analysis.

### 3.1 Assistant

#### `POST /api/assistant/chat`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `message` | User Question | Natural-language query | Required and non-empty (trimmed) | `frontend/src/pages/Assistant.tsx`, `backend/src/index.ts` | `Compare Indonesia and Brazil on GDP per capita and population` |
| `countryCode` | Focus Country | ISO3 country context for grounding | Uppercase and validated as `^[A-Z]{3}$` | Assistant chat only | `IDN` |
| `webSearchPriority` | Web-First Mode | Force web retrieval priority for the turn | If `true`, treated as web-priority | Assistant chat body | `true` |
| `assistantMode` | Assistant Mode (Optional) | Legacy/alternate flag for web priority | If equal to `"web_priority"`, treated like `webSearchPriority=true` | Assistant chat body | `"web_priority"` |
| `X-User-Groq-Api-Key` | User Groq Key Header | User-provided Groq key attached from frontend API layer | Header overrides server env key for request scope | `frontend/src/api.ts`, `backend/src/index.ts` | `gsk_...` |
| `X-User-Tavily-Api-Key` | User Tavily Key Header | User-provided Tavily key attached from frontend API layer | Header overrides server env key for request scope | `frontend/src/api.ts`, `backend/src/index.ts` | `tvly_...` |

### 3.1.1 Key validation endpoint

#### `POST /api/keys/validate`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `X-User-Groq-Api-Key` | Groq key for validation | Header sent to Groq model-list probe | Returns `ok=true` on HTTP 200 from provider | Header key panel and backend validator | `gsk_...` |
| `X-User-Tavily-Api-Key` | Tavily key for validation | Header sent to Tavily minimal search probe | Returns `ok=true` on HTTP 200 from provider | Header key panel and backend validator | `tvly_...` |

### 3.2 PESTEL

#### `POST /api/analysis/pestel`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `countryCode` | Country | ISO3 country for analysis | Required and validated as `^[A-Z]{3}$` | `frontend/src/pages/Pestel.tsx` → backend | `IDN` |
| `year` | Context Year | Analysis horizon used in digest and web windows | Clamped to platform-allowed year | PESTEL API body | `2025` |

### 3.3 Porter

#### `POST /api/analysis/porter`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `countryCode` | Country | ISO3 country for analysis | Required and validated as `^[A-Z]{3}$` | `frontend/src/pages/Porter.tsx` → backend | `IDN` |
| `year` | Context Year | Analysis horizon used for digest and web | Clamped to platform-allowed year | Porter API body | `2025` |
| `industrySector` | Industry / Sector (ILO-ISIC) | Industry framing used in Porter web queries and scaffold | Default is `"10 - Manufacture of food products"` if empty | Porter API body | `10 - Manufacture of food products` |

### 3.4 Global / Dashboard Analytics Inputs

#### `GET /api/dashboard/comparison`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `cca3` | Focus Country | ISO3 code | Required and validated as `^[A-Z]{3}$` | Dashboard comparison route | `IDN` |
| `year` | Data Year Target | Requested year for comparison block | Clamped; if missing uses `currentDataYear()-1` | Dashboard comparison route | `2023` |

#### `GET /api/country/:cca3/series`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `cca3` | Country | ISO3 in path | Uppercased | `backend/src/index.ts` | `IDN` |
| `metrics` | Metric IDs | Comma-separated metric IDs to fetch | If omitted, backend fetches all metrics | Country series route | `gdp_per_capita,life_expectancy` |
| `start` | Start Year | Beginning of time range | Clamped to platform bounds | Country series route | `2005` |
| `end` | End Year | End of time range | Clamped to platform bounds | Country series route | `2026` |

#### `GET /api/global/snapshot`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `metric` | Global Metric | Metric ID used for snapshot | Must exist in catalog; default `gdp` | `frontend/src/components/global/*` | `gdp` |
| `year` | Requested Year | Target year for snapshot | If missing uses `currentDataYear()-1` | Global snapshot route | `2024` |

#### `GET /api/global/table`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `year` | Data Year Target | Target year | Clamped; if missing uses `currentDataYear()-1` | Global table route | `2023` |
| `region` | Region Filter | Region grouping | Defaults to `"All"` | Global table route | `"All"` |
| `category` | Category | Table category | One of `general|financial|health|education|crime` | Global table route | `health` |

#### `GET /api/global/wld-series`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `metrics` | Metric IDs | Metrics to fetch for world aggregate | Required; comma-separated IDs | WLD series route | `gdp,life_expectancy` |
| `start` | Start Year | Beginning time range | Clamped | WLD series route | `2000` |
| `end` | End Year | End time range | Clamped | WLD series route | `2026` |

#### `GET /api/compare`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `countries` | Country List | ISO3 codes to compare | Required and parsed as comma-separated list | Comparison route | `IDN,BRA` |
| `metric` | Metric | Metric ID | Must exist; default `gdp_per_capita` | Comparison route | `gdp_per_capita` |
| `start` | Start Year | Beginning year | Clamped | Comparison route | `2005` |
| `end` | End Year | Ending year | Clamped | Comparison route | `2026` |

### 3.5 Business Analytics (Correlation)

#### `GET /api/analysis/correlation-global`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `metricX` | Variable 1 | X-axis metric ID | Must exist in metric catalog | Business Analytics page | `gdp_per_capita` |
| `metricY` | Variable 2 | Y-axis metric ID | Must exist in metric catalog | Business Analytics page | `life_expectancy` |
| `start` | Start Year | Included years from `start..end` | Clamped; inclusive loop | Correlation global route | `2000` |
| `end` | End Year | Included years from `start..end` | Resolved to WDI-compatible year | Correlation global route | `2023` |
| `excludeIqr` | Exclude IQR outliers | Removes points flagged by IQR rule | Parsed as boolean string (`"true"`) | Correlation global route | `true` |
| `highlight` | Highlight Country | ISO3 code to highlight on plot | Uppercased by caller | Business Analytics page | `IDN` |

### 3.6 Country exchange-rate response variables

#### `GET /api/country/:cca3` (FX-related output fields)

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `usdFxRate` | USD FX Rate | Returned quote for one USD in target local currency | Prefer ECB daily quote; fallback to World Bank `PA.NUS.FCRF` when needed | `backend/src/index.ts`, `frontend/src/pages/Dashboard.tsx` | `98.34` |
| `usdFxRateAsOf` | FX As-Of Date | Date attached to returned quote | Daily quote date for ECB; annual fallback date for WB | Dashboard exchange card | `2026-04-29` |
| `usdFxCurrency` | FX Currency Code | Currency code used for quote | Resolved from currency candidates (country metadata + fallback mapping) | Dashboard exchange card | `ALL` |
| `usdFxSource` | FX Source Label | Human-readable provider/source label | `ECB via Frankfurter` or `World Bank PA.NUS.FCRF` variants | Dashboard exchange card | `ECB via Frankfurter` |
| `eurFxRate` | EUR FX Rate | Returned quote for one EUR in target local currency | Same hierarchy as USD quote path | Dashboard exchange card | `106.12` |
| `eurFxRateAsOf` | EUR FX As-Of Date | Date attached to EUR quote | Daily quote date for ECB; annual fallback date for WB | Dashboard exchange card | `2026-04-29` |
| `eurFxCurrency` | EUR FX Currency Code | Currency code used for EUR quote | Resolved from currency candidates | Dashboard exchange card | `ALL` |
| `eurFxSource` | EUR FX Source Label | Human-readable EUR provider label | Same source labels as USD path | Dashboard exchange card | `ECB via Frankfurter` |
| `ianaTimezone` | IANA Timezone | Capital-city timezone for clock card | Derived from lat/lng via tz-lookup | Dashboard timezone card | `Asia/Jakarta` |
| `eezSqKm` | EEZ Area | Exclusive economic zone in km² | Sea Around Us API with static fallback table | Dashboard hero profile | `6150000` |
| `worldBankProfile` | WB Country Profile | Income level, lending type, region metadata | World Bank Country API enrichment | Dashboard hero, comparison context | `{ incomeLevel: "Upper middle income" }` |
| `headOfGovernmentTitle` | Office Title | Formal title of head of government / state | Wikidata P1313, else inferred from government type string | Dashboard `HeadOfGovernmentCard` | `President` |
| `headOfGovernmentName` | Officeholder Name | Current person holding the office | Prefer Tavily+Groq when both keys present; else Wikidata P6; 14s settle; 6h cache | Dashboard `HeadOfGovernmentCard` | `Prabowo Subianto` |

#### `GET /api/country/:cca3/fx-series`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `cca3` | Country | ISO3 in path | Uppercased; validated `^[A-Z]{3}$` | Dashboard FX trend chart | `IDN` |
| `start` | Start Year | Beginning of FX series window | Clamped to platform bounds; default `2000` | Dashboard FX chart fetch | `2005` |
| `end` | End Year | End of FX series window | Clamped; default `currentDataYear()` | Dashboard FX chart fetch | `2025` |
| `currency` | Currency Override | Optional ISO 4217 currency code | If valid 3-letter code, skips auto-detection | FX series route (advanced) | `IDR` |
| `currency` (response) | Resolved Currency | Currency code used for series | From candidates or override | `FxSeriesPayload.currency` | `IDR` |
| `usdToLocal` | USD→Local Series | Annual points: local currency per 1 USD | Merged ECB daily + WB annual fallback | Dashboard FX chart | `[{ year: 2023, value: 15420 }]` |
| `eurToLocal` | EUR→Local Series | Annual points: local currency per 1 EUR | Same merge pipeline as USD | Dashboard FX chart | `[{ year: 2023, value: 16850 }]` |
| `usdSource` | USD Series Source | Provider label for USD series | Institution string from merge logic | Dashboard FX chart legend | `World Bank PA.NUS.FCRF` |
| `eurSource` | EUR Series Source | Provider label for EUR series | Institution string from merge logic | Dashboard FX chart legend | `World Bank PA.NUS.FCRF` |

### 3.7 Response headers (platform-wide)

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `x-cap-warning` | Upstream Warning | Non-fatal upstream degradation notice | Examples: REST Countries partial fallback; `country-series-partial-timeout` when series timed out but partial data returned | Response header on selected routes | `country-series-partial-timeout` |

#### `POST /api/analysis/correlation`

This endpoint computes a correlation for a single country between `metricX` and `metricY` across overlapping years.

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `countryCode` | Country | ISO3 | Required and validated | (Single-country correlation usage) | `IDN` |
| `metricX` | Variable 1 | X metric | Must exist | Correlation endpoint | `gdp_per_capita` |
| `metricY` | Variable 2 | Y metric | Must exist | Correlation endpoint | `life_expectancy` |

#### `POST /api/analysis/business/correlation-narrative`

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `metricX` | Metric X | X metric ID | Must exist | Business narrative request body | `gdp_per_capita` |
| `metricY` | Metric Y | Y metric ID | Must exist | Business narrative request body | `life_expectancy` |
| `labelX` | Label for X | Human label for metric X | Used verbatim in narrative strings | Business narrative request body | `GDP per capita` |
| `labelY` | Label for Y | Human label for metric Y | Used verbatim in narrative strings | Business narrative request body | `Life expectancy` |
| `startYear` | Narrative Start Year | Inclusive start | Numeric; used for window description | Business narrative request body | `2000` |
| `endYear` | Narrative End Year | Inclusive end | Numeric; used for window description | Business narrative request body | `2023` |
| `excludeIqr` | Outlier Toggle | Narrative refers to whether IQR outliers were removed | Boolean | Business narrative request body | `true` |
| `highlightCountryIso3` | Highlight ISO3 | Highlight country code | Optional string; if missing, highlight statements omitted | Business narrative request body | `IDN` |
| `highlightCountryName` | Highlight Name | Highlight country display name | Optional; if missing, highlight statements omitted | Business narrative request body | `Indonesia` |
| `correlation` | Correlation r | Pearson r (or null) | Backend treats null as “insufficient overlap” | Business narrative request body | `0.62` |
| `pValue` | p-value | String p-value returned by correlation engine | May be `null` | Business narrative request body | `<0.001` |
| `rSquared` | r² | Explained variance proxy (r²) | May be null | Business narrative request body | `0.38` |
| `slope` | Regression slope | Beta slope between X and Y | May be null | Business narrative request body | `1.23e-02` |
| `intercept` | Regression intercept | Regression intercept | May be null | Business narrative request body | `-14.7` |
| `n` | Point Count | Number of included country-year points | Numeric | Business narrative request body | `240` |
| `nMissing` | Missing Points Count | Count excluded due to missing X/Y | Numeric | Business narrative request body | `60` |
| `nIqrFlagged` | IQR Flagged Count | Number of points flagged by IQR | Numeric | Business narrative request body | `18` |
| `subgroups` | Region Subgroups | Region-level diagnostics | Array of `{ region, r, n, pValue }` | Business narrative request body | `[{...}]` |
| `highlightStats` | Highlight Stats | Derived stats for highlighted country | Optional; if missing, highlight narrative omitted | Business narrative request body | `{...}` |
| `residualDiagnostics` | Residual Diagnostics | Residual distribution stats | Optional; if missing, narrative omits residual detail | Business narrative request body | `{...}` |

## 4) Derived Variables (Computed Values)

Derived variables are computed by the backend (or sometimes by the frontend before sending to the narrative endpoint).

### 4.1 Year-over-year (assistant/dashboard)

`yoy` (Year-over-Year Change)

| Variable | Friendly Name | Definition | Formula / Rule | Where it appears | Example |
| --- | --- | --- | --- | --- | --- |
| `yoy` | YoY change | Relative change between latest available value and prior-year value | `((latest - prior) / abs(prior)) * 100` ; if `prior==0` or prior missing → null | Assistant ranking/comparison value rendering | `+4.3%` |

### 4.2 Correlation global (Pearson + regression)

These formulas are used in `backend/src/correlationGlobal.ts`.

| Variable | Friendly Name | Definition | Formula / Rule | Where it appears | Example |
| --- | --- | --- | --- | --- | --- |
| `correlation` | Pearson correlation r | Linear association strength across included points | `r = sum((x-mx)(y-my)) / sqrt(sum((x-mx)^2) * sum((y-my)^2))` | Correlation global route response | `0.62` |
| `pValue` | p-value | Statistical significance approximation | Uses t-statistic: `t = r * sqrt(n-2) / sqrt(max(1e-20, 1-r^2))`, then `p = 2 * (1 - normalCdf(|t|))` | Correlation global route response | `<0.001` |
| `rSquared` | Explained variance proxy | `r²` | `rSquared = r * r` | Correlation global route | `0.38` |
| `slope` | Regression slope | Beta slope for fitted line | `slope = dx==0 ? null : (r ?? 0) * sqrt(dy/dx)` | Correlation global route | `1.23e-02` |
| `intercept` | Regression intercept | Intercept of fitted line | `intercept = my - slope * mx` | Correlation global route | `-14.7` |
| `fitted` | Fitted Y | Predicted Y for each point | `fitted = intercept + slope * x` | Correlation points used for residuals | `71.0` |
| `residual` | Residual | Error term per point | `residual = y - fitted` | Correlation points and narrative | `-1.7` |

### 4.3 IQR outlier rule (used for excludeIqr)

| Variable | Friendly Name | Definition | Formula / Rule | Where it appears | Example |
| --- | --- | --- | --- | --- | --- |
| IQR outlier (X) | X outlier flag | Point is outlier in X | For X: `iqr = q3x - q1x`, `lower = q1x - 1.5*iqr`, `upper = q3x + 1.5*iqr`; outlier if `x < lower` or `x > upper` | Correlation global | flagged |
| IQR outlier (Y) | Y outlier flag | Point is outlier in Y | For Y: same rule as X using `q1y`/`q3y` | Correlation global | flagged |
| `nIqrFlagged` | Flagged points count | Total points flagged in either X or Y | `nIqrFlagged = count(flagged points)` | Correlation global response | `18` |

If `excludeIqr=true`, the backend removes any point whose `(countryIso3, year)` is flagged.

### 4.4 Confidence band (`ciBand`)

| Variable | Friendly Name | Definition | Formula / Rule | Where it appears | Example |
| --- | --- | --- | --- | --- | --- |
| `ciBand` | Confidence band | yLower/yUpper around fitted line | Uses `tCrit=1.96`, `mse = sse/(n-2)`, then `se = sqrt(mse*(1/n + (x-mx)^2/ssx))`; `yLower=yHat - tCrit*se`, `yUpper=yHat + tCrit*se` | Correlation global response | `{...}` |

### 4.5 Highlight stats and residual diagnostics

These are computed on the frontend in `frontend/src/pages/BusinessAnalytics.tsx`, then sent into the narrative endpoint.

| Variable | Friendly Name | Definition | Formula / Rule | Where it appears | Example |
| --- | --- | --- | --- | --- | --- |
| `highlightStats.meanX` | Highlight mean X | Mean of highlight country’s X values | Mean across highlight points | Business narrative payload | `4200` |
| `highlightStats.meanY` | Highlight mean Y | Mean of highlight country’s Y values | Mean across highlight points | Business narrative payload | `72.1` |
| `highlightStats.meanResidual` | Highlight mean residual | Average residual term on highlight points | Mean of residuals across highlight points | Business narrative payload | `0.12` |
| `highlightStats.meanFitted` | Highlight mean fitted | Mean fitted Y | Mean across fitted values | Business narrative payload | `71.9` |
| `highlightStats.nIqrOutliers` | Highlight IQR outlier count | Outlier count within highlight points | Count of highlight points where `isIqrOutlier=true` | Business narrative payload | `3` |
| `residualDiagnostics.meanAbsResidual` | Mean absolute residual | Mean of `abs(residual)` | Average of abs residuals | Business narrative payload | `2.4` |
| `residualDiagnostics.medianResidual` | Median residual | Middle value of residuals | Median of residuals | Business narrative payload | `-0.1` |
| `residualDiagnostics.residualIqr` | Residual IQR | IQR spread of residuals | `q3 - q1` of residuals | Business narrative payload | `1.6` |

### 4.6 Business Analytics delivery-control variables (frontend)

| Variable | Friendly Name | Definition | Formula / Rule | Where it appears | Example |
| --- | --- | --- | --- | --- | --- |
| `strictSelectedRange` | Strict Selected Range Mode | Toggle for strict-range-only requests | If `true`, no automatic fallback year-window retries | `frontend/src/pages/BusinessAnalytics.tsx` | `true` |
| `analysisDeliveryNote` | Delivery Note | UI explanation when fallback window is used | Set when reliability retries deliver a narrower window | Business Analytics result banner | `Primary request timed out; using last 12 years.` |
| `presentationMode` | Presentation Mode | Hides control/diagnostic chrome for review mode | Toggle by button or keyboard `P` | Business Analytics page | `true` |

### 4.7 Client-side persistence keys (browser storage)

These keys are not environment variables but are part of the application's variable surface for analysts and QA.

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `cap.userApiKeys.v1` | BYOK Key Storage | Serialized Groq/Tavily keys and remember preference | JSON in `localStorage` (persistent) or `sessionStorage` (session) | `frontend/src/lib/userApiKeys.ts` | `{ groqApiKey: "gsk_...", scope: "local" }` |
| `cap-selected-country-cca3` | Last Dashboard Country | ISO3 of last selected dashboard country | Stored in `localStorage` on country change | `frontend/src/dashboardCountryStorage.ts` | `IDN` |
| `cap-app-bootstrap-v1` | Bootstrap Flag | One-shot per-tab flag after initial data warmup | Stored in `sessionStorage` | `frontend/src/hooks/useAppBootstrap.ts` | `"1"` |
| `cap_pestel_analysis_v1` | PESTEL Session Cache | Last generated PESTEL analysis payload | Stored in `sessionStorage` until regenerate | `frontend/src/lib/pestelAnalysisCache.ts` | `{ countryCode: "IDN", year: 2025, ... }` |
| `cap_porter_analysis_v1` | Porter Session Cache | Last generated Porter analysis payload | Stored in `sessionStorage` until regenerate | `frontend/src/lib/porterAnalysisCache.ts` | `{ countryCode: "IDN", industrySector: "10", ... }` |
| `cap_business_correlation_v2` | Business Analysis Cache | Last correlation + narrative result | Stored in `sessionStorage` until regenerate; rejects empty `points`; key version bumped from `v1` | `frontend/src/lib/businessCorrelationCache.ts` | `{ metricX: "gdp_per_capita", correlation: 0.62, ... }` |
| `cap-compare-country-a` / `cap-compare-country-b` | Compare pair countries | Last selected ISO3 pair for Compare Countries | Stored in `sessionStorage` via `compareCountryStorage.ts` | Compare page | `IDN` / `BRA` |

### 4.8 Time-series point variables (`SeriesPoint`)

Each metric time-series point in API responses follows the `SeriesPoint` shape from `backend/src/series.ts`.

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `year` | Data Year | Calendar year for the observation | Integer within platform bounds (2000–current) | All series payloads (`/api/country/:cca3/series`, FX series, WLD series) | `2023` |
| `value` | Observed Value | Numeric metric or FX value for the year | May be `null` when data is unavailable | Chart/table rendering, correlation points | `4200.5` |
| `provenance` | Data Provenance | Audit label describing how the value was produced | One of: `reported`, `wb_alternate_code`, `imf_weo`, `uis`, `derived_cross_metric`, `carried_short`, `interpolated`, `filled_range`, `wld_proxy` | Optional field on series points; omitted when null or legacy cache | `imf_weo` |

### 4.9 Dashboard comparison table variables

Response fields from `GET /api/dashboard/comparison` used in the dashboard comparison table.

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `rows[].id` | Metric ID | Canonical metric identifier for the row | Must exist in metric catalog | Dashboard comparison table | `gdp_per_capita` |
| `rows[].label` | Metric Label | Human-readable metric name | From metric catalog | Comparison table header | `GDP per capita (Nominal, US$)` |
| `country.value` | Country Value | Focus country's value for the metric/year | Direct from series at resolved data year | Comparison table country column | `4200` |
| `country.yoyPct` | Country YoY % | Year-over-year percentage change | `((latest − prior) / abs(prior)) × 100`; null if prior missing or zero | Comparison table delta badge | `+4.3` |
| `country.yoyBps` | Country YoY bps | Year-over-year change in basis points | Used for rate/index metrics where bps is meaningful; null otherwise | Comparison table delta badge | `+120` |
| `avgCountry.value` | Regional Average | Geography-aware regional aggregate | Computed via `geographyComparison.ts` for peer countries | Comparison table avg column | `3800` |
| `global.value` | Global Benchmark | World or cross-country aggregate benchmark | From WLD proxy or global aggregation logic | Comparison table global column | `5100` |
| `year` | Resolved Data Year | Actual year used for comparison values | May differ from user-requested year | Comparison table header/context | `2023` |

### 4.10 Global map choropleth and tooltip variables (frontend)

Computed client-side from `GET /api/global/snapshot` rows and the active region filter. Sources: `choroplethTiers.ts`, `MapCountryTooltip.tsx`, `metricTooltipBlurb.ts`.

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `ChoroplethTierModel.breaks` | Tier Break Values | Upper bounds for tiers 0–3 within map scope | Quantile breaks from sorted scope values (`quantileBreaks`, n=5) | `buildChoroplethTierModel()` → `GlobalChoropleth` | `[1200, 5400, 12800, 28500]` |
| `ChoroplethTier.shortLabel` | Tier Short Label | Human label for tier band | Fixed: Lowest, Low, Mid, High, Highest | `ChoroplethTierLegend` | `High` |
| `ChoroplethTier.rankLabel` | Tier Rank Label | Percentile band description | Fixed: Bottom 20% … Top 20% | Legend + tooltip titles | `Upper 20%` |
| `ChoroplethTier.color` | Tier Fill Color | Map fill for countries in tier | One of five `CHOROPLETH_TIER_COLORS` | Choropleth paths, legend segments | `#0369a1` |
| `MapScopeStats.min` / `max` / `median` / `mean` / `mode` | Map Distribution Stats | Summary of numeric values in current map scope | `computeMapScopeStats(mapScopeValues(...))`; mode uses rounded bucket counts | `MapCountryTooltip` stat grid | `median: 8200` |
| `MapCountryRank.rank` / `total` | Country Rank | Position among scoped countries (1 = highest value) | `rank = count(values > countryValue) + 1` | Tooltip comparison line + rank cell | `#12 / 142` |
| `countriesOutrankedPercent` | Outranked Share | Share of scoped countries ranked below focus country | `((total − rank) / (total − 1)) × 100`, rounded | Tooltip comparison line | `92%` |
| `valueContextInsight` | Value Context Chip | Plain-language position vs mean/median | Ratio thresholds (e.g. ≥1.15 → “Well above average”) | Tooltip header chip | `Well above average` |
| `rangePosition` | Distribution Bar Position | Marker position on min–max bar | Linear scale; log scale when `max/min > 40` | Tooltip distribution bar | `67%` |
| `metricTooltipBlurb` | Metric Tooltip Blurb | One-line plain-English metric summary | Curated `MAP_METRIC_BLURBS[id]` or tightened first catalog sentence | Tooltip metric section | `Average economic output per person.` |

## 5) Relationship Chart (Where variables connect)

```mermaid
flowchart TD
  U[User input / UI controls] --> K1[Header key manager: Groq/Tavily keys]
  K1 --> K2[Frontend API transport headers]
  K2 --> E0[Backend key resolver]
  U --> A1[Assistant: message + mode + countryCode]
  U --> B1[Business: metricX + metricY + start/end + excludeIqr + highlight]
  U --> C1[PESTEL: countryCode + year]
  U --> D1[Porter: countryCode + year + industrySector]
  U --> F1[Dashboard: cca3 + year range + metric sections incl. crime]
  U --> G1[Global: metric + year + region + category incl. crime]

  E0 --> E1 & E4 & E5 & E6
  A1 --> E1[POST /api/assistant/chat]
  B1 --> E2[GET /api/analysis/correlation-global]
  E2 --> E3[Compute r, pValue, rSquared, slope, intercept, residual, ciBand]
  E3 --> E4[POST /api/analysis/business/correlation-narrative]
  C1 --> E5[POST /api/analysis/pestel]
  D1 --> E6[POST /api/analysis/porter]
  F1 --> E7[GET /api/country/:cca3/series + comparison + fx-series]
  G1 --> E8[GET /api/global/snapshot + /api/global/table]
  E8 --> M2[Choropleth tier model + map scope stats]
  M2 --> M3[MapCountryTooltip rank/blurb UI]

  E7 --> M1[(Metric catalog: 68 indicators)]
  E8 --> M1
  E2 --> M1
  E1 --> M1
  E5 --> M1
  E6 --> M1
```

## 5.1 Crime & public safety metric variables

These metric IDs are used in dashboard KPI cards, global crime table, and choropleth map selection.

| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |
| --- | --- | --- | --- | --- | --- |
| `homicide_rate` | Intentional homicide rate | Unlawful deaths per 100,000 people (UNODC via WDI) | Direct WDI series `VC.IHR.PSRC.P5` | Dashboard crime section, global crime table, choropleth map | `6.2` |
| `homicide_rate_female` | Female homicide rate | Female intentional homicides per 100,000 female | WDI `VC.IHR.PSRC.FE.P5` | Dashboard crime chart group | `1.8` |
| `homicide_rate_male` | Male homicide rate | Male intentional homicides per 100,000 male | WDI `VC.IHR.PSRC.MA.P5` | Dashboard crime chart group | `10.4` |
| `gbv_women_pct` | Intimate-partner violence | % of ever-partnered women ages 15–49 experiencing physical/sexual violence in last 12 months | WDI `SG.VAW.1549.ZS` | Dashboard crime KPI card | `23.5` |
| `idp_conflict_violence` | New IDP from conflict | New internal displacements from conflict/violence (cases) | WDI `VC.IDP.NWCV` (IDMC) | Dashboard conflict chart group | `125000` |
| `battle_related_deaths` | Battle-related deaths | Fatalities from organized armed conflict | WDI `VC.BTL.DETH` (UCDP) | Dashboard conflict chart group | `4500` |
| `rule_of_law_wgi` | Rule of Law (WGI) | Governance estimate for rule adherence (-2.5 to +2.5) | WDI `GOV_WGI_RL_EST` | Dashboard governance chart group | `0.42` |
| `political_stability_wgi` | Political Stability (WGI) | Likelihood of violence/terror destabilizing government | WDI `GOV_WGI_PV_EST` | Dashboard governance chart group | `-0.15` |
| `corruption_control_wgi` | Control of Corruption (WGI) | Extent public power exercised for private gain | WDI `GOV_WGI_CC_EST` | Dashboard governance chart group | `-0.08` |

## 6) Practical examples (copy-friendly)

### Example: correlation-global request

`GET /api/analysis/correlation-global?metricX=gdp_per_capita&metricY=life_expectancy&start=2000&end=2023&excludeIqr=true&highlight=IDN`

### Example: assistant ranking/comparison request

`POST /api/assistant/chat`

```json
{
  "message": "Rank Indonesia and Brazil on GDP per capita and show what % of the top each is.",
  "countryCode": "IDN",
  "webSearchPriority": false
}
```

## 7) Notes for beginners

- Always confirm that metric units match when comparing values.
- “Data year” may be earlier than “requested year” due to coverage and gap-fill logic.
- When `GROQ_API_KEY` or `TAVILY_API_KEY` is missing, the backend may switch to deterministic fallbacks.
- Crime metrics use different units: per 100,000 (rates), % (GBV survey), cases/people (conflict counts), index (WGI -2.5 to +2.5). Do not compare across unit types without normalization.
- WGI governance indices are perception-based estimates, not direct event counts.
