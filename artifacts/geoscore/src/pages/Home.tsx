import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PricingCards } from "@/components/pricing/PricingCards";

const PRIMARY = "#4F46E5";
const PRIMARY_HOVER = "#4338CA";

const SYNE: React.CSSProperties = { fontFamily: "'Syne', sans-serif" };

const FEATURES = [
  {
    id: "score",
    label: "Measure your visibility",
    headline: "Know exactly where AI ranks you",
    body: "GeoIQ queries ChatGPT, Gemini, Perplexity, Claude, and Grok with real buyer-intent prompts. You get a score from 0-100 for each system, a combined GEO IQ, and a breakdown of what each AI actually said about you.",
    visual: (
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>GEO IQ Score</div>
            <div style={{ ...SYNE, fontSize: 64, fontWeight: 800, color: "#D97706", lineHeight: 1 }}>47<span style={{ fontSize: 20, color: "#CBD5E1", fontWeight: 400 }}>/100</span></div>
          </div>
          <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#92400E", fontWeight: 500 }}>Partial visibility</div>
        </div>
        {[
          { name: "ChatGPT", score: 22, color: "#10a37f", bg: "#DCFCE7" },
          { name: "Gemini", score: 14, color: "#4285f4", bg: "#DBEAFE" },
          { name: "Perplexity", score: 11, color: "#9333ea", bg: "#F3E8FF" },
        ].map(row => (
          <div key={row.name} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{row.name}</span>
              <span style={{ fontSize: 12, color: "#6B7280" }}>{row.score}/33</span>
            </div>
            <div style={{ height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(row.score / 33) * 100}%`, background: row.color, borderRadius: 3, transition: "width 1s ease" }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "agent",
    label: "Fix it with AI",
    headline: "An AI that knows GEO so you don't have to",
    body: "Ask your GEO Agent anything - why your score is low, what your competitor is doing differently, or what you should publish next. It has full context of your audit and tailors every answer to your specific brand.",
    visual: (
      <div style={{ background: "#0F172A", borderRadius: 12, padding: 20, minHeight: 180 }}>
        <div style={{ fontSize: 11, color: "#4ADE80", fontFamily: "monospace", marginBottom: 16 }}>GeoIQ Agent</div>
        {[
          { role: "user", text: "Why is my ChatGPT score only 8/33?" },
          { role: "agent", text: "ChatGPT's training data doesn't include strong citations for your brand. The most effective fix is to get featured on Crunchbase, Product Hunt, and at least 3 domain-authority publications. That usually moves the needle in 6-8 weeks." },
        ].map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div style={{
              maxWidth: "80%", padding: "10px 14px", borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              background: msg.role === "user" ? "#4F46E5" : "#1E293B",
              color: msg.role === "user" ? "white" : "#CBD5E1",
              fontSize: 13, lineHeight: 1.5,
            }}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "fixes",
    label: "Your step-by-step roadmap",
    headline: "A prioritized roadmap, not a generic checklist",
    body: "GeoIQ generates a ranked list of specific fixes based on your audit results - from technical issues (missing schema, no HTTPS) to authority signals (directory submissions, press coverage) to content gaps (FAQ pages, comparison posts).",
    visual: (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { priority: "HIGH", label: "Add FAQ schema markup", pts: "+12 pts", color: "#DC2626", bg: "#FEE2E2" },
          { priority: "HIGH", label: "Submit to ProductHunt", pts: "+10 pts", color: "#DC2626", bg: "#FEE2E2" },
          { priority: "MED", label: "Create comparison page", pts: "+8 pts", color: "#D97706", bg: "#FEF3C7" },
          { priority: "MED", label: "Add Crunchbase profile", pts: "+7 pts", color: "#D97706", bg: "#FEF3C7" },
        ].map((item, i) => (
          <div key={i} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, background: item.bg, color: item.color, borderRadius: 4, padding: "2px 6px", letterSpacing: "0.05em", flexShrink: 0 }}>{item.priority}</span>
            <span style={{ fontSize: 13, color: "#374151", flex: 1 }}>{item.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#059669" }}>{item.pts}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "citations",
    label: "Build your AI authority",
    headline: "See which sources AI trusts for your category",
    body: "GeoIQ tracks where the AI systems are pulling information about your industry from. You see exactly which publications, directories, and sites are being cited - so you know where to get coverage to improve your score.",
    visual: (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { source: "TechCrunch", authority: 94, cited: true },
          { source: "Product Hunt", authority: 81, cited: true },
          { source: "Crunchbase", authority: 78, cited: false },
          { source: "G2.com", authority: 72, cited: false },
        ].map((item, i) => (
          <div key={i} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.cited ? "#10B981" : "#E5E7EB", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#374151", flex: 1 }}>{item.source}</span>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>DR {item.authority}</span>
            <span style={{ fontSize: 11, color: item.cited ? "#059669" : "#9CA3AF", fontWeight: 500 }}>{item.cited ? "Your brand cited" : "Not cited yet"}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "content",
    label: "Create AI-cited content",
    headline: "Content built to train AI on your brand",
    body: "GeoIQ generates ready-to-publish content specifically designed to improve AI visibility - FAQ pages, comparison articles, schema markup, and structured data that AI systems pick up during crawling.",
    visual: (
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Generated FAQ page</div>
        {[
          "What is [YourBrand] and who is it for?",
          "How does [YourBrand] compare to [Competitor]?",
          "What problems does [YourBrand] solve?",
        ].map((q, i) => (
          <div key={i} style={{ padding: "10px 0", borderBottom: i < 2 ? "1px solid #E5E7EB" : "none" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Q: {q}</div>
            <div style={{ height: 8, background: "#E5E7EB", borderRadius: 4, width: "85%", marginBottom: 4 }} />
            <div style={{ height: 8, background: "#E5E7EB", borderRadius: 4, width: "60%" }} />
          </div>
        ))}
      </div>
    ),
  },
];

const AUDIT_CARDS = [
  {
    domain: "notion.so",
    category: "SaaS tool · Global",
    score: 24,
    scoreColor: "#D97706",
    rows: [
      { ai: "ChatGPT", status: "Partial", bg: "#FEF3C7", color: "#92400E" },
      { ai: "Gemini", status: "Invisible", bg: "#FEE2E2", color: "#991B1B" },
      { ai: "Perplexity", status: "Invisible", bg: "#FEE2E2", color: "#991B1B" },
    ],
    insight: "30 million users. Still mostly invisible in AI search.",
  },
  {
    domain: "groww.in",
    category: "Fintech · India",
    score: 38,
    scoreColor: "#D97706",
    rows: [
      { ai: "ChatGPT", status: "Partial", bg: "#FEF3C7", color: "#92400E" },
      { ai: "Gemini", status: "Invisible", bg: "#FEE2E2", color: "#991B1B" },
      { ai: "Perplexity", status: "Partial", bg: "#FEF3C7", color: "#92400E" },
    ],
    insight: "India's most trusted investment app. Missing from most AI answers.",
  },
  {
    domain: "lemlist.com",
    category: "SaaS · Global",
    score: 0,
    scoreColor: "#DC2626",
    rows: [
      { ai: "ChatGPT", status: "Invisible", bg: "#FEE2E2", color: "#991B1B" },
      { ai: "Gemini", status: "Invisible", bg: "#FEE2E2", color: "#991B1B" },
      { ai: "Perplexity", status: "Invisible", bg: "#FEE2E2", color: "#991B1B" },
    ],
    insight: "Huge blog. Strong SEO. Active community. Zero AI visibility.",
  },
];

const TICKER_BRANDS = [
  "notion.so", "groww.in", "razorpay.com", "figma.com", "linear.app",
  "zepto.com", "meesho.com", "zerodha.com", "cred.club", "freshworks.com",
  "postman.com", "browserstack.com", "chargebee.com", "clevertap.com",
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [url, setUrl] = useState("");
  const [activeFeature, setActiveFeature] = useState("score");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setLocation(`/audit?url=${encodeURIComponent(trimmed)}`);
  };

  const scrollToInput = (value?: string) => {
    if (value !== undefined) setUrl(value);
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => inputRef.current?.focus(), 500);
  };

  const activeFeatureData = FEATURES.find(f => f.id === activeFeature) ?? FEATURES[0];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "white" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "GeoIQ",
            "url": "https://geoiqai.com",
            "logo": "https://geoiqai.com/favicon.svg",
            "description": "GeoIQ is an AI visibility platform that tracks how your brand appears in ChatGPT, Gemini, Perplexity, Claude, Grok and Google AI Overview. Free AI visibility audit in 60 seconds.",
            "foundingDate": "2026",
            "founder": {
              "@type": "Person",
              "name": "Tauheed",
              "sameAs": "https://twitter.com/BeingtauheedTk"
            },
            "contactPoint": {
              "@type": "ContactPoint",
              "email": "hello@geoiqai.com",
              "contactType": "customer support"
            },
            "sameAs": [
              "https://twitter.com/BeingtauheedTk",
              "https://www.instagram.com/geoiqai",
              "https://www.linkedin.com/company/geoiqai",
              "https://x.com/BeingtauheedTk"
            ]
          }),
        }}
      />
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <Navbar />

      {/* ── HERO ── */}
      <section style={{ background: "white", padding: "80px 24px 56px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>

          <div style={{
            display: "inline-block",
            background: "#EEF2FF",
            color: "#4338CA",
            borderRadius: 20,
            padding: "4px 14px",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase" as const,
            marginBottom: 20,
          }}>
            Free AI Visibility Audit
          </div>

          <h1 style={{
            ...SYNE,
            fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 800,
            lineHeight: 1.05,
            marginBottom: 20,
            color: "#0A0A0A",
            letterSpacing: "-0.02em",
          }}>
            Get your brand<br />
            <span style={{ color: PRIMARY }}>recommended by AI</span>
          </h1>

          <p style={{
            fontSize: 20,
            color: "#6B7280",
            maxWidth: 560,
            margin: "0 auto 40px",
            lineHeight: 1.6,
            fontWeight: 400,
          }}>
            Most brands are invisible to ChatGPT, Gemini and Perplexity.
            GeoIQ finds the gaps and gives you the exact steps to fix them.
            Free in 60 seconds.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              alignItems: "center",
              background: "white",
              border: "1.5px solid #E5E7EB",
              borderRadius: 50,
              padding: "6px 6px 6px 20px",
              maxWidth: 560,
              margin: "0 auto",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
              gap: 8,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter your website URL..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: 15,
                color: "#0A0A0A",
                background: "transparent",
                minWidth: 0,
                height: 44,
              }}
            />
            <button
              type="submit"
              disabled={!url.trim()}
              style={{
                background: url.trim() ? PRIMARY : "#D1D5DB",
                color: "white",
                border: "none",
                borderRadius: 50,
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: url.trim() ? "pointer" : "default",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "background 150ms",
              }}
            >
              Check my AI visibility →
            </button>
          </form>

          <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", marginTop: 12 }}>
            Free audit · No signup · 60 seconds
          </div>

          {/* Proof points — clean single line */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginTop: 24 }}>
            {["5 AI systems", "4-week roadmap", "GEO Agent included"].map((label, i) => (
              <span key={label} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <span style={{ color: "#D1D5DB", margin: "0 16px", fontSize: 16 }}>·</span>}
                <span style={{ fontSize: 13, color: "#6B7280" }}>{label}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section style={{
        borderTop: "1px solid #F3F4F6",
        borderBottom: "1px solid #F3F4F6",
        padding: "24px 24px",
      }}>
        <div style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}>
          {[
            { number: "500+", label: "Audits Run" },
            { number: "5", label: "AI Systems" },
            { number: "Free", label: "Forever" },
            { number: "60s", label: "Results" },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              textAlign: "center",
              flex: 1,
              padding: "0 16px",
              borderRight: i < 3 ? "1px solid #E5E7EB" : "none",
            }}>
              <div style={{ ...SYNE, fontSize: 24, fontWeight: 700, color: "#0A0A0A" }}>{stat.number}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BRAND TICKER ── */}
      <section style={{ background: "#F9FAFB", padding: "16px 0", overflow: "hidden" }}>
        <div style={{ display: "flex", animation: "ticker 30s linear infinite", width: "max-content" }}>
          {[...TICKER_BRANDS, ...TICKER_BRANDS].map((brand, i) => (
            <span key={i} style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#374151",
              padding: "0 28px",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              {brand}
              <span style={{ color: "#D1D5DB" }}>·</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── PAIN SECTION ── */}
      <section style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 style={{ ...SYNE, fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 4px", color: "#0A0A0A" }}>
              Your customers ask AI.
            </h2>
            <h2 style={{ ...SYNE, fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 4px", color: "#0A0A0A" }}>
              AI recommends your competitor.
            </h2>
            <h2 style={{ ...SYNE, fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 24px", color: "#059669" }}>
              GeoIQ makes sure that changes.
            </h2>
            <p style={{ fontSize: 18, color: "#6B7280", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              Your customers aren't Googling anymore. They're asking AI. And right now, AI is recommending your competitors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                num: "01",
                title: "ChatGPT recommends competitors",
                body: "When users ask for tools in your category, ChatGPT suggests your funded competitors because they optimized for AI context.",
              },
              {
                num: "02",
                title: "Gemini hasn't heard of you",
                body: "Despite having great SEO traffic, Gemini's knowledge graph doesn't connect your brand to the problems you solve.",
              },
              {
                num: "03",
                title: "No way to track any of this",
                body: "Search Console is useless for AI systems. You have no dashboard to know if your PR and content are actually working.",
              },
            ].map((card, i) => (
              <div
                key={i}
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: 16,
                  padding: 28,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  transition: "box-shadow 200ms, transform 200ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.05)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ ...SYNE, fontSize: 40, fontWeight: 800, color: "#F3F4F6", lineHeight: 1, marginBottom: 20 }}>{card.num}</div>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "#111827", marginBottom: 8 }}>{card.title}</h3>
                <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES TABS ── */}
      <section style={{ background: "#F9FAFB", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 12 }}>
              WHAT YOU GET
            </div>
            <h2 style={{ ...SYNE, fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 800, color: "#0A0A0A", marginBottom: 12 }}>
              Everything you need to get recommended by AI
            </h2>
          </div>

          {/* Tab nav */}
          <div style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 40,
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: 6,
          }}>
            {FEATURES.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFeature(f.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 150ms",
                  background: activeFeature === f.id ? PRIMARY : "transparent",
                  color: activeFeature === f.id ? "white" : "#6B7280",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Feature content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12" style={{ alignItems: "center" }}>
            <div>
              <h3 style={{ ...SYNE, fontSize: "clamp(22px, 2.5vw, 30px)", fontWeight: 700, color: "#0A0A0A", marginBottom: 16 }}>
                {activeFeatureData.headline}
              </h3>
              <p style={{ fontSize: 16, color: "#6B7280", lineHeight: 1.7, marginBottom: 28 }}>
                {activeFeatureData.body}
              </p>
              <button
                onClick={() => scrollToInput()}
                style={{
                  background: PRIMARY,
                  color: "white",
                  border: "none",
                  borderRadius: 50,
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Try it free →
              </button>
            </div>
            <div>
              {activeFeatureData.visual}
            </div>
          </div>
        </div>
      </section>

      {/* ── REAL RESULTS ── */}
      <section style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 12 }}>
              REAL AUDIT RESULTS
            </div>
            <h2 style={{ ...SYNE, fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 800, color: "#0A0A0A", marginBottom: 12 }}>
              Even well-known brands are mostly invisible
            </h2>
            <p style={{ fontSize: 18, color: "#6B7280", maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
              These are live audit results from real domains, not estimates. Run them yourself.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ marginBottom: 32 }}>
            {AUDIT_CARDS.map((card) => (
              <div
                key={card.domain}
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.06)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{card.domain}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{card.category}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...SYNE, fontSize: 36, fontWeight: 800, color: card.scoreColor, lineHeight: 1 }}>{card.score}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>/100</div>
                  </div>
                </div>
                <div style={{ height: 6, background: "#F3F4F6", borderRadius: 3, margin: "12px 0" }}>
                  <div style={{ height: "100%", width: `${card.score}%`, background: card.scoreColor, borderRadius: 3 }} />
                </div>
                {card.rows.map((row) => (
                  <div key={row.ai} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                    <span style={{ fontSize: 13, color: "#6B7280" }}>{row.ai}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 9999, background: row.bg, color: row.color }}>
                      {row.status}
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 12, marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flex: 1 }}>
                  <p style={{ fontSize: 13, color: "#6B7280", margin: 0, fontStyle: "italic", lineHeight: 1.5, flex: 1 }}>{card.insight}</p>
                  <button
                    onClick={() => setLocation(`/audit?url=${card.domain}`)}
                    style={{ fontSize: 12, color: PRIMARY, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500, padding: 0, flexShrink: 0 }}
                  >
                    Run it →
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => scrollToInput()}
              style={{ height: 44, padding: "0 28px", background: PRIMARY, color: "white", border: "none", borderRadius: 9999, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = PRIMARY_HOVER)}
              onMouseLeave={(e) => (e.currentTarget.style.background = PRIMARY)}
            >
              Check your brand free →
            </button>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF DARK ── */}
      <section style={{ background: "#0A0A0A", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ ...SYNE, fontSize: "clamp(28px, 3.5vw, 36px)", fontWeight: 800, color: "white", textAlign: "center", marginBottom: 48 }}>
            Trusted by founders who take AI search seriously
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { number: "500+", label: "Audits run" },
              { number: "5", label: "AI systems tracked" },
              { number: "0", label: "Signups needed" },
              { number: "60s", label: "Average audit time" },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: "#1A1A1A",
                border: "1px solid #2A2A2A",
                borderRadius: 16,
                padding: 32,
                textAlign: "center",
              }}>
                <div style={{ ...SYNE, fontSize: 36, fontWeight: 800, color: "white", marginBottom: 8 }}>{stat.number}</div>
                <div style={{ fontSize: 13, color: "#6B7280" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ background: "#F9FAFB", padding: "96px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 12 }}>HOW IT WORKS</div>
            <h2 style={{ ...SYNE, fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 800, color: "#0A0A0A" }}>Your GEO IQ in 60 seconds</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Audit", desc: "See exactly how ChatGPT, Gemini and Perplexity describe your brand right now." },
              { step: "02", title: "Fix", desc: "Get your personalized 4-week roadmap with exact tasks, generated content, and direct submission URLs." },
              { step: "03", title: "Get found", desc: "Watch your AI visibility score climb as your brand gets recommended in AI search results." },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ ...SYNE, fontSize: 48, fontWeight: 800, color: "#E5E7EB", lineHeight: 1, marginBottom: 12 }}>
                  {item.step}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 8 }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ background: "white", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 12 }}>PRICING</div>
            <h2 style={{ ...SYNE, fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 800, color: "#0A0A0A", marginBottom: 8 }}>Start getting found by AI today</h2>
            <p style={{ fontSize: 18, color: "#6B7280" }}>Free audit to see where you stand. Paid plan to fix it.</p>
          </div>
          <PricingCards />
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: "#0A0A0A", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ ...SYNE, fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, color: "white", marginBottom: 16 }}>
            Start getting recommended by AI
          </h2>
          <p style={{ fontSize: 18, color: "#6B7280", marginBottom: 32, lineHeight: 1.6 }}>
            Join founders who stopped being invisible to ChatGPT and Gemini.
          </p>
          <button
            onClick={() => scrollToInput()}
            style={{ background: PRIMARY, color: "white", border: "none", borderRadius: 50, padding: "16px 40px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = PRIMARY_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.background = PRIMARY)}
          >
            Check your brand free →
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
