# Product Documentation Standard

## Purpose

Define a professional, enterprise-grade documentation standard so every document remains:
- implementation-aligned,
- understandable by non-experts,
- auditable for quality and governance,
- maintainable through product and release changes.

## Audience

This standard serves:
- product managers and strategy leads,
- frontend/backend engineers,
- data and analytics contributors,
- design and UX reviewers,
- QA/release stakeholders and leadership reviewers.

## Core principles

1. **Clarity first**: each document must be understandable without prior codebase knowledge.
2. **Single source of truth**: each critical definition (metric, variable, contract) has a canonical home.
3. **Current-state accuracy**: documentation reflects behavior implemented in current code.
4. **Traceability**: requirements map to implementation and validation.
5. **Governance readiness**: docs must expose limitations, controls, and release implications.
6. **Audience-aware writing**: combine technical precision with plain-language explanation.

## Mandatory structure for major docs

For major artifacts (PRD, API reference, variables, methods, guardrails, traceability), include these sections where relevant:

1. Purpose and scope
2. Reader profile / intended audience
3. Definitions or glossary
4. Core behavior rules (must/should)
5. Concrete examples (UI, API payloads, formulas)
6. Limitations and guardrails
7. Related references and canonical dependencies

## Writing and formatting rules

- Use descriptive headings and short, focused sections.
- Use tables for structured definitions (variables, metrics, contract fields).
- Prefer explicit terminology (`must`, `should`, `can`) over vague language.
- Define acronyms at first mention.
- Keep examples realistic and implementation-aligned.
- Distinguish clearly between:
  - user-selected values vs system-resolved values,
  - deterministic logic vs model-generated synthesis,
  - observed data vs derived values.

## Synchronization rules across docs

Documentation updates must preserve cross-document consistency:

- Metric or unit changes require updates in:
  - `docs/METRIC_CATALOG.md`
  - `docs/VARIABLES.md`
  - `docs/API_REFERENCE.md` (if request/response fields are affected)
  - `docs/TRACEABILITY_MATRIX.md`
- Assistant behavior/routing changes require updates in:
  - `docs/ASSISTANT_BEHAVIOR.md`
  - `docs/GUARDRAILS.md`
  - `docs/API_REFERENCE.md`
  - `docs/TRACEABILITY_MATRIX.md`
- App-wide key management / auth-header behavior changes require updates in:
  - `docs/VARIABLES.md`
  - `docs/API_REFERENCE.md`
  - `docs/GUARDRAILS.md`
  - `docs/TRACEABILITY_MATRIX.md`
- Analysis method changes require updates in:
  - `docs/ANALYSIS_METHODS.md`
  - `docs/VARIABLES.md` (derived variables/formulas)
  - `docs/METRICS_AND_OKRS.md` when product quality measures are affected
- Product scope changes require updates in:
  - `docs/PRD.md`
  - `docs/USER_PERSONAS.md`
  - `docs/USER_STORIES.md`
  - `docs/TRACEABILITY_MATRIX.md`
- Shared UI component / design-system changes (e.g. DataTable, choropleth tiers) require updates in:
  - `docs/DESIGN_GUIDELINES.md`
  - `docs/VARIABLES.md` (presentation-layer variables when applicable)
  - `docs/PRODUCT_DOCUMENTATION.md`
  - `docs/TESTING_STRATEGY.md`
  - `docs/RELEASE_READINESS_CHECKLIST.md`
  - `docs/TRACEABILITY_MATRIX.md`
- Data-provider or gap-fill pipeline changes require updates in:
  - `backend/src/dataProviders.ts` (Sources UI)
  - `docs/METRIC_CATALOG.md`
  - `docs/API_REFERENCE.md`
  - `docs/ARCHITECTURE.md`
  - `docs/VARIABLES.md`
  - `docs/GUARDRAILS.md` / `docs/DEPLOYMENT_VERCEL.md` when timeouts change

## Definition of done for documentation updates

A documentation change is complete only when:
- facts match implemented behavior;
- references to related documents are updated and valid;
- examples are concrete and executable/readable;
- limitations and assumptions are stated for affected behavior;
- impacted traceability rows are updated where needed;
- a change note is recorded in `docs/CHANGELOG.md`.
- the in-app Sources/Methodology page content is synchronized for user-facing transparency.

## Review workflow

1. **Authoring**: implementer prepares doc changes in the same PR as behavior changes.
2. **Technical review**: engineering validates code/contract alignment.
3. **Product/design review**: wording and usability are validated for non-technical readers.
4. **Release governance check**: guardrails and traceability coverage are confirmed.

## Maintenance cadence

- **Per PR**: update relevant docs alongside implementation changes.
- **Weekly**: quick drift scan for stale references, examples, and route/variable names.
- **Per release**: ensure guardrails and traceability updates are complete.
- **Monthly**: onboarding readability review for new joiners.
- **Per metric catalog change**: synchronize `METRIC_CATALOG.md`, `VARIABLES.md`, Sources page, and traceability matrix in the same PR.

## Document templates (quick reference)

### Product document template
1. Executive summary (1 paragraph)
2. Vision and mission
3. Product benefits (by audience)
4. Feature catalog (module-by-module)
5. Business guidelines
6. Technical guidelines
7. Stack and dependencies
8. Related documents and maintenance rules

### Variable entry template
| Variable Name | Friendly Name | Definition | Formula / Rule | Location in the apps | Example |

### Metric entry template
| Metric ID | Friendly Name | Unit | Category | World Bank Code | Formula | Source summary |

### User story template
**Story:** As a [persona], I want [capability] so that [outcome].  
**Acceptance criteria:** (numbered, testable, implementation-aligned)

### Traceability row template
| Req ID | Requirement | Primary Implementation | Supporting Files | Validation |

### Guardrail template
**ID:** [DG/TG/AG/BG/OG]-##  
**Rule:** (must/should statement)  
**Practical effect:** (what users/engineers observe)  
**Validation:** (how to verify compliance)

## Complete document registry (23 files)

| # | Document | Canonical purpose | Update trigger |
| --- | --- | --- | --- |
| 1 | `README.md` (root) | Product entry point, quick start, doc map | Any user-visible feature change |
| 2 | `docs/README.md` | Role-based reading paths, sync checkpoints | Any doc set reorganization |
| 3 | `docs/PRODUCT_DOCUMENTATION.md` | Comprehensive product guide | Scope, features, or stack changes |
| 4 | `docs/PRD.md` | Product requirements and journeys | Scope or requirement changes |
| 5 | `docs/USER_PERSONAS.md` | Audience model | New user types or workflow changes |
| 6 | `docs/USER_STORIES.md` | Acceptance criteria | New/changed user-facing behavior |
| 7 | `docs/VARIABLES.md` | Variable dictionary with relationship charts | Env, API, storage, or derived var changes |
| 8 | `docs/METRIC_CATALOG.md` | 68-metric indicator dictionary | Metric add/remove/rename |
| 9 | `docs/METRICS_AND_OKRS.md` | Product health metrics and OKRs | New KPIs or OKR cycle changes |
| 10 | `docs/DESIGN_GUIDELINES.md` | UI/UX standards and palettes | New components, colors, or patterns |
| 11 | `docs/GUARDRAILS.md` | Technical, business, AI, UX, performance limits | Boundary or safety rule changes |
| 12 | `docs/TRACEABILITY_MATRIX.md` | Requirements → code mapping | Any FR/NFR change |
| 13 | `docs/ARCHITECTURE.md` | System layers and runtime flows | Architectural changes |
| 14 | `docs/API_REFERENCE.md` | Endpoint contracts | API shape or route changes |
| 15 | `docs/ASSISTANT_BEHAVIOR.md` | Assistant routing and grounding | AI behavior changes |
| 16 | `docs/ANALYSIS_METHODS.md` | Statistical/strategic methodology | Analysis logic changes |
| 17 | `docs/TESTING_STRATEGY.md` | Manual QA and automation roadmap | Validation approach changes |
| 18 | `docs/DEPLOYMENT_VERCEL.md` | Production deployment runbook | Deploy config changes |
| 19 | `docs/RELEASE_READINESS_CHECKLIST.md` | Pre-release gate | New release validation steps |
| 20 | `docs/EXECUTIVE_DOCUMENTATION_SUMMARY.md` | Leadership status snapshot | Major release milestones |
| 21 | `docs/CHANGELOG.md` | Versioned development history | Every documentation/product sync |
| 22 | `docs/PRODUCT_DOCUMENTATION_STANDARD.md` | This governance document | Documentation process changes |
| 23 | `docs/DOCUMENTATION_AUDIT_REPORT.md` | Formal code ↔ docs audit verification | Major release or comprehensive audit |

## Quality gates for documentation completeness

Before marking a documentation update complete, verify:

- [ ] All affected metric IDs appear in `METRIC_CATALOG.md` with correct units and sources
- [ ] Request/response variables documented in `VARIABLES.md` with examples
- [ ] PRD scope section reflects new/changed capabilities
- [ ] At least one user story with acceptance criteria exists for new user-facing features
- [ ] Traceability matrix has FR/NFR rows for new requirements
- [ ] Guardrails updated if data interpretation or AI behavior boundaries change
- [ ] Design guidelines updated if new UI patterns, colors, or components are introduced
- [ ] `CHANGELOG.md` entry with date and scope
- [ ] `docs/README.md` sync checkpoint updated for major releases
- [ ] Root `README.md` highlights section updated for user-visible changes
- [ ] `DOCUMENTATION_AUDIT_REPORT.md` updated for major comprehensive audits

