import { useState } from "react";
import { getToken } from "@/lib/auth";
import { CheckCircle, AlertTriangle, XCircle, Globe, ChevronRight, ExternalLink, Info, RefreshCw } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const RED = "#DC2626";
const AMBER = "#D97706";
const GREEN = "#059669";
const BLUE = "#2563EB";

interface RawAudit {
  ttfbMs: number;
  statusCode: number;
  isHttps: boolean;
  security: { hsts: boolean; clickjacking: boolean; mimeSniffing: boolean; referrerPolicy: boolean; score: number; total: number };
  techStack: { cms: string | null; framework: string | null; cdn: string | null; analytics: string[]; server: string | null };
  metaTitle: string | null;
  metaTitleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  hasH1: boolean;
  h1Text: string | null;
  hasSchema: boolean;
  hasOrgSchema: boolean;
  hasFaqSchema: boolean;
  hasSoftwareSchema: boolean;
  hasCanonical: boolean;
  imagesMissingAlt: number;
  hasSitemap: boolean;
  hasLlmsTxt: boolean;
  hasRobotsTxt: boolean;
  robotsTxt: string;
  botAccess: { bot: string; name: string; allowed: boolean; note: string }[];
  gptBotAllowed: boolean;
  perplexityBotAllowed: boolean;
  claudeBotAllowed: boolean;
  googleExtendedAllowed: boolean;
  siteHealthScore: number;
  aiHealthScore: number;
  pagesChecked: number;
}

interface ComputedIssue {
  id: string;
  message: string;
  detail: string;
  fixType: string;
}

interface AiCheckItem {
  label: string;
  status: "pass" | "fail" | "warning";
  note: string;
  fixType: string;
}

interface HistoryPoint {
  siteHealthScore: number;
  aiHealthScore: number;
  auditedAt: string;
}

type AuditTab = "overview" | "issues" | "bots" | "ai-readiness" | "performance";

function computeIssues(raw: RawAudit) {
  const errors: ComputedIssue[] = [];
  const warnings: ComputedIssue[] = [];
  const notices: ComputedIssue[] = [];

  if (raw.statusCode >= 400) {
    errors.push({ id: "status_error", message: `Homepage returning HTTP ${raw.statusCode}`, detail: "AI crawlers cannot index a page that returns an error.", fixType: "" });
  }
  if (!raw.isHttps) {
    errors.push({ id: "no_https", message: "Site not served over HTTPS", detail: "Trust signal missing - AI citation systems prefer HTTPS sites.", fixType: "no_https" });
  }
  const blockedBots = raw.botAccess.filter(b => !b.allowed);
  if (blockedBots.length > 0) {
    errors.push({ id: "bot_blocked", message: `${blockedBots.map(b => b.bot).join(", ")} blocked in robots.txt`, detail: "These AI crawlers cannot index your content and will not cite your pages.", fixType: "bot_blocked" });
  }

  if (!raw.metaTitle) {
    warnings.push({ id: "no_meta_title", message: "No meta title on homepage", detail: "AI systems use the page title to understand and categorize your content.", fixType: "no_meta_title" });
  } else if (raw.metaTitleLength > 60) {
    warnings.push({ id: "meta_title_long", message: `Meta title is ${raw.metaTitleLength} characters (recommended max 60)`, detail: "Long titles get truncated in search results and AI summaries.", fixType: "meta_title_long" });
  }
  if (!raw.metaDescription) {
    warnings.push({ id: "no_meta_desc", message: "No meta description on homepage", detail: "AI systems use meta descriptions to generate summaries of your page.", fixType: "no_meta_desc" });
  } else if (raw.metaDescriptionLength > 160) {
    warnings.push({ id: "meta_desc_long", message: `Meta description is ${raw.metaDescriptionLength} characters (recommended max 160)`, detail: "Long descriptions get truncated in AI-generated answers.", fixType: "meta_desc_long" });
  }
  if (!raw.hasH1) {
    warnings.push({ id: "no_h1", message: "No H1 heading on homepage", detail: "H1 tells AI systems what the page is primarily about.", fixType: "no_h1" });
  }
  if (!raw.hasSitemap) {
    warnings.push({ id: "no_sitemap", message: "sitemap.xml not found", detail: "AI crawlers use sitemaps to discover all your pages.", fixType: "no_sitemap" });
  }
  if (!raw.hasLlmsTxt) {
    warnings.push({ id: "no_llms_txt", message: "llms.txt file missing", detail: "llms.txt helps AI systems understand your site without a full crawl.", fixType: "no_llms_txt" });
  }
  if (!raw.hasOrgSchema) {
    warnings.push({ id: "no_org_schema", message: "No Organization schema on homepage", detail: "Organization JSON-LD tells AI systems who you are and what you do.", fixType: "no_org_schema" });
  }
  if (!raw.hasFaqSchema) {
    warnings.push({ id: "no_faq_schema", message: "No FAQPage schema detected", detail: "FAQPage schema is the most effective trigger for AI Overview citations.", fixType: "no_faq_schema" });
  }
  if (!raw.hasCanonical) {
    warnings.push({ id: "no_canonical", message: "No canonical tag on homepage", detail: "Canonical tags prevent duplicate content issues that confuse AI crawlers.", fixType: "no_canonical" });
  }
  if (raw.imagesMissingAlt > 0) {
    warnings.push({ id: "missing_alt", message: `${raw.imagesMissingAlt} image${raw.imagesMissingAlt === 1 ? "" : "s"} missing alt text`, detail: "Alt text helps AI understand visual content and improves accessibility.", fixType: "missing_alt" });
  }
  if (raw.ttfbMs > 3000) {
    warnings.push({ id: "slow_server", message: `Slow server response: ${raw.ttfbMs}ms (target under 2s)`, detail: "Slow pages get lower priority in AI crawler queues.", fixType: "slow_server" });
  }

  raw.botAccess.forEach(b => {
    if (b.allowed) {
      notices.push({ id: `bot_ok_${b.bot}`, message: `${b.bot}: ${b.note}`, detail: "", fixType: "" });
    }
  });
  if (raw.hasSitemap) notices.push({ id: "sitemap_ok", message: "sitemap.xml found and accessible", detail: "", fixType: "" });
  if (raw.hasLlmsTxt) notices.push({ id: "llms_ok", message: "llms.txt found and accessible", detail: "", fixType: "" });
  if (raw.hasSchema) notices.push({ id: "schema_ok", message: "Structured data (JSON-LD) detected on homepage", detail: "", fixType: "" });
  if (raw.hasCanonical) notices.push({ id: "canonical_ok", message: "Canonical tag present on homepage", detail: "", fixType: "" });
  if (raw.security.hsts) notices.push({ id: "hsts_ok", message: "HSTS header present (good for trust signals)", detail: "", fixType: "" });

  return { errors, warnings, notices };
}

function computeAiChecks(raw: RawAudit): AiCheckItem[] {
  const findNote = (bot: string) => raw.botAccess.find(b => b.bot === bot)?.note ?? "";
  return [
    { label: "GPTBot (ChatGPT)", status: raw.gptBotAllowed ? "pass" : "fail", note: findNote("GPTBot") || (raw.gptBotAllowed ? "Allowed" : "Blocked"), fixType: raw.gptBotAllowed ? "" : "bot_blocked" },
    { label: "PerplexityBot", status: raw.perplexityBotAllowed ? "pass" : "fail", note: findNote("PerplexityBot") || (raw.perplexityBotAllowed ? "Allowed" : "Blocked"), fixType: raw.perplexityBotAllowed ? "" : "bot_blocked" },
    { label: "ClaudeBot (Anthropic)", status: raw.claudeBotAllowed ? "pass" : "fail", note: findNote("ClaudeBot") || (raw.claudeBotAllowed ? "Allowed" : "Blocked"), fixType: raw.claudeBotAllowed ? "" : "bot_blocked" },
    { label: "Google-Extended (Gemini)", status: raw.googleExtendedAllowed ? "pass" : "warning", note: findNote("Google-Extended") || (raw.googleExtendedAllowed ? "Allowed" : "Not explicitly set"), fixType: "" },
    { label: "llms.txt file", status: raw.hasLlmsTxt ? "pass" : "fail", note: raw.hasLlmsTxt ? "Found at /llms.txt" : "Missing", fixType: raw.hasLlmsTxt ? "" : "no_llms_txt" },
    { label: "Organization schema", status: raw.hasOrgSchema ? "pass" : "fail", note: raw.hasOrgSchema ? "Detected on homepage" : "Missing", fixType: raw.hasOrgSchema ? "" : "no_org_schema" },
    { label: "FAQPage schema", status: raw.hasFaqSchema ? "pass" : "fail", note: raw.hasFaqSchema ? "Detected on homepage" : "Missing", fixType: raw.hasFaqSchema ? "" : "no_faq_schema" },
    { label: "Any structured data", status: raw.hasSchema ? "pass" : "fail", note: raw.hasSchema ? "JSON-LD detected" : "No schema markup found", fixType: "" },
  ];
}

function scoreColor(s: number) {
  if (s >= 70) return GREEN;
  if (s >= 45) return AMBER;
  return RED;
}

function scoreLabel(s: number) {
  if (s >= 70) return "Good";
  if (s >= 45) return "Needs work";
  return "Poor";
}

function ScoreRing({ score, label, sublabel }: { score: number; label: string; sublabel?: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r} fill="none" stroke="#E5E7EB" strokeWidth={8} />
        <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={0}
          transform="rotate(-90 45 45)" strokeLinecap="round" />
        <text x={45} y={42} textAnchor="middle" fontSize={18} fontWeight={700} fill={color}>{score}</text>
        <text x={45} y={56} textAnchor="middle" fontSize={9} fill={MUTED}>/ 100</text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{label}</div>
      {sublabel && <div style={{ fontSize: 11, color }}>({sublabel})</div>}
    </div>
  );
}

function Sparkline({ data }: { data: HistoryPoint[] }) {
  if (data.length < 2) return null;
  const W = 280; const H = 48; const pad = 6;
  const w = W - pad * 2; const h = H - pad * 2;
  const pts = (key: keyof HistoryPoint) => data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + (1 - (d[key] as number) / 100) * h;
    return `${x},${y}`;
  }).join(" ");
  const pts1 = pts("siteHealthScore");
  const pts2 = pts("aiHealthScore");
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10, color: MUTED, marginBottom: 4, display: "flex", gap: 14 }}>
        <span><span style={{ display: "inline-block", width: 10, height: 2, background: BLUE, verticalAlign: "middle", marginRight: 4 }} />Site Health</span>
        <span><span style={{ display: "inline-block", width: 10, height: 2, background: P, verticalAlign: "middle", marginRight: 4 }} />AI Health</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
        <polyline points={pts1} fill="none" stroke={BLUE} strokeWidth={1.5} strokeLinejoin="round" />
        <polyline points={pts2} fill="none" stroke={P} strokeWidth={1.5} strokeLinejoin="round" />
        {data.map((d, i) => {
          const x = pad + (i / (data.length - 1)) * w;
          return (
            <g key={i}>
              <circle cx={x} cy={pad + (1 - d.siteHealthScore / 100) * h} r={2.5} fill={BLUE} />
              <circle cx={x} cy={pad + (1 - d.aiHealthScore / 100) * h} r={2.5} fill={P} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function IssueFixGuide({ fixType, domain }: { fixType: string; domain: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const domainClean = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const domainUrl = `https://${domainClean}`;
  const encoded = encodeURIComponent(domainUrl);

  const orgSchema = `<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", "name": domainClean, "url": domainUrl, "description": "Add your company description here", "logo": `${domainUrl}/logo.png`, "sameAs": [] }, null, 2)}
</script>`;

  const faqSchema = `<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{ "@type": "Question", "name": "What does your company do?", "acceptedAnswer": { "@type": "Answer", "text": "Replace this with your real answer." } }, { "@type": "Question", "name": "How does it work?", "acceptedAnswer": { "@type": "Answer", "text": "Replace this with your real answer." } }] }, null, 2)}
</script>`;

  const robotsAllow = `User-agent: GPTBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /`;

  const flows: Record<string, { step: number; title: string; desc: string; action: "copy" | "link" | "info"; cta?: string; text?: string; url?: string }[]> = {
    no_llms_txt: [
      { step: 1, title: "Generate your llms.txt content", action: "copy", cta: "Copy llms.txt template", text: `# ${domainClean}\n\n> This is a machine-readable summary for AI systems.\n\n## About\n[Describe your product or service in 2-3 sentences. What do you do, who is it for, and what makes you different?]\n\n## Key Pages\n- Homepage: ${domainUrl}/\n- Pricing: ${domainUrl}/pricing\n- About: ${domainUrl}/about\n- Contact: ${domainUrl}/contact\n\n## Contact\ninfo@${domainClean}`, desc: "Fill in your actual product description and page URLs after copying" },
      { step: 2, title: "Upload to your domain root", action: "info", desc: `The file must be accessible at ${domainUrl}/llms.txt. In most platforms, place it in your public/static root folder.` },
      { step: 3, title: "Verify it loads", action: "link", cta: "Check llms.txt", url: `${domainUrl}/llms.txt`, desc: "Open in a browser to confirm it returns plain text" },
    ],
    no_org_schema: [
      { step: 1, title: "Copy your Organization schema", action: "copy", cta: "Copy schema code", text: orgSchema, desc: "Update the name, url, description, and logo fields with your real info" },
      { step: 2, title: "Add to your homepage head", action: "info", desc: "Paste the code just before the closing </head> tag on your homepage" },
      { step: 3, title: "Test it in Google", action: "link", cta: "Test schema", url: `https://search.google.com/test/rich-results?url=${encoded}`, desc: "Run the Rich Results Test to confirm the schema is valid" },
    ],
    no_faq_schema: [
      { step: 1, title: "Add a FAQ section to your page first", action: "info", desc: "Write 3-5 Q&A pairs about your product. These go in your page body, visible to users - not just in the schema." },
      { step: 2, title: "Copy the FAQPage schema", action: "copy", cta: "Copy schema code", text: faqSchema, desc: "Update the questions and answers to exactly match your visible FAQ content on the page" },
      { step: 3, title: "Add to homepage head and test", action: "link", cta: "Test schema", url: `https://search.google.com/test/rich-results?url=${encoded}`, desc: "Paste before </head>, then test to verify the schema is valid" },
    ],
    bot_blocked: [
      { step: 1, title: "Check your current robots.txt", action: "link", cta: "Open robots.txt", url: `${domainUrl}/robots.txt`, desc: "Find which User-agent rules are blocking AI crawlers" },
      { step: 2, title: "Add Allow rules for AI crawlers", action: "copy", cta: "Copy allow rules", text: robotsAllow, desc: "Add these lines to your robots.txt. Specific bot rules override the wildcard (*) rules." },
      { step: 3, title: "Re-run this audit", action: "info", desc: "After updating robots.txt, click 'Run audit' again to confirm all bots show as allowed" },
    ],
    no_https: [
      { step: 1, title: "Enable SSL in your hosting dashboard", action: "info", desc: "Most hosts offer free SSL via Let's Encrypt. Look for SSL/HTTPS/Certificates in your hosting control panel." },
      { step: 2, title: "Force HTTPS redirect", action: "copy", cta: "Copy .htaccess redirect", text: `RewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]`, desc: "Add to your .htaccess file (Apache) or use your host's redirect settings" },
    ],
    no_meta_title: [
      { step: 1, title: "Add a title tag to your homepage head", action: "copy", cta: "Copy example", text: `<title>Your Product Name - One-line value prop | ${domainClean}</title>`, desc: "Keep under 60 characters. Lead with your product name and main benefit." },
      { step: 2, title: "Check the result", action: "link", cta: "Preview title", url: `https://www.seoptimer.com/analyzer?url=${encoded}`, desc: "Use SEOptimer to preview how your title looks in search" },
    ],
    meta_title_long: [
      { step: 1, title: "Shorten your meta title to under 60 characters", action: "info", desc: "Remove filler words like 'the' or 'a'. Put the most important keywords first. Aim for ~55 characters to leave room." },
    ],
    no_meta_desc: [
      { step: 1, title: "Add a meta description", action: "copy", cta: "Copy example", text: `<meta name="description" content="[Product] helps [audience] [benefit] without [pain]. Used by [X] companies. Try it free.">`, desc: "Keep under 160 characters. Write like a human, not an ad." },
    ],
    meta_desc_long: [
      { step: 1, title: "Shorten your meta description to under 160 characters", action: "info", desc: "Cut any sentence that doesn't add information. The most important statement should come first." },
    ],
    no_sitemap: [
      { step: 1, title: "Generate a sitemap.xml", action: "link", cta: "Use sitemap generator", url: `https://www.xml-sitemaps.com/?url=${encoded}`, desc: "Free tool - enter your domain and it crawls all your pages" },
      { step: 2, title: "Upload to domain root", action: "info", desc: `File must be at ${domainUrl}/sitemap.xml` },
      { step: 3, title: "Submit to Google Search Console", action: "link", cta: "Open Search Console", url: "https://search.google.com/search-console", desc: "Add your sitemap URL in the Sitemaps section" },
    ],
    no_h1: [
      { step: 1, title: "Add an H1 heading to your homepage", action: "copy", cta: "Copy example", text: `<h1>Your Main Headline - What You Do for Who</h1>`, desc: "One H1 per page, describing what the page is about. Should be your main visible headline." },
    ],
    no_canonical: [
      { step: 1, title: "Add a canonical link tag", action: "copy", cta: "Copy tag", text: `<link rel="canonical" href="${domainUrl}/" />`, desc: "Paste inside <head> on your homepage. This tells crawlers which URL is the definitive version." },
    ],
    missing_alt: [
      { step: 1, title: "Add alt text to all images", action: "info", desc: "For every <img> tag, add an alt attribute describing the image. For decorative images use alt=\"\". For informative images, describe what it shows in plain language." },
    ],
    slow_server: [
      { step: 1, title: "Check what's slowing your server", action: "link", cta: "Run PageSpeed Insights", url: `https://pagespeed.web.dev/analysis?url=${encoded}`, desc: "PageSpeed will identify the specific bottlenecks" },
      { step: 2, title: "Enable a CDN", action: "info", desc: "Cloudflare's free plan can dramatically reduce server response time. Point your DNS to Cloudflare and enable it." },
    ],
  };

  const steps = flows[fixType] ?? [{ step: 1, title: "Review and fix this issue in your website editor", action: "info" as const, desc: "This issue should be addressed in your CMS or code." }];

  return (
    <div style={{ background: "#F5F6FF", border: `1px solid #E0E2FF`, borderRadius: 8, padding: "12px 14px", marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: P, marginBottom: 12 }}>Fix Guide</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {steps.map(step => (
          <div key={step.step} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: P, color: "white", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{step.step}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{step.title}</div>
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, marginBottom: step.action !== "info" ? 6 : 0 }}>{step.desc}</div>
              {step.action === "copy" && step.text && (
                <button onClick={() => copy(step.step.toString(), step.text!)}
                  style={{ fontSize: 11, padding: "3px 10px", background: copied === step.step.toString() ? "#ECFDF5" : P, color: copied === step.step.toString() ? GREEN : "white", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 600 }}>
                  {copied === step.step.toString() ? "Copied!" : (step.cta ?? "Copy")}
                </button>
              )}
              {step.action === "link" && step.url && (
                <a href={step.url} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, padding: "3px 10px", background: "white", color: P, border: `1px solid #C7D2FE`, borderRadius: 5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                  {step.cta ?? "Open"} <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IssueItem({ issue, expandedId, onToggle, domain }: { issue: ComputedIssue; expandedId: string | null; onToggle: (id: string) => void; domain: string }) {
  const open = expandedId === issue.id;
  return (
    <div style={{ border: `1px solid ${open ? "#A5B4FC" : BORDER}`, borderRadius: 8, padding: "12px 14px", background: open ? "#F5F6FF" : "white", transition: "all 0.1s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{issue.message}</div>
          {issue.detail && <div style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 1.5 }}>{issue.detail}</div>}
        </div>
        {issue.fixType && (
          <button onClick={() => onToggle(issue.id)}
            style={{ fontSize: 11, padding: "4px 10px", background: "white", color: P, border: `1px solid #C7D2FE`, borderRadius: 5, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3, flexShrink: 0, whiteSpace: "nowrap" }}>
            {open ? "Hide" : "Fix Guide"} <ChevronRight size={10} style={{ transform: open ? "rotate(90deg)" : "none" }} />
          </button>
        )}
      </div>
      {open && issue.fixType && <IssueFixGuide fixType={issue.fixType} domain={domain} />}
    </div>
  );
}

function IssueGroup({ title, color, bg, icon, issues, expandedId, onToggle, domain }: {
  title: string; color: string; bg: string; icon: React.ReactNode;
  issues: ComputedIssue[]; expandedId: string | null; onToggle: (id: string) => void; domain: string;
}) {
  if (issues.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{title}</span>
        <span style={{ fontSize: 11, background: bg, color, padding: "1px 8px", borderRadius: 10, fontWeight: 700 }}>{issues.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {issues.map(issue => <IssueItem key={issue.id} issue={issue} expandedId={expandedId} onToggle={onToggle} domain={domain} />)}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? "#111827" }}>{value}</div>
    </div>
  );
}

export function SiteAuditSection({ domain }: { domain: string }) {
  const [raw, setRaw] = useState<RawAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AuditTab>("overview");
  const [inputDomain, setInputDomain] = useState(domain);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [auditedAt, setAuditedAt] = useState<Date | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const computed = raw ? computeIssues(raw) : null;
  const aiChecks = raw ? computeAiChecks(raw) : [];
  const totalIssues = computed ? computed.errors.length + computed.warnings.length : 0;

  const toggleIssue = (id: string) => setExpandedIssue(prev => prev === id ? null : id);

  const fetchHistory = async (d: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const r = await fetch(`/api/site-audit-history?domain=${encodeURIComponent(d)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setHistory(await r.json());
    } catch { /* non-fatal */ }
  };

  const runAudit = async (d?: string) => {
    const target = (d ?? inputDomain).trim();
    if (!target) return;
    setLoading(true);
    setRaw(null);
    setAuditError(null);
    setExpandedIssue(null);
    setHistory([]);
    const token = getToken();
    try {
      const r = await fetch("/api/onpage/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ domain: target }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setRaw(json as RawAudit);
      setAuditedAt(new Date());
      fetchHistory(target);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Could not reach that domain. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  const TABS: { id: AuditTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "issues", label: `Issues${computed ? ` (${totalIssues})` : ""}` },
    { id: "bots", label: "Bot Access" },
    { id: "ai-readiness", label: "AI Readiness" },
    { id: "performance", label: "Performance" },
  ];

  const domainForGuide = raw ? inputDomain : domain;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Site Audit</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Full AI crawler health check for your site</div>

      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
            <Globe size={15} color={MUTED} />
            <input type="text" value={inputDomain} onChange={e => setInputDomain(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runAudit()}
              placeholder="yourdomain.com"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#111827", background: "transparent" }} />
          </div>
          <button onClick={() => runAudit()} disabled={loading}
            style={{ padding: "10px 22px", background: loading ? "#C7D2FE" : P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            {loading ? <><RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Running...</> : "Run audit"}
          </button>
        </div>
      </div>

      {auditError && (
        <div style={{ background: "#FEF2F2", border: `1px solid #FECACA`, borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: RED }}>
          {auditError}
        </div>
      )}

      {!raw && !loading && !auditError && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEF2FF", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Globe size={22} color={P} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Audit your site for AI crawler issues</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Checks HTTPS, meta tags, schema markup, robots.txt, llms.txt, sitemap, and AI bot access in one go.</div>
          {domain && (
            <button onClick={() => runAudit(domain)}
              style={{ padding: "10px 22px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Audit {domain}
            </button>
          )}
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Crawling {inputDomain}...
        </div>
      )}

      {raw && computed && !loading && (
        <>
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 32 }}>
              <div style={{ display: "flex", gap: 24, flex: 1 }}>
                <ScoreRing score={raw.siteHealthScore} label="Site Health" sublabel={scoreLabel(raw.siteHealthScore)} />
                <ScoreRing score={raw.aiHealthScore} label="AI Search Health" sublabel={scoreLabel(raw.aiHealthScore)} />
              </div>
              <div style={{ flex: 2 }}>
                {history.length >= 2 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Score history ({history.length} audits)</div>
                    <Sparkline data={history} />
                  </div>
                )}
                {history.length < 2 && (
                  <div style={{ fontSize: 12, color: MUTED }}>
                    <div style={{ fontWeight: 600, color: "#111827", marginBottom: 4 }}>Score history</div>
                    Run this audit regularly to track your progress over time.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="Pages Checked" value={raw.pagesChecked} />
            <StatCard label="Errors" value={computed.errors.length} color={computed.errors.length > 0 ? RED : GREEN} />
            <StatCard label="Warnings" value={computed.warnings.length} color={computed.warnings.length > 0 ? AMBER : GREEN} />
            <StatCard label="Notices" value={computed.notices.length} color={MUTED} />
          </div>

          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 20 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ padding: "8px 16px", fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? P : MUTED, background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? P : "transparent"}`, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Top issues to fix</div>
                  {computed.errors.length === 0 && computed.warnings.length === 0 && (
                    <div style={{ fontSize: 13, color: GREEN, display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle size={14} /> No critical issues found.
                    </div>
                  )}
                  {[...computed.errors, ...computed.warnings].slice(0, 5).map(issue => (
                    <div key={issue.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ flexShrink: 0, marginTop: 1 }}>
                        {computed.errors.includes(issue)
                          ? <XCircle size={14} color={RED} />
                          : <AlertTriangle size={14} color={AMBER} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "#111827", fontWeight: 500 }}>{issue.message}</div>
                        {issue.detail && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{issue.detail}</div>}
                      </div>
                    </div>
                  ))}
                  {totalIssues > 5 && (
                    <button onClick={() => setTab("issues")} style={{ fontSize: 12, color: P, background: "none", border: "none", cursor: "pointer", padding: "8px 0", fontWeight: 600 }}>
                      See all {totalIssues} issues
                    </button>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>AI bot access</div>
                  {raw.botAccess.map((b, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ color: b.allowed ? GREEN : RED, flexShrink: 0 }}>
                        {b.allowed ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      </div>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{b.bot}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{b.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "issues" && (
              <div>
                {totalIssues === 0 && computed.notices.length === 0 && (
                  <div style={{ textAlign: "center", padding: "30px 20px", color: GREEN, fontSize: 14 }}>
                    <CheckCircle size={20} style={{ marginBottom: 8, display: "block", margin: "0 auto 8px" }} />
                    No issues found. Your site looks clean.
                  </div>
                )}
                <IssueGroup title="Errors" color={RED} bg="#FEF2F2" icon={<XCircle size={14} />}
                  issues={computed.errors} expandedId={expandedIssue} onToggle={toggleIssue} domain={domainForGuide} />
                <IssueGroup title="Warnings" color={AMBER} bg="#FFFBEB" icon={<AlertTriangle size={14} />}
                  issues={computed.warnings} expandedId={expandedIssue} onToggle={toggleIssue} domain={domainForGuide} />
                <IssueGroup title="Notices" color={BLUE} bg="#EFF6FF" icon={<Info size={14} />}
                  issues={computed.notices} expandedId={expandedIssue} onToggle={toggleIssue} domain={domainForGuide} />
              </div>
            )}

            {tab === "bots" && (
              <div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>
                  These checks parse your robots.txt to determine whether each AI crawler can access your site.
                </div>
                {raw.botAccess.map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ color: b.allowed ? GREEN : RED, flexShrink: 0 }}>
                      {b.allowed ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{b.bot}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{b.name}</div>
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginRight: 12 }}>{b.note}</div>
                    <span style={{ background: b.allowed ? "#D1FAE5" : "#FEE2E2", color: b.allowed ? "#065F46" : "#991B1B", borderRadius: 12, padding: "3px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {b.allowed ? "Allowed" : "Blocked"}
                    </span>
                  </div>
                ))}
                {raw.hasRobotsTxt ? (
                  <div style={{ marginTop: 16, padding: "12px 14px", background: "#F9FAFB", borderRadius: 8, border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 6 }}>robots.txt preview</div>
                    <pre style={{ fontSize: 11, color: "#374151", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 120, overflow: "auto" }}>{raw.robotsTxt.slice(0, 800)}{raw.robotsTxt.length > 800 ? "..." : ""}</pre>
                  </div>
                ) : (
                  <div style={{ marginTop: 16, fontSize: 12, color: AMBER }}>No robots.txt found at /robots.txt</div>
                )}
              </div>
            )}

            {tab === "ai-readiness" && (
              <div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>
                  These 8 checks are the fastest way to improve your AI citation rate. Each failed check costs you visibility in ChatGPT, Perplexity, and Gemini responses.
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 4 }}>
                    {aiChecks.filter(c => c.status === "pass").length} / {aiChecks.length} checks passing
                  </div>
                  <div style={{ height: 6, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(aiChecks.filter(c => c.status === "pass").length / aiChecks.length) * 100}%`, background: P, borderRadius: 4, transition: "width 0.4s" }} />
                  </div>
                </div>
                {aiChecks.map((check, i) => {
                  const color = check.status === "pass" ? GREEN : check.status === "warning" ? AMBER : RED;
                  const icon = check.status === "pass" ? <CheckCircle size={16} color={GREEN} /> : check.status === "warning" ? <AlertTriangle size={16} color={AMBER} /> : <XCircle size={16} color={RED} />;
                  const id = `ai_check_${i}`;
                  return (
                    <div key={i} style={{ padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {icon}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{check.label}</div>
                          <div style={{ fontSize: 12, color }}>  {check.note}</div>
                        </div>
                        {check.fixType && (
                          <button onClick={() => toggleIssue(id)}
                            style={{ fontSize: 11, padding: "3px 10px", background: "white", color: P, border: `1px solid #C7D2FE`, borderRadius: 5, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                            {expandedIssue === id ? "Hide" : "Fix Guide"} <ChevronRight size={10} />
                          </button>
                        )}
                      </div>
                      {expandedIssue === id && check.fixType && (
                        <IssueFixGuide fixType={check.fixType} domain={domainForGuide} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "performance" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Server Response Time (TTFB)</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: raw.ttfbMs < 800 ? GREEN : raw.ttfbMs < 2000 ? AMBER : RED }}>{raw.ttfbMs}ms</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                      {raw.ttfbMs < 800 ? "Excellent - under 800ms" : raw.ttfbMs < 2000 ? "Good - under 2s" : "Slow - over 2s, consider a CDN"}
                    </div>
                  </div>
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>HTTPS</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: raw.isHttps ? GREEN : RED }}>{raw.isHttps ? "Yes" : "No"}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{raw.isHttps ? "SSL certificate active" : "Switch to HTTPS immediately"}</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Security Headers</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                  {[
                    { label: "HSTS (Strict-Transport-Security)", ok: raw.security.hsts },
                    { label: "Clickjacking protection (X-Frame-Options / CSP)", ok: raw.security.clickjacking },
                    { label: "MIME sniffing protection (X-Content-Type-Options)", ok: raw.security.mimeSniffing },
                    { label: "Referrer Policy", ok: raw.security.referrerPolicy },
                  ].map(h => (
                    <div key={h.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                      {h.ok ? <CheckCircle size={13} color={GREEN} /> : <XCircle size={13} color={MUTED} />}
                      <span style={{ color: h.ok ? "#111827" : MUTED }}>{h.label}</span>
                    </div>
                  ))}
                </div>

                {(raw.techStack.cms || raw.techStack.framework || raw.techStack.cdn) && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Tech Stack</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {[raw.techStack.cms, raw.techStack.framework, raw.techStack.cdn, ...(raw.techStack.analytics ?? [])].filter(Boolean).map(t => (
                        <span key={t} style={{ fontSize: 12, background: "#EEF2FF", color: P, padding: "4px 10px", borderRadius: 6, fontWeight: 500 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>External Tools</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "Full PageSpeed analysis", url: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`https://${inputDomain.replace(/^https?:\/\//, "")}`)}` },
                    { label: "Mobile-friendliness test", url: `https://search.google.com/test/mobile-friendly?url=${encodeURIComponent(`https://${inputDomain.replace(/^https?:\/\//, "")}`)}` },
                    { label: "Schema markup validator", url: `https://search.google.com/test/rich-results?url=${encodeURIComponent(`https://${inputDomain.replace(/^https?:\/\//, "")}`)}` },
                    { label: "Google Search Console", url: "https://search.google.com/search-console" },
                  ].map(link => (
                    <a key={link.label} href={link.url} target="_blank" rel="noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: P, textDecoration: "none", padding: "8px 12px", border: `1px solid #E0E2FF`, borderRadius: 7, background: "white" }}>
                      <ExternalLink size={13} />
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {auditedAt && (
            <div style={{ fontSize: 11, color: MUTED, marginTop: 10, textAlign: "right" }}>
              Audited {auditedAt.toLocaleTimeString()} - {inputDomain}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
