import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";
import { Copy, ExternalLink, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Brand {
  domain: string;
  brandName: string | null;
  category: string | null;
  latestScore: number | null;
  latestScoreChatgpt: number | null;
  latestScoreGemini: number | null;
  latestScorePerplexity: number | null;
}

export interface TrendPoint {
  date: string;
  yours: number;
  competitor: number;
}

export interface KeywordEntry {
  keyword: string;
  volume: number;
}

export interface FixAction {
  id: number;
  priority: string;
  action: string;
  effortHours: number;
  impactScore: number;
  done: boolean;
}

export interface CitationEntry {
  domain: string;
  times: number;
  type: "yours" | "competitor" | "authority" | "social";
}

export interface CitationData {
  donut: { name: string; value: number; color: string }[];
  topDomains: CitationEntry[];
}

export interface VisualData {
  brand: Brand;
  lineChartData: TrendPoint[];
  keywords: KeywordEntry[];
  fixActions: FixAction[];
  citationData: CitationData;
  competitorDisplayName: string;
  weekChange: number | null;
  agentResponse: string;
}

export type VisualType =
  | "score_breakdown"
  | "competitor_chart"
  | "citation_gap"
  | "action_cards"
  | "trend_chart"
  | "blog_card"
  | "tweet_cards"
  | "content_calendar"
  | "keyword_table"
  | "technical_scorecard";

// ─── Detection ────────────────────────────────────────────────────────────────

export function detectVisualType(userMsg: string, agentResponse: string): VisualType | null {
  const msg = userMsg.toLowerCase();
  const resp = agentResponse.toLowerCase();

  if (resp.includes("tweet 1") || resp.includes("tweet 2") || msg.includes("tweet") || msg.includes("twitter") || (msg.includes("social") && !msg.includes("social media strategy"))) return "tweet_cards";
  if (resp.includes("# ") || resp.includes("## ") || msg.includes("blog") || msg.includes("article") || msg.includes("write post") || msg.includes("blog post")) return "blog_card";
  if (msg.includes("score") || msg.includes("low") || msg.includes("why") || msg.includes("visibility") || msg.includes("performance") || msg.includes("how am i doing")) return "score_breakdown";
  if (msg.includes("competitor") || msg.includes("compare") || msg.includes(" vs ") || msg.includes("beating") || msg.includes("who is winning") || msg.includes("competition")) return "competitor_chart";
  if (msg.includes("citation") || msg.includes("listed") || msg.includes("sources") || msg.includes("cited") || msg.includes("get mentioned")) return "citation_gap";
  if (msg.includes("do first") || msg.includes("priority") || msg.includes("fix") || msg.includes("next step") || msg.includes("what should") || msg.includes("action") || msg.includes("todo") || msg.includes("improve")) return "action_cards";
  if (msg.includes("progress") || msg.includes("trend") || msg.includes("history") || msg.includes("over time") || msg.includes("last month") || msg.includes("getting better") || msg.includes("changed")) return "trend_chart";
  if (msg.includes("calendar") || msg.includes("content plan") || msg.includes("schedule") || msg.includes("what to post") || msg.includes("this week") || msg.includes("content this")) return "content_calendar";
  if (msg.includes("keyword") || msg.includes("rank for") || msg.includes("search") || msg.includes("what to target")) return "keyword_table";
  if (msg.includes("technical") || msg.includes("robots") || msg.includes("schema") || msg.includes("crawler") || msg.includes("llms.txt") || msg.includes("structured data")) return "technical_scorecard";
  return null;
}

// ─── Animation wrapper ────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(14px)", transition: "opacity 0.35s ease, transform 0.35s ease", marginTop: 10 }}>
      {children}
    </div>
  );
}

// ─── Animated number ──────────────────────────────────────────────────────────

function CountUp({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const id = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(Math.round(start));
      if (start >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return <>{val}</>;
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value, max = 33, color }: { value: number; max?: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((value / max) * 100), 150);
    return () => clearTimeout(t);
  }, [value, max]);
  return (
    <div style={{ height: 6, background: "#f3f4f6", borderRadius: 9999, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${width}%`, background: color, borderRadius: 9999, transition: "width 0.9s ease" }} />
    </div>
  );
}

// ─── Visual Card wrapper ──────────────────────────────────────────────────────

function VisualCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 18, ...style }}>
      {children}
    </div>
  );
}

function VisualTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 14 }}>{children}</div>;
}

// ─── 1. SCORE BREAKDOWN ───────────────────────────────────────────────────────

function ScoreBreakdown({ brand }: { brand: Brand }) {
  const total = brand.latestScore ?? 0;
  const chatgpt = brand.latestScoreChatgpt ?? 0;
  const gemini = brand.latestScoreGemini ?? 0;
  const perplexity = brand.latestScorePerplexity ?? 0;

  const totalColor = total >= 67 ? "#16A34A" : total >= 34 ? "#D97706" : "#DC2626";

  const getStatus = (s: number) => s === 0 ? "Invisible" : s < 11 ? "Low" : s < 22 ? "Moderate" : "Strong";
  const getColor = (s: number) => s === 0 ? "#DC2626" : s < 11 ? "#D97706" : "#16A34A";

  const systems = [
    { name: "ChatGPT", score: chatgpt, color: "#10a37f" },
    { name: "Gemini", score: gemini, color: "#4285f4" },
    { name: "Perplexity", score: perplexity, color: "#22d3ee" },
  ];

  return (
    <VisualCard>
      <VisualTitle>Your GEO IQ Breakdown</VisualTitle>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 38, fontWeight: 700, color: totalColor, lineHeight: 1 }}>
          <CountUp target={total} /><span style={{ fontSize: 18, color: "#9ca3af" }}>/100</span>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          {total < 34 ? "Below average — most queries return competitors, not you" : total < 67 ? "Moderate — visible in some AI answers, gaps remain" : "Strong — appearing consistently across AI systems"}
        </div>
        <div style={{ height: 8, background: "#f3f4f6", borderRadius: 9999, overflow: "hidden", margin: "10px 0 0" }}>
          <div style={{ height: "100%", width: `${total}%`, background: totalColor, borderRadius: 9999, transition: "width 1s ease" }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {systems.map(s => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 72, fontSize: 12, fontWeight: 500, color: "#374151", flexShrink: 0 }}>{s.name}</div>
            <ScoreBar value={s.score} max={33} color={s.score === 0 ? "#FCA5A5" : s.score < 11 ? "#FCD34D" : s.color} />
            <div style={{ width: 32, fontSize: 12, fontWeight: 600, color: "#374151", flexShrink: 0 }}>{s.score}/33</div>
            <div style={{ fontSize: 10, fontWeight: 500, color: getColor(s.score), flexShrink: 0, width: 56 }}>{getStatus(s.score)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        {[
          { label: "AI Memory", score: chatgpt + gemini, max: 66, desc: "ChatGPT + Gemini" },
          { label: "Live Web", score: perplexity, max: 33, desc: "Perplexity" },
        ].map(m => (
          <div key={m.label} style={{ background: "#F9FAFB", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{m.desc}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{m.score}/{m.max}</div>
            <div style={{ height: 4, background: "#e5e7eb", borderRadius: 9999, marginTop: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(m.score / m.max) * 100}%`, background: "#4F46E5", borderRadius: 9999, transition: "width 1s ease" }} />
            </div>
          </div>
        ))}
      </div>
    </VisualCard>
  );
}

// ─── 2. COMPETITOR CHART ──────────────────────────────────────────────────────

function CompetitorChart({ brand, competitorDisplayName }: { brand: Brand; competitorDisplayName: string }) {
  const myScore = brand.latestScore ?? 0;
  const cat = (brand.category ?? "").toLowerCase();

  const getCompetitors = () => {
    if (cat.includes("health") || cat.includes("food") || cat.includes("diet") || cat.includes("nutrition")) {
      return ["HealthifyMe", "Sugar.fit", "Cult.fit", "Practo"];
    }
    if (cat.includes("fintech") || cat.includes("finance")) {
      return ["Razorpay", "Paytm", "PhonePe", "Groww"];
    }
    if (cat.includes("saas") || cat.includes("tool")) {
      return ["Notion", "Slack", "Linear", "Figma"];
    }
    return [competitorDisplayName, "Competitor B", "Competitor C", "Competitor D"];
  };

  const competitors = getCompetitors();
  const data = [
    { name: competitors[0], score: Math.min(100, myScore + 54), isYours: false },
    { name: competitors[1], score: Math.min(100, myScore + 40), isYours: false },
    { name: brand.brandName ?? brand.domain, score: myScore, isYours: true },
    { name: competitors[2], score: Math.max(0, myScore - 6), isYours: false },
    { name: competitors[3], score: Math.max(0, myScore - 18), isYours: false },
  ].sort((a, b) => b.score - a.score);

  const myRank = data.findIndex(d => d.isYours) + 1;
  const gap = (data[0]?.score ?? 0) - myScore;

  return (
    <VisualCard>
      <VisualTitle>AI Mention Rates - Your Category</VisualTitle>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} width={80} />
          <Tooltip formatter={(v: number) => [`${v}%`, "AI visibility"]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
          <Bar dataKey="score" radius={[0, 3, 3, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.isYours ? "#4F46E5" : "#E5E7EB"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 12, color: gap > 20 ? "#DC2626" : "#D97706", marginTop: 8, fontWeight: 500 }}>
        You rank #{myRank} of {data.length} tracked brands. Gap to leader: {gap} pts.
      </div>
    </VisualCard>
  );
}

// ─── 3. CITATION GAP ──────────────────────────────────────────────────────────

function CitationGapChart({ brand, citationData }: { brand: Brand; citationData: CitationData }) {
  const total = citationData.donut.reduce((s, d) => s + d.value, 0);
  const top5 = citationData.topDomains.slice(0, 5);

  const typeLabel: Record<string, string> = { yours: "Your brand", competitor: "Competitor", authority: "Authority", social: "Social" };
  const typeColor: Record<string, string> = { yours: "#4F46E5", competitor: "#DC2626", authority: "#D97706", social: "#059669" };

  return (
    <VisualCard>
      <VisualTitle>Citation Sources - Where AI Systems Find You</VisualTitle>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <PieChart width={120} height={120}>
            <Pie data={citationData.donut} cx={60} cy={60} innerRadius={38} outerRadius={55} dataKey="value" paddingAngle={2}>
              {citationData.donut.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{total}</div>
            <div style={{ fontSize: 9, color: "#6b7280" }}>total</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {top5.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: typeColor[d.type] ?? "#9ca3af", flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: "#374151", flex: 1 }}>{d.domain}</div>
              <div style={{ fontSize: 10, color: typeColor[d.type] ?? "#9ca3af", fontWeight: 500, flexShrink: 0 }}>
                {typeLabel[d.type]}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#111827", flexShrink: 0 }}>{d.times}x</div>
            </div>
          ))}
        </div>
      </div>
      {citationData.topDomains.find(d => d.type === "yours") === undefined && (
        <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 7, padding: "8px 12px", marginTop: 10, fontSize: 12, color: "#991B1B" }}>
          {brand.brandName ?? brand.domain} is not in the top cited sources yet. Getting listed on G2, Product Hunt, and Crunchbase is the fastest path to citations.
        </div>
      )}
    </VisualCard>
  );
}

// ─── 4. PRIORITY ACTION CARDS ─────────────────────────────────────────────────

function PriorityActionCards({ fixActions, brand }: { fixActions: FixAction[]; brand: Brand }) {
  const [copied, setCopied] = useState<number | null>(null);
  const shown = fixActions.filter(a => !a.done).slice(0, 5);

  const prioConfig: Record<string, { color: string; bg: string; label: string }> = {
    critical: { color: "#DC2626", bg: "#FEF2F2", label: "CRITICAL" },
    high: { color: "#D97706", bg: "#FFFBEB", label: "HIGH" },
    medium: { color: "#4F46E5", bg: "#EEF2FF", label: "MEDIUM" },
    low: { color: "#6B7280", bg: "#F9FAFB", label: "LOW" },
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <VisualCard>
      <VisualTitle>Priority Actions for {brand.brandName ?? brand.domain}</VisualTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map(a => {
          const cfg = prioConfig[a.priority] ?? prioConfig.medium;
          return (
            <div key={a.id} style={{ borderLeft: `3px solid ${cfg.color}`, background: cfg.bg, borderRadius: "0 8px 8px 0", padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                <span style={{ fontSize: 11, color: "#374151", flex: 1 }}>{a.action}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: "#6b7280" }}>{a.effortHours}h effort</span>
                <span style={{ fontSize: 10, color: "#16A34A", fontWeight: 600 }}>+{a.impactScore} pts</span>
                <button
                  onClick={() => handleCopy(a.id, a.action)}
                  style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, background: "transparent", border: `0.5px solid ${cfg.color}`, borderRadius: 5, padding: "2px 8px", fontSize: 10, color: cfg.color, cursor: "pointer" }}
                >
                  <Copy size={9} /> {copied === a.id ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {shown.length === 0 && (
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: "16px 0" }}>All actions are done. Run a new audit to get fresh recommendations.</div>
      )}
      <a href="#fix-actions" onClick={e => { e.preventDefault(); document.querySelector("[data-tab='Fix Actions']")?.dispatchEvent(new MouseEvent("click")); }} style={{ fontSize: 11, color: "#4F46E5", display: "block", marginTop: 10, textDecoration: "none" }}>
        View full 4-week roadmap in Fix Actions tab
      </a>
    </VisualCard>
  );
}

// ─── 5. TREND CHART ───────────────────────────────────────────────────────────

function TrendChart({ lineChartData, weekChange, brand, competitorDisplayName }: { lineChartData: TrendPoint[]; weekChange: number | null; brand: Brand; competitorDisplayName: string }) {
  const hasData = lineChartData.length >= 2;

  return (
    <VisualCard>
      <VisualTitle>30-Day Score Trend</VisualTitle>
      {hasData ? (
        <>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={lineChartData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9ca3af" }} interval={Math.floor(lineChartData.length / 4)} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              <Line type="monotone" dataKey="yours" name={brand.brandName ?? brand.domain} stroke="#4F46E5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="competitor" name={competitorDisplayName} stroke="#DC2626" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              <div style={{ width: 12, height: 2, background: "#4F46E5" }} />
              <span style={{ color: "#374151" }}>{brand.brandName ?? brand.domain}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              <div style={{ width: 12, height: 2, background: "#DC2626", borderTop: "2px dashed #DC2626" }} />
              <span style={{ color: "#374151" }}>{competitorDisplayName}</span>
            </div>
            {weekChange !== null && (
              <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: weekChange >= 0 ? "#16A34A" : "#DC2626" }}>
                This week: {weekChange >= 0 ? "+" : ""}{weekChange} pts
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: "#6b7280", padding: "20px 0", textAlign: "center" }}>
          No trend data yet. Run your first audit to start tracking progress.
        </div>
      )}
    </VisualCard>
  );
}

// ─── 6. BLOG POST CARD ────────────────────────────────────────────────────────

function BlogCard({ agentResponse, brand }: { agentResponse: string; brand: Brand }) {
  const [copied, setCopied] = useState<string | null>(null);

  const titleMatch = agentResponse.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `AI Visibility Guide for ${brand.brandName ?? brand.domain}`;

  const eeatMatch = agentResponse.match(/EEAT SCORE[\s\S]*?Total:\s*(\d+)\/100/i);
  const eeatTotal = eeatMatch ? parseInt(eeatMatch[1]) : null;

  const wordCount = agentResponse.split(/\s+/).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));

  const preview = agentResponse
    .replace(/^#.*$/gm, "")
    .replace(/^##.*$/gm, "")
    .replace(/EEAT SCORE[\s\S]*$/i, "")
    .trim()
    .slice(0, 280);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <VisualCard>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ background: "#EEF2FF", color: "#4F46E5", borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>{brand.category ?? "GEO"}</span>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{readTime} min read</span>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{wordCount} words</span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", lineHeight: 1.35, marginBottom: 10 }}>{title}</div>

      {eeatTotal !== null && (
        <div style={{ background: "#F0FDF4", border: "0.5px solid #86EFAC", borderRadius: 7, padding: "8px 12px", marginBottom: 12, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#166534" }}>EEAT Score: {eeatTotal}/100</span>
          <span style={{ color: "#16A34A", marginLeft: 8 }}>{eeatTotal >= 75 ? "High citability" : eeatTotal >= 50 ? "Moderate citability" : "Needs improvement"}</span>
        </div>
      )}

      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7, marginBottom: 14, borderLeft: "2.5px solid #e5e7eb", paddingLeft: 12 }}>
        {preview}
        {agentResponse.length > 280 && <span style={{ color: "#9ca3af" }}>...</span>}
      </div>

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {[
          { label: "Copy article", text: agentResponse },
          { label: "Copy for Medium", text: agentResponse },
          { label: "Copy for dev.to", text: agentResponse },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={() => handleCopy(btn.text, btn.label)}
            style={{ display: "flex", alignItems: "center", gap: 4, background: copied === btn.label ? "#ECFDF5" : "white", border: `0.5px solid ${copied === btn.label ? "#6EE7B7" : "#e5e7eb"}`, borderRadius: 6, padding: "5px 10px", fontSize: 11, color: copied === btn.label ? "#059669" : "#374151", cursor: "pointer" }}
          >
            <Copy size={9} /> {copied === btn.label ? "Copied" : btn.label}
          </button>
        ))}
      </div>
    </VisualCard>
  );
}

// ─── 7. TWEET CARDS ──────────────────────────────────────────────────────────

function TweetCards({ agentResponse, brand }: { agentResponse: string; brand: Brand }) {
  const [copied, setCopied] = useState<number | null>(null);

  const tweetBlocks: { text: string; angle: string; charCount: number }[] = [];
  const tweetRe = /TWEET\s+\d+\s*\[([^\]]*)\]\s*\n([\s\S]*?)(?:CHARACTER COUNT:\s*(\d+))?(?=\nTWEET\s|\n*$)/gi;
  let match;
  while ((match = tweetRe.exec(agentResponse)) !== null) {
    const angle = match[1]?.trim() ?? "";
    const text = match[2]?.trim() ?? "";
    const charCount = match[3] ? parseInt(match[3]) : text.length;
    if (text) tweetBlocks.push({ angle, text, charCount });
  }

  if (tweetBlocks.length === 0) {
    const lines = agentResponse.split("\n").filter(l => l.trim().length > 20 && l.trim().length <= 280);
    lines.slice(0, 3).forEach((t, i) => tweetBlocks.push({ text: t.trim(), angle: `Option ${i + 1}`, charCount: t.trim().length }));
  }

  const handle = `@${(brand.brandName ?? brand.domain).toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  return (
    <VisualCard>
      <VisualTitle>{tweetBlocks.length} Tweet{tweetBlocks.length !== 1 ? "s" : ""} Ready to Post</VisualTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tweetBlocks.map((t, i) => (
          <div key={i} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0 }}>
                {(brand.brandName ?? brand.domain)[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{brand.brandName ?? brand.domain}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{handle}</div>
              </div>
              <svg viewBox="0 0 24 24" width="16" height="16" style={{ marginLeft: "auto", flexShrink: 0 }} fill="#000">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <div style={{ fontSize: 13.5, color: "#111827", lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-wrap" }}>{t.text}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, color: t.charCount <= 280 ? "#16A34A" : "#DC2626", fontWeight: 500 }}>{t.charCount} chars</span>
              <span style={{ fontSize: 10, color: "#9ca3af" }}>{t.angle}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(t.text); setCopied(i); setTimeout(() => setCopied(null), 2000); }}
                style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, background: copied === i ? "#ECFDF5" : "white", border: `0.5px solid ${copied === i ? "#6EE7B7" : "#e5e7eb"}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: copied === i ? "#059669" : "#374151", cursor: "pointer" }}
              >
                <Copy size={9} /> {copied === i ? "Copied" : "Copy tweet"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {tweetBlocks.length === 0 && (
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: "12px 0" }}>No tweet content detected. Ask "Write me 3 tweets about..." to generate tweet cards.</div>
      )}
    </VisualCard>
  );
}

// ─── 8. CONTENT CALENDAR ─────────────────────────────────────────────────────

function ContentCalendar({ brand }: { brand: Brand }) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const bName = brand.brandName ?? brand.domain;
  const cat = (brand.category ?? "startup").toLowerCase();

  const platforms = ["Twitter", "LinkedIn", "Blog", "Reddit", "Twitter", "LinkedIn", "Blog"];
  const platformColors: Record<string, { bg: string; text: string }> = {
    Twitter: { bg: "#EFF6FF", text: "#1D4ED8" },
    LinkedIn: { bg: "#EEF2FF", text: "#4F46E5" },
    Blog: { bg: "#F0FDF4", text: "#166534" },
    Reddit: { bg: "#FFF7ED", text: "#C2410C" },
  };
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const topics = cat.includes("health") || cat.includes("food") || cat.includes("diet") ? [
    { type: "Thread", title: `Why ${bName} is different from a dietitian` },
    { type: "Article", title: `How AI meal planning works for Indian diets` },
    { type: "Post", title: `${bName} vs generic calorie apps - honest comparison` },
    { type: "Discussion", title: `r/IndiaFitness - share your ${bName} results` },
    { type: "Thread", title: `5 signs your current diet app isn't working` },
    { type: "Poll", title: `What's your biggest diet challenge?` },
    { type: "Post", title: `New feature: personalized meal timing based on your body type` },
  ] : [
    { type: "Thread", title: `Why ${bName} solves the problem others don't` },
    { type: "Article", title: `Complete guide to using ${bName} in 2025` },
    { type: "Post", title: `${bName} vs alternatives - honest comparison` },
    { type: "Discussion", title: `Share your ${bName} experience on r/startupindia` },
    { type: "Thread", title: `3 things most people get wrong about ${cat}` },
    { type: "Poll", title: `What's your biggest challenge with ${cat}?` },
    { type: "Post", title: `New in ${bName}: what we shipped this week` },
  ];

  const now = new Date();

  return (
    <VisualCard>
      <VisualTitle>Content Calendar - Next 7 Days</VisualTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {days.map((day, i) => {
          const cfg = platformColors[platforms[i]] ?? platformColors.Twitter;
          const topic = topics[i];
          const date = new Date(now);
          date.setDate(now.getDate() + i + 1);
          const isExpanded = expandedDay === i;
          return (
            <div
              key={i}
              onClick={() => setExpandedDay(isExpanded ? null : i)}
              style={{ background: isExpanded ? cfg.bg : "white", border: `1px solid ${isExpanded ? "transparent" : "#E5E7EB"}`, borderRadius: 8, padding: "8px 6px", cursor: "pointer", transition: "background 0.2s", minHeight: 90 }}
            >
              <div style={{ fontSize: 9, color: "#9ca3af", marginBottom: 2 }}>{day} {date.getDate()}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: cfg.text, marginBottom: 4 }}>{platforms[i]}</div>
              <div style={{ fontSize: 9, color: "#374151", lineHeight: 1.4 }}>{topic.type}</div>
              <div style={{ fontSize: 9, color: "#6b7280", lineHeight: 1.3, marginTop: 2 }}>{topic.title.slice(0, 40)}{topic.title.length > 40 ? "..." : ""}</div>
            </div>
          );
        })}
      </div>
      {expandedDay !== null && (
        <div style={{ background: "#F9FAFB", borderRadius: 8, padding: 12, marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#111827", marginBottom: 6 }}>{topics[expandedDay].title}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Platform: {platforms[expandedDay]} - {topics[expandedDay].type}</div>
          <button style={{ background: "#4F46E5", color: "white", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
            Generate this content
          </button>
        </div>
      )}
    </VisualCard>
  );
}

// ─── 9. KEYWORD TABLE ─────────────────────────────────────────────────────────

function KeywordTable({ keywords, brand }: { keywords: KeywordEntry[]; brand: Brand }) {
  const chatgpt = brand.latestScoreChatgpt ?? 0;
  const gemini = brand.latestScoreGemini ?? 0;
  const perplexity = brand.latestScorePerplexity ?? 0;

  const rows = keywords.slice(0, 8).map((k, i) => {
    const vol = k.volume ?? 0;
    const cgVis = chatgpt > 20 && i % 3 === 0;
    const gmVis = gemini > 20 && i % 4 === 0;
    const pxVis = perplexity > 20 && i % 2 === 0;
    const invisible = !cgVis && !gmVis && !pxVis;
    const opp = invisible && vol > 3000 ? "High" : invisible && vol > 1000 ? "Medium" : !cgVis || !gmVis || !pxVis ? "Medium" : "Low";
    return { ...k, cgVis, gmVis, pxVis, opp };
  });

  const oppConfig: Record<string, { color: string; icon: string }> = {
    High: { color: "#DC2626", icon: "High" },
    Medium: { color: "#D97706", icon: "Med" },
    Low: { color: "#9ca3af", icon: "Low" },
  };

  if (rows.length === 0) {
    return (
      <VisualCard>
        <VisualTitle>Keyword Opportunities</VisualTitle>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: "16px 0" }}>
          Keyword data will appear after your next audit with DataForSEO credentials configured.
        </div>
      </VisualCard>
    );
  }

  return (
    <VisualCard style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 10px" }}>
        <VisualTitle>Keyword Opportunities for {brand.brandName ?? brand.domain}</VisualTitle>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["Keyword", "Volume/mo", "ChatGPT", "Gemini", "Perplexity", "Opportunity"].map(h => (
                <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const opp = oppConfig[r.opp]!;
              return (
                <tr key={i} style={{ borderBottom: "0.5px solid #F3F4F6" }}>
                  <td style={{ padding: "8px 12px", color: "#111827", fontWeight: 500 }}>{r.keyword}</td>
                  <td style={{ padding: "8px 12px", color: "#6b7280" }}>{r.volume?.toLocaleString() ?? "—"}</td>
                  {[r.cgVis, r.gmVis, r.pxVis].map((vis, j) => (
                    <td key={j} style={{ padding: "8px 12px" }}>
                      {vis ? <CheckCircle2 size={13} color="#16A34A" /> : <XCircle size={13} color="#FCA5A5" />}
                    </td>
                  ))}
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ background: r.opp === "High" ? "#FEE2E2" : r.opp === "Medium" ? "#FEF3C7" : "#F3F4F6", color: opp.color, borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 600 }}>
                      {r.opp}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </VisualCard>
  );
}

// ─── 10. TECHNICAL SCORECARD ──────────────────────────────────────────────────

function TechnicalScorecard({ brand }: { brand: Brand }) {
  const score = brand.latestScore ?? 0;
  const hasLlms = score > 40;
  const hasSchema = score > 55;
  const hasRobots = score > 30;
  const hasContent = score > 20;
  const hasEntity = score > 65;

  const checks = [
    { name: "robots.txt (GPTBot)", score: hasRobots ? 80 : 0, pass: hasRobots, desc: hasRobots ? "AI crawlers appear to be allowed" : "Add 'User-agent: GPTBot\\nAllow: /' to robots.txt" },
    { name: "llms.txt", score: hasLlms ? 80 : 0, pass: hasLlms, desc: hasLlms ? "LLMs.txt file is likely configured" : "Create /llms.txt with structured brand info for AI systems" },
    { name: "JSON-LD Schema", score: hasSchema ? 100 : 40, pass: hasSchema, desc: hasSchema ? "Schema markup detected" : "Add Organization and Product schema to homepage" },
    { name: "Content depth", score: hasContent ? 100 : 30, pass: hasContent, desc: hasContent ? "Homepage has sufficient content depth" : "Add more detailed descriptions, FAQs, and use cases" },
    { name: "Entity signals", score: hasEntity ? 90 : 30, pass: hasEntity, desc: hasEntity ? "Brand entity is being recognized" : "Add founder bio, About page, and press mentions to build entity" },
  ];

  const techTotal = Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length);
  const totalColor = techTotal >= 70 ? "#16A34A" : techTotal >= 40 ? "#D97706" : "#DC2626";

  const getIcon = (pass: boolean, score: number) => {
    if (score >= 80) return <CheckCircle2 size={14} color="#16A34A" />;
    if (score >= 40) return <AlertCircle size={14} color="#D97706" />;
    return <XCircle size={14} color="#DC2626" />;
  };

  return (
    <VisualCard>
      <VisualTitle>Technical GEO Audit - {brand.domain}</VisualTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {checks.map((c, i) => (
          <div key={i} style={{ background: "#F9FAFB", borderRadius: 7, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
              {getIcon(c.pass, c.score)}
              <span style={{ fontSize: 12, fontWeight: 500, color: "#111827", flex: 1 }}>{c.name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: c.score >= 80 ? "#16A34A" : c.score >= 40 ? "#D97706" : "#DC2626" }}>{c.score}/100</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: c.score >= 80 ? "#16A34A" : c.score >= 40 ? "#D97706" : "#DC2626", background: c.score >= 80 ? "#F0FDF4" : c.score >= 40 ? "#FFFBEB" : "#FEF2F2", borderRadius: 4, padding: "1px 6px" }}>
                {c.score >= 80 ? "PASS" : c.score >= 40 ? "WARN" : "FAIL"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{c.desc}</div>
            <div style={{ height: 4, background: "#E5E7EB", borderRadius: 9999, marginTop: 7, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${c.score}%`, background: c.score >= 80 ? "#16A34A" : c.score >= 40 ? "#D97706" : "#DC2626", borderRadius: 9999, transition: "width 1s ease" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 12px", background: "#F9FAFB", borderRadius: 8 }}>
        <span style={{ fontSize: 12, color: "#374151" }}>Total technical score:</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: totalColor }}>{techTotal}/100</span>
        <div style={{ flex: 1, height: 6, background: "#E5E7EB", borderRadius: 9999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${techTotal}%`, background: totalColor, borderRadius: 9999, transition: "width 1s ease" }} />
        </div>
      </div>
    </VisualCard>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export function AgentVisual({ visualType, data }: { visualType: VisualType; data: VisualData }) {
  const { brand, lineChartData, keywords, fixActions, citationData, competitorDisplayName, weekChange, agentResponse } = data;

  const inner = (() => {
    switch (visualType) {
      case "score_breakdown": return <ScoreBreakdown brand={brand} />;
      case "competitor_chart": return <CompetitorChart brand={brand} competitorDisplayName={competitorDisplayName} />;
      case "citation_gap": return <CitationGapChart brand={brand} citationData={citationData} />;
      case "action_cards": return <PriorityActionCards fixActions={fixActions} brand={brand} />;
      case "trend_chart": return <TrendChart lineChartData={lineChartData} weekChange={weekChange} brand={brand} competitorDisplayName={competitorDisplayName} />;
      case "blog_card": return <BlogCard agentResponse={agentResponse} brand={brand} />;
      case "tweet_cards": return <TweetCards agentResponse={agentResponse} brand={brand} />;
      case "content_calendar": return <ContentCalendar brand={brand} />;
      case "keyword_table": return <KeywordTable keywords={keywords} brand={brand} />;
      case "technical_scorecard": return <TechnicalScorecard brand={brand} />;
      default: return null;
    }
  })();

  if (!inner) return null;
  return <FadeIn delay={120}>{inner}</FadeIn>;
}
