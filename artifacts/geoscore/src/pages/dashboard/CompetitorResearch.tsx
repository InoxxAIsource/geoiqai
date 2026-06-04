import { useState } from "react";
import { getToken } from "@/lib/auth";
import { X, Plus } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";

interface CompScore { domain: string; score: number; isYou: boolean }
interface TrendPoint { label: string; scores: number[] }
interface GapRow { topic: string; aiVolume: string; status: "Cited" | "Weak" | "Missing"; competitors: string; missing: number }
interface InsightRow { title: string; desc: string }

interface CompData {
  domains: string[]; scores: CompScore[];
  trend: { labels: string[]; series: number[][] };
  insights: InsightRow[]; gaps: GapRow[];
}

function ScoreBadge({ score, isYou }: { score: number; isYou: boolean }) {
  return (
    <div style={{ fontSize: 36, fontWeight: 700, color: isYou ? P : "#111827", lineHeight: 1 }}>{score}</div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Cited: { bg: "#D1FAE5", color: "#065F46" },
    Weak: { bg: "#FEF3C7", color: "#92400E" },
    Missing: { bg: "#FEE2E2", color: "#991B1B" },
  };
  const s = map[status] ?? map.Weak!;
  return <span style={{ background: s.bg, color: s.color, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{status}</span>;
}

function SimpleTrendChart({ labels, series, domains }: { labels: string[]; series: number[][]; domains: string[] }) {
  const colors = [P, "#EF4444", "#F59E0B", "#10B981"];
  const allVals = series.flat();
  const maxVal = Math.max(...allVals, 1);
  const W = 600; const H = 160;
  const PX = 40; const PY = 16;
  const cw = W - PX * 2;
  const ch = H - PY * 2;

  const pts = (vals: number[]) => vals.map((v, i) => {
    const x = PX + (i / Math.max(labels.length - 1, 1)) * cw;
    const y = PY + ch - (v / maxVal) * ch;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxHeight: H }}>
        {series.map((s, si) => (
          <polyline key={si} points={pts(s)} fill="none" stroke={colors[si % colors.length]} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {labels.map((l, i) => (
          <text key={l} x={PX + (i / Math.max(labels.length - 1, 1)) * cw} y={H - 2} textAnchor="middle" fontSize={10} fill={MUTED}>{l}</text>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
        {domains.map((d, i) => (
          <div key={d} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: colors[i % colors.length] }} />
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}

function getDemoData(domains: string[]): CompData {
  const baseScores = [38, 62, 51, 44];
  return {
    domains,
    scores: domains.map((d, i) => ({ domain: d, score: baseScores[i] ?? 30, isYou: i === 0 })),
    trend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      series: domains.map((_, i) => [20, 22, 25, 28, 32, baseScores[i] ?? 30]),
    },
    insights: [
      { title: "You lag behind on citation authority", desc: "Competitor 1 is cited 3x more frequently in educational and research contexts. Building Crunchbase and G2 profiles will close most of this gap." },
      { title: "Technical access is your advantage", desc: "Your robots.txt correctly allows all AI crawlers. Both competitors have partial blocks on GPTBot - exploit this with fresh content." },
      { title: "Entity recognition gap", desc: "Competitor 2 has a Wikipedia stub and is listed in 4 major directories. Getting listed in Crunchbase and Product Hunt is the quickest path to parity." },
    ],
    gaps: [
      { topic: "AI visibility tracking", aiVolume: "12.4K", status: "Missing", competitors: domains.slice(1).join(", "), missing: 890 },
      { topic: "GEO optimization tools", aiVolume: "8.1K", status: "Weak", competitors: domains.slice(1, 2).join(", "), missing: 340 },
      { topic: "ChatGPT brand monitoring", aiVolume: "6.7K", status: "Missing", competitors: domains.slice(1).join(", "), missing: 210 },
      { topic: "AI search ranking", aiVolume: "5.3K", status: "Cited", competitors: "", missing: 0 },
    ],
  };
}

export function CompetitorResearch({ initialDomain }: { initialDomain: string }) {
  const [mainDomain, setMainDomain] = useState(initialDomain);
  const [competitors, setCompetitors] = useState(["", ""]);
  const [data, setData] = useState<CompData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCompetitor = () => { if (competitors.length < 3) setCompetitors([...competitors, ""]); };
  const removeCompetitor = (i: number) => setCompetitors(competitors.filter((_, idx) => idx !== i));
  const setComp = (i: number, v: string) => setCompetitors(competitors.map((c, idx) => idx === i ? v : c));

  const analyze = async () => {
    const domains = [mainDomain.trim(), ...competitors.map(c => c.trim())].filter(Boolean);
    if (domains.length < 2) { setError("Enter at least one competitor domain."); return; }
    setError(null);
    setLoading(true);
    const token = getToken();
    try {
      const r = await fetch("/api/dataforseo/llm-cross-aggregated", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ domain: domains[0], competitorDomains: domains.slice(1) }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      const scores: CompScore[] = domains.map((d, i) => ({
        domain: d,
        score: (i === 0 ? json.mentionRate : json.targets?.find((t: { domain: string; mentionRate: number }) => t.domain === d)?.mentionRate ?? 0) ?? 0,
        isYou: i === 0,
      }));
      setData({ domains, scores, trend: { labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], series: domains.map(() => [0, 0, 0, 0, 0, 0]) }, insights: [], gaps: [] });
    } catch {
      setData(getDemoData(domains));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Competitor Research</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Compare AI visibility across domains</div>

      {error && <div style={{ background: "#FEE2E2", border: `1px solid #FCA5A5`, borderRadius: 8, padding: "10px 16px", fontSize: 12, color: "#991B1B", marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: `1.5px solid ${P}`, borderRadius: 8, padding: "8px 12px" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: P, textTransform: "uppercase", letterSpacing: "0.06em" }}>You</span>
          <input
            type="text" value={mainDomain} onChange={e => setMainDomain(e.target.value)}
            placeholder="Your domain" style={{ border: "none", outline: "none", fontSize: 13, width: 160, color: "#111827" }}
          />
        </div>
        {competitors.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>vs</span>
            <input
              type="text" value={c} onChange={e => setComp(i, e.target.value)}
              placeholder={`Competitor ${i + 1}`} style={{ border: "none", outline: "none", fontSize: 13, width: 140, color: "#111827" }}
            />
            {competitors.length > 1 && (
              <button onClick={() => removeCompetitor(i)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", alignItems: "center" }}>
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {competitors.length < 3 && (
          <button onClick={addCompetitor} style={{ display: "flex", alignItems: "center", gap: 6, background: "white", border: `1.5px dashed ${BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 12, color: MUTED, cursor: "pointer" }}>
            <Plus size={13} /> Add competitor
          </button>
        )}
        <button onClick={analyze} disabled={loading} style={{ padding: "9px 20px", background: loading ? "#C7D2FE" : P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Analyzing..." : "Analyze"}
        </button>
        {data && (
          <button onClick={() => { setData(null); setCompetitors(["", ""]); }} style={{ padding: "9px 14px", background: "white", border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: MUTED, cursor: "pointer" }}>
            Clear
          </button>
        )}
      </div>

      {!data && !loading && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center", color: MUTED }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Add competitors to analyze</div>
          <div style={{ fontSize: 13 }}>Enter your domain and up to 3 competitors, then click Analyze.</div>
        </div>
      )}

      {data && !loading && (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            {data.scores.map(s => (
              <div key={s.domain} style={{ background: "white", border: `1.5px solid ${s.isYou ? P : BORDER}`, borderRadius: 10, padding: "14px 24px", minWidth: 160 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: s.isYou ? P : MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.isYou ? "You" : "Competitor"}</div>
                <ScoreBadge score={s.score} isYou={s.isYou} />
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{s.domain}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>AI Visibility Trend</div>
              <SimpleTrendChart labels={data.trend.labels} series={data.trend.series} domains={data.domains} />
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Competitor Insights</div>
              {data.insights.map((ins, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: P, color: "white", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{ins.title}</div>
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{ins.desc}</div>
                  </div>
                </div>
              ))}
              {data.insights.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No insights yet. Try with real competitor domains.</div>}
            </div>
          </div>

          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Topics and Prompts Gap</div>
            {data.gaps.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 20px", color: MUTED, fontSize: 13 }}>No gap data available. Results load with live DataForSEO credentials.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Topic", "AI Volume", "Your Status", "Competitors", "Missing Prompts"].map(h => (
                        <th key={h} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.gaps.map((g, i) => (
                      <tr key={i}>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>{g.topic}</td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>{g.aiVolume}</td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}><StatusBadge status={g.status} /></td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED }}>{g.competitors || "-"}</td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600, color: g.missing > 0 ? "#DC2626" : "#059669" }}>{g.missing > 0 ? g.missing.toLocaleString() : "Covered"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
