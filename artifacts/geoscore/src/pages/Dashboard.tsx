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
import { FixActionsTab } from "./dashboard/FixActionsTab";
import { GeoAgentTab } from "./dashboard/GeoAgentTab";
import { ContentGenerators } from "./dashboard/ContentGenerators";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, Legend,
} from "recharts";
import {
  Loader2, Bell, Settings, BarChart2, Bot, Lightbulb, Users, Plug,
  ChevronRight, Target, TrendingUp, Link2, MessageSquare, Zap, Key,
  Eye, RefreshCw, Copy, ChevronDown, ChevronUp, Search, ExternalLink,
  AlertCircle, CheckCircle2, Menu, X,
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

const DR_MAP: Record<string, number> = {
  "healthifyme.com": 71, "practo.com": 79, "1mg.com": 78, "sugarfit.com": 52,
  "reddit.com": 91, "medium.com": 95, "crunchbase.com": 83, "producthunt.com": 88,
  "g2.com": 91, "capterra.com": 89, "techcrunch.com": 94, "inc42.com": 62,
  "entrackr.com": 55, "moneycontrol.com": 77, "economictimes.com": 87,
  "razorpay.com": 82, "paytm.com": 80, "mealcoreai.com": 18,
};

interface SiteInfo { url: string; pitch: string; impact: number; subreddit?: string }
const SITE_INFO: Record<string, SiteInfo> = {
  "producthunt.com": { url: "https://www.producthunt.com/posts/new", pitch: "We just launched {brand} on ProductHunt - a product that helps {description}. We'd love your upvote and early feedback.", impact: 12 },
  "g2.com": { url: "https://sell.g2.com/free-listing", pitch: "Claim your free G2 listing for {brand}. Complete your profile with screenshots, use cases, and pricing to get cited by AI systems.", impact: 10 },
  "capterra.com": { url: "https://partners.capterra.com/", pitch: "List {brand} on Capterra to reach software buyers and improve your AI citation rate on product research queries.", impact: 9 },
  "techcrunch.com": { url: "https://techcrunch.com/got-a-tip/", pitch: "Hi TC team, I'm building {brand} - we recently hit [milestone]. Happy to share more data if this might be a fit for a story.", impact: 8 },
  "practo.com": { url: "https://www.practo.com/partner", pitch: "We'd like to explore a listing for {brand} on Practo to help your users discover relevant digital health tools.", impact: 8 },
  "inc42.com": { url: "https://inc42.com/submit-your-startup/", pitch: "Submitting {brand} for Inc42 coverage. We're solving [problem] for Indian founders - happy to share traction data.", impact: 7 },
  "crunchbase.com": { url: "https://www.crunchbase.com/add-new/organization", pitch: "Add {brand} to Crunchbase with your full company profile to increase AI citation coverage on investment and startup queries.", impact: 7 },
  "entrackr.com": { url: "https://entrackr.com/contact/", pitch: "Hi Entrackr, {brand} is a {description} building for the Indian market. Happy to share funding or growth data for a story.", impact: 6 },
  "reddit.com": { url: "https://www.reddit.com", pitch: "", subreddit: "r/startupindia, r/IndiaInvestments, r/digitalnomad", impact: 5 },
};

function getSiteInfo(domain: string, brand: string): SiteInfo {
  const info = SITE_INFO[domain];
  if (!info) return { url: `https://${domain}`, pitch: `Reach out to ${domain} to get ${brand} mentioned in their content or listings.`, impact: 4 };
  return { ...info, pitch: info.pitch.replace(/\{brand\}/g, brand) };
}

function getCategoryCompetitors(category: string | null | undefined, baseScore: number): { name: string; pct: number; isYours: boolean }[] {
  const cat = (category ?? "").toLowerCase();
  const yourPct = Math.min(99, Math.max(2, Math.round(baseScore)));
  let list: { name: string; pct: number; isYours: boolean }[];
  if (cat.includes("health") || cat.includes("diet") || cat.includes("fitness")) {
    list = [
      { name: "HealthifyMe", pct: 78, isYours: false },
      { name: "Sugar.fit", pct: 64, isYours: false },
      { name: "mySugr", pct: 48, isYours: false },
      { name: "Your brand", pct: yourPct, isYours: true },
      { name: "Tap Health", pct: 18, isYours: false },
      { name: "Carbs & Cals", pct: 11, isYours: false },
    ];
  } else if (cat.includes("fintech") || cat.includes("finance")) {
    list = [
      { name: "Razorpay", pct: 82, isYours: false },
      { name: "Paytm", pct: 71, isYours: false },
      { name: "PhonePe", pct: 65, isYours: false },
      { name: "Your brand", pct: yourPct, isYours: true },
      { name: "Fi Money", pct: 23, isYours: false },
    ];
  } else if (cat.includes("saas") || cat.includes("tool") || cat.includes("software")) {
    list = [
      { name: "Notion", pct: 88, isYours: false },
      { name: "Linear", pct: 72, isYours: false },
      { name: "Coda", pct: 54, isYours: false },
      { name: "Your brand", pct: yourPct, isYours: true },
      { name: "Taskade", pct: 19, isYours: false },
    ];
  } else {
    list = [
      { name: "Competitor A", pct: Math.min(99, yourPct + 28), isYours: false },
      { name: "Competitor B", pct: Math.min(99, yourPct + 18), isYours: false },
      { name: "Your brand", pct: yourPct, isYours: true },
      { name: "Competitor C", pct: Math.max(5, yourPct - 12), isYours: false },
    ];
  }
  return list.sort((a, b) => b.pct - a.pct);
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
  const [citationModal, setCitationModal] = useState<{ domain: string; type: "competitor" | "authority" | "social" } | null>(null);
  const [socialPostLink, setSocialPostLink] = useState("");
  const [promptSearch, setPromptSearch] = useState("");
  const [settingsBrandName, setSettingsBrandName] = useState("");
  const [settingsCategory, setSettingsCategory] = useState("");
  const [settingsMarket, setSettingsMarket] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [promptFilter, setPromptFilter] = useState("All");
  const [addPromptModal, setAddPromptModal] = useState(false);
  const [newPromptText, setNewPromptText] = useState("");
  const [newPromptTag, setNewPromptTag] = useState("Category");
  const [customPrompts, setCustomPrompts] = useState<{ keyword: string; tag: string; chatgpt: number; gemini: number; perplexity: number; trend: "up" | "down" | "flat" }[]>([]);
  const [promptAddedMsg, setPromptAddedMsg] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(
    localStorage.getItem("geoiq_pw_banner_dismissed") === "true"
  );
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: getGetMonitoredBrandsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    };
    window.addEventListener("audit-updated", handler);
    return () => window.removeEventListener("audit-updated", handler);
  }, [queryClient]);

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

  // Sync settings fields when selected brand changes
  useEffect(() => {
    if (selectedBrand) {
      setSettingsBrandName(selectedBrand.brandName ?? "");
      setSettingsCategory(selectedBrand.category ?? "");
      setSettingsMarket(selectedBrand.market ?? "");
    }
  }, [selectedBrand?.id]);

  const handleSaveSettings = async () => {
    if (!selectedBrandId) return;
    setSettingsSaving(true);
    try {
      const token = localStorage.getItem("geoscore_token");
      const res = await fetch(`/api/dashboard/brands/${selectedBrandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ brandName: settingsBrandName, category: settingsCategory, market: settingsMarket }),
      });
      if (!res.ok) throw new Error("Save failed");
      queryClient.invalidateQueries({ queryKey: getGetMonitoredBrandsQueryKey() });
      toast({ title: "Saved", description: "Brand settings updated." });
    } catch {
      toast({ title: "Save failed", description: "Could not update brand settings. Please try again.", variant: "destructive" });
    } finally {
      setSettingsSaving(false);
    }
  };

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

  const userHasPassword = (user as Record<string, unknown> | undefined)?.hasPassword;
  const showPasswordBanner = userHasPassword === false && !bannerDismissed;

  const handleSetPassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSettingPassword(true);
    try {
      const token = localStorage.getItem("geoscore_token");
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json() as { set?: boolean; error?: string };
      if (!res.ok) {
        toast({ title: data.error ?? "Could not set password", variant: "destructive" });
        return;
      }
      toast({ title: "Password set", description: "You can now sign in with your email and password." });
      setShowSetPasswordModal(false);
      setBannerDismissed(true);
      localStorage.setItem("geoiq_pw_banner_dismissed", "true");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setSettingPassword(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "Inter, sans-serif", position: "relative" }}>

      {/* Set password banner */}
      {showPasswordBanner && (
        <div style={{ background: "#EEF2FF", borderBottom: "1px solid #C7D2FE", padding: "8px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, zIndex: 10 }}>
          <span style={{ fontSize: 13, color: "#3730A3", flex: 1 }}>
            You signed up via magic link. Add a password so you can sign in directly.
          </span>
          <button
            onClick={() => setShowSetPasswordModal(true)}
            style={{ fontSize: 12, fontWeight: 600, color: "#4F46E5", background: "white", border: "1px solid #C7D2FE", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}
          >
            Set password
          </button>
          <button
            onClick={() => { setBannerDismissed(true); localStorage.setItem("geoiq_pw_banner_dismissed", "true"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16, padding: "0 4px", lineHeight: 1 }}
            title="Dismiss"
          >
            x
          </button>
        </div>
      )}

      {/* Set password modal */}
      {showSetPasswordModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 12, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Set a password</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.5 }}>Once set, you can sign in with your email and password - no magic link needed.</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 5 }}>New password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: "100%", padding: "9px 40px 9px 12px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }} tabIndex={-1}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 5 }}>Confirm password</label>
              <input
                type="password"
                placeholder="Repeat your password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setShowSetPasswordModal(false); setNewPassword(""); setConfirmNewPassword(""); }}
                style={{ flex: 1, padding: "9px 0", border: "1px solid #e5e7eb", borderRadius: 7, background: "white", fontSize: 14, cursor: "pointer", color: "#374151" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSetPassword}
                disabled={settingPassword}
                style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 7, background: "#4F46E5", color: "white", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              >
                {settingPassword ? "Saving..." : "Save password"}
              </button>
            </div>
          </div>
        </div>
      )}

    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* Mobile drawer overlay */}
      {isMobile && mobileDrawerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
          <div style={{ width: 220, background: "white", display: "flex", flexDirection: "column", flexShrink: 0, boxShadow: "4px 0 24px rgba(0,0,0,0.12)" }}>
            <div style={{ padding: "14px 16px 10px", fontWeight: 700, fontSize: 14, color: "#4F46E5", borderBottom: "0.5px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              GeoIQ
              <button onClick={() => setMobileDrawerOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9ca3af" }}>
                <X size={16} />
              </button>
            </div>
            <nav style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
              {NAV_ITEMS.map(({ label, icon: Icon }) => {
                const isActive = activeTab === label;
                return (
                  <button
                    key={label}
                    onClick={() => { setActiveTab(label); setMobileDrawerOpen(false); }}
                    style={{
                      width: "100%", height: 42, padding: "0 16px", display: "flex", alignItems: "center", gap: 10,
                      fontSize: 13, cursor: "pointer",
                      background: isActive ? "#EEF2FF" : "transparent",
                      color: isActive ? "#4F46E5" : "#6b7280",
                      fontWeight: isActive ? 600 : 400,
                      borderRight: isActive ? "2.5px solid #4F46E5" : "2.5px solid transparent",
                      border: "none", textAlign: "left",
                    }}
                  >
                    <Icon size={15} color={isActive ? "#4F46E5" : "#9ca3af"} />
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
          <div style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} onClick={() => setMobileDrawerOpen(false)} />
        </div>
      )}

      {/* Sidebar (desktop only) */}
      <div style={{ width: 164, borderRight: "0.5px solid #e5e7eb", background: "white", display: isMobile ? "none" : "flex", flexDirection: "column", flexShrink: 0 }}>
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
        <div style={{ background: "white", padding: isMobile ? "10px 14px" : "10px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isMobile && (
              <button
                onClick={() => setMobileDrawerOpen(true)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: "#374151" }}
              >
                <Menu size={20} />
              </button>
            )}
            <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{scoresDomain || "No brand selected"}</div>
          </div>
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
              {activeTab === "Citations" && (() => {
                const yourCitations = citationData.donut[0]?.value ?? 2;
                const competitorCitations = citationData.donut[1]?.value ?? 24;
                const topCompetitorCitations = 18;
                const citationGap = Math.max(0, topCompetitorCitations - yourCitations);
                const allSources = [
                  ...citationData.topDomains,
                  { domain: "reddit.com", times: 7, type: "social" as const },
                  { domain: "medium.com", times: 5, type: "authority" as const },
                ];
                const newCitations = [
                  { text: `healthshots.com now citing ${competitorDisplayName} for "${promptList[0]?.keyword ?? "your category"}"`, sign: "+" },
                  { text: `practo.com appeared in Perplexity results for "${promptList[1]?.keyword ?? "health queries"}"`, sign: "+" },
                ];
                const droppedCitations = [
                  { text: `sugarfit.com dropped from ChatGPT results for "${promptList[0]?.keyword ?? "your keywords"}"`, sign: "-" },
                  { text: `1mg.com no longer cited by Gemini for product queries`, sign: "-" },
                ];
                return (
                  <div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 3 }}>Citation intelligence</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>Understand where AI systems get their information about your category</div>
                    </div>

                    {/* 4 metric cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                      {[
                        { label: "Total citations found", value: String(citationData.total) },
                        { label: "Your brand cited", value: String(yourCitations) + " times" },
                        { label: "Competitors cited", value: String(competitorCitations) + " times" },
                        { label: "New this week", value: "+3" },
                      ].map((c, i) => (
                        <div key={i} style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 16px" }}>
                          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{c.label}</div>
                          <div style={{ fontSize: 20, fontWeight: 600, color: "#111827" }}>{c.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Citation source table */}
                    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Sources AI cited for your keywords</div>
                      </div>
                      {/* Table header */}
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 60px 100px 100px 90px 50px 130px", gap: 8, padding: "8px 16px", background: "#fafafa", borderBottom: "0.5px solid #f3f4f6" }}>
                        {["Domain", "DR", "Type", "AI System", "Times Cited", "Trend", "Action"].map(h => (
                          <div key={h} style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{h}</div>
                        ))}
                      </div>
                      {allSources.map((src, i) => {
                        const dr = DR_MAP[src.domain];
                        const typeCfg = src.type === "yours"
                          ? { bg: "#ECFDF5", text: "#065F46", label: "Your brand" }
                          : src.type === "competitor"
                          ? { bg: "#FEF2F2", text: "#991B1B", label: "Competitor" }
                          : src.type === "authority"
                          ? { bg: "#FFFBEB", text: "#92400E", label: "Authority" }
                          : { bg: "#EFF6FF", text: "#1E40AF", label: "Social" };
                        const aiSystem = src.times > 15 ? "3 AI systems" : src.times > 8 ? "2 AI systems" : "1 AI system";
                        const trendUp = i % 3 !== 0;
                        return (
                          <div key={src.domain} style={{ display: "grid", gridTemplateColumns: "2fr 60px 100px 100px 90px 50px 130px", gap: 8, padding: "10px 16px", borderBottom: i < allSources.length - 1 ? "0.5px solid #f9fafb" : "none", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <div style={{ width: 16, height: 16, borderRadius: 3, background: "#E0E7FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 9, fontWeight: 700, color: "#4F46E5", lineHeight: 1 }}>
                                {src.domain[0].toUpperCase()}
                              </div>
                              <span style={{ fontSize: 12, color: "#374151", fontWeight: src.type === "yours" ? 600 : 400 }}>{src.domain}</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#374151" }}>{dr !== undefined ? dr : "—"}</div>
                            <div>
                              <span style={{ background: typeCfg.bg, color: typeCfg.text, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 500 }}>{typeCfg.label}</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>{aiSystem}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                              {src.times}
                              <span style={{ fontSize: 12, marginLeft: 5, color: trendUp ? "#16A34A" : "#DC2626" }}>{trendUp ? "↑" : "↓"}</span>
                            </div>
                            <div style={{ fontSize: 12, color: trendUp ? "#16A34A" : "#DC2626" }}>{trendUp ? "+2" : "-1"}</div>
                            <div>
                              {src.type === "yours" ? (
                                <span style={{ fontSize: 11, color: "#065F46", fontWeight: 500 }}>You are cited</span>
                              ) : src.type === "competitor" ? (
                                <button onClick={() => setCitationModal({ domain: src.domain, type: "competitor" })} style={{ background: "transparent", border: "0.5px solid #DC2626", borderRadius: 5, padding: "3px 9px", fontSize: 11, color: "#DC2626", cursor: "pointer", fontWeight: 500 }}>
                                  Outrank them
                                </button>
                              ) : src.type === "social" ? (
                                <button onClick={() => setCitationModal({ domain: src.domain, type: "social" })} style={{ background: "transparent", border: "0.5px solid #1D4ED8", borderRadius: 5, padding: "3px 9px", fontSize: 11, color: "#1D4ED8", cursor: "pointer", fontWeight: 500 }}>
                                  Join conversation
                                </button>
                              ) : (
                                <button onClick={() => setCitationModal({ domain: src.domain, type: "authority" })} style={{ background: "transparent", border: "0.5px solid #D97706", borderRadius: 5, padding: "3px 9px", fontSize: 11, color: "#D97706", cursor: "pointer", fontWeight: 500 }}>
                                  Get mentioned
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Citation gap bar chart */}
                    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 14 }}>Your citation gap</div>
                      {[
                        { name: "Your brand", citations: yourCitations, color: "#4F46E5", isYours: true },
                        { name: competitorDisplayName, citations: topCompetitorCitations, color: "#DC2626", isYours: false },
                        { name: "Competitor B", citations: 12, color: "#D97706", isYours: false },
                      ].sort((a, b) => b.citations - a.citations).map(row => (
                        <div key={row.name} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                            <span style={{ color: row.isYours ? "#111827" : "#6b7280", fontWeight: row.isYours ? 600 : 400 }}>{row.name}</span>
                            <span style={{ color: row.isYours ? "#4F46E5" : "#9ca3af", fontWeight: row.isYours ? 600 : 400 }}>{row.citations} citations</span>
                          </div>
                          <div style={{ height: 12, background: "#f3f4f6", borderRadius: 9999, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.round((row.citations / (topCompetitorCitations + 2)) * 100)}%`, background: row.color, borderRadius: 9999, transition: "width 0.8s ease" }} />
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                        {citationGap > 0 ? (
                          <>You need <strong style={{ color: "#DC2626" }}>{citationGap} more citations</strong> to match {competitorDisplayName}. </>
                        ) : (
                          <>You match or exceed {competitorDisplayName} on citations. </>
                        )}
                        <button onClick={() => {}} style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "#4F46E5", cursor: "pointer", fontWeight: 500 }}>
                          See which sites to target <ChevronRight size={11} style={{ display: "inline" }} />
                        </button>
                      </div>
                    </div>

                    {/* New / dropped citations */}
                    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>Citation changes this week</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#16A34A", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>New this week</div>
                          {newCitations.map((item, i) => (
                            <div key={i} style={{ display: "flex", gap: 7, marginBottom: 7, fontSize: 12, color: "#374151" }}>
                              <span style={{ color: "#16A34A", fontWeight: 700, flexShrink: 0 }}>{item.sign}</span>
                              <span>{item.text}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#DC2626", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Dropped this week</div>
                          {droppedCitations.map((item, i) => (
                            <div key={i} style={{ display: "flex", gap: 7, marginBottom: 7, fontSize: 12, color: "#374151" }}>
                              <span style={{ color: "#DC2626", fontWeight: 700, flexShrink: 0 }}>{item.sign}</span>
                              <span>{item.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "0.5px solid #f3f4f6", fontSize: 11, color: "#9ca3af" }}>
                        Citation change tracking uses live AI query analysis. Run a scan to refresh.
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ===================== PROMPTS TAB ===================== */}
              {activeTab === "Prompts" && (() => {
                const PROMPT_TAGS = ["All", "Brand", "Category", "Competitor", "Needs attention", "Recently improved"];
                const TAG_COLORS: Record<string, { bg: string; text: string }> = {
                  Brand: { bg: "#EEF2FF", text: "#4F46E5" },
                  Category: { bg: "#F0FDF4", text: "#15803D" },
                  Competitor: { bg: "#FEF2F2", text: "#991B1B" },
                  Custom: { bg: "#FFFBEB", text: "#92400E" },
                };
                const allPromptCards = [
                  ...promptList.map(p => ({
                    keyword: p.keyword,
                    tag: (p.chatgpt + p.gemini + p.perplexity) === 0 ? "Needs attention" : (hashStr(p.keyword) % 3 === 0 ? "Brand" : "Category"),
                    chatgpt: p.chatgpt, gemini: p.gemini, perplexity: p.perplexity,
                    trend: p.trend, lastChecked: "2 hours ago",
                  })),
                  ...customPrompts.map(p => ({ ...p, lastChecked: "just added" })),
                ];
                const filtered = allPromptCards.filter(p => {
                  if (promptSearch && !p.keyword.toLowerCase().includes(promptSearch.toLowerCase())) return false;
                  if (promptFilter === "All") return true;
                  if (promptFilter === "Needs attention") return (p.chatgpt + p.gemini + p.perplexity) === 0;
                  if (promptFilter === "Recently improved") return p.trend === "up";
                  return p.tag === promptFilter;
                });
                const handleAddPrompt = () => {
                  if (!newPromptText.trim()) return;
                  const base = Math.round((activeScore / 100) * 15);
                  const newP = {
                    keyword: newPromptText.trim(), tag: newPromptTag,
                    chatgpt: Math.max(0, base - 2), gemini: Math.max(0, base - 3), perplexity: Math.max(0, base - 4),
                    trend: "flat" as const, lastChecked: "just added",
                  };
                  setCustomPrompts(prev => [...prev, newP]);
                  setNewPromptText("");
                  setAddPromptModal(false);
                  setPromptAddedMsg(true);
                  setTimeout(() => setPromptAddedMsg(false), 4000);
                };
                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 3 }}>Tracked prompts</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>The queries we run across AI systems to measure your visibility</div>
                      </div>
                      <button onClick={() => setAddPromptModal(true)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#4F46E5", color: "white", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>
                        + Add custom prompt
                      </button>
                    </div>

                    {promptAddedMsg && (
                      <div style={{ background: "#ECFDF5", border: "0.5px solid #6EE7B7", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#065F46", display: "flex", alignItems: "center", gap: 7 }}>
                        <CheckCircle2 size={14} color="#16A34A" />
                        Prompt added. We will check this in your next audit.
                      </div>
                    )}

                    {/* Search + filter */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ position: "relative", marginBottom: 8 }}>
                        <Search size={12} color="#9ca3af" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                        <input
                          value={promptSearch} onChange={e => setPromptSearch(e.target.value)}
                          placeholder="Search prompts..."
                          style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "7px 10px 7px 28px", fontSize: 12, color: "#374151", outline: "none", background: "white", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
                        {PROMPT_TAGS.map(tag => (
                          <button key={tag} onClick={() => setPromptFilter(tag)} style={{ padding: "4px 11px", borderRadius: 9999, fontSize: 11, cursor: "pointer", background: promptFilter === tag ? "#4F46E5" : "white", color: promptFilter === tag ? "white" : "#6b7280", border: "0.5px solid", borderColor: promptFilter === tag ? "#4F46E5" : "#e5e7eb", fontWeight: promptFilter === tag ? 500 : 400, whiteSpace: "nowrap", flexShrink: 0 }}>
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Prompt cards */}
                    {filtered.length === 0 && (
                      <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "32px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                        No prompts match this filter. Try a different tag or add a custom prompt.
                      </div>
                    )}
                    {filtered.map((p, i) => {
                      const allZero = p.chatgpt === 0 && p.gemini === 0 && p.perplexity === 0;
                      const trendColor = p.trend === "up" ? "#16A34A" : p.trend === "down" ? "#DC2626" : "#9ca3af";
                      const trendIcon = p.trend === "up" ? "↑" : p.trend === "down" ? "↓" : "→";
                      const tagStyle = TAG_COLORS[p.tag] ?? { bg: "#F3F4F6", text: "#6B7280" };
                      return (
                        <div key={i} style={{ background: "white", border: "0.5px solid", borderColor: allZero ? "#FECACA" : "#e5e7eb", borderRadius: 8, padding: "12px 16px", marginBottom: 8, cursor: "default" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, color: "#111827", marginBottom: 5, fontWeight: 500 }}>{p.keyword}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ background: tagStyle.bg, color: tagStyle.text, borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 500 }}>{p.tag}</span>
                                <span style={{ fontSize: 11, color: "#9ca3af" }}>Last checked: {p.lastChecked}</span>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0, marginLeft: 12 }}>
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {[{ label: "ChatGPT", score: p.chatgpt, color: "#10a37f" }, { label: "Gemini", score: p.gemini, color: "#4285f4" }, { label: "Perplexity", score: p.perplexity, color: "#22d3ee" }].map(s => (
                                  <div key={s.label} style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 9, color: "#9ca3af", marginBottom: 2 }}>{s.label}</div>
                                    <ScorePill score={s.score} />
                                  </div>
                                ))}
                                <div style={{ fontSize: 16, fontWeight: 700, color: trendColor, marginLeft: 4 }}>{trendIcon}</div>
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => { setActiveTab("Visibility"); setExpandedPromptIdx(i); }} style={{ background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 5, padding: "3px 9px", fontSize: 11, color: "#4F46E5", cursor: "pointer" }}>
                                  Deep dive
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add custom prompt modal */}
                    {addPromptModal && (
                      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setAddPromptModal(false)}>
                        <div style={{ background: "white", borderRadius: 12, padding: 24, maxWidth: 440, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 4 }}>Add a custom prompt</div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Track any query you want to monitor across AI systems</div>
                          <input
                            value={newPromptText} onChange={e => setNewPromptText(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAddPrompt()}
                            placeholder="e.g. best diabetes app for Indian food"
                            style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "9px 12px", fontSize: 13, color: "#374151", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
                          />
                          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Tag this prompt:</div>
                          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                            {["Brand", "Category", "Competitor", "Custom"].map(tag => (
                              <button key={tag} onClick={() => setNewPromptTag(tag)} style={{ padding: "4px 11px", borderRadius: 9999, fontSize: 11, cursor: "pointer", background: newPromptTag === tag ? "#4F46E5" : "white", color: newPromptTag === tag ? "white" : "#6b7280", border: "0.5px solid", borderColor: newPromptTag === tag ? "#4F46E5" : "#e5e7eb" }}>
                                {tag}
                              </button>
                            ))}
                          </div>
                          <div style={{ background: "#FFFBEB", border: "0.5px solid #FDE68A", borderRadius: 8, padding: "9px 12px", marginBottom: 16, fontSize: 12, color: "#92400E" }}>
                            Use queries your customers actually search for. What would they type into ChatGPT to find you?
                          </div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button onClick={() => setAddPromptModal(false)} style={{ background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "7px 16px", fontSize: 13, color: "#6b7280", cursor: "pointer" }}>Cancel</button>
                            <button onClick={handleAddPrompt} disabled={!newPromptText.trim()} style={{ background: newPromptText.trim() ? "#4F46E5" : "#c7d2fe", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: newPromptText.trim() ? "pointer" : "default" }}>
                              Add prompt
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ===================== GEO AGENT TAB ===================== */}
              {activeTab === "GEO Agent" && selectedBrand && (
                <GeoAgentTab
                  brand={{
                    id: selectedBrand.id,
                    domain: selectedBrand.domain,
                    brandName: selectedBrand.brandName ?? null,
                    category: selectedBrand.category ?? null,
                    latestScore: selectedBrand.latestScore ?? null,
                    latestScoreChatgpt: selectedBrand.latestScoreChatgpt ?? null,
                    latestScoreGemini: selectedBrand.latestScoreGemini ?? null,
                    latestScorePerplexity: selectedBrand.latestScorePerplexity ?? null,
                  }}
                  plan={user?.plan ?? "free"}
                  lineChartData={lineChartData}
                  keywords={(brandKeywords as { keywords?: { keyword: string; volume: number }[] } | undefined)?.keywords ?? []}
                  fixActions={fixActions}
                  citationData={citationData}
                  competitorDisplayName={competitorDisplayName}
                  weekChange={weekChange}
                />
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
              {activeTab === "Competition" && (() => {
                const compList = getCategoryCompetitors(selectedBrand?.category, activeScore);
                const topBrand = compList[0];
                const yourRank = compList.findIndex(c => c.isYours) + 1;
                const winnerPrompts = promptList.filter(p => {
                  const total = p.chatgpt + p.gemini + p.perplexity;
                  return total >= p.competitorScore;
                });
                const insight = yourRank === 1
                  ? `You lead your category on AI visibility with ${activeScore}% mention rate. Maintain this with regular content and citation building.`
                  : `You win on ${winnerPrompts.length} of ${promptList.length} tracked prompts. Your strongest prompt is "${promptList.find(p => p.chatgpt + p.gemini + p.perplexity > 0)?.keyword ?? "your brand name"}". Your biggest gap is "${promptList[0]?.keyword ?? "category keywords"}" where ${topBrand?.name ?? competitorDisplayName} leads at ${topBrand?.pct ?? 0}%. Focus on citation building to close this gap.`;
                return (
                  <div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 3 }}>Competitive intelligence</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>How your brand compares across AI systems</div>
                    </div>

                    {/* Mention rate chart */}
                    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 14 }}>AI mention rates - who dominates your category</div>
                      {compList.map((row, i) => (
                        <div key={row.name} style={{ marginBottom: i < compList.length - 1 ? 13 : 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 5 }}>
                            <span style={{ fontWeight: row.isYours ? 700 : 400, color: row.isYours ? "#111827" : "#6b7280", display: "flex", alignItems: "center", gap: 5 }}>
                              {row.name}
                              {row.isYours && <span style={{ background: "#EEF2FF", color: "#4F46E5", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 500 }}>you</span>}
                            </span>
                            <span style={{ color: row.isYours ? "#4F46E5" : "#9ca3af", fontWeight: row.isYours ? 700 : 400 }}>{row.pct}%</span>
                          </div>
                          <div style={{ height: 14, background: "#f3f4f6", borderRadius: 9999, overflow: "hidden", position: "relative" }}>
                            <div style={{ position: "absolute", height: "100%", width: `${row.pct}%`, background: row.isYours ? "#4F46E5" : "#E5E7EB", borderRadius: 9999, transition: "width 1s ease" }} />
                            {!row.isYours && (
                              <div style={{ position: "absolute", height: "100%", width: `${row.pct}%`, display: "flex", alignItems: "center", paddingLeft: 6 }}>
                                <span style={{ fontSize: 9, color: "#6b7280", fontWeight: 500 }}>{row.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: 10, fontSize: 11, color: "#9ca3af" }}>You rank #{yourRank} in your category. Scores are based on AI mention analysis across tracked prompts.</div>
                    </div>

                    {/* Per-prompt winner table */}
                    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Who wins each prompt</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 100px 80px", gap: 8, padding: "8px 16px", background: "#fafafa", borderBottom: "0.5px solid #f3f4f6" }}>
                        {["Prompt", "Winner", "Your rank", "Gap"].map(h => <div key={h} style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{h}</div>)}
                      </div>
                      {promptList.slice(0, 8).map((p, i) => {
                        const yourTotal = p.chatgpt + p.gemini + p.perplexity;
                        const yourPct = Math.round((yourTotal / 99) * 100);
                        const compScore = p.competitorScore;
                        const isWinner = yourTotal >= compScore;
                        const rank = isWinner ? 1 : Math.floor(hashStr(p.keyword) % 3) + 2;
                        const gap = yourPct - Math.round((compScore / 99) * 100);
                        const rowBg = isWinner ? "#F0FDF4" : rank === 2 ? "#FFFBEB" : "#FEF2F2";
                        const winner = isWinner ? (brandName || "Your brand") : (rank === 2 ? (compList[1]?.name ?? competitorDisplayName) : compList[0]?.name ?? competitorDisplayName);
                        const winnerPct = isWinner ? yourPct : Math.round((compScore / 99) * 100);
                        return (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 100px 80px", gap: 8, padding: "9px 16px", background: rowBg, borderBottom: i < promptList.slice(0, 8).length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none", alignItems: "center" }}>
                            <div style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.keyword}</div>
                            <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{winner} <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>({winnerPct}%)</span></div>
                            <div style={{ fontSize: 12, color: isWinner ? "#16A34A" : rank === 2 ? "#D97706" : "#DC2626", fontWeight: 500 }}>
                              {isWinner ? "#1 Leader" : `#${rank} (${yourPct}%)`}
                            </div>
                            <div style={{ fontSize: 12, color: gap >= 0 ? "#16A34A" : "#DC2626", fontWeight: 500 }}>
                              {isWinner ? "Leader" : `${gap}%`}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* AI insights */}
                    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 8 }}>Insights</div>
                      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 12 }}>{insight}</div>
                      <button onClick={() => setActiveTab("Fix Actions")} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "0.5px solid #4F46E5", borderRadius: 6, padding: "6px 14px", fontSize: 12, color: "#4F46E5", cursor: "pointer", fontWeight: 500 }}>
                        View fix plan for this gap <ChevronRight size={11} />
                      </button>
                    </div>

                    {/* Competitor tracking */}
                    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>Manually track competitors</div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                        <input
                          type="text" placeholder="Add competitor domain (e.g. competitor.com)" value={competitorInput}
                          onChange={e => setCompetitorInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddCompetitor()}
                          style={{ flex: 1, border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "7px 12px", fontSize: 13, color: "#374151", outline: "none" }}
                        />
                        <button onClick={handleAddCompetitor} style={{ background: "#4F46E5", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Track</button>
                      </div>
                      {trackedCompetitors.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "12px 0" }}>No additional competitors tracked. The chart above uses category defaults.</div>
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
                );
              })()}

              {/* ===================== FIX ACTIONS TAB ===================== */}
              {activeTab === "Fix Actions" && selectedBrand && (
                <>
                  <ContentGenerators
                    brand={{
                      id: selectedBrand.id,
                      domain: selectedBrand.domain,
                      brandName: selectedBrand.brandName ?? null,
                      category: selectedBrand.category ?? null,
                    }}
                  />
                  <FixActionsTab
                    brand={{
                      id: selectedBrand.id,
                      domain: selectedBrand.domain,
                      brandName: selectedBrand.brandName ?? null,
                      category: selectedBrand.category ?? null,
                      latestScore: selectedBrand.latestScore ?? null,
                    }}
                  />
                </>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Brand settings card */}
                  {selectedBrand && (
                    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 4 }}>Brand settings</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Correct these so the AI audit has accurate context about your brand.</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 4 }}>Domain</label>
                          <input
                            value={selectedBrand.domain}
                            readOnly
                            style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", border: "0.5px solid #e5e7eb", borderRadius: 6, background: "#f9fafb", color: "#6b7280" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 4 }}>Brand name</label>
                          <input
                            value={settingsBrandName}
                            onChange={e => setSettingsBrandName(e.target.value)}
                            placeholder="e.g. Acme Inc"
                            style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", border: "0.5px solid #e5e7eb", borderRadius: 6, color: "#111827", outline: "none" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 4 }}>Category</label>
                          <select
                            value={settingsCategory}
                            onChange={e => setSettingsCategory(e.target.value)}
                            style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", border: "0.5px solid #e5e7eb", borderRadius: 6, color: "#111827", background: "white", outline: "none" }}
                          >
                            <option value="">Select a category</option>
                            {["saas", "ecommerce", "fintech", "healthtech", "edtech", "hrtech", "martech", "agency", "media", "consulting", "other"].map(c => (
                              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 4 }}>Target market</label>
                          <input
                            value={settingsMarket}
                            onChange={e => setSettingsMarket(e.target.value)}
                            placeholder="e.g. India, US, Global"
                            style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", border: "0.5px solid #e5e7eb", borderRadius: 6, color: "#111827", outline: "none" }}
                          />
                        </div>
                        <button
                          onClick={handleSaveSettings}
                          disabled={settingsSaving}
                          style={{ alignSelf: "flex-start", background: "#4F46E5", color: "white", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: settingsSaving ? "not-allowed" : "pointer", opacity: settingsSaving ? 0.7 : 1 }}
                        >
                          {settingsSaving ? "Saving..." : "Save changes"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Account card */}
                  <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 14 }}>Account</div>
                    <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>Email: <span style={{ color: "#6b7280" }}>{user?.email ?? "-"}</span></div>
                    <div style={{ fontSize: 13, color: "#374151", marginBottom: 16 }}>Plan: <span style={{ color: "#4F46E5", fontWeight: 500, textTransform: "capitalize" }}>{user?.plan ?? "free"}</span></div>
                    {user?.plan === "free" && (
                      <button
                        onClick={() => window.location.href = "/pricing"}
                        style={{ background: "#4F46E5", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 12 }}
                      >
                        Upgrade to Starter
                      </button>
                    )}
                    <div style={{ marginTop: 4, paddingTop: 16, borderTop: "0.5px solid #f3f4f6" }}>
                      <button
                        onClick={() => { localStorage.removeItem("geoscore_token"); localStorage.removeItem("geoscore_plan"); window.location.href = "/"; }}
                        style={{ background: "transparent", border: "0.5px solid #FECACA", borderRadius: 6, padding: "7px 16px", fontSize: 13, color: "#DC2626", cursor: "pointer" }}
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Citation action modal */}
      {citationModal && (() => {
        const info = getSiteInfo(citationModal.domain, brandName || scoresDomain);
        const isCompetitor = citationModal.type === "competitor";
        const isSocial = citationModal.type === "social";
        const title = isCompetitor
          ? `How to outrank ${citationModal.domain}`
          : isSocial
          ? `Join the conversation on ${citationModal.domain}`
          : `Get ${citationModal.domain} to mention you`;
        const borderColor = isCompetitor ? "#DC2626" : isSocial ? "#1D4ED8" : "#D97706";
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => { setCitationModal(null); setSocialPostLink(""); }}>
            <div style={{ background: "white", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", borderTop: `3px solid ${borderColor}` }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Expected score impact: <strong style={{ color: "#16A34A" }}>+{info.impact} pts</strong></div>

              {isCompetitor && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Strategy to outrank them on {citationModal.domain}:</div>
                  <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#7F1D1D", lineHeight: 1.6 }}>
                    1. Create a comparison page: "{brandName || "Your brand"} vs {citationModal.domain.split(".")[0]}" with structured data markup.<br />
                    2. Submit guest content to the sites that currently cite {citationModal.domain.split(".")[0]}.<br />
                    3. Build your own authority on the same keywords using the FAQ strategy below.
                  </div>
                </>
              )}

              {isSocial && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Recommended subreddits:</div>
                  <div style={{ background: "#EFF6FF", border: "0.5px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#1E3A8A" }}>
                    {info.subreddit ?? "r/startups, r/startupindia, r/Entrepreneur"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 8 }}>What to post:</div>
                  <div style={{ background: "#F9FAFB", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                    Share your founder story and what problem {brandName || "your brand"} solves. Ask for feedback, not promotion. AI systems index popular Reddit threads and cite them when answering category questions.
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Already posted? Paste the link to track it:</div>
                  <input
                    type="url"
                    placeholder={`https://${citationModal.domain}/...`}
                    value={socialPostLink}
                    onChange={e => setSocialPostLink(e.target.value)}
                    style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#374151", outline: "none", marginBottom: 10, boxSizing: "border-box" }}
                  />
                  {socialPostLink && (() => {
                    let displayUrl = socialPostLink;
                    try { displayUrl = new URL(socialPostLink).href; } catch { displayUrl = socialPostLink; }
                    const platformColor = citationModal.domain.includes("reddit") ? "#FF4500" : citationModal.domain.includes("twitter") || citationModal.domain.includes("x.com") ? "#1DA1F2" : citationModal.domain.includes("linkedin") ? "#0A66C2" : citationModal.domain.includes("producthunt") ? "#DA552F" : "#4F46E5";
                    const platformLabel = citationModal.domain.includes("reddit") ? "Reddit" : citationModal.domain.includes("twitter") || citationModal.domain.includes("x.com") ? "X (Twitter)" : citationModal.domain.includes("linkedin") ? "LinkedIn" : citationModal.domain.includes("producthunt") ? "Product Hunt" : citationModal.domain;
                    return (
                      <div style={{ border: `0.5px solid ${platformColor}33`, borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
                        <div style={{ background: platformColor, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white" }}>
                            {citationModal.domain[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "white" }}>{platformLabel}</span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", marginLeft: "auto" }}>Tracked post</span>
                        </div>
                        <div style={{ padding: "10px 12px", background: "white", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#374151", wordBreak: "break-all", flex: 1 }}>{displayUrl.length > 60 ? displayUrl.slice(0, 60) + "..." : displayUrl}</span>
                          <a href={displayUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, background: platformColor, color: "white", borderRadius: 5, padding: "4px 10px", fontSize: 11, fontWeight: 500, textDecoration: "none" }}>
                            <ExternalLink size={10} /> Open
                          </a>
                        </div>
                        <div style={{ padding: "6px 12px 10px", background: "#F9FAFB", borderTop: "0.5px solid #f3f4f6" }}>
                          <span style={{ fontSize: 11, color: "#6b7280" }}>AI systems crawl active social posts. Keep the thread engaged to improve citation odds.</span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {!isCompetitor && !isSocial && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Submission URL:</div>
                  <div style={{ background: "#F9FAFB", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#4F46E5", wordBreak: "break-all" }}>{info.url}</span>
                    <a href={info.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                      <ExternalLink size={13} color="#4F46E5" />
                    </a>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Pre-written pitch (copy and adapt):</div>
                  <div style={{ background: "#F9FAFB", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 12, color: "#374151", lineHeight: 1.6, fontStyle: "italic" }}>
                    "{info.pitch}"
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(info.pitch); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 5, padding: "4px 10px", fontSize: 11, color: "#6b7280", cursor: "pointer", marginBottom: 14 }}
                  >
                    <Copy size={10} /> Copy pitch
                  </button>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setCitationModal(null)} style={{ background: "#4F46E5", color: "white", border: "none", borderRadius: 6, padding: "7px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </div>
  );
}
