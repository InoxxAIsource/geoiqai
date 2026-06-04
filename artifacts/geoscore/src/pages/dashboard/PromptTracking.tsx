import { useState } from "react";
import { getToken } from "@/lib/auth";
import { Plus, X } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";

interface TrackedPrompt {
  id: string; prompt: string; llm: string; position: string;
  mentioned: boolean; lastChecked: string; trend: "up" | "down" | "flat";
}

const DEMO_PROMPTS: TrackedPrompt[] = [
  { id: "1", prompt: "What are the best AI visibility tools?", llm: "ChatGPT", position: "3", mentioned: true, lastChecked: "2 hours ago", trend: "up" },
  { id: "2", prompt: "How do I track my brand in Perplexity?", llm: "Perplexity", position: "7", mentioned: true, lastChecked: "2 hours ago", trend: "flat" },
  { id: "3", prompt: "Best GEO optimization tools for startups", llm: "Gemini", position: "-", mentioned: false, lastChecked: "2 hours ago", trend: "down" },
];

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  return (
    <span style={{ color: trend === "up" ? "#059669" : trend === "down" ? "#DC2626" : MUTED, fontWeight: 700, fontSize: 14 }}>
      {trend === "up" ? "+" : trend === "down" ? "-" : "="}
    </span>
  );
}

export function PromptTracking({ domain }: { domain: string }) {
  const [prompts, setPrompts] = useState<TrackedPrompt[]>(DEMO_PROMPTS);
  const [showAdd, setShowAdd] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [newLlm, setNewLlm] = useState("ChatGPT");
  const [checking, setChecking] = useState<string | null>(null);

  const addPrompt = () => {
    if (!newPrompt.trim()) return;
    const p: TrackedPrompt = {
      id: Date.now().toString(), prompt: newPrompt.trim(), llm: newLlm,
      position: "-", mentioned: false, lastChecked: "Never", trend: "flat",
    };
    setPrompts(prev => [p, ...prev]);
    setNewPrompt("");
    setShowAdd(false);
  };

  const removePrompt = (id: string) => setPrompts(prev => prev.filter(p => p.id !== id));

  const checkNow = async (id: string) => {
    setChecking(id);
    const token = getToken();
    try {
      const p = prompts.find(x => x.id === id);
      if (!p) return;
      const r = await fetch("/api/dataforseo/chatgpt-scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ domain, keywords: [p.prompt] }),
      });
      const json = await r.json();
      if (!json.error) {
        setPrompts(prev => prev.map(x => x.id === id ? {
          ...x,
          mentioned: json.domainCited ?? x.mentioned,
          position: json.domainCited ? "1-3" : "-",
          lastChecked: "Just now",
          trend: json.domainCited ? "up" : "flat",
        } : x));
      }
    } catch {
      setPrompts(prev => prev.map(x => x.id === id ? { ...x, lastChecked: "Just now" } : x));
    } finally {
      setChecking(null);
    }
  };

  const visibility = Math.round((prompts.filter(p => p.mentioned).length / Math.max(prompts.length, 1)) * 100);

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Prompt Tracking</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Track your position for specific AI search prompts</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "AI Visibility", value: `${visibility}%` },
          { label: "Total Mentions", value: prompts.filter(p => p.mentioned).length },
          { label: "Avg Position", value: (() => { const ranked = prompts.filter(p => p.position !== "-").map(p => parseInt(p.position, 10)).filter(n => !isNaN(n)); return ranked.length ? Math.round(ranked.reduce((a, b) => a + b, 0) / ranked.length) : "-"; })() },
          { label: "Tracked Prompts", value: prompts.length },
        ].map(k => (
          <div key={k.label} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tracked Prompts</div>
          <button onClick={() => setShowAdd(!showAdd)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: showAdd ? "white" : P, color: showAdd ? MUTED : "white", border: `1.5px solid ${showAdd ? BORDER : P}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {showAdd ? <X size={13} /> : <Plus size={13} />} {showAdd ? "Cancel" : "Add prompt"}
          </button>
        </div>

        {showAdd && (
          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                type="text" value={newPrompt} onChange={e => setNewPrompt(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addPrompt()}
                placeholder="Enter a prompt to track..."
                style={{ flex: 1, minWidth: 240, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none" }}
              />
              <select value={newLlm} onChange={e => setNewLlm(e.target.value)} style={{ border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", background: "white", color: "#111827" }}>
                {["ChatGPT", "Gemini", "Perplexity", "Claude"].map(l => <option key={l}>{l}</option>)}
              </select>
              <button onClick={addPrompt} disabled={!newPrompt.trim()} style={{ padding: "9px 18px", background: !newPrompt.trim() ? "#C7D2FE" : P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !newPrompt.trim() ? "not-allowed" : "pointer" }}>
                Add
              </button>
            </div>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Prompt", "LLM", "Position", "Mentioned", "Last Checked", "Trend", ""].map(h => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prompts.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, maxWidth: 300 }}>{p.prompt}</td>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>{p.llm}</td>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>{p.position}</td>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ background: p.mentioned ? "#D1FAE5" : BG, color: p.mentioned ? "#065F46" : MUTED, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                      {p.mentioned ? "Yes" : "No"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, color: MUTED, fontSize: 11 }}>{p.lastChecked}</td>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}><TrendIcon trend={p.trend} /></td>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => checkNow(p.id)} disabled={checking === p.id} style={{ padding: "4px 10px", background: "white", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 11, color: checking === p.id ? MUTED : P, cursor: checking === p.id ? "not-allowed" : "pointer" }}>
                        {checking === p.id ? "..." : "Check"}
                      </button>
                      <button onClick={() => removePrompt(p.id)} style={{ padding: "4px 10px", background: "white", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 11, color: "#DC2626", cursor: "pointer" }}>
                        <X size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
