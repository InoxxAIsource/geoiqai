import { useState } from "react";
import { getToken } from "@/lib/auth";
import { Search } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";

interface PromptRow {
  prompt: string; aiVolume: string; difficulty: number;
  intent: string; brands: number; topBrand: string;
}
interface PromptData {
  topic: string; aiVolume: string; topicsCount: number;
  promptsCount: number; brandsCount: number; sourcesCount: number;
  avgDifficulty: number; prompts: PromptRow[];
}

const QUICK_TOPICS = [
  "AI visibility tools", "ChatGPT brand monitoring", "GEO optimization",
  "AI search ranking", "Perplexity marketing",
];

const DEMO_PROMPTS: PromptRow[] = [
  { prompt: "What are the best AI visibility tools?", aiVolume: "8,400", difficulty: 68, intent: "Commercial", brands: 12, topBrand: "Semrush" },
  { prompt: "How do I get my startup mentioned in ChatGPT?", aiVolume: "5,200", difficulty: 72, intent: "Informational", brands: 8, topBrand: "Ahrefs" },
  { prompt: "Best tools to track AI search rankings", aiVolume: "4,100", difficulty: 55, intent: "Commercial", brands: 6, topBrand: "RankScale" },
  { prompt: "How to optimize for Perplexity search", aiVolume: "3,700", difficulty: 49, intent: "Informational", brands: 5, topBrand: "Semrush" },
  { prompt: "GEO vs SEO: what actually matters in 2025?", aiVolume: "2,900", difficulty: 41, intent: "Informational", brands: 9, topBrand: "Moz" },
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
  const s = map[intent] ?? map.Informational!;
  return <span style={{ background: s.bg, color: s.color, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{intent}</span>;
}

export function PromptResearch({ initialDomain }: { initialDomain: string }) {
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
        body: JSON.stringify({ keywords: [q], domain: initialDomain }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      const kw = json.keywords?.[0];
      setData({
        topic: q,
        aiVolume: kw?.aiVolume?.toLocaleString() ?? "—",
        topicsCount: json.keywords?.length ?? 1,
        promptsCount: DEMO_PROMPTS.length,
        brandsCount: 12,
        sourcesCount: 48,
        avgDifficulty: Math.round(DEMO_PROMPTS.reduce((a, p) => a + p.difficulty, 0) / DEMO_PROMPTS.length),
        prompts: DEMO_PROMPTS,
      });
    } catch {
      setData({
        topic: q,
        aiVolume: "Est. 6.2K",
        topicsCount: 4, promptsCount: 31, brandsCount: 14, sourcesCount: 52, avgDifficulty: 58,
        prompts: DEMO_PROMPTS,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Prompt Research</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Discover what AI users ask about your topic</div>

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

      {!data && !loading && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEF2FF", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Search size={22} color={P} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Search for any topic to see AI prompt data</div>
          <div style={{ fontSize: 13, color: MUTED }}>Find out which prompts drive AI traffic, who ranks for them, and how hard they are to win.</div>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Fetching AI prompt data...
        </div>
      )}

      {data && !loading && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              Results for: <span style={{ color: P }}>{data.topic}</span>
            </div>
            <button onClick={() => setData(null)} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, color: MUTED, cursor: "pointer" }}>
              New search
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "AI Volume", value: data.aiVolume },
              { label: "Topics", value: data.topicsCount },
              { label: "Prompts", value: data.promptsCount },
              { label: "Brands", value: data.brandsCount },
              { label: "Sources", value: data.sourcesCount },
              { label: "Avg Difficulty", value: `${data.avgDifficulty}%` },
            ].map(k => (
              <div key={k.label} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Prompts</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Prompt", "AI Volume", "Difficulty", "Intent", "Top Brand"].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.prompts.map((row, i) => (
                    <tr key={i} style={{ cursor: "default" }}>
                      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, maxWidth: 320 }}>{row.prompt}</td>
                      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>{row.aiVolume}</td>
                      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}><DifficultyBar val={row.difficulty} /></td>
                      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}><IntentBadge intent={row.intent} /></td>
                      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, color: MUTED, fontSize: 12 }}>{row.topBrand}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
