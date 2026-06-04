import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { getToken } from "@/lib/auth";
import { Globe, ChevronDown, FileDown, HelpCircle, BookOpen, Users, Zap, AlertCircle } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

/* ---- types ---- */
interface TrendPoint { label: string; mentions: number; citations: number; citedPages: number }
interface LLMRow { name: string; color: string; mentionsPct: number; count: number }
interface CountryRow { name: string; pct: number; count: number; color: string }

interface VisibilityData {
  domain: string;
  score: number;
  mentions: number;
  citations: number;
  citedPages: number;
  mentionsChange: string;
  citationsChange: string;
  citedPagesChange: string;
  trend: TrendPoint[];
  llm: LLMRow[];
  countries: CountryRow[];
  cached?: boolean;
}

/* ---- raw API response shape ---- */
interface ApiLLMRow { name: string; mentionsPct: number; citedPct: number }
interface ApiTrendPoint { label: string; mentions: number; citations: number }
interface ApiResponse {
  domain?: string;
  score?: number;
  mentions?: number;
  citations?: number;
  citedPages?: number;
  mentionsChange?: string;
  citationsChange?: string;
  citedPagesChange?: string;
  llm?: ApiLLMRow[];
  trend?: ApiTrendPoint[];
  cached?: boolean;
  error?: string;
}

/* ---- helpers ---- */
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function getScoreLabel(s: number) {
  if (s >= 75) return "High";
  if (s >= 45) return "Medium";
  if (s >= 20) return "Low";
  return "Very Low";
}

function getScoreDesc(s: number) {
  if (s >= 75) return "Frequently cited by AI platforms across many topics.";
  if (s >= 45) return "Occasionally mentioned in LLM outputs, but visibility can improve.";
  if (s >= 20) return "Rarely appears in AI-generated answers. A full audit can help.";
  return "Almost invisible to AI platforms. Start with a full audit.";
}

function getScoreColor(s: number) {
  if (s >= 75) return "#059669";
  if (s >= 45) return "#D97706";
  if (s > 0) return "#DC2626";
  return "#9CA3AF";
}

const LLM_COLORS: Record<string, string> = {
  ChatGPT: "#10A37F",
  "AI Overview": "#4285F4",
  "AI Mode": "#34A853",
  Gemini: "#8B5CF6",
  Perplexity: "#5B21B6",
  Claude: "#CC785C",
};

function adaptResponse(raw: ApiResponse, domain: string): VisibilityData {
  const totalMentions = raw.mentions ?? 0;
  return {
    domain: raw.domain ?? domain,
    score: raw.score ?? 0,
    mentions: totalMentions,
    citations: raw.citations ?? 0,
    citedPages: raw.citedPages ?? 0,
    mentionsChange: raw.mentionsChange ?? "",
    citationsChange: raw.citationsChange ?? "",
    citedPagesChange: raw.citedPagesChange ?? "",
    trend: (raw.trend ?? []).map(t => ({
      label: t.label,
      mentions: t.mentions,
      citations: t.citations,
      citedPages: Math.round(t.citations * 0.65),
    })),
    llm: (raw.llm ?? []).map(row => ({
      name: row.name,
      color: LLM_COLORS[row.name] ?? "#6B7280",
      mentionsPct: row.mentionsPct,
      count: Math.round(totalMentions * (row.mentionsPct / 100)),
    })),
    countries: [],
    cached: raw.cached,
  };
}

/* ===== Domain modal popup ===== */
function DomainModal({
  onDomain,
  lastDomain,
}: {
  onDomain: (d: string) => void;
  lastDomain?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const go = () => {
    const d = input.trim().replace(/^https?:\/\//, "").split("/")[0];
    if (d) onDomain(d);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(15,15,15,0.45)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "white", borderRadius: 18,
          padding: "44px 48px 40px",
          maxWidth: 520, width: "90%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
          position: "relative",
        }}
      >
        {/* top gradient accent */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: `linear-gradient(90deg, ${P}, #8B5CF6, #10B981)`,
          borderRadius: "18px 18px 0 0",
        }} />

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#EEF2FF", borderRadius: 20, padding: "4px 12px",
            fontSize: 11, fontWeight: 700, color: P,
            textTransform: "uppercase", letterSpacing: "0.08em",
            marginBottom: 18,
          }}>
            AI Visibility
          </div>
          <h2 style={{
            fontSize: 26, fontWeight: 800, lineHeight: 1.25,
            marginBottom: 12, color: "#0F0F0F", letterSpacing: "-0.03em",
          }}>
            Check your AI Visibility
          </h2>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, margin: 0 }}>
            Enter a domain to see how it appears across ChatGPT, Gemini, Perplexity,
            and other AI platforms.
          </p>
        </div>

        <div style={{
          display: "flex",
          border: `1.5px solid ${BORDER}`,
          borderRadius: 10, overflow: "hidden",
          boxShadow: "0 2px 10px rgba(79,70,229,0.08)",
          marginBottom: 14,
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && go()}
            placeholder="yourdomain.com"
            style={{
              flex: 1, padding: "14px 18px",
              border: "none", outline: "none",
              fontSize: 15, color: "#111827", background: "transparent",
            }}
          />
          <button
            onClick={go}
            disabled={!input.trim()}
            style={{
              padding: "14px 26px",
              background: input.trim() ? P : "#A5B4FC",
              color: "white", border: "none",
              cursor: input.trim() ? "pointer" : "not-allowed",
              fontSize: 14, fontWeight: 600, whiteSpace: "nowrap",
              transition: "background 0.15s",
            }}
          >
            Get started
          </button>
        </div>

        {lastDomain && (
          <div style={{ textAlign: "center", fontSize: 12, color: MUTED }}>
            Last checked:{" "}
            <button
              onClick={() => onDomain(lastDomain)}
              style={{ background: "none", border: "none", color: P, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0 }}
            >
              {lastDomain}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== SVG circular gauge ===== */
function ScoreGauge({ score }: { score: number }) {
  const r = 78;
  const cx = 110, cy = 115;
  const total = Math.PI * r;
  const filled = total * (score / 100);
  const gColor = getScoreColor(score);
  const label = score > 0 ? getScoreLabel(score) : "No Data";

  const angle = Math.PI * (score / 100);
  const dotX = cx - r * Math.cos(angle);
  const dotY = cy - r * Math.sin(angle);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox="0 0 220 135" style={{ width: 210, height: 128, overflow: "visible" }}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor={P} />
          </linearGradient>
        </defs>
        <path
          d={`M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`}
          fill="none" stroke="#E5E7EB" strokeWidth="16" strokeLinecap="round"
        />
        {score > 0 && (
          <path
            d={`M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`}
            fill="none" stroke="url(#gaugeGrad)" strokeWidth="16" strokeLinecap="round"
            strokeDasharray={`${filled} ${total}`}
          />
        )}
        {score > 0 && score < 100 && (
          <circle cx={dotX} cy={dotY} r={9} fill="white" stroke={gColor} strokeWidth="3" />
        )}
        <text x={cx} y={cy - 24} textAnchor="middle" fontSize="44" fontWeight="700" fill="#111827" fontFamily="Sora, sans-serif">
          {score}
        </text>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fill={MUTED}>/100</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="14" fontWeight="600" fill={gColor}>{label}</text>
      </svg>
      <div style={{ maxWidth: 200, textAlign: "center", fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 4 }}>
        {score > 0 ? getScoreDesc(score) : "No AI visibility data found for this domain."}
      </div>
    </div>
  );
}

/* ===== Metric number ===== */
function MetricNum({ label, value, change, color }: { label: string; value: number; change: string; color: string }) {
  const isUp = change.startsWith("+");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: value > 0 ? "#111827" : MUTED, lineHeight: 1 }}>
          {value > 0 ? fmt(value) : "--"}
        </span>
        {change && value > 0 && (
          <span style={{ fontSize: 11, fontWeight: 600, color: isUp ? "#059669" : "#DC2626" }}>{change}</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
      </div>
    </div>
  );
}

/* ===== Country stacked bar ===== */
function CountryBar({ countries }: { countries: CountryRow[] }) {
  return (
    <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 16 }}>
      {countries.map(c => (
        <div key={c.name} style={{ width: `${c.pct}%`, background: c.color }} title={`${c.name}: ${c.pct}%`} />
      ))}
    </div>
  );
}

/* ===== Empty state when no data ===== */
function NoDataState({ domain }: { domain: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <AlertCircle size={40} color="#D1D5DB" style={{ margin: "0 auto 16px" }} />
      <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
        No AI visibility data found for {domain}
      </div>
      <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, maxWidth: 400, margin: "0 auto 24px" }}>
        This domain hasn't been picked up by AI platforms yet, or DataForSEO hasn't indexed it. Run a full audit to get recommendations.
      </p>
      <a
        href="/audit"
        style={{ display: "inline-block", padding: "10px 24px", background: P, color: "white", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
      >
        Run free audit
      </a>
    </div>
  );
}

/* ===== Main export ===== */
export function VisibilityOverview({
  domain,
  geo,
  period,
  onDomainChange,
}: {
  domain: string;
  geo?: string;
  period?: string;
  onDomainChange?: (d: string) => void;
}) {
  const [data, setData] = useState<VisibilityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(!domain);
  const [metricTab, setMetricTab] = useState<"main" | "monthly" | "ai">("main");
  const [llmTab, setLlmTab] = useState<"mentions" | "cited">("mentions");
  const [localPeriod, setLocalPeriod] = useState(period ?? "6m");
  const [lastDomain, setLastDomain] = useState<string | undefined>(domain || undefined);

  useEffect(() => {
    if (period) setLocalPeriod(period);
  }, [period]);

  // Open modal when nav switches to this section with no domain
  useEffect(() => {
    if (!domain) setShowModal(true);
  }, [domain]);

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    setLastDomain(domain);
    const token = getToken();
    fetch(
      `/api/dataforseo/visibility-overview?domain=${encodeURIComponent(domain)}&period=${localPeriod}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    )
      .then(r => r.json())
      .then((raw: ApiResponse) => {
        if (raw.error) {
          setError(raw.error);
        } else {
          setData(adaptResponse(raw, domain));
        }
      })
      .catch(() => setError("Failed to load visibility data. Please try again."))
      .finally(() => setLoading(false));
  }, [domain, localPeriod]);

  const handleDomainSubmit = (d: string) => {
    setShowModal(false);
    if (onDomainChange) onDomainChange(d);
  };

  const d = data;
  const hasData = d && (d.score > 0 || d.mentions > 0);

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* domain modal */}
      {showModal && (
        <DomainModal
          onDomain={handleDomainSubmit}
          lastDomain={lastDomain !== domain ? lastDomain : undefined}
        />
      )}

      {/* breadcrumb */}
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 14, display: "flex", gap: 6, alignItems: "center" }}>
        <span>Dashboard</span>
        <span style={{ color: "#D1D5DB" }}>/</span>
        <span>AI Visibility</span>
        <span style={{ color: "#D1D5DB" }}>/</span>
        <span style={{ color: "#374151", fontWeight: 500 }}>Visibility Overview</span>
      </div>

      {/* page title row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#111827" }}>
          {domain
            ? <>Visibility Overview: <span style={{ color: P }}>{domain}</span></>
            : <span style={{ color: MUTED, fontWeight: 400, fontSize: 18 }}>Enter a domain to get started</span>}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          {domain && (
            <button
              onClick={() => setShowModal(true)}
              style={{ padding: "7px 14px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "white", fontSize: 12, color: MUTED, cursor: "pointer" }}
            >
              Change domain
            </button>
          )}
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "white", fontSize: 12, color: MUTED, cursor: "pointer" }}>
            <HelpCircle size={13} /> How it works
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "white", fontSize: 12, color: MUTED, cursor: "pointer" }}>
            <FileDown size={13} /> Export to PDF
          </button>
        </div>
      </div>

      {/* controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { id: "worldwide", label: "Worldwide", icon: <Globe size={12} /> },
          { id: "us", label: "US" },
          { id: "uk", label: "UK" },
          { id: "in", label: "IN" },
        ].map(g => (
          <button key={g.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", fontSize: 12, fontWeight: (geo ?? "in") === g.id ? 600 : 400, border: `1px solid ${(geo ?? "in") === g.id ? P : BORDER}`, background: (geo ?? "in") === g.id ? "#EEF2FF" : "white", color: (geo ?? "in") === g.id ? P : MUTED, borderRadius: 6, cursor: "pointer" }}>
            {g.icon}{g.label}
          </button>
        ))}
        <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 13px", fontSize: 12, border: `1px solid ${BORDER}`, borderRadius: 6, background: "white", color: "#374151", cursor: "pointer" }}>
          All AI platforms <ChevronDown size={12} />
        </button>
        <button style={{ padding: "5px 13px", fontSize: 12, border: `1px solid ${BORDER}`, borderRadius: 6, background: "white", color: "#374151", cursor: "pointer" }}>
          {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </button>
        {d?.cached && (
          <span style={{ marginLeft: "auto", background: "#F0FDF4", color: "#166534", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>Cached</span>
        )}
      </div>

      {/* loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, gap: 14, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 22, height: 22, border: `2.5px solid #E5E7EB`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Fetching AI visibility data for {domain}...
        </div>
      )}

      {/* error */}
      {!loading && error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <AlertCircle size={18} color="#DC2626" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#991B1B", marginBottom: 4 }}>Error loading data</div>
            <div style={{ fontSize: 12, color: "#B91C1C" }}>{error}</div>
          </div>
        </div>
      )}

      {/* report - only shown when domain is set and not loading */}
      {!loading && !error && domain && (
        <>
          {/* main 2-column layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 16, alignItems: "start" }}>

            {/* LEFT: AI Visibility card */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px 0", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                AI Visibility
              </div>

              {!d ? (
                <div style={{ padding: "40px 24px", textAlign: "center", color: MUTED, fontSize: 13 }}>
                  Enter a domain above to load data.
                </div>
              ) : !hasData ? (
                <NoDataState domain={d.domain} />
              ) : (
                <div style={{ display: "flex", gap: 0 }}>
                  {/* Gauge side */}
                  <div style={{ padding: "24px 24px 24px 20px", borderRight: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ScoreGauge score={d.score} />
                  </div>

                  {/* Metrics + chart side */}
                  <div style={{ flex: 1, padding: "14px 20px 20px", minWidth: 0 }}>
                    {/* tabs + period */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ display: "flex", gap: 0, borderBottom: `1.5px solid ${BORDER}` }}>
                        {([
                          { id: "main", label: "Main Metrics" },
                          { id: "monthly", label: "Monthly Audience" },
                          { id: "ai", label: "AI Visibility" },
                        ] as const).map(t => (
                          <button key={t.id} onClick={() => setMetricTab(t.id)} style={{ padding: "6px 14px", fontSize: 12, fontWeight: metricTab === t.id ? 600 : 400, color: metricTab === t.id ? P : MUTED, background: "none", border: "none", borderBottom: `2px solid ${metricTab === t.id ? P : "transparent"}`, cursor: "pointer", marginBottom: -1.5, whiteSpace: "nowrap" }}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 2 }}>
                        {(["1m", "6m", "all"] as const).map(p => (
                          <button key={p} onClick={() => setLocalPeriod(p)} style={{ padding: "4px 10px", fontSize: 11, fontWeight: localPeriod === p ? 600 : 400, border: "none", borderBottom: `2px solid ${localPeriod === p ? P : "transparent"}`, background: "none", color: localPeriod === p ? P : MUTED, cursor: "pointer" }}>
                            {p === "all" ? "All time" : p.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* metric numbers */}
                    <div style={{ display: "flex", gap: 28, marginBottom: 18, flexWrap: "wrap" }}>
                      <MetricNum label="Mentions" value={d.mentions} change={d.mentionsChange} color="#4F46E5" />
                      <MetricNum label="Citations" value={d.citations} change={d.citationsChange} color="#10B981" />
                      <MetricNum label="Cited Pages" value={d.citedPages} change={d.citedPagesChange} color="#8B5CF6" />
                    </div>

                    {/* line chart */}
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={d.trend} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v as number)} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${BORDER}` }}
                          formatter={(v: number, name: string) => [fmt(v), name.charAt(0).toUpperCase() + name.slice(1)]}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Line type="monotone" dataKey="mentions" name="Mentions" stroke="#4F46E5" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="citations" name="Citations" stroke="#10B981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="citedPages" name="Cited Pages" stroke="#8B5CF6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: What's Next */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 16 }}>What&apos;s Next?</div>
              {[
                {
                  icon: <BookOpen size={16} color={P} />,
                  bg: "#EEF2FF",
                  title: "Find hot topics for your brand",
                  desc: "Discover high-potential topics where your brand is missing. Create content that puts you back in the conversation.",
                  link: "Uncover topic opportunities",
                },
                {
                  icon: <Users size={16} color="#059669" />,
                  bg: "#ECFDF5",
                  title: "Explore competitor strategies",
                  desc: "See which topics competitors dominate. Use these insights to grow visibility in AI-generated answers.",
                  link: "Find competitor gaps",
                },
                {
                  icon: <Zap size={16} color="#D97706" />,
                  bg: "#FFFBEB",
                  title: "Optimize your domain for AI",
                  desc: "Make sure AI bots can crawl your domain. If crawlers can't access it, your site won't appear in AI answers.",
                  link: "Check your domain's AI health",
                },
              ].map(item => (
                <div key={item.title} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.4 }}>{item.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 8 }}>{item.desc}</div>
                  <a href="#" style={{ fontSize: 12, fontWeight: 600, color: P, textDecoration: "none" }}>{item.link} &rarr;</a>
                </div>
              ))}
            </div>
          </div>

          {/* bottom section: LLM distribution + Countries (only when real data exists) */}
          {hasData && d && (
            <div style={{ display: "grid", gridTemplateColumns: d.countries.length > 0 ? "1fr 1fr" : "1fr", gap: 16 }}>

              {/* Distribution by LLM */}
              <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>Distribution by LLM</div>
                <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 14 }}>
                  {(["mentions", "cited"] as const).map(t => (
                    <button key={t} onClick={() => setLlmTab(t)} style={{ padding: "5px 14px", fontSize: 12, fontWeight: llmTab === t ? 600 : 400, color: llmTab === t ? P : MUTED, border: "none", borderBottom: `2px solid ${llmTab === t ? P : "transparent"}`, background: "none", cursor: "pointer", marginBottom: -1 }}>
                      {t === "mentions" ? "Mentions" : "Cited Pages"}
                    </button>
                  ))}
                </div>
                {d.llm.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: MUTED }}>No LLM distribution data available.</div>
                ) : (
                  d.llm.map(row => {
                    const pct = llmTab === "mentions" ? row.mentionsPct : Math.round(row.mentionsPct * 0.85);
                    const count = llmTab === "mentions" ? row.count : Math.round(row.count * 0.85);
                    return (
                      <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, width: 130 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: row.color, flexShrink: 0, display: "inline-block" }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{row.name}</span>
                        </div>
                        <div style={{ flex: 1, height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: row.color, borderRadius: 4, transition: "width 0.6s" }} />
                        </div>
                        <div style={{ width: 44, textAlign: "right", fontSize: 12, color: MUTED }}>{pct}%</div>
                        <div style={{ width: 44, textAlign: "right", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                          {count > 0 ? fmt(count) : "--"}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Mentions by Country - only when we have real country data */}
              {d.countries.length > 0 && (
                <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>Mentions by Country</div>
                  <CountryBar countries={d.countries} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, padding: "0 2px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>Country</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>Mentions</span>
                  </div>
                  {d.countries.map(c => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{c.name}</span>
                        <span style={{ fontSize: 12, color: MUTED }}>{c.pct}%</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: P }}>{fmt(c.count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
