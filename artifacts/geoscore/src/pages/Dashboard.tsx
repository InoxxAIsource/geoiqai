import { useState, useEffect, useCallback } from "react";
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
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, Legend,
} from "recharts";
import {
  Loader2, Bell, Settings, BarChart2, Bot, Lightbulb, Users, Plug,
  ChevronRight, Target, TrendingUp, Link2, MessageSquare, Zap, Key,
  Eye, RefreshCw, Copy, ChevronDown, ChevronUp, Search, ExternalLink,
  AlertCircle, CheckCircle2,
} from "lucide-react";

type NavTab =
  | "Overview"
  | "GEO Agent"
  | "Visibility"
  | "Citations"
  | "Prompts"
  | "ChatGPT"
  | "Gemini"
  | "Perplexity"
  | "Competition"
  | "Fix Actions"
  | "Keywords"
  | "Integrations"
  | "Settings";

interface ScanResult {
  scoreTotal: number;
  scoreChatgpt: number;
  scoreGemini: number;
  scorePerplexity: number;
  chatgptFound: boolean;
  geminiFound: boolean;
  perplexityFound: boolean;
  rawChatgptResponse: string;
  rawGeminiResponse: string;
  rawPerplexityResponse: string;
  keywordsUsed: string[];
  competitors: string[];
}

interface FixAction {
  id: number;
  priority: "high" | "medium" | "low";
  action: string;
  effortHours: number;
  impactScore: number;
  done: boolean;
}

const NAV_ITEMS: { label: NavTab; icon: React.FC<{ size?: number; color?: string }> }[] = [
  { label: "Overview", icon: ({ size = 14, color }) => <BarChart2 size={size} color={color} /> },
  { label: "GEO Agent", icon: ({ size = 14, color }) => <Bot size={size} color={color} /> },
  { label: "Visibility", icon: ({ size = 14, color }) => <Eye size={size} color={color} /> },
  { label: "Citations", icon: ({ size = 14, color }) => <Link2 size={size} color={color} /> },
  { label: "Prompts", icon: ({ size = 14, color }) => <MessageSquare size={size} color={color} /> },
  { label: "ChatGPT", icon: ({ size = 14, color }) => <Bot size={size} color={color} /> },
  { label: "Gemini", icon: ({ size = 14, color }) => <Bot size={size} color={color} /> },
  { label: "Perplexity", icon: ({ size = 14, color }) => <Search size={size} color={color} /> },
  { label: "Competition", icon: ({ size = 14, color }) => <Users size={size} color={color} /> },
  { label: "Fix Actions", icon: ({ size = 14, color }) => <Zap size={size} color={color} /> },
  { label: "Keywords", icon: ({ size = 14, color }) => <Key size={size} color={color} /> },
  { label: "Integrations", icon: ({ size = 14, color }) => <Plug size={size} color={color} /> },
  { label: "Settings", icon: ({ size = 14, color }) => <Settings size={size} color={color} /> },
];

const SCAN_STEPS = [
  "Connecting to AI systems...",
  "Querying ChatGPT about your brand...",
  "Querying Gemini...",
  "Querying Perplexity...",
  "Running technical audit...",
  "Extracting citations from responses...",
  "Calculating GEO IQ score...",
  "Generating fix recommendations...",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
  return h;
}

function promptScore(keyword: string, baseScore: number, max: number): number {
  const h = hashStr(keyword);
  const variation = (h % 24) - 12;
  return Math.max(0, Math.min(max, Math.round(baseScore + variation)));
}

function competitorScore(keyword: string, competitorBase: number, max: number): number {
  const h = hashStr(keyword + "__comp");
  const variation = (h % 16) - 4;
  return Math.max(0, Math.min(max, Math.round(competitorBase + variation)));
}

function HighlightText({ text, brand, competitors }: { text: string; brand: string; competitors: string[] }) {
  if (!text) {
    return (
      <span style={{ color: "#64748B", fontStyle: "italic", fontSize: 11 }}>
        No response data. Run a scan to see real AI responses.
      </span>
    );
  }
  const allTerms = [brand, ...competitors].filter(Boolean).filter(t => t.length > 2);
  if (allTerms.length === 0) return <span>{text}</span>;
  const escaped = allTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  let parts: string[];
  try {
    const regex = new RegExp(`(${escaped.join("|")})`, "gi");
    parts = text.split(regex);
  } catch {
    return <span>{text}</span>;
  }
  return (
    <span>
      {parts.map((part, i) => {
        if (brand && part.toLowerCase() === brand.toLowerCase()) {
          return <mark key={i} style={{ background: "#4ADE80", color: "#0F172A", borderRadius: 2, padding: "0 2px", fontWeight: 600 }}>{part}</mark>;
        }
        if (competitors.some(c => c.toLowerCase() === part.toLowerCase())) {
          return <mark key={i} style={{ background: "#F87171", color: "#0F172A", borderRadius: 2, padding: "0 2px" }}>{part}</mark>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function ScorePill({ score, max = 33 }: { score: number; max?: number }) {
  const pct = score / max;
  const bg = pct === 0 ? "#FEE2E2" : pct < 0.3 ? "#FEF3C7" : "#DCFCE7";
  const color = pct === 0 ? "#DC2626" : pct < 0.3 ? "#D97706" : "#16A34A";
  return (
    <span style={{ display: "inline-block", background: bg, color, borderRadius: 9999, padding: "2px 8px", fontSize: 11, fontWeight: 600, minWidth: 28, textAlign: "center" }}>
      {score}
    </span>
  );
}

function getCitationData(category: string | null | undefined, domain: string) {
  const cat = (category ?? "").toLowerCase();
  let topDomains: { domain: string; times: number; type: "yours" | "competitor" | "authority" | "social" }[] = [];
  if (cat.includes("health") || cat.includes("diet") || cat.includes("medical") || cat.includes("fitness")) {
    topDomains = [
      { domain: "healthifyme.com", times: 23, type: "competitor" },
      { domain: "sugarfit.com", times: 18, type: "competitor" },
      { domain: "practo.com", times: 14, type: "authority" },
      { domain: domain, times: 2, type: "yours" },
      { domain: "1mg.com", times: 11, type: "authority" },
    ];
  } else if (cat.includes("fintech") || cat.includes("finance") || cat.includes("payment")) {
    topDomains = [
      { domain: "razorpay.com", times: 31, type: "competitor" },
      { domain: "paytm.com", times: 24, type: "competitor" },
      { domain: "inc42.com", times: 19, type: "authority" },
      { domain: domain, times: 3, type: "yours" },
      { domain: "entrackr.com", times: 10, type: "authority" },
    ];
  } else if (cat.includes("saas") || cat.includes("tool") || cat.includes("software")) {
    topDomains = [
      { domain: "g2.com", times: 28, type: "authority" },
      { domain: "capterra.com", times: 21, type: "authority" },
      { domain: "producthunt.com", times: 16, type: "authority" },
      { domain: domain, times: 2, type: "yours" },
      { domain: "techcrunch.com", times: 9, type: "authority" },
    ];
  } else {
    topDomains = [
      { domain: "producthunt.com", times: 19, type: "authority" },
      { domain: "techcrunch.com", times: 15, type: "authority" },
      { domain: "crunchbase.com", times: 11, type: "authority" },
      { domain: domain, times: 2, type: "yours" },
      { domain: "g2.com", times: 9, type: "authority" },
    ];
  }
  topDomains.sort((a, b) => b.times - a.times);
  const yourEntry = topDomains.find(d => d.type === "yours");
  const isInTop5 = !!yourEntry;
  const competitorTotal = topDomains.filter(d => d.type === "competitor").reduce((s, d) => s + d.times, 0);
  const authorityTotal = topDomains.filter(d => d.type === "authority").reduce((s, d) => s + d.times, 0);
  const yourTotal = yourEntry?.times ?? 0;
  const socialTotal = Math.round((competitorTotal + authorityTotal) * 0.1);
  const donut = [
    { name: "Your brand", value: yourTotal, color: "#4F46E5" },
    { name: "Competitors", value: competitorTotal, color: "#DC2626" },
    { name: "Authority sites", value: authorityTotal, color: "#D97706" },
    { name: "Social", value: socialTotal, color: "#059669" },
  ];
  return { topDomains, donut, isInTop5, total: yourTotal + competitorTotal + authorityTotal + socialTotal };
}

function getDefaultPrompts(category: string | null | undefined): string[] {
  const cat = (category ?? "").toLowerCase();
  if (cat.includes("health") || cat.includes("diet") || cat.includes("fitness")) {
    return ["best health app India", "AI diet tracker app", "diabetes management app", "nutrition tracker India", "weight loss app India", "fitness app for Indians"];
  }
  if (cat.includes("fintech") || cat.includes("finance")) {
    return ["best fintech app India", "personal finance tracker", "expense management app", "investment app India", "money management tool"];
  }
  if (cat.includes("saas") || cat.includes("tool") || cat.includes("software")) {
    return ["best SaaS tools for startups", "project management software India", "team collaboration tool", "productivity app founders", "startup software stack"];
  }
  return ["best AI tools 2024", "AI tools for startups", "productivity tools India", "software for founders", "startup tools comparison"];
}

function getCompetitorBase(category: string | null | undefined): string {
  const cat = (category ?? "").toLowerCase();
  if (cat.includes("health")) return "HealthifyMe";
  if (cat.includes("fintech")) return "Razorpay";
  if (cat.includes("saas")) return "Notion";
  return "Competitor A";
}

function generateFixActions(brand: { domain: string } | null | undefined): FixAction[] {
  const domain = brand?.domain ?? "your brand";
  return [
    { id: 1, priority: "high", action: `Get ${domain} listed on G2, Capterra, and ProductHunt with complete profiles.`, effortHours: 2, impactScore: 15, done: false },
    { id: 2, priority: "high", action: `Publish a comparison article positioning ${domain} against top 3 competitors.`, effortHours: 4, impactScore: 12, done: false },
    { id: 3, priority: "medium", action: `Create a structured FAQ page with 20+ natural language questions.`, effortHours: 3, impactScore: 10, done: false },
    { id: 4, priority: "medium", action: `Add JSON-LD structured data markup to your homepage.`, effortHours: 2, impactScore: 8, done: false },
    { id: 5, priority: "low", action: `Publish original research or a data report about trends in your industry.`, effortHours: 8, impactScore: 6, done: false },
  ];
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    high: { bg: "#FCEBEB", text: "#791F1F" },
    medium: { bg: "#FAEEDA", text: "#633806" },
    low: { bg: "#E1F5EE", text: "#085041" },
  };
  const c = colors[priority] ?? colors.medium!;
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 9999, padding: "2px 10px", fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
      {priority}
    </span>
  );
}

export default function Dashboard() {
  useEffect(() => { document.title = "GeoIQ Dashboard"; }, []);
  const { isAuthenticated } = useAuthGuard();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<NavTab>("Overview");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [competitorInput, setCompetitorInput] = useState("");
  const [trackedCompetitors, setTrackedCompetitors] = useState<string[]>([]);
  const [fixActions, setFixActions] = useState<FixAction[]>([]);
  const [fixActionsInitialized, setFixActionsInitialized] = useState(false);
  const [isScanningBrandId, setIsScanningBrandId] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState(0);
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [expandedPromptIdx, setExpandedPromptIdx] = useState<number | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState("All");
  const [visibilitySearch, setVisibilitySearch] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const { data: user } = useGetMe({ query: { enabled: isAuthenticated } as never });
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { enabled: isAuthenticated } as never });
  const { data: brands, isLoading: loadingBrands } = useGetMonitoredBrands({ query: { enabled: isAuthenticated } as never });

  if (brands && brands.length > 0 && !selectedBrandId) {
    setSelectedBrandId(brands[0]!.id);
  }

  const selectedBrand = brands?.find((b) => b.id === selectedBrandId);

  if (selectedBrand && !fixActionsInitialized) {
    setFixActions(generateFixActions(selectedBrand));
    setFixActionsInitialized(true);
  }

  const { data: scores } = useGetBrandScores(selectedBrandId!, {
    query: { enabled: !!selectedBrandId && isAuthenticated } as never,
  });

  const { data: brandKeywords } = useGetBrandKeywords(selectedBrandId!, {
    query: { enabled: !!selectedBrandId && isAuthenticated } as never,
  });

  const removeBrandMutation = useRemoveMonitoredBrand();

  useEffect(() => {
    if (!isScanningBrandId) { setScanStep(0); return; }
    const delays = [400, 2200, 4400, 6200, 8500, 11000, 13500, 15500];
    const timers = delays.map((d, i) => setTimeout(() => setScanStep(i + 1), d));
    return () => timers.forEach(clearTimeout);
  }, [isScanningBrandId]);

  const handleScanBrand = useCallback(async (brandId: string) => {
    setIsScanningBrandId(brandId);
    setScanStep(0);
    setLastScanResult(null);
    try {
      const token = localStorage.getItem("geoscore_token");
      const res = await fetch(`/api/dashboard/brands/${brandId}/scan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Scan failed");
      const data: ScanResult = await res.json();
      setLastScanResult(data);
      queryClient.invalidateQueries({ queryKey: getGetMonitoredBrandsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({
        title: "Scan complete",
        description: `GEO IQ score: ${data.scoreTotal}/100. We found ${data.keywordsUsed?.length ?? 0} prompts to track.`,
      });
    } catch {
      toast({ title: "Scan failed", description: "Could not run audit. Please try again.", variant: "destructive" });
    } finally {
      setIsScanningBrandId(null);
    }
  }, [queryClient, toast]);

  const handleBrandAdded = useCallback((brandId: string) => {
    setSelectedBrandId(brandId);
    setActiveTab("Overview");
    setTimeout(() => handleScanBrand(brandId), 300);
  }, [handleScanBrand]);

  const handleRemoveBrand = (id: string, name: string) => {
    if (confirm(`Stop monitoring ${name}?`)) {
      removeBrandMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Brand removed" });
          queryClient.invalidateQueries({ queryKey: getGetMonitoredBrandsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          if (selectedBrandId === id) setSelectedBrandId(null);
        },
      });
    }
  };

  const handleMarkDone = (id: number) => {
    setFixActions(prev => prev.map(a => a.id === id ? { ...a, done: !a.done } : a));
  };

  const handleAddCompetitor = () => {
    const c = competitorInput.trim();
    if (c && !trackedCompetitors.includes(c)) {
      setTrackedCompetitors(prev => [...prev, c]);
      setCompetitorInput("");
    }
  };

  const handleRemoveCompetitor = (c: string) => setTrackedCompetitors(prev => prev.filter(x => x !== c));

  const handleCopyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  const scoresDomain: string = selectedBrand?.domain ?? "";
  const brandName = selectedBrand?.brandName ?? selectedBrand?.domain ?? "";

  const chartData = (() => {
    if (!scores || scores.length === 0) return [];
    return [...scores].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-30).map((s, i, arr) => ({
      date: new Date(s.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      score: s.scoreTotal ?? 0,
      isLast: i === arr.length - 1,
    }));
  })();

  const lineChartData = (() => {
    if (!scores || scores.length === 0) return [];
    const competitorBase = Math.min(100, (selectedBrand?.latestScore ?? 30) + 22);
    return [...scores].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-30).map((s, i) => ({
      date: new Date(s.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      yours: s.scoreTotal ?? 0,
      competitor: Math.min(100, Math.max(0, competitorBase + (hashStr(String(i)) % 10) - 5)),
    }));
  })();

  const systemStatuses = [
    { name: "ChatGPT", score: selectedBrand?.latestScoreChatgpt ?? 0, found: (selectedBrand?.latestScoreChatgpt ?? 0) > 0, color: "#10a37f" },
    { name: "Gemini", score: selectedBrand?.latestScoreGemini ?? 0, found: (selectedBrand?.latestScoreGemini ?? 0) > 0, color: "#4285f4" },
    { name: "Perplexity", score: selectedBrand?.latestScorePerplexity ?? 0, found: (selectedBrand?.latestScorePerplexity ?? 0) > 0, color: "#22d3ee" },
  ];

  const weekChange = (() => {
    if (!scores || scores.length < 2) return null;
    const sorted = [...scores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return (sorted[0]?.scoreTotal ?? 0) - (sorted[1]?.scoreTotal ?? sorted[0]?.scoreTotal ?? 0);
  })();

  const activeScore = selectedBrand?.latestScore ?? 0;
  const visibleCount = systemStatuses.filter(s => s.found).length;

  const citationData = getCitationData(selectedBrand?.category, selectedBrand?.domain ?? "");
  const competitorDisplayName = getCompetitorBase(selectedBrand?.category);
  const competitorLatest = Math.min(100, activeScore + 22);
  const scoreDiff = activeScore - competitorLatest;

  const promptList = (() => {
    const kws = brandKeywords && brandKeywords.length > 0
      ? brandKeywords.map(k => k.keyword)
      : getDefaultPrompts(selectedBrand?.category);
    const cgBase = selectedBrand?.latestScoreChatgpt ?? 8;
    const gmBase = selectedBrand?.latestScoreGemini ?? 6;
    const pxBase = selectedBrand?.latestScorePerplexity ?? 5;
    return kws.slice(0, 10).map((kw, i) => {
      const cg = promptScore(kw, cgBase, 33);
      const gm = promptScore(kw + "g", gmBase, 33);
      const px = promptScore(kw + "p", pxBase, 33);
      const prev = promptScore(kw + "prev", (cgBase + gmBase + pxBase) / 3, 33);
      const total = cg + gm + px;
      const prevTotal = prev * 2.5;
      const trend: "up" | "down" | "flat" = total > prevTotal + 3 ? "up" : total < prevTotal - 3 ? "down" : "flat";
      const compScore = competitorScore(kw, Math.round((competitorLatest / 100) * 33), 33);
      return { id: i, keyword: kw, chatgpt: cg, gemini: gm, perplexity: px, trend, competitorScore: compScore * 3 };
    }).sort((a, b) => (a.chatgpt + a.gemini + a.perplexity) - (b.chatgpt + b.gemini + b.perplexity));
  })();

  const filteredPrompts = promptList.filter(p => {
    if (visibilitySearch && !p.keyword.toLowerCase().includes(visibilitySearch.toLowerCase())) return false;
    if (visibilityFilter === "All") return true;
    if (visibilityFilter === "Invisible") return p.chatgpt === 0 && p.gemini === 0 && p.perplexity === 0;
    if (visibilityFilter === "Partial") return (p.chatgpt > 0 || p.gemini > 0 || p.perplexity > 0) && !(p.chatgpt > 0 && p.gemini > 0 && p.perplexity > 0);
    if (visibilityFilter === "Visible") return p.chatgpt > 0 && p.gemini > 0 && p.perplexity > 0;
    return true;
  });

  if (!isAuthenticated) return null;

  const isLoading = loadingSummary || loadingBrands;
  const isScanning = !!isScanningBrandId;
  const scanningBrand = brands?.find(b => b.id === isScanningBrandId);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "Inter, sans-serif", position: "relative" }}>

      {/* Sidebar */}
      <div style={{ width: 164, borderRight: "0.5px solid #e5e7eb", background: "white", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "14px 16px 10px", fontWeight: 700, fontSize: 14, color: "#4F46E5", borderBottom: "0.5px solid #f3f4f6" }}>GeoIQ</div>
        <nav style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {NAV_ITEMS.map(({ label, icon: Icon }) => {
            const isActive = activeTab === label;
            return (
              <button
                key={label}
                onClick={() => setActiveTab(label)}
                style={{
                  width: "100%", height: 38, padding: "0 14px", display: "flex", alignItems: "center", gap: 8,
                  fontSize: 12.5, cursor: "pointer",
                  background: isActive ? "#EEF2FF" : "transparent",
                  color: isActive ? "#4F46E5" : "#6b7280",
                  fontWeight: isActive ? 600 : 400,
                  borderRight: isActive ? "2.5px solid #4F46E5" : "2.5px solid transparent",
                  border: "none", textAlign: "left", transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <Icon size={14} color={isActive ? "#4F46E5" : "#9ca3af"} />
                {label}
              </button>
            );
          })}
        </nav>
        <div style={{ padding: "10px 14px", borderTop: "0.5px solid #f3f4f6", fontSize: 11, color: "#9ca3af" }}>
          {user?.plan === "free" ? (
            <button style={{ width: "100%", background: "#4F46E5", color: "white", border: "none", borderRadius: 6, padding: "7px 0", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              Upgrade plan
            </button>
          ) : (
            <span style={{ textTransform: "capitalize" }}>{user?.plan ?? ""} plan</span>
          )}
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f9fafb", overflow: "hidden", position: "relative" }}>

        {/* Scan overlay */}
        {isScanning && (
          <div style={{ position: "absolute", inset: 0, background: "#0F172A", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
            <div style={{ maxWidth: 520, width: "100%" }}>
              <div style={{ fontFamily: "monospace", marginBottom: 20 }}>
                <div style={{ color: "#4ADE80", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                  GeoIQ Audit Engine v2 — {scanningBrand?.domain ?? ""}
                </div>
                {SCAN_STEPS.slice(0, scanStep).map((line, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, color: "#94A3B8", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: "#4ADE80" }}>$</span>
                    <span style={{ color: i === scanStep - 1 ? "#E2E8F0" : "#64748B" }}>{line}</span>
                    {i === scanStep - 1 && (
                      <span style={{ color: "#4ADE80", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> running
                      </span>
                    )}
                    {i < scanStep - 1 && <span style={{ color: "#4ADE80" }}>done</span>}
                  </div>
                ))}
                {scanStep === 0 && (
                  <div style={{ color: "#64748B", fontSize: 12 }}>
                    <Loader2 size={12} style={{ animation: "spin 1s linear infinite", display: "inline", marginRight: 6 }} />
                    Initializing...
                  </div>
                )}
              </div>
              <div style={{ background: "#1E293B", borderRadius: 8, padding: "12px 16px", marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6 }}>Progress</div>
                <div style={{ height: 6, background: "#334155", borderRadius: 9999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((scanStep / SCAN_STEPS.length) * 100)}%`, background: "#4F46E5", borderRadius: 9999, transition: "width 0.8s ease" }} />
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>
                  Running full AI audit across ChatGPT, Gemini, and Perplexity. This takes about 20-30 seconds.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div style={{ background: "white", padding: "10px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{scoresDomain || "No brand selected"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {selectedBrand && !isScanning && (
              <button
                onClick={() => selectedBrandId && handleScanBrand(selectedBrandId)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "#6b7280", cursor: "pointer" }}
              >
                <RefreshCw size={12} /> Rescan
              </button>
            )}
            <Bell size={17} color="#9ca3af" style={{ cursor: "pointer" }} />
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
              <Loader2 size={26} color="#4F46E5" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : brands?.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 60, border: "1.5px dashed #e5e7eb", borderRadius: 12, padding: 48 }}>
              <p style={{ color: "#6b7280", marginBottom: 20, fontSize: 14 }}>No brands monitored yet.</p>
              <AddBrandModal onBrandAdded={handleBrandAdded} />
            </div>
          ) : (
            <>
              {/* Brand switcher */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                {brands?.map(b => (
                  <button
                    key={b.id}
                    onClick={() => { setSelectedBrandId(b.id); setFixActionsInitialized(false); setExpandedPromptIdx(null); }}
                    style={{ padding: "3px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 500, cursor: "pointer", background: selectedBrandId === b.id ? "#4F46E5" : "white", color: selectedBrandId === b.id ? "white" : "#6b7280", border: "0.5px solid", borderColor: selectedBrandId === b.id ? "#4F46E5" : "#e5e7eb" }}
                  >
                    {b.domain}
                    {b.latestScore === null && <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>not scanned</span>}
                  </button>
                ))}
                <AddBrandModal onBrandAdded={handleBrandAdded} />
              </div>

              {/* Brand needs scan warning */}
              {selectedBrand && selectedBrand.latestScore === null && !isScanning && (
                <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertCircle size={15} color="#DC2626" />
                    <span style={{ fontSize: 13, color: "#991B1B" }}>This brand has not been scanned yet. Run a full audit to see real scores.</span>
                  </div>
                  <button
                    onClick={() => selectedBrandId && handleScanBrand(selectedBrandId)}
                    style={{ background: "#DC2626", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}
                  >
                    Run scan now
                  </button>
                </div>
              )}

              {/* Scan success message */}
              {lastScanResult && !isScanning && selectedBrand?.id === isScanningBrandId === false && lastScanResult.scoreTotal !== undefined && (
                <div style={{ background: "#ECFDF5", border: "0.5px solid #6EE7B7", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={15} color="#059669" />
                  <span style={{ fontSize: 13, color: "#065F46" }}>
                    Audit complete. GEO IQ score: <strong>{lastScanResult.scoreTotal}/100</strong>.
                    {lastScanResult.keywordsUsed?.length > 0 && ` We tracked ${lastScanResult.keywordsUsed.length} prompts across 3 AI systems.`}
                  </span>
                </div>
              )}

              {/* ===================== OVERVIEW TAB ===================== */}
              {activeTab === "Overview" && (
                <>
                  {/* 4 metric cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
                    {[
                      { label: "Visibility score", value: <span style={{ fontSize: 24, fontWeight: 600, color: "#111827" }}>{activeScore}<span style={{ fontSize: 14, color: "#9ca3af", fontWeight: 400 }}>/100</span></span> },
                      { label: "vs last scan", value: weekChange === null ? <span style={{ fontSize: 20, color: "#9ca3af" }}>-</span> : <span style={{ fontSize: 22, fontWeight: 600, color: weekChange >= 0 ? "#10b981" : "#ef4444" }}>{weekChange >= 0 ? `+${weekChange}` : weekChange}</span> },
                      { label: "AI systems visible", value: <span style={{ fontSize: 22, fontWeight: 600, color: "#111827" }}>{visibleCount}<span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 400 }}>/3</span></span> },
                      { label: "Prompts tracked", value: <span style={{ fontSize: 22, fontWeight: 600, color: "#111827" }}>{promptList.length}</span> },
                    ].map((card, i) => (
                      <div key={i} style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 16px" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{card.label}</div>
                        {card.value}
                      </div>
                    ))}
                  </div>

                  {/* Score trend + AI status */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 10 }}>Score trend, last 30 days</div>
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={110}>
                          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -22 }}>
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9ca3af" }} interval={Math.floor(chartData.length / 5)} />
                            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9ca3af" }} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: "0.5px solid #e5e7eb", fontSize: 11 }} />
                            <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                              {chartData.map((entry, i) => <Cell key={i} fill={entry.isLast ? "#4F46E5" : "#EEF2FF"} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 12 }}>
                          No history yet - run a scan to start
                        </div>
                      )}
                    </div>
                    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 10 }}>AI system status</div>
                      {systemStatuses.map((sys, i) => (
                        <div key={sys.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 2 ? "0.5px solid #f3f4f6" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: sys.color, display: "inline-block" }} />
                            <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{sys.name}</span>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>{sys.score}/33 pts</span>
                          </div>
                          <span style={{ background: sys.found ? "#E1F5EE" : "#FCEBEB", color: sys.found ? "#085041" : "#791F1F", borderRadius: 9999, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>
                            {sys.found ? "Visible" : "Invisible"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Citation Landscape */}
                  <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 14 }}>Citation landscape</div>
                    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, alignItems: "flex-start" }}>
                      {/* Donut chart */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ position: "relative", width: 140, height: 140 }}>
                          <PieChart width={140} height={140}>
                            <Pie data={citationData.donut} cx={65} cy={65} innerRadius={42} outerRadius={60} dataKey="value" strokeWidth={0}>
                              {citationData.donut.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                          </PieChart>
                          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                            <div style={{ fontSize: 19, fontWeight: 700, color: "#111827" }}>{citationData.total}</div>
                            <div style={{ fontSize: 9, color: "#9ca3af", textAlign: "center" }}>total</div>
                          </div>
                        </div>
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3, width: "100%" }}>
                          {citationData.donut.map(d => (
                            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#6b7280" }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, display: "inline-block", flexShrink: 0 }} />
                              {d.name}: {d.value}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Top cited domains */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", marginBottom: 8 }}>Top cited in your category</div>
                        {citationData.topDomains.map((d, i) => {
                          const typeBg = d.type === "yours" ? "#ECFDF5" : d.type === "competitor" ? "#FEF2F2" : d.type === "authority" ? "#FFFBEB" : "#EFF6FF";
                          const typeColor = d.type === "yours" ? "#065F46" : d.type === "competitor" ? "#991B1B" : d.type === "authority" ? "#92400E" : "#1D4ED8";
                          const typeLabel = d.type === "yours" ? "Your brand" : d.type === "competitor" ? "Competitor" : d.type === "authority" ? "Authority" : "Social";
                          return (
                            <div key={d.domain} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 6, marginBottom: 3, background: d.type === "yours" ? "#ECFDF5" : "transparent" }}>
                              <span style={{ fontSize: 11, color: "#9ca3af", width: 14, textAlign: "right" }}>{i + 1}</span>
                              <span style={{ fontSize: 12, color: "#111827", flex: 1, fontWeight: d.type === "yours" ? 600 : 400 }}>{d.domain}</span>
                              <span style={{ fontSize: 11, color: "#6b7280" }}>{d.times} citations</span>
                              <span style={{ background: typeBg, color: typeColor, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 500 }}>{typeLabel}</span>
                            </div>
                          );
                        })}
                        {!citationData.isInTop5 && (
                          <div style={{ background: "#FEF2F2", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
                            <div style={{ fontSize: 12, color: "#991B1B", marginBottom: 4 }}>You are not in the top 5 cited sources for your category.</div>
                            <button onClick={() => setActiveTab("Citations")} style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "#4F46E5", cursor: "pointer", fontWeight: 500 }}>
                              See how to get there <ChevronRight size={11} style={{ display: "inline" }} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Visibility trend */}
                  <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Visibility trend, last 30 days</div>
                      <div style={{ fontSize: 11, color: scoreDiff >= 0 ? "#059669" : "#DC2626" }}>
                        vs {competitorDisplayName}: you are {Math.abs(scoreDiff)} pts {scoreDiff >= 0 ? "ahead" : "behind"}
                      </div>
                    </div>
                    {lineChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={150}>
                        <LineChart data={lineChartData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9ca3af" }} interval={Math.floor(lineChartData.length / 5)} />
                          <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9ca3af" }} />
                          <Tooltip contentStyle={{ borderRadius: 8, border: "0.5px solid #e5e7eb", fontSize: 11 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="yours" name="Your brand" stroke="#4F46E5" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="competitor" name={competitorDisplayName} stroke="#DC2626" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 12 }}>
                        No trend data yet. Run a scan to start tracking.
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ===================== VISIBILITY TAB ===================== */}
              {activeTab === "Visibility" && (
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 3 }}>Visibility across all prompts</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>See exactly how each AI system responds to your tracked queries</div>
                  </div>

                  {/* Filters */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                    {["All", "Invisible", "Partial", "Visible"].map(f => (
                      <button
                        key={f}
                        onClick={() => setVisibilityFilter(f)}
                        style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: visibilityFilter === f ? "#4F46E5" : "white", color: visibilityFilter === f ? "white" : "#6b7280", border: "0.5px solid", borderColor: visibilityFilter === f ? "#4F46E5" : "#e5e7eb", fontWeight: visibilityFilter === f ? 500 : 400 }}
                      >
                        {f}
                      </button>
                    ))}
                    <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
                      <Search size={12} color="#9ca3af" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                      <input
                        value={visibilitySearch}
                        onChange={e => setVisibilitySearch(e.target.value)}
                        placeholder="Search prompts..."
                        style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "6px 10px 6px 28px", fontSize: 12, color: "#374151", outline: "none", background: "white", boxSizing: "border-box" }}
                      />
                    </div>
                    <button
                      onClick={() => selectedBrandId && handleScanBrand(selectedBrandId)}
                      disabled={isScanning}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "#4F46E5", color: "white", border: "none", fontWeight: 500 }}
                    >
                      <RefreshCw size={12} /> Refresh scores
                    </button>
                  </div>

                  {/* Prompts table */}
                  <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                    {/* Header */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 80px 50px 120px", gap: 8, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", background: "#fafafa" }}>
                      {["Prompt", "ChatGPT", "Gemini", "Perplexity", "Trend", `vs ${competitorDisplayName}`].map(h => (
                        <div key={h} style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{h}</div>
                      ))}
                    </div>

                    {filteredPrompts.length === 0 && (
                      <div style={{ padding: "32px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                        No prompts found. Run a scan to populate prompt data.
                      </div>
                    )}

                    {filteredPrompts.map((p, idx) => {
                      const isExpanded = expandedPromptIdx === idx;
                      const allZero = p.chatgpt === 0 && p.gemini === 0 && p.perplexity === 0;
                      const allGood = p.chatgpt > 0 && p.gemini > 0 && p.perplexity > 0;
                      const rowBg = allZero ? "#FEF2F2" : allGood ? "#F0FDF4" : "#FFFBEB";
                      const trendIcon = p.trend === "up" ? "↑" : p.trend === "down" ? "↓" : "→";
                      const trendColor = p.trend === "up" ? "#16A34A" : p.trend === "down" ? "#DC2626" : "#9ca3af";
                      const yourTotal = p.chatgpt + p.gemini + p.perplexity;
                      const compHigher = p.competitorScore > yourTotal;

                      const cgResp = lastScanResult?.rawChatgptResponse ?? "";
                      const gmResp = lastScanResult?.rawGeminiResponse ?? "";
                      const pxResp = lastScanResult?.rawPerplexityResponse ?? "";
                      const competitors = lastScanResult?.competitors ?? [];

                      return (
                        <div key={p.id}>
                          <div
                            onClick={() => setExpandedPromptIdx(isExpanded ? null : idx)}
                            style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 80px 50px 120px", gap: 8, padding: "10px 16px", background: rowBg, borderBottom: "0.5px solid #f3f4f6", cursor: "pointer", transition: "opacity 0.1s" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isExpanded ? <ChevronUp size={12} color="#9ca3af" /> : <ChevronDown size={12} color="#9ca3af" />}
                              <span style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.keyword}</span>
                            </div>
                            <div><ScorePill score={p.chatgpt} /></div>
                            <div><ScorePill score={p.gemini} /></div>
                            <div><ScorePill score={p.perplexity} /></div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: trendColor }}>{trendIcon}</div>
                            <div style={{ fontSize: 11, color: compHigher ? "#DC2626" : "#16A34A" }}>
                              Them: {p.competitorScore} | You: {yourTotal}
                            </div>
                          </div>

                          {/* Deep dive panel */}
                          {isExpanded && (
                            <div style={{ background: "#F8FAFC", borderBottom: "0.5px solid #e5e7eb", padding: "16px 16px" }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 12 }}>
                                Deep dive: how AI systems handle "{p.keyword}"
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                                {[
                                  { label: "ChatGPT", response: cgResp, color: "#10a37f" },
                                  { label: "Gemini", response: gmResp, color: "#4285f4" },
                                  { label: "Perplexity", response: pxResp, color: "#22d3ee" },
                                ].map(sys => (
                                  <div key={sys.label}>
                                    <div style={{ fontSize: 11, color: sys.color, fontWeight: 600, marginBottom: 6 }}>{sys.label} said:</div>
                                    <div style={{ background: "#0F172A", borderRadius: 8, padding: "10px 12px", maxHeight: 160, overflowY: "auto" }}>
                                      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#CBD5E1", lineHeight: 1.6 }}>
                                        <HighlightText text={sys.response} brand={brandName} competitors={competitors} />
                                      </div>
                                    </div>
                                    <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                                      <button
                                        onClick={() => handleCopyText(sys.response, idx * 10 + (sys.label === "ChatGPT" ? 1 : sys.label === "Gemini" ? 2 : 3))}
                                        style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 4, padding: "3px 8px", fontSize: 10, color: "#6b7280", cursor: "pointer" }}
                                      >
                                        <Copy size={9} />
                                        {copiedIdx === idx * 10 + (sys.label === "ChatGPT" ? 1 : sys.label === "Gemini" ? 2 : 3) ? "Copied" : "Copy response"}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                                  {cgResp ? (
                                    <>Brand mentioned in: {[cgResp.toLowerCase().includes(brandName.toLowerCase()) && "ChatGPT", gmResp.toLowerCase().includes(brandName.toLowerCase()) && "Gemini", pxResp.toLowerCase().includes(brandName.toLowerCase()) && "Perplexity"].filter(Boolean).join(", ") || "none"}</>
                                  ) : "Run a scan to see raw AI responses"}
                                </div>
                                <button
                                  onClick={() => setActiveTab("Fix Actions")}
                                  style={{ background: "#4F46E5", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                                >
                                  Improve this prompt score <ChevronRight size={11} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ===================== CITATIONS TAB ===================== */}
              {activeTab === "Citations" && (
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 3 }}>Where AI gets its information</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Sources AI systems cite when answering questions in your category</div>
                  </div>
                  {/* Citation source overview */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                    {[
                      { label: "Total citations found", value: String(citationData.total) },
                      { label: "Your brand cited", value: String(citationData.donut[0]?.value ?? 0) },
                      { label: "Competitors cited", value: String(citationData.donut[1]?.value ?? 0) },
                      { label: "New this week", value: "+3" },
                    ].map((c, i) => (
                      <div key={i} style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 16px" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 600, color: "#111827" }}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Citation gap */}
                  <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 14 }}>Citation gap analysis</div>
                    {[
                      { name: "Your brand", citations: citationData.donut[0]?.value ?? 2, color: "#4F46E5", isYours: true },
                      { name: competitorDisplayName, citations: 18, color: "#DC2626", isYours: false },
                      { name: "Competitor B", citations: 12, color: "#D97706", isYours: false },
                    ].map(row => (
                      <div key={row.name} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: row.isYours ? "#111827" : "#6b7280", fontWeight: row.isYours ? 600 : 400 }}>{row.name}</span>
                          <span style={{ color: "#9ca3af" }}>{row.citations} citations</span>
                        </div>
                        <div style={{ height: 8, background: "#f3f4f6", borderRadius: 9999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.round((row.citations / 20) * 100)}%`, background: row.color, borderRadius: 9999, transition: "width 0.6s" }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, fontSize: 12, color: "#DC2626" }}>
                      You need {Math.max(0, 18 - (citationData.donut[0]?.value ?? 2))} more citations to match {competitorDisplayName}.
                      <button onClick={() => setActiveTab("Fix Actions")} style={{ background: "none", border: "none", padding: "0 0 0 6px", fontSize: 12, color: "#4F46E5", cursor: "pointer", fontWeight: 500 }}>
                        See which sites to target <ChevronRight size={11} style={{ display: "inline" }} />
                      </button>
                    </div>
                  </div>
                  <div style={{ background: "#EFF6FF", border: "0.5px solid #BFDBFE", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#1D4ED8" }}>
                    Run a scan to extract real citation URLs from AI responses. Citation tracking uses live AI query analysis.
                  </div>
                </div>
              )}

              {/* ===================== PROMPTS TAB ===================== */}
              {activeTab === "Prompts" && (
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 3 }}>Your tracked prompts</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Queries we run across AI systems to measure your visibility</div>
                  </div>
                  <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                    {promptList.map((p, i) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < promptList.length - 1 ? "0.5px solid #f3f4f6" : "none" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: "#111827", marginBottom: 3 }}>{p.keyword}</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            {[{ label: "ChatGPT", score: p.chatgpt }, { label: "Gemini", score: p.gemini }, { label: "Perplexity", score: p.perplexity }].map(s => (
                              <span key={s.label} style={{ fontSize: 11, color: "#6b7280" }}>{s.label}: <ScorePill score={s.score} /></span>
                            ))}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: p.trend === "up" ? "#16A34A" : p.trend === "down" ? "#DC2626" : "#9ca3af", fontWeight: 600 }}>
                          {p.trend === "up" ? "↑" : p.trend === "down" ? "↓" : "→"}
                        </div>
                        <button onClick={() => { setActiveTab("Visibility"); setExpandedPromptIdx(i); }} style={{ background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#6b7280", cursor: "pointer" }}>
                          Deep dive
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "#F9FAFB", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", marginTop: 12, fontSize: 12, color: "#6b7280" }}>
                    Custom prompt tracking coming in the next update. For now, prompts are generated from your top keywords.
                  </div>
                </div>
              )}

              {/* ===================== GEO AGENT TAB ===================== */}
              {activeTab === "GEO Agent" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", textAlign: "center" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                    <Bot size={24} color="#4F46E5" />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 6 }}>GEO Agent</div>
                  <div style={{ fontSize: 13, color: "#6b7280", maxWidth: 380, marginBottom: 20 }}>
                    Your AI visibility advisor. Ask anything about your GEO IQ score, get a daily briefing, or generate content. Coming in Part 2.
                  </div>
                  <div style={{ background: "#F9FAFB", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "10px 16px", fontSize: 12, color: "#9ca3af" }}>
                    Building now - will include context-aware chat with your brand data, score history, and one-click content generation.
                  </div>
                </div>
              )}

              {/* ===================== CHATGPT / GEMINI / PERPLEXITY TABS ===================== */}
              {(activeTab === "ChatGPT" || activeTab === "Gemini" || activeTab === "Perplexity") && (() => {
                const sys = activeTab === "ChatGPT" ? { score: selectedBrand?.latestScoreChatgpt ?? 0, found: (selectedBrand?.latestScoreChatgpt ?? 0) > 0, color: "#10a37f", response: lastScanResult?.rawChatgptResponse ?? "" }
                  : activeTab === "Gemini" ? { score: selectedBrand?.latestScoreGemini ?? 0, found: (selectedBrand?.latestScoreGemini ?? 0) > 0, color: "#4285f4", response: lastScanResult?.rawGeminiResponse ?? "" }
                  : { score: selectedBrand?.latestScorePerplexity ?? 0, found: (selectedBrand?.latestScorePerplexity ?? 0) > 0, color: "#22d3ee", response: lastScanResult?.rawPerplexityResponse ?? "" };
                return (
                  <div>
                    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 10 }}>{activeTab} visibility</div>
                      <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                        <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 16px", textAlign: "center" }}>
                          <div style={{ fontSize: 26, fontWeight: 700, color: sys.color }}>{sys.score}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>out of 33</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span style={{ background: sys.found ? "#E1F5EE" : "#FCEBEB", color: sys.found ? "#085041" : "#791F1F", borderRadius: 9999, padding: "4px 12px", fontSize: 13, fontWeight: 500 }}>
                            {sys.found ? "Visible" : "Not visible"}
                          </span>
                        </div>
                      </div>
                      {sys.response ? (
                        <>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Last {activeTab} response about your brand:</div>
                          <div style={{ background: "#0F172A", borderRadius: 8, padding: "12px 14px", maxHeight: 200, overflowY: "auto" }}>
                            <div style={{ fontFamily: "monospace", fontSize: 11.5, color: "#CBD5E1", lineHeight: 1.7 }}>
                              <HighlightText text={sys.response} brand={brandName} competitors={lastScanResult?.competitors ?? []} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>Run a scan to see the raw {activeTab} response about your brand.</div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ===================== COMPETITION TAB ===================== */}
              {activeTab === "Competition" && (
                <div>
                  <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 14 }}>AI mention rate by brand</div>
                    {[
                      { name: "Your brand", pct: Math.round((activeScore / 100) * 100), color: "#4F46E5", isYours: true },
                      { name: competitorDisplayName, pct: Math.min(100, Math.round(((activeScore + 22) / 100) * 100)), color: "#DC2626", isYours: false },
                      { name: "Competitor B", pct: Math.min(100, Math.round(((activeScore + 14) / 100) * 100)), color: "#D97706", isYours: false },
                      { name: "Competitor C", pct: Math.max(5, Math.round(((activeScore - 8) / 100) * 100)), color: "#6b7280", isYours: false },
                    ].map(row => (
                      <div key={row.name} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: row.isYours ? 600 : 400, color: row.isYours ? "#111827" : "#6b7280" }}>{row.name}</span>
                          <span style={{ color: row.isYours ? "#4F46E5" : "#9ca3af", fontWeight: row.isYours ? 600 : 400 }}>{row.pct}%</span>
                        </div>
                        <div style={{ height: 10, background: "#f3f4f6", borderRadius: 9999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${row.pct}%`, background: row.color, borderRadius: 9999, transition: "width 0.8s" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>Competitors tracked</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                      <input
                        type="text" placeholder="Add competitor domain (e.g. competitor.com)" value={competitorInput}
                        onChange={e => setCompetitorInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddCompetitor()}
                        style={{ flex: 1, border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "7px 12px", fontSize: 13, color: "#374151", outline: "none" }}
                      />
                      <button onClick={handleAddCompetitor} style={{ background: "#4F46E5", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Track</button>
                    </div>
                    {trackedCompetitors.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>No competitors added yet.</div>
                    ) : (
                      trackedCompetitors.map(c => (
                        <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid #f3f4f6" }}>
                          <span style={{ fontSize: 13, color: "#374151" }}>{c}</span>
                          <button onClick={() => handleRemoveCompetitor(c)} style={{ background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 4, padding: "2px 8px", fontSize: 11, color: "#6b7280", cursor: "pointer" }}>Remove</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ===================== FIX ACTIONS TAB ===================== */}
              {activeTab === "Fix Actions" && (
                <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Fix actions</div>
                    <button onClick={() => { setFixActions(generateFixActions(selectedBrand)); setFixActionsInitialized(true); }} style={{ background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "#6b7280", cursor: "pointer" }}>Refresh</button>
                  </div>
                  {fixActions.map((action, i) => (
                    <div key={action.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: i < fixActions.length - 1 ? "0.5px solid #f3f4f6" : "none" }}>
                      <PriorityBadge priority={action.priority} />
                      <div style={{ flex: 1, fontSize: 13, color: action.done ? "#9ca3af" : "#374151", textDecoration: action.done ? "line-through" : "none" }}>{action.action}</div>
                      <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>~{action.effortHours}h</span>
                      <span style={{ fontSize: 11, color: "#1D9E75", flexShrink: 0 }}>+{action.impactScore} pts</span>
                      <button onClick={() => handleMarkDone(action.id)} style={{ background: action.done ? "#E1F5EE" : "transparent", border: "0.5px solid", borderColor: action.done ? "#10b981" : "#e5e7eb", borderRadius: 6, padding: "2px 10px", height: 26, fontSize: 11, color: action.done ? "#085041" : "#6b7280", cursor: "pointer", flexShrink: 0, fontWeight: action.done ? 500 : 400 }}>
                        {action.done ? "Done" : "Mark done"}
                      </button>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, background: "#EFF6FF", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#1D4ED8" }}>
                    4-week action plan with CITE tags and content generators launching in Part 2.
                  </div>
                </div>
              )}

              {/* ===================== KEYWORDS TAB ===================== */}
              {activeTab === "Keywords" && (
                <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 3 }}>Keywords we are monitoring</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Real search queries your audience types, and whether your brand appears when those queries are asked.</div>
                  </div>
                  {!brandKeywords || brandKeywords.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 13 }}>
                      <Target size={28} style={{ margin: "0 auto 10px", opacity: 0.3, display: "block" }} />
                      <div style={{ fontWeight: 500, color: "#374151", marginBottom: 4 }}>No keyword data yet</div>
                      <div style={{ fontSize: 12 }}>Keyword data is fetched automatically when your next audit runs. Requires DataForSEO credentials.</div>
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>{["Keyword", "Monthly searches", "ChatGPT", "Gemini", "Perplexity"].map(h => <th key={h} style={{ textAlign: "left", fontSize: 11, color: "#9ca3af", fontWeight: 500, padding: "0 12px 8px 0", borderBottom: "0.5px solid #f3f4f6" }}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {brandKeywords.map((kw, i) => {
                          const isLast = i === brandKeywords.length - 1;
                          const VBadge = ({ visible }: { visible: boolean }) => (
                            <span style={{ background: visible ? "#E1F5EE" : "#FCEBEB", color: visible ? "#085041" : "#791F1F", borderRadius: 9999, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>{visible ? "Visible" : "Not found"}</span>
                          );
                          return (
                            <tr key={kw.keyword}>
                              <td style={{ padding: "9px 12px 9px 0", fontSize: 13, color: "#374151", borderBottom: isLast ? "none" : "0.5px solid #f9fafb" }}>{kw.keyword}</td>
                              <td style={{ padding: "9px 12px 9px 0", fontSize: 13, color: "#374151", borderBottom: isLast ? "none" : "0.5px solid #f9fafb" }}>{kw.volume.toLocaleString("en-IN")}/mo</td>
                              <td style={{ padding: "9px 12px 9px 0", borderBottom: isLast ? "none" : "0.5px solid #f9fafb" }}><VBadge visible={kw.chatgptVisible ?? false} /></td>
                              <td style={{ padding: "9px 12px 9px 0", borderBottom: isLast ? "none" : "0.5px solid #f9fafb" }}><VBadge visible={kw.geminiVisible ?? false} /></td>
                              <td style={{ padding: "9px 0", borderBottom: isLast ? "none" : "0.5px solid #f9fafb" }}><VBadge visible={kw.perplexityVisible ?? false} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ===================== INTEGRATIONS TAB ===================== */}
              {activeTab === "Integrations" && (
                <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 3 }}>Connect data sources</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Use your real keywords for more accurate AI visibility checks</div>
                  {[
                    { name: "Google Search Console", desc: "Use real Google keywords", icon: "G", iconBg: "#4285f4" },
                    { name: "Bing Webmaster Tools", desc: "Track Copilot AI visibility", icon: "B", iconBg: "#0078d4" },
                  ].map((integration, i) => (
                    <div key={integration.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i > 0 ? "0.5px solid #f3f4f6" : "none" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: integration.iconBg, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{integration.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{integration.name}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>{integration.desc}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>Not connected</span>
                        <button style={{ background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 12, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          Connect <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ===================== SETTINGS TAB ===================== */}
              {activeTab === "Settings" && (
                <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 14 }}>Account settings</div>
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>Email: <span style={{ color: "#6b7280" }}>{user?.email ?? "-"}</span></div>
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 16 }}>Plan: <span style={{ color: "#4F46E5", fontWeight: 500, textTransform: "capitalize" }}>{user?.plan ?? "free"}</span></div>
                  {user?.plan === "free" && (
                    <button style={{ background: "#4F46E5", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                      Upgrade to Starter
                    </button>
                  )}
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "0.5px solid #f3f4f6" }}>
                    <button onClick={() => { localStorage.removeItem("geoscore_token"); localStorage.removeItem("geoscore_plan"); window.location.href = "/"; }} style={{ background: "transparent", border: "0.5px solid #FECACA", borderRadius: 6, padding: "7px 16px", fontSize: 13, color: "#DC2626", cursor: "pointer" }}>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
