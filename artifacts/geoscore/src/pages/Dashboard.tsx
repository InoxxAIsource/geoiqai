import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, useGetMonitoredBrands, useGetBrandScores, useGetBrandKeywords, useAddBrandKeyword, useAddMonitoredBrand, useRemoveMonitoredBrand, getGetMonitoredBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getToken, getPlan } from "@/lib/auth";
import { BarChart2, Users, Search, TrendingUp, MessageSquare, HelpCircle, Radio, FileText, Bot, Layers, Plus, ChevronDown, LogOut, Settings, Globe, Megaphone, Rocket, Menu, X } from "lucide-react";
import { VisibilityOverview } from "./dashboard/VisibilityOverview";
import { CompetitorResearch } from "./dashboard/CompetitorResearch";
import { PromptResearch } from "./dashboard/PromptResearch";
import { BrandPerformanceSection } from "./dashboard/BrandPerformanceSection";
import { SiteAuditSection } from "./dashboard/SiteAuditSection";
import { PromptTracking } from "./dashboard/PromptTracking";
import { ContentCreation } from "./dashboard/ContentCreation";
import { GeoAgentTab } from "./dashboard/GeoAgentTab";
import { ContentImprovementsTab } from "./dashboard/ContentImprovementsTab";
import { AiPRTab } from "./dashboard/AiPRTab";
import { GeoSprint } from "./dashboard/GeoSprint";

setAuthTokenGetter(getToken);

const P = "#4F46E5";
const BORDER = "#e8eaef";
const MUTED = "#64748b";
const BG = "#f8f9fc";
const TEXT_PRIMARY = "#0f172a";
const TEXT_TERTIARY = "#94a3b8";
const SIDEBAR_W = 220;
const BRAND_LIGHT = "#eef2ff";
const BRAND_TEXT = "#4338ca";

type NavId =
  | "visibility-overview" | "competitor-research" | "prompt-research"
  | "brand-performance" | "site-audit" | "prompt-tracking"
  | "content-creation" | "geo-agent" | "content-improvements"
  | "ai-pr" | "settings" | "geo-sprint";

interface NavItem { id: NavId; label: string; icon: React.ReactNode }
interface NavSection { section: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    section: "AI Visibility",
    items: [
      { id: "visibility-overview", label: "AI Presence", icon: <BarChart2 size={15} /> },
      { id: "competitor-research", label: "Brand Benchmarks", icon: <Users size={15} /> },
      { id: "prompt-research", label: "Prompt Intelligence", icon: <Search size={15} /> },
    ],
  },
  {
    section: "Brand Signals",
    items: [
      { id: "brand-performance", label: "Signal Tracker", icon: <TrendingUp size={15} /> },
    ],
  },
  {
    section: "Optimize and Track",
    items: [
      { id: "prompt-tracking", label: "Answer Monitoring", icon: <Radio size={15} /> },
      { id: "content-creation", label: "AI Content Studio", icon: <FileText size={15} /> },
    ],
  },
  {
    section: "GEO Toolkit",
    items: [
      { id: "geo-sprint", label: "GEO Sprint", icon: <Rocket size={15} /> },
      { id: "geo-agent", label: "GEO Copilot", icon: <Bot size={15} /> },
      { id: "content-improvements", label: "Citation Builder", icon: <Layers size={15} /> },
      { id: "ai-pr", label: "PR Intelligence", icon: <Megaphone size={15} /> },
    ],
  },
];

function isAuthenticated() {
  return !!getToken();
}

function generateFixActions(brand: { domain: string; latestScore?: number | null }) {
  const score = brand.latestScore ?? 40;
  return [
    { id: 1, priority: "High", action: "Add Organization JSON-LD schema", effortHours: 1, impactScore: 8, done: false, cite: "schema.org/Organization" },
    { id: 2, priority: "High", action: "Create an llms.txt summary file", effortHours: 2, impactScore: 7, done: false, cite: "llmstxt.org" },
    { id: 3, priority: "Medium", action: "Get listed on Crunchbase", effortHours: 3, impactScore: 6, done: score > 50, cite: "crunchbase.com" },
    { id: 4, priority: "Medium", action: "Publish a technical blog post", effortHours: 8, impactScore: 5, done: false },
    { id: 5, priority: "Low", action: "Add FAQ structured data", effortHours: 2, impactScore: 4, done: false },
  ];
}

// ─── Landing page config ──────────────────────────────────────────────────

interface LandingConfig {
  category: string;
  headline: string;
  sub: string;
  inputPlaceholder?: string;
  ctaLabel: string;
}

const LANDING_CONFIGS: Partial<Record<NavId, LandingConfig>> = {
  "visibility-overview": {
    category: "AI Visibility",
    headline: "See Where AI Knows Your Brand",
    sub: "Check how ChatGPT, Gemini, Perplexity, Claude, Grok and Google AI Overview describe your brand in 60 seconds.",
    inputPlaceholder: "Enter domain (e.g. yoursite.com)",
    ctaLabel: "Run AI scan",
  },
  "competitor-research": {
    category: "AI Competitor Gap Analysis",
    headline: "Find the Gaps in Your AI Visibility",
    sub: "See how AI platforms position your competitors versus your brand. Uncover topics where rivals get cited but you don't.",
    inputPlaceholder: "Enter your domain",
    ctaLabel: "Run competitor analysis",
  },
  "prompt-research": {
    category: "Discover Trending AI Prompts",
    headline: "Uncover the Prompts Where Your Brand Should Be",
    sub: "Find what questions people ask AI, analyze demand and difficulty, and discover opportunities to boost your visibility in AI conversations.",
    inputPlaceholder: "Enter a topic or domain to analyze",
    ctaLabel: "Analyze",
  },
  "brand-performance": {
    category: "AI Brand Narrative Tracking",
    headline: "See How AI Talks About Your Brand",
    sub: "Uncover how AI platforms describe, position, and talk about your brand. Get a full breakdown of your AI presence across the most influential prompts.",
    inputPlaceholder: "Enter your domain",
    ctaLabel: "Analyze",
  },
  "geo-sprint": {
    category: "30-Day AI Visibility Journey",
    headline: "Go From Invisible to AI-Cited in 30 Days",
    sub: "A research-backed step-by-step plan to get your brand cited by ChatGPT, Gemini and Perplexity. Each step is connected to the right GeoIQ tool.",
    ctaLabel: "Start my sprint",
  },
};

// ─── FeatureLanding component ─────────────────────────────────────────────

function FeatureLanding({
  config,
  inputValue,
  onInputChange,
  onLaunch,
  recentBrands,
}: {
  config: LandingConfig;
  inputValue: string;
  onInputChange: (v: string) => void;
  onLaunch: (domainOverride?: string) => void;
  recentBrands?: Array<{ domain: string; brandName?: string | null }>;
}) {
  const [focused, setFocused] = useState(false);
  const hasInput = !!config.inputPlaceholder;

  return (
    <div style={{
      minHeight: "calc(100vh - 56px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 40px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        width: 700,
        height: 700,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(79,70,229,0.07) 0%, rgba(139,92,246,0.04) 40%, rgba(236,72,153,0.02) 70%, transparent 100%)",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 640, width: "100%" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_TERTIARY, letterSpacing: "0.3px", marginBottom: 16 }}>
          {config.category}
        </div>

        <h1 style={{
          fontSize: 40,
          fontWeight: 800,
          color: TEXT_PRIMARY,
          lineHeight: 1.15,
          letterSpacing: "-0.5px",
          margin: "0 0 16px 0",
        }}>
          {config.headline}
        </h1>

        <p style={{
          fontSize: 16,
          color: MUTED,
          lineHeight: 1.65,
          margin: "0 auto 40px",
          maxWidth: 520,
        }}>
          {config.sub}
        </p>

        {hasInput ? (
          <div style={{ display: "flex", gap: 8, maxWidth: 560, margin: "0 auto" }}>
            <input
              value={inputValue}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onLaunch()}
              placeholder={config.inputPlaceholder}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                flex: 1,
                padding: "13px 18px",
                border: `1.5px solid ${focused ? P : "#d1d5db"}`,
                borderRadius: 10,
                fontSize: 15,
                color: TEXT_PRIMARY,
                background: "white",
                outline: "none",
                boxShadow: focused ? "0 0 0 3px rgba(79,70,229,0.1)" : "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            />
            <button
              onClick={() => onLaunch()}
              style={{ padding: "13px 26px", background: P, color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#3730a3"; }}
              onMouseLeave={e => { e.currentTarget.style.background = P; }}
            >
              {config.ctaLabel}
            </button>
          </div>
        ) : (
          <button
            onClick={() => onLaunch()}
            style={{ padding: "14px 40px", background: P, color: "white", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#3730a3"; }}
            onMouseLeave={e => { e.currentTarget.style.background = P; }}
          >
            {config.ctaLabel}
          </button>
        )}

        {recentBrands && recentBrands.length > 0 && (
          <div style={{ marginTop: 28, fontSize: 13, color: TEXT_TERTIARY, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <span>Recently analyzed:</span>
            {recentBrands.slice(0, 5).map(b => (
              <button
                key={b.domain}
                onClick={() => onLaunch(b.domain)}
                style={{ color: P, background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0 }}
                onMouseEnter={e => { e.currentTarget.style.textDecoration = "underline"; }}
                onMouseLeave={e => { e.currentTarget.style.textDecoration = "none"; }}
              >
                {b.brandName || b.domain}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────

export function Dashboard() {
  const [, setLocation] = useLocation();
  const auth = isAuthenticated();
  const queryClient = useQueryClient();

  const [activeNav, setActiveNav] = useState<NavId>("visibility-overview");
  const [searchDomain, setSearchDomain] = useState("");
  const [geo, setGeo] = useState("in");
  const [period, setPeriod] = useState("1m");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);
  const [newBrandDomain, setNewBrandDomain] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [domainLimitError, setDomainLimitError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [dfStatus, setDfStatus] = useState<"checking" | "connected" | "disconnected" | "error">("checking");
  const [dfBalance, setDfBalance] = useState<number | null>(null);
  const [launchedTabs, setLaunchedTabs] = useState<Set<NavId>>(new Set());
  const [landingDomain, setLandingDomain] = useState("");
  const [hoveredNav, setHoveredNav] = useState<NavId | null>(null);

  const { data: user } = useGetMe({ query: { enabled: auth } as never });
  const { data: brands, isLoading: loadingBrands } = useGetMonitoredBrands({ query: { enabled: auth } as never });
  const addBrandMutation = useAddMonitoredBrand();
  const removeBrandMutation = useRemoveMonitoredBrand();

  const selectedBrand = brands?.find(b => b.id === selectedBrandId) ?? brands?.[0] ?? null;
  const activeDomain = searchDomain || selectedBrand?.domain || "";

  useEffect(() => {
    if (brands && brands.length > 0 && !selectedBrandId) {
      setSelectedBrandId(brands[0]!.id);
      if (!searchDomain) setSearchDomain(brands[0]!.domain ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands]);

  useEffect(() => {
    if (!auth) {
      setLocation("/login?reason=login_required");
      return;
    }
    const plan = getPlan();
    if (!plan || plan === "free") {
      setLocation("/pricing?reason=upgrade_required");
    }
  }, [auth, setLocation]);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setShowMobileSidebar(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setLandingDomain(activeDomain);
  }, [activeDomain]);

  useEffect(() => {
    setLaunchedTabs(new Set());
  }, [selectedBrandId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dataforseo/status")
      .then(r => r.json())
      .then((data: { connected?: boolean; balance?: number | null; hasCredentials?: boolean }) => {
        if (cancelled) return;
        if (data.connected) { setDfStatus("connected"); setDfBalance(data.balance ?? null); }
        else if (data.hasCredentials) setDfStatus("error");
        else setDfStatus("disconnected");
      })
      .catch(() => { if (!cancelled) setDfStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const { data: scores } = useGetBrandScores(selectedBrand?.id ?? "", {
    query: { enabled: !!selectedBrand?.id && auth } as never,
  });

  const { data: brandKeywords } = useGetBrandKeywords(selectedBrand?.id ?? "", {
    query: { enabled: !!selectedBrand?.id && auth } as never,
  });

  const lineChartData = (scores ?? []).slice(-12).map(s => ({
    date: s.date ?? "",
    yours: s.scoreTotal ?? 0,
    competitor: undefined,
  }));

  const keywords = (brandKeywords ?? []).map(k => ({ keyword: k.keyword, volume: 0 }));
  const fixActions = selectedBrand ? generateFixActions(selectedBrand) : [];

  const citationData = {
    donut: [
      { name: "Yours", value: 30, color: P },
      { name: "Authority", value: 45, color: "#10B981" },
      { name: "Competitor", value: 25, color: "#EF4444" },
    ],
    topDomains: [],
  };

  const agentBrand = selectedBrand ? {
    id: selectedBrand.id,
    domain: selectedBrand.domain ?? activeDomain,
    brandName: selectedBrand.brandName ?? null,
    category: selectedBrand.category ?? null,
    latestScore: selectedBrand.latestScore ?? null,
    latestScoreChatgpt: selectedBrand.latestScoreChatgpt ?? null,
    latestScoreGemini: selectedBrand.latestScoreGemini ?? null,
    latestScorePerplexity: selectedBrand.latestScorePerplexity ?? null,
  } : {
    id: "",
    domain: activeDomain,
    brandName: null,
    category: null,
    latestScore: null,
    latestScoreChatgpt: null,
    latestScoreGemini: null,
    latestScorePerplexity: null,
  };

  const handleAddBrand = async () => {
    if (!newBrandDomain.trim()) return;
    setAddingBrand(true);
    try {
      const result = await addBrandMutation.mutateAsync({
        data: { domain: newBrandDomain.trim(), brandName: newBrandName.trim() || null, category: null },
      });
      queryClient.invalidateQueries({ queryKey: getGetMonitoredBrandsQueryKey() });
      setSelectedBrandId(result.id);
      setSearchDomain(result.domain ?? "");
      setNewBrandDomain("");
      setNewBrandName("");
      setShowBrandDropdown(false);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string; limitReached?: boolean } } })?.response?.data?.error ?? null;
      if (message) setDomainLimitError(message);
    }
    finally { setAddingBrand(false); }
  };

  const handleRemoveBrand = async (id: string) => {
    try {
      await removeBrandMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetMonitoredBrandsQueryKey() });
      if (selectedBrandId === id) setSelectedBrandId(null);
    } catch { /* ignore */ }
  };

  const handleSignOut = () => {
    localStorage.removeItem("geoscore_token");
    localStorage.removeItem("geoscore_plan");
    window.location.href = "/";
  };

  function handleLaunch(tabId: NavId, domainOverride?: string) {
    const domain = domainOverride ?? landingDomain;
    if (domain) setSearchDomain(domain);
    setLaunchedTabs(prev => new Set([...prev, tabId]));
  }

  function navigateTo(navId: NavId) {
    setActiveNav(navId);
    setShowBrandDropdown(false);
    setShowMobileSidebar(false);
  }

  function renderContent() {
    const tabId = activeNav;
    const config = LANDING_CONFIGS[tabId];

    if (config && !launchedTabs.has(tabId)) {
      return (
        <FeatureLanding
          config={config}
          inputValue={landingDomain}
          onInputChange={setLandingDomain}
          onLaunch={(domainOverride) => handleLaunch(tabId, domainOverride)}
          recentBrands={brands ?? []}
        />
      );
    }

    switch (tabId) {
      case "visibility-overview":
        return (
          <VisibilityOverview
            domain={activeDomain}
            geo={geo}
            period={period}
            onDomainChange={d => setSearchDomain(d)}
          />
        );

      case "competitor-research":
        return (
          <CompetitorResearch
            initialDomain={activeDomain}
            plan={user?.plan ?? "free"}
            onNavigate={(nav) => navigateTo(nav as NavId)}
          />
        );

      case "prompt-research":
        return <PromptResearch initialDomain={activeDomain} plan={user?.plan ?? "free"} />;

      case "brand-performance":
        return <BrandPerformanceSection domain={activeDomain} />;

      case "site-audit":
        return <SiteAuditSection domain={activeDomain} />;

      case "prompt-tracking":
        return <PromptTracking domain={activeDomain} plan={user?.plan ?? "free"} />;

      case "content-creation":
        return <ContentCreation domain={activeDomain} onNavigate={(nav) => navigateTo(nav as NavId)} />;

      case "geo-agent":
        if (!agentBrand.id) {
          return (
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
              <Bot size={40} color={MUTED} style={{ margin: "0 auto 16px" }} />
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Add a brand to use GEO Agent</div>
              <div style={{ fontSize: 13, color: MUTED }}>Select or add a monitored brand from the sidebar to start a conversation.</div>
            </div>
          );
        }
        return (
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, minHeight: 500 }}>
            <GeoAgentTab
              brand={agentBrand}
              plan={user?.plan ?? "free"}
              lineChartData={lineChartData}
              keywords={keywords}
              fixActions={fixActions}
              citationData={citationData}
              competitorDisplayName="Competitor"
              weekChange={null}
              initialMessage={null}
            />
          </div>
        );

      case "content-improvements":
        return (
          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
            <ContentImprovementsTab
              brand={selectedBrand ? { id: selectedBrand.id, domain: selectedBrand.domain ?? activeDomain, brandName: selectedBrand.brandName ?? null } : null}
            />
          </div>
        );

      case "geo-sprint":
        return (
          <GeoSprint
            domain={activeDomain}
            onNavigate={(nav) => navigateTo(nav as NavId)}
            onOpenCopilot={() => navigateTo("geo-agent")}
          />
        );

      case "ai-pr":
        return (
          <div>
            <div style={{ textAlign: "center", padding: "48px 40px 36px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }} />
              <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_TERTIARY, marginBottom: 12 }}>AI-Powered PR Toolkit</div>
                <h1 style={{ fontSize: 34, fontWeight: 800, color: TEXT_PRIMARY, lineHeight: 1.2, margin: "0 0 12px 0", letterSpacing: "-0.4px" }}>
                  Get Your Brand Covered by AI-Trusted Media
                </h1>
                <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.65, margin: 0 }}>
                  Find journalists covering AI search, pitch with AI-written emails, and monitor coverage - all powered by real-time web intelligence.
                </p>
              </div>
            </div>
            <AiPRTab />
          </div>
        );

      case "settings":
        return <SettingsPage user={user ?? null} onSignOut={handleSignOut} />;

      default:
        return null;
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: BG, fontFamily: "'Sora', sans-serif" }}>

      {/* Mobile backdrop */}
      {isMobile && showMobileSidebar && (
        <div
          onClick={() => setShowMobileSidebar(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 49 }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: SIDEBAR_W,
        flexShrink: 0,
        background: "white",
        borderRight: `1px solid ${BORDER}`,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 50,
        transform: isMobile && !showMobileSidebar ? `translateX(-${SIDEBAR_W}px)` : "translateX(0)",
        transition: "transform 0.25s ease",
      }}>

        {/* Logo */}
        <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${BORDER}` }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <path d="M32 20 A12 12 0 1 1 20 8" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
              <path d="M20 8 L28 8 L28 16" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="20" cy="20" r="2.5" fill="#6366f1"/>
            </svg>
            <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: "-0.04em", color: "#0f172a" }}>
              Geo<span style={{ color: "#6366f1" }}>IQ</span>
            </span>
          </a>
        </div>

        {/* Brand selector */}
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, position: "relative" }}>
          <div
            onClick={() => setShowBrandDropdown(!showBrandDropdown)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: BG, borderRadius: 8, cursor: "pointer", border: `1px solid ${BORDER}` }}
          >
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1 }}>Brand</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 138 }}>
                {selectedBrand?.brandName || selectedBrand?.domain || "Select brand"}
              </div>
            </div>
            <ChevronDown size={14} color={MUTED} style={{ flexShrink: 0, transform: showBrandDropdown ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </div>

          {showBrandDropdown && (
            <div style={{ position: "absolute", left: 12, right: 12, top: "calc(100% - 4px)", background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 200 }}>
              {loadingBrands && <div style={{ padding: "12px 14px", fontSize: 12, color: MUTED }}>Loading...</div>}
              {(brands ?? []).map(b => (
                <div
                  key={b.id}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", cursor: "pointer", background: b.id === selectedBrand?.id ? BRAND_LIGHT : "transparent", borderBottom: `1px solid ${BORDER}` }}
                  onClick={() => { setSelectedBrandId(b.id); setSearchDomain(b.domain ?? ""); setShowBrandDropdown(false); }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{b.brandName || b.domain}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{b.domain}</div>
                  </div>
                  {brands && brands.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); void handleRemoveBrand(b.id); }} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 14, cursor: "pointer", flexShrink: 0, padding: "0 4px" }}>x</button>
                  )}
                </div>
              ))}
              <div style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>Add brand</div>
                <input
                  type="text"
                  placeholder="domain.com"
                  value={newBrandDomain}
                  onChange={e => setNewBrandDomain(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, marginBottom: 5, outline: "none" }}
                />
                <input
                  type="text"
                  placeholder="Brand name (optional)"
                  value={newBrandName}
                  onChange={e => setNewBrandName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && void handleAddBrand()}
                  style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, marginBottom: 8, outline: "none" }}
                />
                <button
                  onClick={() => void handleAddBrand()}
                  disabled={addingBrand || !newBrandDomain.trim()}
                  style={{ width: "100%", padding: "7px", background: P, color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                >
                  <Plus size={12} /> {addingBrand ? "Adding..." : "Add brand"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {NAV.map(section => (
            <div key={section.section} style={{ marginBottom: 2 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                color: TEXT_TERTIARY,
                textTransform: "uppercase",
                letterSpacing: "1px",
                padding: "12px 16px 4px",
              }}>
                {section.section}
              </div>
              {section.items.map(item => {
                const isActive = activeNav === item.id;
                const isHovered = hoveredNav === item.id;
                const isSprint = item.id === "geo-sprint";
                let bg = "transparent";
                if (isActive) bg = BRAND_LIGHT;
                else if (isSprint) bg = "linear-gradient(90deg, #eef2ff 0%, #f8f9ff 100%)";
                else if (isHovered) bg = BG;
                const color = isActive ? BRAND_TEXT : (isSprint || isHovered) ? TEXT_PRIMARY : MUTED;
                const iconColor = isActive ? P : isSprint ? P : isHovered ? MUTED : TEXT_TERTIARY;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id)}
                    onMouseEnter={() => setHoveredNav(item.id)}
                    onMouseLeave={() => setHoveredNav(null)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: isActive || isSprint ? 500 : 400,
                      color,
                      background: bg,
                      border: "none",
                      borderLeft: `2px solid ${isActive ? P : "transparent"}`,
                      cursor: "pointer",
                      transition: "all 0.12s",
                      margin: "1px 0",
                    }}
                  >
                    <span style={{ color: iconColor, flexShrink: 0 }}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Data source status */}
        {dfStatus !== "checking" && (() => {
          const statusMap = {
            connected: { dot: "#10B981", label: "Live data connected", sub: dfBalance != null ? `$${dfBalance.toFixed(2)} balance` : null },
            disconnected: { dot: "#9CA3AF", label: "Data source offline", sub: "Contact support" },
            error: { dot: "#F59E0B", label: "Data source error", sub: "Contact support" },
          } as const;
          const s = statusMap[dfStatus as keyof typeof statusMap];
          return (
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", background: BG, borderRadius: 7, border: `1px solid ${BORDER}` }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                  {s.sub && <div style={{ fontSize: 10, color: MUTED }}>{s.sub}</div>}
                </div>
              </div>
            </div>
          );
        })()}

        {/* User / Settings */}
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: "12px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: P, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {(user?.email?.[0] ?? "U").toUpperCase()}
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email ?? "User"}</div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "capitalize" }}>{user?.plan ?? "free"} plan</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => { navigateTo("settings"); setShowSettings(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 3 }} title="Settings">
                <Settings size={14} />
              </button>
              <button onClick={handleSignOut} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 3 }} title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          </div>
          {user?.plan === "free" && (
            <a href="/pricing" style={{ display: "block", marginTop: 10, padding: "8px 12px", background: BRAND_LIGHT, color: P, borderRadius: 7, fontSize: 11, fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
              Upgrade for full access
            </a>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div style={{ marginLeft: isMobile ? 0 : SIDEBAR_W, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Topbar */}
        <header style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "white",
          borderBottom: `1px solid ${BORDER}`,
          padding: isMobile ? "0 14px" : "0 28px",
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 8 : 12,
        }}>
          {isMobile && (
            <button
              onClick={() => setShowMobileSidebar(s => !s)}
              style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_PRIMARY, display: "flex", alignItems: "center", padding: 4, flexShrink: 0 }}
            >
              {showMobileSidebar ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", background: BG, height: 36 }}>
            <Globe size={14} color={TEXT_TERTIARY} />
            <input
              type="text"
              value={searchDomain}
              onChange={e => setSearchDomain(e.target.value)}
              placeholder="Enter domain..."
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: TEXT_PRIMARY, background: "transparent" }}
            />
            {searchDomain && (
              <button onClick={() => setSearchDomain("")} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 16, lineHeight: 1, padding: 0 }}>
                x
              </button>
            )}
          </div>

          {!isMobile && (
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { id: "worldwide", label: "Worldwide" },
                { id: "in", label: "IN" },
                { id: "us", label: "US" },
                { id: "uk", label: "UK" },
              ].map(g => (
                <button
                  key={g.id}
                  onClick={() => setGeo(g.id)}
                  style={{ padding: "4px 10px", fontSize: 11, fontWeight: 500, border: `1.5px solid ${g.id === geo ? P : BORDER}`, background: g.id === geo ? BRAND_LIGHT : "white", color: g.id === geo ? P : MUTED, borderRadius: 6, cursor: "pointer" }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          {!isMobile && (
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { id: "1m", label: "1M" },
                { id: "6m", label: "6M" },
                { id: "all", label: "All" },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  style={{ padding: "4px 10px", fontSize: 11, fontWeight: 500, border: `1.5px solid ${p.id === period ? P : BORDER}`, background: p.id === period ? BRAND_LIGHT : "white", color: p.id === period ? P : MUTED, borderRadius: 6, cursor: "pointer" }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginLeft: "auto" }}>
            {user?.plan === "free" && (
              <a href="/pricing" style={{ padding: "7px 14px", background: P, color: "white", borderRadius: 7, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                Upgrade
              </a>
            )}
          </div>
        </header>

        {/* Page content */}
        <main
          style={{ flex: 1, padding: isMobile ? "16px 14px" : "28px 32px", overflowY: "auto" }}
          onClick={() => showBrandDropdown && setShowBrandDropdown(false)}
        >
          <div key={activeNav} style={{ animation: "fadeInUp 0.2s ease forwards" }}>
            {renderContent()}
          </div>
        </main>
      </div>

      {domainLimitError && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setDomainLimitError(null)}>
          <div style={{ background: "white", borderRadius: 14, padding: 32, maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 10 }}>Domain limit reached</div>
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 24 }}>{domainLimitError}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <a href="/pricing?plan=agency" style={{ flex: 1, display: "block", padding: "10px 0", background: P, color: "white", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
                View Agency plan
              </a>
              <button onClick={() => setDomainLimitError(null)} style={{ flex: 1, padding: "10px 0", background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, color: MUTED, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default Dashboard;

function SettingsPage({ user, onSignOut }: { user: { email: string; plan: string } | null; onSignOut: () => void }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: TEXT_PRIMARY }}>Settings</div>
      <div style={{ display: "grid", gap: 16, maxWidth: 560 }}>
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Account</div>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>Email: <span style={{ color: MUTED }}>{user?.email ?? "-"}</span></div>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 20 }}>Plan: <span style={{ color: P, fontWeight: 600, textTransform: "capitalize" }}>{user?.plan ?? "free"}</span></div>
          {user?.plan === "free" && (
            <a href="/pricing" style={{ display: "inline-block", padding: "9px 20px", background: P, color: "white", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 16 }}>
              Upgrade to Starter - Rs 3,999/mo
            </a>
          )}
          <div style={{ paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
            <button onClick={onSignOut} style={{ background: "transparent", border: "1px solid #FECACA", borderRadius: 7, padding: "8px 18px", fontSize: 13, color: "#DC2626", cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
