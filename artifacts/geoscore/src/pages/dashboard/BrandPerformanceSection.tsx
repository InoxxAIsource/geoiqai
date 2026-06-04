import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";

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

const DEMO: BrandData = {
  domain: "yourdomain.com",
  overallScore: 44,
  chatgpt: 41, gemini: 52, perplexity: 38,
  sentiment: { positive: 62, neutral: 28, negative: 10 },
  narrativeDrivers: [
    { topic: "AI search visibility", mentions: 890, trend: "up" },
    { topic: "GEO optimization tools", mentions: 640, trend: "up" },
    { topic: "ChatGPT brand tracking", mentions: 420, trend: "flat" },
    { topic: "Perplexity marketing", mentions: 310, trend: "down" },
    { topic: "AI search rankings", mentions: 270, trend: "up" },
  ],
  topQuestions: [
    { question: "What tools help track brand mentions in AI search?", frequency: 1240, you: false },
    { question: "How do I get mentioned in ChatGPT responses?", frequency: 980, you: true },
    { question: "Best GEO optimization platforms for startups?", frequency: 760, you: true },
    { question: "How to check if Gemini cites my site?", frequency: 520, you: false },
    { question: "What is AI visibility score?", frequency: 490, you: true },
  ],
  perceptionSummary: "AI systems generally describe your brand in neutral-to-positive terms, associating it with AI search optimization tools for startups. The dominant perception is a useful monitoring tool, though authority signals are weak compared to established SEO platforms.",
};

function ScoreRing({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 60 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER} strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray 0.8s" }} />
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={18} fontWeight={700} fill={color}>{score}</text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textAlign: "center" }}>{label}</div>
    </div>
  );
}

function SentimentBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
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
  const [loading, setLoading] = useState(false);
  const [subPage, setSubPage] = useState<SubPage>("overview");

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    const token = getToken();
    fetch(`/api/dataforseo/brand-performance?domain=${encodeURIComponent(domain)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => setData(d.error ? { ...DEMO, domain } : d))
      .catch(() => setData({ ...DEMO, domain }))
      .finally(() => setLoading(false));
  }, [domain]);

  const d = data ?? { ...DEMO, domain };

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
          Loading brand data...
        </div>
      )}

      {!loading && subPage === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20 }}>AI Platform Scores</div>
              <div style={{ display: "flex", gap: 24, justifyContent: "space-around" }}>
                <ScoreRing score={d.overallScore} label="Overall" size={100} />
                <ScoreRing score={d.chatgpt} label="ChatGPT" />
                <ScoreRing score={d.gemini} label="Gemini" />
                <ScoreRing score={d.perplexity} label="Perplexity" />
              </div>
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Sentiment Breakdown</div>
              <SentimentBar {...d.sentiment} />
              <div style={{ marginTop: 20, background: BG, borderRadius: 8, padding: "12px 16px", fontSize: 13, lineHeight: 1.6, color: "#374151" }}>
                {d.perceptionSummary}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Top Narrative Drivers</div>
              {d.narrativeDrivers.slice(0, 4).map((n, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{n.topic}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{n.mentions.toLocaleString()} mentions</div>
                  </div>
                  <div style={{ fontSize: 18, color: n.trend === "up" ? "#059669" : n.trend === "down" ? "#DC2626" : MUTED }}>
                    {n.trend === "up" ? "+" : n.trend === "down" ? "-" : "="}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Top Questions</div>
              {d.topQuestions.slice(0, 4).map((q, i) => (
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

      {!loading && subPage === "perception" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>How AI systems describe your brand</div>
            <div style={{ background: BG, borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.7, color: "#374151", marginBottom: 16 }}>
              {d.perceptionSummary}
            </div>
            <SentimentBar {...d.sentiment} />
          </div>
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Perception by platform</div>
            {[
              { name: "ChatGPT", score: d.chatgpt, desc: "Described as a startup tool for AI search monitoring." },
              { name: "Gemini", score: d.gemini, desc: "Listed among AI visibility platforms with moderate authority." },
              { name: "Perplexity", score: d.perplexity, desc: "Rarely cited, minimal entity recognition." },
            ].map(p => (
              <div key={p.name} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
                <ScoreRing score={p.score} label={p.name} />
                <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && subPage === "narrative" && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Narrative Drivers</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Topics that drive how AI systems frame your brand. Strengthen positive drivers, address negative ones.</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Topic", "AI Mentions", "Trend", "Sentiment"].map(h => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.narrativeDrivers.map((n, i) => (
                <tr key={i}>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>{n.topic}</td>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>{n.mentions.toLocaleString()}</td>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ color: n.trend === "up" ? "#059669" : n.trend === "down" ? "#DC2626" : MUTED, fontWeight: 600 }}>
                      {n.trend === "up" ? "Rising" : n.trend === "down" ? "Falling" : "Stable"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ background: n.trend === "down" ? "#FEE2E2" : "#D1FAE5", color: n.trend === "down" ? "#991B1B" : "#065F46", borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                      {n.trend === "down" ? "Negative" : "Positive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && subPage === "questions" && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Questions</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Questions AI users ask that mention or are relevant to your brand and category.</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Question", "AI Frequency", "You rank?"].map(h => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.topQuestions.map((q, i) => (
                <tr key={i}>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, maxWidth: 480, lineHeight: 1.5 }}>{q.question}</td>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>{q.frequency.toLocaleString()}</td>
                  <td style={{ padding: "11px 12px", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ background: q.you ? "#D1FAE5" : BG, color: q.you ? "#065F46" : MUTED, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                      {q.you ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
