import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { Search, ChevronRight, ChevronDown, BookmarkPlus, Check, Download, Filter, X } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";
const SUCCESS = "#059669";

/* ───── Types ───── */
interface MonthlySearch { year: number; month: number; count: number }

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
  monthlySearches: MonthlySearch[];
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
type IntentLabel = "Informational" | "Navigational" | "Commercial" | "Transactional" | "Task";

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

/* ───── Intent classification (client-side) ───── */
function classifyIntent(question: string): IntentLabel {
  const q = question.toLowerCase();
  if (/\b(how to|tutorial|guide|step by step|fix|troubleshoot|set up|install|configure|enable|disable)\b/.test(q)) return "Task";
  if (/\b(price|pricing|cost|plan|subscription|buy|purchase|discount|coupon|deal|trial|free trial)\b/.test(q)) return "Transactional";
  if (/\b(vs|versus|compare|comparison|alternative|alternatives|best|top|review|reviews|worth|recommend)\b/.test(q)) return "Commercial";
  if (/\b(login|sign in|sign up|account|download|official|website|app)\b/.test(q)) return "Navigational";
  return "Informational";
}

const INTENT_META: Record<IntentLabel, { color: string; dot: string }> = {
  Informational: { color: "#6366F1", dot: "#6366F1" },
  Navigational:  { color: "#F59E0B", dot: "#F59E0B" },
  Commercial:    { color: "#3B82F6", dot: "#3B82F6" },
  Transactional: { color: "#10B981", dot: "#10B981" },
  Task:          { color: "#EC4899", dot: "#EC4899" },
};

function IntentBadge({ question }: { question: string }) {
  const label = classifyIntent(question);
  const meta = INTENT_META[label];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: meta.color, fontWeight: 600, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

/* ───── Relevance ───── */
type Relevance = "High" | "Medium" | "Low";
const REL_COLORS: Record<Relevance, { bg: string; color: string }> = {
  High:   { bg: "#D1FAE5", color: "#065F46" },
  Medium: { bg: "#EEF2FF", color: P },
  Low:    { bg: "#F3F4F6", color: MUTED },
};

function getRelevance(topicName: string, brandName: string): Relevance {
  const t = topicName.toLowerCase();
  const brand = brandName.toLowerCase();
  if (t.includes(brand)) return "High";
  const brandWords = brand.split(/[\s\-_]+/).filter(w => w.length > 3);
  if (brandWords.some(w => t.includes(w))) return "High";
  return "Medium";
}

/* ───── Sparkline SVG ───── */
function Sparkline({ data }: { data: MonthlySearch[] }) {
  if (!data || data.length < 2) return <span style={{ color: MUTED, fontSize: 10 }}>-</span>;
  const vals = data.map(d => d.count);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 60; const H = 22;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  });
  const last = vals[vals.length - 1]!;
  const prev = vals[vals.length - 2]!;
  const trending = last >= prev ? "#10B981" : "#EF4444";
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={trending} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ───── Platform badge ───── */
function PlatformBadge({ platform }: { platform: string }) {
  const isGoogle = platform === "google";
  return (
    <span style={{ background: isGoogle ? "#EEF2FF" : "#F0FDF4", color: isGoogle ? P : SUCCESS, borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
      {platformLabel(platform)}
    </span>
  );
}

/* ───── Intent bar (global summary) ───── */
const INTENT_COLORS: Record<string, string> = {
  informational: "#6366F1", navigational: "#F59E0B", commercial: "#3B82F6", transactional: "#10B981", task: "#EC4899",
};

function IntentBar({ intent }: { intent: IntentData }) {
  const entries = (Object.entries(intent) as [string, number][]).filter(([, v]) => v > 0);
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

/* ───── localStorage helpers ───── */
const LS_KEY = "geoiq_tracked_v2";
function getTrackedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as string[]); } catch { return new Set(); }
}
function markTracked(keys: string[]) {
  const s = getTrackedSet();
  keys.forEach(k => s.add(k));
  localStorage.setItem(LS_KEY, JSON.stringify([...s]));
}
function isTracked(key: string): boolean { return getTrackedSet().has(key); }

/* ───── Tracking Modal ───── */
const PLATFORM_OPTIONS = [
  { id: "google",     label: "Google AI Overview" },
  { id: "chat_gpt",   label: "ChatGPT" },
  { id: "gemini",     label: "Gemini" },
  { id: "perplexity", label: "Perplexity" },
] as const;

interface TrackingModalProps {
  initialPrompt: string;
  topic: string;
  domain: string;
  onClose: () => void;
  onSaved: (keys: string[]) => void;
}

function TrackingModal({ initialPrompt, topic, domain, onClose, onSaved }: TrackingModalProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({ google: true, chat_gpt: true, gemini: false, perplexity: false });
  const [promptText, setPromptText] = useState(initialPrompt);
  const [count, setCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 50;

  useEffect(() => {
    const token = getToken();
    fetch("/api/dataforseo/prompt-tracking/count", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json()).then((d: { count: number }) => setCount(d.count)).catch(() => {});
  }, []);

  const togglePlatform = (id: string) => setSelected(s => ({ ...s, [id]: !s[id] }));
  const chosenPlatforms = PLATFORM_OPTIONS.filter(p => selected[p.id]).map(p => p.id);
  const prompts = promptText.split("\n").map(p => p.trim()).filter(Boolean);
  const atLimit = count !== null && count >= LIMIT;

  const handleTrack = async () => {
    if (!chosenPlatforms.length || !prompts.length) return;
    setSaving(true); setError(null);
    try {
      const token = getToken();
      const r = await fetch("/api/dataforseo/monitor-prompt-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompts, platforms: chosenPlatforms, topic, domain }),
      });
      const data = await r.json() as { ok?: boolean; added?: number; error?: string };
      if (data.error) throw new Error(data.error);
      const keys = prompts.map(p => `${p}__${chosenPlatforms.join(",")}`);
      onSaved(keys);
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save. Try again."); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 14, padding: "28px 32px", maxWidth: 480, width: "92%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", position: "relative" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Add to Prompt Tracking</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", padding: 4, borderRadius: 6 }}><X size={18} /></button>
        </div>

        {/* Platform selection */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Track on which AI platforms:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PLATFORM_OPTIONS.map(p => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={!!selected[p.id]} onChange={() => togglePlatform(p.id)}
                  style={{ width: 15, height: 15, accentColor: P, cursor: "pointer" }} />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        {/* Prompt textarea */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Prompts to track (one per line)</div>
            {count !== null && (
              <div style={{ fontSize: 11, color: count >= LIMIT ? "#DC2626" : MUTED }}>
                {count} / {LIMIT} prompts used
              </div>
            )}
          </div>
          <textarea value={promptText} onChange={e => setPromptText(e.target.value)}
            rows={4}
            style={{ width: "100%", border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit", color: "#111827" }} />
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{prompts.length} prompt{prompts.length !== 1 ? "s" : ""} detected</div>
        </div>

        {/* Limit warning */}
        {atLimit && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#991B1B", marginBottom: 14 }}>
            Prompt limit reached (50/50). Upgrade to Agency plan for unlimited tracking.
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#991B1B", marginBottom: 14 }}>{error}</div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: MUTED, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleTrack} disabled={saving || atLimit || !chosenPlatforms.length || !prompts.length}
            style={{ padding: "9px 20px", background: saving || atLimit || !chosenPlatforms.length ? "#A5B4FC" : P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving || atLimit ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "Start Tracking"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───── Monitor button - opens tracking modal ───── */
function MonitorButton({ prompt, topic, domain }: { prompt: string; topic: string; domain: string }) {
  const lsKey = `${prompt}__google,chat_gpt`;
  const [tracked, setTracked] = useState(() => isTracked(lsKey));
  const [open, setOpen] = useState(false);

  if (tracked) {
    return <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: SUCCESS, fontWeight: 600, whiteSpace: "nowrap" }}><Check size={12} /> Tracking</span>;
  }
  return (
    <>
      <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3px 9px", fontSize: 11, color: MUTED, cursor: "pointer", whiteSpace: "nowrap" }}>
        <BookmarkPlus size={11} /> Monitor
      </button>
      {open && (
        <TrackingModal
          initialPrompt={prompt}
          topic={topic}
          domain={domain}
          onClose={() => setOpen(false)}
          onSaved={keys => { markTracked(keys); setTracked(true); }}
        />
      )}
    </>
  );
}

/* ───── Export to CSV ───── */
function exportCSV(topics: TopicCluster[], brandName: string) {
  const rows: string[] = ["Topic,AI Volume,Relevance,Intent,Prompts"];
  for (const t of topics) {
    const rel = getRelevance(t.topic, brandName);
    const intent = t.prompts.length > 0 ? classifyIntent(t.prompts[0]!.question) : "Informational";
    const safe = (s: string) => `"${s.replace(/"/g, '""')}"`;
    rows.push(`${safe(t.topic)},${t.totalAiVolume},${rel},${intent},${t.promptCount}`);
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${brandName}-prompt-research.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* ───── Topics table ───── */
type SortField = "relevance" | "volume";
type SortDir = "asc" | "desc";

function TopicsTable({ topics, brandName, plan, domain }: { topics: TopicCluster[]; brandName: string; plan: string; domain: string }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("relevance");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const toggle = (i: number) => {
    if (plan === "free") return;
    setExpanded(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const cycleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const REL_ORDER: Record<Relevance, number> = { High: 0, Medium: 1, Low: 2 };

  const baseList = filter.trim()
    ? topics.filter(t => t.topic.toLowerCase().includes(filter.toLowerCase()))
    : topics;

  const filtered = [...baseList].sort((a, b) => {
    const aRel = REL_ORDER[getRelevance(a.topic, brandName)];
    const bRel = REL_ORDER[getRelevance(b.topic, brandName)];
    if (sortField === "relevance") {
      const diff = aRel - bRel;
      const sorted = sortDir === "asc" ? diff : -diff;
      return sorted !== 0 ? sorted : b.totalAiVolume - a.totalAiVolume;
    }
    // volume sort
    const diff = b.totalAiVolume - a.totalAiVolume;
    return sortDir === "asc" ? diff : -diff;
  });

  return (
    <div>
      {/* Filter + Export toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "6px 10px", background: BG }}>
          <Filter size={12} color={MUTED} />
          <input
            type="text" value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Filter by topic..."
            style={{ flex: 1, border: "none", outline: "none", fontSize: 12, color: "#111827", background: "transparent" }}
          />
          {filter && <button onClick={() => setFilter("")} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 12, padding: 0 }}>x</button>}
        </div>
        <button
          onClick={() => exportCSV(filtered, brandName)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "white", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "6px 12px", fontSize: 12, color: "#374151", cursor: "pointer", whiteSpace: "nowrap" }}>
          <Download size={12} /> Export CSV
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 30, padding: "8px 6px", borderBottom: `1px solid ${BORDER}` }} />
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}` }}>Topic</th>
              <th onClick={() => cycleSort("relevance")} style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 600, color: sortField === "relevance" ? P : MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                Relevance {sortField === "relevance" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
              <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}` }}>Intent</th>
              <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>Trend</th>
              <th onClick={() => cycleSort("volume")} style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: sortField === "volume" ? P : MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                AI Volume {sortField === "volume" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </th>
              <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>Prompts</th>
              <th style={{ padding: "8px 12px", borderBottom: `1px solid ${BORDER}` }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const isOpen = expanded.has(i);
              const rel = getRelevance(row.topic, brandName);
              const relStyle = REL_COLORS[rel];
              const intentLabel = row.prompts.length > 0 ? classifyIntent(row.prompts[0]!.question) : "Informational";
              const intentMeta = INTENT_META[intentLabel];
              return (
                <>
                  <tr key={i} style={{ background: isOpen ? "#F8FAFF" : "white" }}>
                    <td style={{ padding: "6px 6px 6px 10px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}` }}>
                      <button onClick={() => toggle(i)} disabled={plan === "free"} style={{ background: "none", border: "none", cursor: plan === "free" ? "default" : "pointer", padding: 2, display: "flex", alignItems: "center", color: isOpen ? P : MUTED, borderRadius: 4, opacity: plan === "free" ? 0.35 : 1 }}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}`, maxWidth: 340, lineHeight: 1.4, fontWeight: 500 }}>{row.topic}</td>
                    <td style={{ padding: "10px 12px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}`, textAlign: "center" }}>
                      <span style={{ background: relStyle.bg, color: relStyle.color, borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{rel}</span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}`, textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: intentMeta.color, fontWeight: 600 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: intentMeta.dot, flexShrink: 0 }} />{intentLabel}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}`, textAlign: "right" }}>
                      <Sparkline data={row.monthlySearches} />
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}`, textAlign: "right", fontWeight: 700 }}>{fmt(row.totalAiVolume)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}`, textAlign: "right", color: MUTED }}>{row.promptCount}</td>
                    <td style={{ padding: "10px 12px", borderBottom: isOpen ? "none" : `1px solid ${BORDER}` }}>
                      <MonitorButton prompt={row.topic} topic={row.topic} domain={domain} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${i}-expand`}>
                      <td colSpan={8} style={{ padding: 0, background: "#F8FAFF", borderBottom: `1px solid ${BORDER}` }}>
                        <div style={{ padding: "0 0 8px 48px" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr>
                                {["Prompt", "Platform", "Intent", "AI Volume", "Sources", ""].map(h => (
                                  <th key={h} style={{ padding: "6px 10px", textAlign: h === "AI Volume" ? "right" : "left", fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {row.prompts.map((p, pi) => (
                                <tr key={pi} style={{ background: pi % 2 === 0 ? "white" : BG }}>
                                  <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}`, maxWidth: 340, lineHeight: 1.4, color: "#111827" }}>{p.question}</td>
                                  <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}` }}><PlatformBadge platform={p.platform} /></td>
                                  <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}` }}><IntentBadge question={p.question} /></td>
                                  <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 600 }}>{fmt(p.ai_search_volume)}</td>
                                  <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}`, color: MUTED }}>{p.sources.length > 0 ? p.sources.length : "-"}</td>
                                  <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}` }}>
                                    <MonitorButton prompt={p.question} topic={row.topic} domain={domain} />
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", color: MUTED, fontSize: 13 }}>
                  No topics match "{filter}". Try a shorter term.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
    { id: "topics",  label: "Topics",         count: data.totalTopics },
    { id: "prompts", label: "Prompts",         count: data.totalPrompts },
    { id: "brands",  label: "Brands",          count: data.totalBrands },
    { id: "sources", label: "Source Domains",  count: data.totalSources },
  ] : [];

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Prompt Intelligence</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Discover which AI prompts your brand should answer</div>

      {/* Search */}
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
            <Search size={15} color={MUTED} />
            <input type="text" value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
              placeholder="Enter a domain or brand name (e.g. netflix.com)"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#111827", background: "transparent" }} />
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
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Fetching AI prompt data from Google AI Overview and ChatGPT...
        </div>
      )}

      {/* Empty */}
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
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Results for: <span style={{ color: P }}>{data.brandName}</span>
              {data.cached && <span style={{ marginLeft: 8, fontSize: 11, background: BG, color: MUTED, padding: "2px 8px", borderRadius: 10 }}>Cached</span>}
            </div>
            <button onClick={() => { setData(null); setError(null); }} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, color: MUTED, cursor: "pointer" }}>
              New search
            </button>
          </div>

          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
            {/* AI Volume */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>AI Volume</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>{fmt(data.totalAiVolume)}</div>
              <div style={{ fontSize: 11, color: MUTED }}>last 6 months</div>
            </div>
            {/* Topics + Prompts */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Topics + Prompts</div>
              <div style={{ fontSize: 13, marginBottom: 3 }}>
                <span style={{ fontWeight: 700 }}>{data.totalTopics}</span>
                <span style={{ color: MUTED, marginLeft: 4 }}>topics</span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 700 }}>{data.totalPrompts}</span>
                <span style={{ color: MUTED, marginLeft: 4 }}>prompts</span>
              </div>
              <div style={{ fontSize: 10, color: "#9CA3AF", background: BG, borderRadius: 4, padding: "2px 6px", display: "inline-block" }}>sample</div>
            </div>
            {/* Intent */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Intent</div>
              <IntentBar intent={data.intent} />
            </div>
            {/* Brands */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Brands</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{data.totalBrands.toLocaleString()}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {data.brands.slice(0, 3).map(b => (
                  <span key={b.name} style={{ fontSize: 11, background: "#EEF2FF", color: P, borderRadius: 8, padding: "2px 7px", fontWeight: 500 }}>{b.name}</span>
                ))}
              </div>
            </div>
            {/* Sources */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Sources</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{data.totalSources.toLocaleString()}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {data.sourceDomains.slice(0, 3).map(s => (
                  <span key={s.domain} style={{ fontSize: 11, color: MUTED }}>{s.domain}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
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
              <TopicsTable topics={data.topics} brandName={data.brandName} plan={plan} domain={data.brandName} />
            )}

            {activeTab === "prompts" && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Prompt", "Platform", "Intent", "AI Volume", "Brands", "Sources", ""].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: h === "AI Volume" ? "right" : "left", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.prompts.map((p, i) => (
                      <tr key={i}>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, maxWidth: 380, lineHeight: 1.4 }}>{p.question}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}><PlatformBadge platform={p.platform} /></td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}><IntentBadge question={p.question} /></td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 600 }}>{fmt(p.ai_search_volume)}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, color: MUTED, fontSize: 12, maxWidth: 180 }}>{p.brands.length > 0 ? p.brands.slice(0, 3).join(", ") : "-"}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, color: MUTED }}>{p.sources.length > 0 ? p.sources.length : "-"}</td>
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}>
                          <MonitorButton prompt={p.question} topic={p.question} domain={data.brandName} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "brands" && (
              data.brands.length === 0 ? (
                <div style={{ padding: "40px 24px", textAlign: "center", color: MUTED, fontSize: 13 }}>No brand entities found. DataForSEO may not return brand data for this keyword.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
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
                </div>
              )
            )}

            {activeTab === "sources" && (
              data.sourceDomains.length === 0 ? (
                <div style={{ padding: "40px 24px", textAlign: "center", color: MUTED, fontSize: 13 }}>No source domains found. Try a brand with higher AI search volume.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
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
                </div>
              )
            )}
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
