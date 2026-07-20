# Documentation Index and Reading Path

This folder is the enterprise documentation source of truth for product, engineering, design, and governance teams.

## Documentation objectives

The documentation set must enable readers to:
- understand product purpose and business value without reading source code first;
- understand system logic, API behavior, and analytics methods at implementation level;
- validate quality, limits, and governance through guardrails and traceability;
- onboard quickly across product, engineering, analytics, design, and QA roles.

## Recommended reading paths by role

### Product leadership and strategy

1. `PRODUCT_DOCUMENTATION.md`
2. `PRD.md`
3. `USER_PERSONAS.md`
3. `USER_STORIES.md`
4. `METRICS_AND_OKRS.md`
5. `GUARDRAILS.md`
6. `TRACEABILITY_MATRIX.md`

### Engineering and data implementation

1. `ARCHITECTURE.md`
2. `API_REFERENCE.md`
3. `VARIABLES.md`
4. `METRIC_CATALOG.md`
5. `ANALYSIS_METHODS.md`
6. `ASSISTANT_BEHAVIOR.md`
7. `TESTING_STRATEGY.md`
8. `TRACEABILITY_MATRIX.md`

### Design and UX review

1. `PRD.md`
2. `USER_PERSONAS.md`
3. `USER_STORIES.md`
4. `DESIGN_GUIDELINES.md`
5. `GUARDRAILS.md`

## Document catalog and ownership intent

- `PRODUCT_DOCUMENTATION.md`: comprehensive product guide (overview, benefits, features, business/tech guidelines, stack)
- `PRD.md`: product goals, scope, requirements, risk framing
- `USER_PERSONAS.md`: target user archetypes and evidence needs
- `USER_STORIES.md`: user-level requirements and acceptance expectations
- `ARCHITECTURE.md`: runtime layers, modules, and interaction flows
- `API_REFERENCE.md`: endpoint contracts and request/response behavior
- `VARIABLES.md`: environment, request, and derived variable definitions
- `METRIC_CATALOG.md`: canonical metric dictionary and source mapping
- `ANALYSIS_METHODS.md`: statistical and strategic method explanations
- `ASSISTANT_BEHAVIOR.md`: routing, grounding, and response controls
- `TESTING_STRATEGY.md`: manual QA scope and future automation roadmap
- `DESIGN_GUIDELINES.md`: design system and UX quality rules
- `METRICS_AND_OKRS.md`: product health and performance framework
- `GUARDRAILS.md`: technical, business, and AI safety boundaries
- `TRACEABILITY_MATRIX.md`: requirement-to-implementation validation map
- `PRODUCT_DOCUMENTATION_STANDARD.md`: documentation governance rules
- `CHANGELOG.md`: versioned history of documentation and product-alignment updates
- `DEPLOYMENT_VERCEL.md`: production deployment setup and validation checklist for Vercel
- `RELEASE_READINESS_CHECKLIST.md`: release gate checklist (quality, guardrails, docs sync, deployment)
- `EXECUTIVE_DOCUMENTATION_SUMMARY.md`: leadership-level product/documentation status snapshot

## Minimum update protocol

If implementation or behavior changes, update affected docs in the same PR and verify:
- request/response examples still match current code;
- variable, metric, and guardrail references stay synchronized;
- traceability mappings and changelog entries are updated.

## Latest sync checkpoint

### 2026-07-20 comprehensive documentation audit included:

- Full codebase audit: 68 metrics, 7 app modules, 20+ API routes, 131 source files
- **Crime & public safety** category: 9 new metrics (UNODC, IDMC, UCDP, WGI) integrated across dashboard, global analytics, and sources
- New `PRODUCT_DOCUMENTATION.md` — master product guide for all stakeholders
- Expanded root `README.md` with metric coverage table, repository structure, and role-based doc map
- Updated PRD, personas (Security/Risk Analyst), user stories (crime/safety workflows)
- Expanded `VARIABLES.md` and `METRIC_CATALOG.md` with category relationship charts
- Updated design guidelines (brand tokens, PESTEL/Porter/SWOT palettes, crime dashboard patterns)
- Updated traceability matrix (FR-26–FR-28), guardrails (BG-04 crime interpretation), metrics/OKRs
- Synchronized executive summary, product documentation standard, and changelog

### 2026-07-20 second pass — gap closure audit included:

- Closed API contract gap: `GET /api/country/:cca3/fx-series` documented in API_REFERENCE and VARIABLES
- Added missing env vars: `VITE_API_BASE_URL`, `CAP_SERVERLESS_BUDGET_MS`, `AWS_LAMBDA_FUNCTION_NAME`
- Added client storage keys, EUR FX fields, response headers, chart color guidelines
- Expanded RELEASE_READINESS_CHECKLIST, DEPLOYMENT_VERCEL, ARCHITECTURE
- Corrected category terminology: 6 data categories + UI-only `general` grouping
- Updated `.env.example` with business model vars and serverless budget

### 2026-07-20 third pass — elaboration and cross-reference expansion:

- Rewrote `ASSISTANT_BEHAVIOR.md` and `ANALYSIS_METHODS.md` as full enterprise specifications
- Created `TESTING_STRATEGY.md` (manual QA + automation roadmap)
- Expanded traceability matrix with PRD journey, doc, and persona cross-references
- Expanded personas (module matrix, workflows), user stories (epic table, D4/D5 FX stories)
- Added UX guardrails (UG) and performance guardrails (PG) to `GUARDRAILS.md`
- Added complete 22-file document registry to `PRODUCT_DOCUMENTATION_STANDARD.md`

### 2026-04-29 implementation-to-doc sync included:

- Country dashboard FX source hierarchy and fallback documentation
- Business Analytics timeout-resilience and strict-range governance behavior
- Business Analytics presentation mode + keyboard shortcut guidance
- Sources page accordion/disclosure UX and default collapsed top sections
