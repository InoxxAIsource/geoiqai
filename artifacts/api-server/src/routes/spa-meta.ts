import { Router, type Request, type Response } from "express";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { logger } from "../lib/logger.js";

const VITE_DEV_PORT = 22117;

const router = Router();

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  ogType: "website" | "article";
  twitterTitle?: string;
  twitterDescription?: string;
  noindex?: boolean;
  extraJsonLd?: Record<string, unknown>;
}

const BASE = "https://geoiqai.com";
const DEFAULT_OG_IMAGE = `${BASE}/opengraph.jpg`;

const PAGE_META: Record<string, PageMeta> = {
  "/audit": {
    title: "Free AI Visibility Audit | GeoIQ - Check ChatGPT, Gemini, Perplexity",
    description: "Run a free AI visibility audit on any domain. See your score across ChatGPT, Gemini, Perplexity, Claude and Grok in under 60 seconds. No signup needed.",
    canonical: `${BASE}/audit`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    twitterTitle: "Free AI Visibility Audit - GeoIQ",
    twitterDescription: "Run a free AI visibility audit. See your score across ChatGPT, Gemini and Perplexity in under 60 seconds.",
  },
  "/pricing": {
    title: "GeoIQ Pricing | Free Audit + Plans from Rs 3,999/mo",
    description: "GeoIQ is free to start. Paid plans from Rs 3,999/month include daily score monitoring, brand tracking, competitor analysis, and the GEO Agent.",
    canonical: `${BASE}/pricing`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    twitterTitle: "GeoIQ Pricing - Free Audit + Paid Plans",
    twitterDescription: "Free to start. Paid plans from Rs 3,999/month for daily AI visibility monitoring.",
  },
  "/what-is-geo": {
    title: "What is GEO? Generative Engine Optimization Explained (2026) | GeoIQ",
    description: "GEO (Generative Engine Optimization) is how brands get recommended by ChatGPT, Gemini and Perplexity. Complete guide with examples, tools and a free audit.",
    canonical: `${BASE}/what-is-geo`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "What is GEO? Generative Engine Optimization Explained",
    twitterDescription: "GEO is how brands get recommended by ChatGPT, Gemini and Perplexity. Complete guide with examples and a free audit.",
  },
  "/how-to-rank-in-chatgpt": {
    title: "How to Rank in ChatGPT: Complete Guide for 2026 | GeoIQ",
    description: "Step-by-step guide to getting your brand cited in ChatGPT answers. Covers robots.txt, llms.txt, citation building, entity setup, and content structure.",
    canonical: `${BASE}/how-to-rank-in-chatgpt`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "How to Rank in ChatGPT: Complete 2026 Guide",
    twitterDescription: "Get your brand cited in ChatGPT. Covers robots.txt, llms.txt, citation building, and content structure.",
  },
  "/llms-txt-guide": {
    title: "llms.txt Guide: Create Your AI Visibility File in 15 Minutes | GeoIQ",
    description: "How to create an llms.txt file for your domain - the AI equivalent of robots.txt. Tells ChatGPT, Gemini and Perplexity what your brand does. Free template.",
    canonical: `${BASE}/llms-txt-guide`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "llms.txt Guide - Create Your AI Visibility File",
    twitterDescription: "Create an llms.txt file in 15 minutes. Tells AI systems what your brand does. Free template included.",
  },
  "/ai-visibility-score": {
    title: "What is an AI Visibility Score? The 0-100 Scale Explained | GeoIQ",
    description: "Your AI visibility score measures how often ChatGPT, Gemini and Perplexity mention your brand. How it is calculated and what a good score looks like.",
    canonical: `${BASE}/ai-visibility-score`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "What is an AI Visibility Score?",
    twitterDescription: "Understand how AI visibility scores work and what a good score looks like.",
  },
  "/ai-visibility-for-indian-startups": {
    title: "AI Visibility for Indian Startups: Complete Guide 2026 | GeoIQ",
    description: "Why Indian startups score low in AI search and the specific fixes to improve. Benchmarks across ChatGPT, Gemini and Perplexity with a free audit.",
    canonical: `${BASE}/ai-visibility-for-indian-startups`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "AI Visibility for Indian Startups - Complete Guide",
    twitterDescription: "Why Indian startups score low in AI search and how to fix it. Free audit included.",
  },
  "/geo-tools": {
    title: "Best GEO Tools 2026: AI Visibility Platforms Compared | GeoIQ",
    description: "Compare the top generative engine optimization tools - GeoIQ, Profound, Semrush AI, Peec AI. Honest breakdown with pricing, features, and free tiers.",
    canonical: `${BASE}/geo-tools`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "Best GEO Tools 2026 - AI Visibility Platforms Compared",
    twitterDescription: "Compare the top GEO tools. Honest breakdown with pricing, features, and free tiers.",
  },
  "/blog": {
    title: "Blog | GeoIQ - AI Visibility Tips, GEO Guides, Startup Stories",
    description: "Practical guides on generative engine optimization, AI search visibility, llms.txt, and how Indian startups can get cited by ChatGPT and Gemini.",
    canonical: `${BASE}/blog`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    twitterTitle: "GeoIQ Blog - AI Visibility Tips and GEO Guides",
    twitterDescription: "Practical guides on GEO, AI search visibility, and how Indian startups can get cited by ChatGPT.",
  },
  "/blog/why-startup-not-showing-chatgpt": {
    title: "Why Your Startup Is Not Showing Up in ChatGPT | GeoIQ Blog",
    description: "The most common reasons startups have zero ChatGPT visibility - and the specific fixes to get your brand cited by AI systems.",
    canonical: `${BASE}/blog/why-startup-not-showing-chatgpt`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "Why Your Startup Is Not Showing Up in ChatGPT",
    twitterDescription: "The most common reasons startups have zero ChatGPT visibility and how to fix them.",
  },
  "/blog/indian-startups-chatgpt-scores": {
    title: "Indian Startups: ChatGPT Brand Visibility Scores | GeoIQ Blog",
    description: "We audited 50 Indian SaaS startups for AI visibility. Results, benchmarks, and what the top-scoring brands do differently.",
    canonical: `${BASE}/blog/indian-startups-chatgpt-scores`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "Indian Startups ChatGPT Scores - We Ran the Numbers",
    twitterDescription: "We audited 50 Indian SaaS startups for AI visibility. The results are surprising.",
  },
  "/blog/robots-txt-blocking-ai": {
    title: "Is Your robots.txt Blocking AI Crawlers? | GeoIQ Blog",
    description: "Most Indian startups unknowingly block ChatGPT, Gemini and Perplexity bots in their robots.txt. How to check and fix it.",
    canonical: `${BASE}/blog/robots-txt-blocking-ai`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "Is Your robots.txt Blocking AI Crawlers?",
    twitterDescription: "Most startups unknowingly block AI bots in robots.txt. Here is how to check and fix it.",
  },
  "/blog/what-is-geo-score": {
    title: "What Is a GEO Score and How Is It Calculated? | GeoIQ Blog",
    description: "A GEO score measures your brand's AI visibility across ChatGPT, Gemini and Perplexity. How it is calculated and what moves the needle.",
    canonical: `${BASE}/blog/what-is-geo-score`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "What Is a GEO Score and How Is It Calculated?",
    twitterDescription: "A GEO score measures AI visibility across ChatGPT, Gemini and Perplexity. Here is what moves the needle.",
  },
  "/blog/geo-vs-seo-2026": {
    title: "GEO vs SEO in 2026: Key Differences and How to Win Both | GeoIQ Blog",
    description: "How generative engine optimization differs from traditional SEO, which signals matter for AI search, and how to build a strategy that covers both.",
    canonical: `${BASE}/blog/geo-vs-seo-2026`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "GEO vs SEO in 2026 - Where Should You Focus?",
    twitterDescription: "How GEO differs from SEO and how to build a strategy that covers both.",
  },
  "/contact": {
    title: "Contact GeoIQ | AI Visibility Support",
    description: "Get in touch with the GeoIQ team. Questions about your AI visibility audit, billing, or partnerships - we respond to every message.",
    canonical: `${BASE}/contact`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    twitterTitle: "Contact GeoIQ",
    twitterDescription: "Get in touch with the GeoIQ team for support, billing, or partnership questions.",
  },
  "/privacy": {
    title: "Privacy Policy | GeoIQ",
    description: "GeoIQ privacy policy - how we collect, use and protect your data when you use our AI visibility audit and brand monitoring platform.",
    canonical: `${BASE}/privacy`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    noindex: true,
    twitterTitle: "GeoIQ Privacy Policy",
    twitterDescription: "How GeoIQ collects, uses and protects your data.",
  },
  "/terms": {
    title: "Terms of Service | GeoIQ",
    description: "Terms of service for using GeoIQ - rules and conditions for the AI visibility audit and brand monitoring platform.",
    canonical: `${BASE}/terms`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    noindex: true,
    twitterTitle: "GeoIQ Terms of Service",
    twitterDescription: "Rules and conditions for using the GeoIQ AI visibility platform.",
  },
  "/roadmap": {
    title: "GeoIQ Roadmap | Upcoming Features for the AI Visibility Platform",
    description: "What is coming next to GeoIQ - planned features, community requests, and the product direction for the AI visibility platform.",
    canonical: `${BASE}/roadmap`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    twitterTitle: "GeoIQ Roadmap - What's Coming Next",
    twitterDescription: "Planned features, community requests, and product direction for the GeoIQ AI visibility platform.",
  },
  "/login": {
    title: "Sign In | GeoIQ AI Visibility Platform",
    description: "Sign in to your GeoIQ account to access your AI visibility dashboard, track brand scores, and monitor competitor visibility.",
    canonical: `${BASE}/login`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    noindex: true,
  },
  "/signup": {
    title: "Sign Up Free | GeoIQ AI Visibility Platform",
    description: "Create a free GeoIQ account to save audit results and track your AI visibility score over time. No credit card needed.",
    canonical: `${BASE}/signup`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    noindex: true,
  },
  "/dashboard": {
    title: "Dashboard | GeoIQ AI Visibility Platform",
    description: "Your GeoIQ dashboard - track AI visibility scores, monitor brands, and view fix recommendations.",
    canonical: `${BASE}/dashboard`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    noindex: true,
  },
  "/faq": {
    title: "FAQ - Frequently Asked Questions | GeoIQ",
    description: "Answers to common questions about GeoIQ - how AI visibility scores work, how to improve them, what the audit checks, and pricing details.",
    canonical: `${BASE}/faq`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    twitterTitle: "GeoIQ FAQ - AI Visibility Questions Answered",
    twitterDescription: "How AI visibility scores work, what the audit checks, how to improve your score, and pricing details.",
    extraJsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is GeoIQ?",
          "acceptedAnswer": { "@type": "Answer", "text": "GeoIQ is an AI visibility platform that shows you how your brand appears in ChatGPT, Gemini, Perplexity, Claude and Grok. Think of it like Google Search Console, but for AI search engines. You enter your domain, and within 60 seconds you get a score from 0-100, a breakdown by engine, and a list of fixes ranked by impact." },
        },
        {
          "@type": "Question",
          "name": "What is an AI visibility score?",
          "acceptedAnswer": { "@type": "Answer", "text": "Your AI visibility score (GEO IQ Score) is a number from 0 to 100 that measures how well AI systems know, understand, and recommend your brand. It combines two things: how often and accurately AI engines mention you (AI Memory, worth 50 points), and how well your site is technically set up for AI crawlers (Technical GEO, worth 50 points). A score above 70 is strong; below 40 means you have real gaps to fix." },
        },
        {
          "@type": "Question",
          "name": "Which AI engines does GeoIQ check?",
          "acceptedAnswer": { "@type": "Answer", "text": "GeoIQ checks five AI systems: ChatGPT (OpenAI), Gemini (Google), Perplexity, Claude (Anthropic), and Grok (xAI). Your overall GEO IQ Score is primarily based on the three main engines - ChatGPT, Gemini, and Perplexity - since those drive the most traffic and referrals today." },
        },
        {
          "@type": "Question",
          "name": "What is GEO (Generative Engine Optimization)?",
          "acceptedAnswer": { "@type": "Answer", "text": "GEO stands for Generative Engine Optimization. It is the practice of optimizing your brand, content, and website so that AI systems like ChatGPT and Gemini understand who you are, what you do, and when to recommend you. It is similar to SEO, but instead of optimizing for Google's ranking algorithm, you are optimizing for how large language models represent your brand in their responses." },
        },
        {
          "@type": "Question",
          "name": "How do I run a free audit?",
          "acceptedAnswer": { "@type": "Answer", "text": "Go to the home page, type your domain name (e.g. yourstartup.com) into the input box, and click Check my AI visibility. The audit runs in about 60 seconds and you get a full report - no signup required." },
        },
        {
          "@type": "Question",
          "name": "How long does the audit take?",
          "acceptedAnswer": { "@type": "Answer", "text": "Usually 30-60 seconds for the first audit. If your domain was audited recently by someone else, cached results may load instantly. Running a fresh scan from your dashboard takes about 30 seconds." },
        },
        {
          "@type": "Question",
          "name": "My score seems low. Is that normal?",
          "acceptedAnswer": { "@type": "Answer", "text": "Most brands score between 30 and 60 on their first audit. A score under 40 is common for early-stage startups because AI models primarily learn from large datasets of web content, and smaller brands have less representation in that training data. The good news is that technical fixes (llms.txt, structured data, schema markup) can improve your score fairly quickly." },
        },
        {
          "@type": "Question",
          "name": "What is a good GEO IQ Score?",
          "acceptedAnswer": { "@type": "Answer", "text": "As a rough guide: 70 and above is strong, 50-70 is moderate and improving, 30-50 is weak and needs work, and below 30 means AI engines barely know you exist. Top SaaS tools typically score 80+. If you are a well-funded startup with solid press coverage, aim for 60+ as a baseline." },
        },
        {
          "@type": "Question",
          "name": "How do I improve my AI visibility score?",
          "acceptedAnswer": { "@type": "Answer", "text": "The most impactful fixes are: (1) create an llms.txt file that describes your brand, products, use cases, and competitors clearly; (2) add structured data (JSON-LD schema) to your key pages; (3) get your brand mentioned on high-authority sites that AI models use as training sources; (4) make sure robots.txt is not blocking AI crawlers like GPTBot and ClaudeBot; (5) write clear, factual content about what your product does and who it is for. GeoIQ's dashboard gives you a ranked fix list specific to your domain." },
        },
        {
          "@type": "Question",
          "name": "What is an llms.txt file and do I need one?",
          "acceptedAnswer": { "@type": "Answer", "text": "llms.txt is a plain text file you place at yourdomain.com/llms.txt that tells AI crawlers exactly what your brand is, what it does, and how it should be described. Think of it as a README for AI systems. It is not an official standard yet, but major crawlers like GPTBot and ClaudeBot are starting to read it. It is one of the fastest things you can do to improve your AI visibility." },
        },
        {
          "@type": "Question",
          "name": "Is the audit really free?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. The public audit tool at geoiqai.com/audit is completely free, no signup required. You get a full score breakdown, per-engine results, technical audit, and top fix recommendations. The free audit does not require a credit card." },
        },
        {
          "@type": "Question",
          "name": "What does the paid plan include?",
          "acceptedAnswer": { "@type": "Answer", "text": "Paid plans (Starter and Agency) add: continuous monitoring of multiple brands with daily score tracking, score history charts, a full fix action list with step-by-step instructions, competitor comparison, keyword-level AI visibility, prompt templates, and access to the GEO Agent for automated analysis. See the pricing page for the full breakdown." },
        },
        {
          "@type": "Question",
          "name": "Do you support INR pricing?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. All prices are in Indian Rupees (INR). Payments are processed securely through Razorpay. Starter plan is Rs 3,999/month and Agency plan is Rs 11,999/month." },
        },
        {
          "@type": "Question",
          "name": "Can I cancel anytime?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. There are no contracts or lock-in periods. You can cancel your subscription from your dashboard at any time. You keep access until the end of your current billing period." },
        },
        {
          "@type": "Question",
          "name": "Do you offer refunds?",
          "acceptedAnswer": { "@type": "Answer", "text": "We offer refunds within 7 days of purchase if you are not satisfied. Reach out to hello@geoiqai.com with your registered email and we will process the refund." },
        },
        {
          "@type": "Question",
          "name": "Is GeoIQ affiliated with OpenAI, Google or Anthropic?",
          "acceptedAnswer": { "@type": "Answer", "text": "No. GeoIQ is an independent product. We are not affiliated with, endorsed by, or sponsored by OpenAI, Google, Anthropic, or any of the AI companies whose engines we track." },
        },
      ],
    },
  },
};

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

// Cache for prerendered HTML files per route path.
// In production each public route has its own prerendered index.html.
const htmlCache = new Map<string, string>();

async function getRouteHtml(routePath: string): Promise<string> {
  const isProduction = process.env["NODE_ENV"] === "production";

  if (isProduction) {
    const cached = htmlCache.get(routePath);
    if (cached !== undefined) return cached;
  }

  if (!isProduction) {
    // In development, fetch directly from the Vite dev server so that its
    // injected scripts (/@vite/client, /@react-refresh preamble) are included.
    // Without them the React Fast Refresh runtime throws "can't detect preamble"
    // and the page renders blank.
    try {
      const res = await fetch(`http://localhost:${VITE_DEV_PORT}/`);
      if (res.ok) return await res.text();
    } catch {
      // Vite not ready yet - fall through to reading from disk
    }
  }

  const root = findWorkspaceRoot();

  let htmlPath: string;
  if (isProduction) {
    // Each prerendered route lives at dist/public/<route>/index.html.
    // The root route lives at dist/public/index.html.
    const segments = routePath === "/" ? [] : routePath.split("/").filter(Boolean);
    htmlPath =
      segments.length === 0
        ? resolve(root, "artifacts/geoscore/dist/public/index.html")
        : resolve(root, "artifacts/geoscore/dist/public", ...segments, "index.html");

    // Fall back to the root index.html if the route-specific file does not
    // exist (e.g. login, signup, dashboard which are not prerendered).
    if (!existsSync(htmlPath)) {
      htmlPath = resolve(root, "artifacts/geoscore/dist/public/index.html");
    }
  } else {
    htmlPath = resolve(root, "artifacts/geoscore/index.html");
  }

  const html = await readFile(htmlPath, "utf-8");
  if (isProduction) {
    htmlCache.set(routePath, html);
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
    `$1${escapeAttr(meta.canonical)}$2`,
  );

  result = result.replace(
    /(<meta property="og:type" content=")[^"]*(")/,
    `$1${meta.ogType}$2`,
  );

  result = result.replace(
    /(<meta property="og:image" content=")[^"]*(")/,
    `$1${escapeAttr(meta.ogImage)}$2`,
  );

  const twitterTitle = meta.twitterTitle ?? meta.title;
  const twitterDescription = meta.twitterDescription ?? meta.description;

  result = result.replace(
    /(<meta name="twitter:title" content=")[^"]*(")/,
    `$1${escapeAttr(twitterTitle)}$2`,
  );

  result = result.replace(
    /(<meta name="twitter:description" content=")[^"]*(")/,
    `$1${escapeAttr(twitterDescription)}$2`,
  );

  result = result.replace(
    /(<meta name="twitter:image" content=")[^"]*(")/,
    `$1${escapeAttr(meta.ogImage)}$2`,
  );

  // Set canonical href statically so crawlers that do not run JS see the right value.
  // Use [^>]* to match even when an existing href already contains slashes.
  result = result.replace(
    /<link rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`,
  );

  if (meta.noindex) {
    result = result.replace(
      /<meta name="robots" content="index, follow" \/>/,
      '<meta name="robots" content="noindex, nofollow" />',
    );
  }

  // Inject route-specific JSON-LD before </head>.
  // The template already carries an Organization schema for the homepage.
  // Every other route also gets a page-specific Article or WebPage schema.
  const BASE_URL = "https://geoiqai.com";
  if (meta.canonical !== BASE_URL && meta.canonical !== `${BASE_URL}/`) {
    const publisher = {
      "@type": "Organization",
      "name": "GeoIQ",
      "url": BASE_URL,
      "logo": { "@type": "ImageObject", "url": `${BASE_URL}/favicon-512.png` },
    };
    let schema: Record<string, unknown>;
    if (meta.ogType === "article") {
      schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": meta.title,
        "description": meta.description,
        "url": meta.canonical,
        "image": meta.ogImage,
        "author": publisher,
        "publisher": publisher,
      };
    } else {
      schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": meta.title,
        "description": meta.description,
        "url": meta.canonical,
        "publisher": publisher,
      };
    }
    const jsonLdTag = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")}\n</script>`;
    result = result.replace("</head>", `    ${jsonLdTag}\n  </head>`);
  }

  if (meta.extraJsonLd) {
    const extraTag = `<script type="application/ld+json">\n${JSON.stringify(meta.extraJsonLd, null, 2).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")}\n</script>`;
    result = result.replace("</head>", `    ${extraTag}\n  </head>`);
  }

  return result;
}

async function serveSpaMeta(req: Request, res: Response, meta: PageMeta): Promise<void> {
  try {
    const html = await getRouteHtml(req.path);
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
    if (Object.keys(req.query).length > 0 && !meta.noindex) {
      res.redirect(301, meta.canonical);
      return;
    }
    void serveSpaMeta(req, res, meta);
  });
}

router.get(/^\/blog\/.+/, (req: Request, res: Response) => {
  const fallback: PageMeta = {
    title: "Blog | GeoIQ - AI Visibility Tips, GEO Guides",
    description: "Practical guides on generative engine optimization, AI search visibility, and how to get your brand cited by ChatGPT and Gemini.",
    canonical: `${BASE}${req.path}`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    noindex: true,
  };
  void serveSpaMeta(req, res, fallback);
});

export default router;
