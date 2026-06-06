import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/auth";
import { Globe, RefreshCw, AlertCircle, FileDown, ChevronRight } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

/* ---- API response types ---- */
interface PlatformRow { key: string; displayName: string; color: string; mentions: number; ai_search_volume: number; pct: number }
interface CountryRow { code: number; name: string; mentions: number; pct: number }
interface CitedSource { domain: string; mentions: number; ai_search_volume: number }
interface CitedPage { url: string; mentions: number; ai_search_volume: number }
interface Topic { question: string; platform: string; model_name: string; ai_search_volume: number; location_code: number }

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
  dateTo: string;
  cached: boolean;
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

/* ===== Domain input modal ===== */
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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EEF2FF", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: P, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 18 }}>
            AI Visibility
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.25, marginBottom: 12, color: "#0F0F0F", letterSpacing: "-0.03em" }}>Check your AI Visibility</h2>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, margin: 0 }}>Enter a domain to see how it appears across ChatGPT, Gemini, Perplexity, and AI Overview.</p>
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
        No LLM mention data for {domain}
      </div>
      <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, marginBottom: 24 }}>
        DataForSEO indexes millions of AI responses but this domain has not appeared as a source yet.
        This usually means the domain is too new, too niche, or not being cited in AI answers.
        Try netflix.com or hubspot.com to verify the connection is working.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <a href="/audit" style={{ display: "inline-block", padding: "10px 24px", background: P, color: "white", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
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
  const [showModal, setShowModal] = useState(!domain);
  const [lastDomain, setLastDomain] = useState<string | undefined>(domain || undefined);
  const [topicsTab, setTopicsTab] = useState<"performing" | "opportunities" | "pages" | "sources">("performing");
  const [pagesPage, setPagesPage] = useState(0);
  const [sourcesPage, setSourcesPage] = useState(0);

  const fetchData = useCallback((d: string, force = false) => {
    if (force) setRescanning(true); else setLoading(true);
    setError(null);
    const token = getToken();
    const url = `/api/dataforseo/visibility-overview?domain=${encodeURIComponent(d)}${force ? "&force=true" : ""}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then((raw: VisibilityData & { error?: string }) => {
        if (raw.error) setError(raw.error);
        else setData(raw);
      })
      .catch(() => setError("Failed to load visibility data. Please try again."))
      .finally(() => { setLoading(false); setRescanning(false); });
  }, []);

  useEffect(() => {
    if (!domain) { setShowModal(true); return; }
    setLastDomain(domain);
    fetchData(domain, false);
  }, [domain, fetchData]);

  const handleDomain = (d: string) => { setShowModal(false); if (onDomainChange) onDomainChange(d); };

  const d = data;

  return (
    <div style={{ maxWidth: 1200 }}>
      {showModal && <DomainModal onDomain={handleDomain} onClose={() => setShowModal(false)} lastDomain={lastDomain !== domain ? lastDomain : undefined} />}

      {/* breadcrumb */}
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 14, display: "flex", gap: 6, alignItems: "center" }}>
        <span>Dashboard</span>
        <ChevronRight size={12} color="#D1D5DB" />
        <span>AI Visibility</span>
        <ChevronRight size={12} color="#D1D5DB" />
        <span style={{ color: "#374151", fontWeight: 500 }}>Visibility Overview</span>
      </div>

      {/* title row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#111827" }}>
          {domain ? <>Visibility Overview: <span style={{ color: P }}>{domain}</span></> : <span style={{ color: MUTED, fontWeight: 400, fontSize: 18 }}>Enter a domain to get started</span>}
        </h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {d?.cached && (
            <span style={{ fontSize: 11, color: "#6B7280", background: "#F3F4F6", padding: "3px 8px", borderRadius: 6 }}>Cached</span>
          )}
          {domain && (
            <>
              <button onClick={() => fetchData(domain, true)} disabled={rescanning || loading}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", border: `1px solid ${rescanning ? P : BORDER}`, borderRadius: 7, background: rescanning ? "#EEF2FF" : "white", fontSize: 12, color: rescanning ? P : MUTED, cursor: rescanning ? "not-allowed" : "pointer" }}>
                <RefreshCw size={12} style={{ animation: rescanning ? "spin 0.8s linear infinite" : "none" }} />
                {rescanning ? "Scanning..." : "Rescan"}
              </button>
              <button onClick={() => setShowModal(true)}
                style={{ padding: "7px 14px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "white", fontSize: 12, color: MUTED, cursor: "pointer" }}>
                Change domain
              </button>
            </>
          )}
          <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "white", fontSize: 12, color: MUTED, cursor: "pointer" }}>
            <Globe size={12} /> Worldwide
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "white", fontSize: 12, color: MUTED, cursor: "pointer" }}>
            <FileDown size={12} /> Export
          </button>
        </div>
      </div>

      {/* date range chip */}
      {d && (
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
          Data from <strong>{d.dateFrom}</strong> to <strong>{d.dateTo}</strong>
          {d.cached && <span style={{ marginLeft: 8, color: "#10B981" }}> (cached)</span>}
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
          {/* hero: score + KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, marginBottom: 16, alignItems: "stretch" }}>

            {/* score gauge card */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16, display: "flex", alignItems: "center", gap: 5 }}>
                AI Visibility Score
                <span title="Score based on AI mention frequency and citation rate across Google AI Overview and ChatGPT. Scale: 0-100." style={{ cursor: "help", color: "#9CA3AF", fontSize: 13, lineHeight: 1 }}>&#9432;</span>
              </div>
              <ScoreGauge score={d.score} />
              {d.score === 0 && d.hasData === false && (
                <div style={{ marginTop: 12, fontSize: 11, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "4px 12px", textAlign: "center" }}>
                  Not appearing in AI results yet
                </div>
              )}
            </div>

            {/* KPIs card */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "24px 28px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 20 }}>Key Metrics</div>
              <div style={{ display: "flex", gap: 32, marginBottom: 28, flexWrap: "wrap" }}>
                <KpiCard label="Mentions" value={d.mentions} color={P} sub={`"${d.brandName}" in AI answers`} />
                <KpiCard label="AI Search Volume" value={d.aiSearchVolume} color="#10B981" sub="Monthly AI searches" />
                <KpiCard label="Citations" value={d.citations} color="#F59E0B" sub="Domain URL cited as source" showZero />
                <KpiCard label="Cited Pages" value={d.citedPagesCount} color="#8B5CF6" sub="Unique pages cited" showZero />
              </div>

              {/* platform mini bars */}
              {d.platforms.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Platform Breakdown</div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {d.platforms.map(p => (
                      <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "#F9FAFB", borderRadius: 8, border: `1px solid ${BORDER}` }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{p.displayName}</span>
                        <span style={{ fontSize: 12, color: MUTED }}>{fmt(p.mentions)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

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
                    <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ width: 160, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.displayName}</span>
                      </div>
                      <div style={{ flex: 1, height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${p.pct}%`, height: "100%", background: p.color, borderRadius: 4, transition: "width 0.6s" }} />
                      </div>
                      <div style={{ width: 48, textAlign: "right", fontSize: 12, color: MUTED }}>{p.pct.toFixed(1)}%</div>
                      <div style={{ width: 48, textAlign: "right", fontSize: 13, fontWeight: 600, color: "#111827" }}>{fmt(p.mentions)}</div>
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
