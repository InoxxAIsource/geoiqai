import { useState } from "react";
import { getToken } from "@/lib/auth";
import { Search, AlertCircle } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";

interface KwRow {
  keyword: string; aiVolume: number | null; difficulty: number | null; intent: string | null;
}
interface PromptData {
  topic: string;
  keywords: KwRow[];
  totalVolume: string;
}

const QUICK_TOPICS = [
  "AI visibility tools", "ChatGPT brand monitoring", "GEO optimization",
  "AI search ranking", "Perplexity marketing",
];

function DifficultyBar({ val }: { val: number }) {
  const color = val >= 70 ? "#DC2626" : val >= 50 ? "#D97706" : "#059669";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 60, height: 6, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${val}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, color }}>{val}</span>
    </div>
  );
}

function IntentBadge({ intent }: { intent: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Commercial: { bg: "#EEF2FF", color: P },
    Informational: { bg: "#D1FAE5", color: "#065F46" },
    Navigational: { bg: "#FEF3C7", color: "#92400E" },
    Transactional: { bg: "#FEE2E2", color: "#991B1B" },
  };
  const s = map[intent] ?? { bg: "#F3F4F6", color: MUTED };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{intent}</span>;
}

export function PromptResearch({ initialDomain: _initialDomain }: { initialDomain: string }) {
  const [topic, setTopic] = useState("");
  const [data, setData] = useState<PromptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (t?: string) => {
    const q = (t ?? topic).trim();
    if (!q) return;
    setTopic(q);
    setError(null);
    setLoading(true);
    const token = getToken();
    try {
      const r = await fetch("/api/dataforseo/ai-keyword-volume", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ keywords: [q], domain: _initialDomain }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);

      const kwList: KwRow[] = (json.keywords ?? []).map((k: { keyword: string; aiSearchVolume?: number; aiVolume?: number; difficulty?: number; searchIntent?: string }) => ({
        keyword: k.keyword,
        aiVolume: k.aiSearchVolume ?? k.aiVolume ?? null,
        difficulty: k.difficulty ?? null,
        intent: k.searchIntent ?? null,
      }));

      const totalVol = kwList.reduce((s, k) => s + (k.aiVolume ?? 0), 0);

      setData({
        topic: q,
        keywords: kwList,
        totalVolume: totalVol > 0 ? totalVol.toLocaleString() : "—",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch prompt data. Check your DataForSEO credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Prompt Research</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Discover AI search volume for topics and keywords</div>

      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", background: "white" }}>
            <Search size={15} color={MUTED} />
            <input
              type="text" value={topic} onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()}
              placeholder="Enter a topic, keyword or question"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#111827" }}
            />
          </div>
          <button onClick={() => search()} disabled={loading || !topic.trim()} style={{ padding: "10px 22px", background: loading || !topic.trim() ? "#C7D2FE" : P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading || !topic.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
            {loading ? "Searching..." : "Find prompts"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Try:</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {QUICK_TOPICS.map(t => (
            <button key={t} onClick={() => search(t)} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "5px 13px", fontSize: 12, color: "#374151", cursor: "pointer" }}>{t}</button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
          <AlertCircle size={15} color="#DC2626" />
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEF2FF", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Search size={22} color={P} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Search for any topic to see AI search volume</div>
          <div style={{ fontSize: 13, color: MUTED }}>Find out how much AI search traffic a keyword generates and how hard it is to win.</div>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Fetching AI keyword data from DataForSEO...
        </div>
      )}

      {data && !loading && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              Results for: <span style={{ color: P }}>{data.topic}</span>
            </div>
            <button onClick={() => { setData(null); setError(null); }} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, color: MUTED, cursor: "pointer" }}>
              New search
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total AI Volume", value: data.totalVolume },
              { label: "Keywords Found", value: data.keywords.length },
              { label: "Data Source", value: "DataForSEO" },
            ].map(k => (
              <div key={k.label} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{k.value}</div>
              </div>
            ))}
          </div>

          {data.keywords.length > 0 ? (
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Keywords</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Keyword", "AI Volume", "Difficulty", "Intent"].map(h => (
                        <th key={h} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.keywords.map((row, i) => (
                      <tr key={i}>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, maxWidth: 320 }}>{row.keyword}</td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>
                          {row.aiVolume != null ? row.aiVolume.toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                          {row.difficulty != null ? <DifficultyBar val={row.difficulty} /> : <span style={{ color: MUTED }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                          {row.intent ? <IntentBadge intent={row.intent} /> : <span style={{ color: MUTED, fontSize: 12 }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "40px 24px", textAlign: "center", color: MUTED, fontSize: 13 }}>
              No keyword data returned from DataForSEO for this topic. Try a different search term.
            </div>
          )}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
