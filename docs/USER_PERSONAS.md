# User Personas (Audience Model)

This document defines the primary user archetypes for the Country Analytics Platform.

Each persona describes:
- Their goals (what “success” looks like)
- Their pain points (what slows them down or introduces risk)
- Their evidence needs (how they validate outputs)
- Their common workflows across dashboard, assistant, and strategy modules

## Persona 1: Policy Analyst

**Primary goal:** assess country trends and policy-relevant context quickly, with clear data-year lineage.

**Jobs to be done:**
- Compare indicators across peers using consistent metric definitions
- Identify meaningful changes over time without losing track of requested vs data year
- Produce briefing-ready summaries with evidence attribution

**Pain points:**
- Fragmented sources and inconsistent “latest year” handling
- Unclear interpretation of units and missing values
- Time wasted reconciling definitions across spreadsheets

**Evidence needs:**
- Explicit data-year display (what year the numbers actually came from)
- Units and metric definitions visible or easy to access
- Assistant responses that do not drift outside platform scope

**Success signals:**
- The user can explain “what changed, where the numbers came from, and what it means” in a single pass.

## Persona 2: Strategy Manager

**Primary goal:** evaluate market attractiveness and risks for expansion using coherent strategic frameworks.

**Jobs to be done:**
- Generate PESTEL and Porter narratives grounded in indicator evidence
- Use ranking/comparison outputs to focus leadership discussions
- Translate analytics into hypothesis statements for further validation

**Pain points:**
- Slow synthesis across multiple indicators and qualitative context
- Difficulty maintaining consistent assumptions across analysis iterations

**Evidence needs:**
- Deterministic structured outputs that stay within the requested metric scope
- Optional verified-web grounding for time-sensitive “current” questions

**Success signals:**
- Leadership can review a narrative and understand which indicators drove key claims.

## Persona 3: Research Associate

**Primary goal:** create reproducible comparisons across countries and metrics.

**Jobs to be done:**
- Build repeatable indicator selection and year-range windows
- Export analysis outputs for internal review and audit
- Reduce manual transformation overhead caused by unclear metric definitions

**Pain points:**
- Metric ambiguity (unclear formula, unit, and data origin)
- Rework when the “same metric name” maps to different definitions

**Evidence needs:**
- Metric catalog clarity: formulas, units, source summary
- Stable API contracts and predictable behavior when data is missing

**Success signals:**
- A comparison pack can be regenerated later with the same assumptions and evidence.

## Persona 4: Product / Operations Leader

**Primary goal:** ensure the platform stays reliable, governed, and aligned with user value.

**Jobs to be done:**
- Track quality and trust deltas across releases
- Ensure traceability and documentation alignment for AI behavior changes
- Validate that performance meets analyst workflow expectations

**Pain points:**
- Unclear linkage between feature changes and user-relevant outcomes
- Doc drift that causes confusion during audits or onboarding

**Evidence needs:**
- Quantitative quality metrics (groundedness, fallback activation)
- Release governance evidence: traceability matrix coverage and guardrail alignment

**Success signals:**
- Doc drift is detected early; releases are auditable and measurable.

## Persona 5: Enterprise Power User (BYOK Analyst)

**Primary goal:** use personal API quotas/credentials safely across modules without waiting for server-level key provisioning.

**Jobs to be done:**
- Enter and validate Groq/Tavily keys once, then use them in Assistant, PESTEL, Porter, and Business narratives.
- Keep keys in session or persistent browser storage based on security policy.
- Confirm key status quickly before heavy analysis runs.

**Pain points:**
- Re-entering keys per feature/request
- Hidden key usage path (unclear whether requests use personal key or server key)
- Unhelpful provider errors for invalid or expired keys

**Evidence needs:**
- Per-key validation status and clear failure messages
- App-wide consistency in key usage
- Safe fallback when keys are unavailable

**Success signals:**
- User can set keys in one place and complete all AI workflows without reconfiguration.

## Persona 6: Executive Reviewer (Presentation Consumer)

**Primary goal:** consume analysis outputs quickly in a clean, decision-ready format for review meetings.

**Jobs to be done:**
- Review Business Analytics outputs without control-panel clutter.
- Focus on key diagnostics (r, p-value, R², sample size, narrative summary).
- Capture clean screenshots for board/leadership decks.

**Pain points:**
- Overloaded analyst UI during executive review sessions.
- Difficulty separating controls/debug information from final insights.

**Evidence needs:**
- Clear KPI summaries and narrative interpretation blocks.
- Minimal, polished view with stable formatting.

**Success signals:**
- User can toggle presentation mode and complete review/export in one uninterrupted flow.

## Persona 7: Security & Risk Analyst

**Primary goal:** assess country safety, governance quality, and conflict exposure using standardized crime and public safety indicators.

**Jobs to be done:**
- Compare homicide rates and gender-disaggregated violence metrics across peer countries
- Monitor governance indices (rule of law, political stability, corruption control) for risk scoring
- Track conflict-related displacement and battle deaths for operational security planning
- Export crime/safety data for inclusion in country risk reports

**Pain points:**
- Fragmented crime statistics from multiple agencies with inconsistent definitions
- Limited visibility into survey-based indicators (e.g., GBV) with sparse country coverage
- Difficulty benchmarking governance perception indices against quantitative violence metrics

**Evidence needs:**
- Clear source attribution (UNODC, IDMC, UCDP, World Bank WGI)
- Unit consistency (per 100,000 vs index scales vs absolute counts)
- Data-year transparency for lagging crime statistics
- Interpretation guardrails for perception-based vs event-based metrics

**Success signals:**
- Analyst can produce a country safety profile with homicide, governance, and conflict indicators in a single dashboard pass.
- Global crime table enables regional benchmarking without manual data assembly.

---

## Persona-to-module matrix

| Persona | Dashboard | Compare | Global | Assistant | PESTEL | Porter | Business | Sources |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Policy Analyst | **Primary** | **Primary** | Secondary | Secondary | — | — | Secondary | Reference |
| Strategy Manager | Secondary | Secondary | Secondary | Secondary | **Primary** | **Primary** | Secondary | Reference |
| Research Associate | **Primary** | **Primary** | **Primary** | Secondary | — | — | **Primary** | **Primary** |
| Product / Ops Leader | Review | Review | Review | Review | Review | Review | Review | Review |
| BYOK Power User | — | — | — | **Primary** | **Primary** | **Primary** | **Primary** | — |
| Executive Reviewer | — | Secondary | — | — | Secondary | Secondary | **Primary** | — |
| Security & Risk Analyst | **Primary** | Secondary | **Primary** | Secondary | Secondary | — | Secondary | Reference |

**Legend:** Primary = main daily workflow; Secondary = supporting use; Reference = lookup/audit; Review = governance oversight.

---

## Persona workflow examples

### Policy Analyst — weekly country briefing
1. Open Dashboard → select focus country → set year range
2. Review Financial and Health accordion sections for YoY changes
3. Open comparison table → note country vs regional avg vs global
4. Ask Assistant: "Compare [country] and [peer] on GDP per capita and life expectancy"
5. Export chart PNG for briefing deck

### Security & Risk Analyst — country safety profile
1. Open Dashboard → select focus country → Crime & public safety section
2. Review homicide, conflict, and governance KPI cards
3. Switch to Global Analytics → Crime & safety tab → regional benchmark
4. Select `homicide_rate` on choropleth map
5. Consult Sources for UNODC/IDMC/UCDP/WGI attribution in report

### Strategy Manager — expansion planning cycle
1. Select target country on Dashboard for baseline indicators
2. Generate PESTEL analysis for macro-environment assessment
3. Generate Porter analysis for target ILO-ISIC sector
4. Use Business Analytics to test hypothesis (e.g. GDP per capita vs life expectancy)
5. Present Business Analytics in presentation mode for leadership review
