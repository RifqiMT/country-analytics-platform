# Guardrails (Technical + Business + AI Safety)

Guardrails define the non-negotiable boundaries that keep the product safe, reliable, and trustworthy.

They are especially important because this platform mixes:
- Quantitative indicator data (with known units and provenance)
- AI-generated narratives (which must not drift outside evidence boundaries)
- Optional live web context (which must be cited and treated as unverified excerpt text)

## 1) How to use this document

Use these guardrails when:
- Reviewing output correctness for assistant answers, PESTEL/Porter, or business narratives
- Planning feature changes that impact AI routing, grounding, citations, or fallbacks
- Designing QA test cases and acceptance checks

## 2) Data guardrails (integrity and interpretability)

### DG-01: Data-year transparency is mandatory

- The platform may step back from a requested year due to data availability and coverage rules.
- Users must see and interpret the **actual data year** used for values.

**Practical effect:**  
Tables/cards should always reflect returned years (not just requested years).

### DG-02: Metric IDs are canonical

- Metric IDs from `docs/METRIC_CATALOG.md` and `backend/src/metrics.ts` are the only canonical identifiers.
- Do not silently substitute related/companion metrics when the user didn’t ask for them.

### DG-03: Missing values are missing (not zero)

- Backend logic may fill gaps using controlled enrichment sources, but missingness remains meaningful.

### DG-04: Units must match when comparing

- Percentage metrics, per-capita metrics, rates, and indexes must be interpreted within their unit types.

## 3) Technical guardrails (API safety + validation)

### TG-01: Validate ISO3 and metric IDs

- ISO3 country codes must match `^[A-Z]{3}$` where required.
- Metric IDs must exist in the metric catalog before fetching.

### TG-02: Validate year ranges and clamp

- Years are clamped to platform supported bounds.
- Business analytics uses an inclusive year window (`startYear..endYear`).

### TG-03: Prevent provider/LLM payload failures

- External provider calls are bounded by timeouts and retry logic.
- LLM calls must respect provider limits (prompt payload caps).

### TG-05: Exchange-rate provider integrity

- Country FX outputs must prioritize institutional, auditable sources.
- Daily quote path: ECB (via Frankfurter).
- Official fallback path: World Bank `PA.NUS.FCRF` (LCU per USD).
- If daily quote appears anomalous against official baseline, fallback is required.

### TG-04: Request-level BYOK key precedence

- If user-provided key headers exist, backend must prefer them over server env keys for that request.
- Header contracts:
  - `X-User-Groq-Api-Key`
  - `X-User-Tavily-Api-Key`
- Missing/invalid user keys must never crash the route; deterministic fallback remains mandatory.

## 4) AI guardrails (assistant + analysis generation)

### AG-01: Evidence-first answering (no unsupported certainty)

- For factual numeric claims, the assistant must rely on platform indicator evidence or cited web excerpts.
- If evidence is insufficient, output must fall back to a deterministic scaffold or state uncertainty.

### AG-02: Citation enforcement and placeholder sanitization

- Assistant output may contain citation tags internally; placeholder tokens must be stripped before user display.
- The final user-visible answer must not leak internal placeholder citation formats.

### AG-03: Verified web mode for time-sensitive non-metrics

- Some question types require live verification (for example, current officeholders or fast-moving events).
- When verified-web mode is needed, the system uses a deterministic verified-web path when possible.

### AG-04: Drift control (scope mismatch detection)

- If the assistant reply shows signs of drift (for example, “platform citations” appearing in web-first contexts where platform values are not supposed to anchor the claim), the backend replaces the reply with a grounded fallback.

### AG-05: Deterministic fallbacks are first-class

- Deterministic fallbacks are not “best effort”; they are a required safety mechanism.
- Fallback behavior should be stable and professional, never exposing engineering failure wording.

### AG-06: PESTEL snippet-only retrieval evidence

- PESTEL web context must use retrieved snippets as evidence blocks.
- Generated web synthesis text (provider-generated answer summaries) must not be treated as authoritative evidence.

### AG-07: PESTEL strict grounding QA gate

- Final merged PESTEL analysis must pass strict grounding validation ratio/section checks.
- If validation fails, backend must return deterministic Tavily+data blend or data-only scaffold.
- Grounding rejection reason should be recorded in attribution for auditability.

## 5) Business guardrails (responsible use)

### BG-01: Decision-support only

- Outputs are meant to support analysis and hypothesis generation.
- The platform should not present conclusions as guaranteed outcomes.

### BG-02: Interpretation must be labeled as exploratory where appropriate

- Business Analytics correlation analysis is correlation, not causation.
- Causal language must be hypothesis-generation language, not proof.

### BG-03: Reliability vs strictness must be explicit to users

- If analysis is delivered on a narrower fallback window, UI must disclose it.
- Users must be able to opt into strict selected-range-only mode for governance-sensitive workflows.

### BG-04: Crime & safety data interpretation discipline

- Homicide rates (UNODC via WDI) vary in reporting quality; missing values are meaningful, not zero.
- GBV prevalence (`gbv_women_pct`) comes from household surveys with limited and uneven country coverage.
- WGI governance indices (-2.5 to +2.5) are perception-based estimates, not direct event counts.
- Conflict metrics (IDP displacement, battle deaths) reflect specific institutional definitions—users must consult source documentation before cross-country comparison.
- Do not combine crime rate metrics with governance index metrics in a single composite score without explicit methodology disclosure.

## 6) Operational guardrails (release discipline)

### OG-01: Update docs + traceability on AI behavior changes

Any change that affects assistant routing, grounding, citations, fallbacks, or narrative structure must update:
- `docs/GUARDRAILS.md`
- `docs/ASSISTANT_BEHAVIOR.md` (and analysis docs when relevant)
- `docs/TRACEABILITY_MATRIX.md` for impacted requirements

### OG-02: Metric catalog synchronization

When metrics change (add/remove/rename), ensure:
- `docs/METRIC_CATALOG.md`
- `docs/VARIABLES.md`
- Any assistant metric extraction documentation

are updated in the same release cycle.

### OG-03: Sources and methodology documentation synchronization

When data-source hierarchy or resilience logic changes (e.g., FX provider fallback, timeout fallback strategy), update:
- `docs/PRD.md`
- `docs/VARIABLES.md`
- `docs/TRACEABILITY_MATRIX.md`
- `frontend/src/pages/Sources.tsx` narrative content
