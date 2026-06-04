import { useState } from "react";
import { getToken } from "@/lib/auth";
import { X, Plus, AlertCircle } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

interface CompScore { domain: string; score: number; isYou: boolean }
interface InsightRow { title: string; desc: string }
interface GapRow { topic: string; aiVolume: string; status: "Cited" | "Weak" | "Missing"; competitors: string; missing: number }

interface CompData {
  domains: string[];
  scores: CompScore[];
  trend: { labels: string[]; series: number[][] };
  insights: InsightRow[];
  gaps: GapRow[];
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
      <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
        Trend lines reflect current snapshot. Historical tracking builds over time as you monitor these domains.
      </div>
    </div>
  );
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

      const domainScores: CompScore[] = domains.map((d, i) => ({
        domain: d,
        score: i === 0
          ? Math.round((json.mentionRate ?? 0) * 100)
          : Math.round((json.targets?.find((t: { domain: string; mentionRate: number }) => t.domain === d)?.mentionRate ?? 0) * 100),
        isYou: i === 0,
      }));

      const trendLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
      const trendSeries = domainScores.map(s => Array(6).fill(s.score) as number[]);

      setData({
        domains,
        scores: domainScores,
        trend: { labels: trendLabels, series: trendSeries },
        insights: [],
        gaps: [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch competitor data. Check your DataForSEO credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Competitor Research</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Compare AI visibility across domains</div>

      {error && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
          <AlertCircle size={15} color="#DC2626" />
          {error}
        </div>
      )}

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
          <button onClick={() => { setData(null); setError(null); setCompetitors(["", ""]); }} style={{ padding: "9px 14px", background: "white", border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: MUTED, cursor: "pointer" }}>
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

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Fetching AI visibility data from DataForSEO...
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
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>AI Visibility Snapshot</div>
              <SimpleTrendChart labels={data.trend.labels} series={data.trend.series} domains={data.domains} />
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Competitor Insights</div>
              <div style={{ textAlign: "center", padding: "30px 20px", color: MUTED, fontSize: 13 }}>
                AI-generated insights are available after running a full audit. Click "Run free audit" from the main page to get detailed recommendations.
              </div>
            </div>
          </div>

          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Topics and Prompts Gap</div>
            {data.gaps.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 20px", color: MUTED, fontSize: 13 }}>
                Topic-level gap analysis is generated from the full AI audit. Run an audit on your domain to see which topics your competitors are winning.
              </div>
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
