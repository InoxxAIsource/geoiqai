import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PricingCards } from "@/components/pricing/PricingCards";

const BG = "#F2F0EB";
const TEXT = "#0A0A0A";
const PURPLE = "#5B3FEA";
const MUTED = "#6B7280";
const BORDER = "#D4D0C8";
const CARD = "#E8E4DC";

const TICKER_BRANDS = [
  "notion.so", "groww.in", "razorpay.com", "figma.com", "linear.app",
  "zepto.com", "meesho.com", "zerodha.com", "cred.club", "freshworks.com",
  "postman.com", "browserstack.com", "chargebee.com", "clevertap.com",
];

const AI_SYSTEMS = [
  { name: "ChatGPT", abbr: "GPT", color: "#10A37F", bg: "#D1FAE5" },
  { name: "Gemini", abbr: "G", color: "#4285F4", bg: "#DBEAFE" },
  { name: "Perplexity", abbr: "PX", color: "#7C3AED", bg: "#EDE9FE" },
  { name: "Claude", abbr: "C", color: "#D97706", bg: "#FEF3C7" },
  { name: "Grok", abbr: "X", color: "#0A0A0A", bg: "#F3F4F6" },
  { name: "Google AI", abbr: "AI", color: "#EA4335", bg: "#FEE2E2" },
];

const AUDIT_CARDS = [
  {
    domain: "notion.so",
    category: "SaaS tool · Global",
    score: 24,
    rows: [
      { ai: "ChatGPT", status: "Partial", cls: "ep" },
      { ai: "Gemini", status: "Invisible", cls: "ei" },
      { ai: "Perplexity", status: "Invisible", cls: "ei" },
    ],
    insight: "30 million users. Still mostly invisible in AI search.",
  },
  {
    domain: "groww.in",
    category: "Fintech · India",
    score: 38,
    rows: [
      { ai: "ChatGPT", status: "Partial", cls: "ep" },
      { ai: "Gemini", status: "Invisible", cls: "ei" },
      { ai: "Perplexity", status: "Partial", cls: "ep" },
    ],
    insight: "India's most trusted investment app. Missing from most AI answers.",
  },
  {
    domain: "lemlist.com",
    category: "SaaS · Global",
    score: 0,
    rows: [
      { ai: "ChatGPT", status: "Invisible", cls: "ei" },
      { ai: "Gemini", status: "Invisible", cls: "ei" },
      { ai: "Perplexity", status: "Invisible", cls: "ei" },
    ],
    insight: "Huge blog. Strong SEO. Active community. Zero AI visibility.",
  },
];

const TESTIMONIALS = [
  {
    quote: "We were spending on SEO but ChatGPT was recommending our competitors. GeoIQ showed us exactly why and gave us a fix list. Our score went from 12 to 47 in 6 weeks.",
    author: "Priya S.",
    role: "Founder, SaaS startup · Bangalore",
  },
  {
    quote: "The audit took 60 seconds and I immediately saw three things we were doing wrong. The robots.txt issue alone was costing us visibility across all AI systems.",
    author: "Rohit M.",
    role: "Growth lead · B2B SaaS · Mumbai",
  },
  {
    quote: "I showed the audit to my team and they finally understood why content quality matters for AI. The CITE breakdown was eye-opening - we had no authority signals at all.",
    author: "Aditya K.",
    role: "Co-founder · Fintech startup · Delhi",
  },
];

const FAQS = [
  {
    q: "What is GEO IQ and how is it different from SEO?",
    a: "GEO IQ (Generative Engine Optimization Intelligence Quotient) is your brand's visibility score across AI systems like ChatGPT, Gemini, and Perplexity. Unlike SEO which tracks Google rankings, GEO IQ measures whether AI actually mentions and recommends your brand when users ask questions in your category.",
  },
  {
    q: "How does the free audit work?",
    a: "Paste your domain and GeoIQ queries ChatGPT, Gemini, Perplexity, Claude, and Grok with real buyer-intent prompts about your product category. We analyze the responses, check your technical setup, and return a 0-100 score with specific fixes in about 60 seconds.",
  },
  {
    q: "Is this accurate? How do you query the AI systems?",
    a: "We use the official APIs for each AI system with prompts that mirror how real users ask about products in your category. The responses vary slightly each time (that is how LLMs work), so scores represent your average visibility across multiple query runs.",
  },
  {
    q: "How long does it take to improve my score?",
    a: "Technical fixes (robots.txt, schema markup) take effect within 1-2 weeks. Content changes and citation building typically show results in 4-8 weeks. Most users see meaningful movement in their GEO IQ within 30 days of implementing the recommended fixes.",
  },
  {
    q: "Does this work for Indian startups and regional brands?",
    a: "Yes. GeoIQ was built with the Indian market in mind. We understand that AI systems have different training data distributions, and we specifically test how your brand appears for Indian user intents and regional contexts.",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [url, setUrl] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]!
      .toLowerCase();
    if (!trimmed) return;
    setLocation(`/audit?url=${encodeURIComponent(trimmed)}`);
  };

  const scrollToInput = () => {
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => inputRef.current?.focus(), 400);
  };

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'Inter', sans-serif", overflowX: "hidden" }}>
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
            "sameAs": [
              "https://twitter.com/BeingtauheedTk",
              "https://www.linkedin.com/company/geoiqai",
            ],
          }),
        }}
      />
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes ticker-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .ticker-track { display:flex; animation:ticker-scroll 30s linear infinite; white-space:nowrap; }
        .ticker-track:hover { animation-play-state:paused; }
        .pulse-dot { animation:pulse 1.5s infinite; }
        @media(max-width:768px){
          .hide-mobile{ display:none!important; }
          .grid-3-mobile{ grid-template-columns:1fr!important; }
          .grid-2-mobile{ grid-template-columns:1fr!important; }
          .stats-grid-mobile{ grid-template-columns:repeat(2,1fr)!important; }
          .hero-pad{ padding:100px 20px 48px!important; }
          .section-pad{ padding:56px 20px!important; }
          .section-h2-mobile{ font-size:clamp(30px,8vw,56px)!important; }
          .input-wrap-mobile{ flex-direction:column!important; padding:12px!important; }
          .input-wrap-mobile input{ color:white; }
          .input-wrap-mobile button{ width:100%!important; }
        }
      `}</style>

      <Navbar />

      {/* HERO */}
      <div className="hero-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "140px 48px 60px" }}>
        <div style={{ maxWidth: 760 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: TEXT, color: "#fff",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const,
              padding: "6px 14px", borderRadius: 4,
            }}>
              <span className="pulse-dot" style={{ width: 6, height: 6, background: PURPLE, borderRadius: "50%", display: "inline-block" }} />
              GEO Audit · v2.0
            </div>
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 500, letterSpacing: "0.05em" }}>
              Live · Built for SaaS and Founders
            </span>
          </div>

          <h1 style={{
            fontSize: "clamp(52px, 7vw, 88px)", fontWeight: 900, lineHeight: 0.95,
            letterSpacing: "-0.03em", marginBottom: 32,
          }}>
            Your brand is{" "}
            <span style={{ background: PURPLE, color: "#fff", padding: "2px 12px", display: "inline-block", lineHeight: 1.1 }}>
              invisible
            </span>
            <br />
            <em style={{ fontStyle: "italic" }}>to AI right now.</em>
          </h1>

          <p style={{ fontSize: 18, color: MUTED, maxWidth: 540, lineHeight: 1.6, marginBottom: 40 }}>
            Paste your URL. GeoIQ checks ChatGPT, Gemini, Perplexity, Claude and Grok - and returns your AI visibility score with exact fixes. Free in 60 seconds.
          </p>

          <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
            <div className="input-wrap-mobile" style={{
              display: "flex", background: TEXT, borderRadius: 10, overflow: "hidden",
              maxWidth: 580, padding: "8px 8px 8px 24px", gap: 8,
              border: `2px solid ${TEXT}`,
            }}>
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="yoursite.com"
                style={{
                  flex: 1, background: "transparent", border: "none", color: "#fff",
                  fontSize: 15, outline: "none", fontFamily: "inherit",
                }}
              />
              <button type="submit" style={{
                background: PURPLE, color: "#fff", border: "none",
                padding: "13px 24px", borderRadius: 6, fontSize: 15, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap" as const, fontFamily: "inherit",
              }}>
                Check my AI visibility
              </button>
            </div>
          </form>

          <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" as const }}>
            {[
              { num: "500+", label: "audits run" },
              { num: "6", label: "AI systems" },
              { num: "Free", label: "forever" },
              { num: "60s", label: "results" },
            ].map(s => (
              <span key={s.label} style={{ fontSize: 13, color: MUTED }}>
                <strong style={{ color: TEXT, fontWeight: 700 }}>{s.num}</strong> {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* AI LOGOS STRIP */}
      <div style={{ background: "#fff", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "36px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: MUTED, textAlign: "center", marginBottom: 24 }}>
            Tracks 6 AI Systems
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 40, flexWrap: "wrap" as const }}>
            {AI_SYSTEMS.map(ai => (
              <div key={ai.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontSize: 12, color: MUTED, fontWeight: 500 }}>
                <div style={{
                  width: 48, height: 48, background: ai.bg, border: `1.5px solid ${BORDER}`,
                  borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: ai.abbr.length > 1 ? 13 : 18, fontWeight: 800, color: ai.color,
                }}>
                  {ai.abbr}
                </div>
                <span>{ai.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ background: TEXT, color: "#fff", padding: "40px 48px" }}>
        <div className="stats-grid-mobile" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "#333" }}>
          {[
            { num: "500+", label: "Audits Run" },
            { num: "6", label: "AI Systems Tracked" },
            { num: "Free", label: "Forever Plan", purple: true },
            { num: "60s", label: "Average Audit Time" },
          ].map(s => (
            <div key={s.label} style={{ background: TEXT, padding: "28px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.03em", color: s.purple ? PURPLE : "#fff" }}>
                {s.num}
              </div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TICKER */}
      <div style={{ overflow: "hidden", background: BG, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "14px 0" }}>
        <div className="ticker-track">
          {[...TICKER_BRANDS, ...TICKER_BRANDS].map((brand, i) => (
            <span key={i} style={{ fontSize: 13, color: MUTED, fontWeight: 500, padding: "0 24px", borderRight: `1px solid ${BORDER}`, display: "inline-block" }}>
              {brand}
            </span>
          ))}
        </div>
      </div>

      {/* PROBLEM SECTION */}
      <div className="section-pad" style={{ padding: "80px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 24 }}>
            <span style={{ display: "block", width: 24, height: 1, background: MUTED }} />
            The Problem · 3 Gaps
          </div>
          <h2 className="section-h2-mobile" style={{ fontSize: "clamp(36px,5vw,68px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.03em", marginBottom: 16 }}>
            Your customers ask AI.<br /><em style={{ fontStyle: "italic" }}>AI recommends your competitor.</em>
          </h2>
          <p style={{ fontSize: 17, color: MUTED, maxWidth: 520, lineHeight: 1.6, marginBottom: 0 }}>
            Your customers are not Googling anymore. They are asking AI. And right now, AI is recommending your competitors - not you.
          </p>
          <div className="grid-3-mobile" style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1,
            background: BORDER, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", marginTop: 56,
          }}>
            {[
              { num: "01", title: "ChatGPT recommends competitors", body: "When users ask for tools in your category, ChatGPT suggests funded competitors because they optimized for AI context. You are not even in the conversation." },
              { num: "02", title: "Gemini has not heard of you", body: "Despite having great SEO traffic, Gemini's knowledge graph does not connect your brand to the problems you solve. You are invisible where it counts." },
              { num: "03", title: "No way to track any of this", body: "Search Console is useless for AI systems. You have no dashboard to know if your PR and content are actually working. GeoIQ fixes this." },
            ].map(card => (
              <div key={card.num} style={{ background: BG, padding: "36px 32px" }}>
                <div style={{ fontSize: 60, fontWeight: 900, color: `rgba(91,63,234,0.12)`, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 16 }}>{card.num}</div>
                <h3 style={{ fontSize: 21, fontWeight: 800, marginBottom: 12, lineHeight: 1.2 }}>{card.title}</h3>
                <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="section-pad" id="how" style={{ padding: "80px 48px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 24 }}>
            <span style={{ display: "block", width: 24, height: 1, background: MUTED }} />
            How It Works · 3 Steps
          </div>
          <h2 className="section-h2-mobile" style={{ fontSize: "clamp(36px,5vw,68px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.03em" }}>
            Three steps.<br /><em style={{ fontStyle: "italic" }}>Your GEO IQ in 60 seconds.</em>
          </h2>
          <div className="grid-3-mobile" style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1,
            background: BORDER, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", marginTop: 56,
          }}>
            {[
              { icon: "->", iconBg: TEXT, step: "01 / Audit", title: "Paste your URL", body: "We query ChatGPT, Gemini, Perplexity, Claude, and Grok with real buyer-intent prompts about your category. No scraping. No guessing." },
              { icon: "↻", iconBg: PURPLE, step: "02 / Fix", title: "Get your exact roadmap", body: "GeoIQ returns a 4-week fix plan with CITE tags, AI-ready content rewrites, and direct submission URLs. Every fix has a reason and a predicted impact." },
              { icon: "↗", iconBg: "#16A34A", step: "03 / Get Found", title: "Watch your score climb", body: "Track your GEO IQ score across all 6 AI systems daily. See which AI mentions you, when your brand appears, and how you stack up against competitors." },
            ].map(card => (
              <div key={card.step} style={{ background: BG, padding: "36px 32px" }}>
                <div style={{ width: 44, height: 44, background: card.iconBg, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, fontSize: 18, color: "#fff", fontWeight: 700 }}>
                  {card.icon}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: MUTED, marginBottom: 14, textTransform: "uppercase" as const }}>{card.step}</div>
                <h3 style={{ fontSize: 21, fontWeight: 800, marginBottom: 12, lineHeight: 1.2 }}>{card.title}</h3>
                <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SCORE DEMO - DARK */}
      <div className="section-pad" style={{ background: TEXT, color: "#fff", padding: "80px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#555", marginBottom: 24 }}>
            <span style={{ display: "block", width: 24, height: 1, background: "#555" }} />
            Your Score
          </div>
          <div className="grid-2-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `rgba(91,63,234,0.1)`, border: `1px solid rgba(91,63,234,0.3)`, borderRadius: 100, padding: "8px 20px", fontSize: 13, fontWeight: 600, color: PURPLE, marginBottom: 28 }}>
                <span className="pulse-dot" style={{ width: 6, height: 6, background: PURPLE, borderRadius: "50%", display: "inline-block" }} />
                Powered by Claude AI
              </div>
              <h2 style={{ fontSize: "clamp(32px,4vw,52px)", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 20 }}>
                Your GEO IQ.<br />Real. Live. Brutal.
              </h2>
              <p style={{ fontSize: 16, color: "#aaa", lineHeight: 1.6, marginBottom: 32 }}>
                GeoIQ gives you a score from 0 to 100 for each AI system, a combined GEO IQ, and a full breakdown of what each AI actually says about your brand right now.
              </p>
              <button onClick={scrollToInput} style={{ background: PURPLE, color: "#fff", padding: "14px 28px", borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: "pointer", border: "none", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
                Check your score free
              </button>
            </div>
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: 32 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#666", textTransform: "uppercase" as const, marginBottom: 4 }}>GEO IQ Score</div>
                  <div style={{ fontSize: 68, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: "#fff" }}>
                    <span style={{ color: PURPLE }}>47</span>/100
                  </div>
                </div>
                <div style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 100 }}>
                  Partial Visibility
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { label: "ChatGPT", pct: 67, val: "22/33" },
                  { label: "Gemini", pct: 42, val: "14/33" },
                  { label: "Perplexity", pct: 33, val: "11/33" },
                ].map(bar => (
                  <div key={bar.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, width: 80, flexShrink: 0, color: "#aaa" }}>{bar.label}</div>
                    <div style={{ flex: 1, height: 6, background: "#222", borderRadius: 100, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${bar.pct}%`, background: PURPLE, borderRadius: 100 }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, width: 44, textAlign: "right" as const, color: "#aaa" }}>{bar.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES GRID */}
      <div className="section-pad" style={{ padding: "80px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 24 }}>
            <span style={{ display: "block", width: 24, height: 1, background: MUTED }} />
            What You Get
          </div>
          <h2 className="section-h2-mobile" style={{ fontSize: "clamp(36px,5vw,68px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.03em" }}>
            Everything you need<br />to get recommended<br /><em style={{ fontStyle: "italic" }}>by AI.</em>
          </h2>
          <div className="grid-3-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginTop: 56 }}>
            {[
              { icon: "[ ]", label: "Measure your AI visibility", body: "Get a GEO IQ score across ChatGPT, Gemini, Perplexity, Claude, Grok, and Google AI. See exactly where your brand appears and where it is missing." },
              { icon: "->", label: "Your step-by-step roadmap", body: "A 4-week fix plan with exact tasks, generated content, CITE tags, and direct submission URLs. Not generic advice - your brand, your gaps, your fixes." },
              { icon: "//", label: "AI-cited content generation", body: "GeoIQ rewrites your homepage copy, generates AI-ready blog posts, and creates the exact content that gets cited by ChatGPT and Gemini." },
              { icon: "~", label: "Citation tracking", body: "See which sites AI cites when answering questions in your category. Know exactly what drives your competitors' AI mentions - and how to match it." },
              { icon: "vs", label: "Competitor analysis", body: "Compare your AI mention rate against up to 10 competitors. See which AI systems favor them and where to attack in your content strategy." },
              { icon: "AI", label: "GeoIQ Agent (Claude AI)", body: "A Claude-powered AI strategist in your dashboard. Run live audits, generate content, ask strategy questions - all in one conversation." },
            ].map(feat => (
              <div key={feat.label} style={{
                background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
                padding: "32px 28px", position: "relative" as const, overflow: "hidden",
              }}>
                <div style={{ position: "absolute" as const, top: 0, left: 0, right: 0, height: 3, background: PURPLE }} />
                <div style={{ width: 40, height: 40, background: `rgba(91,63,234,0.1)`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: PURPLE, marginBottom: 20 }}>
                  {feat.icon}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>{feat.label}</h3>
                <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>{feat.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* REAL AUDIT RESULTS */}
      <div className="section-pad" style={{ padding: "80px 48px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 24 }}>
            <span style={{ display: "block", width: 24, height: 1, background: MUTED }} />
            Real Audit Results
          </div>
          <h2 className="section-h2-mobile" style={{ fontSize: "clamp(36px,5vw,68px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.03em", marginBottom: 16 }}>
            Even well-known brands<br /><em style={{ fontStyle: "italic" }}>are mostly invisible.</em>
          </h2>
          <p style={{ fontSize: 17, color: MUTED, maxWidth: 520, lineHeight: 1.6 }}>
            These are live audit results from real domains, not estimates. Run them yourself.
          </p>
          <div className="grid-3-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginTop: 44 }}>
            {AUDIT_CARDS.map(card => (
              <div key={card.domain} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "22px 22px 18px", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{card.domain}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{card.category}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 14 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em", color: card.score === 0 ? "#DC2626" : card.score < 40 ? "#D97706" : TEXT }}>{card.score}</span>
                    <span style={{ fontSize: 14, color: MUTED }}>/100</span>
                  </div>
                </div>
                <div style={{ padding: "18px 22px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {card.rows.map(row => (
                      <div key={row.ai} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: MUTED }}>{row.ai}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                          background: row.cls === "ei" ? "rgba(239,68,68,0.1)" : row.cls === "ev" ? "rgba(34,197,94,0.1)" : "rgba(251,191,36,0.12)",
                          color: row.cls === "ei" ? "#DC2626" : row.cls === "ev" ? "#16A34A" : "#D97706",
                        }}>
                          {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 16, lineHeight: 1.5, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
                    {card.insight}
                  </div>
                  <a href={`/audit?url=${card.domain}`} style={{ fontSize: 13, fontWeight: 600, color: PURPLE, marginTop: 12, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                    Run it
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TESTIMONIALS - DARK */}
      <div className="section-pad" style={{ background: TEXT, color: "#fff", padding: "80px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#555", marginBottom: 24 }}>
            <span style={{ display: "block", width: 24, height: 1, background: "#555" }} />
            What founders are saying
          </div>
          <div className="grid-3-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "#1a1a1a", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden", marginTop: 48 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ background: TEXT, padding: "36px 32px" }}>
                <div style={{ fontSize: 16, letterSpacing: 2, color: "#FBBF24", marginBottom: 18 }}>*****</div>
                <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.55, marginBottom: 24, color: "#ddd" }}>
                  "{t.quote}"
                </p>
                <div style={{ fontSize: 13, color: "#555" }}>
                  <strong style={{ color: "#888" }}>{t.author}</strong><br />{t.role}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="section-pad" id="pricing" style={{ padding: "80px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 24 }}>
            <span style={{ display: "block", width: 24, height: 1, background: MUTED }} />
            Pricing
          </div>
          <h2 className="section-h2-mobile" style={{ fontSize: "clamp(36px,5vw,68px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.03em" }}>
            Simple pricing.<br /><em style={{ fontStyle: "italic" }}>Cancel any time.</em>
          </h2>
          <div style={{ marginTop: 56 }}>
            <PricingCards />
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="section-pad" id="faq" style={{ padding: "80px 48px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 24 }}>
            <span style={{ display: "block", width: 24, height: 1, background: MUTED }} />
            FAQ
          </div>
          <h2 className="section-h2-mobile" style={{ fontSize: "clamp(36px,5vw,68px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.03em" }}>
            Questions?<br /><em style={{ fontStyle: "italic" }}>We have answers.</em>
          </h2>
          <div style={{ maxWidth: 800, margin: "48px auto 0", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%", padding: "22px 28px", fontSize: 15, fontWeight: 700,
                    cursor: "pointer", display: "flex", justifyContent: "space-between",
                    alignItems: "center", gap: 16, background: openFaq === i ? CARD : "transparent",
                    border: "none", textAlign: "left" as const, fontFamily: "inherit", color: TEXT,
                  }}
                >
                  {faq.q}
                  <span style={{ fontSize: 20, fontWeight: 300, color: openFaq === i ? PURPLE : MUTED, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none", flexShrink: 0 }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 28px 22px", fontSize: 15, color: MUTED, lineHeight: 1.7, background: CARD }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div style={{ padding: "100px 48px", background: TEXT, color: "#fff", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(40px,6vw,72px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 0.95, marginBottom: 24 }}>
            Find out where AI<br />ranks your brand.
          </h2>
          <p style={{ fontSize: 18, color: "#888", marginBottom: 44 }}>
            Free audit. 60 seconds. No credit card.
          </p>
          <button onClick={scrollToInput} style={{
            background: PURPLE, color: "#fff", padding: "18px 40px", borderRadius: 8,
            fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer",
            fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 10,
          }}>
            Get my free AI audit
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
