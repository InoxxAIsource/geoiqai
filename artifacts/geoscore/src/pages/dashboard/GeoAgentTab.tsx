import { useState, useEffect, useRef } from "react";
import { Send, Bot, Copy } from "lucide-react";
import { AgentVisual } from "./AgentVisuals";
import {
  detectVisualType,
  type VisualType,
  type VisualData,
  type TrendPoint,
  type KeywordEntry,
  type FixAction,
  type CitationData,
  type TechnicalCheck,
  type AuditToolResult,
  type CompetitorEntry,
} from "./agent-visual-utils";

// ─── StreamingText component ─────────────────────────────────────────────────

function StreamingText({ text, onDone }: { text: string; onDone: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    setDisplayed("");
    doneRef.current = false;
    let i = 0;
    const CHUNK = 4;
    const INTERVAL = 14;
    const timer = setInterval(() => {
      i += CHUNK;
      if (i >= text.length) {
        setDisplayed(text);
        doneRef.current = true;
        clearInterval(timer);
        onDone();
      } else {
        setDisplayed(text.slice(0, i));
      }
    }, INTERVAL);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <>
      <style>{`
        @keyframes geo-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      <span style={{ whiteSpace: "pre-wrap" }}>
        {displayed}
        {!doneRef.current && (
          <span style={{ display: "inline-block", width: 2, height: "1em", background: "#4F46E5", marginLeft: 1, verticalAlign: "text-bottom", animation: "geo-cursor-blink 0.7s infinite" }} />
        )}
      </span>
    </>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Brand {
  id: string;
  domain: string;
  brandName: string | null;
  category: string | null;
  latestScore: number | null;
  latestScoreChatgpt: number | null;
  latestScoreGemini: number | null;
  latestScorePerplexity: number | null;
}

interface ToolUsed {
  name: string;
  input: Record<string, unknown>;
  domain?: string;
}

interface Message {
  role: "user" | "agent";
  content: string;
  isLoading?: boolean;
  isStreaming?: boolean;
  visualType?: VisualType | null;
  triggerUserMsg?: string;
  followUpChips?: string[];
  toolsUsed?: ToolUsed[];
  auditToolResult?: AuditToolResult;
}

const STARTER_LIMIT = 50;

// ─── Thinking message sets ────────────────────────────────────────────────────

const THINKING_SETS: Record<string, string[]> = {
  audit: [
    "Running live audit on {domain}...",
    "Crawling the website...",
    "Querying ChatGPT, Gemini, Perplexity...",
    "Running technical checks...",
    "Calculating GEO IQ score...",
    "Audit complete. Analyzing results...",
  ],
  score: [
    "Analyzing {brand} visibility data...",
    "Checking AI system responses...",
    "Calculating score breakdown...",
    "Reviewing keyword gaps...",
  ],
  competitor: [
    "Comparing mention rates...",
    "Finding competitor citations...",
    "Calculating gap to leader...",
    "Building competitive analysis...",
  ],
  blog: [
    "Researching {brand}'s top keywords...",
    "Structuring for AI citability...",
    "Applying GEO content framework...",
    "Optimizing for {category} queries...",
  ],
  tweet: [
    "Writing for {brand} audience...",
    "Crafting 3 different angles...",
    "Checking character limits...",
    "Adding authentic voice...",
  ],
  technical: [
    "Reading latest audit data...",
    "Checking crawler access...",
    "Reviewing schema signals...",
    "Calculating technical score...",
  ],
  keyword: [
    "Loading keyword data...",
    "Finding AI-specific opportunities...",
    "Filtering by search intent...",
    "Prioritizing by GEO impact...",
  ],
  citation: [
    "Scanning citation sources...",
    "Mapping competitor mentions...",
    "Finding submission targets...",
    "Calculating citation gap...",
  ],
  planning: [
    "Building content strategy...",
    "Mapping your week...",
    "Matching to your keywords...",
    "Creating your GEO roadmap...",
  ],
  geo_file: [
    "Loading brand data from database...",
    "Generating file content...",
    "Applying GEO best practices...",
    "File ready.",
  ],
  default: [
    "Thinking about {brand}...",
    "Analyzing your GEO data...",
    "Building your response...",
    "Applying GEO framework...",
  ],
};

function getThinkingKey(msg: string): string {
  const m = msg.toLowerCase();
  if (
    m.includes("audit") || m.includes("scan") || m.includes("run a check") ||
    m.includes("fresh audit") || m.includes("re-check") || m.includes("re-audit") ||
    m.includes("check notion") || m.includes("check linear") ||
    (m.includes("check") && (m.includes(".com") || m.includes(".io") || m.includes(".in")))
  ) return "audit";
  if (m.includes("blog") || m.includes("article") || m.includes("write post") || m.includes("blog post")) return "blog";
  if (m.includes("tweet") || m.includes("twitter") || m.includes("social media") || m.includes("social post")) return "tweet";
  if (m.includes("llms.txt") || m.includes("robots.txt") || m.includes("schema json") || m.includes("generate my") || m.includes("generate the")) return "geo_file";
  if (m.includes("technical") || m.includes("robots") || m.includes("setup") || m.includes("crawl") || m.includes("llms") || m.includes("schema")) return "technical";
  if (m.includes("keyword") || m.includes("target") || m.includes("rank for")) return "keyword";
  if (m.includes("citation") || m.includes("cited") || m.includes("listed") || m.includes("sources")) return "citation";
  if (m.includes("plan") || m.includes("calendar") || m.includes("week") || m.includes("schedule")) return "planning";
  if (m.includes("competitor") || m.includes("compare") || m.includes(" vs ") || m.includes("beating")) return "competitor";
  if (m.includes("score") || m.includes("low") || m.includes("why") || m.includes("visibility") || m.includes("performance")) return "score";
  return "default";
}

// ─── Follow-up chip sets ──────────────────────────────────────────────────────

const CHIP_SETS: Record<string, string[]> = {
  after_score: ["Write the article it mentioned", "Show competitor comparison", "Generate my FAQ page", "What should I fix first?"],
  after_competitor: ["Close the biggest gap", "Write content to compete", "Show their citation sources", "Build my week plan"],
  after_citations: ["Write my Crunchbase description", "Generate Product Hunt listing", "Write pitch email", "Show submission URLs"],
  after_blog: ["Copy for Medium", "Copy for dev.to", "Write shorter version", "Generate tweets from this"],
  after_tweets: ["Rewrite for LinkedIn", "Generate 3 more options", "Make these shorter", "Plan content calendar"],
  after_calendar: ["Generate Monday content", "Generate all 7 days now", "Focus on top keywords", "Build content schedule"],
  after_technical: ["Generate robots.txt fix", "Write my llms.txt file", "Generate Schema JSON", "Highest impact fix first?"],
  after_keywords: ["Write article for top keyword", "Generate FAQ content", "Build content around this", "Show search intent"],
  after_priorities: ["Write the first action now", "Generate Crunchbase listing", "Create Product Hunt listing", "Start with citations"],
  default: ["Why is my score low?", "Write me a tweet", "Plan my content this week", "Check my technical setup"],
};

function getFollowUpChips(userMsg: string, agentResponse: string): string[] {
  const msg = userMsg.toLowerCase();
  const resp = agentResponse.toLowerCase();
  if (resp.includes("tweet 1") || resp.includes("tweet 2")) return CHIP_SETS.after_tweets;
  if (resp.length > 800 && (resp.includes("## ") || resp.includes("breakfast") || resp.includes("introduction\n") || resp.includes("eeat score"))) return CHIP_SETS.after_blog;
  if (resp.includes("monday") || resp.includes("tuesday") || resp.includes("next 7 days")) return CHIP_SETS.after_calendar;
  if (msg.includes("score") || msg.includes("low") || msg.includes("why") || msg.includes("visibility") || msg.includes("performance")) return CHIP_SETS.after_score;
  if (msg.includes("competitor") || msg.includes("compare") || msg.includes(" vs ") || msg.includes("beating")) return CHIP_SETS.after_competitor;
  if (msg.includes("citation") || msg.includes("cited") || msg.includes("listed") || msg.includes("sources")) return CHIP_SETS.after_citations;
  if (msg.includes("technical") || msg.includes("robots") || msg.includes("setup") || msg.includes("schema") || msg.includes("llms")) return CHIP_SETS.after_technical;
  if (msg.includes("keyword") || msg.includes("target") || msg.includes("rank for")) return CHIP_SETS.after_keywords;
  if (msg.includes("plan") || msg.includes("calendar") || msg.includes("week") || msg.includes("schedule")) return CHIP_SETS.after_calendar;
  if (msg.includes("first") || msg.includes("priority") || msg.includes("should i") || msg.includes("improve") || msg.includes("fix") || msg.includes("action")) return CHIP_SETS.after_priorities;
  return CHIP_SETS.default;
}

// ─── ThinkingIndicator component ──────────────────────────────────────────────

function extractDomainFromMsg(msg: string): string {
  const match = msg.match(/([a-zA-Z0-9-]+\.(com|io|in|co|ai|app|net|org)(\.[a-z]{2})?)/);
  return match ? match[1] : "";
}

function ThinkingIndicator({ triggerMsg, brandName, category }: {
  triggerMsg: string;
  brandName: string;
  category: string;
}) {
  const key = getThinkingKey(triggerMsg);
  const rawMessages = THINKING_SETS[key] ?? THINKING_SETS.default;
  const detectedDomain = extractDomainFromMsg(triggerMsg);
  const filledMessages = rawMessages.map(m =>
    m
      .replace("{brand}", brandName)
      .replace("{category}", category)
      .replace("{domain}", detectedDomain || brandName)
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [textVisible, setTextVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setTextVisible(false);
      setTimeout(() => {
        setCurrentIdx(i => (i + 1) % filledMessages.length);
        setTextVisible(true);
      }, 300);
    }, 1800);
    return () => clearInterval(timer);
  }, [filledMessages.length]);

  return (
    <div style={{
      background: "white",
      border: "1px solid #E5E7EB",
      borderRadius: 12,
      padding: "14px 18px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      minWidth: 220,
    }}>
      <style>{`
        @keyframes geo-dot-pulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.35; }
          40% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
        {[0, 1, 2].map(j => (
          <div
            key={j}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#4F46E5",
              animation: "geo-dot-pulse 1.2s infinite",
              animationDelay: `${j * 0.15}s`,
            }}
          />
        ))}
      </div>
      <div style={{
        fontSize: 13,
        color: "#6B7280",
        fontStyle: "italic",
        opacity: textVisible ? 1 : 0,
        transition: "opacity 0.3s ease",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {filledMessages[currentIdx]}
      </div>
    </div>
  );
}

// ─── FollowUpChips component ──────────────────────────────────────────────────

function FollowUpChips({ chips, onChipClick }: { chips: string[]; onChipClick: (msg: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div style={{
      display: "flex",
      gap: 8,
      overflowX: "auto",
      padding: "8px 0 4px 36px",
      msOverflowStyle: "none",
      scrollbarWidth: "none",
    } as React.CSSProperties}>
      {chips.map((chip, i) => (
        <button
          key={chip}
          onClick={() => onChipClick(chip)}
          style={{
            flexShrink: 0,
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 20,
            padding: "6px 14px",
            fontSize: 12,
            color: "#374151",
            cursor: "pointer",
            whiteSpace: "nowrap",
            opacity: mounted ? 1 : 0,
            transition: `opacity 0.2s ease ${i * 60}ms, background 0.15s, border-color 0.15s, color 0.15s`,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "#EEF2FF";
            e.currentTarget.style.borderColor = "#4F46E5";
            e.currentTarget.style.color = "#4F46E5";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.borderColor = "#E5E7EB";
            e.currentTarget.style.color = "#374151";
          }}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

// ─── Main GeoAgentTab component ───────────────────────────────────────────────

export function GeoAgentTab({
  brand,
  plan,
  lineChartData,
  keywords,
  fixActions,
  citationData,
  competitorDisplayName,
  weekChange,
}: {
  brand: Brand;
  plan: string;
  lineChartData: TrendPoint[];
  keywords: KeywordEntry[];
  fixActions: FixAction[];
  citationData: CitationData;
  competitorDisplayName: string;
  weekChange: number | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [briefingDone, setBriefingDone] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(plan === "starter" ? STARTER_LIMIT : null);
  const [limitReached, setLimitReached] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [apiKeywords, setApiKeywords] = useState<KeywordEntry[]>([]);
  const [apiTechnicalChecks, setApiTechnicalChecks] = useState<TechnicalCheck[]>([]);
  const [apiTechnicalScore, setApiTechnicalScore] = useState<number | undefined>(undefined);
  const [apiCheckedAt, setApiCheckedAt] = useState<string | null>(null);
  const [apiCompetitorData, setApiCompetitorData] = useState<{ comparison: CompetitorEntry[] } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const brandName = brand.brandName ?? brand.domain ?? "Brand";
  const category = brand.category ?? "startup";

  // Find the index of the last non-loading agent message (for chip placement)
  const lastAgentIdx = messages.reduce((acc, m, i) => (m.role === "agent" && !m.isLoading && m.content ? i : acc), -1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (briefingDone || messages.length > 0) return;
    const fetchBriefing = async () => {
      setMessages([{ role: "agent", content: "", isLoading: true, triggerUserMsg: "" }]);
      try {
        const token = localStorage.getItem("geoscore_token");
        const res = await fetch("/api/agent/briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ brandId: brand.id }),
        });
        if (!res.ok) throw new Error("Failed to load briefing");
        const data = (await res.json()) as { briefing: string };
        setMessages([{
          role: "agent",
          content: data.briefing,
          isStreaming: true,
          followUpChips: CHIP_SETS.default,
        }]);
        setBriefingDone(true);
      } catch {
        setMessages([{
          role: "agent",
          content: `Hey - I'm your GEO Agent for ${brandName}. Your current score is ${brand.latestScore ?? 0}/100 across ChatGPT, Gemini, and Perplexity. Ask me anything about your AI visibility, or use the chips below to get started.`,
          isStreaming: true,
          followUpChips: CHIP_SETS.default,
        }]);
        setBriefingDone(true);
      }
    };
    fetchBriefing();
  }, [brand.id, briefingDone, messages.length, brandName, brand.latestScore]);

  const sendMessage = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading || limitReached) return;

    const userMessage: Message = { role: "user", content: msg };
    const history = messages.map(m => ({ role: m.role === "agent" ? "assistant" : "user", content: m.content }));

    setMessages(prev => [...prev, userMessage, { role: "agent", content: "", isLoading: true, triggerUserMsg: msg }]);
    setInput("");
    setLoading(true);

    try {
      const token = localStorage.getItem("geoscore_token");
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, history: history.slice(-10), brandId: brand.id }),
      });

      if (res.status === 429) {
        const data = (await res.json()) as { message: string };
        setMessages(prev => [...prev.slice(0, -1), { role: "agent", content: data.message }]);
        setLimitReached(true);
        setRemaining(0);
        return;
      }

      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as {
        reply: string;
        remaining: number | null;
        toolsUsed?: ToolUsed[];
        keywords?: KeywordEntry[];
        technicalChecks?: TechnicalCheck[];
        technicalOverallScore?: number;
        auditCheckedAt?: string | null;
        auditResult?: AuditToolResult | null;
        competitorResult?: { comparison: CompetitorEntry[] } | null;
      };

      if (data.keywords && data.keywords.length > 0) setApiKeywords(data.keywords);
      if (data.technicalChecks && data.technicalChecks.length > 0) {
        setApiTechnicalChecks(data.technicalChecks);
        setApiTechnicalScore(data.technicalOverallScore);
        setApiCheckedAt(data.auditCheckedAt ?? null);
      }
      if (data.competitorResult?.comparison && data.competitorResult.comparison.some(c => c.hasData)) {
        setApiCompetitorData(data.competitorResult);
      }

      const auditToolResult = data.auditResult && !("error" in (data.auditResult as object))
        ? (data.auditResult as AuditToolResult)
        : undefined;

      if (auditToolResult) {
        window.dispatchEvent(new CustomEvent("audit-updated", { detail: { domain: auditToolResult.domain } }));
      }

      const visualType = auditToolResult ? "audit_result" : detectVisualType(msg, data.reply);
      const followUpChips = auditToolResult ? CHIP_SETS.after_technical : getFollowUpChips(msg, data.reply);

      setMessages(prev => [...prev.slice(0, -1), {
        role: "agent",
        content: data.reply,
        isStreaming: true,
        visualType,
        triggerUserMsg: msg,
        followUpChips,
        toolsUsed: data.toolsUsed ?? [],
        auditToolResult,
      }]);

      if (data.remaining !== null) {
        setRemaining(data.remaining);
        if (data.remaining <= 0) setLimitReached(true);
      }
    } catch {
      setMessages(prev => [...prev.slice(0, -1), { role: "agent", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleCopy = (idx: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const buildVisualData = (msg: Message): VisualData => ({
    brand: {
      domain: brand.domain,
      brandName: brand.brandName,
      category: brand.category,
      latestScore: brand.latestScore,
      latestScoreChatgpt: brand.latestScoreChatgpt,
      latestScoreGemini: brand.latestScoreGemini,
      latestScorePerplexity: brand.latestScorePerplexity,
    },
    lineChartData,
    keywords: apiKeywords.length > 0 ? apiKeywords : keywords,
    fixActions,
    citationData,
    competitorDisplayName,
    weekChange,
    agentResponse: msg.content,
    technicalChecks: apiTechnicalChecks.length > 0 ? apiTechnicalChecks : undefined,
    technicalOverallScore: apiTechnicalScore,
    auditCheckedAt: apiCheckedAt,
    auditToolResult: msg.auditToolResult,
    competitorResult: apiCompetitorData,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", minHeight: 500, maxHeight: 820 }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>GEO Agent</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Powered by Claude - knows your brand, scores, and competitors</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {plan === "starter" && remaining !== null && (
            <div style={{ fontSize: 11, color: remaining <= 5 ? "#DC2626" : "#9ca3af" }}>
              {remaining} of {STARTER_LIMIT} messages left
            </div>
          )}
          {plan === "agency" && (
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Unlimited messages</div>
          )}
          <button
            onClick={() => { setMessages([]); setBriefingDone(false); setLimitReached(false); }}
            style={{ background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#6b7280", cursor: "pointer" }}
          >
            Clear chat
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", background: "#F9FAFB", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: "14px 14px 8px", display: "flex", flexDirection: "column", gap: 14, marginBottom: 10 }}>
        {messages.map((msg, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-start" }}>
              {msg.role === "agent" && (
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <Bot size={14} color="white" />
                </div>
              )}

              {/* Message bubble or thinking indicator */}
              {msg.isLoading ? (
                <ThinkingIndicator
                  triggerMsg={msg.triggerUserMsg ?? ""}
                  brandName={brandName}
                  category={category}
                />
              ) : (
                <div style={{ maxWidth: msg.role === "user" ? "70%" : "82%" }}>
                  {msg.role === "agent" && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 5 }}>
                      {msg.toolsUsed.map((t, ti) => {
                        const labels: Record<string, string> = {
                          run_audit: "Live audit",
                          get_keyword_data: "Keyword data",
                          get_competitor_data: "Competitor scores",
                          generate_geo_file: "Generated file",
                          check_technical_audit: "Technical audit",
                        };
                        const label = labels[t.name] ?? t.name;
                        const domain = t.domain || (t.input?.domain as string) || "";
                        return (
                          <span key={ti} style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: "#EEF2FF",
                            border: "1px solid #C7D2FE",
                            borderRadius: 20,
                            padding: "2px 9px",
                            fontSize: 11,
                            color: "#4338CA",
                            fontWeight: 500,
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4F46E5", display: "inline-block" }} />
                            {label}{domain ? ` - ${domain}` : ""}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{
                    background: msg.role === "user" ? "#4F46E5" : "white",
                    color: msg.role === "user" ? "white" : "#111827",
                    borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    padding: "10px 14px",
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    border: msg.role === "agent" ? "1px solid #E5E7EB" : "none",
                    whiteSpace: "pre-wrap",
                  }}>
                    {msg.role === "agent" && msg.isStreaming ? (
                      <StreamingText
                        text={msg.content}
                        onDone={() => setMessages(prev => prev.map((m, mi) => mi === i ? { ...m, isStreaming: false } : m))}
                      />
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "agent" && msg.content && (
                    <button
                      onClick={() => handleCopy(i, msg.content)}
                      style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, background: "transparent", border: "none", cursor: "pointer", fontSize: 11, color: copiedIdx === i ? "#059669" : "#9ca3af", padding: "2px 4px" }}
                    >
                      <Copy size={10} />
                      {copiedIdx === i ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Visual component below agent message - only after streaming is done */}
            {msg.role === "agent" && !msg.isLoading && !msg.isStreaming && msg.visualType && msg.content && (
              <div style={{ marginLeft: 36, marginTop: 2 }}>
                <AgentVisual visualType={msg.visualType} data={buildVisualData(msg)} />
              </div>
            )}

            {/* Follow-up chips - only below the last agent message and after streaming */}
            {msg.role === "agent" && !msg.isLoading && !msg.isStreaming && msg.content && i === lastAgentIdx && msg.followUpChips && !loading && (
              <FollowUpChips chips={msg.followUpChips} onChipClick={sendMessage} />
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Upgrade prompt */}
      {limitReached && (
        <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#7F1D1D" }}>You have used your 50 GeoIQ Agent messages this month.</div>
          <a href="/pricing" style={{ background: "#DC2626", color: "white", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 500, textDecoration: "none" }}>Upgrade to Agency</a>
        </div>
      )}

      {/* Input row */}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask your GEO agent anything..."
          disabled={loading || limitReached}
          style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", color: "#111827", background: limitReached ? "#F9FAFB" : "white" }}
          onFocus={e => (e.currentTarget.style.borderColor = "#4F46E5")}
          onBlur={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || limitReached}
          style={{ background: loading || !input.trim() || limitReached ? "#c7d2fe" : "#4F46E5", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: loading || !input.trim() || limitReached ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 5 }}
        >
          <Send size={13} /> Send
        </button>
      </form>
    </div>
  );
}
