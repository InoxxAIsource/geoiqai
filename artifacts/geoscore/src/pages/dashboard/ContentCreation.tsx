import { useState } from "react";
import { getToken } from "@/lib/auth";
import { FileText, Download, AlertCircle } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";

interface ContentGap {
  topic: string;
  aiVolume: string;
  difficulty: number | null;
  intent: string | null;
}

interface Brief {
  topic: string; wordCount: number; outline: string[];
  keywords: string[]; schema: string; tone: string;
}

function DiffBar({ val }: { val: number }) {
  const color = val >= 60 ? "#DC2626" : val >= 40 ? "#D97706" : "#059669";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 56, height: 6, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
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

export function ContentCreation({ domain }: { domain: string }) {
  const [gaps, setGaps] = useState<ContentGap[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState<string | null>(null);
  const [briefs, setBriefs] = useState(0);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    const token = getToken();
    try {
      const r = await fetch("/api/dataforseo/site-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ domain }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      const mapped: ContentGap[] = (json.keywords ?? []).slice(0, 10).map((k: { keyword: string; volume?: number; difficulty?: number; searchIntent?: string }) => ({
        topic: k.keyword,
        aiVolume: k.volume ? k.volume.toLocaleString() : "—",
        difficulty: k.difficulty ?? null,
        intent: k.searchIntent ?? null,
      }));
      if (mapped.length === 0) throw new Error("No keywords returned for this domain.");
      setGaps(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch keywords. Check your DataForSEO credentials.");
    } finally {
      setLoading(false);
    }
  };

  const generateBrief = async (topic: string) => {
    setGeneratingBrief(topic);
    setBrief(null);
    const token = getToken();
    try {
      const r = await fetch("/api/ai/content-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ topic, domain }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setBrief(json);
      setBriefs(b => b + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Brief generation failed.");
    } finally {
      setGeneratingBrief(null);
    }
  };

  const withDifficulty = (gaps ?? []).filter(g => g.difficulty !== null);
  const avgDifficulty = withDifficulty.length > 0
    ? Math.round(withDifficulty.reduce((a, g) => a + (g.difficulty ?? 0), 0) / withDifficulty.length)
    : null;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Content Creation</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Find AI-ranked keywords for your domain and generate optimized content briefs</div>

      {error && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
          <AlertCircle size={15} color="#DC2626" />
          {error}
        </div>
      )}

      {!gaps && !loading && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEF2FF", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={22} color={P} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Find keywords ranking for {domain || "your domain"}</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>We pull keywords your domain already ranks for and let you generate AI-optimized content briefs for each.</div>
          <button onClick={analyze} style={{ padding: "10px 24px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Analyze keywords
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Fetching ranked keywords from DataForSEO...
        </div>
      )}

      {gaps && !loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Keywords Found</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: P }}>{gaps.length}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>ranked by {domain}</div>
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Avg Difficulty</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#D97706" }}>
                {avgDifficulty !== null ? avgDifficulty : "—"}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>across ranked keywords</div>
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Briefs Generated</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: P }}>{briefs}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>AI content briefs created</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: brief ? "1fr 1fr" : "1fr", gap: 16 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ranked Keywords</div>
                <button onClick={() => { setGaps(null); setBrief(null); setError(null); }} style={{ padding: "5px 12px", background: "white", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 11, color: MUTED, cursor: "pointer" }}>
                  Refresh
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Keyword", "Search Volume", "Difficulty", "Intent", "Action"].map(h => (
                        <th key={h} style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 10px", borderBottom: `1px solid ${BORDER}`, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.map((g, i) => (
                      <tr key={i}>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500, maxWidth: 220 }}>{g.topic}</td>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>{g.aiVolume}</td>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${BORDER}` }}>
                          {g.difficulty !== null ? <DiffBar val={g.difficulty} /> : <span style={{ color: MUTED, fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${BORDER}` }}>
                          {g.intent ? <IntentBadge intent={g.intent} /> : <span style={{ color: MUTED, fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${BORDER}` }}>
                          <button
                            onClick={() => generateBrief(g.topic)}
                            disabled={generatingBrief === g.topic}
                            style={{ padding: "4px 10px", background: generatingBrief === g.topic ? "#C7D2FE" : "#EEF2FF", color: P, border: `1px solid #C7D2FE`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: generatingBrief === g.topic ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                          >
                            {generatingBrief === g.topic ? "Generating..." : "Get brief"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {brief && (
              <div style={{ background: "white", border: `1.5px solid ${P}`, borderRadius: 10, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: P, textTransform: "uppercase", letterSpacing: "0.06em" }}>Content Brief</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(brief, null, 2))}
                      style={{ padding: "5px 10px", background: "white", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 11, color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Download size={11} /> Copy
                    </button>
                    <button onClick={() => setBrief(null)} style={{ padding: "5px 10px", background: "white", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 11, color: MUTED, cursor: "pointer" }}>
                      Close
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, lineHeight: 1.4 }}>{brief.topic}</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "Word count", value: brief.wordCount.toLocaleString() },
                    { label: "Schema", value: brief.schema },
                    { label: "Tone", value: brief.tone },
                  ].map(k => (
                    <div key={k.label} style={{ background: BG, borderRadius: 6, padding: "8px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", marginBottom: 3 }}>{k.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{k.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Outline</div>
                  {brief.outline.map((h, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ color: P, fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{i + 1}.</span>
                      <span style={{ fontSize: 13 }}>{h}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Target keywords</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {brief.keywords.map(kw => (
                      <span key={kw} style={{ background: "#EEF2FF", color: P, borderRadius: 12, padding: "3px 10px", fontSize: 11, fontWeight: 500 }}>{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
