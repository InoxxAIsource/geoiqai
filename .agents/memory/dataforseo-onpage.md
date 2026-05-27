---
name: DataForSEO OnPage API limitation
description: Why DataForSEO on_page API does not work and what we use instead
---

The DataForSEO on_page API task_post endpoint creates tasks successfully (HTTP 200, returns task_id), but fetching results fails:
- `on_page/summary/live` with target config: 404
- `on_page/summary/task_get/{id}` (GET): 404
- `on_page/summary/live` with `{id: taskId}`: HTTP 200 but `result: null`

The account's DataForSEO plan does not support the on_page/summary endpoints.

**Fix applied:** `runOnPageAudit` in `dataforseo.ts` now does a direct HTML crawl instead of calling DataForSEO. It fetches the homepage + robots.txt via Node.js fetch, parses with regex, and checks 12 signals: title, meta description, H1, H2, canonical, HTTPS, viewport, JSON-LD schema, Open Graph, image alt text, internal links, AI crawler access (GPTBot/ClaudeBot blocks).

**Why:** All other working DataForSEO endpoints use the `/live` POST pattern with no pre-created task (dataforseo_labs, serp, backlinks, ai_optimization all follow this). The on_page async task pattern is an exception the account can't use.

**How to apply:** If upgrading to a DataForSEO plan that supports on_page, the `mapOnPageChecks` function is already written with the correct key names (no_title, no_description, no_h1_tag, etc.) and can be re-wired to `runOnPageAudit`. But the direct HTML crawl is fast (2s vs 90s), free, and works without any API plan.
