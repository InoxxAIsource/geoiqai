import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Globe, ExternalLink, ChevronDown, ChevronRight, Info } from "lucide-react";

const P = "#4F46E5";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";
const BLUE = "#2563EB";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";

function getAiLogo(id: string): string | null {
  const s = id.toLowerCase();
  if (s.includes("gptbot") || s.includes("chatgpt") || s.includes("openai") || s.includes("gpt")) return "/logos/chatgpt.svg";
  if (s.includes("perplexity")) return "/logos/perplexity.svg";
  if (s.includes("claude") || s.includes("anthropic")) return "/logos/claude.png";
  if (s.includes("gemini") || s.includes("google")) return "/logos/gemini.svg";
  return null;
}

interface PageRow {
  url: string;
  status: number;
  ttfbMs: number;
  sizeBytes: number;
  isHttps: boolean;
  isCompressed: boolean;
  textRatio: number;
  metaTitle: string | null;
  hasH1: boolean;
  hasSchema: boolean;
  hasCanonical: boolean;
  imagesMissingAlt: number;
  internalLinkCount: number;
  issues: string[];
  category: "healthy" | "broken" | "redirect" | "issues";
}

interface CwvMetric {
  displayValue: string;
  numericValue: number;
  score: "good" | "needs-improvement" | "poor";
}

interface CoreWebVitals {
  performanceScore: number;
  lcp: CwvMetric | null;
  cls: CwvMetric | null;
  tbt: CwvMetric | null;
  fcp: CwvMetric | null;
  tti: CwvMetric | null;
  speedIndex: CwvMetric | null;
  ttfbPsi: CwvMetric | null;
  overallCategory: "FAST" | "AVERAGE" | "SLOW" | null;
  strategy: "mobile" | "desktop";
}

interface CrawlAudit {
  domain: string;
  crawledCount: number;
  pageBreakdown: { healthy: number; broken: number; hasIssues: number; redirects: number };
  siteHealthScore: number;
  aiHealthScore: number;
  errorsCount: number;
  warningsCount: number;
  issues: { id: string; title: string; severity: "error" | "warning" | "notice"; pageCount: number; description: string; fixType: string; affectedPages: string[] }[];
  thematicScores: { crawlability: number; https: number; performance: number; internalLinking: number; markup: number; aiSearch: number };
  botAccess: { bot: string; name: string; allowed: boolean; note: string }[];
  hasRobotsTxt: boolean;
  hasLlmsTxt: boolean;
  hasSitemap: boolean;
  robotsTxt: string;
  cwv: CoreWebVitals | null;
  metaTitle: string | null;
  metaTitleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  hasH1: boolean;
  h1Text: string | null;
  hasSchema: boolean;
  hasOrgSchema: boolean;
  hasFaqSchema: boolean;
  hasCanonical: boolean;
  imagesMissingAlt: number;
  ttfbMs: number;
  statusCode: number;
  isHttps: boolean;
  isJsRendered: boolean;
  gptBotAllowed: boolean;
  perplexityBotAllowed: boolean;
  claudeBotAllowed: boolean;
  googleExtendedAllowed: boolean;
  security: { hsts: boolean; clickjacking: boolean; mimeSniffing: boolean; referrerPolicy: boolean; score: number; total: number };
  techStack: { cms: string | null; framework: string | null; cdn: string | null; analytics: string[]; server: string | null };
  pages: PageRow[];
}

type Tab = "overview" | "issues" | "pages" | "bots" | "ai";

const LOADING_STEPS = [
  "Fetching sitemap...",
  "Running Google PageSpeed for Core Web Vitals...",
  "Crawling pages...",
  "Checking meta tags and headings...",
  "Checking compression and text quality...",
  "Reviewing bot access...",
  "Calculating scores...",
];

// SVG ring gauge
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(score, 100) / 100) * circ;
  const color = score >= 80 ? GREEN : score >= 60 ? AMBER : RED;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{score}%</span>
        <span style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{score >= 80 ? "Good" : score >= 60 ? "Fair" : "Poor"}</span>
      </div>
    </div>
  );
}

// Mini score circle for thematic cards
function MiniRing({ score, size = 52 }: { score: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(score, 100) / 100) * circ;
  const color = score >= 80 ? GREEN : score >= 60 ? AMBER : RED;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{score}%</span>
      </div>
    </div>
  );
}

// Stacked bar for page breakdown
function StackedBar({ breakdown, total }: { breakdown: CrawlAudit["pageBreakdown"]; total: number }) {
  if (total === 0) return <div style={{ height: 8, background: "#F3F4F6", borderRadius: 4 }} />;
  const pct = (n: number) => `${Math.max(0, Math.round(n / total * 100))}%`;
  return (
    <div style={{ height: 8, borderRadius: 4, display: "flex", overflow: "hidden", background: "#F3F4F6", marginTop: 8, marginBottom: 10 }}>
      {breakdown.healthy > 0 && <div style={{ width: pct(breakdown.healthy), background: GREEN, transition: "width 0.5s" }} />}
      {breakdown.hasIssues > 0 && <div style={{ width: pct(breakdown.hasIssues), background: AMBER, transition: "width 0.5s" }} />}
      {breakdown.broken > 0 && <div style={{ width: pct(breakdown.broken), background: RED, transition: "width 0.5s" }} />}
      {breakdown.redirects > 0 && <div style={{ width: pct(breakdown.redirects), background: BLUE, transition: "width 0.5s" }} />}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "error" | "warning" | "notice" }) {
  const cfg = {
    error:   { bg: "#FEF2F2", color: RED,   label: "Error" },
    warning: { bg: "#FFFBEB", color: AMBER,  label: "Warning" },
    notice:  { bg: "#EFF6FF", color: BLUE,   label: "Notice" },
  }[severity];
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: cfg.bg, color: cfg.color, textTransform: "uppercase", letterSpacing: 0.3, flexShrink: 0 }}>
      {cfg.label}
    </span>
  );
}

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: bg, color }}>{label}</span>;
}

// Fix guide content per fixType
function FixGuide({ fixType, onClose }: { fixType: string; onClose: () => void }) {
  const guides: Record<string, { title: string; steps: string[] }> = {
    broken_page: { title: "Fix broken pages", steps: ["Open your browser's dev tools (F12) and go to the Network tab.", "Visit the broken URL directly to see what error is returned.", "If the page was deleted, either restore it or set up a 301 redirect to the closest relevant page.", "Search for internal links pointing to the broken URL and update them.", "Check your server error logs if you see 5xx errors - usually a server config or code issue."] },
    slow_server: { title: "Improve server response time", steps: ["Enable gzip/brotli compression on your server.", "Use a CDN like Cloudflare to cache responses globally.", "Cache pages or API responses aggressively (Redis, full-page cache).", "Optimize slow database queries - look for queries without indexes.", "Upgrade your hosting plan if the server is consistently overloaded."] },
    missing_title: { title: "Add a meta title", steps: ["Write a clear page title (30-60 characters).", "Include your primary keyword naturally.", "Add <title>Your Title</title> inside the <head> tag.", "Each page should have a unique title - do not copy the same title across pages."] },
    title_too_long: { title: "Shorten your meta title", steps: ["Aim for 30-60 characters maximum.", "Put the most important words first.", "Remove filler phrases like 'Welcome to' or 'Official website of'.", "Check your CMS - most have a meta title field in the page settings."] },
    missing_description: { title: "Add a meta description", steps: ["Write 80-160 characters summarizing the page.", "Include a natural call to action and your primary keyword.", "Add <meta name='description' content='...'> inside <head>.", "Make each page description unique - duplicate descriptions confuse crawlers."] },
    missing_h1: { title: "Add an H1 heading", steps: ["Every page should have exactly one H1.", "Make it descriptive and include your main keyword.", "Your H1 does not need to match the meta title word-for-word, but should be closely related.", "Use H2/H3 for subheadings below the H1."] },
    missing_schema: { title: "Add structured data (JSON-LD)", steps: ["Add a <script type='application/ld+json'> block to your page's <head>.", "Start with Organization schema on your homepage - it defines your brand as an entity.", "Add Article schema to blog posts and FAQPage schema to FAQ sections.", "Use Google's Rich Results Test to validate your schema: search.google.com/test/rich-results.", "Schema.org has examples for every content type."] },
    missing_canonical: { title: "Add a canonical tag", steps: ["Add <link rel='canonical' href='https://yourdomain.com/this-page/' /> in <head>.", "Always point to the full URL including https:// and trailing slash.", "This tells search engines and AI crawlers which version of a URL is authoritative.", "If your CMS generates www and non-www versions, canonicalize everything to one."] },
    missing_alt: { title: "Fix missing image alt text", steps: ["Add alt='description of image' to every <img> tag.", "Describe what the image shows - be specific, not generic like 'image' or 'photo'.", "Keep alt text under 125 characters.", "Decorative images (borders, spacers) can use alt='' to signal they carry no meaning."] },
    large_page: { title: "Reduce page HTML size", steps: ["Enable gzip/brotli compression first - this alone reduces transfer size by 60-80%.", "Remove unused HTML comments and whitespace (minification).", "Check if a large inline script or CSS block can be moved to an external file.", "Remove inline base64-encoded images from HTML - serve them as separate files instead.", "Use a CDN for static assets to reduce load on the main HTML response."] },
    no_compression: { title: "Enable gzip or brotli compression", steps: ["Apache: add 'AddOutputFilterByType DEFLATE text/html text/css application/javascript' to .htaccess.", "Nginx: add 'gzip on;' and 'gzip_types text/html text/css application/javascript;' to your server block.", "Cloudflare and most CDNs compress automatically - just enable it in Speed settings.", "Verify it's working: run 'curl -I -H \"Accept-Encoding: gzip\" https://yourdomain.com' and look for 'Content-Encoding: gzip' in the response."] },
    low_text_ratio: { title: "Improve text-to-HTML ratio", steps: ["Check if content is loaded dynamically by JavaScript - if so, use server-side rendering (SSR) so crawlers see the real text.", "Remove large inline style or script blocks from the HTML - move them to external files.", "Add more actual written content to the page - thin pages with little text rank poorly with AI.", "Remove hidden/invisible HTML elements that add markup without visible content."] },
    no_internal_links: { title: "Add internal links to isolated pages", steps: ["Find pages in your sitemap that are not linked from any other page.", "Add contextual links from related content - for example, link to a product page from a blog post that mentions it.", "Include the page in your main navigation or footer.", "A page that only exists in the sitemap but is never linked internally will be crawled less frequently."] },
    bot_blocked: { title: "Allow AI crawlers in robots.txt", steps: ["Open your robots.txt file at https://yourdomain.com/robots.txt.", "Remove or update any Disallow: / rules that apply to GPTBot, PerplexityBot, ClaudeBot, or Google-Extended.", "Add explicit Allow: / rules for each AI bot you want to permit.", "Redeploy the file and wait 24-48 hours for bots to pick up the change."] },
    llmstxt: { title: "Create llms.txt", steps: ["Create a plain text file at https://yourdomain.com/llms.txt.", "Start with a short description of your company and what you do.", "List your most important pages with a one-line description each.", "Include your key products, services, and pricing information.", "Upload and deploy the file - no special format required, just clear prose AI can read.", "Check geoiqai.com/llms-txt-guide for a full example template."] },
    org_schema: { title: "Add Organization schema", steps: ["Add a <script type='application/ld+json'> block to your homepage's <head>.", "Use the Organization type with at minimum: @type, name, url, logo, and description.", "Add sameAs with links to your LinkedIn, Twitter/X, and Crunchbase pages.", "Validate it at search.google.com/test/rich-results before publishing.", "Once live, AI systems can reliably identify your brand as a real entity."] },
    faq_schema: { title: "Add FAQPage schema", steps: ["Write 5-8 real questions your customers ask, with direct answers.", "Add a <script type='application/ld+json'> block with @type: FAQPage.", "Each question becomes a Question object with @type, name (the question), and acceptedAnswer.", "Add this to your product page, pricing page, and homepage - not just a dedicated FAQ page.", "Validate at search.google.com/test/rich-results. AI citation rates typically improve within 2-4 weeks."] },
    robots_txt: { title: "Create robots.txt", steps: ["Create a plain text file at https://yourdomain.com/robots.txt.", "At minimum, add: User-agent: * followed by Allow: /", "Explicitly allow AI bots: User-agent: GPTBot, User-agent: PerplexityBot, User-agent: ClaudeBot, User-agent: Google-Extended - each followed by Allow: /", "If you have pages you want to exclude (admin, login), add Disallow: /admin/ etc.", "Add Sitemap: https://yourdomain.com/sitemap.xml at the bottom."] },
    sitemap_missing: { title: "Create sitemap.xml", steps: ["Most CMSs generate sitemaps automatically - check if yours is already at /sitemap.xml or /sitemap_index.xml.", "For static sites, use a free tool like xml-sitemaps.com to generate one.", "Include all public-facing URLs you want crawled - homepage, product pages, blog posts.", "Submit your sitemap in Google Search Console under Indexing > Sitemaps.", "Reference it in your robots.txt: Sitemap: https://yourdomain.com/sitemap.xml"] },
  };
  const g = guides[fixType];
  if (!g) return null;
  return (
    <div style={{ background: "#F8F9FC", border: `1px solid ${P}33`, borderRadius: 8, padding: "14px 16px", marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{g.title}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 13 }}>Close</button>
      </div>
      <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
        {g.steps.map((s, i) => <li key={i} style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{s}</li>)}
      </ol>
    </div>
  );
}

// A single issue row in the issues tab
function IssueRow({ issue }: { issue: CrawlAudit["issues"][0] }) {
  const [expanded, setExpanded] = useState(false);
  const [showFix, setShowFix] = useState(false);
  const [showAllPages, setShowAllPages] = useState(false);
  const pages = issue.affectedPages ?? [];
  const visiblePages = showAllPages ? pages : pages.slice(0, 5);
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", cursor: "pointer" }}
      >
        <SeverityBadge severity={issue.severity} />
        <span style={{ flex: 1, fontSize: 13, color: "#111827", fontWeight: 500 }}>{issue.title}</span>
        <span style={{ fontSize: 13, color: MUTED, fontWeight: 600, flexShrink: 0 }}>
          {issue.pageCount} {issue.pageCount === 1 ? "page" : "pages"}
        </span>
        {expanded ? <ChevronDown size={14} color={MUTED} /> : <ChevronRight size={14} color={MUTED} />}
      </div>
      {expanded && (
        <div style={{ padding: "0 0 14px 0" }}>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 10, lineHeight: 1.6 }}>{issue.description}</p>

          {issue.affectedPages.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                Affected pages
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {visiblePages.map(url => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: P, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, wordBreak: "break-all" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink size={11} style={{ flexShrink: 0 }} />
                    {url}
                  </a>
                ))}
              </div>
              {issue.affectedPages.length > 5 && (
                <button
                  onClick={e => { e.stopPropagation(); setShowAllPages(v => !v); }}
                  style={{ marginTop: 5, fontSize: 12, color: MUTED, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {showAllPages ? "Show fewer" : `+${issue.affectedPages.length - 5} more pages`}
                </button>
              )}
            </div>
          )}

          {issue.fixType && !showFix && (
            <button onClick={e => { e.stopPropagation(); setShowFix(true); }} style={{ fontSize: 12, color: P, fontWeight: 600, background: "none", border: `1px solid ${P}55`, borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>
              How to fix
            </button>
          )}
          {showFix && <FixGuide fixType={issue.fixType} onClose={() => setShowFix(false)} />}
        </div>
      )}
    </div>
  );
}

function ThematicCard({ label, score, detail }: { label: string; score: number; detail?: string }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", background: "white", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <MiniRing score={score} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{label}</div>
        {detail && <div style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</div>}
      </div>
    </div>
  );
}

const CWV_COLORS: Record<string, string> = { good: GREEN, "needs-improvement": AMBER, poor: RED };

function CwvMetricCell({ label, metric, hint }: { label: string; metric: CwvMetric | null; hint?: string }) {
  if (!metric) return null;
  const color = CWV_COLORS[metric.score] ?? MUTED;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 14px", background: "white", borderRadius: 10, border: `1px solid ${BORDER}`, minWidth: 100 }}>
      <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{metric.displayValue}</div>
      {hint && <div style={{ fontSize: 10, color: MUTED }}>{hint}</div>}
      <div style={{ marginTop: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: `${color}1A`, color }}>
          {metric.score === "good" ? "Good" : metric.score === "needs-improvement" ? "Improve" : "Poor"}
        </span>
      </div>
    </div>
  );
}

function BotRow({ bot }: { bot: CrawlAudit["botAccess"][0] }) {
  const logo = getAiLogo(bot.bot + " " + bot.name);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "white", borderRadius: 8, border: `1px solid ${BORDER}` }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${BORDER}`, background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {logo
          ? <img src={logo} alt={bot.name} style={{ width: 18, height: 18, objectFit: "contain" }} />
          : <span style={{ fontSize: 10, fontWeight: 700, color: MUTED }}>{bot.name.slice(0, 2).toUpperCase()}</span>
        }
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{bot.name}</div>
        <div style={{ fontSize: 11, color: MUTED }}>User-agent: {bot.bot}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {bot.allowed
          ? <><CheckCircle size={15} color={GREEN} /><span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>Allowed</span></>
          : <><XCircle size={15} color={RED} /><span style={{ fontSize: 12, color: RED, fontWeight: 600 }}>Blocked</span></>
        }
      </div>
      {!bot.allowed && (
        <div style={{ fontSize: 11, color: MUTED, marginLeft: 4 }}>{bot.note}</div>
      )}
    </div>
  );
}

function PageStatusDot({ category }: { category: PageRow["category"] }) {
  const colors: Record<PageRow["category"], string> = { healthy: GREEN, issues: AMBER, broken: RED, redirect: BLUE };
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[category], display: "inline-block", flexShrink: 0 }} />;
}

export function SiteAuditSection({ domain }: { domain: string }) {
  const [inputDomain, setInputDomain] = useState(domain || "");
  const [audit, setAudit] = useState<CrawlAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [step, setStep] = useState(0);
  const [expandedFix, setExpandedFix] = useState<string | null>(null);

  useEffect(() => {
    if (domain && domain !== inputDomain) setInputDomain(domain);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  async function runAudit(d?: string) {
    const target = (d ?? inputDomain).trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!target) return;
    setLoading(true);
    setAudit(null);
    setError(null);
    setStep(0);
    setTab("overview");

    // Cycle loading steps for UX
    let si = 0;
    const timer = setInterval(() => {
      si++;
      setStep(Math.min(si, LOADING_STEPS.length - 1));
    }, 4000);

    try {
      const token = getToken();
      const res = await fetch("/api/site-audit/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ domain: target }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as CrawlAudit;
      setAudit(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crawl failed");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  const total = audit ? audit.crawledCount : 0;

  const AUDIT_EXAMPLES = ["stripe.com", "notion.so", "groww.in"];

  if (!audit && !loading && !error) {
    return (
      <div style={{ margin: "-28px -32px", minHeight: "calc(100vh - 61px)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #EEF2FF 0%, #F0FDF4 55%, #FDF4FF 100%)" }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={{ position: "absolute", top: "8%", left: "12%", width: 480, height: 480, background: "rgba(99,102,241,0.09)", borderRadius: "50%", filter: "blur(90px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "8%", right: "12%", width: 340, height: 340, background: "rgba(16,185,129,0.08)", borderRadius: "50%", filter: "blur(70px)", pointerEvents: "none" }} />
        <div style={{ position: "relative", textAlign: "center", maxWidth: 700, padding: "0 24px", width: "100%" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "white", border: `1px solid ${BORDER}`, borderRadius: 20, padding: "5px 14px", fontSize: 11, fontWeight: 700, color: P, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 24, boxShadow: "0 2px 8px rgba(79,70,229,0.10)" }}>
            AI Crawler Audit
          </div>
          <h1 style={{ fontSize: "clamp(28px,5vw,50px)", fontWeight: 900, letterSpacing: "-0.03em", color: "#111827", lineHeight: 1.1, marginBottom: 18 }}>
            Audit your site for<br />AI crawlability
          </h1>
          <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, marginBottom: 40, maxWidth: 500, margin: "0 auto 40px" }}>
            Crawls up to 25 pages, checks bot access, meta tags, broken pages, Core Web Vitals, and gives you a fix-by-fix action plan.
          </p>
          <div style={{ display: "flex", maxWidth: 580, margin: "0 auto 18px", border: `2px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", background: "white", boxShadow: "0 8px 32px rgba(0,0,0,0.09)" }}>
            <input
              value={inputDomain}
              onChange={e => setInputDomain(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runAudit()}
              placeholder="Enter your domain" autoFocus
              style={{ flex: 1, padding: "16px 20px", border: "none", outline: "none", fontSize: 16, color: "#111827", background: "transparent" }}
            />
            <button
              onClick={() => runAudit()}
              disabled={!inputDomain.trim()}
              style={{ padding: "16px 32px", background: inputDomain.trim() ? P : "#A5B4FC", color: "white", border: "none", cursor: inputDomain.trim() ? "pointer" : "default", fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
              Run audit
            </button>
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>
            Try it with:{" "}
            {AUDIT_EXAMPLES.map((d, i) => (
              <span key={d}>
                {i > 0 && <span style={{ color: "#D1D5DB", margin: "0 6px" }}>|</span>}
                <button onClick={() => { setInputDomain(d); runAudit(d); }} style={{ background: "none", border: "none", color: P, cursor: "pointer", fontSize: 13, fontWeight: 500, padding: 0, textDecoration: "underline", textDecorationColor: "rgba(79,70,229,0.3)" }}>
                  {d}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 0", maxWidth: 1100 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>AI Crawler Audit</h2>
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Crawls up to 25 pages and runs Google PageSpeed for real Core Web Vitals. Checks broken pages, missing meta, compression, AI bot access, and more.</p>
      </div>

      {/* Domain input */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", flex: 1, maxWidth: 420, border: `1px solid ${BORDER}`, borderRadius: 8, background: "white", overflow: "hidden" }}>
          <Globe size={15} color={MUTED} style={{ marginLeft: 12, flexShrink: 0 }} />
          <input
            value={inputDomain}
            onChange={e => setInputDomain(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runAudit()}
            placeholder="yourdomain.com"
            style={{ flex: 1, border: "none", outline: "none", padding: "9px 12px", fontSize: 14, background: "transparent", color: "#111827" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
          <button
            onClick={() => runAudit()}
            disabled={loading || !inputDomain.trim()}
            style={{ padding: "9px 20px", background: loading ? "#9CA3AF" : P, color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            {loading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />Crawling...</> : "Re-run audit"}
          </button>
          <span style={{ fontSize: 11, color: MUTED, textAlign: "center" }}>Crawls up to 25 pages</span>
        </div>
        {audit && (
          <div style={{ fontSize: 12, color: MUTED }}>
            {audit.crawledCount} pages crawled on {audit.domain}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "40px 32px", textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: `3px solid #E5E7EB`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 20px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Crawling your site</div>
          <div style={{ fontSize: 13, color: MUTED }}>{LOADING_STEPS[step]}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }}>
            {LOADING_STEPS.map((s, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= step ? P : "#E5E7EB", transition: "background 0.3s" }} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ background: "#FEF2F2", border: `1px solid #FECACA`, borderRadius: 10, padding: "16px 20px", color: RED, fontSize: 13 }}>
          <strong>Crawl failed:</strong> {error}. Make sure the domain is reachable from the internet.
        </div>
      )}

      {/* Results */}
      {audit && !loading && (
        <>
          {/* JS-rendered site warning */}
          {audit.isJsRendered && (
            <div style={{ background: "#FFFBEB", border: `1px solid #FCD34D`, borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <AlertTriangle size={15} color={AMBER} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>JavaScript-rendered site detected</span>
                <span style={{ fontSize: 13, color: "#92400E" }}> - meta tags and content may be injected by {audit.techStack.framework ?? "a JS framework"} after page load. The raw HTML our crawler fetched may show fewer meta tags than what users actually see. Consider server-side rendering (SSR) for better AI crawlability.</span>
              </div>
            </div>
          )}

          {/* Top 4 cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: audit.cwv ? 12 : 20 }}>
            {/* Site Health */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Site Health</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ScoreRing score={audit.siteHealthScore} size={96} />
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED }}>
                  <span>Errors</span>
                  <span style={{ color: audit.errorsCount > 0 ? RED : GREEN, fontWeight: 600 }}>{audit.errorsCount}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED }}>
                  <span>Warnings</span>
                  <span style={{ color: audit.warningsCount > 0 ? AMBER : GREEN, fontWeight: 600 }}>{audit.warningsCount}</span>
                </div>
              </div>
            </div>

            {/* Crawled Pages */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Crawled Pages</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{audit.crawledCount}</div>
              <StackedBar breakdown={audit.pageBreakdown} total={total} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { label: "Healthy", value: audit.pageBreakdown.healthy, color: GREEN },
                  { label: "Have issues", value: audit.pageBreakdown.hasIssues, color: AMBER },
                  { label: "Broken", value: audit.pageBreakdown.broken, color: RED },
                  { label: "Redirects", value: audit.pageBreakdown.redirects, color: BLUE },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: row.color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ color: MUTED, flex: 1 }}>{row.label}</span>
                    <span style={{ fontWeight: 700, color: "#111827" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Search Health */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>AI Search Health</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ScoreRing score={audit.aiHealthScore} size={96} />
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED }}>
                  <span>llms.txt</span>
                  <span style={{ color: audit.hasLlmsTxt ? GREEN : AMBER, fontWeight: 600 }}>{audit.hasLlmsTxt ? "Found" : "Missing"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED }}>
                  <span>Org Schema</span>
                  <span style={{ color: audit.hasOrgSchema ? GREEN : AMBER, fontWeight: 600 }}>{audit.hasOrgSchema ? "Found" : "Missing"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED }}>
                  <span>FAQ Schema</span>
                  <span style={{ color: audit.hasFaqSchema ? GREEN : AMBER, fontWeight: 600 }}>{audit.hasFaqSchema ? "Found" : "Missing"}</span>
                </div>
              </div>
            </div>

            {/* Bot Access */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>AI Bot Access</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {audit.botAccess.map(bot => {
                  const logo = getAiLogo(bot.bot + " " + bot.name);
                  return (
                    <div key={bot.bot} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {logo
                        ? <img src={logo} alt={bot.name} style={{ width: 16, height: 16, objectFit: "contain", flexShrink: 0 }} />
                        : (bot.allowed
                            ? <CheckCircle size={13} color={GREEN} style={{ flexShrink: 0 }} />
                            : <XCircle size={13} color={RED} style={{ flexShrink: 0 }} />)
                      }
                      <span style={{ fontSize: 12, color: "#111827", fontWeight: 500, flex: 1 }}>{bot.name}</span>
                      <span style={{ fontSize: 11, color: bot.allowed ? GREEN : RED, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                        {bot.allowed
                          ? <><CheckCircle size={10} color={GREEN} /> Allowed</>
                          : <><XCircle size={10} color={RED} /> Blocked</>
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
              {!audit.hasRobotsTxt && (
                <div style={{ marginTop: 10, fontSize: 11, color: AMBER, display: "flex", gap: 4, alignItems: "center" }}>
                  <AlertTriangle size={11} />
                  No robots.txt found
                </div>
              )}
            </div>
          </div>

          {/* Core Web Vitals card (Google PageSpeed data) */}
          {!audit.cwv && (
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 16px", marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <Info size={13} color={MUTED} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: MUTED }}>Core Web Vitals not available - Google PageSpeed API quota was exceeded. Add a <code style={{ background: "#F3F4F6", padding: "1px 4px", borderRadius: 3 }}>GOOGLE_PSI_API_KEY</code> env var to get real CWV data.</span>
            </div>
          )}
          {audit.cwv && (
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Core Web Vitals</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Google PageSpeed Insights - Mobile</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ScoreRing score={audit.cwv.performanceScore} size={64} />
                  {audit.cwv.overallCategory && (
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
                      background: audit.cwv.overallCategory === "FAST" ? "#ECFDF5" : audit.cwv.overallCategory === "AVERAGE" ? "#FFFBEB" : "#FEF2F2",
                      color: audit.cwv.overallCategory === "FAST" ? GREEN : audit.cwv.overallCategory === "AVERAGE" ? AMBER : RED,
                    }}>
                      {audit.cwv.overallCategory}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <CwvMetricCell label="LCP" metric={audit.cwv.lcp} hint="Largest Contentful Paint" />
                <CwvMetricCell label="CLS" metric={audit.cwv.cls} hint="Cumulative Layout Shift" />
                <CwvMetricCell label="TBT" metric={audit.cwv.tbt} hint="Total Blocking Time" />
                <CwvMetricCell label="FCP" metric={audit.cwv.fcp} hint="First Contentful Paint" />
                <CwvMetricCell label="Speed Index" metric={audit.cwv.speedIndex} />
                <CwvMetricCell label="TTFB" metric={audit.cwv.ttfbPsi} hint="Server Response Time" />
                <CwvMetricCell label="TTI" metric={audit.cwv.tti} hint="Time to Interactive" />
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: MUTED }}>
                LCP under 2.5s, CLS under 0.1, and TBT under 200ms are considered good by Google.
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${BORDER}`, marginBottom: 20 }}>
            {([
              { id: "overview", label: "Overview" },
              { id: "issues",   label: `Issues (${audit.issues.length})` },
              { id: "pages",    label: `Pages (${audit.crawledCount})` },
              { id: "bots",     label: "Bot Access" },
              { id: "ai",       label: "AI Readiness" },
            ] as { id: Tab; label: string }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{ padding: "8px 16px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? P : MUTED, background: "none", border: "none", cursor: "pointer", borderBottom: `2px solid ${tab === t.id ? P : "transparent"}`, marginBottom: -2, transition: "color 0.15s" }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {tab === "overview" && (
            <div>
              {/* Issues summary + top issues */}
              <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, marginBottom: 24 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Errors</div>
                    <div style={{ fontSize: 34, fontWeight: 800, color: audit.errorsCount > 0 ? RED : GREEN, lineHeight: 1 }}>{audit.errorsCount}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>across {audit.crawledCount} pages</div>
                  </div>
                  <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Warnings</div>
                    <div style={{ fontSize: 34, fontWeight: 800, color: audit.warningsCount > 0 ? AMBER : GREEN, lineHeight: 1 }}>{audit.warningsCount}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>across {audit.crawledCount} pages</div>
                  </div>
                </div>

                <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Top Issues</div>
                  {audit.issues.length === 0 && audit.siteHealthScore > 85 && audit.aiHealthScore > 85 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: GREEN, fontSize: 13 }}>
                      <CheckCircle size={16} /> No issues found - this site is well optimized.
                    </div>
                  ) : audit.issues.length === 0 ? (
                    <div style={{ fontSize: 13, color: MUTED }}>
                      Check the AI Readiness tab for specific improvements.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {audit.issues.slice(0, 6).map(issue => (
                        <div key={issue.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
                          <SeverityBadge severity={issue.severity} />
                          <span style={{ flex: 1, fontSize: 13, color: "#374151" }}>{issue.title}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", flexShrink: 0 }}>{issue.pageCount} {issue.pageCount === 1 ? "page" : "pages"}</span>
                          {issue.fixType && (
                            <button
                              onClick={() => setTab("issues")}
                              style={{ fontSize: 11, color: P, background: "none", border: "none", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
                            >
                              How to fix
                            </button>
                          )}
                        </div>
                      ))}
                      {audit.issues.length > 6 && (
                        <button onClick={() => setTab("issues")} style={{ background: "none", border: "none", color: P, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", padding: "10px 0" }}>
                          View all {audit.issues.length} issues
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Thematic reports */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Thematic Reports</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                  <ThematicCard label="Crawlability" score={audit.thematicScores.crawlability} detail={`${audit.crawledCount} pages checked`} />
                  <ThematicCard label="HTTPS" score={audit.thematicScores.https} detail="Secure pages" />
                  <ThematicCard label="Performance" score={audit.thematicScores.performance} detail={audit.cwv ? `PSI score: ${audit.cwv.performanceScore}%` : "TTFB under 2s"} />
                  <ThematicCard label="Internal Linking" score={audit.thematicScores.internalLinking} detail="Pages with links" />
                  <ThematicCard label="Schema / Markup" score={audit.thematicScores.markup} detail="Structured data" />
                  <ThematicCard label="AI Search" score={audit.thematicScores.aiSearch} detail="AI optimization" />
                </div>
              </div>

              {/* Homepage snapshot */}
              <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px", marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Homepage Snapshot</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {[
                    { label: "HTTP Status", value: String(audit.statusCode), ok: audit.statusCode < 400 },
                    { label: "TTFB", value: `${audit.ttfbMs}ms`, ok: audit.ttfbMs < 1800 },
                    { label: "HTTPS", value: audit.isHttps ? "Yes" : "No", ok: audit.isHttps },
                    { label: "robots.txt", value: audit.hasRobotsTxt ? "Found" : "Missing", ok: audit.hasRobotsTxt },
                    { label: "sitemap.xml", value: audit.hasSitemap ? "Found" : "Missing", ok: audit.hasSitemap },
                    { label: "llms.txt", value: audit.hasLlmsTxt ? "Found" : "Missing", ok: audit.hasLlmsTxt },
                    { label: "Meta Title", value: audit.metaTitle ? `${audit.metaTitleLength} chars` : "Missing", ok: !!audit.metaTitle },
                    { label: "Meta Description", value: audit.metaDescription ? `${audit.metaDescriptionLength} chars` : "Missing", ok: !!audit.metaDescription },
                    { label: "H1 Heading", value: audit.hasH1 ? "Found" : "Missing", ok: audit.hasH1 },
                    { label: "Schema Markup", value: audit.hasSchema ? "Found" : "Missing", ok: audit.hasSchema },
                    { label: "Canonical Tag", value: audit.hasCanonical ? "Found" : "Missing", ok: audit.hasCanonical },
                    { label: "Images Missing Alt", value: String(audit.imagesMissingAlt), ok: audit.imagesMissingAlt === 0 },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 0", borderBottom: `1px solid #F3F4F6` }}>
                      <span style={{ color: MUTED }}>{item.label}</span>
                      <span style={{ fontWeight: 600, color: item.ok ? GREEN : AMBER }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ISSUES TAB */}
          {tab === "issues" && (
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>
                {audit.issues.length === 0 ? "No issues found across " : `${audit.issues.length} issue types found across `}
                <strong style={{ color: "#111827" }}>{audit.crawledCount} pages</strong>.
              </div>
              {audit.issues.length === 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", color: GREEN, fontSize: 14 }}>
                  <CheckCircle size={20} /> All pages look healthy - no issues detected.
                </div>
              )}
              {audit.issues.map(issue => <IssueRow key={issue.id} issue={issue} />)}
            </div>
          )}

          {/* PAGES TAB */}
          {tab === "pages" && (
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
                      {["Status", "URL", "TTFB", "Size", "Title", "H1", "Schema", "Issues"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {audit.pages.map((p, i) => (
                      <tr key={p.url} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <PageStatusDot category={p.category} />
                            <span style={{ color: p.status >= 400 ? RED : p.status >= 300 ? BLUE : GREEN, fontWeight: 700 }}>{p.status || "err"}</span>
                          </div>
                        </td>
                        <td style={{ padding: "8px 12px", maxWidth: 280 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: P, fontSize: 11 }}>{p.url.replace(/^https?:\/\//, "")}</span>
                            <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                              <ExternalLink size={10} color={MUTED} />
                            </a>
                          </div>
                          {p.metaTitle && <div style={{ fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.metaTitle}</div>}
                        </td>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap", color: p.ttfbMs > 2000 ? RED : p.ttfbMs > 1000 ? AMBER : GREEN, fontWeight: 600 }}>
                          {p.ttfbMs > 0 ? `${p.ttfbMs}ms` : "-"}
                        </td>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap", color: MUTED }}>
                          {p.sizeBytes > 0 ? `${Math.round(p.sizeBytes / 1024)}KB` : "-"}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {p.metaTitle ? <CheckCircle size={13} color={GREEN} /> : <XCircle size={13} color={AMBER} />}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {p.hasH1 ? <CheckCircle size={13} color={GREEN} /> : <XCircle size={13} color={AMBER} />}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {p.hasSchema ? <CheckCircle size={13} color={GREEN} /> : <XCircle size={13} color={AMBER} />}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ fontSize: 11, color: p.issues.length === 0 ? GREEN : AMBER, fontWeight: 600 }}>
                            {p.issues.length === 0 ? "None" : p.issues.length}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BOTS TAB */}
          {tab === "bots" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>
                  These bots crawl your site to build AI search indexes. If any are blocked in your robots.txt, they cannot cite your content.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {audit.botAccess.map(bot => <BotRow key={bot.bot} bot={bot} />)}
                </div>
              </div>
              {audit.robotsTxt && (
                <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10 }}>robots.txt contents</div>
                  <pre style={{ fontSize: 11, color: "#374151", background: BG, borderRadius: 6, padding: "12px 14px", overflowX: "auto", margin: 0, lineHeight: 1.7 }}>{audit.robotsTxt}</pre>
                </div>
              )}
              {!audit.hasRobotsTxt && (
                <div style={{ background: "#FFFBEB", border: `1px solid #FCD34D`, borderRadius: 12, padding: "16px 20px" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <AlertTriangle size={16} color={AMBER} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E", marginBottom: 4 }}>No robots.txt found</div>
                      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>Create a robots.txt at the root of your domain. Without it, some crawlers may be uncertain about access rules. Add explicit Allow rules for AI bots to ensure they can index your content.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI READINESS TAB */}
          {tab === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>AI Readiness Checklist</div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>These are the top signals AI search systems use to understand, trust, and cite your content.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { label: "llms.txt file", ok: audit.hasLlmsTxt, note: "Tells AI systems exactly what content to read and how to understand your brand.", fix: "Create /llms.txt with brand overview, key products, and main pages." },
                    { label: "Organization schema (JSON-LD)", ok: audit.hasOrgSchema, note: "Structured data that defines your brand as an entity - critical for AI to understand who you are.", fix: "Add Organization schema with name, url, logo, description, and sameAs social links." },
                    { label: "FAQ schema on key pages", ok: audit.hasFaqSchema, note: "FAQ schema makes your answers directly extractable by AI systems.", fix: "Add FAQPage schema to your product, pricing, and about pages." },
                    { label: "GPTBot access allowed", ok: audit.gptBotAllowed, note: "GPTBot crawls your site to train ChatGPT and populate ChatGPT's browsing index.", fix: "Remove Disallow: / rules for GPTBot in your robots.txt." },
                    { label: "PerplexityBot access allowed", ok: audit.perplexityBotAllowed, note: "PerplexityBot feeds Perplexity's real-time answer engine.", fix: "Add or allow PerplexityBot in your robots.txt." },
                    { label: "ClaudeBot access allowed", ok: audit.claudeBotAllowed, note: "ClaudeBot is Anthropic's crawler for Claude's web knowledge.", fix: "Remove Disallow rules for ClaudeBot in your robots.txt." },
                    { label: "Google-Extended allowed (Gemini)", ok: audit.googleExtendedAllowed, note: "Google-Extended is used for Gemini and AI Overviews training.", fix: "Add User-agent: Google-Extended / Allow: / to your robots.txt." },
                    { label: "sitemap.xml present", ok: audit.hasSitemap, note: "Sitemaps help AI crawlers discover all your pages quickly.", fix: "Create a sitemap.xml and submit it to Google Search Console." },
                    { label: "Meta title on homepage", ok: !!audit.metaTitle, note: "The page title is one of the strongest signals for AI topic understanding.", fix: "Add a <title> tag inside <head> - keep it 30-60 characters." },
                    { label: "Meta description on homepage", ok: !!audit.metaDescription, note: "AI systems often use meta descriptions verbatim in summaries.", fix: "Add <meta name='description' content='...'> to your homepage." },
                    { label: "H1 heading present", ok: audit.hasH1, note: "A clear H1 tells AI what the page is primarily about.", fix: "Add one H1 heading to every page, including your homepage." },
                    { label: "Canonical tags present", ok: audit.hasCanonical, note: "Canonicals prevent duplicate content confusion for AI crawlers.", fix: "Add <link rel='canonical' href='...'> to every page's <head>." },
                    { label: "HTTPS", ok: audit.isHttps, note: "AI citation systems heavily favor HTTPS sites as a trust signal.", fix: "Install an SSL certificate via your hosting provider or Cloudflare." },
                  ].map(item => (
                    <div key={item.label}>
                      <div
                        onClick={() => setExpandedFix(expandedFix === item.label ? null : item.label)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${BORDER}`, cursor: "pointer" }}
                      >
                        {item.ok
                          ? <CheckCircle size={16} color={GREEN} style={{ flexShrink: 0 }} />
                          : <XCircle size={16} color={item.ok ? GREEN : AMBER} style={{ flexShrink: 0 }} />
                        }
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#111827" }}>{item.label}</span>
                        <Pill label={item.ok ? "Pass" : "Fix"} bg={item.ok ? "#ECFDF5" : "#FEF3C7"} color={item.ok ? GREEN : AMBER} />
                        {!item.ok && (expandedFix === item.label ? <ChevronDown size={14} color={MUTED} /> : <ChevronRight size={14} color={MUTED} />)}
                      </div>
                      {expandedFix === item.label && (
                        <div style={{ background: "#F8F9FC", borderRadius: 6, padding: "10px 14px", marginBottom: 4 }}>
                          <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>{item.note}</div>
                          <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
                            <strong style={{ color: P }}>Fix:</strong> {item.fix}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tech stack */}
              {(audit.techStack.cms || audit.techStack.framework || audit.techStack.cdn || audit.techStack.analytics.length > 0) && (
                <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Tech Stack Detected</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {[
                      audit.techStack.cms && { label: "CMS", value: audit.techStack.cms },
                      audit.techStack.framework && { label: "Framework", value: audit.techStack.framework },
                      audit.techStack.cdn && { label: "CDN", value: audit.techStack.cdn },
                      audit.techStack.server && { label: "Server", value: audit.techStack.server },
                      ...audit.techStack.analytics.map(a => ({ label: "Analytics", value: a })),
                    ].filter(Boolean).map((item, i) => item && (
                      <div key={i} style={{ background: BG, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                        <span style={{ color: MUTED }}>{item.label}: </span>
                        <span style={{ fontWeight: 600, color: "#111827" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
