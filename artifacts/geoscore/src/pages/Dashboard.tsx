import { useState } from "react";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import {
  useGetDashboardSummary,
  useGetMonitoredBrands,
  useGetBrandScores,
  useGetBrandKeywords,
  useGetMe,
  useRemoveMonitoredBrand,
  getGetMonitoredBrandsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AddBrandModal } from "@/components/dashboard/AddBrandModal";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Loader2, Bell, Settings, Home, Bot, Lightbulb, Users, Plug, ChevronRight, Target } from "lucide-react";

type NavTab = "Overview" | "ChatGPT" | "Gemini" | "Perplexity" | "Keywords" | "Fix Actions" | "Competitors" | "Integrations" | "Settings";

const NAV_ITEMS: { label: NavTab; icon: React.FC<{ style?: React.CSSProperties }> }[] = [
  { label: "Overview", icon: ({ style }) => <Home style={{ width: 15, height: 15, ...style }} /> },
  { label: "ChatGPT", icon: ({ style }) => <Bot style={{ width: 15, height: 15, ...style }} /> },
  { label: "Gemini", icon: ({ style }) => <Bot style={{ width: 15, height: 15, ...style }} /> },
  { label: "Perplexity", icon: ({ style }) => <Bot style={{ width: 15, height: 15, ...style }} /> },
  { label: "Keywords", icon: ({ style }) => <Target style={{ width: 15, height: 15, ...style }} /> },
  { label: "Fix Actions", icon: ({ style }) => <Lightbulb style={{ width: 15, height: 15, ...style }} /> },
  { label: "Competitors", icon: ({ style }) => <Users style={{ width: 15, height: 15, ...style }} /> },
  { label: "Integrations", icon: ({ style }) => <Plug style={{ width: 15, height: 15, ...style }} /> },
  { label: "Settings", icon: ({ style }) => <Settings style={{ width: 15, height: 15, ...style }} /> },
];

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    high: { bg: "#FCEBEB", text: "#791F1F" },
    medium: { bg: "#FAEEDA", text: "#633806" },
    low: { bg: "#E1F5EE", text: "#085041" },
  };
  const c = colors[priority] ?? colors.medium!;
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        borderRadius: 9999,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      {priority}
    </span>
  );
}

interface FixAction {
  id: number;
  priority: "high" | "medium" | "low";
  action: string;
  effortHours: number;
  impactScore: number;
  done: boolean;
}

function generateFixActions(brand: any): FixAction[] {
  const domain = brand?.domain ?? "your brand";
  return [
    {
      id: 1,
      priority: "high",
      action: `Get ${domain} listed on G2, Capterra, and ProductHunt with complete profiles. These are high-authority sources AI systems pull from.`,
      effortHours: 2,
      impactScore: 15,
      done: false,
    },
    {
      id: 2,
      priority: "high",
      action: `Publish a detailed comparison article positioning ${domain} against top 3 competitors. Include specific use cases and customer testimonials.`,
      effortHours: 4,
      impactScore: 12,
      done: false,
    },
    {
      id: 3,
      priority: "medium",
      action: `Create a structured FAQ page with 20+ natural language questions about your category. Use conversational Q&A format optimized for AI retrieval.`,
      effortHours: 3,
      impactScore: 10,
      done: false,
    },
    {
      id: 4,
      priority: "medium",
      action: `Add JSON-LD structured data markup to your homepage and product pages. This helps Gemini's knowledge graph correctly understand your brand.`,
      effortHours: 2,
      impactScore: 8,
      done: false,
    },
    {
      id: 5,
      priority: "low",
      action: `Publish original research or a data report about trends in your industry. Data-driven content gets cited by Perplexity's real-time web search.`,
      effortHours: 8,
      impactScore: 6,
      done: false,
    },
  ];
}

export default function Dashboard() {
  const { isAuthenticated } = useAuthGuard();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<NavTab>("Overview");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [competitorInput, setCompetitorInput] = useState("");
  const [trackedCompetitors, setTrackedCompetitors] = useState<string[]>([]);
  const [fixActions, setFixActions] = useState<FixAction[]>([]);
  const [fixActionsInitialized, setFixActionsInitialized] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user } = useGetMe({ query: { enabled: isAuthenticated } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { enabled: isAuthenticated } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brands, isLoading: loadingBrands } = useGetMonitoredBrands({ query: { enabled: isAuthenticated } as any });

  if (brands && brands.length > 0 && !selectedBrandId) {
    setSelectedBrandId(brands[0]!.id);
  }

  const selectedBrand = brands?.find((b) => b.id === selectedBrandId);

  if (selectedBrand && !fixActionsInitialized) {
    setFixActions(generateFixActions(selectedBrand));
    setFixActionsInitialized(true);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scores } = useGetBrandScores(selectedBrandId!, {
    query: { enabled: !!selectedBrandId && isAuthenticated } as any,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brandKeywords } = useGetBrandKeywords(selectedBrandId!, {
    query: { enabled: !!selectedBrandId && isAuthenticated } as any,
  });

  const removeBrandMutation = useRemoveMonitoredBrand();

  const handleRemoveBrand = (id: string, name: string) => {
    if (confirm(`Stop monitoring ${name}?`)) {
      removeBrandMutation.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: "Brand removed", description: "Stopped monitoring." });
            queryClient.invalidateQueries({ queryKey: getGetMonitoredBrandsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            if (selectedBrandId === id) setSelectedBrandId(null);
          },
        },
      );
    }
  };

  const handleMarkDone = (id: number) => {
    setFixActions((prev) => prev.map((a) => (a.id === id ? { ...a, done: !a.done } : a)));
  };

  const handleAddCompetitor = () => {
    const c = competitorInput.trim();
    if (c && !trackedCompetitors.includes(c)) {
      setTrackedCompetitors((prev) => [...prev, c]);
      setCompetitorInput("");
    }
  };

  const handleRemoveCompetitor = (c: string) => {
    setTrackedCompetitors((prev) => prev.filter((x) => x !== c));
  };

  const scoresDomain: string = selectedBrand?.domain ?? "";

  const chartData = (() => {
    if (!scores || scores.length === 0) return [];
    const sorted = [...scores].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-30);
    return sorted.map((s, i) => ({
      date: new Date(s.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      score: s.scoreTotal ?? 0,
      isLast: i === sorted.length - 1,
    }));
  })();

  const systemStatuses = [
    { name: "ChatGPT", score: selectedBrand?.latestScoreChatgpt ?? 0, found: (selectedBrand?.latestScoreChatgpt ?? 0) > 0, color: "#10a37f" },
    { name: "Gemini", score: selectedBrand?.latestScoreGemini ?? 0, found: (selectedBrand?.latestScoreGemini ?? 0) > 0, color: "#4285f4" },
    { name: "Perplexity", score: selectedBrand?.latestScorePerplexity ?? 0, found: (selectedBrand?.latestScorePerplexity ?? 0) > 0, color: "#22d3ee" },
    { name: "Copilot", score: 0, found: false, color: "#0078d4" },
  ];

  const weekChange = (() => {
    if (!scores || scores.length < 2) return null;
    const sorted = [...scores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = sorted[0]?.scoreTotal ?? 0;
    const prev = sorted[1]?.scoreTotal ?? latest;
    return latest - prev;
  })();

  if (!isAuthenticated) return null;

  const isLoading = loadingSummary || loadingBrands;

  const activeScore = selectedBrand?.latestScore ?? 0;
  const visibleCount = systemStatuses.filter((s) => s.found).length;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "Inter, sans-serif" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 160,
          borderRight: "0.5px solid #e5e7eb",
          background: "white",
          padding: "16px 0",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "0 16px 16px", fontWeight: 600, fontSize: 14, color: "#534AB7" }}>GEOscore</div>

        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map(({ label, icon: Icon }) => {
            const isActive = activeTab === label;
            return (
              <button
                key={label}
                onClick={() => setActiveTab(label)}
                style={{
                  width: "100%",
                  height: 36,
                  padding: "0 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  cursor: "pointer",
                  background: isActive ? "#EEEDFE" : "transparent",
                  color: isActive ? "#534AB7" : "#6b7280",
                  fontWeight: isActive ? 500 : 400,
                  borderRight: isActive ? "2px solid #534AB7" : "2px solid transparent",
                  border: "none",
                  borderRightStyle: "solid",
                  borderRightWidth: isActive ? 2 : 0,
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <Icon style={{ color: isActive ? "#534AB7" : "#6b7280" }} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f9fafb", overflow: "hidden" }}>
        {/* Top bar */}
        <div
          style={{
            background: "white",
            padding: "12px 20px",
            borderBottom: "0.5px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
            {scoresDomain || "No brand selected"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Bell style={{ width: 18, height: 18, color: "#6b7280", cursor: "pointer" }} />
            <Settings style={{ width: 18, height: 18, color: "#6b7280", cursor: "pointer" }} />
            {user?.plan === "free" && (
              <button
                style={{
                  background: "#534AB7",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Upgrade plan
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
              <Loader2 style={{ width: 28, height: 28, color: "#534AB7", animation: "spin 1s linear infinite" }} />
            </div>
          ) : brands?.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                paddingTop: 60,
                border: "1.5px dashed #e5e7eb",
                borderRadius: 12,
                padding: 48,
              }}
            >
              <p style={{ color: "#6b7280", marginBottom: 20, fontSize: 14 }}>
                No brands monitored yet. Add one to get started.
              </p>
              <AddBrandModal />
            </div>
          ) : (
            <>
              {/* Brand switcher */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                {brands?.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBrandId(b.id);
                      setFixActionsInitialized(false);
                    }}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      background: selectedBrandId === b.id ? "#534AB7" : "white",
                      color: selectedBrandId === b.id ? "white" : "#6b7280",
                      border: "0.5px solid",
                      borderColor: selectedBrandId === b.id ? "#534AB7" : "#e5e7eb",
                    }}
                  >
                    {b.domain}
                  </button>
                ))}
                <AddBrandModal />
              </div>

              {/* OVERVIEW TAB */}
              {(activeTab === "Overview" || activeTab === "ChatGPT" || activeTab === "Gemini" || activeTab === "Perplexity") && (
                <>
                  {/* 4 metric cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
                    {[
                      {
                        label: "Visibility score",
                        value: <span style={{ fontSize: 24, fontWeight: 500, color: "#111827" }}>{activeScore}</span>,
                      },
                      {
                        label: "vs last week",
                        value: weekChange === null ? (
                          <span style={{ fontSize: 24, fontWeight: 500, color: "#9ca3af" }}>—</span>
                        ) : (
                          <span
                            style={{
                              fontSize: 24,
                              fontWeight: 500,
                              color: weekChange >= 0 ? "#10b981" : "#ef4444",
                            }}
                          >
                            {weekChange >= 0 ? `↑ ${weekChange}` : `↓ ${Math.abs(weekChange)}`}
                          </span>
                        ),
                      },
                      {
                        label: "AI systems visible",
                        value: <span style={{ fontSize: 24, fontWeight: 500, color: "#111827" }}>{visibleCount}/4</span>,
                      },
                      {
                        label: "Competitors tracked",
                        value: (
                          <span style={{ fontSize: 24, fontWeight: 500, color: "#111827" }}>
                            {trackedCompetitors.length}
                          </span>
                        ),
                      },
                    ].map((card, i) => (
                      <div
                        key={i}
                        style={{
                          background: "white",
                          border: "0.5px solid #e5e7eb",
                          borderRadius: 8,
                          padding: "12px 16px",
                        }}
                      >
                        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{card.label}</div>
                        {card.value}
                      </div>
                    ))}
                  </div>

                  {/* Two-column: chart + AI status */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    {/* Score trend */}
                    <div
                      style={{
                        background: "white",
                        border: "0.5px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>
                        Score trend — last 30 days
                      </div>
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={120}>
                          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                            <XAxis
                              dataKey="date"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: "#9ca3af" }}
                              interval={Math.floor(chartData.length / 5)}
                            />
                            <YAxis
                              domain={[0, 100]}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: "#9ca3af" }}
                            />
                            <Tooltip
                              contentStyle={{
                                borderRadius: 8,
                                border: "0.5px solid #e5e7eb",
                                fontSize: 12,
                              }}
                            />
                            <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                              {chartData.map((entry, index) => (
                                <Cell
                                  key={index}
                                  fill={entry.isLast ? "#534AB7" : "#EEEDFE"}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div
                          style={{
                            height: 120,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#9ca3af",
                            fontSize: 12,
                          }}
                        >
                          Not enough historical data yet
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                        Scores update daily after your audit runs
                      </div>
                    </div>

                    {/* AI system status */}
                    <div
                      style={{
                        background: "white",
                        border: "0.5px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>
                        AI system status today
                      </div>
                      {systemStatuses.map((sys, i) => (
                        <div
                          key={sys.name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 0",
                            borderBottom: i < systemStatuses.length - 1 ? "0.5px solid #f3f4f6" : "none",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                display: "inline-block",
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: sys.color,
                              }}
                            />
                            <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{sys.name}</span>
                            <span style={{ fontSize: 12, color: "#9ca3af" }}>
                              {sys.score}/33 pts
                            </span>
                          </div>
                          <span
                            style={{
                              background: sys.found ? "#E1F5EE" : "#FCEBEB",
                              color: sys.found ? "#085041" : "#791F1F",
                              borderRadius: 9999,
                              padding: "2px 8px",
                              fontSize: 11,
                              fontWeight: 500,
                            }}
                          >
                            {sys.found ? "Visible" : "Invisible"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* KEYWORDS TAB */}
              {activeTab === "Keywords" && (
                <div
                  style={{
                    background: "white",
                    border: "0.5px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 4 }}>
                      Keywords we are monitoring
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Real search queries your audience types — and whether your brand appears in each AI system when those queries are asked.
                    </div>
                  </div>

                  {!brandKeywords || brandKeywords.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "32px 0",
                        color: "#9ca3af",
                        fontSize: 13,
                      }}
                    >
                      <Target style={{ width: 32, height: 32, margin: "0 auto 12px", opacity: 0.3 }} />
                      <div style={{ fontWeight: 500, color: "#374151", marginBottom: 6 }}>No keyword data yet</div>
                      <div style={{ fontSize: 12 }}>
                        Keyword data is fetched automatically when your next audit runs.
                        It requires DataForSEO credentials to be configured.
                      </div>
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Keyword", "Monthly searches", "ChatGPT", "Gemini", "Perplexity"].map((h) => (
                            <th
                              key={h}
                              style={{
                                textAlign: "left",
                                fontSize: 11,
                                color: "#9ca3af",
                                fontWeight: 500,
                                padding: "0 12px 8px 0",
                                borderBottom: "0.5px solid #f3f4f6",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {brandKeywords.map((kw, i) => {
                          const isLast = i === brandKeywords.length - 1;
                          const VisBadge = ({ visible }: { visible: boolean }) => (
                            <span
                              style={{
                                background: visible ? "#E1F5EE" : "#FCEBEB",
                                color: visible ? "#085041" : "#791F1F",
                                borderRadius: 9999,
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 500,
                              }}
                            >
                              {visible ? "Visible" : "Not found"}
                            </span>
                          );
                          return (
                            <tr key={kw.keyword}>
                              <td
                                style={{
                                  padding: "10px 12px 10px 0",
                                  fontSize: 13,
                                  color: "#374151",
                                  borderBottom: isLast ? "none" : "0.5px solid #f9fafb",
                                  maxWidth: 260,
                                }}
                              >
                                {kw.keyword}
                              </td>
                              <td
                                style={{
                                  padding: "10px 12px 10px 0",
                                  fontSize: 13,
                                  color: "#374151",
                                  borderBottom: isLast ? "none" : "0.5px solid #f9fafb",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {kw.volume.toLocaleString("en-IN")}/mo
                              </td>
                              <td style={{ padding: "10px 12px 10px 0", borderBottom: isLast ? "none" : "0.5px solid #f9fafb" }}>
                                <VisBadge visible={kw.chatgptVisible ?? false} />
                              </td>
                              <td style={{ padding: "10px 12px 10px 0", borderBottom: isLast ? "none" : "0.5px solid #f9fafb" }}>
                                <VisBadge visible={kw.geminiVisible ?? false} />
                              </td>
                              <td style={{ padding: "10px 0", borderBottom: isLast ? "none" : "0.5px solid #f9fafb" }}>
                                <VisBadge visible={kw.perplexityVisible ?? false} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* FIX ACTIONS TAB */}
              {(activeTab === "Fix Actions" || activeTab === "Overview") && (
                <div
                  style={{
                    background: "white",
                    border: "0.5px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>
                      Fix actions — generated this week
                    </div>
                    <button
                      onClick={() => {
                        setFixActionsInitialized(false);
                        setFixActions(generateFixActions(selectedBrand));
                        setFixActionsInitialized(true);
                      }}
                      style={{
                        background: "transparent",
                        border: "0.5px solid #e5e7eb",
                        borderRadius: 6,
                        padding: "4px 12px",
                        fontSize: 12,
                        color: "#6b7280",
                        cursor: "pointer",
                      }}
                    >
                      Refresh
                    </button>
                  </div>

                  {fixActions.map((action, i) => (
                    <div
                      key={action.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "10px 0",
                        borderBottom: i < fixActions.length - 1 ? "0.5px solid #f3f4f6" : "none",
                      }}
                    >
                      <PriorityBadge priority={action.priority} />
                      <div style={{ flex: 1, fontSize: 13, color: action.done ? "#9ca3af" : "#374151" }}>
                        <span style={{ textDecoration: action.done ? "line-through" : "none" }}>
                          {action.action}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0, marginTop: 2 }}>
                        ~{action.effortHours}h
                      </span>
                      <span style={{ fontSize: 11, color: "#1D9E75", flexShrink: 0, marginTop: 2 }}>
                        +{action.impactScore} pts
                      </span>
                      <button
                        onClick={() => handleMarkDone(action.id)}
                        style={{
                          background: action.done ? "#E1F5EE" : "transparent",
                          border: "0.5px solid",
                          borderColor: action.done ? "#10b981" : "#e5e7eb",
                          borderRadius: 6,
                          padding: "2px 10px",
                          height: 28,
                          fontSize: 11,
                          color: action.done ? "#085041" : "#6b7280",
                          cursor: "pointer",
                          flexShrink: 0,
                          fontWeight: action.done ? 500 : 400,
                        }}
                      >
                        {action.done ? "✓ Done" : "Done"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* COMPETITORS TAB */}
              {(activeTab === "Competitors" || activeTab === "Overview") && (
                <div
                  style={{
                    background: "white",
                    border: "0.5px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>
                    Competitors tracked
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <input
                      type="text"
                      placeholder="Enter competitor URL (e.g. competitor.com)"
                      value={competitorInput}
                      onChange={(e) => setCompetitorInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
                      style={{
                        flex: 1,
                        border: "0.5px solid #e5e7eb",
                        borderRadius: 6,
                        padding: "8px 12px",
                        fontSize: 13,
                        color: "#374151",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={handleAddCompetitor}
                      style={{
                        background: "#534AB7",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Track
                    </button>
                  </div>

                  {trackedCompetitors.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>
                      No competitors tracked yet. Add one above.
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Domain", "ChatGPT", "Gemini", "Perplexity", ""].map((h) => (
                            <th
                              key={h}
                              style={{
                                textAlign: "left",
                                fontSize: 11,
                                color: "#9ca3af",
                                fontWeight: 500,
                                padding: "0 0 8px",
                                borderBottom: "0.5px solid #f3f4f6",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trackedCompetitors.map((comp) => (
                          <tr key={comp}>
                            <td style={{ padding: "10px 0", fontSize: 13, color: "#374151", borderBottom: "0.5px solid #f9fafb" }}>
                              {comp}
                            </td>
                            {["—", "—", "—"].map((val, i) => (
                              <td
                                key={i}
                                style={{
                                  padding: "10px 0",
                                  fontSize: 12,
                                  color: "#9ca3af",
                                  borderBottom: "0.5px solid #f9fafb",
                                }}
                              >
                                {val}
                              </td>
                            ))}
                            <td style={{ padding: "10px 0", borderBottom: "0.5px solid #f9fafb" }}>
                              <button
                                onClick={() => handleRemoveCompetitor(comp)}
                                style={{
                                  background: "transparent",
                                  border: "0.5px solid #e5e7eb",
                                  borderRadius: 4,
                                  padding: "2px 8px",
                                  fontSize: 11,
                                  color: "#6b7280",
                                  cursor: "pointer",
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* INTEGRATIONS TAB */}
              {(activeTab === "Integrations" || activeTab === "Overview") && (
                <div
                  style={{
                    background: "white",
                    border: "0.5px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 4 }}>
                    Connect data sources
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
                    Use your real keywords for more accurate AI visibility checks
                  </div>

                  {[
                    {
                      name: "Google Search Console",
                      desc: "Use your real Google keywords",
                      icon: "G",
                      iconBg: "#4285f4",
                    },
                    {
                      name: "Bing Webmaster Tools",
                      desc: "Track Copilot AI visibility",
                      icon: "B",
                      iconBg: "#0078d4",
                    },
                  ].map((integration, i) => (
                    <div
                      key={integration.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 0",
                        borderTop: i > 0 ? "0.5px solid #f3f4f6" : "none",
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: integration.iconBg,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {integration.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                          {integration.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>{integration.desc}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9ca3af" }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#d1d5db",
                            }}
                          />
                          Not connected
                        </div>
                        <button
                          style={{
                            background: "transparent",
                            border: "0.5px solid #e5e7eb",
                            borderRadius: 6,
                            padding: "6px 12px",
                            fontSize: 12,
                            color: "#374151",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Connect <ChevronRight style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
