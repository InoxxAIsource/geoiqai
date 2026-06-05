import { useState } from "react";
import { getToken } from "@/lib/auth";
import { Search, ChevronRight, ChevronDown, BookmarkPlus, Check } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";
const SUCCESS = "#059669";

/* ───── Types ───── */
interface PromptItem {
  question: string;
  platform: string;
  ai_search_volume: number;
  sources: string[];
  brands: string[];
}

interface TopicCluster {
  topic: string;
  totalAiVolume: number;
  promptCount: number;
  prompts: PromptItem[];
  brands: string[];
  sources: string[];
}

interface BrandItem { name: string; mentions: number; topTopics: string[] }
interface SourceItem { domain: string; mentions: number; topics: string[] }

interface IntentData {
  informational: number;
  navigational: number;
  commercial: number;
  transactional: number;
  task: number;
}

interface PromptResearchData {
  brandName: string;
  totalAiVolume: number;
  totalTopics: number;
  totalPrompts: number;
  totalBrands: number;
  totalSources: number;
  intent: IntentData;
  topics: TopicCluster[];
  prompts: PromptItem[];
  brands: BrandItem[];
  sourceDomains: SourceItem[];
  dateFrom: string;
  dateTo: string;
  cached: boolean;
}

type TabId = "topics" | "prompts" | "brands" | "sources";

/* ───── Helpers ───── */
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toLocaleString();
}

function platformLabel(p: string): string {
  if (p === "chat_gpt") return "ChatGPT";
  if (p === "google") return "Google AI";
  return p;
}

function PlatformBadge({ platform }: { platform: string }) {
  const isGoogle = platform === "google";
  return (
    <span style={{
      background: isGoogle ? "#EEF2FF" : "#F0FDF4",
      color: isGoogle ? P : SUCCESS,
      borderRadius: 10,
      padding: "2px 8px",
      fontSize: 10,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      {platformLabel(platform)}
    </span>
  );
}

const INTENT_COLORS: Record<string, string> = {
  informational: "#6366F1",
  navigational: "#F59E0B",
  commercial: "#3B82F6",
  transactional: "#10B981",
  task: "#EC4899",
};

function IntentBar({ intent }: { intent: IntentData }) {
  const entries = Object.entries(intent).filter(([, v]) => v > 0) as [string, number][];
  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
        {entries.map(([key, val]) => (
          <div key={key} style={{ width: `${val}%`, background: INTENT_COLORS[key] ?? MUTED }} title={`${key} ${val}%`} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
        {entries.map(([key, val]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: INTENT_COLORS[key] ?? MUTED }} />
            <span style={{ textTransform: "capitalize", color: "#374151" }}>{key}</span>
            <span style={{ fontWeight: 600, color: "#111827" }}>{val}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───── Monitor button (with saved state) ───── */
function MonitorBtn({ prompt, topic, domain }: { prompt: string; topic?: string; domain?: string }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saved || saving) return;
    setSaving(true);
    try {
      const token = getToken();
      await fetch("/api/dataforseo/monitor-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt, topic, yourDomain: domain ?? "" }),
      });
      setSaved(true);
    } catch { /* non-fatal */ } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: SUCCESS, fontWeight: 600 }}>
        <Check size={12} /> Monitoring
      </span>
    );
  }
  return (
    <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: MUTED, cursor: "pointer", whiteSpace: "nowrap" }}>
      <BookmarkPlus size={12} />
      {saving ? "Saving..." : "Monitor"}
    </button>
  );
}

/* ───── Topics tab with expandable rows ───── */
function TopicsTable({ topics, brandName, plan }: { topics: TopicCluster[]; brandName: string; plan: string }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [monitoredPrompts, setMonitoredPrompts] = useState<Set<string>>(new Set());

  const toggle = (i: number) => {
    if (plan === "free") return;
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  const relevance = (topic: string): "High" | "Medium" | "Low" => {
    const t = topic.toLowerCase();
    const b = brandName.toLowerCase();
    if (t.includes(b)) return "High";
    return "Medium";
  };

  const savePrompt = async (prompt: string, topic: string) => {
    if (monitoredPrompts.has(prompt)) return;
    try {
      const token = getToken();
      await fetch("/api/dataforseo/monitor-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt, topic }),
      });
      setMonitoredPrompts(prev => new Set(prev).add(prompt));
    } catch { /* non-fatal */ }
  };

  const REL_COLORS: Record<string, { bg: string; color: string }> = {
    High: { bg: "#D1FAE5", color: "#065F46" },
    Medium: { bg: "#EEF2FF", color: P },
    Low: { bg: "#F3F4F6", color: MUTED },
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ width: 30, padding: "8px 6px", borderBottom: `1px solid ${BORDER}` }} />
            <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}` }}>Topic</th>
            <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>Relevance</th>
            <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>AI Volume</th>
            <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>Prompts</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((row, i) => {
            const isOpen = expanded.has(i);
            const rel = relevance(row.topic);
            const relStyle = REL_COLORS[rel]!;
            return (
              <>
                <tr key={i} style={{ background: isOpen ? "#F8FAFF" : "white" }}>
                  <td style={{ padding: "6px 6px 6px 10px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}` }}>
                    {plan === "free" ? (
                      <span style={{ display: "flex", alignItems: "center", padding: 2, color: "#D1D5DB" }}>
                        <ChevronRight size={14} />
                      </span>
                    ) : (
                      <button onClick={() => toggle(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", color: isOpen ? P : MUTED, borderRadius: 4 }}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}`, maxWidth: 400, lineHeight: 1.4 }}>{row.topic}</td>
                  <td style={{ padding: "10px 12px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}`, textAlign: "center" }}>
                    <span style={{ background: relStyle.bg, color: relStyle.color, borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{rel}</span>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}`, textAlign: "right", fontWeight: 600 }}>{fmt(row.totalAiVolume)}</td>
                  <td style={{ padding: "10px 12px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}`, textAlign: "right", color: MUTED }}>{row.promptCount}</td>
                </tr>
                {isOpen && (
                  <tr key={`${i}-expand`}>
                    <td colSpan={5} style={{ padding: 0, background: "#F8FAFF", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ padding: "0 0 8px 48px" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr>
                              {["Prompt", "Platform", "AI Volume", "Sources", ""].map(h => (
                                <th key={h} style={{ padding: "6px 10px", textAlign: h === "AI Volume" ? "right" : "left", fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {row.prompts.map((p, pi) => (
                              <tr key={pi} style={{ background: pi % 2 === 0 ? "white" : "#F9FAFB" }}>
                                <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}`, maxWidth: 360, lineHeight: 1.4, color: "#111827" }}>{p.question}</td>
                                <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}` }}><PlatformBadge platform={p.platform} /></td>
                                <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 600 }}>{fmt(p.ai_search_volume)}</td>
                                <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}`, color: MUTED }}>{p.sources.length > 0 ? p.sources.length : "-"}</td>
                                <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}` }}>
                                  {monitoredPrompts.has(p.question) ? (
                                    <span style={{ fontSize: 11, color: SUCCESS, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Check size={12} /> Monitoring</span>
                                  ) : (
                                    <button onClick={() => savePrompt(p.question, row.topic)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, color: MUTED, cursor: "pointer" }}>
                                      <BookmarkPlus size={11} /> Monitor
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───── Main component ───── */
export function PromptResearch({ initialDomain, plan }: { initialDomain: string; plan: string }) {
  const [inputVal, setInputVal] = useState(initialDomain ?? "");
  const [data, setData] = useState<PromptResearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("topics");

  const brandChips = data
    ? [`${data.brandName} alternatives`, `${data.brandName} pricing`, `best ${data.brandName} features`, `${data.brandName} vs competitors`]
    : ["AI visibility tools", "ChatGPT brand monitoring", "GEO optimization", "AI search ranking"];

  const search = async (override?: string) => {
    const q = (override ?? inputVal).trim();
    if (!q) return;
    setInputVal(q);
    setError(null);
    setLoading(true);
    setData(null);
    setActiveTab("topics");
    const token = getToken();
    try {
      const r = await fetch("/api/dataforseo/prompt-research", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ input: q }),
      });
      const json = await r.json() as PromptResearchData & { error?: string };
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch prompt research data.");
    } finally {
      setLoading(false);
    }
  };

  const TABS: { id: TabId; label: string; count?: number }[] = data ? [
    { id: "topics",   label: "Topics",   count: data.totalTopics },
    { id: "prompts",  label: "Prompts",  count: data.totalPrompts },
    { id: "brands",   label: "Brands",   count: data.totalBrands },
    { id: "sources",  label: "Source Domains", count: data.totalSources },
  ] : [];

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Prompt Research</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Find every AI search prompt related to your brand. See who else gets mentioned and which sources AI cites.</div>

      {/* Search */}
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
            <Search size={15} color={MUTED} />
            <input
              type="text" value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()}
              placeholder="Enter a domain or brand name (e.g. netflix.com)"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#111827", background: "transparent" }}
            />
          </div>
          <button onClick={() => search()} disabled={loading || !inputVal.trim()}
            style={{ padding: "10px 22px", background: loading || !inputVal.trim() ? "#C7D2FE" : P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading || !inputVal.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
            {loading ? "Searching..." : "Research"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>Try:</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {brandChips.map(chip => (
            <button key={chip} onClick={() => search(chip)}
              style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#374151", cursor: "pointer" }}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Fetching AI prompt data from Google AI Overview and ChatGPT...
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEF2FF", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Search size={22} color={P} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Enter a domain or brand to start researching</div>
          <div style={{ fontSize: 13, color: MUTED, maxWidth: 400, margin: "0 auto" }}>Find all AI search prompts where your brand or a competitor appears. Understand what users are asking AI about your category.</div>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Results for: <span style={{ color: P }}>{data.brandName}</span>
              {data.cached && <span style={{ marginLeft: 8, fontSize: 11, background: "#F3F4F6", color: MUTED, padding: "2px 8px", borderRadius: 10 }}>Cached</span>}
            </div>
            <button onClick={() => { setData(null); setError(null); }} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, color: MUTED, cursor: "pointer" }}>
              New search
            </button>
          </div>

          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total AI Volume</div>
              <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{fmt(data.totalAiVolume)}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{data.totalTopics} topics / {data.totalPrompts} prompts</div>
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", gridColumn: "span 2" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Intent Breakdown</div>
              <IntentBar intent={data.intent} />
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Brands + Sources</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>{data.totalBrands.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{data.totalSources.toLocaleString()} source domains</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${BORDER}`, paddingBottom: 0 }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ padding: "8px 16px", fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400, color: activeTab === tab.id ? P : MUTED, background: "none", border: "none", borderBottom: activeTab === tab.id ? `2px solid ${P}` : "2px solid transparent", cursor: "pointer", whiteSpace: "nowrap", marginBottom: -1 }}>
                {tab.label}
                {tab.count != null && (
                  <span style={{ marginLeft: 6, fontSize: 11, background: activeTab === tab.id ? "#EEF2FF" : BG, color: activeTab === tab.id ? P : MUTED, borderRadius: 10, padding: "1px 7px" }}>
                    {tab.count.toLocaleString()}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
            {activeTab === "topics" && (
              <TopicsTable topics={data.topics} brandName={data.brandName} plan={plan} />
            )}

            {activeTab === "prompts" && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Prompt", "Platform", "AI Volume", "Brands", "Sources", ""].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: h === "AI Volume" ? "right" : "left", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.prompts.map((p, i) => (
                      <tr key={i}>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, maxWidth: 400, lineHeight: 1.4 }}>{p.question}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}><PlatformBadge platform={p.platform} /></td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 600 }}>{fmt(p.ai_search_volume)}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, color: MUTED, fontSize: 12 }}>
                          {p.brands.length > 0 ? p.brands.slice(0, 3).join(", ") : "-"}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, color: MUTED }}>{p.sources.length > 0 ? p.sources.length : "-"}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}>
                          <MonitorBtn prompt={p.question} domain={data.brandName} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "brands" && (
              <div style={{ overflowX: "auto" }}>
                {data.brands.length === 0 ? (
                  <div style={{ padding: "40px 24px", textAlign: "center", color: MUTED, fontSize: 13 }}>No brand entities found. DataForSEO may not return brand data for this keyword.</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["Brand", "Mentions", "Appears In"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: h === "Mentions" ? "right" : "left", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.brands.map((b, i) => (
                        <tr key={i}>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>{b.name}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>{b.mentions}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, color: MUTED, fontSize: 12, maxWidth: 400 }}>{b.topTopics.join(" / ") || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === "sources" && (
              <div style={{ overflowX: "auto" }}>
                {data.sourceDomains.length === 0 ? (
                  <div style={{ padding: "40px 24px", textAlign: "center", color: MUTED, fontSize: 13 }}>No source domains found. Try a brand with higher AI search volume.</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["Domain", "Cited In Topics", "Top Topics"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: h === "Cited In Topics" ? "right" : "left", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.sourceDomains.map((s, i) => (
                        <tr key={i}>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>{s.domain}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>{s.mentions}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, color: MUTED, fontSize: 12, maxWidth: 400 }}>{s.topics.join(" / ") || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
