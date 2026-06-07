import React, { useState } from "react";
import { getToken } from "@/lib/auth";
import { X, Plus, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Lock } from "lucide-react";

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
type TopicStatus = "unique" | "missing" | "shared" | "weak" | "strong";
interface TopicRow {
  topic: string;
  yourMentions: number;
  compMentions: number;
  yourAiVolume: number;
  compAiVolume: number;
  aiVolume: number;
  status: TopicStatus;
}
interface TopicCounts { all: number; missing: number; weak: number; shared: number; strong: number; unique: number }
interface SourceRow { domain: string; count: number }
interface PromptItem {
  prompt: string;
  answer: string;
  sources: string[];
  brandEntities: Array<{ name: string }>;
  fanOutQueries: string[];
  aiSearchVolume: number;
}
interface CompData {
  domains: DomainResult[];
  trend: TrendSeries[];
  topics: TopicRow[];
  topicCounts: TopicCounts;
  insights: string[];
  sources: SourceRow[];
  cached: boolean;
}

const DOMAIN_COLORS = [P, "#10B981", "#F59E0B", "#EF4444"];

/* ───── Trend Chart ───── */
function TrendChart({ trend }: { trend: TrendSeries[] }) {
  if (!trend.length) return null;

  const W = 560; const H = 160; const PX = 6; const PY = 12;
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
        {/* Month labels - first/last anchored to edges so text doesn't clip */}
        {labelPositions.map((x, i) => (
          <text key={i} x={x} y={H - 4}
            textAnchor={i === 0 ? "start" : i === deduped.length - 1 ? "end" : "middle"}
            fontSize={10} fill={MUTED}>{deduped[i]}</text>
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
type TopicFilter = "all" | "missing" | "weak" | "shared" | "strong" | "unique";

const fmtVol = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(v);

const CHIP_COLORS: Record<TopicFilter, { bg: string; color: string; border: string }> = {
  all:     { bg: "#EEF2FF", color: P,       border: P },
  missing: { bg: "#FEF2F2", color: DANGER,  border: "#FECACA" },
  weak:    { bg: "#FFF7ED", color: WARNING, border: "#FED7AA" },
  shared:  { bg: "#F9FAFB", color: MUTED,   border: BORDER },
  strong:  { bg: "#F0FDF4", color: SUCCESS, border: "#BBF7D0" },
  unique:  { bg: "#ECFDF5", color: "#065F46", border: "#6EE7B7" },
};

const ROW_BG: Record<TopicStatus, string> = {
  missing: "#FFF5F5",
  weak:    "#FFFBF0",
  shared:  "white",
  strong:  "#F6FFF8",
  unique:  "#F0FDF4",
};

function TopicsTable({ topics, counts, yourDomain, compDomain, sources = [], plan, onNavigate }: {
  topics: TopicRow[];
  counts: TopicCounts;
  yourDomain: string;
  compDomain?: string;
  sources: SourceRow[];
  plan: string;
  onNavigate?: (nav: string) => void;
}) {
  const [tab, setTab] = useState<"topics" | "sources">("topics");
  const [filter, setFilter] = useState<TopicFilter>("all");
  const [search, setSearch] = useState("");
  const [sortVolDir, setSortVolDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  const [expandedData, setExpandedData] = useState<Map<string, PromptItem[]>>(new Map());
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const [shownCount, setShownCount] = useState<Map<string, number>>(new Map());
  const [fullAnswer, setFullAnswer] = useState<{ answer: string; sources: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [monitoredSet, setMonitoredSet] = useState<Set<string>>(new Set());
  const isPaid = plan !== "free";

  const today = new Date().toISOString().split("T")[0]!;
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;
  const yourBrandName = yourDomain.replace(/\.[^.]+$/, "").toLowerCase();
  const compBrandName = compDomain ? compDomain.replace(/\.[^.]+$/, "").toLowerCase() : "";

  const handleExpand = async (topicKey: string) => {
    if (!isPaid) return;
    const isOpen = openSet.has(topicKey);
    setOpenSet(prev => { const s = new Set(prev); isOpen ? s.delete(topicKey) : s.add(topicKey); return s; });
    if (isOpen || expandedData.has(topicKey)) return;
    setLoadingSet(prev => new Set([...prev, topicKey]));
    try {
      const token = getToken();
      const r = await fetch("/api/dataforseo/topic-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topicName: topicKey, dateFrom: sixMonthsAgo, dateTo: today, platform: "google" }),
      });
      const d = await r.json() as { items?: PromptItem[]; error?: string };
      setExpandedData(prev => new Map([...prev, [topicKey, d.items ?? []]]));
      setShownCount(prev => new Map([...prev, [topicKey, 5]]));
    } catch { setExpandedData(prev => new Map([...prev, [topicKey, []]])); }
    finally { setLoadingSet(prev => { const s = new Set(prev); s.delete(topicKey); return s; }); }
  };

  const handleMonitor = async (prompt: string, topicKey: string) => {
    try {
      const token = getToken();
      await fetch("/api/dataforseo/monitor-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, topic: topicKey, yourDomain, competitorDomain: compDomain, platform: "google" }),
      });
      setMonitoredSet(prev => new Set([...prev, prompt]));
      setToast("Added to Prompt Tracking");
      setTimeout(() => setToast(null), 3000);
    } catch { /* fail silently */ }
  };

  const getMentionInfo = (p: PromptItem) => {
    const a = p.answer.toLowerCase();
    const names = p.brandEntities.map(b => b.name.toLowerCase());
    const y = names.some(n => n.includes(yourBrandName)) || a.includes(yourBrandName);
    const c = compBrandName ? names.some(n => n.includes(compBrandName)) || a.includes(compBrandName) : false;
    return { count: (y ? 1 : 0) + (c ? 1 : 0), total: compBrandName ? 2 : 1 };
  };

  const exportCsv = () => {
    const rows = [
      ["Topic", yourDomain + " Mentions", (compDomain ?? "Competitor") + " Mentions", "AI Volume", "Status"],
      ...topics.map(t => [
        `"${t.topic.replace(/"/g, '""')}"`,
        String(t.yourMentions),
        String(t.compMentions),
        String(t.aiVolume),
        t.status,
      ]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `competitor-topics-${yourDomain.replace(/\./g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const byStatus = filter === "all" ? topics : topics.filter(t => t.status === filter);
  const bySearch = search.trim()
    ? byStatus.filter(t => t.topic.toLowerCase().includes(search.trim().toLowerCase()))
    : byStatus;
  const filtered = [...bySearch].sort((a, b) =>
    sortVolDir === "desc" ? b.aiVolume - a.aiVolume : a.aiVolume - b.aiVolume
  );
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const visible = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const chips: Array<{ key: TopicFilter; label: string; count: number }> = [
    { key: "all",     label: "All",     count: counts.all },
    { key: "missing", label: "Missing", count: counts.missing },
    { key: "weak",    label: "Weak",    count: counts.weak },
    { key: "shared",  label: "Shared",  count: counts.shared },
    { key: "strong",  label: "Strong",  count: counts.strong },
    { key: "unique",  label: "Unique",  count: counts.unique },
  ];

  const chipStyle = (active: boolean, key: TopicFilter) => {
    const c = CHIP_COLORS[key];
    return {
      padding: "5px 12px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      border: `1px solid ${active ? c.border : BORDER}`,
      background: active ? c.bg : "white",
      color: active ? c.color : MUTED,
    };
  };

  const tabBtn = (active: boolean) => ({
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    borderBottom: `2px solid ${active ? P : "transparent"}`,
    background: "none",
    color: active ? P : MUTED,
  });

  const totalTopicsVol = topics.reduce((s, t) => s + t.aiVolume, 0);
  const totalSourcesCount = sources.reduce((s, r) => s + r.count, 0);

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${BORDER}`, marginBottom: 16 }}>
        <button style={tabBtn(tab === "topics")} onClick={() => setTab("topics")}>
          Topics and Prompts
          {totalTopicsVol > 0 && (
            <span style={{ marginLeft: 6, fontSize: 11, color: MUTED, fontWeight: 400 }}>{fmtVol(totalTopicsVol)}</span>
          )}
        </button>
        <button style={tabBtn(tab === "sources")} onClick={() => setTab("sources")}>
          Sources
          {totalSourcesCount > 0 && (
            <span style={{ marginLeft: 6, fontSize: 11, color: MUTED, fontWeight: 400 }}>{fmtVol(totalSourcesCount)}</span>
          )}
        </button>
      </div>

      {tab === "topics" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Filter by topic..."
              style={{ flex: "1 1 180px", minWidth: 160, padding: "6px 10px", fontSize: 13, border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", color: "#111827" }}
            />
            <button onClick={exportCsv}
              style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, border: `1px solid ${BORDER}`, borderRadius: 6, background: "white", color: MUTED, cursor: "pointer", whiteSpace: "nowrap" }}>
              Export CSV
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {chips.map(c => (
              <button key={c.key} style={chipStyle(filter === c.key, c.key)}
                onClick={() => { setFilter(c.key); setPage(0); }}>
                {c.label} {c.count}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 20px", color: MUTED, fontSize: 13 }}>No topics for this filter.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB" }}>
                    <th style={{ padding: "8px 8px", width: 30, borderBottom: `1px solid ${BORDER}` }}></th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}` }}>Topic</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: P, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{yourDomain}</th>
                    {compDomain && (
                      <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{compDomain}</th>
                    )}
                    <th onClick={() => { setSortVolDir(d => d === "desc" ? "asc" : "desc"); setPage(0); }}
                      style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                      AI Volume {sortVolDir === "desc" ? "\u2193" : "\u2191"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const topicKey = row.topic.toLowerCase().trim();
                    const isOpen = openSet.has(topicKey);
                    const isLoading = loadingSet.has(topicKey);
                    const prompts = expandedData.get(topicKey) ?? [];
                    const shown = shownCount.get(topicKey) ?? 5;
                    const colCount = compDomain ? 5 : 4;
                    return (
                      <React.Fragment key={topicKey}>
                        <tr style={{ background: ROW_BG[row.status] }}>
                          <td style={{ padding: "6px 6px 6px 10px", borderBottom: `1px solid ${BORDER}`, width: 30 }}>
                            {isPaid ? (
                              <button onClick={() => handleExpand(topicKey)}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", color: isOpen ? P : MUTED, borderRadius: 4 }}>
                                {isLoading
                                  ? <span style={{ fontSize: 9, color: MUTED, letterSpacing: 1 }}>...</span>
                                  : isOpen
                                    ? <ChevronDown size={13} />
                                    : <ChevronRight size={13} />}
                              </button>
                            ) : (
                              <span title="Expand prompts available on Starter plan"
                                style={{ display: "flex", alignItems: "center", padding: 2, color: "#D1D5DB" }}>
                                <Lock size={11} />
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, maxWidth: 400, lineHeight: 1.4 }}>{row.topic}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 600, color: row.yourMentions > 0 ? SUCCESS : MUTED }}>
                            {row.yourMentions > 0 ? fmtVol(row.yourAiVolume || row.aiVolume) : <span style={{ color: "#D1D5DB" }}>-</span>}
                          </td>
                          {compDomain && (
                            <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 600, color: row.compMentions > 0 ? "#10B981" : MUTED }}>
                              {row.compMentions > 0 ? fmtVol(row.compAiVolume || row.aiVolume) : <span style={{ color: "#D1D5DB" }}>-</span>}
                            </td>
                          )}
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>
                            {fmtVol(row.aiVolume)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={colCount} style={{ padding: 0, background: "#F8FAFF", borderBottom: `1px solid ${BORDER}` }}>
                              {prompts.length === 0 ? (
                                <div style={{ padding: "14px 16px", fontSize: 12, color: MUTED, textAlign: "center" }}>
                                  No prompts found for this topic in the selected period.
                                </div>
                              ) : (
                                <div style={{ overflowX: "auto" }}>
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                    <thead>
                                      <tr style={{ background: "#EEF2FF" }}>
                                        <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", width: "28%" }}>Prompt</th>
                                        <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Response</th>
                                        <th style={{ padding: "6px 12px", textAlign: "center", fontWeight: 600, color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Mentioned</th>
                                        <th style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600, color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Sources</th>
                                        <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {prompts.slice(0, shown).map((p, pi) => {
                                        const { count, total } = getMentionInfo(p);
                                        const mColor = count === total ? SUCCESS : count > 0 ? WARNING : DANGER;
                                        const mBg = count === total ? "#F0FDF4" : count > 0 ? "#FFFBEB" : "#FFF5F5";
                                        const isMonitored = monitoredSet.has(p.prompt);
                                        return (
                                          <tr key={pi} style={{ borderTop: `1px solid ${BORDER}` }}>
                                            <td style={{ padding: "10px 12px", verticalAlign: "top", maxWidth: 220 }}>
                                              <div style={{ lineHeight: 1.5, color: "#111827" }}>{p.prompt}</div>
                                              {p.fanOutQueries.length > 0 && (
                                                <div style={{ marginTop: 4, fontSize: 10, color: MUTED }}>
                                                  Related: {p.fanOutQueries.join(" · ")}
                                                </div>
                                              )}
                                            </td>
                                            <td style={{ padding: "10px 12px", verticalAlign: "top", maxWidth: 300 }}>
                                              <div style={{ lineHeight: 1.5, color: "#374151" }}>
                                                {p.answer
                                                  ? p.answer.substring(0, 160) + (p.answer.length > 160 ? "..." : "")
                                                  : <span style={{ color: MUTED }}>No response recorded</span>}
                                              </div>
                                              {p.answer.length > 160 && (
                                                <button onClick={() => setFullAnswer({ answer: p.answer, sources: p.sources })}
                                                  style={{ marginTop: 4, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: P, padding: 0 }}>
                                                  View full response
                                                </button>
                                              )}
                                            </td>
                                            <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top" }}>
                                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 12, background: mBg, color: mColor, fontWeight: 700, fontSize: 12 }}>
                                                {count}/{total}
                                              </span>
                                            </td>
                                            <td style={{ padding: "10px 12px", textAlign: "right", verticalAlign: "top", fontWeight: 600, color: "#111827" }}>
                                              {p.sources.length}
                                            </td>
                                            <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                                {onNavigate && (
                                                  <button onClick={() => onNavigate("content-creation")}
                                                    style={{ padding: "3px 8px", fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}`, borderRadius: 4, background: "white", cursor: "pointer", whiteSpace: "nowrap", color: "#374151" }}>
                                                    Content
                                                  </button>
                                                )}
                                                <button onClick={() => handleMonitor(p.prompt, topicKey)}
                                                  disabled={isMonitored}
                                                  style={{ padding: "3px 8px", fontSize: 11, fontWeight: 600, border: `1px solid ${isMonitored ? "#BBF7D0" : BORDER}`, borderRadius: 4, background: isMonitored ? "#F0FDF4" : "white", cursor: isMonitored ? "default" : "pointer", whiteSpace: "nowrap", color: isMonitored ? SUCCESS : "#374151" }}>
                                                  {isMonitored ? "Monitoring" : "Monitor"}
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                  {prompts.length > shown && (
                                    <button onClick={() => setShownCount(prev => new Map([...prev, [topicKey, Math.min(shown + 5, 20)]]))}
                                      style={{ display: "block", width: "100%", padding: "8px", fontSize: 12, color: P, background: "none", border: "none", borderTop: `1px solid ${BORDER}`, cursor: "pointer", textAlign: "center" }}>
                                      Show {Math.min(5, Math.min(prompts.length, 20) - shown)} more prompts
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
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
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#111827", color: "white", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 1000, boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}>
          {toast}
        </div>
      )}

      {/* Full answer modal */}
      {fullAnswer && (
        <div onClick={() => setFullAnswer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: "24px 28px", maxWidth: 640, width: "100%", maxHeight: "70vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Full AI Response</div>
              <button onClick={() => setFullAnswer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex" }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0 }}>{fullAnswer.answer}</p>
            {fullAnswer.sources.length > 0 && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Sources</div>
                {fullAnswer.sources.map((s, i) => (
                  <div key={i}><a href={s} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: P, wordBreak: "break-all" }}>{s}</a></div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "sources" && (
        <div>
          {sources.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 20px", color: MUTED, fontSize: 13 }}>
              No source data found. Run an analysis to see which domains AI cites.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}` }}>#</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}` }}>Domain</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}` }}>Citations</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((row, i) => (
                    <tr key={row.domain} style={{ background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, color: MUTED, width: 40 }}>{i + 1}</td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500, color: "#111827" }}>
                        <a href={`https://${row.domain}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: P, textDecoration: "none" }}>
                          {row.domain}
                        </a>
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 600, color: "#111827" }}>
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
export function CompetitorResearch({ initialDomain, plan = "free", onNavigate }: {
  initialDomain: string;
  plan?: string;
  onNavigate?: (nav: string) => void;
}) {
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
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Brand Benchmarks</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Compare your AI visibility against competitors</div>

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
                  {!d.isYou && d.mentions === 0 && d.score === 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "4px 8px", lineHeight: 1.4 }}>
                      No data found. Double-check the domain spelling.
                    </div>
                  )}
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

          {/* Topics + Sources gap */}
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Topics, Prompts and Sources</div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
              AI queries where each brand appears.
              <span style={{ marginLeft: 10, background: "#FFF5F5", color: DANGER, borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600 }}>Missing</span>
              <span style={{ marginLeft: 4, marginRight: 10, fontSize: 11, color: MUTED }}>competitor shows, you don't</span>
              <span style={{ background: "#FFFBF0", color: WARNING, borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600 }}>Weak</span>
              <span style={{ marginLeft: 4, marginRight: 10, fontSize: 11, color: MUTED }}>competitor 2x stronger</span>
              <span style={{ background: "#F0FDF4", color: SUCCESS, borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600 }}>Strong</span>
              <span style={{ marginLeft: 4, fontSize: 11, color: MUTED }}>you are 2x stronger</span>
            </div>
            {data.topicCounts.all === 0 && data.sources.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 20px", color: MUTED, fontSize: 13 }}>
                No topic data found. This may happen if DataForSEO has limited data for these brand keywords.
              </div>
            ) : (
              <TopicsTable
                topics={data.topics}
                counts={data.topicCounts}
                yourDomain={yourDomain}
                compDomain={compDomain}
                sources={data.sources ?? []}
                plan={plan}
                onNavigate={onNavigate}
              />
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
