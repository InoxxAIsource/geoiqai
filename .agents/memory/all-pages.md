---
name: All GeoIQ Pages
description: Complete list of every live page on geoiqai.com - SSR and React SPA. Check this before building any new page to avoid duplicates.
---

# All geoiqai.com Pages

**Rule: Before building any new page, grep this file for the path. If it exists, update it - don't create a duplicate.**

## SSR HTML Pages (Express API server)
Served by `artifacts/api-server`. Paths registered in `artifact.toml` and routed away from the React SPA.
Files: `seo-pages.ts`, `seo-pages-2.ts`, `seo-pages-3.ts`

| URL | File | Notes |
|-----|------|-------|
| /perplexity-seo | seo-pages.ts | |
| /chatgpt-brand-visibility | seo-pages.ts | |
| /geoiq-vs-rankscale | seo-pages.ts | |
| /generative-engine-optimization | seo-pages-2.ts | |
| /google-ai-overview-seo | seo-pages-2.ts | |
| /geo-optimization-checklist | seo-pages-2.ts | |
| /gemini-seo | seo-pages-2.ts | |
| /ai-search-optimization | seo-pages-2.ts | |
| /geoiq-vs-profound | seo-pages-2.ts | |
| /rankscale-alternative | seo-pages-2.ts | |
| /geoiq-vs-semrush | seo-pages-2.ts | Also has dead React component - SSR wins |
| /faq | seo-pages-2.ts | Also has dead React component - SSR wins |
| /ai-search-ranking-factors | seo-pages-2.ts | |
| /best-ai-visibility-tools | seo-pages-2.ts | |
| /geo-tools-comparison | seo-pages-3.ts | Added June 2026 |
| /chatgpt-visibility | seo-pages-3.ts | Added June 2026 |

## React SPA Pages (Vite frontend)
Served by `artifacts/geoscore`. Paths NOT in `artifact.toml` fall through to the SPA.
Router: `artifacts/geoscore/src/App.tsx`

| URL | Component |
|-----|-----------|
| / | Home.tsx |
| /audit | Audit.tsx |
| /dashboard | Dashboard.tsx |
| /roadmap | Roadmap.tsx |
| /pricing | Pricing.tsx |
| /login | Login.tsx |
| /signup | Signup.tsx |
| /register | Register.tsx |
| /forgot-password | ForgotPassword.tsx |
| /auth/reset-password | ResetPassword.tsx |
| /auth/verify-email | VerifyEmail.tsx |
| /auth/magic | MagicAuth.tsx |
| /what-is-geo | WhatIsGeo.tsx |
| /how-to-rank-in-chatgpt | HowToRankInChatGPT.tsx |
| /geo-tools | GeoTools.tsx |
| /blog | Blog.tsx |
| /blog/why-startup-not-showing-chatgpt | BlogChatGPT.tsx |
| /blog/indian-startups-chatgpt-scores | BlogIndianStartupScores.tsx |
| /blog/robots-txt-blocking-ai | BlogRobotsTxt.tsx |
| /blog/what-is-geo-score | BlogWhatIsGeoScore.tsx |
| /blog/geo-vs-seo-2026 | BlogGeoVsSeo.tsx |
| /llms-txt-guide | LlmsTxtGuide.tsx |
| /ai-visibility-score | AiVisibilityScore.tsx |
| /ai-visibility-for-indian-startups | AiVisibilityIndia.tsx |
| /privacy | Privacy.tsx |
| /terms | Terms.tsx |
| /contact | Contact.tsx |
| /admin | Admin.tsx |
| /dev-login | DevLogin.tsx |

## Adding a New SSR Page - Checklist

1. Add function `<name>Html()` in the appropriate seo-pages-N.ts (or create seo-pages-4.ts)
2. Add `router.get("/path", ...)` at the bottom of the file
3. If new file: import it in `app.ts` and add `app.use(seoPagesRouterN)`
4. Add path to `artifact.toml` via the temp-file + verifyAndReplaceArtifactToml flow
5. Add sitemap entry in `app.ts` SITEMAP_XML string
6. Add this page to the table above
