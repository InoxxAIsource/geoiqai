import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DailyScore } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";

interface ScoreChartProps {
  data: DailyScore[];
}

type FilterKey = "all" | "chatgpt" | "gemini" | "perplexity" | "claude" | "grok";

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
  { key: "all", label: "All", color: "#4F46E5" },
  { key: "chatgpt", label: "ChatGPT", color: "#10a37f" },
  { key: "gemini", label: "Gemini", color: "#4285f4" },
  { key: "perplexity", label: "Perplexity", color: "#22d3ee" },
  { key: "claude", label: "Claude", color: "#D97706" },
  { key: "grok", label: "Grok", color: "#7C3AED" },
];

export function ScoreChart({ data }: ScoreChartProps) {
  const [active, setActive] = useState<FilterKey>("all");

  const formattedData = [...(data ?? [])]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-30)
    .map((item) => ({
      date: new Date(item.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      scoreTotal: item.scoreTotal ?? 0,
      scoreChatgpt: item.scoreChatgpt ?? 0,
      scoreGemini: item.scoreGemini ?? 0,
      scorePerplexity: item.scorePerplexity ?? 0,
      scoreClaude: (item as DailyScore & { scoreClaude?: number }).scoreClaude ?? 0,
      scoreGrok: (item as DailyScore & { scoreGrok?: number }).scoreGrok ?? 0,
    }));

  if (!data || data.length === 0) {
    return (
      <Card className="p-8 flex items-center justify-center h-[300px] text-text-secondary">
        Not enough historical data to show trends.
      </Card>
    );
  }

  const lines: { dataKey: string; name: string; color: string; width: number }[] = active === "all"
    ? [
        { dataKey: "scoreTotal", name: "Overall", color: "#4F46E5", width: 3 },
        { dataKey: "scoreChatgpt", name: "ChatGPT", color: "#10a37f", width: 2 },
        { dataKey: "scoreGemini", name: "Gemini", color: "#4285f4", width: 2 },
        { dataKey: "scorePerplexity", name: "Perplexity", color: "#22d3ee", width: 2 },
        { dataKey: "scoreClaude", name: "Claude", color: "#D97706", width: 2 },
        { dataKey: "scoreGrok", name: "Grok", color: "#7C3AED", width: 2 },
      ]
    : active === "chatgpt"
      ? [{ dataKey: "scoreChatgpt", name: "ChatGPT", color: "#10a37f", width: 3 }]
      : active === "gemini"
        ? [{ dataKey: "scoreGemini", name: "Gemini", color: "#4285f4", width: 3 }]
        : active === "perplexity"
          ? [{ dataKey: "scorePerplexity", name: "Perplexity", color: "#22d3ee", width: 3 }]
          : active === "claude"
            ? [{ dataKey: "scoreClaude", name: "Claude", color: "#D97706", width: 3 }]
            : [{ dataKey: "scoreGrok", name: "Grok", color: "#7C3AED", width: 3 }];

  return (
    <Card className="p-6">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h3 className="font-medium text-text-primary">Visibility Trend</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActive(f.key)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                border: active === f.key ? `1.5px solid ${f.color}` : "1.5px solid #E5E7EB",
                background: active === f.key ? f.color : "white",
                color: active === f.key ? "white" : "#6B7280",
                transition: "all 120ms",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              dy={10}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#6b7280" }}
            />
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
            />
            {lines.map((l) => (
              <Line
                key={l.dataKey}
                type="monotone"
                dataKey={l.dataKey}
                name={l.name}
                stroke={l.color}
                strokeWidth={l.width}
                dot={l.width === 3 ? { r: 4, strokeWidth: 2 } : false}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
