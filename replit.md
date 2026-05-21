# GEOscore

An AI Visibility Platform that helps startups and founders track how their brand appears in ChatGPT, Gemini, and Perplexity — like Google Search Console for AI search systems.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/geoscore run dev` — run the frontend (port 22117)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI integration (auto-provisioned)
- Optional env: `RAPIDAPI_KEY` — RapidAPI key for real Perplexity calls via `perplexity2.p.rapidapi.com` (falls back to OpenAI simulation without it)
- Optional env: `GEMINI_API_KEY` — Google Generative AI key for real Gemini calls (falls back to OpenAI simulation without it)
- Optional env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — Razorpay payment gateway (payments return 503 without them)
- Optional env: `RESEND_API_KEY` — Resend for transactional email (silently skips sending without it)
- Optional env: `APP_URL` — Public app URL used in email links (defaults to `https://geoscore.app`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + Wouter routing
- API: Express 5 (Node.js)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- AI: Replit AI Integrations (OpenAI-compatible) for audit engine
- Payments: Razorpay (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- **API spec**: `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- **DB schema**: `lib/db/src/schema/` — users, audits, monitored_brands, daily_scores, email_subscribers, rate_limits
- **Backend routes**: `artifacts/api-server/src/routes/` — audit, auth, dashboard, scores, payment, email
- **Frontend pages**: `artifacts/geoscore/src/pages/` — Home, Audit, Dashboard, Pricing, Login, Register
- **Design tokens**: `artifacts/geoscore/src/index.css` — GEOscore purple brand system
- **Audit engine**: `artifacts/api-server/src/lib/audit-engine.ts` — AI query logic
- **Auth utilities**: `artifacts/api-server/src/lib/auth.ts` — token-based auth

## Architecture decisions

- Auth uses a custom HMAC-SHA256 token (not JWT) stored in localStorage. Frontend sets `Authorization: Bearer <token>` via `setAuthTokenGetter` from `@workspace/api-client-react`.
- The audit engine calls OpenAI (via Replit AI integration) three times per audit to simulate ChatGPT, Gemini, and Perplexity responses. In production, plug in separate Gemini and Perplexity API keys for real responses.
- Payments use Razorpay (Indian payment gateway) — set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to enable.
- All API shapes are contract-first (OpenAPI → codegen → Zod schemas + React Query hooks).

## Product

- Free public audit: Enter any domain, get an AI visibility score (0-100) across ChatGPT, Gemini, and Perplexity in ~15 seconds
- Authenticated dashboard: Monitor multiple brands, track daily score trends, see competitor analysis
- Pricing: Free / Starter (₹3,999/mo) / Agency (₹11,999/mo) with Razorpay checkout

## User preferences

- INR pricing (Indian market focus)
- No emojis in UI
- Primary brand color: #534AB7 (purple)

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`, then rebuild the API server
- Always run `pnpm run typecheck:libs` after changing DB schema files (before API server typechecks will pass)
- Razorpay payments require `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` env vars — payments return 503 without them
- The audit engine uses Replit AI integration by default — for real multi-AI comparisons, add `GEMINI_API_KEY` and `PERPLEXITY_API_KEY` and update `audit-engine.ts`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
