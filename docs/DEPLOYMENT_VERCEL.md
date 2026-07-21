# Vercel Deployment Guide

This guide prepares `country-analytics-platform` for a single-project Vercel deployment:
- **Frontend** (Vite static assets) is served from `frontend/dist`
- **Backend** (Express API) is served as a Vercel Serverless Function at `/api/*`

---

## 1. Deployment architecture

```
Browser
  ├── /              → frontend/dist (static SPA)
  ├── /global        → frontend/dist (client-side routing)
  └── /api/*         → api/index.ts → backend/src/index.ts (Express)
```

| Component | Path | Role |
| --- | --- | --- |
| Static build output | `frontend/dist` | React SPA assets |
| API entrypoint | `api/index.ts` | Vercel serverless handler |
| API source | `backend/src/index.ts` | Express app (exported, no local listener on Vercel) |
| Route rewrites | `vercel.json` | `/api/*` → serverless; all else → SPA |

**Build note:** Root `npm run build` compiles both workspaces. Vercel build command uses `npm run build -w frontend` only—the backend is bundled by the serverless function at deploy time via `api/index.ts` imports.

---

## 2. Required environment variables

Set in **Vercel → Project → Settings → Environment Variables**:

### AI providers (optional but recommended)

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | Optional | Enables LLM for Assistant, PESTEL, Porter, Business narratives |
| `TAVILY_API_KEY` | Optional | Enables verified-web retrieval paths |

### Groq model routing (optional overrides)

| Variable | Default (code) | Purpose |
| --- | --- | --- |
| `GROQ_MODEL_PESTEL` | `llama-3.3-70b-versatile` | PESTEL primary model |
| `GROQ_MODEL_PORTER` | `openai/gpt-oss-120b` | Porter primary model |
| `GROQ_MODEL_ASSISTANT` | `llama-3.1-8b-instant` | Assistant primary model |
| `GROQ_MODEL_BUSINESS` | `llama-3.3-70b-versatile` | Business narrative primary model |
| `GROQ_FALLBACK_MODELS_*` | Built-in chains | Per-use-case fallback model lists |

See `docs/VARIABLES.md` for full Groq env var reference.

### Runtime and performance

| Variable | Required | Purpose |
| --- | --- | --- |
| `CAP_SERVERLESS_BUDGET_MS` | Optional | Serverless invocation wall-clock budget (default `55000` ms) |
| `DISABLE_BOOTSTRAP_WARMUP` | Optional | Set `1` to skip background metric prefetch |
| `VERCEL` | Auto-set | Detected by platform; prevents duplicate server listener |
| `AWS_LAMBDA_FUNCTION_NAME` | Auto-set | Lambda runtime detection for budget/warmup logic |

### Frontend (build-time)

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Optional | Leave **empty** for same-origin deploy (recommended). Set only if frontend calls an external API host. |

**Note:** `PORT` is not required on Vercel—the serverless runtime handles port binding internally.

---

## 3. Timeout and budget alignment

| Setting | Value | Notes |
| --- | --- | --- |
| `vercel.json` `maxDuration` | 60 seconds | Hard platform limit per invocation |
| `CAP_SERVERLESS_BUDGET_MS` default | 55 seconds | Application-level budget with 1.5s reserve |
| Global table matrix deadline | ~55s serverless / ~120s local | Internal `TABLE_BUILD_DEADLINE_MS` in `globalTable.ts` (no outer 30s empty fallback) |
| Outbound HTTP timeouts | WDI 12–18s; WHO 18s; IMF 30s; UIS 45s | `fetchWithRetry({ timeoutMs })` |
| FX series route timeout | ~22 seconds | `settleWithin` cap in `index.ts` |
| Correlation year batch concurrency | 8 (serverless) | Higher than local (4) for throughput |

If long-running analysis times out in production:
1. Enable Business Analytics reliability mode (automatic narrower window fallback)
2. Consider increasing `CAP_SERVERLESS_BUDGET_MS` up to `58000` (leave headroom below 60s)
3. Verify `DISABLE_BOOTSTRAP_WARMUP=1` if cold-start warmup causes first-request delays

---

## 4. First deploy steps

1. Import the GitHub repository in Vercel.
2. Keep root directory as repository root.
3. Confirm build settings:
   - **Build Command:** `npm run build -w frontend`
   - **Output Directory:** `frontend/dist`
   - **Install Command:** `npm install` (installs all workspaces)
4. Set environment variables (Section 2).
5. Deploy.

---

## 5. Validation checklist after deploy

- [ ] Open `/` — SPA loads without 404
- [ ] Call `/api/health` — HTTP 200 with `{ "ok": true }`
- [ ] Dashboard — select a country; KPI cards and charts load
- [ ] Dashboard — FX card shows rate with source and date
- [ ] Global Analytics — map and table tabs load
- [ ] Assistant — send a metric question; verify response or graceful fallback
- [ ] PESTEL/Porter — generate analysis; verify output or scaffold fallback
- [ ] Browser network tab — requests are same-origin (`/api/...`) unless `VITE_API_BASE_URL` is set
- [ ] BYOK — enter keys in header panel; validate and run one AI workflow

---

## 6. Operational notes

### Serverless behavior
- `backend/src/index.ts` does **not** open a TCP listener when `VERCEL=1` or `AWS_LAMBDA_FUNCTION_NAME` is set
- Background bootstrap warmup is **skipped** on serverless to avoid `FUNCTION_INVOCATION_TIMEOUT`
- In-memory cache is per-invocation (cold starts may re-fetch data)

### Local development (unchanged)
```bash
npm -C backend run dev    # API on :4000
npm -C frontend run dev   # SPA on :5173 (proxies /api → :4000)
```

### Custom domains
Configure domain in Vercel project settings after first successful deploy.

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| API 404 on `/api/health` | Missing `vercel.json` rewrite or `api/index.ts` | Verify root `vercel.json` and `api/` folder exist |
| AI features return scaffold only | Missing `GROQ_API_KEY` | Set key in Vercel env vars or use BYOK |
| Long correlation times out | Serverless budget exceeded | Enable reliability mode; reduce year range |
| CORS errors | Split-host deploy with wrong `VITE_API_BASE_URL` | Set `VITE_API_BASE_URL` to API host or use same-origin |
| Empty country list | Upstream REST Countries failure | Check `x-cap-warning` header; retry |

---

## 7. Related documents

- `docs/VARIABLES.md` — full environment and request variable reference
- `docs/API_REFERENCE.md` — endpoint contracts
- `docs/RELEASE_READINESS_CHECKLIST.md` — pre-release validation
- `docs/ARCHITECTURE.md` — runtime flows and evidence hierarchy
