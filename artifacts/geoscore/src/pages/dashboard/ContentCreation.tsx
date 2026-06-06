import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/auth";
import {
  FileText, Link, ChevronDown, ChevronRight, Copy, Check,
  AlertCircle, ArrowRight, RefreshCw, Loader2, ExternalLink,
  PenTool, Search, Bookmark,
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

// ─── GEO Optimizer Tab ───────────────────────────────────────────────────────────

function GeoOptimizerTab({ domain, onTopicSelect }: {
  domain: string;
  onTopicSelect?: (topic: string) => void;
}) {
  const [inputMode, setInputMode] = useState<"paste" | "url">("paste");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [targetTopic, setTargetTopic] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

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
          {result.isMock && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FFFBEB",
              border: "1px solid #FDE68A", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600,
              color: "#92400E", marginBottom: 12 }}>
              Demo analysis - paste real content for actual results
            </div>
          )}

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
                    return (
                      <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
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
                        <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, marginBottom: fix.fix ? 10 : 0 }}>
                          {fix.description}
                        </div>
                        {fix.fix && (
                          <button
                            onClick={() => copyText(`fix-${i}`, fix.fix!)}
                            style={{ padding: "6px 12px", background: copiedKey === `fix-${i}` ? "#ECFDF5" : "#EEF2FF",
                              color: copiedKey === `fix-${i}` ? GREEN : P, border: `1px solid ${copiedKey === `fix-${i}` ? "#A7F3D0" : "#C7D2FE"}`,
                              borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 5 }}
                          >
                            {copiedKey === `fix-${i}` ? <Check size={12} /> : <Copy size={12} />}
                            {copiedKey === `fix-${i}` ? "Copied!" : "Copy Fix"}
                          </button>
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

// ─── Topic Finder Tab ────────────────────────────────────────────────────────────

function TopicFinderTab({ domain, prefilledTopic, onOptimize }: {
  domain: string;
  prefilledTopic?: string;
  onOptimize: (topic: string) => void;
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

  const emptySection = (msg: string, linkLabel: string) => (
    <div style={{ padding: "20px", textAlign: "center", background: BG, borderRadius: 8 }}>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>{msg}</div>
      <div style={{ fontSize: 12, color: P, fontWeight: 600 }}>{linkLabel}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Topic Finder</div>
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
            "Run Brand Performance with competitors to see where gaps exist.",
            "Go to Brand Performance to start"
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
            "Run Prompt Research first to find topics where you have weak visibility.",
            "Go to Prompt Research to start"
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
            "Run Brand Performance first to see questions people ask AI about your brand.",
            "Go to Brand Performance to start"
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
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>My Content</div>
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

type TabId = "optimizer" | "topics" | "content";

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "optimizer", label: "GEO Optimizer", icon: <PenTool size={13} /> },
  { id: "topics", label: "Topic Finder", icon: <Search size={13} /> },
  { id: "content", label: "My Content", icon: <Bookmark size={13} /> },
];

export function ContentCreation({ domain }: { domain: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("optimizer");
  const [prefilledTopic, setPrefilledTopic] = useState<string | undefined>();
  const [optimizerTopic, setOptimizerTopic] = useState("");
  const [optimizerUrl, setOptimizerUrl] = useState<string | null>(null);

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

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Content Creation</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
        Create and optimize content to get cited in ChatGPT, Gemini and Perplexity
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `2px solid ${BORDER}` }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? P : MUTED,
              borderBottom: `2px solid ${activeTab === tab.id ? P : "transparent"}`,
              marginBottom: -2, display: "flex", alignItems: "center", gap: 6,
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
        />
      )}
      {activeTab === "topics" && (
        <TopicFinderTab
          domain={domain}
          prefilledTopic={prefilledTopic}
          onOptimize={handleOptimize}
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
