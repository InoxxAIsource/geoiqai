import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/auth";
import {
  FileText, Link, ChevronDown, ChevronRight, Copy, Check,
  AlertCircle, ArrowRight, RefreshCw, Loader2, ExternalLink,
  PenTool, Search, Bookmark, Wand2, Repeat2, Download,
} from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";

// ─── Score Gauge ────────────────────────────────────────────────────────────────

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 81 ? "#059669" : score >= 61 ? "#10B981" : score >= 41 ? AMBER : RED;
  const bgColor = score >= 81 ? "#ECFDF5" : score >= 61 ? "#D1FAE5" : score >= 41 ? "#FFFBEB" : "#FEF2F2";
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="160" height="100" viewBox="0 0 160 100">
        <path d="M 16 80 A 64 64 0 0 1 144 80" fill="none" stroke="#E5E7EB" strokeWidth="13" strokeLinecap="round" />
        <path
          d="M 16 80 A 64 64 0 0 1 144 80"
          fill="none"
          stroke={color}
          strokeWidth="13"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${score} 100`}
        />
        <text x="80" y="70" textAnchor="middle" fontSize="30" fontWeight="800" fill="#111827">{score}</text>
        <text x="80" y="86" textAnchor="middle" fontSize="11" fill={MUTED}>/ 100</text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 2,
        background: bgColor, display: "inline-block", padding: "3px 10px", borderRadius: 20 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>AI Citation Readiness</div>
    </div>
  );
}

// ─── Factor Row ─────────────────────────────────────────────────────────────────

function FactorRow({ factor, expanded, onToggle, onCopy, copied }: {
  factor: { name: string; score: number; status: string; feedback: string; fix: string | null };
  expanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  copied: boolean;
}) {
  const icon = factor.status === "good" ? "✓" : factor.status === "warning" ? "!" : "✕";
  const iconColor = factor.status === "good" ? GREEN : factor.status === "warning" ? AMBER : RED;
  const iconBg = factor.status === "good" ? "#ECFDF5" : factor.status === "warning" ? "#FFFBEB" : "#FEF2F2";
  const barColor = factor.status === "good" ? GREEN : factor.status === "warning" ? AMBER : RED;

  return (
    <div>
      <button
        onClick={onToggle}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
          borderBottom: expanded ? "none" : `1px solid ${BORDER}`, textAlign: "left" }}
      >
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: iconBg, color: iconColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{ flex: 1, fontSize: 13, color: "#374151", fontWeight: 500 }}>{factor.name}</span>
        <div style={{ width: 60, height: 4, background: "#E5E7EB", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
          <div style={{ width: `${factor.score * 10}%`, height: "100%", background: barColor, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: iconColor, width: 28, textAlign: "right", flexShrink: 0 }}>
          {factor.score}/10
        </span>
        <span style={{ color: MUTED, flexShrink: 0 }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {expanded && (
        <div style={{ padding: "10px 0 12px 32px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 12, color: "#374151", marginBottom: factor.fix ? 10 : 0, lineHeight: 1.6 }}>
            {factor.feedback}
          </div>
          {factor.fix && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase",
                letterSpacing: "0.05em", marginBottom: 6 }}>Suggested fix</div>
              <div style={{ position: "relative" }}>
                <pre style={{ fontSize: 11, background: "#F8FAFC", border: `1px solid ${BORDER}`, borderRadius: 6,
                  padding: "10px 40px 10px 12px", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  color: "#374151", margin: 0, fontFamily: "monospace", lineHeight: 1.6, maxHeight: 180, overflow: "auto" }}>
                  {factor.fix}
                </pre>
                <button
                  onClick={() => onCopy(factor.fix!)}
                  style={{ position: "absolute", top: 6, right: 6, padding: "3px 8px",
                    background: "white", border: `1px solid ${BORDER}`, borderRadius: 5,
                    cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 3, color: MUTED }}
                >
                  {copied ? <Check size={11} color={GREEN} /> : <Copy size={11} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────────

interface Factor {
  name: string;
  score: number;
  status: "good" | "warning" | "missing";
  feedback: string;
  fix: string | null;
}

interface TopFix {
  priority: number;
  impact: "high" | "medium" | "low";
  title: string;
  description: string;
  timeToFix: string;
  scoreImpact: string;
  fix: string | null;
}

interface AnalysisResult {
  overallScore: number;
  scoreLabel: string;
  factors: Factor[];
  topFixes: TopFix[];
  missingPrompts: string[];
  competitorTips?: string[];
  isMock?: boolean;
}

interface SavedAnalysis {
  id: string;
  domain: string;
  sourceUrl: string | null;
  targetTopic: string;
  score: number;
  scoreLabel: string;
  topFixes: TopFix[];
  analyzedAt: string;
}

interface WriterResult {
  content: string;
  metaTitle: string;
  metaDescription: string;
  schema: string;
  suggestedLinks: string[];
  isMock?: boolean;
}

interface TopicsData {
  isMock: boolean;
  hasAnyData: boolean;
  hasBrandPerf: boolean;
  hasPromptResearch: boolean;
  hasCompetitorResearch: boolean;
  writeThese: Array<{ topic: string; competitor: string; aiVolume: string }>;
  improveThese: Array<{ topic: string; yourMentions: number; aiVolume: string }>;
  brandQuestions: Array<{ question: string; yourRank: string; category?: string }>;
}

// ─── Fix Flow helpers ─────────────────────────────────────────────────────────

type FlowStep = {
  number: number;
  title: string;
  description: string;
  action: "copy" | "link" | "info";
  cta?: string;
  url?: string;
};

function getFlowType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("faq") || t.includes("q&a") || t.includes("frequently")) return "faq_section";
  if (t.includes("schema") || t.includes("structured data") || t.includes("json-ld")) return "structured_data";
  if (t.includes("statistic") || t.includes("data") || t.includes("numbers")) return "statistics_and_data";
  if (t.includes("heading") || t.includes("h1") || t.includes("h2") || t.includes("hierarchy")) return "heading_hierarchy";
  if (t.includes("citation") || t.includes("authoritative") || t.includes("link out") || t.includes("source")) return "authoritative_citations";
  if (t.includes("comparison") || t.includes("table") || t.includes("vs")) return "comparison_tables";
  if (t.includes("prompt") || t.includes("coverage") || t.includes("missing")) return "prompt_coverage";
  return "default";
}

function FixFlowPanel({ fix, currentUrl, onRerun }: {
  fix: { title: string; description: string; fix: string | null };
  currentUrl: string;
  onRerun: () => void;
}) {
  const [copied, setCopied] = useState<number | null>(null);
  const encoded = encodeURIComponent(currentUrl);
  const flowType = getFlowType(fix.title);

  const flows: Record<string, FlowStep[]> = {
    faq_section: [
      { number: 1, title: "Copy the FAQ content", action: "copy", cta: "Copy FAQ Content",
        description: "Copy these Q&A pairs to add to your page" },
      { number: 2, title: "Add to your webpage", action: "info",
        description: "Paste these Q&As at the bottom of your main page, above the footer. Label the section 'Frequently Asked Questions'" },
      { number: 3, title: "Copy the FAQ schema", action: "copy", cta: "Copy FAQ Schema",
        description: "Also add this JSON-LD so AI systems can read your FAQs" },
      { number: 4, title: "Verify in Google", action: "link", cta: "Test in Google",
        description: "Check your FAQ appears as a rich result",
        url: `https://search.google.com/test/rich-results?url=${encoded}` },
    ],
    structured_data: [
      { number: 1, title: "Copy the schema code", action: "copy", cta: "Copy Schema Code",
        description: "Copy this JSON-LD code block" },
      { number: 2, title: "Open your website editor", action: "link", cta: "Open Replit",
        description: "Go to your site's HTML head section. In Replit open index.html or _document.tsx",
        url: "https://replit.com" },
      { number: 3, title: "Paste before the closing head tag", action: "info",
        description: "Paste the copied code just before the closing </head> tag on every page" },
      { number: 4, title: "Verify it works", action: "link", cta: "Test Schema",
        description: "Test your schema with Google's Rich Results tool",
        url: `https://search.google.com/test/rich-results?url=${encoded}` },
    ],
    statistics_and_data: [
      { number: 1, title: "Copy suggested statistics", action: "copy", cta: "Copy Stats",
        description: "Add these cited stats to your page content" },
      { number: 2, title: "Find the right page section", action: "info",
        description: "Place statistics in your hero section, about page, or any section making claims about your product or industry" },
      { number: 3, title: "Add source attribution", action: "info",
        description: "After each stat write: (Source: Gartner 2024). AI systems trust attributed numbers over unattributed claims" },
    ],
    heading_hierarchy: [
      { number: 1, title: "View your current headings", action: "link", cta: "Check Headings",
        description: "See all headings on your page using this free tool",
        url: `https://www.seoptimer.com/analyzer?url=${encoded}` },
      { number: 2, title: "Copy the suggested heading structure", action: "copy", cta: "Copy Heading Structure",
        description: "Replace your current headings with this AI-optimized structure" },
      { number: 3, title: "Update in your editor", action: "info",
        description: "Change section titles from plain text or H1 to proper H2/H3 tags. Each H2 should answer a specific user question" },
    ],
    authoritative_citations: [
      { number: 1, title: "Copy suggested sources", action: "copy", cta: "Copy Sources",
        description: "These are authoritative sources relevant to your content" },
      { number: 2, title: "Add links to your content", action: "info",
        description: "Link out to these sources from relevant sentences. Example: 'According to Gartner [link], 75% of...' AI systems prefer pages that cite credible sources" },
    ],
    comparison_tables: [
      { number: 1, title: "Copy the comparison table HTML", action: "copy", cta: "Copy Table HTML",
        description: "Ready-to-paste HTML table comparing your product vs alternatives" },
      { number: 2, title: "Add to your page", action: "info",
        description: "Paste this table in your pricing or features section. AI systems cite comparison tables when users ask 'what is the best X for Y'" },
      { number: 3, title: "Verify the table renders", action: "link", cta: "Preview Site",
        description: "Preview your page after adding",
        url: currentUrl || "#" },
    ],
    prompt_coverage: [
      { number: 1, title: "See which prompts you are missing", action: "link", cta: "Open Topic Finder",
        description: "Open Topic Finder to see exact AI prompts your content does not answer",
        url: "/dashboard" },
      { number: 2, title: "Copy suggested content additions", action: "copy", cta: "Copy Content",
        description: "Add these paragraphs to your page to cover missing prompts" },
      { number: 3, title: "Add to homepage or blog", action: "info",
        description: "Each paragraph directly answers one AI prompt. Place near the top of your page or in a dedicated 'How it works' section" },
    ],
    default: [
      { number: 1, title: "Copy the fix", action: "copy", cta: "Copy Fix",
        description: "Copy the suggested fix below" },
      { number: 2, title: "Apply to your website", action: "info",
        description: fix.description },
    ],
  };

  const steps = flows[flowType] ?? flows.default;
  const copyContent = fix.fix ?? fix.description;

  const doCopy = (stepNum: number) => {
    navigator.clipboard.writeText(copyContent).catch(() => {});
    setCopied(stepNum);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ background: "#F5F6FF", border: "1px solid #E0E2FF", borderRadius: 8,
      padding: 16, marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.05em", color: P, marginBottom: 14 }}>How to fix this</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {steps.map(step => (
          <div key={step.number} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: P,
              color: "white", fontSize: 12, fontWeight: 700, display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {step.number}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 3 }}>{step.title}</div>
              <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, marginBottom: step.action !== "info" ? 8 : 0 }}>
                {step.description}
              </div>
              {step.action === "copy" && (
                <button
                  onClick={() => doCopy(step.number)}
                  style={{ fontSize: 12, padding: "5px 12px", background: copied === step.number ? "#ECFDF5" : P,
                    color: copied === step.number ? GREEN : "white",
                    border: `1px solid ${copied === step.number ? "#A7F3D0" : P}`,
                    borderRadius: 6, cursor: "pointer", fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {copied === step.number ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> {step.cta ?? "Copy"}</>}
                </button>
              )}
              {step.action === "link" && step.url && (
                <a
                  href={step.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, padding: "5px 12px", background: "white",
                    color: P, border: `1px solid #C7D2FE`,
                    borderRadius: 6, cursor: "pointer", fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 5,
                    textDecoration: "none" }}>
                  {step.cta ?? "Open"} <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #E0E2FF",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>
          After fixing, re-run to see your score improve
        </span>
        <button
          onClick={onRerun}
          style={{ fontSize: 12, padding: "5px 12px", background: "white",
            color: P, border: `1px solid #C7D2FE`, borderRadius: 6,
            cursor: "pointer", fontWeight: 600,
            display: "inline-flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={11} /> Re-run Analysis
        </button>
      </div>
    </div>
  );
}

// ─── GEO Optimizer Tab ───────────────────────────────────────────────────────────

function GeoOptimizerTab({ domain, onTopicSelect, prefilledContent }: {
  domain: string;
  onTopicSelect?: (topic: string) => void;
  prefilledContent?: string;
}) {
  const [inputMode, setInputMode] = useState<"paste" | "url">("paste");
  const [content, setContent] = useState(prefilledContent ?? "");
  const [url, setUrl] = useState("");
  const [targetTopic, setTargetTopic] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [expandedFix, setExpandedFix] = useState<number | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState("");

  const steps = [
    "Checking factual statements...",
    "Analyzing structure and headings...",
    "Comparing with AI prompt patterns...",
    "Scoring citation readiness...",
  ];

  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const interval = setInterval(() => {
      setLoadingStep(s => (s + 1) % steps.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (prefilledContent) {
      setContent(prefilledContent);
      setInputMode("paste");
      setResult(null);
    }
  }, [prefilledContent]);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchUrl = async () => {
    if (!url.trim()) return;
    setFetchingUrl(true);
    setError(null);
    try {
      const token = getToken();
      const r = await fetch("/api/content/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setContent(json.content);
      setInputMode("paste");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch URL content.");
    } finally {
      setFetchingUrl(false);
    }
  };

  const analyze = async () => {
    const finalContent = inputMode === "url" ? "" : content;
    if (!finalContent.trim() && inputMode === "paste") { setError("Paste some content first."); return; }
    if (!targetTopic.trim()) { setError("Enter a target topic."); return; }

    setLoading(true);
    setError(null);
    setResult(null);
    setExpandedFix(null);
    setAnalyzedUrl(inputMode === "url" ? url : "");
    try {
      const token = getToken();
      const r = await fetch("/api/content/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          content: finalContent,
          targetTopic,
          sourceUrl: inputMode === "url" ? url : null,
          domain,
        }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const goodCount = result?.factors.filter(f => f.status === "good").length ?? 0;
  const warnCount = result?.factors.filter(f => f.status === "warning").length ?? 0;
  const missingCount = result?.factors.filter(f => f.status === "missing").length ?? 0;

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 2 }}>GEO Content Optimizer</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
        Optimize your content to get cited in ChatGPT, Gemini and Perplexity
      </div>

      {error && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#FEF2F2", border: "1px solid #FECACA",
          borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
          <AlertCircle size={15} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {!result && !loading && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
          {/* Input mode toggle */}
          <div style={{ display: "flex", gap: 0, marginBottom: 16, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", width: "fit-content" }}>
            {([["paste", "Paste content", <PenTool size={13} />], ["url", "Enter URL", <Link size={13} />]] as const).map(([mode, label, icon]) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                style={{ padding: "8px 16px", background: inputMode === mode ? P : "white", color: inputMode === mode ? "white" : MUTED,
                  border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {inputMode === "paste" && (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Paste your article, blog post or page content here..."
              style={{ width: "100%", minHeight: 200, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12,
                fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                color: "#374151", lineHeight: 1.6 }}
            />
          )}

          {inputMode === "url" && (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://yoursite.com/your-page"
                style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px",
                  fontSize: 13, outline: "none", color: "#374151" }}
                onKeyDown={e => e.key === "Enter" && fetchUrl()}
              />
              <button
                onClick={fetchUrl}
                disabled={fetchingUrl || !url.trim()}
                style={{ padding: "10px 16px", background: fetchingUrl ? "#C7D2FE" : "#EEF2FF", color: P,
                  border: `1px solid #C7D2FE`, borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: fetchingUrl ? "not-allowed" : "pointer", whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 6 }}
              >
                {fetchingUrl ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : null}
                {fetchingUrl ? "Fetching..." : "Fetch content"}
              </button>
            </div>
          )}

          {content && inputMode === "paste" && (
            <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
              {content.length.toLocaleString()} characters pasted
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              What topic should this content rank for in AI?
            </label>
            <input
              value={targetTopic}
              onChange={e => setTargetTopic(e.target.value)}
              placeholder="e.g. AI visibility tools, GEO optimization"
              style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px",
                fontSize: 13, outline: "none", color: "#374151", boxSizing: "border-box" }}
            />
          </div>

          <button
            onClick={analyze}
            disabled={loading}
            style={{ marginTop: 16, width: "100%", padding: "12px 0", background: P, color: "white",
              border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            Analyze for AI Citation <ArrowRight size={15} />
          </button>
        </div>
      )}

      {loading && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 40, textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: `3px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 6 }}>
            Analyzing content for AI citation readiness...
          </div>
          <div style={{ fontSize: 13, color: MUTED }}>{steps[loadingStep]}</div>
        </div>
      )}

      {result && !loading && (
        <div>

          {/* Score + factor stats */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px",
              display: "flex", alignItems: "center", gap: 24 }}>
              <ScoreGauge score={result.overallScore} label={result.scoreLabel} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: GREEN, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#374151" }}><b>{goodCount}</b> factors strong</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: AMBER, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#374151" }}><b>{warnCount}</b> could improve</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: RED, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#374151" }}><b>{missingCount}</b> missing</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => { setResult(null); setContent(""); setUrl(""); setTargetTopic(""); }}
              style={{ padding: "8px 14px", background: "white", border: `1px solid ${BORDER}`, borderRadius: 8,
                fontSize: 12, color: MUTED, cursor: "pointer", alignSelf: "flex-start",
                display: "flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={12} /> Analyze another
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Factor checklist */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", textTransform: "uppercase",
                letterSpacing: "0.06em", marginBottom: 12 }}>10 Citation Factors</div>
              {result.factors.map(f => (
                <FactorRow
                  key={f.name}
                  factor={f}
                  expanded={expandedFactors.has(f.name)}
                  onToggle={() => {
                    setExpandedFactors(prev => {
                      const next = new Set(prev);
                      next.has(f.name) ? next.delete(f.name) : next.add(f.name);
                      return next;
                    });
                  }}
                  onCopy={text => copyText(`factor-${f.name}`, text)}
                  copied={copiedKey === `factor-${f.name}`}
                />
              ))}
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Priority fixes */}
              <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 12 }}>Priority Fixes</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {result.topFixes.map((fix, i) => {
                    const impactColor = fix.impact === "high" ? RED : fix.impact === "medium" ? AMBER : MUTED;
                    const impactBg = fix.impact === "high" ? "#FEF2F2" : fix.impact === "medium" ? "#FFFBEB" : BG;
                    const isExpanded = expandedFix === i;
                    return (
                      <div key={i} style={{ border: `1px solid ${isExpanded ? "#C7D2FE" : BORDER}`, borderRadius: 8, padding: 14,
                        background: isExpanded ? "#FAFBFF" : "white", transition: "border-color 0.15s" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, background: "#EEF2FF", color: P,
                            padding: "2px 8px", borderRadius: 5 }}>Priority {fix.priority}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, background: impactBg, color: impactColor,
                            padding: "2px 8px", borderRadius: 5, textTransform: "capitalize" }}>{fix.impact} impact</span>
                          <span style={{ fontSize: 11, color: MUTED, padding: "2px 8px", background: BG,
                            borderRadius: 5 }}>{fix.timeToFix}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, background: "#ECFDF5", color: GREEN,
                            padding: "2px 8px", borderRadius: 5 }}>{fix.scoreImpact}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{fix.title}</div>
                        <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, marginBottom: 10 }}>
                          {fix.description}
                        </div>
                        <button
                          onClick={() => setExpandedFix(isExpanded ? null : i)}
                          style={{ padding: "6px 12px", background: isExpanded ? "#EEF2FF" : "white",
                            color: P, border: `1px solid #C7D2FE`,
                            borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                            display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {isExpanded ? "Hide Fix Steps" : "See Fix Steps"}
                        </button>
                        {isExpanded && (
                          <FixFlowPanel
                            fix={fix}
                            currentUrl={analyzedUrl}
                            onRerun={() => { setExpandedFix(null); analyze(); }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Missing prompts */}
              {result.missingPrompts.length > 0 && (
                <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", textTransform: "uppercase",
                    letterSpacing: "0.06em", marginBottom: 4 }}>Prompts Your Content Doesn't Answer</div>
                  <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
                    Click any prompt to open it in Topic Finder
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {result.missingPrompts.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => onTopicSelect?.(p)}
                        style={{ fontSize: 12, padding: "5px 12px", background: "#EEF2FF", color: P,
                          border: "1px solid #C7D2FE", borderRadius: 20, cursor: "pointer", fontWeight: 500 }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Competitor tips */}
              {result.competitorTips && result.competitorTips.length > 0 && (
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 8 }}>What top-ranked pages do</div>
                  {result.competitorTips.map((tip, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ color: P, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{i + 1}.</span>
                      <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI Writer Tab ───────────────────────────────────────────────────────────────

function AIWriterTab({ domain: _domain, onSendToOptimizer, onRepurpose }: {
  domain: string;
  onSendToOptimizer: (content: string) => void;
  onRepurpose: (content: string) => void;
}) {
  const [contentType, setContentType] = useState("Blog post / Article");
  const [topic, setTopic] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [tone, setTone] = useState("Professional");
  const [wordCount, setWordCount] = useState("1000 words");
  const [result, setResult] = useState<WriterResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const writerSteps = [
    "Structuring content for AI citation...",
    "Adding factual statements and statistics...",
    "Generating FAQ section...",
    "Adding schema markup...",
  ];

  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const interval = setInterval(() => setLoadingStep(s => (s + 1) % writerSteps.length), 2000);
    return () => clearInterval(interval);
  }, [loading]);

  const generate = async () => {
    if (!topic.trim()) { setError("Enter a topic."); return; }
    if (!targetKeyword.trim()) { setError("Enter a target keyword."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const token = getToken();
      const r = await fetch("/api/content/write", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ contentType, topic, targetKeyword, tone, wordCount }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyContent = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMd = () => {
    if (!result) return;
    const blob = new Blob([result.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.slice(0, 40).replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const CONTENT_TYPES = ["Blog post / Article", "Landing page", "Product description", "Comparison page (X vs Y)", "FAQ page", "How-to guide"];
  const TONES = ["Professional", "Conversational", "Technical", "Beginner-friendly"];
  const WORD_COUNTS = ["500 words", "1000 words", "1500 words", "2000 words"];

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 2 }}>AI Content Writer</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
        Write GEO-optimized content that gets cited in ChatGPT and Gemini
      </div>

      {error && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#FEF2F2", border: "1px solid #FECACA",
          borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
          <AlertCircle size={15} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {!result && !loading && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                What do you want to write?
              </label>
              <select value={contentType} onChange={e => setContentType(e.target.value)}
                style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px",
                  fontSize: 13, outline: "none", color: "#374151", background: "white", boxSizing: "border-box" }}>
                {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Tone
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TONES.map(t => (
                  <button key={t} onClick={() => setTone(t)}
                    style={{ padding: "6px 12px", background: tone === t ? P : "white",
                      color: tone === t ? "white" : "#374151", border: `1px solid ${tone === t ? P : BORDER}`,
                      borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: tone === t ? 600 : 400 }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Topic</label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. how to improve AI visibility"
              style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px",
                fontSize: 13, outline: "none", color: "#374151", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Target keyword</label>
            <input value={targetKeyword} onChange={e => setTargetKeyword(e.target.value)}
              placeholder="e.g. AI visibility tools"
              style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px",
                fontSize: 13, outline: "none", color: "#374151", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Word count</label>
            <div style={{ display: "flex", gap: 8 }}>
              {WORD_COUNTS.map(w => (
                <button key={w} onClick={() => setWordCount(w)}
                  style={{ padding: "7px 14px", background: wordCount === w ? P : "white",
                    color: wordCount === w ? "white" : "#374151", border: `1px solid ${wordCount === w ? P : BORDER}`,
                    borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: wordCount === w ? 600 : 400 }}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          <button onClick={generate}
            style={{ width: "100%", padding: "12px 0", background: P, color: "white",
              border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            Generate GEO-Optimized Content <ArrowRight size={15} />
          </button>
        </div>
      )}

      {loading && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 40, textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: `3px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Writing your GEO-optimized content...</div>
          <div style={{ fontSize: 13, color: MUTED }}>{writerSteps[loadingStep]}</div>
        </div>
      )}

      {result && !loading && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={copyContent}
              style={{ padding: "8px 14px", background: copied ? "#ECFDF5" : "white",
                color: copied ? GREEN : "#374151", border: `1px solid ${copied ? "#A7F3D0" : BORDER}`,
                borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6 }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy content"}
            </button>
            <button onClick={downloadMd}
              style={{ padding: "8px 14px", background: "white", color: "#374151",
                border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Download size={13} /> Download .md
            </button>
            <button onClick={() => onSendToOptimizer(result.content)}
              style={{ padding: "8px 14px", background: "#EEF2FF", color: P,
                border: "1px solid #C7D2FE", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              Optimize with GEO Optimizer <ArrowRight size={13} />
            </button>
            <button onClick={() => onRepurpose(result.content)}
              style={{ padding: "8px 14px", background: "white", color: "#374151",
                border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              Repurpose this <ArrowRight size={13} />
            </button>
            <button onClick={() => setResult(null)}
              style={{ padding: "8px 14px", background: "white", color: MUTED,
                border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={12} /> Write another
            </button>
          </div>

          <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8,
            padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 13, color: P }}>Want to know if this content will get cited in ChatGPT?</div>
            <button onClick={() => onSendToOptimizer(result.content)}
              style={{ padding: "7px 14px", background: P, color: "white", border: "none",
                borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              Run GEO Score <ArrowRight size={12} />
            </button>
          </div>

          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit",
              fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0 }}>
              {result.content}
            </pre>
          </div>

          {(result.metaTitle || result.schema) && (
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 10,
                textTransform: "uppercase", letterSpacing: "0.06em" }}>SEO metadata</div>
              {result.metaTitle && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>Meta title: </span>
                  <span style={{ fontSize: 12, color: "#374151" }}>{result.metaTitle}</span>
                </div>
              )}
              {result.metaDescription && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>Meta description: </span>
                  <span style={{ fontSize: 12, color: "#374151" }}>{result.metaDescription}</span>
                </div>
              )}
              {result.schema && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 4 }}>FAQPage schema markup:</div>
                  <pre style={{ fontSize: 11, background: "white", border: `1px solid ${BORDER}`, borderRadius: 6,
                    padding: 10, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#374151", margin: 0,
                    fontFamily: "monospace", maxHeight: 150, overflow: "auto" }}>
                    {result.schema}
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

// ─── Repurposer Tab ──────────────────────────────────────────────────────────────

function cleanContent(text: string | undefined): string {
  if (!text) return "";
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^[-–—]\s+/gm, "")
    .replace(/^•\s+/gm, "")
    .replace(/—/g, " ")
    .replace(/–/g, " ")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

const PLATFORM_SHARE: Record<string, {
  color: string;
  label: string;
  getUrl: (content: string, data: Record<string, unknown>) => string;
  copyHint?: string;
}> = {
  twitter: { color: "#000000", label: "Post to X",
    getUrl: (c) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(c)}` },
  linkedin: { color: "#0A66C2", label: "Post to LinkedIn",
    getUrl: (c) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(c)}` },
  linkedinarticle: { color: "#0A66C2", label: "Draft on LinkedIn",
    getUrl: () => "https://www.linkedin.com/article/new/",
    copyHint: "Opens LinkedIn. Paste your article there." },
  email: { color: "#EA4335", label: "Open in Gmail",
    getUrl: () => "https://mail.google.com/mail/?view=cm&fs=1",
    copyHint: "Opens Gmail. Paste your email there." },
  instagram: { color: "#E1306C", label: "Open Instagram",
    getUrl: () => "https://www.instagram.com/create/story/",
    copyHint: "Opens Instagram. Paste your caption there." },
  reddit: { color: "#FF4500", label: "Post to Reddit",
    getUrl: (c, d) => `https://www.reddit.com/submit?title=${encodeURIComponent((d.title as string) ?? "")}&text=${encodeURIComponent(c)}` },
  producthunt: { color: "#DA552F", label: "Submit to PH",
    getUrl: () => "https://www.producthunt.com/posts/new",
    copyHint: "Opens Product Hunt. Paste your content there." },
  hackernews: { color: "#FF6600", label: "Submit to HN",
    getUrl: (_, d) => `https://news.ycombinator.com/submitlink?t=${encodeURIComponent((d.title as string) ?? "")}&u=https://geoiqai.com` },
  indiehackers: { color: "#0057FF", label: "Post to IH",
    getUrl: () => "https://www.indiehackers.com/post/new",
    copyHint: "Opens IndieHackers. Paste your post there." },
};

const PLATFORMS = [
  { id: "twitter", label: "X / Twitter thread" },
  { id: "linkedin", label: "LinkedIn post" },
  { id: "linkedinarticle", label: "LinkedIn article" },
  { id: "email", label: "Email newsletter" },
  { id: "instagram", label: "Instagram caption" },
  { id: "reddit", label: "Reddit post" },
  { id: "producthunt", label: "Product Hunt description" },
  { id: "hackernews", label: "Hacker News Show HN post" },
  { id: "indiehackers", label: "IndieHackers post" },
];

function PlatformCard({ platformId, platformLabel, data }: {
  platformId: string;
  platformLabel: string;
  data: Record<string, unknown>;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [threadExpanded, setThreadExpanded] = useState(false);

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const CopyBtn = ({ k, text, label = "Copy" }: { k: string; text: string; label?: string }) => (
    <button onClick={() => copy(k, text)}
      style={{ padding: "5px 10px", background: copiedKey === k ? "#ECFDF5" : "white",
        color: copiedKey === k ? GREEN : MUTED, border: `1px solid ${copiedKey === k ? "#A7F3D0" : BORDER}`,
        borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 4 }}>
      {copiedKey === k ? <Check size={11} /> : <Copy size={11} />}
      {copiedKey === k ? "Copied!" : label}
    </button>
  );

  const styledBox = (text: string) => (
    <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#374151", lineHeight: 1.6,
      background: BG, borderRadius: 8, padding: 14, border: `1px solid ${BORDER}`, marginBottom: 10 }}>
      {text}
    </div>
  );

  // Twitter gets a fully custom layout - no outer card wrapper needed
  if (platformId === "twitter") {
    const tweets = (data.tweets as string[]) ?? [];
    const imageUrl = data.imageUrl as string | undefined;
    const imageData = data.imageData as string | undefined;
    const imageMime = (data.imageMime as string | undefined) ?? "image/jpeg";
    const imageSrc = imageData ? `data:${imageMime};base64,${imageData}` : imageUrl;
    const imagePlaceholder = data.imagePlaceholder as boolean | undefined;
    const allText = tweets.map((t, i) => (i === 0 ? t : `${i}/ ${t}`)).join("\n\n");
    const hookTweet = tweets[0] ?? "";
    const threadTweets = tweets.slice(1);

    return (
      <div style={{ marginBottom: 12 }}>
        {/* Main tweet preview card */}
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 14,
          overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.07)", marginBottom: 10 }}>

          {/* Card header: X branding + Share */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, background: "#000", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.254 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>X (Twitter)</div>
                <div style={{ fontSize: 11, color: MUTED }}>Hook tweet + image</div>
              </div>
            </div>
            {hookTweet && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {imageSrc && (
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = imageSrc;
                      a.download = "tweet-image.jpg";
                      a.click();
                    }}
                    style={{ padding: "7px 14px", background: "white", color: "#374151",
                      border: `1px solid ${BORDER}`, borderRadius: 20, fontSize: 12,
                      fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center",
                      gap: 5 }}>
                    <Download size={12} /> Save image
                  </button>
                )}
                <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(hookTweet)}`, "_blank")}
                  style={{ padding: "7px 16px", background: "#1DA1F2", color: "white", border: "none",
                    borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5 }}>
                  Share tweet
                </button>
              </div>
            )}
          </div>

          {/* Hook tweet text */}
          <div style={{ padding: "16px 18px 14px", fontSize: 15, color: "#111827", lineHeight: 1.7, fontWeight: 400 }}>
            {hookTweet}
          </div>

          {/* AI Image - edge to edge */}
          {imageSrc && (
            <img src={imageSrc} alt="AI-generated visual for this tweet"
              style={{ width: "100%", display: "block", maxHeight: 420, objectFit: "cover" }} />
          )}
          {!imageSrc && imagePlaceholder && (
            <div style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #2563EB 100%)",
              aspectRatio: "1.91 / 1", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 8, color: "white", padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.95 }}>AI image generates in live mode</div>
              <div style={{ fontSize: 11, opacity: 0.7, textAlign: "center", maxWidth: 240, lineHeight: 1.5 }}>
                AI creates a relevant visual based on your content
              </div>
              <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.2)",
                padding: "3px 10px", borderRadius: 20, letterSpacing: "0.05em" }}>DEMO</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: "12px 18px", borderTop: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <CopyBtn k="hook" text={hookTweet} label="Copy hook tweet" />
            {imageSrc ? (
              <span style={{ fontSize: 11, color: MUTED }}>Save image, then attach it in the tweet compose window</span>
            ) : threadTweets.length > 0 ? (
              <span style={{ fontSize: 11, color: MUTED }}>{threadTweets.length} more tweets in thread below</span>
            ) : null}
          </div>
        </div>

        {/* Full thread - collapsible */}
        {threadTweets.length > 0 && (
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <button onClick={() => setThreadExpanded(e => !e)}
              style={{ width: "100%", padding: "12px 16px", display: "flex", alignItems: "center",
                justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Full thread</span>
                <span style={{ fontSize: 11, color: MUTED }}>({threadTweets.length} more tweets)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CopyBtn k="all" text={allText} label="Copy all" />
                <ChevronDown size={14} color={MUTED}
                  style={{ transform: threadExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }} />
              </div>
            </button>
            {threadExpanded && (
              <div style={{ borderTop: `1px solid ${BORDER}` }}>
                {threadTweets.map((tweet, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "stretch",
                    borderBottom: i < threadTweets.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                    <div style={{ width: 36, flexShrink: 0, display: "flex", alignItems: "flex-start",
                      justifyContent: "center", paddingTop: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>{i + 1}/</span>
                    </div>
                    <div style={{ flex: 1, padding: "12px 0 12px", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                      {tweet}
                    </div>
                    <div style={{ padding: "10px 14px 0", flexShrink: 0 }}>
                      <CopyBtn k={`t${i + 1}`} text={tweet} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const shareInfo = PLATFORM_SHARE[platformId];

  const ShareBtn = ({ content }: { content: string }) => {
    const [hint, setHint] = useState(false);
    if (!shareInfo) return null;
    const handleClick = () => {
      const url = shareInfo.getUrl(content, data);
      if (shareInfo.copyHint) {
        navigator.clipboard.writeText(content).catch(() => {});
        setHint(true);
        setTimeout(() => setHint(false), 3000);
      }
      window.open(url, "_blank");
    };
    return (
      <div style={{ position: "relative", display: "inline-block" }}>
        <button onClick={handleClick}
          style={{ padding: "5px 12px", background: shareInfo.color, color: "white", border: "none",
            borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ExternalLink size={10} /> {shareInfo.label}
        </button>
        {hint && (
          <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
            transform: "translateX(-50%)", background: "#111827", color: "white",
            fontSize: 10, padding: "4px 8px", borderRadius: 4, whiteSpace: "nowrap", zIndex: 10 }}>
            {shareInfo.copyHint}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 14 }}>{platformLabel}</div>

      {platformId === "linkedin" && (() => {
        const hook = cleanContent(data.hook as string);
        const content = cleanContent(data.content as string);
        const charCount = content.length;
        const fullText = content || hook;
        return (
          <div>
            {hook && <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 8, lineHeight: 1.5 }}>{hook}</div>}
            {styledBox(content)}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <CopyBtn k="c" text={fullText} />
              <ShareBtn content={fullText} />
              <span style={{ fontSize: 11, color: MUTED, marginLeft: "auto" }}>{charCount} chars</span>
            </div>
          </div>
        );
      })()}

      {platformId === "linkedinarticle" && (() => {
        const title = cleanContent(data.title as string);
        const subtitle = cleanContent(data.subtitle as string);
        const content = cleanContent(data.content as string);
        const fullText = `${title}\n\n${subtitle ? subtitle + "\n\n" : ""}${content}`;
        return (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4, lineHeight: 1.4 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>{subtitle}</div>}
            {styledBox(content)}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <CopyBtn k="a" text={fullText} label="Copy full article" />
              <ShareBtn content={fullText} />
            </div>
          </div>
        );
      })()}

      {platformId === "email" && (() => {
        const subject = cleanContent(data.subject as string);
        const previewText = cleanContent(data.preview_text as string);
        const content = cleanContent(data.content as string);
        const full = `Subject: ${subject}\nPreview: ${previewText}\n\n${content}`;
        return (
          <div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 3 }}>Subject line</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{subject}</div>
            </div>
            {previewText && (
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
                <span style={{ fontWeight: 600 }}>Preview: </span>{previewText}
              </div>
            )}
            {styledBox(content)}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <CopyBtn k="email" text={full} label="Copy full email" />
              <ShareBtn content={full} />
            </div>
          </div>
        );
      })()}

      {platformId === "instagram" && (() => {
        const hook = cleanContent(data.hook as string);
        const caption = cleanContent(data.caption as string);
        const hashtags = (data.hashtags as string[]) ?? [];
        const fullCaption = `${caption || hook}\n\n${hashtags.map(t => `#${t.replace(/^#/, "")}`).join(" ")}`;
        return (
          <div>
            {hook && <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 8, lineHeight: 1.5 }}>{hook}</div>}
            {styledBox(caption || hook)}
            {hashtags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {hashtags.map((tag, i) => (
                  <span key={i} style={{ fontSize: 11, background: "#EEF2FF", color: P,
                    padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>
                    #{tag.replace(/^#/, "")}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <CopyBtn k="cap" text={caption || hook} label="Copy caption" />
              <CopyBtn k="tags" text={hashtags.map(t => `#${t.replace(/^#/, "")}`).join(" ")} label="Copy hashtags" />
              <ShareBtn content={fullCaption} />
            </div>
          </div>
        );
      })()}

      {platformId === "reddit" && (() => {
        const title = cleanContent(data.title as string);
        const content = cleanContent(data.content as string);
        const subreddits = (data.suggested_subreddits as string[]) ?? [];
        const fullPost = `${title}\n\n${content}`;
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10, lineHeight: 1.4 }}>{title}</div>
            {styledBox(content)}
            {subreddits.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {subreddits.map((sub, i) => (
                  <span key={i} style={{ fontSize: 11, background: "#FFF7ED", color: "#C2410C",
                    border: "1px solid #FED7AA", padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>
                    {sub.startsWith("r/") ? sub : `r/${sub}`}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <CopyBtn k="r" text={fullPost} label="Copy full post" />
              <ShareBtn content={content} />
            </div>
          </div>
        );
      })()}

      {platformId === "producthunt" && (() => {
        const tagline = cleanContent(data.tagline as string);
        const desc = cleanContent(data.description as string);
        const comment = cleanContent((data.first_comment ?? data.firstComment) as string);
        const topics = (data.topics as string[]) ?? [];
        const fullText = `${tagline}\n\n${desc}${comment ? `\n\nMaker comment:\n${comment}` : ""}`;
        return (
          <div>
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>Tagline: </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{tagline}</span>
              <span style={{ fontSize: 11, color: MUTED, marginLeft: 8 }}>({tagline.length}/60)</span>
            </div>
            {styledBox(desc)}
            {comment && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 4 }}>Maker comment:</div>
                {styledBox(comment)}
              </div>
            )}
            {topics.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {topics.map((t, i) => (
                  <span key={i} style={{ fontSize: 11, background: "#FFF7F5", color: "#C2410C",
                    border: "1px solid #FECACA", padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>{t}</span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <CopyBtn k="tag" text={tagline} label="Copy tagline" />
              <CopyBtn k="all" text={fullText} label="Copy all" />
              <ShareBtn content={fullText} />
            </div>
          </div>
        );
      })()}

      {platformId === "hackernews" && (() => {
        const title = cleanContent(data.title as string);
        const comment = cleanContent((data.comment ?? data.firstComment) as string);
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10,
              fontFamily: "Courier New, monospace", lineHeight: 1.4 }}>{title}</div>
            {styledBox(comment)}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <CopyBtn k="p" text={`${title}\n\n${comment}`} label="Copy full post" />
              <ShareBtn content={comment} />
            </div>
          </div>
        );
      })()}

      {platformId === "indiehackers" && (() => {
        const title = cleanContent(data.title as string);
        const content = cleanContent((data.content ?? data.body) as string);
        const fullText = `${title}\n\n${content}`;
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10, lineHeight: 1.4 }}>{title}</div>
            {styledBox(content)}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <CopyBtn k="p" text={fullText} label="Copy full post" />
              <ShareBtn content={fullText} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const PROGRESS_STEPS = [
  "Picking the core message",
  "Shortening key ideas for post format",
  "Adding context and supporting details",
  "Crafting a catchy opening line",
  "Adding hashtags, mentions, or CTA",
  "Finalizing the post draft",
];

function ProgressCard({ platformLabel, step }: { platformLabel: string; step: number }) {
  const pct = Math.min(Math.round((step / PROGRESS_STEPS.length) * 100), 95);
  return (
    <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
      border: `1px solid ${BORDER}`, padding: 20, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 3 }}>{platformLabel}</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>Crafting your post...</div>
      <div style={{ height: 5, background: "#E5E7EB", borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", background: P, width: `${pct}%`, transition: "width 0.6s ease", borderRadius: 3 }} />
      </div>
      {PROGRESS_STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontSize: 12,
            color: done ? GREEN : active ? "#111827" : "#9CA3AF", fontWeight: active ? 600 : 400 }}>
            <span style={{ width: 14, flexShrink: 0, fontSize: 13, lineHeight: 1 }}>
              {done ? "✓" : active ? "⟳" : ""}
            </span>
            {s}
          </div>
        );
      })}
    </div>
  );
}

function RepurposerTab({ domain, prefilledContent, onSendToOptimizer }: {
  domain: string;
  prefilledContent?: string;
  onSendToOptimizer: (content: string) => void;
}) {
  const [inputMode, setInputMode] = useState<"paste" | "url">("paste");
  const [pastedContent, setPastedContent] = useState(prefilledContent ?? "");
  const [url, setUrl] = useState("");
  const [fetchedData, setFetchedData] = useState<{ content: string; preview: string; domain: string } | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter", "linkedin"]);
  const [result, setResult] = useState<{ results: Record<string, Record<string, unknown>>; isMock?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState(0);

  useEffect(() => {
    if (prefilledContent) { setPastedContent(prefilledContent); setInputMode("paste"); setFetchedData(null); }
  }, [prefilledContent]);

  useEffect(() => {
    if (!loading) { setProgressStep(0); return; }
    const interval = setInterval(() => {
      setProgressStep(s => Math.min(s + 1, PROGRESS_STEPS.length - 1));
    }, 800);
    return () => clearInterval(interval);
  }, [loading]);

  const activeContent = inputMode === "url" ? (fetchedData?.content ?? "") : pastedContent;

  const togglePlatform = (id: string) =>
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const fetchUrl = async () => {
    if (!url.trim()) return;
    setFetchingUrl(true); setError(null); setFetchedData(null);
    try {
      const token = getToken();
      const r = await fetch("/api/content/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setFetchedData({ content: json.content, preview: json.preview ?? json.content.slice(0, 100), domain: json.sourceDomain ?? url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch URL content.");
    } finally { setFetchingUrl(false); }
  };

  const repurpose = async () => {
    if (!activeContent.trim()) {
      setError(inputMode === "url" ? "Fetch an article URL first." : "Paste some content first.");
      return;
    }
    if (selectedPlatforms.length === 0) { setError("Select at least one platform."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const token = getToken();
      const r = await fetch("/api/content/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: activeContent, domain, platforms: selectedPlatforms }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Repurposing failed. Please try again.");
    } finally { setLoading(false); }
  };

  const canRepurpose = activeContent.trim().length > 0 && selectedPlatforms.length > 0;

  return (
    <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", minHeight: 560 }}>

      {/* LEFT PANEL - form */}
      <div style={{ width: 340, flexShrink: 0, background: "white", borderRight: `1px solid ${BORDER}`,
        padding: 20, display: "flex", flexDirection: "column", gap: 0, overflowY: "auto" }}>

        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 2 }}>Content Multiplier</div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 18 }}>
          Turn any article into threads, posts, emails and more
        </div>

        {error && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FEF2F2",
            border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", fontSize: 12,
            color: "#991B1B", marginBottom: 14 }}>
            <AlertCircle size={13} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}

        {/* Input mode toggle */}
        <div style={{ display: "flex", gap: 0, marginBottom: 12, border: `1px solid ${BORDER}`,
          borderRadius: 8, overflow: "hidden" }}>
          {(["paste", "url"] as const).map(mode => (
            <button key={mode} onClick={() => { setInputMode(mode); setError(null); }}
              style={{ flex: 1, padding: "8px 0", background: inputMode === mode ? P : "white",
                color: inputMode === mode ? "white" : MUTED, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center",
                justifyContent: "center", gap: 5 }}>
              {mode === "paste" ? <PenTool size={12} /> : <Link size={12} />}
              {mode === "paste" ? "Paste text" : "Article URL"}
            </button>
          ))}
        </div>

        {/* Paste mode */}
        {inputMode === "paste" && (
          <textarea value={pastedContent} onChange={e => setPastedContent(e.target.value)}
            placeholder="Paste your article or blog post here..."
            style={{ width: "100%", minHeight: 140, border: `1px solid ${BORDER}`, borderRadius: 8,
              padding: 10, fontSize: 12, resize: "vertical", outline: "none", boxSizing: "border-box",
              fontFamily: "inherit", color: "#374151", lineHeight: 1.6, marginBottom: 14 }} />
        )}

        {/* URL mode */}
        {inputMode === "url" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: fetchedData ? 10 : 0 }}>
              <input value={url} onChange={e => { setUrl(e.target.value); setFetchedData(null); }}
                placeholder="https://yoursite.com/article"
                style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 11px",
                  fontSize: 12, outline: "none", color: "#374151", minWidth: 0 }}
                onKeyDown={e => e.key === "Enter" && fetchUrl()} />
              <button onClick={fetchUrl} disabled={fetchingUrl || !url.trim()}
                style={{ padding: "9px 12px", background: P, color: "white", border: "none",
                  borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: fetchingUrl || !url.trim() ? "not-allowed" : "pointer", opacity: !url.trim() ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                {fetchingUrl
                  ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />
                  : <Link size={12} />}
                {fetchingUrl ? "Fetching..." : "Fetch"}
              </button>
            </div>

            {fetchedData && (
              <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Check size={13} color={GREEN} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#065F46" }}>
                    Content fetched from {fetchedData.domain}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#047857", lineHeight: 1.5 }}>
                  "{fetchedData.preview}{fetchedData.preview.length >= 100 ? "..." : ""}"
                </div>
                <button onClick={() => { setFetchedData(null); setUrl(""); }}
                  style={{ marginTop: 8, fontSize: 11, color: MUTED, background: "none", border: "none",
                    cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                  Clear and try another URL
                </button>
              </div>
            )}
          </div>
        )}

        {/* Platforms */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            Platforms
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PLATFORMS.map(p => (
              <label key={p.id}
                style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", padding: "5px 10px",
                  border: `1px solid ${selectedPlatforms.includes(p.id) ? P : BORDER}`, borderRadius: 20,
                  background: selectedPlatforms.includes(p.id) ? "#EEF2FF" : "white",
                  fontSize: 11, color: selectedPlatforms.includes(p.id) ? P : "#374151",
                  fontWeight: selectedPlatforms.includes(p.id) ? 600 : 400 }}>
                <input type="checkbox" checked={selectedPlatforms.includes(p.id)}
                  onChange={() => togglePlatform(p.id)} style={{ display: "none" }} />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        {/* Repurpose button */}
        <button onClick={repurpose} disabled={!canRepurpose || loading}
          style={{ width: "100%", padding: "11px 0", background: canRepurpose && !loading ? P : "#9CA3AF",
            color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: canRepurpose && !loading ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          {loading
            ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Repurposing...</>
            : <>Repurpose for {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? "s" : ""} <ArrowRight size={14} /></>
          }
        </button>

        {result && !loading && (
          <button onClick={() => { setResult(null); setProgressStep(0); }}
            style={{ marginTop: 10, width: "100%", padding: "9px 0", background: "white",
              color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <RefreshCw size={12} /> Repurpose again
          </button>
        )}
      </div>

      {/* RIGHT PANEL - canvas */}
      <div style={{ flex: 1, background: "#f8f8f8",
        backgroundImage: "radial-gradient(circle, #d0d0d0 1px, transparent 1px)",
        backgroundSize: "24px 24px", padding: 20, overflowY: "auto" }}>

        {/* Empty state */}
        {!loading && !result && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: "100%", minHeight: 400 }}>
            <div style={{ width: 48, height: 48, background: "white", borderRadius: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Repeat2 size={22} color={MUTED} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Your repurposed content will appear here
            </div>
            <div style={{ fontSize: 12, color: MUTED, textAlign: "center", maxWidth: 220, lineHeight: 1.5 }}>
              Add your content on the left, pick platforms, and hit Repurpose
            </div>
          </div>
        )}

        {/* Progress cards */}
        {loading && (
          <div>
            {selectedPlatforms.map(pid => {
              const plat = PLATFORMS.find(p => p.id === pid);
              if (!plat) return null;
              return <ProgressCard key={pid} platformLabel={plat.label} step={progressStep} />;
            })}
          </div>
        )}

        {/* Result cards */}
        {result && !loading && (
          <div>
            <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8,
              padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center",
              justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 12, color: P }}>Want to check if the original content gets cited in ChatGPT?</div>
              <button onClick={() => onSendToOptimizer(activeContent)}
                style={{ padding: "6px 12px", background: P, color: "white", border: "none",
                  borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                Run GEO Score <ArrowRight size={11} />
              </button>
            </div>
            {selectedPlatforms.map(pid => {
              const plat = PLATFORMS.find(p => p.id === pid);
              const d = result.results[pid] as Record<string, unknown>;
              if (!plat || !d) return null;
              return <PlatformCard key={pid} platformId={pid} platformLabel={plat.label} data={d} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Topic Finder Tab ────────────────────────────────────────────────────────────

function TopicFinderTab({ domain, prefilledTopic, onOptimize, onNavigate }: {
  domain: string;
  prefilledTopic?: string;
  onOptimize: (topic: string) => void;
  onNavigate?: (nav: string) => void;
}) {
  const [data, setData] = useState<TopicsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const r = await fetch(`/api/content/topics?domain=${encodeURIComponent(domain)}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load topics.");
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED }}>
      <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 14 }}>Loading topic suggestions...</span>
    </div>
  );

  if (error) return (
    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: 16, color: "#991B1B", fontSize: 13 }}>
      {error}
    </div>
  );

  const sectionTitle = (label: string, badge: string, badgeColor: string, badgeBg: string, desc: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, background: badgeBg, color: badgeColor,
        padding: "3px 10px", borderRadius: 20 }}>{badge}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{label}</div>
        <div style={{ fontSize: 12, color: MUTED }}>{desc}</div>
      </div>
    </div>
  );

  const emptySection = (msg: string, linkLabel: string, navTarget?: string) => (
    <div style={{ padding: "20px", textAlign: "center", background: BG, borderRadius: 8 }}>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>{msg}</div>
      {navTarget && onNavigate ? (
        <button
          onClick={() => onNavigate(navTarget)}
          style={{ fontSize: 12, color: P, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
        >
          {linkLabel}
        </button>
      ) : (
        <div style={{ fontSize: 12, color: P, fontWeight: 600 }}>{linkLabel}</div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Prompt Gap Finder</div>
        <button onClick={load} style={{ padding: "5px 10px", background: "white", border: `1px solid ${BORDER}`,
          borderRadius: 6, fontSize: 12, color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
        Topics to write about to improve your AI visibility score
      </div>

      {data?.isMock && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FFFBEB",
          border: "1px solid #FDE68A", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600,
          color: "#92400E", marginBottom: 12 }}>
          Demo data - run scans to see real suggestions
        </div>
      )}

      {prefilledTopic && (
        <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "10px 14px",
          fontSize: 13, color: P, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Search size={14} />
          Showing results related to: <b>{prefilledTopic}</b>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Section A: Write These First */}
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
          {sectionTitle("Write These First", "Gap", RED, "#FEF2F2", "Competitor cited here - you are not")}
          {data?.writeThese?.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Topic", "AI Volume", "Competitor cited", "Action"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 600,
                      color: MUTED, borderBottom: `1px solid ${BORDER}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.writeThese.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "10px", fontSize: 13, color: "#374151", fontWeight: 500 }}>{row.topic}</td>
                    <td style={{ padding: "10px", fontSize: 13, fontWeight: 600, color: "#111827" }}>{row.aiVolume}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ fontSize: 12, background: "#FEF2F2", color: RED, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>
                        {row.competitor}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <button
                        onClick={() => onOptimize(row.topic)}
                        style={{ fontSize: 12, padding: "5px 10px", background: "#EEF2FF", color: P,
                          border: "1px solid #C7D2FE", borderRadius: 6, cursor: "pointer", fontWeight: 600,
                          display: "flex", alignItems: "center", gap: 4 }}
                      >
                        Write article <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : emptySection(
            "Run Brand Benchmarks with a competitor to see where gaps exist.",
            "Go to Brand Benchmarks",
            "competitor-research"
          )}
        </div>

        {/* Section B: Improve These */}
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
          {sectionTitle("Improve These", "Weak", AMBER, "#FFFBEB", "You appear but can rank higher")}
          {data?.improveThese?.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Topic", "AI Volume", "Your mentions", "Action"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 600,
                      color: MUTED, borderBottom: `1px solid ${BORDER}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.improveThese.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "10px", fontSize: 13, color: "#374151", fontWeight: 500 }}>{row.topic}</td>
                    <td style={{ padding: "10px", fontSize: 13, fontWeight: 600, color: "#111827" }}>{row.aiVolume}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ fontSize: 12, background: "#FFFBEB", color: AMBER, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>
                        {row.yourMentions} mentions
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <button
                        onClick={() => onOptimize(row.topic)}
                        style={{ fontSize: 12, padding: "5px 10px", background: "#EEF2FF", color: P,
                          border: "1px solid #C7D2FE", borderRadius: 6, cursor: "pointer", fontWeight: 600,
                          display: "flex", alignItems: "center", gap: 4 }}
                      >
                        Optimize <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : emptySection(
            "Run Prompt Intelligence first to find topics where you have weak visibility.",
            "Go to Prompt Intelligence",
            "prompt-research"
          )}
        </div>

        {/* Section C: Brand Questions */}
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
          {sectionTitle("Brand Questions", "Brand", P, "#EEF2FF", "Questions people ask AI about your brand")}
          {data?.brandQuestions?.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Question", "Your rank", "Action"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 600,
                      color: MUTED, borderBottom: `1px solid ${BORDER}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.brandQuestions.map((row, i) => {
                  const rankColor = row.yourRank === "Not ranked" ? RED : GREEN;
                  const rankBg = row.yourRank === "Not ranked" ? "#FEF2F2" : "#ECFDF5";
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: "10px", fontSize: 13, color: "#374151" }}>{row.question}</td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ fontSize: 12, background: rankBg, color: rankColor, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>
                          {row.yourRank}
                        </span>
                      </td>
                      <td style={{ padding: "10px" }}>
                        <button
                          onClick={() => onOptimize(row.question)}
                          style={{ fontSize: 12, padding: "5px 10px", background: "#EEF2FF", color: P,
                            border: "1px solid #C7D2FE", borderRadius: 6, cursor: "pointer", fontWeight: 600,
                            display: "flex", alignItems: "center", gap: 4 }}
                        >
                          Create page <ExternalLink size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : emptySection(
            "Run Brand Benchmarks first to see questions people ask AI about your brand.",
            "Go to Brand Benchmarks",
            "competitor-research"
          )}
        </div>
      </div>
    </div>
  );
}

// ─── My Content Tab ──────────────────────────────────────────────────────────────

function MyContentTab({ domain, onReanalyze }: {
  domain: string;
  onReanalyze: (sourceUrl: string | null, topic: string) => void;
}) {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const r = await fetch("/api/content/analyses", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setAnalyses(json.analyses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analyses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED }}>
      <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 14 }}>Loading saved analyses...</span>
    </div>
  );

  if (error) return (
    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: 16, color: "#991B1B", fontSize: 13 }}>
      {error}
    </div>
  );

  const scoreColor = (s: number) => s >= 81 ? GREEN : s >= 61 ? "#10B981" : s >= 41 ? AMBER : RED;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Content Library</div>
        <button onClick={load} style={{ padding: "5px 10px", background: "white", border: `1px solid ${BORDER}`,
          borderRadius: 6, fontSize: 12, color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Saved content analyses and briefs</div>

      {analyses.length === 0 ? (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEF2FF", margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bookmark size={22} color={P} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No content analyzed yet</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
            Use GEO Optimizer to analyze your first page and see results here.
          </div>
          <button
            onClick={() => onReanalyze(null, "")}
            style={{ padding: "10px 20px", background: P, color: "white", border: "none",
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Analyze content
          </button>
        </div>
      ) : (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: BG }}>
                {["Page / URL", "Topic", "Score", "Top Fix", "Analyzed", "Action"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600,
                    color: MUTED, borderBottom: `1px solid ${BORDER}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analyses.map((a) => {
                const topFix = (a.topFixes as TopFix[])[0];
                const date = new Date(a.analyzedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
                const sc = scoreColor(a.score);
                return (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: MUTED, maxWidth: 160 }}>
                      {a.sourceUrl ? (
                        <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color: P, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                          <ExternalLink size={11} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120, display: "inline-block" }}>
                            {a.sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}
                          </span>
                        </a>
                      ) : (
                        <span>Pasted content</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "#374151", maxWidth: 160 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {a.targetTopic}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: sc }}>{a.score}</span>
                      <span style={{ fontSize: 11, color: MUTED }}>/100</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151", maxWidth: 200 }}>
                      {topFix ? (
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {topFix.title}
                        </span>
                      ) : "-"}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>{date}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <button
                        onClick={() => onReanalyze(a.sourceUrl, a.targetTopic)}
                        style={{ fontSize: 12, padding: "5px 10px", background: "#EEF2FF", color: P,
                          border: "1px solid #C7D2FE", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
                      >
                        Re-analyze
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────────

type TabId = "optimizer" | "writer" | "repurposer" | "topics" | "content";

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "optimizer", label: "Citation Optimizer", icon: <PenTool size={13} /> },
  { id: "writer", label: "GEO Writer", icon: <Wand2 size={13} /> },
  { id: "repurposer", label: "Content Multiplier", icon: <Repeat2 size={13} /> },
  { id: "topics", label: "Prompt Gap Finder", icon: <Search size={13} /> },
  { id: "content", label: "Content Library", icon: <Bookmark size={13} /> },
];

export function ContentCreation({ domain, onNavigate }: { domain: string; onNavigate?: (nav: string) => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("optimizer");
  const [prefilledTopic, setPrefilledTopic] = useState<string | undefined>();
  const [optimizerTopic, setOptimizerTopic] = useState("");
  const [optimizerUrl, setOptimizerUrl] = useState<string | null>(null);
  const [optimizerContent, setOptimizerContent] = useState<string | undefined>();
  const [repurposerContent, setRepurposerContent] = useState<string | undefined>();

  const handleTopicSelect = (topic: string) => {
    setPrefilledTopic(topic);
    setActiveTab("topics");
  };

  const handleOptimize = (topic: string) => {
    setOptimizerTopic(topic);
    setActiveTab("optimizer");
  };

  const handleReanalyze = (sourceUrl: string | null, topic: string) => {
    setOptimizerUrl(sourceUrl);
    setOptimizerTopic(topic);
    setActiveTab("optimizer");
  };

  const handleSendToOptimizer = (content: string) => {
    setOptimizerContent(content);
    setActiveTab("optimizer");
  };

  const handleRepurpose = (content: string) => {
    setRepurposerContent(content);
    setActiveTab("repurposer");
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Content Creation</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
        Create and optimize content to get cited in ChatGPT, Gemini and Perplexity
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `2px solid ${BORDER}`, overflowX: "auto" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? P : MUTED,
              borderBottom: `2px solid ${activeTab === tab.id ? P : "transparent"}`,
              marginBottom: -2, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            }}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "optimizer" && (
        <GeoOptimizerTab
          domain={domain}
          onTopicSelect={handleTopicSelect}
          prefilledContent={optimizerContent}
        />
      )}
      {activeTab === "writer" && (
        <AIWriterTab
          domain={domain}
          onSendToOptimizer={handleSendToOptimizer}
          onRepurpose={handleRepurpose}
        />
      )}
      {activeTab === "repurposer" && (
        <RepurposerTab
          domain={domain}
          prefilledContent={repurposerContent}
          onSendToOptimizer={handleSendToOptimizer}
        />
      )}
      {activeTab === "topics" && (
        <TopicFinderTab
          domain={domain}
          prefilledTopic={prefilledTopic}
          onOptimize={handleOptimize}
          onNavigate={onNavigate}
        />
      )}
      {activeTab === "content" && (
        <MyContentTab
          domain={domain}
          onReanalyze={handleReanalyze}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

