import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/auth";
import { Globe, RefreshCw, AlertCircle, FileDown, ChevronRight, Copy, Check, ChevronDown } from "lucide-react";
import { UpgradeModal } from "@/components/UpgradeModal";
import { CacheIndicator } from "@/components/CacheIndicator";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

const AI_FAVICONS: Record<string, string> = {
  chatgpt: "https://www.google.com/s2/favicons?domain=chat.openai.com&sz=32",
  gemini: "https://www.google.com/s2/favicons?domain=gemini.google.com&sz=32",
  perplexity: "https://www.google.com/s2/favicons?domain=perplexity.ai&sz=32",
  claude: "https://www.google.com/s2/favicons?domain=claude.ai&sz=32",
  grok: "https://www.google.com/s2/favicons?domain=grok.com&sz=32",
  google_ai: "https://www.google.com/s2/favicons?domain=ai.google&sz=32",
};

function getAiLogo(key: string): string {
  const s = key.toLowerCase();
  if (s.includes("chat_gpt") || s.includes("chatgpt") || s.includes("openai")) return "/logos/chatgpt.svg";
  if (s.includes("perplexity")) return "/logos/perplexity.svg";
  if (s.includes("claude") || s.includes("anthropic")) return "/logos/claude.png";
  if (s.includes("gemini") || s.includes("ai_overview")) return "/logos/gemini.svg";
  if (s.includes("google")) return AI_FAVICONS.google_ai ?? "/logos/gemini.svg";
  if (s.includes("grok") || s.includes("xai")) return "/logos/grok.png";
  return AI_FAVICONS[s] ?? `https://www.google.com/s2/favicons?domain=${s}.com&sz=32`;
}

function AiLogoImg({ k, size = 16 }: { k: string; size?: number }) {
  const src = getAiLogo(k);
  return (
    <img
      src={src}
      alt={k}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, borderRadius: 4 }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

function AiLogo({ k, size = 16, fallbackColor }: { k: string; size?: number; fallbackColor?: string }) {
  const src = getAiLogo(k);
  return (
    <img
      src={src}
      alt={k}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, borderRadius: 4 }}
      onError={(e) => {
        const el = e.target as HTMLImageElement;
        el.style.display = "none";
        if (fallbackColor) {
          const span = document.createElement("span");
          span.style.cssText = `width:${size}px;height:${size}px;border-radius:4px;background:${fallbackColor};flex-shrink:0;display:inline-block`;
          el.parentNode?.insertBefore(span, el);
        }
      }}
    />
  );
}

/* ---- API response types ---- */
interface PlatformRow { key: string; displayName: string; color: string; mentions: number; ai_search_volume: number; pct: number }
interface CountryRow { code: number; name: string; mentions: number; pct: number }
interface CitedSource { domain: string; mentions: number; ai_search_volume: number }
interface CitedPage { url: string; mentions: number; ai_search_volume: number }
interface Topic { question: string; platform: string; model_name: string; ai_search_volume: number; location_code: number }

interface GoogleAioData {
  citedInAio: boolean;
  aioExists: boolean;
  aioText: string | null;
  keywordChecked: string | null;
}

interface SiteAuditSummary {
  siteHealthScore: number;
  aiHealthScore: number;
  hasLlmsTxt: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  hasOrgSchema: boolean;
  hasFaqSchema: boolean;
  hasH1: boolean;
  isHttps: boolean;
  issues: Array<{
    id: string;
    title: string;
    severity: "error" | "warning" | "notice";
    description: string;
    fixType: string;
  }>;
}

interface VisibilityData {
  domain: string;
  brandName: string;
  score: number;
  mentions: number;
  aiSearchVolume: number;
  citations: number;
  citedPagesCount: number;
  hasData: boolean;
  platforms: PlatformRow[];
  platformsNote?: string;
  countries: CountryRow[];
  citedSources: CitedSource[];
  citedPages: CitedPage[];
  performingTopics: Topic[];
  performingTopicsCount: number;
  topicOpportunities: Topic[];
  topicOpportunitiesCount: number;
  dateFrom: string;
  from_cache?: boolean;
  cached_at?: string;
  expires_at?: string;
  dateTo: string;
  cached: boolean;
  googleAio?: GoogleAioData | null;
}

/* ---- helpers ---- */
function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function scoreLabel(s: number) {
  if (s >= 81) return { label: "Great", color: "#16A34A" };
  if (s >= 61) return { label: "Good", color: "#15803D" };
  if (s >= 41) return { label: "Medium", color: "#D97706" };
  if (s > 0)   return { label: "Low", color: "#DC2626" };
  return { label: "No Data", color: "#9CA3AF" };
}

function scoreDesc(s: number) {
  if (s >= 81) return "Frequently mentioned and often preferred by LLMs.";
  if (s >= 61) return "Cited regularly in AI-generated answers.";
  if (s >= 41) return "Appears occasionally in LLM outputs.";
  if (s > 0)   return "Rarely appears in AI answers.";
  return "No LLM mention data found for this domain yet.";
}

function modelDisplayName(model: string): string {
  const map: Record<string, string> = {
    google_ai_overview: "AI Overview",
    google_ai_mode: "AI Mode",
    chat_gpt: "ChatGPT",
    gpt_4: "GPT-4",
    gpt_4o: "GPT-4o",
    gemini: "Gemini",
    perplexity: "Perplexity",
    claude: "Claude",
    copilot: "Copilot",
  };
  return map[model] ?? model.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const COUNTRY_FLAGS: Record<number, string> = {
  2840: "🇺🇸", 2826: "🇬🇧", 2356: "🇮🇳", 2124: "🇨🇦", 2036: "🇦🇺",
  2276: "🇩🇪", 2250: "🇫🇷", 2724: "🇪🇸", 2380: "🇮🇹", 2392: "🇯🇵",
  2076: "🇧🇷", 2484: "🇲🇽", 2566: "🇳🇬", 2682: "🇸🇦", 2702: "🇸🇬",
  2458: "🇲🇾", 2360: "🇮🇩", 2764: "🇹🇭", 2616: "🇵🇱", 2528: "🇳🇱",
  2586: "🇵🇰", 2158: "🇹🇼", 2410: "🇰🇷", 2752: "🇸🇪", 2578: "🇳🇴",
  2208: "🇩🇰", 2246: "🇫🇮", 2804: "🇺🇦", 2792: "🇹🇷", 2818: "🇪🇬",
  2704: "🇻🇳", 2710: "🇿🇦", 2104: "🇲🇲", 2050: "🇧🇩", 2144: "🇱🇰",
  2524: "🇳🇵", 2608: "🇵🇭", 2012: "🇩🇿", 2756: "🇨🇭", 2788: "🇹🇳",
};

/* ===== Small score ring for Site Health / AI Readiness ===== */
function SmallScoreRing({ score, label, sub, loading }: { score: number; label: string; sub: string; loading?: boolean }) {
  const size = 90;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(score, 100) / 100) * circ;
  const color = score >= 70 ? "#059669" : score >= 50 ? "#D97706" : "#DC2626";
  const grade = score >= 70 ? "Good" : score >= 50 ? "Fair" : "Poor";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
          {!loading && score > 0 && (
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
              strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          )}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {loading ? (
            <div style={{ width: 16, height: 16, border: "2px solid #E5E7EB", borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          ) : (
            <>
              <span style={{ fontSize: 20, fontWeight: 800, color: score > 0 ? color : MUTED, lineHeight: 1 }}>{score}</span>
              <span style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>{grade}</span>
            </>
          )}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

/* ===== Score Gauge ===== */
function ScoreGauge({ score }: { score: number }) {
  const r = 78;
  const cx = 110, cy = 115;
  const total = Math.PI * r;
  const filled = total * (score / 100);
  const { label, color } = scoreLabel(score);
  const angle = Math.PI * (score / 100);
  const dotX = cx - r * Math.cos(angle);
  const dotY = cy - r * Math.sin(angle);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox="0 0 220 135" style={{ width: 210, height: 128, overflow: "visible" }}>
        <defs>
          <linearGradient id="gg2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor={P} />
          </linearGradient>
        </defs>
        <path d={`M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke="#E5E7EB" strokeWidth="16" strokeLinecap="round" />
        {score > 0 && (
          <path d={`M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke="url(#gg2)" strokeWidth="16" strokeLinecap="round"
            strokeDasharray={`${filled} ${total}`} />
        )}
        {score > 0 && score < 100 && (
          <circle cx={dotX} cy={dotY} r={9} fill="white" stroke={color} strokeWidth="3" />
        )}
        <text x={cx} y={cy - 24} textAnchor="middle" fontSize="44" fontWeight="700" fill="#111827" fontFamily="inherit">{score}</text>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fill={MUTED}>/100</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="14" fontWeight="600" fill={color}>{label}</text>
      </svg>
      <div style={{ maxWidth: 200, textAlign: "center", fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 4 }}>
        {scoreDesc(score)}
      </div>
    </div>
  );
}

/* ===== Semrush-style landing hero ===== */
const EXAMPLE_DOMAINS = ["notion.so", "groww.in", "razorpay.com"];

function VisibilityLandingHero({ onDomain, lastDomain }: { onDomain: (d: string) => void; lastDomain?: string }) {
  const [input, setInput] = useState("");
  const go = () => {
    const d = input.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]!;
    if (d) onDomain(d);
  };
  const recent = lastDomain && !EXAMPLE_DOMAINS.includes(lastDomain)
    ? [lastDomain, ...EXAMPLE_DOMAINS.slice(0, 2)]
    : EXAMPLE_DOMAINS;
  return (
    <div style={{ minHeight: "calc(100vh - 61px)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #EEF2FF 0%, #F0FDF4 55%, #FDF4FF 100%)" }}>
      <div style={{ position: "absolute", top: "8%", left: "12%", width: 500, height: 500, background: "rgba(99,102,241,0.10)", borderRadius: "50%", filter: "blur(90px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "8%", right: "12%", width: 360, height: 360, background: "rgba(16,185,129,0.08)", borderRadius: "50%", filter: "blur(70px)", pointerEvents: "none" }} />
      <div style={{ position: "relative", textAlign: "center", maxWidth: 700, padding: "0 24px", width: "100%" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "white", border: `1px solid ${BORDER}`, borderRadius: 20, padding: "5px 14px", fontSize: 11, fontWeight: 700, color: P, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 24, boxShadow: "0 2px 8px rgba(79,70,229,0.10)" }}>
          AI Visibility
        </div>
        <h1 style={{ fontSize: "clamp(30px,5vw,54px)", fontWeight: 900, letterSpacing: "-0.03em", color: "#111827", lineHeight: 1.1, marginBottom: 18 }}>
          Track your brand across<br />every AI system
        </h1>
        <p style={{ fontSize: 17, color: MUTED, lineHeight: 1.6, marginBottom: 40, maxWidth: 500, margin: "0 auto 40px" }}>
          See how ChatGPT, Gemini, Perplexity, Claude, Grok and Google AI Overview mention your brand - and get exact fixes to improve your score.
        </p>
        <div style={{ display: "flex", maxWidth: 580, margin: "0 auto 18px", border: `2px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", background: "white", boxShadow: "0 8px 32px rgba(0,0,0,0.09)" }}>
          <input
            type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
            placeholder="Enter your domain" autoFocus
            style={{ flex: 1, padding: "16px 20px", border: "none", outline: "none", fontSize: 16, color: "#111827", background: "transparent" }}
          />
          <button onClick={go} disabled={!input.trim()}
            style={{ padding: "16px 32px", background: input.trim() ? P : "#A5B4FC", color: "white", border: "none", cursor: input.trim() ? "pointer" : "default", fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
            Get started
          </button>
        </div>
        <div style={{ fontSize: 13, color: "#9CA3AF" }}>
          Last checked:{" "}
          {recent.map((d, i) => (
            <span key={d}>
              {i > 0 && <span style={{ color: "#D1D5DB", margin: "0 6px" }}>|</span>}
              <button onClick={() => onDomain(d)} style={{ background: "none", border: "none", color: P, cursor: "pointer", fontSize: 13, fontWeight: 500, padding: 0, textDecoration: "underline", textDecorationColor: "rgba(79,70,229,0.3)" }}>
                {d}
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== Domain change modal (shown when domain already set and user clicks "Change domain") ===== */
function DomainModal({ onDomain, onClose, lastDomain }: { onDomain: (d: string) => void; onClose: () => void; lastDomain?: string }) {
  const [input, setInput] = useState("");
  const go = () => {
    const d = input.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (d) onDomain(d);
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,15,15,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 18, padding: "44px 48px 40px", maxWidth: 520, width: "90%", boxShadow: "0 24px 80px rgba(0,0,0,0.22)", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${P}, #8B5CF6, #10B981)`, borderRadius: "18px 18px 0 0" }} />
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, fontSize: 18, lineHeight: 1 }} aria-label="Close">
          &#x2715;
        </button>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.25, marginBottom: 10, color: "#0F0F0F", letterSpacing: "-0.03em" }}>Change domain</h2>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, margin: 0 }}>Enter a domain to check its AI visibility across ChatGPT, Gemini, Perplexity, and AI Overview.</p>
        </div>
        <div style={{ display: "flex", border: `1.5px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 10px rgba(79,70,229,0.08)", marginBottom: 14 }}>
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
            placeholder="yourdomain.com" autoFocus
            style={{ flex: 1, padding: "14px 18px", border: "none", outline: "none", fontSize: 15, color: "#111827", background: "transparent" }} />
          <button onClick={go} disabled={!input.trim()}
            style={{ padding: "14px 26px", background: input.trim() ? P : "#A5B4FC", color: "white", border: "none", cursor: input.trim() ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 600 }}>
            Check
          </button>
        </div>
        {lastDomain && (
          <div style={{ textAlign: "center", fontSize: 12, color: MUTED }}>
            Last checked: <button onClick={() => onDomain(lastDomain)} style={{ background: "none", border: "none", color: P, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0 }}>{lastDomain}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Empty state for domains with no DataForSEO data ===== */
function NoDataState({ domain }: { domain: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", maxWidth: 560, margin: "0 auto" }}>
      <AlertCircle size={40} color="#D1D5DB" style={{ margin: "0 auto 16px" }} />
      <div style={{ fontSize: 18, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
        {domain} is not visible in AI yet
      </div>
      <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, marginBottom: 24 }}>
        GeoIQ scans ChatGPT, Gemini, Perplexity, Claude, Grok and Google AI Overview. This domain
        has not appeared as a cited source yet.
        This is exactly the problem GeoIQ helps you fix.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <a href={`/audit?url=${encodeURIComponent(domain)}`} style={{ display: "inline-block", padding: "10px 24px", background: P, color: "white", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          Run free audit
        </a>
      </div>
    </div>
  );
}

/* ===== KPI card ===== */
function KpiCard({ label, value, color, sub, showZero }: { label: string; value: number; color: string; sub?: string; showZero?: boolean }) {
  const display = (value > 0 || showZero) ? fmt(value) : "--";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: value > 0 ? "#111827" : MUTED, lineHeight: 1 }}>{display}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{sub}</div>}
    </div>
  );
}

/* ===== Tab bar ===== */
function TabBar({ tabs, active, onSelect }: { tabs: { id: string; label: string; count?: number }[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: `1.5px solid ${BORDER}` }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          style={{ padding: "8px 16px", fontSize: 13, fontWeight: active === t.id ? 600 : 400, color: active === t.id ? P : MUTED, background: "none", border: "none", borderBottom: `2px solid ${active === t.id ? P : "transparent"}`, cursor: "pointer", marginBottom: -1.5, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
          {t.label}
          {t.count != null && t.count > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, background: active === t.id ? "#EEF2FF" : "#F3F4F6", color: active === t.id ? P : MUTED, borderRadius: 10, padding: "1px 6px" }}>
              {fmt(t.count)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ===== Issue maps & fix steps ===== */
const ISSUE_AI_SYSTEMS: Record<string, string[]> = {
  llmstxt: ["ChatGPT", "Claude", "Grok"],
  org_schema: ["ChatGPT", "Gemini", "Perplexity", "Claude", "Grok", "Google AI Overview"],
  faq_schema: ["Perplexity", "Google AI Overview"],
  robots_txt: ["ChatGPT", "Gemini", "Perplexity", "Claude", "Grok", "Google AI Overview"],
  sitemap: ["Gemini", "Google AI Overview"],
  missing_https: ["ChatGPT", "Google AI Overview"],
  missing_h1: ["Gemini", "Google AI Overview"],
  missing_schema: ["ChatGPT", "Perplexity", "Gemini"],
  missing_canonical: ["All crawlers"],
  missing_title: ["Gemini", "Google AI Overview"],
  slow_server: ["ChatGPT", "Perplexity"],
  broken_page: ["All crawlers"],
};

const ISSUE_SCORE_IMPACT: Record<string, number> = {
  org_schema: 10,
  faq_schema: 12,
  llmstxt: 8,
  robots_txt: 5,
  sitemap: 4,
  missing_https: 6,
  missing_h1: 3,
  missing_schema: 8,
  missing_canonical: 2,
  missing_title: 3,
  slow_server: 4,
  broken_page: 3,
};

const FIX_STEPS: Record<string, string[]> = {
  llmstxt: [
    "Create a file named llms.txt at the root of your domain (e.g. yoursite.com/llms.txt).",
    "Include your brand name, a short description, key topics, and your main URL.",
    "Keep it under 500 words - plain text, no HTML.",
    "Upload it to your server alongside robots.txt and sitemap.xml.",
    "Use the Generate button below to get a draft based on your homepage content.",
  ],
  org_schema: [
    "Add a <script type='application/ld+json'> block to your homepage <head>.",
    "Use the Organization schema type with fields: name, url, logo, description.",
    "Optionally add sameAs with your LinkedIn, Crunchbase, and Twitter profiles.",
    "Validate with Google's Rich Results Test (search.google.com/test/rich-results).",
    "Use the Generate button below to get a schema block pre-filled for your domain.",
  ],
  faq_schema: [
    "Add FAQPage JSON-LD schema to any page with question-and-answer content.",
    "Each FAQ entry needs a 'name' (the question) and 'acceptedAnswer' with a 'text' field.",
    "Put the <script> block inside <head> or at the bottom of <body>.",
    "Validate with Google's Rich Results Test.",
    "Use the Generate button to get a ready-to-use FAQ schema block.",
  ],
  robots_txt: [
    "Create a robots.txt file at the root of your domain (e.g. yoursite.com/robots.txt).",
    "Add explicit Allow rules for GPTBot, ClaudeBot, PerplexityBot, and Google-Extended.",
    "Always include 'Sitemap: https://yourdomain.com/sitemap.xml' at the bottom.",
    "Test that it's accessible by visiting the URL in a browser.",
    "Use the Generate button to get an AI-crawler-friendly robots.txt file.",
  ],
  sitemap: [
    "Create an XML sitemap listing all public pages on your site.",
    "Submit it to Google Search Console under Sitemaps.",
    "Add a reference at the bottom of robots.txt: 'Sitemap: https://yourdomain.com/sitemap.xml'.",
    "If you use WordPress, Yoast or Rank Math generates this automatically.",
    "For custom sites, tools like xml-sitemaps.com can crawl and create it.",
  ],
  missing_https: [
    "Get an SSL certificate - most hosts provide free Let's Encrypt certificates.",
    "Set up automatic HTTPS redirects from http:// to https://.",
    "Update your internal links and canonical tags to use https://.",
    "Check your CMS settings - WordPress, Webflow, and Shopify handle this in settings.",
  ],
  missing_h1: [
    "Every page should have exactly one H1 heading.",
    "The H1 should describe what the page is about - include your primary keyword.",
    "Do not use the H1 for decorative text or the site logo alt text.",
    "In most CMS platforms, the page title field sets the H1 automatically.",
  ],
  missing_schema: [
    "Add JSON-LD structured data to your page's <head> section.",
    "Start with Organization schema on your homepage.",
    "Add Article schema to blog posts and FAQPage to FAQ sections.",
    "Use schema.org for reference on every schema type.",
  ],
  missing_canonical: [
    "Add <link rel='canonical' href='https://yourdomain.com/this-page/'> in every page's <head>.",
    "Always use the full URL including https:// and trailing slash.",
    "If you have www and non-www versions, pick one and canonicalize all pages to it.",
    "Check your CMS - most platforms have canonical fields built in.",
  ],
};

type GenerateType = "llmstxt" | "org-schema" | "faq-schema" | "robots";

const GENERATE_ACTIONS: Record<string, { endpoint: string; label: string; type: GenerateType }> = {
  llmstxt: { endpoint: "/api/generate/llmstxt", label: "Generate llms.txt", type: "llmstxt" },
  org_schema: { endpoint: "/api/generate/org-schema", label: "Generate org schema", type: "org-schema" },
  faq_schema: { endpoint: "/api/generate/faq-schema", label: "Generate FAQ schema", type: "faq-schema" },
  robots_txt: { endpoint: "/api/generate/robots", label: "Generate robots.txt", type: "robots" },
};

/* ===== Issue Panel ===== */
function IssuePanel({
  issueKey,
  title,
  severity,
  description,
  domain,
  expanded,
  onToggle,
}: {
  issueKey: string;
  title: string;
  severity: "error" | "warning" | "notice";
  description: string;
  domain: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const aiSystems = ISSUE_AI_SYSTEMS[issueKey] ?? [];
  const impact = ISSUE_SCORE_IMPACT[issueKey] ?? 0;
  const steps = FIX_STEPS[issueKey] ?? [];
  const action = GENERATE_ACTIONS[issueKey];

  const sevColor = severity === "error" ? "#DC2626" : severity === "warning" ? "#D97706" : "#6B7280";
  const sevBg = severity === "error" ? "#FEF2F2" : severity === "warning" ? "#FFFBEB" : "#F9FAFB";
  const sevBorderColor = severity === "error" ? "#EF4444" : severity === "warning" ? "#F59E0B" : "#3B82F6";
  const sevLabel = severity === "error" ? "Error" : severity === "warning" ? "Warning" : "Notice";

  const handleGenerate = async () => {
    if (!action) return;
    setGenerating(true);
    setGenError(null);
    try {
      const resp = await fetch(action.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await resp.json() as { content?: string; code?: string; error?: string };
      if (!resp.ok || data.error) { setGenError(data.error ?? "Generation failed"); return; }
      setGenerated(data.content ?? data.code ?? "");
    } catch {
      setGenError("Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generated) return;
    navigator.clipboard.writeText(generated).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ background: "white", border: `1px solid ${BORDER}`, borderLeft: `4px solid ${sevBorderColor}`, borderRadius: "0 10px 10px 0", overflow: "hidden", marginBottom: 8, transition: "box-shadow 0.15s, transform 0.15s" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: sevBg, color: sevColor, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>
          {sevLabel}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#111827" }}>{title}</span>
        {impact > 0 && (
          <span style={{ fontSize: 11, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 5, padding: "2px 8px", flexShrink: 0 }}>
            +{impact} pts if fixed
          </span>
        )}
        {aiSystems.length > 0 && (
          <span style={{ fontSize: 11, color: MUTED, flexShrink: 0, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Affects: {aiSystems.slice(0, 3).join(", ")}{aiSystems.length > 3 ? ` +${aiSystems.length - 3}` : ""}
          </span>
        )}
        <ChevronDown size={14} color={MUTED} style={{ flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {expanded && (
        <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "14px 0 14px" }}>{description}</p>

          {aiSystems.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>AI systems affected</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {aiSystems.map(s => (
                  <span key={s} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#EEF2FF", color: P, fontWeight: 500 }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {steps.length > 0 && (
            <div style={{ marginBottom: action ? 16 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>How to fix</div>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {steps.map((step, i) => (
                  <li key={i} style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 4 }}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {action && (
            <div style={{ marginTop: 16 }}>
              {!generated && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ padding: "8px 16px", background: generating ? "#EEF2FF" : P, color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
                >
                  {generating && <div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                  {generating ? "Generating..." : action.label}
                </button>
              )}
              {genError && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 8 }}>{genError}</div>}
              {generated && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#10B981" }}>Generated - ready to copy</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "white", fontSize: 11, color: copied ? "#10B981" : MUTED, cursor: "pointer" }}>
                        {copied ? <Check size={11} /> : <Copy size={11} />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                      <button onClick={() => setGenerated(null)} style={{ padding: "5px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "white", fontSize: 11, color: MUTED, cursor: "pointer" }}>
                        Regenerate
                      </button>
                    </div>
                  </div>
                  <pre style={{ background: "#F9FAFB", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", fontSize: 11, lineHeight: 1.6, color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 340, overflowY: "auto", margin: 0, fontFamily: "'Courier New', monospace" }}>
                    {generated}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function buildAiIssues(audit: SiteAuditSummary): Array<{ key: string; title: string; severity: "error" | "warning" | "notice"; description: string }> {
  const items: Array<{ key: string; title: string; severity: "error" | "warning" | "notice"; description: string }> = [];

  if (!audit.hasOrgSchema) {
    items.push({
      key: "org_schema",
      title: "Organization schema is missing",
      severity: "error",
      description: "No Organization JSON-LD schema detected on your homepage. This schema tells AI systems who you are as a company - without it, ChatGPT, Gemini, and others have to guess your brand identity from context alone.",
    });
  }
  if (!audit.hasLlmsTxt) {
    items.push({
      key: "llmstxt",
      title: "llms.txt file not found",
      severity: "error",
      description: "llms.txt is a plain-text file (like robots.txt) that describes your brand to AI language models. ChatGPT and Claude specifically check for it when learning about companies.",
    });
  }
  if (!audit.hasFaqSchema) {
    items.push({
      key: "faq_schema",
      title: "FAQ structured data is missing",
      severity: "warning",
      description: "FAQPage schema on your key pages boosts the chance of your content appearing in Perplexity answers and Google AI Overviews, since both scan for structured Q&A content.",
    });
  }
  if (!audit.hasSitemap) {
    items.push({
      key: "sitemap",
      title: "XML sitemap not found",
      severity: "warning",
      description: "A sitemap.xml tells Googlebot and AI crawlers which pages exist on your site. Without one, AI systems may miss large parts of your content.",
    });
  }
  if (!audit.hasRobotsTxt) {
    items.push({
      key: "robots_txt",
      title: "robots.txt file not found",
      severity: "warning",
      description: "robots.txt lets you explicitly allow AI crawlers. Without it, some AI systems treat missing rules conservatively - and you lose the ability to specifically invite GPTBot, ClaudeBot, and PerplexityBot.",
    });
  }
  if (!audit.isHttps) {
    items.push({
      key: "missing_https",
      title: "Site is not served over HTTPS",
      severity: "error",
      description: "Serving over plain HTTP is a trust signal problem. AI systems and search engines deprioritise non-HTTPS sites, and modern browsers warn visitors before they land.",
    });
  }
  if (!audit.hasH1) {
    items.push({
      key: "missing_h1",
      title: "Homepage is missing an H1 heading",
      severity: "warning",
      description: "The H1 is one of the strongest on-page signals for both search engines and AI crawlers. Without it, AI systems struggle to determine what your homepage is primarily about.",
    });
  }

  return items;
}

/* ===== Main ===== */
export function VisibilityOverview({
  domain,
  onDomainChange,
}: {
  domain: string;
  geo?: string;
  period?: string;
  onDomainChange?: (d: string) => void;
}) {
  const [data, setData] = useState<VisibilityData | null>(null);
  const [loading, setLoading] = useState(!!domain);
  const [rescanning, setRescanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<{ message: string; current_plan: string } | null>(null);
  const [rescanBlocked, setRescanBlocked] = useState<{ message: string; hours_left: number } | null>(null);
  const [showModal, setShowModal] = useState(!domain);
  const [lastDomain, setLastDomain] = useState<string | undefined>(domain || undefined);
  const [topicsTab, setTopicsTab] = useState<"performing" | "opportunities" | "pages" | "sources">("performing");
  const [pagesPage, setPagesPage] = useState(0);
  const [sourcesPage, setSourcesPage] = useState(0);
  const [siteAudit, setSiteAudit] = useState<SiteAuditSummary | null>(null);
  const [siteAuditLoading, setSiteAuditLoading] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const fetchSiteAudit = useCallback((d: string) => {
    setSiteAuditLoading(true);
    fetch("/api/onpage/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: d }),
    })
      .then(r => r.json())
      .then((raw: SiteAuditSummary & { error?: string }) => {
        if (!raw.error) setSiteAudit(raw);
      })
      .catch(() => { /* silent - site audit is supplemental */ })
      .finally(() => setSiteAuditLoading(false));
  }, []);

  const fetchData = useCallback((d: string, force = false) => {
    if (force) setRescanning(true); else setLoading(true);
    setError(null);
    setRescanBlocked(null);
    const token = getToken();
    const url = `/api/dataforseo/visibility-overview?domain=${encodeURIComponent(d)}${force ? "&force=true" : ""}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then((raw: VisibilityData & { error?: string; message?: string; current_plan?: string; hours_left?: number }) => {
        if (raw.error === "domain_limit_reached") {
          setUpgradeError({ message: raw.message ?? "Upgrade required.", current_plan: raw.current_plan ?? "free" });
        } else if (raw.error === "rescan_too_soon") {
          setRescanBlocked({ message: raw.message ?? "Rescan not available yet.", hours_left: raw.hours_left ?? 0 });
        } else if (raw.error) {
          setError(raw.error);
        } else {
          setData(raw);
        }
      })
      .catch(() => setError("Failed to load visibility data. Please try again."))
      .finally(() => { setLoading(false); setRescanning(false); });
  }, []);

  useEffect(() => {
    if (!domain) { setShowModal(true); return; }
    setLastDomain(domain);
    fetchData(domain, false);
    fetchSiteAudit(domain);
  }, [domain, fetchData, fetchSiteAudit]);

  const handleDomain = (d: string) => { setShowModal(false); if (onDomainChange) onDomainChange(d); };

  const d = data;

  if (!domain) {
    return (
      <div style={{ margin: "-28px -32px" }}>
        <VisibilityLandingHero onDomain={handleDomain} lastDomain={lastDomain} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      {showModal && domain && <DomainModal onDomain={handleDomain} onClose={() => setShowModal(false)} lastDomain={lastDomain !== domain ? lastDomain : undefined} />}

      {upgradeError && (
        <UpgradeModal
          onClose={() => setUpgradeError(null)}
          feature="AI Presence"
          currentPlan={upgradeError.current_plan}
          context="llm_mention"
        />
      )}

      {/* breadcrumb */}
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 14, display: "flex", gap: 6, alignItems: "center" }}>
        <span>Dashboard</span>
        <ChevronRight size={12} color="#D1D5DB" />
        <span>AI Visibility</span>
        <ChevronRight size={12} color="#D1D5DB" />
        <span style={{ color: "#374151", fontWeight: 500 }}>AI Visibility Report</span>
      </div>

      {rescanBlocked && (
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "#92400E" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={14} />
            <span>{rescanBlocked.message}</span>
          </div>
          <button onClick={() => setRescanBlocked(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#92400E", fontWeight: 600, fontSize: 12 }}>Dismiss</button>
        </div>
      )}

      {/* gradient header */}
      <div style={{ background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)", borderRadius: 16, padding: "24px 32px", color: "white", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.75, marginBottom: 4 }}>AI Visibility Report</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{domain}</div>
          {d?.from_cache && d.cached_at && (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Last scanned: {new Date(d.cached_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {domain && (
            <button onClick={() => fetchData(domain, true)} disabled={rescanning || loading}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 16px", background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, fontSize: 13, color: "white", cursor: rescanning ? "not-allowed" : "pointer", backdropFilter: "blur(4px)", opacity: rescanning ? 0.7 : 1 }}>
              <RefreshCw size={12} style={{ animation: rescanning ? "spin 0.8s linear infinite" : "none" }} />
              {rescanning ? "Scanning..." : "Rescan"}
            </button>
          )}
          {domain && (
            <button onClick={() => setShowModal(true)}
              style={{ padding: "8px 16px", background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, fontSize: 13, color: "white", cursor: "pointer", backdropFilter: "blur(4px)" }}>
              Change domain
            </button>
          )}
          <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 16px", background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, fontSize: 13, color: "white", cursor: "pointer", backdropFilter: "blur(4px)" }}>
            <Globe size={12} /> Worldwide
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 16px", background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, fontSize: 13, color: "white", cursor: "pointer", backdropFilter: "blur(4px)" }}>
            <FileDown size={12} /> Export
          </button>
        </div>
      </div>

      {/* cache indicator below header */}
      {d?.from_cache && d.cached_at && d.expires_at && (
        <div style={{ marginBottom: 12 }}>
          <CacheIndicator
            cachedAt={d.cached_at}
            expiresAt={d.expires_at}
            onForceRefresh={domain ? () => fetchData(domain, true) : undefined}
            refreshing={rescanning}
          />
        </div>
      )}

      {/* loading */}
      {(loading || rescanning) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, gap: 14, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 22, height: 22, border: "2.5px solid #E5E7EB", borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          {rescanning ? `Refreshing data for ${domain}...` : `Fetching AI visibility data for ${domain}...`}
        </div>
      )}

      {/* error */}
      {!loading && !rescanning && error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <AlertCircle size={18} color="#DC2626" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#991B1B", marginBottom: 4 }}>Error loading data</div>
            <div style={{ fontSize: 12, color: "#B91C1C" }}>{error}</div>
          </div>
        </div>
      )}

      {/* main content */}
      {!loading && !error && domain && d && (
        <>
          {/* 3-score header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* AI Presence */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "relative", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#6366F1", borderRadius: "12px 12px 0 0" }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 5 }}>
                AI Presence
                <span title="GEO score based on AI mention frequency and citation rate across ChatGPT, Gemini, Perplexity, and more. Scale: 0-100." style={{ cursor: "help", color: "#9CA3AF", fontSize: 13, lineHeight: 1 }}>&#9432;</span>
              </div>
              <ScoreGauge score={d.score} />
              {d.score === 0 && d.hasData === false && (
                <div style={{ fontSize: 11, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "4px 12px", textAlign: "center" }}>
                  Not visible in AI yet
                </div>
              )}
            </div>

            {/* Site Health */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "relative", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#10B981", borderRadius: "12px 12px 0 0" }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 5 }}>
                Site Health
                <span title="Technical site score including HTTPS, performance, metadata, and structured data." style={{ cursor: "help", color: "#9CA3AF", fontSize: 13, lineHeight: 1 }}>&#9432;</span>
              </div>
              <SmallScoreRing
                score={siteAudit?.siteHealthScore ?? 0}
                label={siteAuditLoading ? "Checking..." : `${siteAudit?.siteHealthScore ?? 0}/100`}
                sub="Technical site score"
                loading={siteAuditLoading}
              />
              {!siteAuditLoading && siteAudit && (
                <div style={{ fontSize: 11, color: MUTED, textAlign: "center" }}>
                  {siteAudit.isHttps ? "HTTPS" : "No HTTPS"} &middot; {siteAudit.hasRobotsTxt ? "robots.txt" : "No robots.txt"} &middot; {siteAudit.hasSitemap ? "Sitemap" : "No sitemap"}
                </div>
              )}
            </div>

            {/* AI Readiness */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "relative", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#F59E0B", borderRadius: "12px 12px 0 0" }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 5 }}>
                AI Readiness
                <span title="Score measuring how well your site is configured for AI crawlers: llms.txt, org schema, FAQ schema, and bot access rules." style={{ cursor: "help", color: "#9CA3AF", fontSize: 13, lineHeight: 1 }}>&#9432;</span>
              </div>
              <SmallScoreRing
                score={siteAudit?.aiHealthScore ?? 0}
                label={siteAuditLoading ? "Checking..." : `${siteAudit?.aiHealthScore ?? 0}/100`}
                sub="AI crawler readiness"
                loading={siteAuditLoading}
              />
              {!siteAuditLoading && siteAudit && (
                <div style={{ fontSize: 11, color: MUTED, textAlign: "center" }}>
                  {siteAudit.hasLlmsTxt ? "llms.txt" : "No llms.txt"} &middot; {siteAudit.hasOrgSchema ? "Org schema" : "No org schema"} &middot; {siteAudit.hasFaqSchema ? "FAQ schema" : "No FAQ"}
                </div>
              )}
            </div>
          </div>

          {/* KPIs + platform chips */}
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "24px 28px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>Key Metrics</div>
            <div style={{ display: "flex", gap: 32, marginBottom: d.platforms.length > 0 ? 24 : 0, flexWrap: "wrap" }}>
              <KpiCard label="AI Presence %" value={d.score} color={P} sub="GEO score across all AI systems" showZero />
              <KpiCard label="Systems Found" value={d.platforms.length} color="#10B981" sub="AI platforms with brand data" showZero />
              <KpiCard label="URLs Cited" value={d.citedPagesCount} color="#8B5CF6" sub="Unique pages cited by AI" showZero />
              <KpiCard label="Cited Sources" value={d.citedSources.length} color="#F59E0B" sub="External domains referencing brand" showZero />
            </div>
            {d.platforms.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Platform Breakdown</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {d.platforms.map(p => (
                    <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "white", borderRadius: 100, border: "1.5px solid #E8EAFF", fontSize: 13, fontWeight: 500, cursor: "default", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                      <AiLogo k={p.key} size={16} fallbackColor={p.color} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{p.displayName}</span>
                      <span style={{ background: P, color: "white", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 100 }}>{p.pct > 0 ? `${p.pct}%` : fmt(p.mentions)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Google AI Overview presence row */}
          {d.googleAio != null && (() => {
            const cited = d.googleAio!.aioExists && d.googleAio!.citedInAio;
            const exists = d.googleAio!.aioExists;
            const aioBg = cited ? "#F0FDF4" : exists ? "#FFF1F2" : "white";
            const aioBorder = cited ? "#BBF7D0" : exists ? "#FECACA" : BORDER;
            return (
              <div style={{ background: aioBg, border: `1.5px solid ${aioBorder}`, borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 14 }}>Google AI Overview</div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <AiLogo k="ai_overview" size={24} fallbackColor="#4285F4" />
                    {exists ? (
                      d.googleAio!.citedInAio ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: "#D1FAE5", flexShrink: 0 }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#059669" }}>Cited in AI Overview</span>
                          {d.googleAio!.keywordChecked && (
                            <span style={{ fontSize: 12, color: MUTED, background: "#F3F4F6", padding: "3px 10px", borderRadius: 100 }}>
                              "{d.googleAio!.keywordChecked}"
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: "#FEE2E2", flexShrink: 0 }}>
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#EF4444" }}>Not in AI Overview</span>
                          {d.googleAio!.keywordChecked && (
                            <span style={{ fontSize: 12, color: MUTED, background: "#F3F4F6", padding: "3px 10px", borderRadius: 100 }}>
                              checked: "{d.googleAio!.keywordChecked}"
                            </span>
                          )}
                        </div>
                      )
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: MUTED }}>No AI Overview triggered for these queries</span>
                      </div>
                    )}
                  </div>
                </div>
                {d.googleAio!.aioText && (
                  <div style={{ marginTop: 14, padding: "12px 16px", background: "white", borderRadius: 8, fontSize: 12, color: "#374151", lineHeight: 1.7, border: `1px solid ${aioBorder}` }}>
                    {d.googleAio!.aioText}
                    {d.googleAio!.aioText.length >= 250 && <span style={{ color: "#9CA3AF" }}>...</span>}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Errors & Warnings */}
          {(() => {
            const issues = siteAudit ? buildAiIssues(siteAudit) : [];
            if (!siteAuditLoading && issues.length === 0) return null;
            const errors = issues.filter(i => i.severity === "error");
            const warnings = issues.filter(i => i.severity !== "error");
            return (
              <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Errors and Warnings</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {errors.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#FEF2F2", color: "#DC2626" }}>
                        {errors.length} error{errors.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {warnings.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#FFFBEB", color: "#D97706" }}>
                        {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {siteAuditLoading && (
                      <span style={{ fontSize: 11, color: MUTED }}>Scanning site...</span>
                    )}
                  </div>
                </div>
                {siteAuditLoading && issues.length === 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: MUTED, fontSize: 13 }}>
                    <div style={{ width: 14, height: 14, border: "2px solid #E5E7EB", borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Running site checks for {domain}...
                  </div>
                )}
                <div>
                  {[...errors, ...warnings].map(issue => (
                    <IssuePanel
                      key={issue.key}
                      issueKey={issue.key}
                      title={issue.title}
                      severity={issue.severity}
                      description={issue.description}
                      domain={domain}
                      expanded={expandedIssue === issue.key}
                      onToggle={() => setExpandedIssue(expandedIssue === issue.key ? null : issue.key)}
                    />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* no data state */}
          {!d.hasData && (
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 16 }}>
              <NoDataState domain={d.domain} />
            </div>
          )}

          {/* distribution + countries */}
          {d.hasData && (
            <div style={{ display: "grid", gridTemplateColumns: d.countries.length > 0 ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 16 }}>

              {/* distribution by LLM */}
              <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Distribution by LLM</div>
                {d.platforms.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: MUTED }}>No platform data available.</div>
                ) : (
                  d.platforms.map(p => (
                    <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0", borderBottom: `1px solid #F9FAFB` }}>
                      <AiLogo k={p.key} size={28} fallbackColor={p.color} />
                      <div style={{ width: 90, fontSize: 14, fontWeight: 500, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>{p.displayName}</div>
                      <div style={{ flex: 1, height: 8, background: "#F3F4F6", borderRadius: 100, overflow: "hidden" }}>
                        <div style={{ width: `${p.pct}%`, height: "100%", background: p.color, borderRadius: 100, transition: "width 0.6s ease" }} />
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", width: 48, textAlign: "right", flexShrink: 0 }}>{fmt(p.mentions)}</div>
                    </div>
                  ))
                )}
                {d.platformsNote && (
                  <div style={{ marginTop: 12, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{d.platformsNote}</div>
                )}
              </div>

              {/* mentions by country */}
              {d.countries.length > 0 && (
                <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Mentions by Country</div>
                  {/* stacked bar */}
                  <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 16 }}>
                    {d.countries.slice(0, 6).map((c, i) => {
                      const barColors = [P, "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#6B7280"];
                      return <div key={c.code} style={{ width: `${c.pct}%`, background: barColors[i] ?? "#9CA3AF" }} title={`${c.name}: ${c.pct}%`} />;
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, padding: "0 2px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase" }}>Country</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase" }}>Mentions</span>
                  </div>
                  {d.countries.map(c => (
                    <div key={c.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{COUNTRY_FLAGS[c.code] ?? "🌐"}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{c.name}</span>
                        <span style={{ fontSize: 12, color: MUTED }}>{c.pct}%</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: P }}>{fmt(c.mentions)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* topics & sources */}
          {d.hasData && (
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Topics & Sources</div>
              <TabBar
                active={topicsTab}
                onSelect={id => setTopicsTab(id as typeof topicsTab)}
                tabs={[
                  { id: "performing", label: "Performing Topics", count: d.performingTopicsCount },
                  { id: "opportunities", label: "Topic Opportunities", count: d.topicOpportunitiesCount },
                  { id: "pages", label: "Cited Pages", count: d.citedPagesCount },
                  { id: "sources", label: "Cited Sources", count: d.citedSources.length },
                ]}
              />
              <div style={{ marginTop: 16 }}>
                {topicsTab === "performing" && (() => {
                  const seen = new Set<string>();
                  const unique = d.performingTopics.filter(t => {
                    const key = (t.question || "").toLowerCase().trim();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                  return (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px", gap: 8, padding: "6px 0", borderBottom: `1px solid ${BORDER}`, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase" }}>Topic / Prompt</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", textAlign: "right" }}>Platform</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", textAlign: "right" }}>AI Volume</span>
                      </div>
                      {unique.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 0", color: MUTED, fontSize: 13 }}>No performing topics found.</div>
                      ) : (
                        unique.slice(0, 25).map((t, i) => (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px", gap: 8, padding: "10px 0", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                            <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.4 }}>{t.question}</span>
                            <span style={{ fontSize: 12, color: MUTED, textAlign: "right" }}>{modelDisplayName(t.model_name || t.platform)}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: P, textAlign: "right" }}>{fmt(t.ai_search_volume)}</span>
                          </div>
                        ))
                      )}
                    </>
                  );
                })()}
                {topicsTab === "opportunities" && (() => {
                  const seen = new Set<string>();
                  const unique = d.topicOpportunities.filter(t => {
                    const key = (t.question || "").toLowerCase().trim();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                  return (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px", gap: 8, padding: "6px 0", borderBottom: `1px solid ${BORDER}`, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase" }}>Topic / Prompt</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", textAlign: "right" }}>Platform</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", textAlign: "right" }}>AI Volume</span>
                      </div>
                      {unique.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 0", color: MUTED, fontSize: 13 }}>No opportunities data found.</div>
                      ) : (
                        unique.slice(0, 25).map((t, i) => (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px", gap: 8, padding: "10px 0", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                            <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.4 }}>{t.question}</span>
                            <span style={{ fontSize: 12, color: MUTED, textAlign: "right" }}>{modelDisplayName(t.model_name || t.platform)}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#D97706", textAlign: "right" }}>{fmt(t.ai_search_volume)}</span>
                          </div>
                        ))
                      )}
                    </>
                  );
                })()}
                {topicsTab === "pages" && (() => {
                  const PAGE_SIZE = 10;
                  const total = d.citedPages.length;
                  const start = pagesPage * PAGE_SIZE;
                  const slice = d.citedPages.slice(start, start + PAGE_SIZE);
                  return (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px", gap: 8, padding: "6px 0", borderBottom: `1px solid ${BORDER}`, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase" }}>URL</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", textAlign: "right" }}>Mentions</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", textAlign: "right" }}>AI Volume</span>
                      </div>
                      {total === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 0", color: MUTED, fontSize: 13 }}>No cited pages found.</div>
                      ) : (
                        <>
                          {slice.map((p, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px", gap: 8, padding: "10px 0", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                              <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: P, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.url}</a>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", textAlign: "right" }}>{fmt(p.mentions)}</span>
                              <span style={{ fontSize: 13, color: MUTED, textAlign: "right" }}>{fmt(p.ai_search_volume)}</span>
                            </div>
                          ))}
                          {total > PAGE_SIZE && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, marginTop: 4 }}>
                              <span style={{ fontSize: 12, color: MUTED }}>{start + 1}-{Math.min(start + PAGE_SIZE, total)} of {total}</span>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => setPagesPage(p => Math.max(0, p - 1))} disabled={pagesPage === 0} style={{ fontSize: 12, padding: "4px 12px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "white", color: pagesPage === 0 ? MUTED : "#374151", cursor: pagesPage === 0 ? "default" : "pointer" }}>Prev</button>
                                <button onClick={() => setPagesPage(p => p + 1)} disabled={start + PAGE_SIZE >= total} style={{ fontSize: 12, padding: "4px 12px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "white", color: start + PAGE_SIZE >= total ? MUTED : "#374151", cursor: start + PAGE_SIZE >= total ? "default" : "pointer" }}>Next</button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
                {topicsTab === "sources" && (() => {
                  const PAGE_SIZE = 10;
                  const total = d.citedSources.length;
                  const start = sourcesPage * PAGE_SIZE;
                  const slice = d.citedSources.slice(start, start + PAGE_SIZE);
                  return (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px", gap: 8, padding: "6px 0", borderBottom: `1px solid ${BORDER}`, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase" }}>Domain</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", textAlign: "right" }}>Mentions</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", textAlign: "right" }}>AI Volume</span>
                      </div>
                      {total === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 0", color: MUTED, fontSize: 13 }}>No cited sources found.</div>
                      ) : (
                        <>
                          {slice.map((s, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px", gap: 8, padding: "10px 0", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                              <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{s.domain}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: P, textAlign: "right" }}>{fmt(s.mentions)}</span>
                              <span style={{ fontSize: 13, color: MUTED, textAlign: "right" }}>{fmt(s.ai_search_volume)}</span>
                            </div>
                          ))}
                          {total > PAGE_SIZE && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, marginTop: 4 }}>
                              <span style={{ fontSize: 12, color: MUTED }}>{start + 1}-{Math.min(start + PAGE_SIZE, total)} of {total}</span>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => setSourcesPage(p => Math.max(0, p - 1))} disabled={sourcesPage === 0} style={{ fontSize: 12, padding: "4px 12px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "white", color: sourcesPage === 0 ? MUTED : "#374151", cursor: sourcesPage === 0 ? "default" : "pointer" }}>Prev</button>
                                <button onClick={() => setSourcesPage(p => p + 1)} disabled={start + PAGE_SIZE >= total} style={{ fontSize: 12, padding: "4px 12px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "white", color: start + PAGE_SIZE >= total ? MUTED : "#374151", cursor: start + PAGE_SIZE >= total ? "default" : "pointer" }}>Next</button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
