import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { AlertCircle } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";

interface BrandData {
  domain: string;
  overallScore: number;
  chatgpt: number;
  gemini: number;
  perplexity: number;
  sentiment: { positive: number; neutral: number; negative: number };
  narrativeDrivers: { topic: string; mentions: number; trend: "up" | "down" | "flat" }[];
  topQuestions: { question: string; frequency: number; you: boolean }[];
  perceptionSummary: string;
}

function ScoreRing({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 60 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER} strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={score > 0 ? color : BORDER} strokeWidth={7}
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray 0.8s" }} />
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={18} fontWeight={700} fill={score > 0 ? color : MUTED}>{score}</text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textAlign: "center" }}>{label}</div>
    </div>
  );
}

function SentimentBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  const total = positive + neutral + negative;
  if (total === 0) {
    return (
      <div style={{ fontSize: 12, color: MUTED, padding: "12px 0" }}>
        Sentiment analysis is available after running a full AI audit on this domain.
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ width: `${positive}%`, background: "#059669" }} />
        <div style={{ width: `${neutral}%`, background: "#D1D5DB" }} />
        <div style={{ width: `${negative}%`, background: "#DC2626" }} />
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { label: "Positive", val: positive, color: "#059669" },
          { label: "Neutral", val: neutral, color: "#6B7280" },
          { label: "Negative", val: negative, color: "#DC2626" },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
            <span style={{ color: MUTED }}>{s.label}:</span>
            <span style={{ fontWeight: 600 }}>{s.val}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type SubPage = "overview" | "perception" | "narrative" | "questions";

export function BrandPerformanceSection({ domain }: { domain: string }) {
  const [data, setData] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(!!domain);
  const [error, setError] = useState<string | null>(null);
  const [subPage, setSubPage] = useState<SubPage>("overview");

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    const token = getToken();
    fetch(`/api/dataforseo/brand-performance?domain=${encodeURIComponent(domain)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d as BrandData);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : "Could not load brand performance data.");
      })
      .finally(() => setLoading(false));
  }, [domain]);

  const SUB_TABS: { id: SubPage; label: string }[] = [
    { id: "overview", label: "Brand Performance" },
    { id: "perception", label: "Perception" },
    { id: "narrative", label: "Narrative Drivers" },
    { id: "questions", label: "Questions" },
  ];

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Brand Performance</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>How AI systems see, describe and rank your brand</div>

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 20 }}>
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setSubPage(tab.id)}
            style={{ padding: "10px 18px", fontSize: 13, fontWeight: subPage === tab.id ? 600 : 400, color: subPage === tab.id ? P : MUTED, background: "none", border: "none", borderBottom: `2px solid ${subPage === tab.id ? P : "transparent"}`, cursor: "pointer", marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Loading brand data from DataForSEO...
        </div>
      )}

      {!loading && error && (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "20px 24px" }}>
          <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#991B1B", marginBottom: 4 }}>Could not load brand performance</div>
            <div style={{ fontSize: 13, color: "#B91C1C", marginBottom: 12 }}>{error}</div>
            <a href="/audit" style={{ display: "inline-block", padding: "8px 18px", background: P, color: "white", borderRadius: 7, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              Run free audit instead
            </a>
          </div>
        </div>
      )}

      {!loading && !error && !data && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center", color: MUTED }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 8 }}>No domain selected</div>
          <div style={{ fontSize: 13 }}>Select a brand from the sidebar to see its performance data.</div>
        </div>
      )}

      {!loading && !error && data && subPage === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20 }}>AI Platform Scores</div>
              <div style={{ display: "flex", gap: 24, justifyContent: "space-around" }}>
                <ScoreRing score={data.overallScore} label="Overall" size={100} />
                <ScoreRing score={data.chatgpt} label="ChatGPT" />
                <ScoreRing score={data.gemini} label="Gemini" />
                <ScoreRing score={data.perplexity} label="Perplexity" />
              </div>
              {data.overallScore === 0 && (
                <div style={{ marginTop: 16, fontSize: 12, color: MUTED, textAlign: "center", background: BG, borderRadius: 8, padding: "10px 16px" }}>
                  Score is 0 because {data.domain} wasn't found in LLM mentions for its top keywords. Run a full audit for deeper analysis.
                </div>
              )}
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Sentiment Breakdown</div>
              <SentimentBar {...data.sentiment} />
              {data.perceptionSummary && (
                <div style={{ marginTop: 20, background: BG, borderRadius: 8, padding: "12px 16px", fontSize: 13, lineHeight: 1.6, color: "#374151" }}>
                  {data.perceptionSummary}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Top Narrative Drivers</div>
              {data.narrativeDrivers.length === 0 ? (
                <div style={{ fontSize: 13, color: MUTED, padding: "20px 0" }}>No narrative data available. Run an audit to generate narrative insights.</div>
              ) : data.narrativeDrivers.slice(0, 4).map((n, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{n.topic}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{n.mentions > 0 ? `${n.mentions.toLocaleString()} est. mentions` : "No mentions tracked yet"}</div>
                  </div>
                  <div style={{ fontSize: 18, color: n.trend === "up" ? "#059669" : n.trend === "down" ? "#DC2626" : MUTED }}>
                    {n.trend === "up" ? "+" : n.trend === "down" ? "-" : "="}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Top Questions</div>
              {data.topQuestions.length === 0 ? (
                <div style={{ fontSize: 13, color: MUTED, padding: "20px 0" }}>No questions data. Run an audit to see which questions your brand answers.</div>
              ) : data.topQuestions.slice(0, 4).map((q, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{q.question}</div>
                  <span style={{ background: q.you ? "#D1FAE5" : BG, color: q.you ? "#065F46" : MUTED, borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {q.you ? "You rank" : "Not ranked"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!loading && !error && data && subPage === "perception" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>How AI systems describe your brand</div>
            {data.perceptionSummary ? (
              <div style={{ background: BG, borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.7, color: "#374151", marginBottom: 16 }}>
                {data.perceptionSummary}
              </div>
            ) : (
              <div style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>Run a full audit to get AI-generated perception analysis.</div>
            )}
            <SentimentBar {...data.sentiment} />
          </div>
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>AI Visibility by Platform</div>
            {[
              { name: "ChatGPT", score: data.chatgpt },
              { name: "Gemini", score: data.gemini },
              { name: "Perplexity", score: data.perplexity },
            ].map(p => (
              <div key={p.name} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                <ScoreRing score={p.score} label={p.name} />
                <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                  {p.score > 0
                    ? `${data.domain} appears in ${p.score}% of relevant ${p.name} responses for its top keywords.`
                    : `${data.domain} was not found in ${p.name} responses for its top keywords.`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && data && subPage === "narrative" && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Narrative Drivers</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Keywords your domain ranks for that drive how AI systems frame your brand. Mention estimates are based on AI search volume.</div>
          {data.narrativeDrivers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: MUTED, fontSize: 13 }}>No narrative data. Run a full audit to generate keyword-based narrative insights.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Topic", "Est. AI Mentions", "Trend"].map(h => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.narrativeDrivers.map((n, i) => (
                  <tr key={i}>
                    <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>{n.topic}</td>
                    <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                      {n.mentions > 0 ? n.mentions.toLocaleString() : <span style={{ color: MUTED }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ color: n.trend === "up" ? "#059669" : n.trend === "down" ? "#DC2626" : MUTED, fontWeight: 600 }}>
                        {n.trend === "up" ? "Rising" : n.trend === "down" ? "Falling" : "Stable"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!loading && !error && data && subPage === "questions" && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Questions</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Questions derived from your domain's top keywords. Run a full audit to see real AI-sourced questions about your brand.</div>
          {data.topQuestions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: MUTED, fontSize: 13 }}>No questions data available. Run a full audit to generate question insights.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Question", "Est. AI Frequency", "You rank?"].map(h => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.topQuestions.map((q, i) => (
                  <tr key={i}>
                    <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, maxWidth: 480, lineHeight: 1.5 }}>{q.question}</td>
                    <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>
                      {q.frequency > 0 ? q.frequency.toLocaleString() : <span style={{ color: MUTED }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ background: q.you ? "#D1FAE5" : BG, color: q.you ? "#065F46" : MUTED, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                        {q.you ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
