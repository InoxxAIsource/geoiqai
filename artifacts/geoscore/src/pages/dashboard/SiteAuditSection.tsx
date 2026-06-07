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

interface PageRow {
  url: string;
  status: number;
  ttfbMs: number;
  sizeBytes: number;
  isHttps: boolean;
  metaTitle: string | null;
  hasH1: boolean;
  hasSchema: boolean;
  hasCanonical: boolean;
  imagesMissingAlt: number;
  internalLinkCount: number;
  issues: string[];
  category: "healthy" | "broken" | "redirect" | "issues";
}

interface CrawlAudit {
  domain: string;
  crawledCount: number;
  pageBreakdown: { healthy: number; broken: number; hasIssues: number; redirects: number };
  siteHealthScore: number;
  aiHealthScore: number;
  errorsCount: number;
  warningsCount: number;
  issues: { id: string; title: string; severity: "error" | "warning" | "notice"; pageCount: number; description: string; fixType: string }[];
  thematicScores: { crawlability: number; https: number; performance: number; internalLinking: number; markup: number; aiSearch: number };
  botAccess: { bot: string; name: string; allowed: boolean; note: string }[];
  hasRobotsTxt: boolean;
  hasLlmsTxt: boolean;
  hasSitemap: boolean;
  robotsTxt: string;
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
  "Crawling pages...",
  "Checking meta tags and headings...",
  "Analyzing internal links...",
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
    missing_title: { title: "Add a meta title", steps: ["Write a clear page title (30-60 characters).", "Include your primary keyword naturally.", "Add <title>Your Title</title> inside the <head> tag.", "Each page should have a unique title."] },
    title_too_long: { title: "Shorten your meta title", steps: ["Aim for 30-60 characters maximum.", "Put the most important words first.", "Remove filler phrases like 'Welcome to' or 'Official website of'."] },
    missing_description: { title: "Add a meta description", steps: ["Write 80-160 characters summarizing the page.", "Include a call to action and your primary keyword.", "Add <meta name='description' content='...'> in <head>.", "Make each page description unique."] },
    missing_h1: { title: "Add an H1 heading", steps: ["Every page should have exactly one H1.", "Make it descriptive and include your main keyword.", "H1 signals to AI what the page is about.", "Use H2/H3 for subheadings."] },
    missing_canonical: { title: "Add a canonical tag", steps: ["Add <link rel='canonical' href='https://yourdomain.com/this-page/' /> in <head>.", "Point to the preferred version of each URL.", "This prevents duplicate content issues."] },
    missing_alt: { title: "Fix missing image alt text", steps: ["Add alt='description of image' to every <img> tag.", "Describe what the image shows, not just the file name.", "Keep alt text under 125 characters.", "Decorative images can use alt=''."] },
    slow_server: { title: "Improve server response time", steps: ["Enable gzip/brotli compression.", "Use a CDN like Cloudflare.", "Cache static assets aggressively.", "Optimize database queries if using a dynamic backend."] },
    bot_blocked: { title: "Allow AI crawlers in robots.txt", steps: ["Open your robots.txt file.", "Remove or update any Disallow rules for GPTBot, PerplexityBot, ClaudeBot.", "Verify: https://yourdomain.com/robots.txt", "Add explicit Allow: / rules for each AI bot."] },
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
        <div style={{ padding: "0 0 12px 0" }}>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 8, lineHeight: 1.6 }}>{issue.description}</p>
          {issue.fixType && !showFix && (
            <button onClick={() => setShowFix(true)} style={{ fontSize: 12, color: P, fontWeight: 600, background: "none", border: `1px solid ${P}55`, borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>
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

function BotRow({ bot }: { bot: CrawlAudit["botAccess"][0] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "white", borderRadius: 8, border: `1px solid ${BORDER}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{bot.name}</div>
        <div style={{ fontSize: 11, color: MUTED }}>User-agent: {bot.bot}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {bot.allowed
          ? <><CheckCircle size={15} color={GREEN} /><span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>All good</span></>
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

  return (
    <div style={{ padding: "24px 0", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Site Audit</h2>
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Real crawl of up to 25 pages - detects broken pages, missing meta, slow responses, AI bot access, and more.</p>
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
        <button
          onClick={() => runAudit()}
          disabled={loading || !inputDomain.trim()}
          style={{ padding: "9px 20px", background: loading ? "#9CA3AF" : P, color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
        >
          {loading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />Crawling...</> : audit ? "Re-run audit" : "Run audit"}
        </button>
        {audit && (
          <div style={{ fontSize: 12, color: MUTED }}>
            {audit.crawledCount} pages crawled on {audit.domain}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

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

      {/* Empty state */}
      {!audit && !loading && !error && (
        <div style={{ background: "white", border: `1.5px dashed ${BORDER}`, borderRadius: 12, padding: "48px 32px", textAlign: "center", color: MUTED }}>
          <Globe size={32} color="#D1D5DB" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Enter a domain above to start the audit</div>
          <div style={{ fontSize: 13 }}>We crawl up to 25 pages and check each one for SEO issues, missing meta tags, slow response times, and AI bot access.</div>
        </div>
      )}

      {/* Results */}
      {audit && !loading && (
        <>
          {/* Top 4 cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
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
                {audit.botAccess.map(bot => (
                  <div key={bot.bot} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {bot.allowed
                      ? <CheckCircle size={13} color={GREEN} style={{ flexShrink: 0 }} />
                      : <XCircle size={13} color={RED} style={{ flexShrink: 0 }} />
                    }
                    <span style={{ fontSize: 12, color: "#111827", fontWeight: 500, flex: 1 }}>{bot.name}</span>
                    <span style={{ fontSize: 11, color: bot.allowed ? GREEN : RED, fontWeight: 600 }}>
                      {bot.allowed ? "Allowed" : "Blocked"}
                    </span>
                  </div>
                ))}
              </div>
              {!audit.hasRobotsTxt && (
                <div style={{ marginTop: 10, fontSize: 11, color: AMBER, display: "flex", gap: 4, alignItems: "center" }}>
                  <AlertTriangle size={11} />
                  No robots.txt found
                </div>
              )}
            </div>
          </div>

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
                  {audit.issues.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: GREEN, fontSize: 13 }}>
                      <CheckCircle size={16} /> No issues found - this site is well optimized.
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
                  <ThematicCard label="Performance" score={audit.thematicScores.performance} detail="TTFB under 2s" />
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
