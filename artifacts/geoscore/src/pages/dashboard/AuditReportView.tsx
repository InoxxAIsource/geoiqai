import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, Copy, Check, Info } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TechCheck {
  id: string;
  name: string;
  score: number;
  status: string;
  detail: string;
}

export interface TechnicalAudit {
  checks: TechCheck[];
  overallScore: number;
  brandDescription?: string;
  socialLinks?: string[];
  contactEmail?: string | null;
}

export interface EeatScore {
  total: number;
  experience: number;
  expertise: number;
  authoritativeness: number;
  trustworthiness: number;
  strengths?: string;
  weaknesses?: string;
}

export interface Recommendation {
  action: string;
  priority: string;
  effortHours: number;
  impactScore: number;
  category: string;
  citeCategory: string;
}

export interface AuditResult {
  domain: string;
  brandName?: string | null;
  category?: string | null;
  market?: string | null;
  scoreTotal: number;
  scoreAiVisibility?: number;
  scoreTechnical?: number;
  scoreChatgpt: number;
  scoreGemini: number;
  scorePerplexity: number;
  scoreClaude?: number;
  scoreGrok?: number;
  chatgptFound: boolean;
  geminiFound: boolean;
  perplexityFound: boolean;
  claudeFound?: boolean;
  grokFound?: boolean;
  chatgptDetail?: string | null;
  geminiDetail?: string | null;
  perplexityDetail?: string | null;
  claudeDetail?: string | null;
  grokDetail?: string | null;
  rawChatgptResponse?: string | null;
  rawGeminiResponse?: string | null;
  rawPerplexityResponse?: string | null;
  rawClaudeResponse?: string | null;
  rawGrokResponse?: string | null;
  technicalAudit?: TechnicalAudit | null;
  eeatScore?: EeatScore | null;
  recommendations?: Recommendation[];
  createdAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score < 34) return "#ef4444";
  if (score < 67) return "#f59e0b";
  return "#10b981";
}

function getUnderstandingLabel(score: number, isLiveWeb = false): { label: string; color: string; bg: string } {
  if (score >= 25) return { label: "Strong understanding", color: "#059669", bg: "#ecfdf5" };
  if (score >= 10) return { label: "Partial understanding", color: "#D97706", bg: "#fffbeb" };
  if (score >= 1)  return { label: "Mentioned briefly", color: "#D97706", bg: "#fffbeb" };
  if (isLiveWeb)   return { label: "Not found on web", color: "#DC2626", bg: "#fef2f2" };
  return { label: "Not in training data", color: "#F97316", bg: "#fff7ed" };
}

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function generateLlmsTxt(brandName: string, domain: string, description: string, socialLinks: string[], contactEmail: string | null): string {
  const socialBlock = socialLinks.length > 0
    ? `\n## Social Profiles\n${socialLinks.map((l) => `- ${l}`).join("\n")}`
    : "";
  const contactBlock = contactEmail ? `\n## Contact\n${contactEmail}` : "";
  return `# ${brandName}
> ${description || `${brandName} official website`}

## About
${brandName} is available at ${domain}.

## Key Pages
- [Homepage](https://${domain}/): Main page
- [About](https://${domain}/about): About us
- [Blog](https://${domain}/blog): Articles and updates${socialBlock}${contactBlock}

## Sitemap
https://${domain}/sitemap.xml`;
}

function generateRobotsTxtAdditions(): string {
  return `# AI Crawler Access (GEO-optimized)
# Add these lines to your robots.txt

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: GoogleBot-Extended
Allow: /`;
}

function generateSchemaJson(brandName: string, domain: string, description: string, socialLinks: string[], contactEmail: string | null): string {
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": brandName,
    "url": `https://${domain}`,
    "description": description || `${brandName} - official website`,
    "logo": `https://${domain}/logo.png`,
  };
  if (socialLinks.length > 0) obj["sameAs"] = socialLinks;
  if (contactEmail) {
    obj["contactPoint"] = {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "email": contactEmail,
    };
  }
  return JSON.stringify(obj, null, 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ENGINE_CONFIG: Record<string, { color: string; barColor: string; label: string }> = {
  ChatGPT:    { color: "#10a37f", barColor: "linear-gradient(90deg,#0d9068,#10a37f)", label: "ChatGPT says:" },
  Gemini:     { color: "#4285f4", barColor: "linear-gradient(90deg,#1a6fe8,#4285f4)", label: "Gemini says:" },
  Perplexity: { color: "#9333ea", barColor: "linear-gradient(90deg,#7c22d4,#9333ea)", label: "Perplexity says:" },
  Claude:     { color: "#d97706", barColor: "linear-gradient(90deg,#b45309,#d97706)", label: "Claude says:" },
  Grok:       { color: "#374151", barColor: "linear-gradient(90deg,#1f2937,#374151)", label: "Grok says:" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", background: copied ? "#ecfdf5" : "#f3f4f6",
        color: copied ? "#059669" : "#374151", border: "0.5px solid",
        borderColor: copied ? "#6ee7b7" : "#d1d5db", borderRadius: 6,
        fontSize: 12, fontWeight: 500, cursor: "pointer",
      }}
    >
      {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
      {copied ? "Copied" : "Copy to clipboard"}
    </button>
  );
}

function AiExplainerBox({ aiMemoryScore, liveWebScore }: { aiMemoryScore: number; liveWebScore: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#f0f4ff", border: "0.5px solid #c7d2fe", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Info style={{ width: 14, height: 14, color: "#4F46E5", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#4F46E5" }}>How AI systems see your brand</span>
        </div>
        {open ? <ChevronUp style={{ width: 13, height: 13, color: "#6366f1" }} /> : <ChevronDown style={{ width: 13, height: 13, color: "#6366f1" }} />}
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid #c7d2fe" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, marginBottom: 12 }}>
            <div style={{ background: "white", border: "0.5px solid #c7d2fe", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", marginBottom: 4 }}>AI Memory Score: {aiMemoryScore}/50</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 4 }}>ChatGPT + Gemini</div>
              <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
                These answer from training data, like a snapshot of the internet taken in 2023-2024. If your brand is newer than that, or lacks citations in sources they were trained on, they won't know you exist yet.
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>To improve: Crunchbase, Product Hunt, press coverage, Reddit. Takes 3-6 months.</div>
            </div>
            <div style={{ background: "white", border: "0.5px solid #c7d2fe", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9333ea", marginBottom: 4 }}>Live Web Score: {liveWebScore}/50</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 4 }}>Perplexity</div>
              <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
                Perplexity searches the live web in real time. It can find you right now if you have sufficient web presence and your site is indexable. Score 0 here means fix your web presence first.
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>To improve: fix technical issues, add content, get web mentions. Impact within days.</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#4F46E5", fontWeight: 500 }}>
            Two different problems, two different timelines. Your roadmap below covers both.
          </div>
        </div>
      )}
    </div>
  );
}

function SystemCard({
  system, found, score, detail, rawResponse, checkedAt, simulated, isLiveWeb,
}: {
  system: string; found: boolean; score: number; detail?: string | null;
  rawResponse?: string | null; checkedAt?: string; simulated?: boolean; isLiveWeb?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const understanding = getUnderstandingLabel(score, isLiveWeb);
  const scaledScore = Math.round((score / 33) * 100);
  const cfg = ENGINE_CONFIG[system] ?? { color: "#4F46E5", barColor: "linear-gradient(90deg,#4F46E5,#7C3AED)", label: `${system} says:` };

  return (
    <div style={{
      background: "white",
      border: "0.5px solid #e5e7eb",
      borderLeft: `3px solid ${cfg.color}`,
      borderRadius: 10,
      marginBottom: 8,
      overflow: "hidden",
    }}>
      <div style={{ padding: "12px 14px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{system}</span>
            {simulated && (
              <span style={{ fontSize: 10, color: "#9ca3af", background: "#f3f4f6", border: "0.5px solid #e5e7eb", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.02em" }}>simulated</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ background: understanding.bg, color: understanding.color, borderRadius: 9999, padding: "2px 9px", fontSize: 11, fontWeight: 500 }}>
              {understanding.label}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: scaledScore > 0 ? cfg.color : "#d1d5db", minWidth: 38, textAlign: "right" }}>
              {scaledScore}<span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>/100</span>
            </span>
          </div>
        </div>

        <div style={{ height: 5, background: "#f3f4f6", borderRadius: 3, overflow: "hidden", marginBottom: 9 }}>
          <div style={{
            height: "100%",
            width: `${scaledScore}%`,
            background: scaledScore === 0 ? "#e5e7eb" : cfg.barColor,
            borderRadius: 3,
            transition: "width 1.1s cubic-bezier(0.4,0,0.2,1)",
          }} />
        </div>

        <div style={{ fontSize: 12, color: found ? "#4b5563" : "#9ca3af", lineHeight: 1.5 }}>
          {found && detail
            ? detail.substring(0, 110) + (detail.length > 110 ? "..." : "")
            : isLiveWeb
              ? "Not found when Perplexity searched the live web for your category"
              : "Not in training data - not yet cited in sources AI systems learn from"}
        </div>
      </div>

      {rawResponse && (
        <>
          <div
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: "7px 14px", borderTop: "0.5px solid #f3f4f6",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", background: expanded ? "#f9fafb" : "white",
              fontSize: 11, color: "#6b7280", userSelect: "none",
            }}
          >
            <span>What {system} actually said about you</span>
            {expanded ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
          </div>
          {expanded && (
            <div style={{ background: "#0d1117", padding: "16px" }}>
              <div style={{ fontSize: 11, color: "#8b949e", fontFamily: "monospace", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {checkedAt && <span style={{ color: "#6b7280" }}>Checked {formatTimestamp(checkedAt)}</span>}
                  <CopyButton text={rawResponse ?? ""} />
                </div>
              </div>
              <pre style={{ fontSize: 12, color: "#e6edf3", fontFamily: "monospace", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 320, overflowY: "auto" }}>
                {rawResponse}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TechCheckCard({ check }: { check: TechCheck }) {
  const statusConfig = {
    pass: { icon: <CheckCircle2 style={{ width: 16, height: 16, color: "#059669" }} />, badgeBg: "#dcfce7", badgeColor: "#15803d", label: "Pass", borderColor: "#10b981" },
    warn: { icon: <AlertTriangle style={{ width: 16, height: 16, color: "#D97706" }} />, badgeBg: "#fef9c3", badgeColor: "#854d0e", label: "Warn", borderColor: "#f59e0b" },
    fail: { icon: <XCircle style={{ width: 16, height: 16, color: "#DC2626" }} />, badgeBg: "#fee2e2", badgeColor: "#991b1b", label: "Fail", borderColor: "#ef4444" },
  };
  const cfg = statusConfig[check.status as "pass" | "warn" | "fail"] ?? statusConfig.fail;
  return (
    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderLeft: `3px solid ${cfg.borderColor}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {cfg.icon}
          <span style={{ fontWeight: 500, fontSize: 14, color: "#111827" }}>{check.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: check.score >= 70 ? "#059669" : check.score >= 40 ? "#D97706" : "#DC2626" }}>{check.score}/100</span>
          <span style={{ background: cfg.badgeBg, color: cfg.badgeColor, borderRadius: 9999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{cfg.label}</span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{check.detail}</p>
    </div>
  );
}

function GeoFileBlock({ title, filename, instruction, content }: { title: string; filename: string; instruction: string; content: string }) {
  return (
    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, color: "#111827" }}>{title}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, fontFamily: "monospace" }}>{filename}</div>
        </div>
        <CopyButton text={content} />
      </div>
      <div style={{ background: "#0d1117", padding: "16px", overflowX: "auto" }}>
        <pre style={{ fontSize: 12, color: "#e6edf3", fontFamily: "monospace", lineHeight: 1.65, whiteSpace: "pre", margin: 0 }}>{content}</pre>
      </div>
      <div style={{ padding: "10px 16px", background: "#f9fafb", borderTop: "0.5px solid #e5e7eb" }}>
        <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{instruction}</p>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 4 }}>
      {children}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AuditReportView({ auditResult }: { auditResult: AuditResult }) {
  const tech = auditResult.technicalAudit ?? null;
  const hasTech = tech && Array.isArray(tech.checks) && tech.checks.length > 0;
  const domain = auditResult.domain ?? "";
  const brandName = auditResult.brandName ?? domain;
  const description = tech?.brandDescription ?? "";
  const socialLinks: string[] = tech?.socialLinks ?? [];
  const contactEmail: string | null = tech?.contactEmail ?? null;

  const aiMemoryScore = Math.round(
    ((auditResult.scoreChatgpt ?? 0) + (auditResult.scoreGemini ?? 0)) / 66 * 50
  );
  const liveWebScore = Math.round((auditResult.scorePerplexity ?? 0) / 33 * 50);

  const allFound = [
    auditResult.chatgptFound,
    auditResult.geminiFound,
    auditResult.perplexityFound,
    auditResult.claudeFound ?? false,
    auditResult.grokFound ?? false,
  ];
  const foundCount = allFound.filter(Boolean).length;
  const blindSpots = allFound.filter(f => !f).length;
  const bestEngine = auditResult.chatgptFound ? "ChatGPT"
    : auditResult.geminiFound ? "Gemini"
    : auditResult.perplexityFound ? "Perplexity"
    : auditResult.claudeFound ? "Claude"
    : auditResult.grokFound ? "Grok"
    : null;

  return (
    <div>
      {/* Score header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 16, background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 16, color: "#111827" }}>{domain}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            AI visibility audit, just now, {auditResult.category ?? "saas tool"}, {auditResult.market ?? "Global"}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
              <span style={{ width: 8, height: 8, background: "#4F46E5", borderRadius: 2, flexShrink: 0 }} />
              AI Memory ({aiMemoryScore}/50) - ChatGPT + Gemini
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
              <span style={{ width: 8, height: 8, background: "#9333ea", borderRadius: 2, flexShrink: 0 }} />
              Live Web ({liveWebScore}/50) - Perplexity
            </div>
          </div>
          <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, marginTop: 8, overflow: "hidden", maxWidth: 320 }}>
            <div style={{ height: "100%", display: "flex", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${aiMemoryScore}%`, background: "#4F46E5", transition: "width 0.8s ease" }} />
              <div style={{ width: `${liveWebScore}%`, background: "#9333ea", transition: "width 0.8s ease" }} />
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 40, fontWeight: 500, color: getScoreColor(auditResult.scoreTotal), lineHeight: 1 }}>
              {auditResult.scoreTotal}
            </span>
            <span style={{ fontSize: 16, color: "#6b7280" }}>/100</span>
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>GEO IQ score</div>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: `${foundCount}/5 AI engines found you` },
          { label: bestEngine ? `Visible on ${bestEngine}` : "Not ranked anywhere" },
          { label: `${blindSpots} blind spot${blindSpots !== 1 ? "s" : ""} found` },
        ].map((card, i) => (
          <div key={i} style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#374151", fontWeight: 500, textAlign: "center" }}>
            {card.label}
          </div>
        ))}
      </div>

      {/* Section 01: AI Visibility */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionLabel>01 - Brand Recognition by AI Engine</SectionLabel>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>5 engines checked</span>
        </div>
        <AiExplainerBox aiMemoryScore={aiMemoryScore} liveWebScore={liveWebScore} />
        <SystemCard system="ChatGPT" found={auditResult.chatgptFound} score={auditResult.scoreChatgpt} detail={auditResult.chatgptDetail} rawResponse={auditResult.rawChatgptResponse} checkedAt={auditResult.createdAt} />
        <SystemCard system="Gemini" found={auditResult.geminiFound} score={auditResult.scoreGemini} detail={auditResult.geminiDetail} rawResponse={auditResult.rawGeminiResponse} checkedAt={auditResult.createdAt} />
        <SystemCard system="Perplexity" found={auditResult.perplexityFound} score={auditResult.scorePerplexity} detail={auditResult.perplexityDetail} rawResponse={auditResult.rawPerplexityResponse} checkedAt={auditResult.createdAt} isLiveWeb />
        <SystemCard system="Claude" found={auditResult.claudeFound ?? false} score={auditResult.scoreClaude ?? 0} detail={auditResult.claudeDetail} rawResponse={auditResult.rawClaudeResponse} checkedAt={auditResult.createdAt} simulated />
        <SystemCard system="Grok" found={auditResult.grokFound ?? false} score={auditResult.scoreGrok ?? 0} detail={auditResult.grokDetail} rawResponse={auditResult.rawGrokResponse} checkedAt={auditResult.createdAt} />
      </div>

      {/* Section 02: Technical GEO Audit */}
      {hasTech && (
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>02 - Technical GEO Audit</SectionLabel>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14, marginTop: 4 }}>
            These technical signals directly affect how AI engines crawl and understand your brand.
          </p>
          {tech!.checks.map((check) => (
            <TechCheckCard key={check.id} check={check} />
          ))}
          <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Technical GEO Score</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: getScoreColor(tech!.overallScore) }}>{tech!.overallScore}/100</span>
          </div>
        </div>
      )}

      {/* Section 03: EEAT */}
      {auditResult.eeatScore && (() => {
        const eeat = auditResult.eeatScore!;
        const dims = [
          { key: "Experience", value: eeat.experience, desc: "Firsthand knowledge" },
          { key: "Expertise", value: eeat.expertise, desc: "Technical accuracy" },
          { key: "Authoritativeness", value: eeat.authoritativeness, desc: "External validation" },
          { key: "Trustworthiness", value: eeat.trustworthiness, desc: "Factual density" },
        ];
        const pct = Math.round((eeat.total / 100) * 100);
        const scoreColor = eeat.total >= 70 ? "#059669" : eeat.total >= 45 ? "#D97706" : "#DC2626";
        return (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>03 - Content Quality (EEAT)</SectionLabel>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14, marginTop: 4 }}>
              How well your content signals Experience, Expertise, Authoritativeness, and Trustworthiness to AI engines.
            </p>
            <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "20px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>EEAT Score</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>out of 100</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: scoreColor }}>{eeat.total}<span style={{ fontSize: 14, fontWeight: 400, color: "#9ca3af" }}>/100</span></div>
              </div>
              <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: scoreColor, borderRadius: 3, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
                {dims.map((d) => (
                  <div key={d.key} style={{ background: "#f9fafb", borderRadius: 8, padding: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{d.key}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{d.desc}</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: d.value >= 18 ? "#059669" : d.value >= 12 ? "#D97706" : "#DC2626" }}>
                        {d.value}<span style={{ fontSize: 10, fontWeight: 400, color: "#9ca3af" }}>/25</span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(d.value / 25) * 100}%`, background: d.value >= 18 ? "#059669" : d.value >= 12 ? "#D97706" : "#DC2626", borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
              {(eeat.strengths || eeat.weaknesses) && (
                <div style={{ borderTop: "0.5px solid #e5e7eb", paddingTop: 12 }}>
                  {eeat.strengths && <p style={{ fontSize: 12, color: "#059669", margin: "0 0 4px" }}>{eeat.strengths}</p>}
                  {eeat.weaknesses && <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{eeat.weaknesses}</p>}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Section 04: Fix Actions */}
      {auditResult.recommendations && auditResult.recommendations.length > 0 && (() => {
        const recs = auditResult.recommendations!;
        const CITE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; desc: string }> = {
          C: { label: "C", color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd", desc: "Citations" },
          I: { label: "I", color: "#92400e", bg: "#fffbeb", border: "#fcd34d", desc: "Indexability" },
          T: { label: "T", color: "#065f46", bg: "#ecfdf5", border: "#6ee7b7", desc: "Trustworthiness" },
          E: { label: "E", color: "#5b21b6", bg: "#f5f3ff", border: "#c4b5fd", desc: "Entity" },
        };
        const PRIORITY_COLOR: Record<string, string> = { high: "#DC2626", medium: "#D97706", low: "#6b7280" };
        return (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>04 - Fix Actions</SectionLabel>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 6, marginTop: 4 }}>
              Prioritized by impact. Each action is tagged with its CITE category.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {(["C", "I", "T", "E"] as const).map((k) => {
                const cfg = CITE_CONFIG[k]!;
                return (
                  <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, color: cfg.color, fontWeight: 600 }}>
                    [{cfg.label}] {cfg.desc}
                  </span>
                );
              })}
            </div>
            {recs.map((rec, i) => {
              const cite = CITE_CONFIG[rec.citeCategory] ?? CITE_CONFIG["C"]!;
              return (
                <div key={i} style={{ background: "white", border: "0.5px solid #e5e7eb", borderLeft: `3px solid ${cite.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: cite.bg, border: `0.5px solid ${cite.border}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: cite.color }}>
                      {cite.label}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, color: "#111827", lineHeight: 1.6, margin: "0 0 8px" }}>{rec.action}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_COLOR[rec.priority] ?? "#6b7280", textTransform: "capitalize" }}>{rec.priority} priority</span>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>{rec.effortHours}h effort</span>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>+{rec.impactScore} score impact</span>
                        <span style={{ fontSize: 11, color: cite.color, background: cite.bg, padding: "1px 6px", borderRadius: 4 }}>{cite.desc}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Section 05: Free GEO Files */}
      {(() => {
        const robotsCheck = tech?.checks?.find((c) => c.id === "robots");
        const schemaCheck = tech?.checks?.find((c) => c.id === "schema");
        const llmsCheck = tech?.checks?.find((c) => c.id === "llms");
        const needsRobots = !robotsCheck || robotsCheck.status !== "pass";
        const needsSchema = !schemaCheck || schemaCheck.status !== "pass";
        const needsLlms = !llmsCheck || llmsCheck.status !== "pass";
        const hasAnything = needsRobots || needsSchema || needsLlms;
        return (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>05 - Free GEO Files for Your Site</SectionLabel>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14, marginTop: 4 }}>
              {hasAnything
                ? "Add these files to immediately improve your technical GEO score."
                : "Your technical setup looks good. Keep your llms.txt updated as your product evolves."}
            </p>
            {needsLlms && (
              <GeoFileBlock
                title="llms.txt"
                filename={`Save as llms.txt and upload to ${domain}/llms.txt`}
                instruction={`Upload this file to your web root at https://${domain}/llms.txt`}
                content={generateLlmsTxt(brandName, domain, description, socialLinks, contactEmail)}
              />
            )}
            {needsRobots && (
              <GeoFileBlock
                title="robots.txt additions"
                filename="Add these lines to your existing robots.txt"
                instruction="Open your robots.txt and paste these lines at the end. This explicitly allows all major AI crawlers to index your site."
                content={generateRobotsTxtAdditions()}
              />
            )}
            {needsSchema && (
              <GeoFileBlock
                title="Schema markup (JSON-LD)"
                filename={`Add inside a <script type="application/ld+json"> tag in your homepage <head>`}
                instruction={`Paste this inside your homepage's <head> section. It helps AI engines identify your brand entity.`}
                content={generateSchemaJson(brandName, domain, description, socialLinks, contactEmail)}
              />
            )}
            {!hasAnything && (
              <GeoFileBlock
                title="llms.txt (keep updated)"
                filename={`Save as llms.txt and upload to ${domain}/llms.txt`}
                instruction={`Your llms.txt is live. Re-upload this whenever your product description, features, or social profiles change.`}
                content={generateLlmsTxt(brandName, domain, description, socialLinks, contactEmail)}
              />
            )}
          </div>
        );
      })()}
    </div>
  );
}
