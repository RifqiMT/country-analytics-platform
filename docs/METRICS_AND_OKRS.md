# Product Metrics and OKRs (Product-Team Documentation)

This document defines how the product team measures success for the Country Analytics Platform.

It is written so that a reader without prior knowledge of the backend/AI stack can still:
- Understand what each metric means
- Know why it matters to users
- Know how to measure it (inputs, event sources, and pass/fail gates)
- Use it to track OKR progress over time

## 1) Product metrics framework

We group metrics into four categories so teams can diagnose issues quickly:

1. **Trust & quality**: Did the assistant answer correctly and responsibly?
2. **Performance**: Did the platform feel fast enough for analysts?
3. **Usage & outcomes**: Did people complete real workflows and use exports?
4. **Governance**: Did releases stay traceable and well documented?

## 2) Trust & quality metrics

### 2.1 Assistant Grounded Answer Rate

**What it measures:**  
The percentage of assistant responses that are considered grounded and safe without being replaced by deterministic fallback content.

**Definition (working):**
`GroundedAnswerRate = (count(assistant responses that pass safety/citation gates and keep the LLM answer) / count(total assistant responses evaluated)) * 100`

**Why it matters:**  
Users need answers that remain within their evidence boundaries.

**How to measure (implementation-aligned):**
- Evaluate whether the assistant path returned a deterministic fallback replacement (fallback vs kept LLM response)
- Evaluate whether the response includes valid citation tags for factual claims

**Suggested instrumentation inputs:**
- Backend route classification for `/api/assistant/chat` response path
- Safety gate outcome (citations presence/quality)
- Whether deterministic fallback message was used

**Example interpretation:**
- 96% grounded rate means most answers are safe and within evidence boundaries.

### 2.2 Verified-Web Precision (time-sensitive questions)

**What it measures:**  
Precision of “verified web answer” behavior when the question requires live, time-sensitive evidence.

**Definition (working):**
`VerifiedWebPrecision = (count(verified-web answers where required web grounding constraints are satisfied) / count(all verified-web routed answers)) * 100`

**Why it matters:**  
Without verified web grounding, the assistant can accidentally state outdated or incorrect “current” facts.

**How to measure:**
- Use deterministic verified-web mode detection for eligible question classes
- Validate that the output uses the required web evidence format (including the `[W1]`-style citation behavior)

### 2.3 Deterministic Fallback Activation Rate

**What it measures:**  
How often the system had to fall back because the AI/web output did not meet grounding constraints.

**Definition (working):**
`FallbackActivationRate = count(responses using deterministic fallback) / count(total assistant responses) * 100`

**Why it matters:**  
High fallback can indicate either a quality problem (model drift) or evidence retrieval gaps.

### 2.4 PESTEL Grounding Pass Rate

**What it measures:**  
Share of PESTEL generations that pass strict grounding QA without forced deterministic replacement.

**Definition (working):**
`PestelGroundingPassRate = count(PESTEL runs passing strict grounding validation) / count(total PESTEL runs) * 100`

**Why it matters:**  
Directly measures whether PESTEL remains evidence-backed and usable for human decision workflows.

### 2.5 Metric catalog completeness rate

**What it measures:**  
Share of documented metrics in `METRIC_CATALOG.md` that match `backend/src/metrics.ts` at release time.

**Definition (working):**
`MetricCatalogSyncRate = count(metrics in catalog matching code) / count(total metrics in code) * 100`

**Target:** 100% on every release.

### 2.6 Crime & safety module adoption

**What it measures:**  
Usage of crime-category features (dashboard safety section views, global crime table tab, homicide choropleth selection).

**Why it matters:**  
Validates that the 2026-07-20 crime metric expansion delivers value to security/risk analyst workflows.

## 3) Performance metrics

### 3.1 Assistant latency (P50 / P95)

**What it measures:**  
End-to-end response time for the assistant.

**Targets (example, to be tuned):**
- P50: optimized “feels instant” experience
- P95: prevents long-tail user frustration

**How to measure:**
- Backend timing for `/api/assistant/chat` request start → response end

### 3.2 Backend P50 / P95 for assistant chat

**What it measures:**  
Backend compute + retrieval time specifically (useful for diagnosing delays).

### 3.3 Web retrieval latency & timeout rate (Tavily)

**What it measures:**
- Average/percentile retrieval time for web context
- Frequency of retrieval failures/timeouts

### 3.4 Key validation success rate

**What it measures:**  
Ratio of successful provider validations from `/api/keys/validate`.

**Definition (working):**
`KeyValidationSuccessRate = count(validated keys with ok=true) / count(validation attempts with provided keys) * 100`

### 3.5 Business analysis completion rate (timeout-resilience KPI)

**What it measures:**  
How often Business Analytics returns a usable result payload after users click Generate.

**Definition (working):**
`BusinessAnalysisCompletionRate = count(generate clicks resulting in non-empty correlation payload) / count(total generate clicks) * 100`

**Why it matters:**  
Directly tracks the reliability pain-point for long-range statistical runs.

### 3.6 Business fallback utilization rate

**What it measures:**  
How often reliability mode had to use narrower year windows.

**Definition (working):**
`BusinessFallbackUtilizationRate = count(runs where fallback year window was used) / count(total business analysis runs) * 100`

**Why it matters:**  
Shows where backend performance still needs optimization to satisfy strict-range runs.

## 4) Usage & outcomes metrics

### 4.1 Task completion rate for key workflows

**What it measures:**  
How many users successfully complete “core workflow” interactions (not just open screens).

**Common workflow examples:**
- Assistant ranking/comparison questions
- PESTEL/Porter generation runs
- Business Analytics “Generate analysis” completion

### 4.2 Session retention for analyst workflows

**What it measures:**  
Whether analysts return to use the product again within a meaningful window.

### 4.3 Export usage rate

**What it measures:**  
How often users export charts/tables (CSV/PNG) after generating an analysis.

**Why it matters:**  
Exports reflect the product’s usefulness as a reporting/decision-support tool.

## 5) Governance metrics (release hygiene)

### 5.1 Traceability matrix coverage

**What it measures:**  
Percentage of shipped feature changes that include an updated traceability matrix entry.

### 5.2 Documentation alignment in release cycle

**What it measures:**  
Whether the documentation set (PRD, APIs, guardrails, variables, design guidelines) stays aligned with the actual implementation at release time.

## 6) OKR framework for the product team

### Objective 1: Improve assistant trust and accuracy

Key Results:
- **KR1:** Reduce hallucination-related user complaints by **60% QoQ**
- **KR2:** Achieve **>= 95% grounded-output pass rate** on a monitored benchmark suite
- **KR3:** Keep unresolved citation placeholder leakage incidents at **<= 2%**
- **KR4:** Keep PESTEL strict grounding pass rate at **>= 85%** on monitored countries/sectors

Measurement guidance:
- Maintain a stable benchmark prompt set per intent class (ranking, comparison, verified web, non-metric web)
- Compare performance across time windows (QoQ trend)

### Objective 2: Improve analysis speed and usability

Key Results:
- **KR1:** Reduce `/api/assistant/chat` P95 latency by **35%**
- **KR2:** Reduce multi-country comparison response completion time by **30%**
- **KR3:** Increase successful first-answer acceptance by **25%**
- **KR4:** Keep `BusinessAnalysisCompletionRate >= 97%` over rolling 28 days
- **KR5:** Keep strict-range timeout failure rate under **8%** for default full-range runs

Measurement guidance:
- “First-answer acceptance” should be defined using a user signal (for example: regenerate clicks vs completed satisfaction)
- Pair latency improvements with stable accuracy metrics to avoid quality regressions

### Objective 3: Strengthen product-operational governance

Key Results:
- **KR1:** Ensure **100%** of feature releases are reflected in `TRACEABILITY_MATRIX.md` and `GUARDRAILS.md`
- **KR2:** Ensure **100%** of core documentation updates occur in the same release cycle as the feature change
- **KR3:** Maintain weekly doc-drift review closure at **>= 90%**

### Objective 4: Expand indicator coverage for security and governance use cases

Key Results:
- **KR1:** Maintain **68-metric catalog** synchronized across code, docs, and Sources page
- **KR2:** Achieve **>= 90%** crime-category KPI card render success rate for countries with any crime data
- **KR3:** Ensure global crime table loads within **P95 < 8s** for default year selection

Measurement guidance:
- Track crime section view events and global crime tab usage
- Monitor missing-data rates for GBV and WGI indices by country

## 7) Review cadence (recommended)

- Weekly: review quality + performance deltas, especially fallback activation and verified-web precision
- Monthly: review adoption + export usage trends
- Quarterly: score OKRs, adjust benchmarks, and set next-quarter targets
