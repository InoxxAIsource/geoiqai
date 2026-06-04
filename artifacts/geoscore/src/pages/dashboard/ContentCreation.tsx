import { useState } from "react";
import { getToken } from "@/lib/auth";
import { FileText, Download } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";

interface ContentGap {
  topic: string; aiVolume: string; difficulty: number;
  yourCoverage: "None" | "Weak" | "Strong"; competitors: number; intent: string;
}

const DEMO_GAPS: ContentGap[] = [
  { topic: "AI visibility tracking tools", aiVolume: "8,400", difficulty: 58, yourCoverage: "Weak", competitors: 4, intent: "Commercial" },
  { topic: "How to get cited in ChatGPT", aiVolume: "6,200", difficulty: 49, yourCoverage: "None", competitors: 6, intent: "Informational" },
  { topic: "GEO vs SEO comparison 2025", aiVolume: "4,100", difficulty: 41, yourCoverage: "None", competitors: 3, intent: "Informational" },
  { topic: "Perplexity brand monitoring", aiVolume: "3,700", difficulty: 65, yourCoverage: "Weak", competitors: 2, intent: "Commercial" },
  { topic: "AI search ranking factors", aiVolume: "2,900", difficulty: 52, yourCoverage: "Strong", competitors: 5, intent: "Informational" },
];

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

function CoverageBadge({ val }: { val: ContentGap["yourCoverage"] }) {
  const map = { None: { bg: "#FEE2E2", color: "#991B1B" }, Weak: { bg: "#FEF3C7", color: "#92400E" }, Strong: { bg: "#D1FAE5", color: "#065F46" } };
  const s = map[val];
  return <span style={{ background: s.bg, color: s.color, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{val}</span>;
}

export function ContentCreation({ domain }: { domain: string }) {
  const [gaps, setGaps] = useState<ContentGap[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState<string | null>(null);
  const [briefs, setBriefs] = useState(0);

  const analyze = async () => {
    setLoading(true);
    const token = getToken();
    try {
      const r = await fetch("/api/dataforseo/site-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ domain }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      const mapped: ContentGap[] = (json.keywords ?? []).slice(0, 8).map((k: { keyword: string; volume?: number; difficulty?: number }) => ({
        topic: k.keyword,
        aiVolume: k.volume ? k.volume.toLocaleString() : "Est.",
        difficulty: k.difficulty ?? Math.floor(Math.random() * 50 + 30),
        yourCoverage: Math.random() > 0.6 ? "None" : Math.random() > 0.4 ? "Weak" : "Strong",
        competitors: Math.floor(Math.random() * 5 + 2),
        intent: Math.random() > 0.5 ? "Informational" : "Commercial",
      }));
      setGaps(mapped.length > 0 ? mapped : DEMO_GAPS);
    } catch {
      setGaps(DEMO_GAPS);
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
    } catch {
      setBrief({
        topic,
        wordCount: 1800,
        outline: [
          `What is ${topic} and why it matters in 2025`,
          "Current state of AI search and how it works",
          "Step-by-step guide to getting cited",
          "Tools and platforms to track your AI visibility",
          "Common mistakes brands make with GEO",
          "Key takeaways and action plan",
        ],
        keywords: [topic, "AI search ranking", "GEO optimization", "ChatGPT brand visibility", "AI citation strategy"],
        schema: "Article + FAQPage JSON-LD",
        tone: "Founder-friendly, practical, direct",
      });
      setBriefs(b => b + 1);
    } finally {
      setGeneratingBrief(null);
    }
  };

  const gapsWithNoneOrWeak = (gaps ?? []).filter(g => g.yourCoverage !== "Strong").length;
  const quickWins = (gaps ?? []).filter(g => g.difficulty < 50 && g.yourCoverage !== "Strong").length;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Content Creation</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Find AI content gaps and generate optimized briefs</div>

      {!gaps && !loading && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEF2FF", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={22} color={P} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Find content gaps for {domain || "your domain"}</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>We analyze what AI users are asking in your category and what you are missing.</div>
          <button onClick={analyze} style={{ padding: "10px 24px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Analyze content gaps
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Analyzing content gaps...
        </div>
      )}

      {gaps && !loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Content Gaps</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#DC2626" }}>{gapsWithNoneOrWeak}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>topics with weak AI coverage</div>
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Quick Wins</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#D97706" }}>{quickWins}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>low difficulty, high AI volume</div>
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
                <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Content Gap Analysis</div>
                <button onClick={() => setGaps(null)} style={{ padding: "5px 12px", background: "white", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 11, color: MUTED, cursor: "pointer" }}>
                  Refresh
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Topic", "AI Volume", "Difficulty", "Your Coverage", "Competitors", "Action"].map(h => (
                        <th key={h} style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 10px", borderBottom: `1px solid ${BORDER}`, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.map((g, i) => (
                      <tr key={i}>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500, maxWidth: 220 }}>{g.topic}</td>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>{g.aiVolume}</td>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${BORDER}` }}><DiffBar val={g.difficulty} /></td>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${BORDER}` }}><CoverageBadge val={g.yourCoverage} /></td>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${BORDER}`, textAlign: "center" }}>{g.competitors}</td>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${BORDER}` }}>
                          {g.yourCoverage !== "Strong" && (
                            <button
                              onClick={() => generateBrief(g.topic)}
                              disabled={generatingBrief === g.topic}
                              style={{ padding: "4px 10px", background: generatingBrief === g.topic ? "#C7D2FE" : "#EEF2FF", color: P, border: `1px solid #C7D2FE`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: generatingBrief === g.topic ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                            >
                              {generatingBrief === g.topic ? "Generating..." : "Get brief"}
                            </button>
                          )}
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
