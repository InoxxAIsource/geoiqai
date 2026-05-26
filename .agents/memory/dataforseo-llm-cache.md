---
name: DataForSEO LLM cache pattern
description: How the dataforseo_cache table and helper functions work for LLM mention endpoints
---

The `dataforseo_cache` table (key TEXT PK, data JSONB, cost_usd TEXT, cached_at TIMESTAMPTZ, expires_at TIMESTAMPTZ) provides a generic 24h cache for expensive DataForSEO calls.

Two helpers in `dataforseo.ts`: `getDfCache(key)` and `setDfCache(key, data, costUsd)`.

**Why:** LLM Mentions endpoints cost money per call. Cache key is deterministic from domain+keywords so repeated tab opens don't re-charge.

**How to apply:** When adding any new DataForSEO endpoint that returns stable data (more than a few hours old is OK), use these helpers. Cache key format: `{type}:{location_code}:{domain_or_sorted_targets}:{first_2_keywords}`.

**Type casting gotcha:** When spreading cached JSONB back into the result type, cast via `unknown` first: `(cached as unknown as TargetType)`. Direct `as TargetType` causes TS2352 error because `Record<string, unknown>` doesn't overlap with specific interfaces.

**Frontend wiring pattern:**
- Citations tab: auto-fetch in `useEffect` when tab opens + brand changes; overlay real data onto hardcoded `getCitationData()` result; show "Live data" badge.
- Competition tab: on-demand via button click; overlay real `llmCrossAgg` onto `compList`; show "Live data" badge when `llmCrossAggBrandId === selectedBrand.id`.
