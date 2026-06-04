import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from "lucide-react";

interface LLMRow { name: string; mentionsPct: number; citedPct: number }
interface TopicRow {
  topic: string; visibility: number; mentions: number;
  aiVolume: string; intent: string; samplePrompt: string; aiResponse: string;
  brands: number; sources: number;
}
interface CitedPage { url: string; prompts: number; aiVolume: string }
interface TrendPoint { label: string; citations: number; mentions: number }

interface VisibilityData {
  domain: string; score: number; mentions: number; citations: number; citedPages: number;
  mentionsChange: string; citationsChange: string; citedPagesChange: string;
  llm: LLMRow[]; topics: TopicRow[]; citedPagesList: CitedPage[]; trend: TrendPoint[];
}

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";

function KCard({ label, value, change }: { label: string; value: string | number; change?: string }) {
  const isUp = change?.startsWith("+");
  const isDown = change?.startsWith("-");
  return (
    <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {change && (
        <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4, display: "flex", alignItems: "center", gap: 4, color: isUp ? "#059669" : isDown ? "#DC2626" : MUTED }}>
          {isUp ? <TrendingUp size={12} /> : isDown ? <TrendingDown size={12} /> : <Minus size={12} />}
          {change}
        </div>
      )}
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 60 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>AI Visibility Score</div>
      <div style={{ fontSize: 64, fontWeight: 700, color, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: 12, color: MUTED }}>Top-10% sites: <strong>87</strong></div>
      <div style={{ width: "100%", maxWidth: 200, height: 8, background: BORDER, borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.8s" }} />
      </div>
    </div>
  );
}

function LLMTable({ llm, tab }: { llm: LLMRow[]; tab: "mentions" | "cited" }) {
  return (
    <div>
      {llm.map(row => {
        const val = tab === "mentions" ? row.mentionsPct : row.citedPct;
        return (
          <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ width: 100, fontSize: 13, fontWeight: 500 }}>{row.name}</div>
            <div style={{ flex: 1, height: 8, background: BORDER, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${val}%`, height: "100%", background: P, borderRadius: 4, transition: "width 0.8s" }} />
            </div>
            <div style={{ width: 44, textAlign: "right", fontSize: 13, fontWeight: 600 }}>{val}%</div>
          </div>
        );
      })}
    </div>
  );
}

const DEMO_DATA: VisibilityData = {
  domain: "yourdomain.com", score: 0, mentions: 0, citations: 0, citedPages: 0,
  mentionsChange: "", citationsChange: "", citedPagesChange: "",
  llm: [
    { name: "ChatGPT", mentionsPct: 0, citedPct: 0 },
    { name: "Gemini", mentionsPct: 0, citedPct: 0 },
    { name: "Perplexity", mentionsPct: 0, citedPct: 0 },
    { name: "Claude", mentionsPct: 0, citedPct: 0 },
  ],
  topics: [], citedPagesList: [],
  trend: [
    { label: "Jan", citations: 0, mentions: 0 },
    { label: "Feb", citations: 0, mentions: 0 },
    { label: "Mar", citations: 0, mentions: 0 },
    { label: "Apr", citations: 0, mentions: 0 },
    { label: "May", citations: 0, mentions: 0 },
    { label: "Jun", citations: 0, mentions: 0 },
  ],
};

export function VisibilityOverview({ domain }: { domain: string }) {
  const [data, setData] = useState<VisibilityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [llmTab, setLlmTab] = useState<"mentions" | "cited">("mentions");
  const [topTab, setTopTab] = useState<"performing" | "sources" | "cited-pages">("performing");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [period, setPeriod] = useState("1m");
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    setIsDemoMode(false);
    const token = getToken();
    fetch(`/api/dataforseo/visibility-overview?domain=${encodeURIComponent(domain)}&period=${period}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setData({ ...DEMO_DATA, domain });
          setIsDemoMode(true);
        } else {
          setData(d);
        }
      })
      .catch(() => { setData({ ...DEMO_DATA, domain }); setIsDemoMode(true); })
      .finally(() => setLoading(false));
  }, [domain, period]);

  const d = data ?? { ...DEMO_DATA, domain };

  const tabs: { id: "performing" | "sources" | "cited-pages"; label: string }[] = [
    { id: "performing", label: "Performing Topics" },
    { id: "sources", label: "Cited Sources" },
    { id: "cited-pages", label: "Cited Pages" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            Visibility Overview: <span style={{ color: P }}>{d.domain}</span>
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>
            Data as of {new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" })} - All AI platforms
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["1m", "6m", "all"].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 500, border: `1.5px solid ${p === period ? P : BORDER}`, background: p === period ? "#EEF2FF" : "white", color: p === period ? P : MUTED, borderRadius: 6, cursor: "pointer" }}>
              {p === "all" ? "All time" : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {isDemoMode && (
        <div style={{ background: "#FEF3C7", border: `1px solid #F59E0B`, borderRadius: 8, padding: "10px 16px", fontSize: 12, color: "#92400E", marginBottom: 16 }}>
          Demo mode - live data loads with your DataForSEO credentials configured in the server.
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Loading visibility data...
        </div>
      )}

      {!loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ScoreGauge score={d.score} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignContent: "start" }}>
              <KCard label="Mentions" value={d.mentions} change={d.mentionsChange} />
              <KCard label="Citations" value={d.citations} change={d.citationsChange} />
              <KCard label="Cited Pages" value={d.citedPages} change={d.citedPagesChange} />
              <div style={{ background: "#EEF2FF", border: `1px solid #C7D2FE`, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: P, textTransform: "uppercase", letterSpacing: "0.06em" }}>Quick action</div>
                <div style={{ fontSize: 13, color: "#3730A3", lineHeight: 1.5, marginTop: 8 }}>Run a full audit to improve your score</div>
                <a href="/audit" style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: P, textDecoration: "none" }}>Free audit &rarr;</a>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Distribution by LLM</div>
              <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
                {(["mentions", "cited"] as const).map(t => (
                  <button key={t} onClick={() => setLlmTab(t)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 500, border: "none", borderBottom: `2px solid ${llmTab === t ? P : "transparent"}`, background: "none", color: llmTab === t ? P : MUTED, cursor: "pointer" }}>
                    {t === "mentions" ? "Mentions" : "Cited Pages"}
                  </button>
                ))}
              </div>
              <LLMTable llm={d.llm} tab={llmTab} />
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>What&apos;s next</div>
              {[
                { title: "Rank for your topic", desc: "Use Prompt Research to find AI search opportunities in your niche.", href: "#", page: "prompt-research" },
                { title: "See how AI sees your brand", desc: "Review perception, sentiment and narrative drivers in Brand Performance.", href: "#", page: "brand-performance" },
                { title: "Fix AI search issues", desc: "Fix crawl and schema issues to boost AI platform citations.", href: "#", page: "site-audit" },
              ].map(item => (
                <div key={item.title} style={{ padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Topics and Sources</div>
            </div>
            <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 16 }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setTopTab(tab.id)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: topTab === tab.id ? 600 : 400, color: topTab === tab.id ? P : MUTED, background: "none", border: "none", borderBottom: `2px solid ${topTab === tab.id ? P : "transparent"}`, cursor: "pointer", marginBottom: -1 }}>
                  {tab.label} {tab.id === "performing" && <span style={{ background: "#EEF2FF", color: P, borderRadius: 10, padding: "1px 7px", fontSize: 10, marginLeft: 4 }}>{d.topics.length}</span>}
                </button>
              ))}
            </div>

            {topTab === "performing" && d.topics.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: MUTED, fontSize: 13 }}>
                No topic data yet. Run a full audit or wait for DataForSEO data to load.
              </div>
            )}
            {topTab === "performing" && d.topics.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Topic", "Visibility", "Mentions", "AI Volume", "Intent"].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.topics.map((t, i) => (
                    <>
                      <tr key={i} style={{ cursor: "pointer" }} onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                          <span style={{ marginRight: 8, color: P }}>{expandedIdx === i ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                          {t.topic}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${t.visibility}%`, height: "100%", background: P, borderRadius: 3 }} />
                            </div>
                            {t.visibility}%
                          </div>
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>{t.mentions}</td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>{t.aiVolume}</td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                          <span style={{ background: "#EEF2FF", color: P, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{t.intent}</span>
                        </td>
                      </tr>
                      {expandedIdx === i && (
                        <tr key={`exp-${i}`}>
                          <td colSpan={5} style={{ background: BG, padding: 0 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: 16 }}>
                              <div><div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Sample prompt</div><div style={{ fontSize: 12, lineHeight: 1.6 }}>{t.samplePrompt || "No sample prompt"}</div></div>
                              <div><div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>AI response preview</div><div style={{ fontSize: 12, lineHeight: 1.6 }}>{t.aiResponse || "No response data"}</div></div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}

            {topTab === "cited-pages" && d.citedPagesList.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: MUTED, fontSize: 13 }}>No cited pages data available yet.</div>
            )}
            {topTab === "cited-pages" && d.citedPagesList.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["URL", "Prompt Count", "AI Volume", "Status"].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.citedPagesList.map((p, i) => (
                    <tr key={i}>
                      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, color: P }}>{p.url}</td>
                      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>{p.prompts}</td>
                      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>{p.aiVolume}</td>
                      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                        <span style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>Cited</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {topTab === "sources" && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: MUTED, fontSize: 13 }}>
                Source data loads with live DataForSEO integration.
              </div>
            )}
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
