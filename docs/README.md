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
2. `USER_PERSONAS.md`
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
7. `TRACEABILITY_MATRIX.md`

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

### 2026-04-29 implementation-to-doc sync included:

- Country dashboard FX source hierarchy and fallback documentation
- Business Analytics timeout-resilience and strict-range governance behavior
- Business Analytics presentation mode + keyboard shortcut guidance
- Sources page accordion/disclosure UX and default collapsed top sections
