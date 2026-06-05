import { useState } from "react";
import { getToken } from "@/lib/auth";
import { X, Plus, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const SUCCESS = "#059669";
const DANGER = "#DC2626";
const WARNING = "#D97706";

/* ───── Types ───── */
interface DomainResult {
  domain: string;
  brandName: string;
  bestKeyword: string;
  mentions: number;
  citedPages: number;
  score: number;
  isYou: boolean;
}
interface TrendPoint { date: string; mentions: number; score: number }
interface TrendSeries { domain: string; points: TrendPoint[] }
interface TopicRow {
  topic: string;
  yourMentions: number;
  compMentions: number;
  aiVolume: number;
  status: "unique" | "missing" | "shared";
}
interface TopicCounts { all: number; missing: number; shared: number; unique: number }
interface CompData {
  domains: DomainResult[];
  trend: TrendSeries[];
  topics: TopicRow[];
  topicCounts: TopicCounts;
  insights: string[];
  cached: boolean;
}

const DOMAIN_COLORS = [P, "#10B981", "#F59E0B", "#EF4444"];

/* ───── Trend Chart ───── */
function TrendChart({ trend }: { trend: TrendSeries[] }) {
  if (!trend.length) return null;

  const W = 560; const H = 160; const PX = 36; const PY = 12;
  const cw = W - PX * 2; const ch = H - PY * 2 - 20;

  // Collect all score points
  const allPoints = trend.flatMap(s => s.points.map(p => p.score));
  const maxVal = Math.max(...allPoints, 10);

  // Build month labels from all dates across all series
  const allDates = [...new Set(trend.flatMap(s => s.points.map(p => p.date)))].sort();
  const monthLabels = allDates.map(d => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short" });
  });
  // Deduplicate consecutive same months
  const deduped: string[] = [];
  for (const m of monthLabels) {
    if (deduped[deduped.length - 1] !== m) deduped.push(m);
  }

  const pts = (series: TrendSeries) => {
    if (!series.points.length) return "";
    return series.points.map((p, i) => {
      const x = PX + (i / Math.max(series.points.length - 1, 1)) * cw;
      const y = PY + ch - (p.score / maxVal) * ch;
      return `${x},${y}`;
    }).join(" ");
  };

  const labelPositions = deduped.map((_, i) => PX + (i / Math.max(deduped.length - 1, 1)) * cw);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxHeight: H }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(v => {
          const y = PY + ch - (v / maxVal) * ch;
          if (y < PY || y > PY + ch) return null;
          return (
            <line key={v} x1={PX} x2={PX + cw} y1={y} y2={y}
              stroke="#F3F4F6" strokeWidth={1} />
          );
        })}
        {trend.map((s, si) => {
          const p = pts(s);
          if (!p) return null;
          return (
            <polyline key={si} points={p} fill="none"
              stroke={DOMAIN_COLORS[si % DOMAIN_COLORS.length]}
              strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          );
        })}
        {/* Month labels */}
        {labelPositions.map((x, i) => (
          <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize={10} fill={MUTED}>{deduped[i]}</text>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
        {trend.map((s, i) => (
          <div key={s.domain} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: DOMAIN_COLORS[i % DOMAIN_COLORS.length] }} />
            <span style={{ color: "#111827" }}>{s.domain}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
        Trend lines reflect monthly AI mention volume. Historical tracking builds over time.
      </div>
    </div>
  );
}

/* ───── Topics Table ───── */
type TopicFilter = "all" | "missing" | "shared" | "unique";

function TopicsTable({ topics, counts, yourDomain, compDomain }: {
  topics: TopicRow[];
  counts: TopicCounts;
  yourDomain: string;
  compDomain?: string;
}) {
  const [filter, setFilter] = useState<TopicFilter>("all");
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  const filtered = filter === "all" ? topics : topics.filter(t => t.status === filter);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const visible = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const chips: Array<{ key: TopicFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: counts.all },
    { key: "missing", label: "Missing", count: counts.missing },
    { key: "shared", label: "Shared", count: counts.shared },
    { key: "unique", label: "Unique", count: counts.unique },
  ];

  const chipStyle = (active: boolean, key: TopicFilter) => ({
    padding: "5px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: `1px solid ${active ? P : BORDER}`,
    background: active ? "#EEF2FF" : "white",
    color: active ? P : MUTED,
  });

  const rowBg = (status: TopicRow["status"]) =>
    status === "missing" ? "#FFF5F5" : status === "unique" ? "#F0FDF4" : "white";

  const fmtVol = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(v);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {chips.map(c => (
          <button key={c.key} style={chipStyle(filter === c.key, c.key)}
            onClick={() => { setFilter(c.key); setPage(0); }}>
            {c.label} {c.count}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 20px", color: MUTED, fontSize: 13 }}>No topics found for this filter.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}` }}>Topic</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{yourDomain}</th>
                {compDomain && (
                  <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{compDomain}</th>
                )}
                <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>AI Volume</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <tr key={i} style={{ background: rowBg(row.status) }}>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, maxWidth: 400, lineHeight: 1.4 }}>
                    {row.topic}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "center" }}>
                    {row.yourMentions > 0
                      ? <span style={{ background: "#D1FAE5", color: SUCCESS, borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>Yes</span>
                      : <span style={{ background: "#FEE2E2", color: DANGER, borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>No</span>
                    }
                  </td>
                  {compDomain && (
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "center" }}>
                      {row.compMentions > 0
                        ? <span style={{ background: "#D1FAE5", color: SUCCESS, borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>Yes</span>
                        : <span style={{ background: "#F3F4F6", color: MUTED, borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>No</span>
                      }
                    </td>
                  )}
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>
                    {fmtVol(row.aiVolume)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 12, fontSize: 12, color: MUTED }}>
              <span>{page * PER_PAGE + 1}-{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length}</span>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 8px", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1, display: "flex", alignItems: "center" }}>
                <ChevronLeft size={13} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 8px", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", opacity: page >= totalPages - 1 ? 0.4 : 1, display: "flex", alignItems: "center" }}>
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───── Insights Panel ───── */
function InsightsPanel({ insights, compDomain }: { insights: string[]; compDomain?: string }) {
  const [idx, setIdx] = useState(0);
  if (!insights.length) {
    return (
      <div style={{ textAlign: "center", padding: "30px 16px", color: MUTED, fontSize: 13 }}>
        {compDomain
          ? "Add a competitor domain and run Analyze to get AI-generated insights."
          : "Competitor insights will appear here after analysis."}
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.65, marginBottom: 20, minHeight: 80 }}>
        {insights[idx]}
      </div>
      {insights.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
            style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 8px", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.4 : 1, display: "flex" }}>
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontSize: 11, color: MUTED }}>{idx + 1}/{insights.length}</span>
          <button onClick={() => setIdx(i => Math.min(insights.length - 1, i + 1))} disabled={idx >= insights.length - 1}
            style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 8px", cursor: idx >= insights.length - 1 ? "not-allowed" : "pointer", opacity: idx >= insights.length - 1 ? 0.4 : 1, display: "flex" }}>
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ───── Loading Steps ───── */
function LoadingSteps({ domains }: { domains: string[] }) {
  const steps = [
    `Fetching AI visibility for ${domains.join(" vs ")}...`,
    "Loading mention trends...",
    "Comparing topics and prompts...",
    "Generating competitor insights...",
  ];
  return (
    <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "40px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#374151" }}>
          <div style={{ width: 18, height: 18, border: `2px solid ${i === 0 ? P : BORDER}`, borderTopColor: i === 0 ? "transparent" : undefined, borderRadius: "50%", animation: i === 0 ? "spin 0.8s linear infinite" : undefined, flexShrink: 0 }} />
          {s}
        </div>
      ))}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ───── Main Component ───── */
export function CompetitorResearch({ initialDomain }: { initialDomain: string }) {
  const [mainDomain, setMainDomain] = useState(initialDomain);
  const [competitors, setCompetitors] = useState([""]);
  const [data, setData] = useState<CompData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDomains, setLoadingDomains] = useState<string[]>([]);

  const addCompetitor = () => { if (competitors.length < 3) setCompetitors([...competitors, ""]); };
  const removeCompetitor = (i: number) => setCompetitors(competitors.filter((_, idx) => idx !== i));
  const setComp = (i: number, v: string) => setCompetitors(competitors.map((c, idx) => idx === i ? v : c));

  const analyze = async (forceRescan = false) => {
    const allDomains = [mainDomain.trim(), ...competitors.map(c => c.trim())].filter(Boolean);
    if (allDomains.length < 2) { setError("Enter at least one competitor domain."); return; }
    setError(null);
    setLoading(true);
    setLoadingDomains(allDomains);
    if (forceRescan) setData(null);
    const token = getToken();
    try {
      const r = await fetch("/api/dataforseo/competitor-research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          yourDomain: allDomains[0],
          competitorDomains: allDomains.slice(1),
        }),
      });
      const json = await r.json() as CompData & { error?: string };
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch competitor data. Check your DataForSEO credentials.");
    } finally {
      setLoading(false);
    }
  };

  const fmtNum = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);

  const yourDomain = data?.domains[0]?.domain ?? mainDomain;
  const compDomain = data?.domains[1]?.domain;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Competitor Research</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Compare AI visibility across domains</div>

      {/* Domain inputs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: `1.5px solid ${P}`, borderRadius: 8, padding: "8px 12px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: P, textTransform: "uppercase", letterSpacing: "0.06em" }}>You</span>
          <input type="text" value={mainDomain} onChange={e => setMainDomain(e.target.value)}
            onKeyDown={e => e.key === "Enter" && analyze()}
            placeholder="yourdomain.com"
            style={{ border: "none", outline: "none", fontSize: 13, width: 160, color: "#111827", background: "transparent" }} />
        </div>

        {competitors.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.06em" }}>vs</span>
            <input type="text" value={c} onChange={e => setComp(i, e.target.value)}
              onKeyDown={e => e.key === "Enter" && analyze()}
              placeholder={`Competitor ${i + 1}`}
              style={{ border: "none", outline: "none", fontSize: 13, width: 150, color: "#111827", background: "transparent" }} />
            <button onClick={() => removeCompetitor(i)}
              style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", alignItems: "center", padding: 0 }}>
              <X size={13} />
            </button>
          </div>
        ))}

        {competitors.length < 3 && (
          <button onClick={addCompetitor}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "white", border: `1.5px dashed ${BORDER}`, borderRadius: 8, padding: "9px 14px", fontSize: 12, color: MUTED, cursor: "pointer" }}>
            <Plus size={13} /> Add competitor
          </button>
        )}

        <button onClick={() => analyze()} disabled={loading}
          style={{ padding: "9px 22px", background: loading ? "#C7D2FE" : P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Analyzing..." : "Analyze"}
        </button>

        {data && !loading && (
          <>
            <button onClick={() => analyze(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "white", border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: MUTED, cursor: "pointer" }}>
              <RefreshCw size={12} /> Rescan
            </button>
            <button onClick={() => { setData(null); setError(null); setCompetitors([""]); }}
              style={{ padding: "9px 14px", background: "white", border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: MUTED, cursor: "pointer" }}>
              Clear
            </button>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
          <AlertCircle size={15} color="#DC2626" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center", color: MUTED }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Add a competitor domain to compare</div>
          <div style={{ fontSize: 13 }}>Enter your domain and at least one competitor, then click Analyze.</div>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSteps domains={loadingDomains} />}

      {/* Results */}
      {data && !loading && (
        <>
          {/* Score cards */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {data.domains.map((d, i) => {
              const delta = i > 0 ? d.score - (data.domains[0]?.score ?? 0) : null;
              return (
                <div key={d.domain} style={{
                  background: "white",
                  border: `1.5px solid ${d.isYou ? P : BORDER}`,
                  borderRadius: 10,
                  padding: "16px 24px",
                  minWidth: 160,
                  position: "relative",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: d.isYou ? P : MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    {d.isYou ? "You" : "Competitor"}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 42, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{d.score}</span>
                    {delta !== null && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: delta > 0 ? DANGER : SUCCESS }}>
                        {delta > 0 ? `+${delta}` : String(delta)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{d.domain}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{fmtNum(d.mentions)} AI mentions</div>
                  {data.cached && i === 0 && (
                    <span style={{ position: "absolute", top: 10, right: 10, fontSize: 10, fontWeight: 600, color: WARNING, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "1px 6px" }}>
                      Cached
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Trend + Insights */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 16 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>AI Visibility Trend</div>
              {data.trend.some(t => t.points.length > 0)
                ? <TrendChart trend={data.trend} />
                : <div style={{ textAlign: "center", padding: "30px 0", color: MUTED, fontSize: 13 }}>No trend data available for this period.</div>
              }
            </div>

            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>Competitor Insights</div>
              <InsightsPanel insights={data.insights} compDomain={compDomain} />
            </div>
          </div>

          {/* Topics gap */}
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Topics and Prompts Gap</div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
              Topics where {compDomain ?? "the competitor"} appears vs where you appear.
              <span style={{ marginLeft: 12 }}>
                <span style={{ background: "#FFF5F5", color: DANGER, borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600, marginRight: 6 }}>Missing</span>
                competitor shows, you don't
              </span>
              <span>
                <span style={{ background: "#F0FDF4", color: SUCCESS, borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600, marginLeft: 6, marginRight: 6 }}>Unique</span>
                only you appear
              </span>
            </div>
            {data.topicCounts.all === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 20px", color: MUTED, fontSize: 13 }}>
                No topic data found. This may happen if DataForSEO has limited data for these brand keywords.
              </div>
            ) : (
              <TopicsTable
                topics={data.topics}
                counts={data.topicCounts}
                yourDomain={yourDomain}
                compDomain={compDomain}
              />
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
