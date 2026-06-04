import { Router, type Request, type Response } from "express";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { logger } from "../lib/logger.js";

const router = Router();

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  noindex?: boolean;
}

const PAGE_META: Record<string, PageMeta> = {
  "/audit": {
    title: "Free AI Visibility Audit | GeoIQ - Check ChatGPT, Gemini, Perplexity",
    description: "Run a free AI visibility audit on any domain. See your score across ChatGPT, Gemini, Perplexity, Claude and Grok in under 60 seconds. No signup needed.",
    canonical: "https://geoiqai.com/audit",
  },
  "/pricing": {
    title: "GeoIQ Pricing | Free Audit + Plans from Rs 3,999/mo",
    description: "GeoIQ is free to start. Paid plans from Rs 3,999/month include daily score monitoring, brand tracking, competitor analysis, and the GEO Agent.",
    canonical: "https://geoiqai.com/pricing",
  },
  "/what-is-geo": {
    title: "What is GEO? Generative Engine Optimization Explained (2026) | GeoIQ",
    description: "GEO (Generative Engine Optimization) is how brands get recommended by ChatGPT, Gemini and Perplexity. Complete guide with examples, tools and a free audit.",
    canonical: "https://geoiqai.com/what-is-geo",
  },
  "/how-to-rank-in-chatgpt": {
    title: "How to Rank in ChatGPT: Complete Guide for 2026 | GeoIQ",
    description: "Step-by-step guide to getting your brand cited in ChatGPT answers. Covers robots.txt, llms.txt, citation building, entity setup, and content structure.",
    canonical: "https://geoiqai.com/how-to-rank-in-chatgpt",
  },
  "/llms-txt-guide": {
    title: "llms.txt Guide: Create Your AI Visibility File in 15 Minutes | GeoIQ",
    description: "How to create an llms.txt file for your domain - the AI equivalent of robots.txt. Tells ChatGPT, Gemini and Perplexity what your brand does. Free template.",
    canonical: "https://geoiqai.com/llms-txt-guide",
  },
  "/ai-visibility-score": {
    title: "What is an AI Visibility Score? The 0-100 Scale Explained | GeoIQ",
    description: "Your AI visibility score measures how often ChatGPT, Gemini and Perplexity mention your brand. How it is calculated and what a good score looks like.",
    canonical: "https://geoiqai.com/ai-visibility-score",
  },
  "/ai-visibility-for-indian-startups": {
    title: "AI Visibility for Indian Startups: Complete Guide 2026 | GeoIQ",
    description: "Why Indian startups score low in AI search and the specific fixes to improve. Benchmarks across ChatGPT, Gemini and Perplexity with a free audit.",
    canonical: "https://geoiqai.com/ai-visibility-for-indian-startups",
  },
  "/geo-tools": {
    title: "Best GEO Tools 2026: AI Visibility Platforms Compared | GeoIQ",
    description: "Compare the top generative engine optimization tools - GeoIQ, Profound, Semrush AI, Peec AI. Honest breakdown with pricing, features, and free tiers.",
    canonical: "https://geoiqai.com/geo-tools",
  },
  "/blog": {
    title: "Blog | GeoIQ - AI Visibility Tips, GEO Guides, Startup Stories",
    description: "Practical guides on generative engine optimization, AI search visibility, llms.txt, and how Indian startups can get cited by ChatGPT and Gemini.",
    canonical: "https://geoiqai.com/blog",
  },
  "/blog/why-startup-not-showing-chatgpt": {
    title: "Why Your Startup Is Not Showing Up in ChatGPT | GeoIQ Blog",
    description: "The most common reasons startups have zero ChatGPT visibility - and the specific fixes to get your brand cited by AI systems.",
    canonical: "https://geoiqai.com/blog/why-startup-not-showing-chatgpt",
  },
  "/blog/indian-startups-chatgpt-scores": {
    title: "Indian Startups: ChatGPT Brand Visibility Scores | GeoIQ Blog",
    description: "We audited 50 Indian SaaS startups for AI visibility. Results, benchmarks, and what the top-scoring brands do differently.",
    canonical: "https://geoiqai.com/blog/indian-startups-chatgpt-scores",
  },
  "/blog/robots-txt-blocking-ai": {
    title: "Is Your robots.txt Blocking AI Crawlers? | GeoIQ Blog",
    description: "Most Indian startups unknowingly block ChatGPT, Gemini and Perplexity bots in their robots.txt. How to check and fix it.",
    canonical: "https://geoiqai.com/blog/robots-txt-blocking-ai",
  },
  "/blog/what-is-geo-score": {
    title: "What Is a GEO Score and How Is It Calculated? | GeoIQ Blog",
    description: "A GEO score measures your brand's AI visibility across ChatGPT, Gemini and Perplexity. How it is calculated and what moves the needle.",
    canonical: "https://geoiqai.com/blog/what-is-geo-score",
  },
  "/blog/geo-vs-seo-2026": {
    title: "GEO vs SEO in 2026: Key Differences and How to Win Both | GeoIQ Blog",
    description: "How generative engine optimization differs from traditional SEO, which signals matter for AI search, and how to build a strategy that covers both.",
    canonical: "https://geoiqai.com/blog/geo-vs-seo-2026",
  },
  "/contact": {
    title: "Contact GeoIQ | AI Visibility Support",
    description: "Get in touch with the GeoIQ team. Questions about your AI visibility audit, billing, or partnerships - we respond to every message.",
    canonical: "https://geoiqai.com/contact",
  },
  "/privacy": {
    title: "Privacy Policy | GeoIQ",
    description: "GeoIQ privacy policy - how we collect, use and protect your data when you use our AI visibility audit and brand monitoring platform.",
    canonical: "https://geoiqai.com/privacy",
  },
  "/terms": {
    title: "Terms of Service | GeoIQ",
    description: "Terms of service for using GeoIQ - rules and conditions for the AI visibility audit and brand monitoring platform.",
    canonical: "https://geoiqai.com/terms",
  },
  "/roadmap": {
    title: "GeoIQ Roadmap | Upcoming Features for the AI Visibility Platform",
    description: "What is coming next to GeoIQ - planned features, community requests, and the product direction for the AI visibility platform.",
    canonical: "https://geoiqai.com/roadmap",
  },
  "/login": {
    title: "Sign In | GeoIQ AI Visibility Platform",
    description: "Sign in to your GeoIQ account to access your AI visibility dashboard, track brand scores, and monitor competitor visibility.",
    canonical: "https://geoiqai.com/login",
    noindex: true,
  },
  "/signup": {
    title: "Sign Up Free | GeoIQ AI Visibility Platform",
    description: "Create a free GeoIQ account to save audit results and track your AI visibility score over time. No credit card needed.",
    canonical: "https://geoiqai.com/signup",
    noindex: true,
  },
  "/dashboard": {
    title: "Dashboard | GeoIQ AI Visibility Platform",
    description: "Your GeoIQ dashboard - track AI visibility scores, monitor brands, and view fix recommendations.",
    canonical: "https://geoiqai.com/dashboard",
    noindex: true,
  },
};

let cachedHtml: string | null = null;

function findWorkspaceRoot(): string {
  const candidates = [
    process.cwd(),
    resolve(process.cwd(), "../.."),
    resolve(process.cwd(), ".."),
    "/home/runner/workspace",
  ];
  for (const dir of candidates) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
  }
  return process.cwd();
}

async function getIndexHtml(): Promise<string> {
  if (cachedHtml !== null) return cachedHtml;

  const isProduction = process.env["NODE_ENV"] === "production";
  const root = findWorkspaceRoot();
  const htmlPath = isProduction
    ? resolve(root, "artifacts/geoscore/dist/public/index.html")
    : resolve(root, "artifacts/geoscore/index.html");

  const html = await readFile(htmlPath, "utf-8");
  if (isProduction) {
    cachedHtml = html;
  }
  return html;
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function injectMeta(html: string, meta: PageMeta): string {
  let result = html;

  result = result.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeAttr(meta.title)}</title>`,
  );

  result = result.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${escapeAttr(meta.description)}$2`,
  );

  result = result.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    `$1${escapeAttr(meta.title)}$2`,
  );

  result = result.replace(
    /(<meta property="og:description" content=")[^"]*(")/,
    `$1${escapeAttr(meta.description)}$2`,
  );

  result = result.replace(
    /(<meta property="og:url" content=")[^"]*(")/,
    `$1${meta.canonical}$2`,
  );

  if (meta.noindex) {
    result = result.replace(
      /<meta name="robots" content="index, follow" \/>/,
      '<meta name="robots" content="noindex, nofollow" />',
    );
  }

  return result;
}

async function serveSpaMeta(req: Request, res: Response, meta: PageMeta): Promise<void> {
  try {
    const html = await getIndexHtml();
    const modified = injectMeta(html, meta);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.send(modified);
  } catch (err) {
    logger.error({ err, path: req.path }, "Failed to serve SPA with injected meta");
    res.status(500).send("Internal server error");
  }
}

for (const [pagePath, meta] of Object.entries(PAGE_META)) {
  router.get(pagePath, (req: Request, res: Response) => {
    void serveSpaMeta(req, res, meta);
  });
}

router.get(/^\/blog\/.+/, (req: Request, res: Response) => {
  const fallback: PageMeta = {
    title: "Blog | GeoIQ - AI Visibility Tips, GEO Guides",
    description: "Practical guides on generative engine optimization, AI search visibility, and how to get your brand cited by ChatGPT and Gemini.",
    canonical: `https://geoiqai.com${req.path}`,
    noindex: true,
  };
  void serveSpaMeta(req, res, fallback);
});

export default router;
