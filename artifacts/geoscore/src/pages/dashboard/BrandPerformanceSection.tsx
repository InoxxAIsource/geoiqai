import { useState, useEffect, useRef } from "react";
import { getToken } from "@/lib/auth";
import {
  PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  Tooltip, BarChart, Bar, ResponsiveContainer, LabelList,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Trophy, ChevronRight, X } from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const GREEN = "#059669";
const RED = "#DC2626";
const AMBER = "#D97706";
const PURPLE = "#7C3AED";
const BG = "#F9FAFB";

const BUBBLE_COLORS = [P, "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
const DONUT_COLORS_SENTIMENT = [GREEN, "#9CA3AF", RED];
const DONUT_COLORS_SOV = [P, "#10B981", "#F59E0B", "#EF4444", "#9CA3AF"];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BrandPerformanceResult {
  domain: string;
  brandName: string;
  overallScore: number;
  shareOfVoice: number;
  sentiment: { favorable: number; neutral: number; negative: number; summary: string };
  businessDrivers: Array<{ driver: string; yourFrequency: number; sentiment: "positive" | "mixed" | "negative"; isLeader: boolean }>;
  competitorData: Array<{ name: string; shareOfVoice: number; sentiment: number }>;
  keyStrengths: string[];
  areasForImprovement: string[];
  narrativeDrivers: Array<{ topic: string; mentions: number; trend: "up" | "down" | "stable" }>;
  topQuestions: Array<{ question: string; brandMentioned: boolean; yourRank: number }>;
  insights: Array<{ number: number; title: string; description: string; action: string; linkTo: string }>;
  strategicOpportunities: Array<{ timeframe: "urgent" | "medium"; title: string; description: string; recommendations: string[] }>;
  answers?: Array<{ prompt: string; response: string; brandMentioned: boolean; sentiment: string; competitorsMentioned: string[]; keyThemes: string[] }>;
  isMock?: boolean;
  cached?: boolean;
  locked?: boolean;
  scannedAt: string;
  methodology: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return d; }
}

function addDays(d: string, days: number) {
  try { const dt = new Date(d); dt.setDate(dt.getDate() + days); return fmt(dt.toISOString()); }
  catch { return ""; }
}

function freqColor(n: number) {
  if (n >= 7) return { bg: "#1E3A8A", text: "#fff" };
  if (n >= 4) return { bg: "#3B82F6", text: "#fff" };
  if (n >= 1) return { bg: "#BFDBFE", text: "#1E40AF" };
  return { bg: "transparent", text: MUTED };
}

function sentimentColor(s: string) {
  if (s === "positive") return { bg: "#ECFDF5", text: GREEN };
  if (s === "negative") return { bg: "#FEF2F2", text: RED };
  return { bg: "#FFFBEB", text: AMBER };
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function DonutChart({ data, colors, centerLabel, size = 160 }: {
  data: Array<{ name: string; value: number }>;
  colors: string[];
  centerLabel?: React.ReactNode;
  size?: number;
}) {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <PieChart width={size} height={size}>
        <Pie data={data} cx={size / 2 - 1} cy={size / 2 - 1} innerRadius={size * 0.28} outerRadius={size * 0.42}
          dataKey="value" startAngle={90} endAngle={-270} stroke="none">
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
      </PieChart>
      {centerLabel && (
        <div style={{ position: "absolute", textAlign: "center", pointerEvents: "none" }}>
          {centerLabel}
        </div>
      )}
    </div>
  );
}

function TabFooter({ data }: { data: BrandPerformanceResult }) {
  return (
    <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${BORDER}`, fontSize: 12, color: MUTED }}>
      Based on 20 AI-simulated responses · Last updated: {fmt(data.scannedAt)} · Powered by Claude AI · Next refresh available: {addDays(data.scannedAt, 30)}
      {data.isMock && (
        <span style={{ marginLeft: 8, color: AMBER, fontWeight: 600 }}>(Demo data - run a real scan to see your actual results)</span>
      )}
    </div>
  );
}

function LoadingState() {
  const [step, setStep] = useState(0);
  const steps = [
    "Generating brand prompts...",
    "Analyzing AI responses...",
    "Building brand intelligence...",
    "Generating strategic insights...",
  ];

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 2000),
      setTimeout(() => setStep(2), 6000),
      setTimeout(() => setStep(3), 11000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ padding: "60px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Analyzing brand perception...</div>
      <div style={{ fontSize: 14, color: MUTED, marginBottom: 32 }}>This takes about 15-20 seconds</div>
      <div style={{ display: "inline-flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
        {steps.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: done ? GREEN : active ? P : BORDER,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {done ? (
                  <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : active ? (
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "white",
                    animation: "pulse 1s ease-in-out infinite" }} />
                ) : null}
              </div>
              <span style={{ fontSize: 14, color: done ? "#111827" : active ? P : MUTED, fontWeight: active ? 600 : 400 }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

function LockedState({ brandName, onUpgrade }: { brandName: string; onUpgrade?: () => void }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 12, minHeight: 300 }}>
      <div style={{ filter: "blur(6px)", opacity: 0.4, pointerEvents: "none", padding: 24 }}>
        <div style={{ height: 200, background: BG, borderRadius: 8 }} />
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)", borderRadius: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
          Unlock Brand Performance
        </div>
        <div style={{ fontSize: 14, color: MUTED, marginBottom: 20, textAlign: "center", maxWidth: 360 }}>
          See how AI perceives {brandName} vs competitors across 20 synthetic queries.
        </div>
        <button onClick={onUpgrade} style={{
          background: P, color: "white", border: "none", borderRadius: 8,
          padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>
          Upgrade to Starter
        </button>
      </div>
    </div>
  );
}

// ─── Tab 1: Brand Performance ──────────────────────────────────────────────────

function BrandPerformanceTab({ data, onTabChange }: { data: BrandPerformanceResult; onTabChange: (tab: string) => void }) {
  const avgSentiment = data.competitorData.length > 0
    ? data.competitorData.reduce((s, c) => s + c.sentiment, data.sentiment.favorable) / (data.competitorData.length + 1)
    : data.sentiment.favorable;
  const avgSoV = data.competitorData.length > 0
    ? data.competitorData.reduce((s, c) => s + c.shareOfVoice, data.shareOfVoice) / (data.competitorData.length + 1)
    : data.shareOfVoice;

  let positionLabel = "Room to grow";
  let positionColor = AMBER;
  if (data.sentiment.favorable > avgSentiment && data.shareOfVoice > avgSoV) {
    positionLabel = "Category leader"; positionColor = GREEN;
  } else if (data.sentiment.favorable > avgSentiment && data.shareOfVoice < avgSoV) {
    positionLabel = "Loved, not seen"; positionColor = PURPLE;
  }

  const bubbleData = [
    { x: data.shareOfVoice, y: data.sentiment.favorable, z: 40, name: data.brandName, color: P },
    ...data.competitorData.map((c, i) => ({
      x: c.shareOfVoice, y: c.sentiment, z: 25, name: c.name, color: BUBBLE_COLORS[(i + 1) % BUBBLE_COLORS.length],
    })),
  ];

  const sovData = [
    { name: data.brandName, value: data.shareOfVoice },
    ...data.competitorData.map(c => ({ name: c.name, value: c.shareOfVoice })),
    { name: "Other", value: Math.max(0, 100 - data.shareOfVoice - data.competitorData.reduce((s, c) => s + c.shareOfVoice, 0)) },
  ];

  const sentimentData = [
    { name: "Favorable", value: data.sentiment.favorable },
    { name: "Neutral", value: data.sentiment.neutral },
    { name: "Negative", value: data.sentiment.negative },
  ];

  const topDriver = data.businessDrivers.find(d => d.isLeader)?.driver;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Row 1: Insights + Bubble Chart */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Insights */}
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Insights</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>AI-generated strategy based on latest analysis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.insights.map((ins) => (
              <div key={ins.number} style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: P,
                  color: "white", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center",
                  justifyContent: "center", flexShrink: 0 }}>
                  {ins.number}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{ins.title}</div>
                  <div style={{ fontSize: 12, color: MUTED, margin: "2px 0" }}>{ins.description}</div>
                  <div style={{ fontSize: 12, color: P, fontStyle: "italic" }}>{ins.action}</div>
                  <button onClick={() => onTabChange(ins.linkTo)}
                    style={{ marginTop: 4, fontSize: 11, color: P, background: "none", border: "none",
                      cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 2 }}>
                    Go to {ins.linkTo} <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bubble Chart */}
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Share of Voice vs. Sentiment</div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
              background: positionColor === GREEN ? "#ECFDF5" : positionColor === PURPLE ? "#F5F3FF" : "#FFFBEB",
              color: positionColor }}>
              {positionLabel}
            </span>
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>Bubble size = mention frequency</div>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
              <XAxis type="number" dataKey="x" name="Share of Voice" domain={[0, 100]}
                label={{ value: "Share of Voice %", position: "insideBottom", offset: -10, fontSize: 11, fill: MUTED }} tick={{ fontSize: 11 }} />
              <YAxis type="number" dataKey="y" name="Sentiment" domain={[0, 100]}
                label={{ value: "Sentiment %", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: MUTED }} tick={{ fontSize: 11 }} />
              <ZAxis type="number" dataKey="z" range={[200, 400]} />
              <Tooltip content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0]?.payload as { name: string; x: number; y: number };
                return (
                  <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                    <div>SoV: {d.x}%</div>
                    <div>Sentiment: {d.y}%</div>
                  </div>
                );
              }} />
              {bubbleData.map((d, i) => (
                <Scatter key={i} name={d.name} data={[d]} fill={d.color} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {bubbleData.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
                <span style={{ color: MUTED }}>{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Sentiment + SoV Donuts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Overall Sentiment</div>
            {data.sentiment.favorable > 60 && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#ECFDF5", color: GREEN }}>
                Strong sentiment lead
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 12 }}>
            <DonutChart data={sentimentData} colors={DONUT_COLORS_SENTIMENT}
              centerLabel={
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{data.sentiment.favorable}%</div>
                  <div style={{ fontSize: 10, color: MUTED }}>Favorable</div>
                </div>
              } size={160} />
            <div style={{ flex: 1 }}>
              {sentimentData.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: DONUT_COLORS_SENTIMENT[i], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#111827", flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => onTabChange("perception")}
            style={{ marginTop: 12, fontSize: 12, color: P, background: "none", border: "none",
              cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
            Learn more in Perception <ChevronRight size={12} />
          </button>
        </div>

        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Share of Voice</div>
            {data.shareOfVoice < 20 && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#FFFBEB", color: AMBER }}>
                Room to grow
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 12 }}>
            <DonutChart data={sovData} colors={DONUT_COLORS_SOV}
              centerLabel={
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: P }}>{data.shareOfVoice}%</div>
                  <div style={{ fontSize: 10, color: MUTED }}>Your brand</div>
                </div>
              } size={160} />
            <div style={{ flex: 1 }}>
              {sovData.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: DONUT_COLORS_SOV[i % DONUT_COLORS_SOV.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#111827", flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => onTabChange("narrative")}
            style={{ marginTop: 12, fontSize: 12, color: P, background: "none", border: "none",
              cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
            Learn more in Narrative Drivers <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Business Drivers Heatmap */}
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Key Business Drivers by Frequency</div>
          {topDriver && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#EEF2FF", color: P }}>
              Own {topDriver}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>How often each driver appears in AI responses about your brand</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                  Business Driver
                </th>
                <th style={{ textAlign: "center", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                  {data.brandName}
                </th>
                <th style={{ textAlign: "center", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                  Sentiment
                </th>
              </tr>
            </thead>
            <tbody>
              {data.businessDrivers.map((d, i) => {
                const fc = freqColor(d.yourFrequency);
                const sc = sentimentColor(d.sentiment);
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#111827", display: "flex", alignItems: "center", gap: 6 }}>
                      {d.isLeader && <Trophy size={14} style={{ color: AMBER, flexShrink: 0 }} />}
                      {d.driver}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6,
                        background: fc.bg, color: fc.text, fontSize: 13, fontWeight: 600, minWidth: 36 }}>
                        {d.yourFrequency > 0 ? d.yourFrequency : "-"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999,
                        background: sc.bg, color: sc.text, fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>
                        {d.sentiment}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 12, fontSize: 11, color: MUTED }}>
          {[{ bg: "#1E3A8A", t: "white", label: "High (7+)" }, { bg: "#3B82F6", t: "white", label: "Medium (4-6)" }, { bg: "#BFDBFE", t: "#1E40AF", label: "Low (1-3)" }].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: item.bg }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Comparison Cards */}
      {data.competitorData.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {data.competitorData.map((comp, i) => {
            const yourSoV = data.shareOfVoice;
            const yourSentiment = data.sentiment.favorable;
            const compLeadsSoV = comp.shareOfVoice > yourSoV;
            const compLeadsSentiment = comp.sentiment > yourSentiment;
            const insight = compLeadsSoV ? `${comp.name} leads on visibility` : `You lead on visibility`;
            return (
              <div key={i} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                  {comp.name} vs {data.brandName}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>{insight}</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: MUTED, paddingBottom: 8 }}>Metric</th>
                      <th style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: MUTED, paddingBottom: 8 }}>{comp.name}</th>
                      <th style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: MUTED, paddingBottom: 8 }}>{data.brandName}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ fontSize: 12, color: "#374151", padding: "8px 0" }}>Share of Voice</td>
                      <td style={{ textAlign: "center", fontSize: 13, fontWeight: 600, padding: "8px 4px" }}>
                        {compLeadsSoV && <Trophy size={12} style={{ color: AMBER, display: "inline", marginRight: 2 }} />}
                        {comp.shareOfVoice}%
                      </td>
                      <td style={{ textAlign: "center", fontSize: 13, fontWeight: 600, padding: "8px 4px" }}>
                        {!compLeadsSoV && <Trophy size={12} style={{ color: AMBER, display: "inline", marginRight: 2 }} />}
                        {yourSoV}%
                      </td>
                    </tr>
                    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ fontSize: 12, color: "#374151", padding: "8px 0" }}>Favorable Sentiment</td>
                      <td style={{ textAlign: "center", fontSize: 13, fontWeight: 600, padding: "8px 4px" }}>
                        {compLeadsSentiment && <Trophy size={12} style={{ color: AMBER, display: "inline", marginRight: 2 }} />}
                        {comp.sentiment}%
                      </td>
                      <td style={{ textAlign: "center", fontSize: 13, fontWeight: 600, padding: "8px 4px" }}>
                        {!compLeadsSentiment && <Trophy size={12} style={{ color: AMBER, display: "inline", marginRight: 2 }} />}
                        {yourSentiment}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Strategic Opportunities */}
      {data.strategicOpportunities.length > 0 && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>AI Strategic Opportunities</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Based on the AI analysis of your brand</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {data.strategicOpportunities.map((opp, i) => (
              <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16 }}>
                <span style={{ display: "inline-block", marginBottom: 10, padding: "3px 10px", borderRadius: 999,
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                  background: opp.timeframe === "urgent" ? "#FEF2F2" : "#FFFBEB",
                  color: opp.timeframe === "urgent" ? RED : AMBER }}>
                  {opp.timeframe}
                </span>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 8 }}>{opp.title}</div>
                <div style={{ fontSize: 13, color: "#374151", marginBottom: 12, lineHeight: 1.5 }}>{opp.description}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Recommendations:</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {opp.recommendations.map((r, j) => (
                    <li key={j} style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>{r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <TabFooter data={data} />
    </div>
  );
}

// ─── Tab 2: Perception ─────────────────────────────────────────────────────────

function PerceptionTab({ data }: { data: BrandPerformanceResult }) {
  const sentimentData = [
    { name: "Favorable", value: data.sentiment.favorable },
    { name: "Neutral", value: data.sentiment.neutral },
    { name: "Negative", value: data.sentiment.negative },
  ];

  const perceptionBarData = [
    { name: data.brandName, value: data.sentiment.favorable, fill: P },
    ...data.competitorData.map((c, i) => ({ name: c.name, value: c.sentiment, fill: BUBBLE_COLORS[(i + 1) % BUBBLE_COLORS.length] })),
  ].sort((a, b) => b.value - a.value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Perception</div>
      <div style={{ fontSize: 14, color: MUTED }}>How AI platforms describe and rate your brand</div>

      {/* Sentiment donut */}
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Overall Sentiment</div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <DonutChart data={sentimentData} colors={DONUT_COLORS_SENTIMENT}
            centerLabel={
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{data.sentiment.favorable}%</div>
                <div style={{ fontSize: 10, color: MUTED }}>Favorable</div>
              </div>
            } size={160} />
          <div>
            {sentimentData.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: DONUT_COLORS_SENTIMENT[i], flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: "#111827", minWidth: 80 }}>{d.name}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Sentiment Drivers */}
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Key Sentiment Drivers</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: GREEN, marginBottom: 10 }}>Brand Strength Factors</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {data.keyStrengths.map((s, i) => (
                <span key={i} style={{ padding: "4px 10px", borderRadius: 999, background: "#ECFDF5", color: GREEN, fontSize: 12, fontWeight: 500 }}>{s}</span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: RED, marginBottom: 10 }}>Areas for Improvement</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {data.areasForImprovement.map((a, i) => (
                <span key={i} style={{ padding: "4px 10px", borderRadius: 999, background: "#FEF2F2", color: RED, fontSize: 12, fontWeight: 500 }}>{a}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Feature Description */}
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 12 }}>AI Feature Description</div>
        <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, padding: "14px 16px",
          background: BG, borderRadius: 8, borderLeft: `3px solid ${P}` }}>
          {data.sentiment.summary}
        </div>
      </div>

      {/* Competitive Perception Bar Chart */}
      {perceptionBarData.length > 1 && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Competitive Perception</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Favorable sentiment score comparison</div>
          <ResponsiveContainer width="100%" height={perceptionBarData.length * 44 + 20}>
            <BarChart data={perceptionBarData} layout="vertical" margin={{ left: 10, right: 40 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Favorable Sentiment"]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {perceptionBarData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                <LabelList dataKey="value" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: "#374151" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <TabFooter data={data} />
    </div>
  );
}

// ─── Tab 3: Narrative Drivers ──────────────────────────────────────────────────

function NarrativeTab({ data }: { data: BrandPerformanceResult }) {
  const [selectedAnswer, setSelectedAnswer] = useState<BrandPerformanceResult["answers"] extends Array<infer T> ? T : never | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Narrative Drivers</div>
      <div style={{ fontSize: 14, color: MUTED }}>What shapes your brand's story in AI responses</div>

      {/* Narrative Drivers List */}
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Narrative Drivers</div>
        {data.narrativeDrivers.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
            borderBottom: i < data.narrativeDrivers.length - 1 ? `1px solid ${BORDER}` : "none" }}>
            <div style={{ flex: 1, fontSize: 14, color: "#111827", fontWeight: 500 }}>{d.topic}</div>
            <div style={{ fontSize: 13, color: MUTED }}>{d.mentions} est. mentions</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {d.trend === "up" ? <TrendingUp size={16} style={{ color: GREEN }} /> :
               d.trend === "down" ? <TrendingDown size={16} style={{ color: RED }} /> :
               <Minus size={16} style={{ color: MUTED }} />}
              <span style={{ fontSize: 12, color: d.trend === "up" ? GREEN : d.trend === "down" ? RED : MUTED, fontWeight: 600 }}>
                {d.trend === "up" ? "Rising" : d.trend === "down" ? "Declining" : "Stable"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Answers Breakdown */}
      {data.answers && data.answers.length > 0 && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Breakdown by Questions</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Click any row to see the full AI response</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Prompt", "Brand Mentioned", "Competitors", "Sentiment"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.answers.map((a, i) => {
                  const sc = sentimentColor(a.sentiment);
                  return (
                    <tr key={i} onClick={() => setSelectedAnswer(a as never)}
                      style={{ borderBottom: `1px solid ${BORDER}`, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = BG)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#374151", maxWidth: 300 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                          <span style={{ flexShrink: 0, fontSize: 14 }}>&#128172;</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{a.prompt}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: a.brandMentioned ? GREEN : MUTED }}>
                          {a.brandMentioned ? "Yes" : "No"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: MUTED }}>
                        {a.competitorsMentioned?.slice(0, 2).join(", ") || "-"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text, textTransform: "capitalize" }}>
                          {a.sentiment}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-out answer panel */}
      {selectedAnswer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }}
            onClick={() => setSelectedAnswer(null)} />
          <div style={{ position: "relative", width: 480, maxWidth: "90vw", background: "white",
            height: "100%", padding: 24, overflowY: "auto", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>AI Response</div>
              <button onClick={() => setSelectedAnswer(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Prompt</div>
            <div style={{ fontSize: 14, color: "#111827", marginBottom: 20, padding: "12px 14px", background: BG, borderRadius: 8 }}>
              {(selectedAnswer as { prompt: string }).prompt}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Response</div>
            <div style={{ fontSize: 14, color: "#374151", marginBottom: 20, lineHeight: 1.7, padding: "12px 14px", background: BG, borderRadius: 8, borderLeft: `3px solid ${P}` }}>
              {(selectedAnswer as { response: string }).response}
            </div>
            {(() => {
              const a = selectedAnswer as { sentiment: string; competitorsMentioned: string[]; keyThemes: string[] };
              const sc = sentimentColor(a.sentiment);
              return (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.text, textTransform: "capitalize" }}>{a.sentiment}</span>
                  </div>
                  {a.competitorsMentioned?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 8 }}>Competitors Mentioned</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {a.competitorsMentioned.map((c, i) => (
                          <span key={i} style={{ padding: "3px 10px", borderRadius: 999, background: "#F3F4F6", fontSize: 12, color: "#374151" }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.keyThemes?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 8 }}>Key Themes</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {a.keyThemes.map((t, i) => (
                          <span key={i} style={{ padding: "3px 10px", borderRadius: 999, background: "#EEF2FF", fontSize: 12, color: P }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      <TabFooter data={data} />
    </div>
  );
}

// ─── Tab 4: Questions ──────────────────────────────────────────────────────────

function QuestionsTab({ data }: { data: BrandPerformanceResult }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Questions</div>
      <div style={{ fontSize: 14, color: MUTED }}>Specific prompts where your brand appears in AI answers</div>
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        {data.topQuestions.map((q, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
            padding: "14px 0", borderBottom: i < data.topQuestions.length - 1 ? `1px solid ${BORDER}` : "none" }}>
            <div style={{ fontSize: 14, color: "#111827", flex: 1 }}>{q.question}</div>
            <div>
              {q.brandMentioned ? (
                <span style={{ padding: "4px 10px", borderRadius: 999, background: "#ECFDF5", color: GREEN, fontSize: 12, fontWeight: 600 }}>
                  You rank #{q.yourRank}
                </span>
              ) : (
                <span style={{ padding: "4px 10px", borderRadius: 999, background: "#F3F4F6", color: MUTED, fontSize: 12, fontWeight: 600 }}>
                  Not ranked
                </span>
              )}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 16, fontSize: 12, color: MUTED, fontStyle: "italic" }}>
          These questions were generated based on {data.brandName}'s category and competitive landscape.
        </div>
      </div>
      <TabFooter data={data} />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface BrandPerformanceSectionProps {
  domain: string;
}

const TABS = [
  { key: "performance", label: "Brand Performance" },
  { key: "perception", label: "Perception" },
  { key: "narrative", label: "Narrative Drivers" },
  { key: "questions", label: "Questions" },
];

export function BrandPerformanceSection({ domain }: BrandPerformanceSectionProps) {
  const [data, setData] = useState<BrandPerformanceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("performance");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = async (force = false) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brand-performance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken() ?? ""}`,
        },
        body: JSON.stringify({ domain, competitors, language: "en", force }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      const result = await res.json() as BrandPerformanceResult;
      setData(result);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (domain) fetchData();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const addCompetitor = () => {
    const val = competitorInput.trim().toLowerCase().replace(/^www\./, "");
    if (val && competitors.length < 4 && !competitors.includes(val)) {
      const next = [...competitors, val];
      setCompetitors(next);
      setCompetitorInput("");
      setTimeout(() => fetchData(), 100);
    }
  };

  const removeCompetitor = (c: string) => {
    const next = competitors.filter(x => x !== c);
    setCompetitors(next);
    setTimeout(() => fetchData(), 100);
  };

  const brandName = data?.brandName ?? domain.replace(/\.[a-z]{2,}(\.[a-z]{2})?$/, "");

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 4 }}>
          Brand Performance: {domain}
        </div>
        <div style={{ fontSize: 14, color: MUTED }}>How AI systems perceive and position your brand</div>
      </div>

      {/* Competitor pills */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <span style={{ padding: "5px 14px", borderRadius: 999, background: P, color: "white", fontSize: 13, fontWeight: 700 }}>
          {brandName}
        </span>
        {competitors.map(c => (
          <span key={c} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 999,
            background: "#EEF2FF", color: P, fontSize: 13, fontWeight: 500 }}>
            {c}
            <button onClick={() => removeCompetitor(c)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: P, display: "flex" }}>
              <X size={12} />
            </button>
          </span>
        ))}
        {competitors.length < 4 && (
          <form onSubmit={e => { e.preventDefault(); addCompetitor(); }} style={{ display: "flex", gap: 6 }}>
            <input
              value={competitorInput}
              onChange={e => setCompetitorInput(e.target.value)}
              placeholder="Add competitor domain"
              style={{ padding: "5px 10px", borderRadius: 999, border: `1px solid ${BORDER}`, fontSize: 13,
                outline: "none", width: 180, color: "#111827" }}
            />
            <button type="submit" style={{ padding: "5px 12px", borderRadius: 999, background: BG,
              border: `1px solid ${BORDER}`, fontSize: 13, cursor: "pointer", color: "#374151" }}>
              + Add
            </button>
          </form>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, marginBottom: 24, gap: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "10px 18px", fontSize: 14, fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? P : MUTED, background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === t.key ? `2px solid ${P}` : "2px solid transparent",
              marginBottom: -1, transition: "color 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && <LoadingState />}

      {!loading && error && (
        <div style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 15, color: RED, marginBottom: 12 }}>{error}</div>
          <button onClick={() => fetchData()}
            style={{ padding: "8px 18px", background: P, color: "white", border: "none",
              borderRadius: 8, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data?.locked && (
        <LockedState brandName={brandName} />
      )}

      {!loading && !error && data && !data.locked && (
        <>
          {tab === "performance" && <BrandPerformanceTab data={data} onTabChange={t => setTab(t)} />}
          {tab === "perception" && <PerceptionTab data={data} />}
          {tab === "narrative" && <NarrativeTab data={data} />}
          {tab === "questions" && <QuestionsTab data={data} />}
        </>
      )}
    </div>
  );
}
