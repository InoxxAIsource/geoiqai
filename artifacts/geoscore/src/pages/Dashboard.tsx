import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, useGetMonitoredBrands, useGetBrandScores, useGetBrandKeywords, useAddBrandKeyword, useAddMonitoredBrand, useRemoveMonitoredBrand, getGetMonitoredBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getToken } from "@/lib/auth";
import { BarChart2, Users, Search, TrendingUp, Brain, MessageSquare, HelpCircle, Wrench, Radio, FileText, Bot, Layers, Plus, ChevronDown, LogOut, Settings, Globe, Megaphone } from "lucide-react";
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

setAuthTokenGetter(getToken);

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";
const SIDEBAR_W = 228;

type NavId =
  | "visibility-overview" | "competitor-research" | "prompt-research"
  | "brand-performance" | "site-audit" | "prompt-tracking"
  | "content-creation" | "geo-agent" | "content-improvements"
  | "ai-pr" | "settings";

interface NavItem { id: NavId; label: string; icon: React.ReactNode }
interface NavSection { section: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    section: "AI Analysis",
    items: [
      { id: "visibility-overview", label: "Visibility Overview", icon: <BarChart2 size={15} /> },
      { id: "competitor-research", label: "Competitor Research", icon: <Users size={15} /> },
      { id: "prompt-research", label: "Prompt Research", icon: <Search size={15} /> },
    ],
  },
  {
    section: "Brand Performance",
    items: [
      { id: "brand-performance", label: "Brand Performance", icon: <TrendingUp size={15} /> },
    ],
  },
  {
    section: "Boost and Monitor",
    items: [
      { id: "site-audit", label: "Site Audit", icon: <Wrench size={15} /> },
      { id: "prompt-tracking", label: "Prompt Tracking", icon: <Radio size={15} /> },
      { id: "content-creation", label: "Content Creation", icon: <FileText size={15} /> },
    ],
  },
  {
    section: "GeoIQ Tools",
    items: [
      { id: "geo-agent", label: "GEO Agent", icon: <Bot size={15} /> },
      { id: "content-improvements", label: "Content Improvements", icon: <Layers size={15} /> },
      { id: "ai-pr", label: "AI PR", icon: <Megaphone size={15} /> },
    ],
  },
];

function isAuthenticated() {
  return !!getToken();
}

function generateFixActions(brand: { domain: string; latestScore?: number | null }) {
  const score = brand.latestScore ?? 40;
  const actions = [
    { id: 1, priority: "High", action: "Add Organization JSON-LD schema", effortHours: 1, impactScore: 8, done: false, cite: "schema.org/Organization" },
    { id: 2, priority: "High", action: "Create an llms.txt summary file", effortHours: 2, impactScore: 7, done: false, cite: "llmstxt.org" },
    { id: 3, priority: "Medium", action: "Get listed on Crunchbase", effortHours: 3, impactScore: 6, done: score > 50, cite: "crunchbase.com" },
    { id: 4, priority: "Medium", action: "Publish a technical blog post", effortHours: 8, impactScore: 5, done: false },
    { id: 5, priority: "Low", action: "Add FAQ structured data", effortHours: 2, impactScore: 4, done: false },
  ];
  return actions;
}

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
  const [dfStatus, setDfStatus] = useState<"checking" | "connected" | "disconnected" | "error">("checking");
  const [dfBalance, setDfBalance] = useState<number | null>(null);

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
  }, [brands]);

  useEffect(() => {
    if (!auth) setLocation("/login");
  }, [auth]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dataforseo/status")
      .then(r => r.json())
      .then((data: { connected?: boolean; balance?: number | null; hasCredentials?: boolean }) => {
        if (cancelled) return;
        if (data.connected) {
          setDfStatus("connected");
          setDfBalance(data.balance ?? null);
        } else if (data.hasCredentials) {
          setDfStatus("error");
        } else {
          setDfStatus("disconnected");
        }
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
    } catch {
      // ignore
    } finally {
      setAddingBrand(false);
    }
  };

  const handleRemoveBrand = async (id: string) => {
    try {
      await removeBrandMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetMonitoredBrandsQueryKey() });
      if (selectedBrandId === id) setSelectedBrandId(null);
    } catch {
      // ignore
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("geoscore_token");
    localStorage.removeItem("geoscore_plan");
    window.location.href = "/";
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: BG, fontFamily: "'Sora', sans-serif" }}>

      {/* Sidebar */}
      <aside style={{ width: SIDEBAR_W, flexShrink: 0, background: "white", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", overflowY: "auto", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 50 }}>

        {/* Logo */}
        <div style={{ padding: "18px 18px 12px", borderBottom: `1px solid ${BORDER}` }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, background: P, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={15} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>GeoIQ</span>
          </a>
        </div>

        {/* Brand selector */}
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${BORDER}`, position: "relative" }}>
          <div
            onClick={() => setShowBrandDropdown(!showBrandDropdown)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: BG, borderRadius: 8, cursor: "pointer", border: `1px solid ${BORDER}` }}
          >
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>Brand</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                {selectedBrand?.brandName || selectedBrand?.domain || "Select brand"}
              </div>
            </div>
            <ChevronDown size={14} color={MUTED} style={{ flexShrink: 0, transform: showBrandDropdown ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </div>

          {showBrandDropdown && (
            <div style={{ position: "absolute", left: 14, right: 14, top: "calc(100% - 4px)", background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 200 }}>
              {loadingBrands && <div style={{ padding: "12px 14px", fontSize: 12, color: MUTED }}>Loading...</div>}
              {(brands ?? []).map(b => (
                <div key={b.id}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", cursor: "pointer", background: b.id === selectedBrand?.id ? "#EEF2FF" : "transparent", borderBottom: `1px solid ${BORDER}` }}
                  onClick={() => { setSelectedBrandId(b.id); setSearchDomain(b.domain ?? ""); setShowBrandDropdown(false); }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{b.brandName || b.domain}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{b.domain}</div>
                  </div>
                  {brands && brands.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); handleRemoveBrand(b.id); }} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 14, cursor: "pointer", flexShrink: 0, padding: "0 4px" }}>x</button>
                  )}
                </div>
              ))}
              <div style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>Add brand</div>
                <input
                  type="text" placeholder="domain.com" value={newBrandDomain}
                  onChange={e => setNewBrandDomain(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, marginBottom: 5, outline: "none" }}
                />
                <input
                  type="text" placeholder="Brand name (optional)" value={newBrandName}
                  onChange={e => setNewBrandName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddBrand()}
                  style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, marginBottom: 8, outline: "none" }}
                />
                <button onClick={handleAddBrand} disabled={addingBrand || !newBrandDomain.trim()} style={{ width: "100%", padding: "7px", background: P, color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <Plus size={12} /> {addingBrand ? "Adding..." : "Add brand"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
          {NAV.map(section => (
            <div key={section.section} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 18px 4px" }}>{section.section}</div>
              {section.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveNav(item.id); setShowBrandDropdown(false); }}
                  style={{
                    width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9,
                    padding: "8px 18px", fontSize: 13, fontWeight: activeNav === item.id ? 600 : 400,
                    color: activeNav === item.id ? P : "#374151",
                    background: activeNav === item.id ? "#EEF2FF" : "transparent",
                    border: "none", borderLeft: `2.5px solid ${activeNav === item.id ? P : "transparent"}`,
                    cursor: "pointer", transition: "all 0.12s",
                  }}
                >
                  <span style={{ color: activeNav === item.id ? P : MUTED, flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* DataForSEO status pill */}
        {dfStatus !== "checking" && (() => {
          const statusMap = {
            connected: { dot: "#10B981", label: "DataForSEO connected", sub: dfBalance != null ? `$${dfBalance.toFixed(2)} balance` : null },
            disconnected: { dot: "#9CA3AF", label: "DataForSEO not connected", sub: "Add API credentials" },
            error: { dot: "#F59E0B", label: "DataForSEO error", sub: "Check credentials" },
          } as const;
          const s = statusMap[dfStatus as keyof typeof statusMap];
          return (
            <div style={{ padding: "8px 14px", borderTop: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", background: "#F9FAFB", borderRadius: 7, border: `1px solid ${BORDER}` }}>
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
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: P, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {(user?.email?.[0] ?? "U").toUpperCase()}
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email ?? "User"}</div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "capitalize" }}>{user?.plan ?? "free"} plan</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => { setActiveNav("settings"); setShowSettings(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 3 }} title="Settings">
                <Settings size={14} />
              </button>
              <button onClick={handleSignOut} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 3 }} title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          </div>
          {user?.plan === "free" && (
            <a href="/pricing" style={{ display: "block", marginTop: 10, padding: "8px 12px", background: "#EEF2FF", color: P, borderRadius: 7, fontSize: 11, fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
              Upgrade for full access
            </a>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div style={{ marginLeft: SIDEBAR_W, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Topbar */}
        <header style={{ position: "sticky", top: 0, zIndex: 40, background: "white", borderBottom: `1px solid ${BORDER}`, padding: "10px 28px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 440, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", background: "white" }}>
            <Globe size={14} color={MUTED} />
            <input
              type="text"
              value={searchDomain}
              onChange={e => setSearchDomain(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { /* trigger reload */ } }}
              placeholder="Enter domain..."
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#111827", background: "transparent" }}
            />
            {searchDomain && (
              <button
                onClick={() => setSearchDomain("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 16, lineHeight: 1 }}
              >
                x
              </button>
            )}
          </div>

          {/* Geo chips */}
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "worldwide", label: "Worldwide" },
              { id: "in", label: "IN" },
              { id: "us", label: "US" },
              { id: "uk", label: "UK" },
            ].map(g => (
              <button key={g.id} onClick={() => setGeo(g.id)} style={{ padding: "5px 11px", fontSize: 11, fontWeight: 500, border: `1.5px solid ${g.id === geo ? P : BORDER}`, background: g.id === geo ? "#EEF2FF" : "white", color: g.id === geo ? P : MUTED, borderRadius: 6, cursor: "pointer" }}>
                {g.label}
              </button>
            ))}
          </div>

          {/* Period chips */}
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "1m", label: "1M" },
              { id: "6m", label: "6M" },
              { id: "all", label: "All" },
            ].map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)} style={{ padding: "5px 11px", fontSize: 11, fontWeight: 500, border: `1.5px solid ${p.id === period ? P : BORDER}`, background: p.id === period ? "#EEF2FF" : "white", color: p.id === period ? P : MUTED, borderRadius: 6, cursor: "pointer" }}>
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {user?.plan === "free" && (
              <a href="/pricing" style={{ padding: "7px 14px", background: P, color: "white", borderRadius: 7, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                Upgrade
              </a>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }} onClick={() => showBrandDropdown && setShowBrandDropdown(false)}>

          {activeNav === "visibility-overview" && (
            <VisibilityOverview
              domain={activeDomain}
              geo={geo}
              period={period}
              onDomainChange={d => { setSearchDomain(d); }}
            />
          )}

          {activeNav === "competitor-research" && (
            <CompetitorResearch
              initialDomain={activeDomain}
              plan={user?.plan ?? "free"}
              onNavigate={(nav) => setActiveNav(nav as NavId)}
            />
          )}

          {activeNav === "prompt-research" && (
            <PromptResearch initialDomain={activeDomain} plan={user?.plan ?? "free"} />
          )}

          {activeNav === "brand-performance" && (
            <BrandPerformanceSection domain={activeDomain} />
          )}

          {activeNav === "site-audit" && (
            <SiteAuditSection domain={activeDomain} />
          )}

          {activeNav === "prompt-tracking" && (
            <PromptTracking domain={activeDomain} />
          )}

          {activeNav === "content-creation" && (
            <ContentCreation domain={activeDomain} />
          )}

          {activeNav === "geo-agent" && agentBrand.id && (
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
          )}

          {activeNav === "geo-agent" && !agentBrand.id && (
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
              <Bot size={40} color={MUTED} style={{ margin: "0 auto 16px" }} />
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Add a brand to use GEO Agent</div>
              <div style={{ fontSize: 13, color: MUTED }}>Select or add a monitored brand from the sidebar to start a conversation.</div>
            </div>
          )}

          {activeNav === "content-improvements" && (
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
              <ContentImprovementsTab
                brand={selectedBrand ? { id: selectedBrand.id, domain: selectedBrand.domain ?? activeDomain, brandName: selectedBrand.brandName ?? null } : null}
              />
            </div>
          )}

          {activeNav === "ai-pr" && (
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
              <AiPRTab />
            </div>
          )}

          {activeNav === "settings" && (
            <SettingsPage user={user ?? null} onSignOut={handleSignOut} />
          )}
        </main>
      </div>

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
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Settings</div>
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
            <button onClick={onSignOut} style={{ background: "transparent", border: `1px solid #FECACA`, borderRadius: 7, padding: "8px 18px", fontSize: 13, color: "#DC2626", cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
