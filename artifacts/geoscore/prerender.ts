import fs from "node:fs";
import path from "node:path";

// Polyfill browser globals BEFORE component modules load (dynamic import below)
if (!globalThis.window) {
  const noop = () => {};
  const mockMatchMedia = () => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop });
  const mockLocalStorage = {
    getItem: (_k: string) => null,
    setItem: noop,
    removeItem: noop,
    length: 0,
    clear: noop,
    key: () => null,
  };

  const define = (key: string, value: unknown) => {
    try {
      Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    } catch {
      // already defined and non-configurable - skip
    }
  };

  const mockLocation = { href: "", origin: "https://geoiqai.com", pathname: "/", search: "", hash: "" };
  define("window", { scrollTo: noop, location: mockLocation, matchMedia: mockMatchMedia });
  define("location", mockLocation);
  define("localStorage", mockLocalStorage);
  define("matchMedia", mockMatchMedia);
  define("scrollTo", noop);
}

// Dynamic import ensures polyfills are set before components load
const { render } = await import("./src/entry-server.js");

interface RouteHeadMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  ogType: "website" | "article";
  twitterTitle?: string;
  twitterDescription?: string;
  datePublished?: string;
  noindex?: boolean;
}

const BASE = "https://geoiqai.com";
const DEFAULT_OG_IMAGE = `${BASE}/opengraph.jpg`;

const ROUTE_META: Record<string, RouteHeadMeta> = {
  "/": {
    title: "GeoIQ: Free AI Visibility Audit | See If ChatGPT Knows Your Brand",
    description: "Check if ChatGPT, Gemini, Perplexity, Claude and Grok recommend your brand. Free audit in 60 seconds. No signup. The Search Console for AI search.",
    canonical: `${BASE}/`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "website",
    twitterTitle: "GeoIQ - AI Visibility Platform",
    twitterDescription: "Check how ChatGPT, Gemini and Perplexity see your brand. Free in 60 seconds. No signup needed.",
  },
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
    datePublished: "2026-01-01",
  },
  "/how-to-rank-in-chatgpt": {
    title: "How to Rank in ChatGPT: Complete Guide for 2026 | GeoIQ",
    description: "Step-by-step guide to getting your brand cited in ChatGPT answers. Covers robots.txt, llms.txt, citation building, entity setup, and content structure.",
    canonical: `${BASE}/how-to-rank-in-chatgpt`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "How to Rank in ChatGPT: Complete 2026 Guide",
    twitterDescription: "Get your brand cited in ChatGPT. Covers robots.txt, llms.txt, citation building, and content structure.",
    datePublished: "2026-02-01",
  },
  "/geo-tools": {
    title: "Best GEO Tools 2026: AI Visibility Platforms Compared | GeoIQ",
    description: "Compare the top generative engine optimization tools - GeoIQ, Profound, Semrush AI, Peec AI. Honest breakdown with pricing, features, and free tiers.",
    canonical: `${BASE}/geo-tools`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "Best GEO Tools 2026 - AI Visibility Platforms Compared",
    twitterDescription: "Compare the top GEO tools. Honest breakdown with pricing, features, and free tiers.",
    datePublished: "2026-03-01",
  },
  "/llms-txt-guide": {
    title: "llms.txt Guide: Create Your AI Visibility File in 15 Minutes | GeoIQ",
    description: "How to create an llms.txt file for your domain - the AI equivalent of robots.txt. Tells ChatGPT, Gemini and Perplexity what your brand does. Free template.",
    canonical: `${BASE}/llms-txt-guide`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "llms.txt Guide - Create Your AI Visibility File",
    twitterDescription: "Create an llms.txt file in 15 minutes. Tells AI systems what your brand does. Free template included.",
    datePublished: "2026-04-01",
  },
  "/ai-visibility-score": {
    title: "What is an AI Visibility Score? The 0-100 Scale Explained | GeoIQ",
    description: "Your AI visibility score measures how often ChatGPT, Gemini and Perplexity mention your brand. How it is calculated and what a good score looks like.",
    canonical: `${BASE}/ai-visibility-score`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "What is an AI Visibility Score?",
    twitterDescription: "Understand how AI visibility scores work and what a good score looks like.",
    datePublished: "2026-04-15",
  },
  "/ai-visibility-for-indian-startups": {
    title: "AI Visibility for Indian Startups: Complete Guide 2026 | GeoIQ",
    description: "Why Indian startups score low in AI search and the specific fixes to improve. Benchmarks across ChatGPT, Gemini and Perplexity with a free audit.",
    canonical: `${BASE}/ai-visibility-for-indian-startups`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "AI Visibility for Indian Startups - Complete Guide",
    twitterDescription: "Why Indian startups score low in AI search and how to fix it. Free audit included.",
    datePublished: "2026-05-01",
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
    datePublished: "2026-05-01",
  },
  "/blog/indian-startups-chatgpt-scores": {
    title: "Indian Startups: ChatGPT Brand Visibility Scores | GeoIQ Blog",
    description: "We audited 50 Indian SaaS startups for AI visibility. Results, benchmarks, and what the top-scoring brands do differently.",
    canonical: `${BASE}/blog/indian-startups-chatgpt-scores`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "Indian Startups ChatGPT Scores - We Ran the Numbers",
    twitterDescription: "We audited 50 Indian SaaS startups for AI visibility. The results are surprising.",
    datePublished: "2026-05-25",
  },
  "/blog/robots-txt-blocking-ai": {
    title: "Is Your robots.txt Blocking AI Crawlers? | GeoIQ Blog",
    description: "Most Indian startups unknowingly block ChatGPT, Gemini and Perplexity bots in their robots.txt. How to check and fix it.",
    canonical: `${BASE}/blog/robots-txt-blocking-ai`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "Is Your robots.txt Blocking AI Crawlers?",
    twitterDescription: "Most startups unknowingly block AI bots in robots.txt. Here is how to check and fix it.",
    datePublished: "2026-05-25",
  },
  "/blog/what-is-geo-score": {
    title: "What Is a GEO Score and How Is It Calculated? | GeoIQ Blog",
    description: "A GEO score measures your brand's AI visibility across ChatGPT, Gemini and Perplexity. How it is calculated and what moves the needle.",
    canonical: `${BASE}/blog/what-is-geo-score`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "What Is a GEO Score and How Is It Calculated?",
    twitterDescription: "A GEO score measures AI visibility across ChatGPT, Gemini and Perplexity. Here is what moves the needle.",
    datePublished: "2026-05-25",
  },
  "/blog/geo-vs-seo-2026": {
    title: "GEO vs SEO in 2026: Key Differences and How to Win Both | GeoIQ Blog",
    description: "How generative engine optimization differs from traditional SEO, which signals matter for AI search, and how to build a strategy that covers both.",
    canonical: `${BASE}/blog/geo-vs-seo-2026`,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: "article",
    twitterTitle: "GEO vs SEO in 2026 - Where Should You Focus?",
    twitterDescription: "How GEO differs from SEO and how to build a strategy that covers both.",
    datePublished: "2026-05-25",
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
};

const STATIC_ROUTES = [
  "/",
  "/audit",
  "/what-is-geo",
  "/how-to-rank-in-chatgpt",
  "/geo-tools",
  "/llms-txt-guide",
  "/ai-visibility-score",
  "/ai-visibility-for-indian-startups",
  "/blog",
  "/blog/why-startup-not-showing-chatgpt",
  "/blog/indian-startups-chatgpt-scores",
  "/blog/robots-txt-blocking-ai",
  "/blog/what-is-geo-score",
  "/blog/geo-vs-seo-2026",
  "/pricing",
  "/roadmap",
  "/contact",
  "/privacy",
  "/terms",
];

const distDir = path.resolve("dist/public");

if (!fs.existsSync(distDir)) {
  console.error("dist/public not found - run vite build first");
  process.exit(1);
}

const templatePath = path.join(distDir, "index.html");
const rawTemplate = fs.readFileSync(templatePath, "utf-8");

const INJECTION_POINT = '<div id="root"></div>';
if (!rawTemplate.includes(INJECTION_POINT)) {
  console.error("index.html already pre-rendered - run vite build before prerender");
  process.exit(1);
}

const template = rawTemplate;

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeJson(str: string): string {
  return str.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function buildPageJsonLd(meta: RouteHeadMeta): string {
  const publisher = {
    "@type": "Organization",
    "name": "GeoIQ",
    "url": BASE,
    "logo": {
      "@type": "ImageObject",
      "url": `${BASE}/favicon-512.png`,
    },
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
      ...(meta.datePublished ? { "datePublished": meta.datePublished } : {}),
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

  return `<script type="application/ld+json">\n${escapeJson(JSON.stringify(schema, null, 2))}\n</script>`;
}

function injectHeadMeta(html: string, meta: RouteHeadMeta): string {
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

  // Replace canonical tag regardless of whether it already has an href (use [^>]* to match any existing attributes)
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

  // Inject route-specific JSON-LD before </head>
  // For the home page, the Organization schema in the template is the primary schema;
  // for all other routes, add a page-specific Article or WebPage schema.
  if (meta.canonical !== `${BASE}/`) {
    const pageJsonLd = buildPageJsonLd(meta);
    result = result.replace("</head>", `    ${pageJsonLd}\n  </head>`);
  }

  return result;
}

/** Strip Replit dev-overlay attributes injected by the Babel plugin at SSR time. */
function stripDevAttributes(html: string): string {
  return html
    .replace(/\s+data-replit-metadata="[^"]*"/g, "")
    .replace(/\s+data-component-name="[^"]*"/g, "");
}

let ok = 0;
let failed = 0;

for (const route of STATIC_ROUTES) {
  try {
    const rawAppHtml = render(route);
    const appHtml = stripDevAttributes(rawAppHtml);

    const meta = ROUTE_META[route];
    if (!meta) {
      throw new Error(`No ROUTE_META entry for ${route}`);
    }

    const withBody = template.replace(
      '<div id="root"></div>',
      `<div id="root">${appHtml}</div>`
    );

    const html = injectHeadMeta(withBody, meta);

    const segments = route === "/" ? [] : route.split("/").filter(Boolean);
    const outFile =
      route === "/"
        ? path.join(distDir, "index.html")
        : path.join(distDir, ...segments, "index.html");

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html, "utf-8");

    const size = Math.round(Buffer.byteLength(html, "utf-8") / 1024);
    console.log(`[ok] ${route.padEnd(50)} ${size}KB`);
    ok++;
  } catch (err) {
    console.error(
      `[fail] ${route}:`,
      err instanceof Error ? err.message : String(err)
    );
    failed++;
  }
}

console.log(`\nPre-render done: ${ok} success, ${failed} failed`);
if (failed > 0) process.exit(1);
