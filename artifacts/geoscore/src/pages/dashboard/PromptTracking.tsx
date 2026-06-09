import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/auth";
import { Plus, X, ChevronDown, ChevronUp, RefreshCw, Loader2, AlertCircle, Sparkles } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";
const GREEN = "#059669";
const RED = "#DC2626";
const AMBER = "#D97706";

const ALL_LLMS = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Grok"];

const PLAN_LIMITS: Record<string, number> = { free: 5, starter: 50, agency: 150 };

interface CheckResult {
  id: string;
  promptId: string;
  llm: string;
  mentioned: boolean;
  position: number | null;
  fullResponse: string | null;
  brandContext: string | null;
  sentiment: string;
  urlCited: boolean;
  checkedAt: string;
}

interface PromptRow {
  id: string;
  domain: string;
  prompt: string;
  llms: string;
  llmsArray: string[];
  active: boolean;
  createdAt: string;
  results: Array<{ llm: string; result: CheckResult | null; trend: "up" | "down" | "flat" }>;
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch { return iso; }
}

function SentimentBadge({ s }: { s: string }) {
  const cfg = s === "positive"
    ? { bg: "#ECFDF5", color: GREEN, label: "Positive" }
    : s === "negative"
    ? { bg: "#FEF2F2", color: RED, label: "Negative" }
    : { bg: "#FFFBEB", color: AMBER, label: "Neutral" };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 10, padding: "2px 7px", fontSize: 11, fontWeight: 600 }}>
      {cfg.label}
    </span>
  );
}

function TrendBadge({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <span style={{ color: GREEN, fontWeight: 700, fontSize: 16 }}>↑</span>;
  if (trend === "down") return <span style={{ color: RED, fontWeight: 700, fontSize: 16 }}>↓</span>;
  return <span style={{ color: MUTED, fontWeight: 700, fontSize: 16 }}>→</span>;
}

function MentionBadge({ mentioned }: { mentioned: boolean }) {
  return (
    <span style={{ background: mentioned ? "#D1FAE5" : BG, color: mentioned ? "#065F46" : MUTED, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
      {mentioned ? "Yes" : "No"}
    </span>
  );
}

function ExpandedResponse({ result, domain }: { result: CheckResult; domain: string }) {
  const highlightBrand = (text: string) => {
    const brandName = domain.replace(/\.[a-z]{2,}$/i, "");
    if (!brandName || !text.toLowerCase().includes(brandName.toLowerCase())) return text;
    const re = new RegExp(`(${brandName})`, "gi");
    return text.split(re).map((part, i) =>
      re.test(part)
        ? <mark key={i} style={{ background: "#FEF08A", padding: "0 2px", borderRadius: 2 }}>{part}</mark>
        : part
    );
  };

  return (
    <tr>
      <td colSpan={9} style={{ padding: 0 }}>
        <div style={{ background: "#F8F7FF", borderLeft: `3px solid ${P}`, padding: "16px 20px", margin: "0 0 4px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: P, marginBottom: 8 }}>{result.llm} said:</div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px", marginBottom: 12, fontStyle: "italic" }}>
            "{result.fullResponse ? highlightBrand(result.fullResponse) : "No response recorded"}"
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: MUTED }}>
            {result.brandContext && (
              <div>
                <span style={{ fontWeight: 600, color: "#111827" }}>Brand mention: </span>
                <span style={{ color: P }}>"{result.brandContext}"</span>
              </div>
            )}
            {result.position != null && (
              <div><span style={{ fontWeight: 600, color: "#111827" }}>Position: </span>{result.position}</div>
            )}
            <div>
              <span style={{ fontWeight: 600, color: "#111827" }}>Sentiment: </span>
              <SentimentBadge s={result.sentiment} />
            </div>
            <div>
              <span style={{ fontWeight: 600, color: "#111827" }}>URL cited: </span>
              <span style={{ color: result.urlCited ? GREEN : MUTED }}>{result.urlCited ? "Yes" : "No"}</span>
            </div>
            <div style={{ marginLeft: "auto", color: MUTED }}>Checked {fmtTime(result.checkedAt)}</div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function SovBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <div style={{ width: 80, fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: BORDER, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ width: 36, fontSize: 12, color: "#111827", fontWeight: 600, textAlign: "right" }}>{value}%</div>
    </div>
  );
}

export function PromptTracking({ domain, plan = "free" }: { domain: string; plan?: string }) {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [limit, setLimit] = useState(PLAN_LIMITS[plan] ?? 5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const token = getToken();
  const authHeaders = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;

  const load = useCallback(async () => {
    if (!cleanDomain) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/answer-monitoring/prompts?domain=${encodeURIComponent(cleanDomain)}`, { headers: authHeaders });
      const json = await r.json() as { prompts: PromptRow[]; limit: number };
      setPrompts(json.prompts ?? []);
      setLimit(json.limit ?? PLAN_LIMITS[plan] ?? 5);
    } catch { setError("Could not load prompts."); }
    finally { setLoading(false); }
  }, [cleanDomain, plan]);

  useEffect(() => { load(); }, [load]);

  const checkPrompt = async (id: string) => {
    setChecking(id);
    try {
      const r = await fetch(`/api/answer-monitoring/check/${id}`, { method: "POST", headers: authHeaders });
      const json = await r.json() as { results: Array<{ llm: string; result: CheckResult }> };
      if (json.results) {
        setPrompts(prev => prev.map(p => {
          if (p.id !== id) return p;
          const newResults = p.results.map(lr => {
            const fresh = json.results.find(r => r.llm === lr.llm);
            if (!fresh) return lr;
            const prev = lr.result;
            let trend: "up" | "down" | "flat" = "flat";
            if (prev) {
              if (!prev.mentioned && fresh.result.mentioned) trend = "up";
              else if (prev.mentioned && !fresh.result.mentioned) trend = "down";
            }
            return { ...lr, result: fresh.result, trend };
          });
          return { ...p, results: newResults };
        }));
        setExpandedRows(prev => new Set([...prev, id]));
      }
    } catch { /* ignore */ }
    finally { setChecking(null); }
  };

  const removePrompt = async (id: string) => {
    await fetch(`/api/answer-monitoring/prompts/${id}`, { method: "DELETE", headers: authHeaders });
    setPrompts(prev => prev.filter(p => p.id !== id));
  };

  const toggleExpand = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const totalMentions = prompts.reduce((sum, p) => sum + p.results.filter(r => r.result?.mentioned).length, 0);
  const totalChecked = prompts.reduce((sum, p) => sum + p.results.filter(r => r.result !== null).length, 0);
  const sov = totalChecked > 0 ? Math.round((totalMentions / totalChecked) * 100) : 0;

  const allPositions = prompts.flatMap(p => p.results.map(r => r.result?.position).filter((x): x is number => x != null));
  const avgPosition = allPositions.length > 0 ? Math.round(allPositions.reduce((a, b) => a + b, 0) / allPositions.length) : null;

  const lastChecked = prompts.flatMap(p => p.results.map(r => r.result?.checkedAt)).filter(Boolean).sort().reverse()[0];

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Answer Monitoring</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Track how AI systems answer queries about your brand</div>

      {/* 4-column inline metrics grid */}
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: `1px solid ${BORDER}` }}>
          {[
            { label: "Share of Voice", value: `${sov}%`, sub: `${totalMentions} of ${totalChecked} · add more for accuracy`, warning: prompts.length < 5 },
            { label: "Mentions", value: totalMentions, sub: "across all AI systems" },
            { label: "Tracked", value: `${prompts.length}/${limit}`, sub: plan === "free" ? "Free plan" : plan },
            { label: "Last Checked", value: lastChecked ? fmtTime(lastChecked) : "Never", sub: "auto-checks daily" },
          ].map((m, i) => (
            <div key={m.label} style={{ padding: "16px 20px", borderRight: i < 3 ? `0.5px solid ${BORDER}` : "none" }}>
              <p style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", margin: "0 0 6px" }}>{m.label}</p>
              <p style={{ fontSize: 28, fontWeight: 500, color: m.warning ? AMBER : "#0f172a", lineHeight: 1, margin: 0 }}>{m.value}</p>
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, marginBottom: 0 }}>{m.sub}</p>
            </div>
          ))}
        </div>
        {/* Accuracy warning banner */}
        {prompts.length < 10 && prompts.length > 0 && (
          <div style={{ padding: "10px 20px", background: "#fffbeb", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={14} color="#d97706" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: "#92400e", flex: 1, margin: 0 }}>
              Share of Voice shows {sov}% because only {prompts.length} prompt{prompts.length === 1 ? " is" : "s are"} tracked. Add 10+ prompts for accurate data.
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{ fontSize: 11, fontWeight: 500, color: "#d97706", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Add prompts
            </button>
          </div>
        )}
      </div>

      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Tracked Prompts
            <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 11 }}>{prompts.length}/{limit}</span>
          </div>
          <button
            onClick={() => { if (prompts.length >= limit) { setLimitReached(true); return; } setShowModal(true); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={13} /> Add prompt
          </button>
        </div>

        {limitReached && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
            <AlertCircle size={15} color={RED} />
            You have reached your {plan} plan limit of {limit} prompts. Upgrade to track more.
          </div>
        )}

        {error && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
            <AlertCircle size={15} color={RED} />{error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: MUTED, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Loading prompts...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : prompts.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 8 }}>No prompts tracked yet</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Add a query to start tracking where your brand appears in AI answers.</div>
            <button onClick={() => setShowModal(true)} style={{ padding: "9px 20px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Add your first prompt
            </button>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Prompt", "AI", "Mentioned", "Pos", "AI Said", "Sentiment", "Trend", ""].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", padding: "8px 12px", borderBottom: "0.5px solid #e8eaef", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prompts.flatMap(p =>
                    p.results.map((lr, li) => {
                      const rowKey = `${p.id}:${lr.llm}`;
                      const expanded = expandedRows.has(rowKey);
                      const r = lr.result;
                      const aiSaid = r?.fullResponse ? r.fullResponse.slice(0, 100) + (r.fullResponse.length > 100 ? "..." : "") : null;
                      return [
                        <tr
                          key={rowKey}
                          style={{ background: expanded ? "#f8fafc" : undefined, cursor: r ? "pointer" : undefined, verticalAlign: "middle" }}
                          onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = "#f8fafc"; }}
                          onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = ""; }}
                          onClick={() => r && toggleExpand(rowKey)}
                        >
                          <td style={{ padding: "14px 12px", borderBottom: "0.5px solid #f1f5f9", maxWidth: 240 }}>
                            {li === 0 && (
                              <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.4 }}>{p.prompt}</div>
                            )}
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "0.5px solid #f1f5f9", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                            <span style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#374151" }}>{lr.llm}</span>
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "0.5px solid #f1f5f9" }}>
                            {r ? <MentionBadge mentioned={r.mentioned} /> : <span style={{ color: MUTED, fontSize: 11 }}>Not checked</span>}
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "0.5px solid #f1f5f9", fontWeight: 600, color: r?.position != null ? "#111827" : MUTED }}>
                            {r?.position != null ? `#${r.position}` : "-"}
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "0.5px solid #f1f5f9", maxWidth: 220 }}>
                            {aiSaid ? (
                              <span style={{ fontSize: 12, color: "#374151", fontStyle: "italic" }}>"{aiSaid}"</span>
                            ) : <span style={{ color: MUTED, fontSize: 11 }}>{r ? "Not mentioned" : "-"}</span>}
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "0.5px solid #f1f5f9" }} onClick={e => e.stopPropagation()}>
                            {r ? <SentimentBadge s={r.sentiment} /> : <span style={{ color: MUTED, fontSize: 11 }}>-</span>}
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "0.5px solid #f1f5f9" }} onClick={e => e.stopPropagation()}>
                            <TrendBadge trend={lr.trend} />
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "0.5px solid #f1f5f9" }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              {r && (
                                <button
                                  onClick={() => toggleExpand(rowKey)}
                                  style={{ padding: "4px 10px", background: expanded ? P : "white", color: expanded ? "white" : P, border: `1px solid ${expanded ? P : BORDER}`, borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                                  {expanded ? "Close" : "View"}
                                </button>
                              )}
                              <button
                                onClick={() => checkPrompt(p.id)}
                                disabled={checking === p.id}
                                style={{ padding: "4px 10px", background: "white", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 11, color: checking === p.id ? MUTED : "#374151", cursor: checking === p.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                                {checking === p.id ? <Loader2 size={10} style={{ animation: "spin 0.8s linear infinite" }} /> : <RefreshCw size={10} />}
                                {checking === p.id ? "" : "Refresh"}
                              </button>
                            </div>
                          </td>
                        </tr>,
                        expanded && r ? <ExpandedResponse key={`${rowKey}-exp`} result={r} domain={cleanDomain} /> : null,
                      ];
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Empty state nudge when < 5 prompts tracked */}
            {prompts.length < 5 && (
              <div style={{ padding: "40px 20px", textAlign: "center", background: "#f8fafc", borderTop: "0.5px solid #e8eaef" }}>
                <AlertCircle size={32} color="#cbd5e1" style={{ display: "block", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: "#0f172a", marginBottom: 6 }}>Track more prompts for real data</p>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, maxWidth: 300, margin: "0 auto 16px" }}>
                  Add the questions your customers ask AI about your category. You have {limit - prompts.length} slots remaining.
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  style={{ padding: "8px 18px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  + Add your first 10 prompts
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <AddPromptModal
          domain={cleanDomain}
          onClose={() => setShowModal(false)}
          onAdd={async (prompt, llms) => {
            const r = await fetch("/api/answer-monitoring/prompts", {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({ domain: cleanDomain, prompt, llms }),
            });
            const json = await r.json() as { prompt?: PromptRow; error?: string; limitReached?: boolean };
            if (json.limitReached) { setLimitReached(true); setShowModal(false); return; }
            if (json.error) return;
            setShowModal(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function AddPromptModal({ domain, onClose, onAdd }: {
  domain: string;
  onClose: () => void;
  onAdd: (prompt: string, llms: string[]) => Promise<void>;
}) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedLlms, setSelectedLlms] = useState<string[]>(["ChatGPT"]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  const token = getToken();
  const authHeaders = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  useEffect(() => {
    setLoadingSuggestions(true);
    fetch(`/api/answer-monitoring/suggest?domain=${encodeURIComponent(domain)}`, { headers: authHeaders })
      .then(r => r.json() as Promise<{ suggestions: string[] }>)
      .then(j => setSuggestions(j.suggestions ?? []))
      .catch(() => {})
      .finally(() => setLoadingSuggestions(false));
  }, [domain]);

  const toggleLlm = (llm: string) => {
    setSelectedLlms(prev => prev.includes(llm) ? (prev.length > 1 ? prev.filter(l => l !== llm) : prev) : [...prev, llm]);
  };

  const activePrompt = customPrompt.trim() || selectedSuggestion || "";

  const submit = async () => {
    if (!activePrompt || selectedLlms.length === 0) return;
    setAdding(true);
    await onAdd(activePrompt, selectedLlms);
    setAdding(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "white", borderRadius: 12, padding: 28, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Track a prompt</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><X size={18} /></button>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Type your own</div>
        <textarea
          value={customPrompt}
          onChange={e => { setCustomPrompt(e.target.value); setSelectedSuggestion(null); }}
          placeholder="What are the best AI visibility tools for SaaS?"
          rows={2}
          style={{ width: "100%", border: `1.5px solid ${customPrompt.trim() ? P : BORDER}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        />

        <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={12} /> Suggested for {domain}
        </div>
        {loadingSuggestions ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: MUTED }}>
            <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> Generating suggestions...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ fontSize: 12, color: MUTED }}>No suggestions available</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => { setSelectedSuggestion(selectedSuggestion === s ? null : s); setCustomPrompt(""); }}
                style={{
                  background: selectedSuggestion === s ? "#EEF2FF" : BG,
                  border: `1.5px solid ${selectedSuggestion === s ? P : BORDER}`,
                  borderRadius: 8, padding: "9px 12px", fontSize: 13, color: selectedSuggestion === s ? P : "#374151",
                  cursor: "pointer", textAlign: "left", fontWeight: selectedSuggestion === s ? 600 : 400,
                }}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 8px" }}>Track on</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ALL_LLMS.map(llm => (
            <button
              key={llm}
              onClick={() => toggleLlm(llm)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: selectedLlms.includes(llm) ? P : "white",
                color: selectedLlms.includes(llm) ? "white" : "#374151",
                border: `1.5px solid ${selectedLlms.includes(llm) ? P : BORDER}`,
              }}>
              {llm}
            </button>
          ))}
        </div>

        <button
          onClick={submit}
          disabled={!activePrompt || adding}
          style={{
            width: "100%", marginTop: 20, padding: "12px", background: !activePrompt ? "#C7D2FE" : P,
            color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: !activePrompt ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
          {adding ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Adding...</> : `Start tracking across ${selectedLlms.length} LLM${selectedLlms.length > 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
