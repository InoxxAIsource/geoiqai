import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { AlertCircle, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";
const GREEN = "#059669";
const RED = "#DC2626";
const AMBER = "#D97706";

interface BrandAnalysis {
  domain: string;
  brandName: string;
  sentiment: { positive: number; neutral: number; negative: number; summary: string };
  businessDrivers: Array<{ driver: string; frequency: number; sentiment: "positive" | "mixed" | "negative" }>;
  competitorsMentioned: Array<{ name: string; mentions: number }>;
  keyStrengths: string[];
  keyWeaknesses: string[];
  perception: string;
  narrativeDrivers: Array<{ topic: string; mentions: number; trend: "up" | "down" | "stable" }>;
  topQuestions: string[];
  insights: Array<{ title: string; description: string; action: string }>;
  shareOfVoice: number;
  overallScore: number;
  isMock?: boolean;
  cached?: boolean;
  scannedAt: string;
  responseCount: number;
}

function ScoreRing({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 60 ? GREEN : score >= 40 ? AMBER : score > 0 ? RED : BORDER;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER} strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray 0.8s" }} />
        <text x={size / 2} y={size / 2 + 6} textAnchor="middle" fontSize={score >= 100 ? 14 : 18} fontWeight={700}
          fill={score > 0 ? color : MUTED}>
          {score > 0 ? score : "--"}
        </text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textAlign: "center" }}>{label}</div>
    </div>
  );
}

function DonutChart({ segments, size = 130, centerText, centerLabel }: {
  segments: Array<{ value: number; color: string }>;
  size?: number;
  centerText?: string;
  centerLabel?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 20;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size}>
      {segments.map((seg, i) => {
        const dashLen = (seg.value / total) * circ;
        const rotation = (offset / total) * 360 - 90;
        offset += seg.value;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.value > 0 ? seg.color : "transparent"} strokeWidth={22}
            strokeDasharray={`${dashLen} ${circ - dashLen}`}
            transform={`rotate(${rotation} ${cx} ${cy})`} />
        );
      })}
      {centerText && (
        <text x={cx} y={centerLabel ? cy - 5 : cy + 6} textAnchor="middle"
          fontSize={20} fontWeight={700} fill="#111827">{centerText}</text>
      )}
      {centerLabel && (
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill={MUTED}>{centerLabel}</text>
      )}
    </svg>
  );
}

function SentimentBadge({ sentiment }: { sentiment: "positive" | "mixed" | "negative" }) {
  const cfg = {
    positive: { bg: "#D1FAE5", color: "#065F46", label: "Positive" },
    mixed: { bg: "#FEF3C7", color: "#92400E", label: "Mixed" },
    negative: { bg: "#FEE2E2", color: "#991B1B", label: "Negative" },
  }[sentiment];
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
      {cfg.label}
    </span>
  );
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp size={14} color={GREEN} />;
  if (trend === "down") return <TrendingDown size={14} color={RED} />;
  return <Minus size={14} color={MUTED} />;
}

type SubPage = "overview" | "perception" | "narrative" | "questions";

export function BrandPerformanceSection({ domain }: { domain: string }) {
  const [data, setData] = useState<BrandAnalysis | null>(null);
  const [loading, setLoading] = useState(!!domain);
  const [error, setError] = useState<string | null>(null);
  const [subPage, setSubPage] = useState<SubPage>("overview");

  useEffect(() => {
    if (!domain) { setData(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    setData(null);
    const token = getToken();
    fetch(`/api/dataforseo/brand-performance?domain=${encodeURIComponent(domain)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then((d: BrandAnalysis & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setData(d);
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

  const scannedLabel = data?.scannedAt
    ? `Based on ${data.responseCount ?? 10} AI responses - Scanned ${new Date(data.scannedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    : null;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Brand Performance</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: data ? 14 : 20 }}>
        How AI systems perceive, describe and position your brand
      </div>

      {/* Competitor pills */}
      {data && data.competitorsMentioned.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
          <span style={{ background: P, color: "white", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600 }}>
            {data.brandName}
          </span>
          {data.competitorsMentioned.slice(0, 5).map(c => (
            <span key={c.name} style={{ background: "white", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 20, padding: "5px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              {c.name}
              <span style={{ fontSize: 10, background: "#F3F4F6", borderRadius: 10, padding: "1px 6px", color: "#6B7280" }}>{c.mentions}x</span>
            </span>
          ))}
          <span style={{ fontSize: 11, color: MUTED }}>mentioned by AI</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, marginBottom: 20 }}>
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setSubPage(tab.id)}
            style={{ padding: "10px 18px", fontSize: 13, fontWeight: subPage === tab.id ? 600 : 400, color: subPage === tab.id ? P : MUTED, background: "none", border: "none", borderBottom: `2px solid ${subPage === tab.id ? P : "transparent"}`, cursor: "pointer", marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 24, height: 24, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div>Scanning {domain} with 10 AI prompts...</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>This takes about 30-60 seconds on first run</div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "20px 24px" }}>
          <AlertCircle size={18} color={RED} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#991B1B", marginBottom: 4 }}>Could not load brand performance</div>
            <div style={{ fontSize: 13, color: "#B91C1C" }}>{error}</div>
          </div>
        </div>
      )}

      {/* No domain */}
      {!loading && !error && !data && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center", color: MUTED }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 8 }}>No domain selected</div>
          <div style={{ fontSize: 13 }}>Select a brand from the sidebar to see its performance data.</div>
        </div>
      )}

      {/* TAB 1: Brand Performance */}
      {!loading && !error && data && subPage === "overview" && (
        <div>
          {/* Row 1: Scores + Insights */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Scores */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20 }}>AI Platform Scores</div>
              <div style={{ display: "flex", gap: 16, justifyContent: "space-around" }}>
                <ScoreRing score={data.overallScore} label="Overall" size={100} />
                <ScoreRing score={data.overallScore} label="ChatGPT" />
                <ScoreRing score={0} label="Gemini" />
                <ScoreRing score={0} label="Perplexity" />
              </div>
              {data.isMock && (
                <div style={{ marginTop: 16, fontSize: 11, color: "#9CA3AF", textAlign: "center", background: BG, borderRadius: 6, padding: "7px 12px" }}>
                  Demo data - real scans run when sandbox mode is off
                </div>
              )}
            </div>

            {/* Insights */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>AI Insights</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.insights.length === 0
                  ? <div style={{ fontSize: 13, color: MUTED }}>No insights available.</div>
                  : data.insights.slice(0, 2).map((insight, i) => (
                    <div key={i} style={{ background: BG, borderRadius: 8, padding: "12px 14px", borderLeft: `3px solid ${P}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                        {i + 1}. {insight.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.6, marginBottom: 6 }}>
                        {insight.description}
                      </div>
                      <div style={{ fontSize: 11, color: P, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        <ChevronRight size={12} />
                        {insight.action}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          {/* Row 2: Sentiment donut + SoV donut + Sentiment breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Sentiment donut */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 20px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Overall Sentiment</div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <DonutChart
                  segments={[
                    { value: data.sentiment.positive, color: GREEN },
                    { value: data.sentiment.neutral, color: "#D1D5DB" },
                    { value: data.sentiment.negative, color: RED },
                  ]}
                  size={120}
                  centerText={`${data.sentiment.positive}%`}
                  centerLabel="Positive"
                />
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: "Positive", val: data.sentiment.positive, color: GREEN },
                  { label: "Neutral", val: data.sentiment.neutral, color: "#9CA3AF" },
                  { label: "Negative", val: data.sentiment.negative, color: RED },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                    <span style={{ color: MUTED }}>{s.label} {s.val}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Share of Voice donut */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 20px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Share of Voice</div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <DonutChart
                  segments={[
                    { value: data.shareOfVoice, color: P },
                    { value: Math.max(0, 100 - data.shareOfVoice), color: "#E5E7EB" },
                  ]}
                  size={120}
                  centerText={`${data.shareOfVoice}%`}
                  centerLabel="Your brand"
                />
              </div>
              <div style={{ fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 1.5 }}>
                Estimated share of AI recommendations vs competitors
              </div>
            </div>

            {/* Sentiment breakdown text */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 20px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Sentiment Breakdown</div>
              <div>
                <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ width: `${data.sentiment.positive}%`, background: GREEN }} />
                  <div style={{ width: `${data.sentiment.neutral}%`, background: "#D1D5DB" }} />
                  <div style={{ width: `${data.sentiment.negative}%`, background: RED }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {[
                    { label: "Positive", val: data.sentiment.positive, color: GREEN },
                    { label: "Neutral", val: data.sentiment.neutral, color: "#9CA3AF" },
                    { label: "Negative", val: data.sentiment.negative, color: RED },
                  ].map(s => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: s.color }} />
                      <span style={{ color: MUTED, flex: 1 }}>{s.label}</span>
                      <span style={{ fontWeight: 700, color: "#111827" }}>{s.val}%</span>
                    </div>
                  ))}
                </div>
                {data.sentiment.summary && (
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: "#374151", background: BG, borderRadius: 8, padding: "10px 12px" }}>
                    {data.sentiment.summary}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Business Drivers table */}
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Key Business Drivers</div>
            </div>
            {data.businessDrivers.length === 0
              ? <div style={{ padding: 24, fontSize: 13, color: MUTED, textAlign: "center" }}>No driver data available.</div>
              : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: BG }}>
                      {["Driver", "AI Mention Frequency", "Sentiment"].map(h => (
                        <th key={h} style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", padding: "10px 20px", borderBottom: `1px solid ${BORDER}`, textAlign: "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.businessDrivers.map((d, i) => (
                      <tr key={i}>
                        <td style={{ padding: "13px 20px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600, color: "#111827" }}>{d.driver}</td>
                        <td style={{ padding: "13px 20px", borderBottom: `1px solid ${BORDER}`, width: 240 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ flex: 1, height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${(d.frequency / 10) * 100}%`, background: P, borderRadius: 3, transition: "width 0.8s" }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", minWidth: 16 }}>{d.frequency}/10</span>
                          </div>
                        </td>
                        <td style={{ padding: "13px 20px", borderBottom: `1px solid ${BORDER}` }}>
                          <SentimentBadge sentiment={d.sentiment} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>

          {/* Row 4: Strategy Recommendations */}
          {data.insights.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Strategy Recommendations</div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.insights.length, 3)}, 1fr)`, gap: 14 }}>
                {data.insights.map((insight, i) => (
                  <div key={i} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: P, background: "#EEF2FF", borderRadius: 20, padding: "3px 10px", alignSelf: "flex-start" }}>
                      Recommended
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", lineHeight: 1.4 }}>{insight.title}</div>
                    <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.6 }}>{insight.description}</div>
                    <div style={{ fontSize: 12, color: P, fontWeight: 600, marginTop: 4 }}>
                      {insight.action}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Perception */}
      {!loading && !error && data && subPage === "perception" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
              How AI systems describe {data.brandName}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.9, color: "#374151" }}>
              {data.perception || "No perception data available."}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Key Strengths</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.keyStrengths.length === 0
                  ? <span style={{ fontSize: 13, color: MUTED }}>No strengths data.</span>
                  : data.keyStrengths.map((s, i) => (
                    <span key={i} style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 500 }}>
                      {s}
                    </span>
                  ))
                }
              </div>
            </div>
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Key Weaknesses</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.keyWeaknesses.length === 0
                  ? <span style={{ fontSize: 13, color: MUTED }}>No weaknesses data.</span>
                  : data.keyWeaknesses.map((w, i) => (
                    <span key={i} style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 500 }}>
                      {w}
                    </span>
                  ))
                }
              </div>
            </div>
          </div>

          {data.competitorsMentioned.length > 0 && (
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Competitors Mentioned by AI</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: BG }}>
                    {["Competitor", "Times Mentioned", "Relative Share"].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", padding: "10px 20px", borderBottom: `1px solid ${BORDER}`, textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.competitorsMentioned.map((c, i) => {
                    const totalMentions = data.competitorsMentioned.reduce((s, x) => s + x.mentions, 0) || 1;
                    const pct = Math.round((c.mentions / totalMentions) * 100);
                    return (
                      <tr key={i}>
                        <td style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600 }}>{c.name}</td>
                        <td style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, color: "#374151" }}>{c.mentions}x</td>
                        <td style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, width: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ flex: 1, height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: "#9CA3AF", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 12, color: MUTED, minWidth: 30 }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Narrative Drivers */}
      {!loading && !error && data && subPage === "narrative" && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Narrative Drivers</div>
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
              The main topics and narratives that AI systems associate with {data.brandName}. These shape how the brand is positioned in AI-generated answers.
            </div>
          </div>
          {data.narrativeDrivers.length === 0
            ? <div style={{ padding: "40px 20px", textAlign: "center", color: MUTED, fontSize: 13 }}>No narrative data available.</div>
            : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: BG }}>
                    {["Topic / Narrative", "Est. AI Mentions", "Trend"].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", padding: "10px 20px", borderBottom: `1px solid ${BORDER}`, textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.narrativeDrivers.map((n, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? BG : "white" }}>
                      <td style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, fontWeight: 600, color: "#111827" }}>{n.topic}</td>
                      <td style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, color: "#374151" }}>
                        {n.mentions > 0 ? n.mentions.toLocaleString() : <span style={{ color: MUTED }}>--</span>}
                      </td>
                      <td style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <TrendIcon trend={n.trend} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: n.trend === "up" ? GREEN : n.trend === "down" ? RED : MUTED }}>
                            {n.trend === "up" ? "Rising" : n.trend === "down" ? "Declining" : "Stable"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* TAB 4: Questions */}
      {!loading && !error && data && subPage === "questions" && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Questions AI Gets Asked About {data.brandName}
            </div>
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
              Common questions users ask AI systems about {data.brandName}. Being well-represented in the answers to these is a core GEO objective.
            </div>
          </div>
          {data.topQuestions.length === 0
            ? <div style={{ padding: "40px 20px", textAlign: "center", color: MUTED, fontSize: 13 }}>No question data available.</div>
            : (
              <div>
                {data.topQuestions.map((q, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 20px", borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#EEF2FF", color: P, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: "#111827", lineHeight: 1.5 }}>{q}</div>
                    <span style={{ background: "#EEF2FF", color: P, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                      Asked by AI
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* Footer */}
      {!loading && !error && data && scannedLabel && (
        <div style={{ marginTop: 20, fontSize: 11, color: "#9CA3AF", textAlign: "right" }}>
          {scannedLabel}
          {data.isMock ? " (demo data)" : data.cached ? " (cached)" : ""}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
