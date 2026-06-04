import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { getToken } from "@/lib/auth";
import {
  Globe, ChevronDown, FileDown, HelpCircle,
  BookOpen, Users, Zap,
} from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";

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
  return "#DC2626";
}

/* ---- demo data (shown when API has no data) ---- */
const DEMO: VisibilityData = {
  domain: "example.com",
  score: 62,
  mentions: 36300, citations: 17800, citedPages: 11500,
  mentionsChange: "+0.8%", citationsChange: "+2.2%", citedPagesChange: "+0.8%",
  trend: [
    { label: "Jan 2026", mentions: 28000, citations: 13000, citedPages: 8800 },
    { label: "Feb 2026", mentions: 30500, citations: 14800, citedPages: 9400 },
    { label: "Mar 2026", mentions: 32000, citations: 15500, citedPages: 10100 },
    { label: "Apr 2026", mentions: 33800, citations: 16200, citedPages: 10600 },
    { label: "May 2026", mentions: 35100, citations: 17100, citedPages: 11200 },
    { label: "Jun 2026", mentions: 36300, citations: 17800, citedPages: 11500 },
  ],
  llm: [
    { name: "ChatGPT",    color: "#10A37F", mentionsPct: 22.8, count: 8300 },
    { name: "AI Overview", color: "#4285F4", mentionsPct: 14.0, count: 5100 },
    { name: "AI Mode",    color: "#34A853", mentionsPct: 17.8, count: 6500 },
    { name: "Gemini",     color: "#8B5CF6", mentionsPct: 45.4, count: 16500 },
  ],
  countries: [
    { name: "IN",    pct: 93.1, count: 36300, color: "#4F46E5" },
    { name: "US",    pct: 4.0,  count: 1600,  color: "#EF4444" },
    { name: "CA",    pct: 0.5,  count: 191,   color: "#F59E0B" },
    { name: "Other", pct: 2.4,  count: 950,   color: "#9CA3AF" },
  ],
};

/* ===== SVG Circular Gauge ===== */
function ScoreGauge({ score }: { score: number }) {
  const r = 78;
  const cx = 110, cy = 115;
  const total = Math.PI * r;
  const filled = total * (score / 100);
  const gColor = getScoreColor(score);
  const label = getScoreLabel(score);

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
        {/* background arc */}
        <path
          d={`M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`}
          fill="none" stroke="#E5E7EB" strokeWidth="16" strokeLinecap="round"
        />
        {/* filled arc */}
        {score > 0 && (
          <path
            d={`M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`}
            fill="none" stroke="url(#gaugeGrad)" strokeWidth="16" strokeLinecap="round"
            strokeDasharray={`${filled} ${total}`}
          />
        )}
        {/* endpoint dot */}
        {score > 0 && score < 100 && (
          <circle cx={dotX} cy={dotY} r={9} fill="white" stroke={gColor} strokeWidth="3" />
        )}
        {/* score text */}
        <text x={cx} y={cy - 24} textAnchor="middle" fontSize="44" fontWeight="700" fill="#111827" fontFamily="Sora, sans-serif">{score}</text>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fill={MUTED}>/100</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="14" fontWeight="600" fill={gColor}>{label}</text>
      </svg>
      <div style={{ maxWidth: 200, textAlign: "center", fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 4 }}>
        {getScoreDesc(score)}
      </div>
    </div>
  );
}

/* ===== Metric number + change ===== */
function MetricNum({ label, value, change, color }: { label: string; value: number; change: string; color: string }) {
  const isUp = change.startsWith("+");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: "#111827", lineHeight: 1 }}>{fmt(value)}</span>
        {change && (
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

/* ===== Landing hero (shown when no domain) ===== */
function LandingHero({ onDomainChange }: { onDomainChange?: (d: string) => void }) {
  const [input, setInput] = useState("");

  const go = () => {
    const d = input.trim().replace(/^https?:\/\//, "").split("/")[0];
    if (d && onDomainChange) onDomainChange(d);
  };

  return (
    <div style={{
      minHeight: "calc(100vh - 80px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      background: "radial-gradient(ellipse at 75% 20%, rgba(219,182,255,0.35) 0%, transparent 55%), radial-gradient(ellipse at 25% 70%, rgba(134,239,172,0.25) 0%, transparent 50%), radial-gradient(ellipse at 55% 90%, rgba(196,181,253,0.3) 0%, transparent 50%), #FAFAFA",
    }}>
      <div style={{ textAlign: "center", maxWidth: 640, padding: "0 24px", position: "relative", zIndex: 2 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
          AI Visibility
        </div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 20, color: "#0F0F0F", letterSpacing: "-0.03em" }}>
          Win Every Search<br />From Traditional SEO to AI Discovery
        </h1>
        <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
          Track your brand visibility, fix gaps, and grow across Google and AI search - all from one platform.
        </p>
        <div style={{ display: "flex", gap: 0, background: "white", border: `1.5px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.07)", maxWidth: 480, margin: "0 auto" }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && go()}
            placeholder="Enter your domain"
            style={{ flex: 1, padding: "14px 18px", border: "none", outline: "none", fontSize: 15, color: "#111827", background: "transparent" }}
          />
          <button
            onClick={go}
            style={{ padding: "14px 26px", background: P, color: "white", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600, whiteSpace: "nowrap" }}
          >
            Get started
          </button>
        </div>
      </div>
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
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [metricTab, setMetricTab] = useState<"main" | "monthly" | "ai">("main");
  const [llmTab, setLlmTab] = useState<"mentions" | "cited">("mentions");
  const [localPeriod, setLocalPeriod] = useState(period ?? "6m");

  useEffect(() => { if (period) setLocalPeriod(period); }, [period]);

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    setIsDemoMode(false);
    const token = getToken();
    fetch(`/api/dataforseo/visibility-overview?domain=${encodeURIComponent(domain)}&period=${localPeriod}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => {
        if (d.error || d.score === 0) {
          setData({ ...DEMO, domain });
          setIsDemoMode(true);
        } else {
          setData(d);
        }
      })
      .catch(() => { setData({ ...DEMO, domain }); setIsDemoMode(true); })
      .finally(() => setLoading(false));
  }, [domain, localPeriod]);

  /* landing state */
  if (!domain) return <LandingHero onDomainChange={onDomainChange} />;

  const d = data ?? { ...DEMO, domain };

  return (
    <div style={{ maxWidth: 1200 }}>
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
          Visibility Overview: <span style={{ color: P }}>{d.domain}</span>
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
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
        {isDemoMode && (
          <span style={{ marginLeft: "auto", background: "#FEF3C7", color: "#92400E", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>Demo data</span>
        )}
      </div>

      {/* main 2-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 16, alignItems: "start" }}>

        {/* LEFT: AI Visibility card */}
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          {/* card label */}
          <div style={{ padding: "14px 20px 0", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            AI Visibility
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED, fontSize: 14 }}>
              <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Loading data...
            </div>
          ) : (
            <div style={{ display: "flex", gap: 0 }}>
              {/* Gauge */}
              <div style={{ padding: "24px 24px 24px 20px", borderRight: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ScoreGauge score={d.score} />
              </div>

              {/* Metrics + chart */}
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
              desc: "Discover high-potential topics where your brand is missing. Create content that puts you back in the conversation and boosts your AI visibility.",
              link: "Uncover topic opportunities",
            },
            {
              icon: <Users size={16} color="#059669" />,
              bg: "#ECFDF5",
              title: "Explore competitor strategies",
              desc: "See which topics competitors dominate and where they publish. Use these insights to create content and grow visibility in AI-generated answers.",
              link: "Find competitor gaps",
            },
            {
              icon: <Zap size={16} color="#D97706" />,
              bg: "#FFFBEB",
              title: "Optimize your domain for AI",
              desc: "Make sure AI bots can crawl your domain and use your content. If crawlers can't access it, your site won't appear in AI answers.",
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

      {/* bottom 2-column: LLM distribution + Countries */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

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
          {d.llm.map(row => (
            <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: 130 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: row.color, flexShrink: 0, display: "inline-block" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{row.name}</span>
              </div>
              <div style={{ flex: 1, height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${row.mentionsPct}%`, height: "100%", background: row.color, borderRadius: 4, transition: "width 0.8s" }} />
              </div>
              <div style={{ width: 48, textAlign: "right", fontSize: 12, color: MUTED }}>{row.mentionsPct}%</div>
              <div style={{ width: 44, textAlign: "right", fontSize: 13, fontWeight: 600, color: "#111827" }}>{fmt(row.count)}</div>
            </div>
          ))}
        </div>

        {/* Mentions by Country */}
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
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
