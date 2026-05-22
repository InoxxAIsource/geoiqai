import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PricingCards } from "@/components/pricing/PricingCards";

const PRIMARY = "#4F46E5";
const PRIMARY_HOVER = "#4338CA";

export default function Home() {
  const [, setLocation] = useLocation();
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      setLocation(`/audit?url=${encodeURIComponent(url.trim())}`);
    }
  };

  const scrollToInput = (value?: string) => {
    if (value !== undefined) setUrl(value);
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => inputRef.current?.focus(), 500);
  };

  const AUDIT_CARDS = [
    {
      domain: "notion.so",
      category: "SaaS tool · Global",
      score: 24,
      scoreColor: "#F59E0B",
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
      scoreColor: "#F59E0B",
      rows: [
        { ai: "ChatGPT", status: "Partial", bg: "#FEF3C7", color: "#92400E" },
        { ai: "Gemini", status: "Invisible", bg: "#FEE2E2", color: "#991B1B" },
        { ai: "Perplexity", status: "Partial", bg: "#FEF3C7", color: "#92400E" },
      ],
      insight: "India's most trusted investment app. Missing from most AI answers.",
    },
    {
      domain: "lemlist.com",
      category: "SaaS tool · Global",
      score: 0,
      scoreColor: "#EF4444",
      rows: [
        { ai: "ChatGPT", status: "Invisible", bg: "#FEE2E2", color: "#991B1B" },
        { ai: "Gemini", status: "Invisible", bg: "#FEE2E2", color: "#991B1B" },
        { ai: "Perplexity", status: "Invisible", bg: "#FEE2E2", color: "#991B1B" },
      ],
      insight: "Huge blog. Strong SEO. Active community. Zero AI visibility.",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "white" }}>
      <Navbar />

      {/* ── HERO ── */}
      <section style={{ background: "white", padding: "80px 24px 56px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#EEF2FF",
              color: PRIMARY,
              fontSize: 13,
              fontWeight: 500,
              padding: "6px 14px",
              borderRadius: 9999,
              marginBottom: 28,
              border: "1px solid rgba(79,70,229,0.2)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                background: "#10B981",
                borderRadius: "50%",
                display: "inline-block",
                animation: "pulse-dot 2s infinite",
              }}
            />
            Generative Engine Optimization is here
          </div>

          <h1
            style={{
              fontSize: "clamp(40px, 6vw, 64px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginBottom: 20,
              color: "#111827",
            }}
          >
            What's your brand's{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              GEO IQ?
            </span>
          </h1>

          <p
            style={{
              fontSize: 18,
              color: "#6B7280",
              maxWidth: 520,
              margin: "0 auto 36px",
              lineHeight: 1.6,
            }}
          >
            Find out if AI systems have you in their memory, and if the live web can find you today. Free in 60 seconds, no signup needed.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 24,
              padding: "8px 8px 8px 20px",
              maxWidth: 540,
              margin: "0 auto",
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              id="hero-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter your startup's domain (e.g., razorpay.com)"
              style={{
                flex: 1,
                height: 44,
                border: "none",
                outline: "none",
                fontSize: 15,
                color: "#111827",
                background: "transparent",
                minWidth: 0,
              }}
            />
            <button
              type="submit"
              disabled={!url.trim()}
              style={{
                height: 44,
                padding: "0 22px",
                background: url.trim() ? PRIMARY : "#9CA3AF",
                color: "white",
                border: "none",
                borderRadius: 16,
                fontSize: 15,
                fontWeight: 600,
                cursor: url.trim() ? "pointer" : "default",
                whiteSpace: "nowrap",
                flexShrink: 0,
                boxShadow: url.trim() ? "0 1px 2px rgba(79,70,229,0.4)" : "none",
                transition: "background 150ms",
              }}
            >
              Check my GEO IQ →
            </button>
          </form>

          <div
            style={{
              display: "flex",
              gap: 20,
              justifyContent: "center",
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            {["No signup needed", "Free", "Instant results"].map((item) => (
              <span
                key={item}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22,4 12,14.01 9,11.01" />
                </svg>
                {item}
              </span>
            ))}
          </div>

          {/* Browser mockup visual */}
          <div style={{ position: "relative", marginTop: 48 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(79,70,229,0.08) 0%, transparent 100%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                maxWidth: 580,
                margin: "0 auto",
                background: "white",
                borderRadius: 12,
                boxShadow: "0 20px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  background: "#F3F4F6",
                  padding: "10px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                <div style={{ display: "flex", gap: 6 }}>
                  {["#EF4444", "#F59E0B", "#10B981"].map((c) => (
                    <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                  ))}
                </div>
                <div style={{ flex: 1, background: "#E5E7EB", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "#9CA3AF", textAlign: "left" }}>
                  geoiqai.com/audit
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>yourbrand.com</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>AI visibility audit · just now</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: "#F59E0B", lineHeight: 1 }}>34</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>/100 GEO IQ</div>
                  </div>
                </div>
                <div style={{ height: 6, background: "#F3F4F6", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "34%", background: "#F59E0B", borderRadius: 3 }} />
                </div>
                {[
                  { name: "ChatGPT", dot: "#10a37f", visible: true },
                  { name: "Gemini", dot: "#4285f4", visible: false },
                  { name: "Perplexity", dot: "#22d3ee", visible: false },
                ].map((row, i) => (
                  <div
                    key={row.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: i < 2 ? "1px solid #F3F4F6" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.dot }} />
                      <span style={{ fontSize: 13, color: "#374151" }}>{row.name}</span>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: 9999,
                        background: row.visible ? "#D1FAE5" : "#FEE2E2",
                        color: row.visible ? "#065F46" : "#991B1B",
                      }}
                    >
                      {row.visible ? "Visible" : "Invisible"}
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 14, filter: "blur(4px)", pointerEvents: "none" }}>
                  {[80, 60, 70].map((w, i) => (
                    <div key={i} style={{ height: 10, background: "#E5E7EB", borderRadius: 4, marginBottom: i < 2 ? 6 : 0, width: `${w}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF STRIP ── */}
      <section
        style={{
          background: "#F9FAFB",
          borderTop: "1px solid #F3F4F6",
          borderBottom: "1px solid #F3F4F6",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto",
            display: "flex",
            gap: 40,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {[
            { number: "500+", label: "Audits run" },
            { number: "3", label: "AI systems checked" },
            { number: "60s", label: "Average audit time" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>{stat.number}</div>
              <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PAIN POINTS ── */}
      <section style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: PRIMARY,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              THE PROBLEM
            </div>
            <h2
              style={{
                fontSize: "clamp(28px, 3.5vw, 40px)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#111827",
                marginBottom: 12,
              }}
            >
              The new SEO is GEO
            </h2>
            <p
              style={{
                fontSize: 18,
                color: "#6B7280",
                maxWidth: 560,
                margin: "0 auto",
                lineHeight: 1.6,
              }}
            >
              Your customers aren't Googling anymore. They're asking AI. And right now,
              AI is recommending your competitors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                iconBg: "#FEE2E2",
                iconColor: "#EF4444",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ),
                title: "ChatGPT recommends competitors",
                body: "When users ask for tools in your category, ChatGPT suggests your funded competitors because they optimized for AI context.",
              },
              {
                iconBg: "#FEF3C7",
                iconColor: "#F59E0B",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ),
                title: "Gemini hasn't heard of you",
                body: "Despite having great SEO traffic, Gemini's knowledge graph doesn't connect your brand to the problems you solve.",
              },
              {
                iconBg: "#EEF2FF",
                iconColor: PRIMARY,
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                ),
                title: "No way to track this",
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
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  transition: "box-shadow 200ms, transform 200ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.05)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: card.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                    color: card.iconColor,
                  }}
                >
                  {card.icon}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 8 }}>{card.title}</h3>
                <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.6, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOUNDER QUOTE ── */}
      <section
        style={{
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 120,
              color: "rgba(255,255,255,0.15)",
              lineHeight: 0.8,
              marginBottom: -8,
              fontFamily: "Georgia, serif",
            }}
          >
            &ldquo;
          </div>
          <blockquote
            style={{
              fontSize: "clamp(18px, 2.5vw, 24px)",
              color: "white",
              fontWeight: 500,
              lineHeight: 1.6,
              marginBottom: 32,
              fontStyle: "normal",
            }}
          >
            I built MealCoreAI to 12,000 users, but our growth stalled. Turns out,
            Perplexity was telling our exact target audience to use our competitor. I had
            zero warning. I built GeoIQ to fix my own problem.
          </blockquote>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                border: "2px solid rgba(255,255,255,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                color: "white",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              T
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "white" }}>Tauheed</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Founder, GeoIQ &amp; MealCoreAI</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── REAL AUDIT RESULTS ── */}
      <section style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: PRIMARY,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              REAL AUDIT RESULTS
            </div>
            <h2
              style={{
                fontSize: "clamp(28px, 3.5vw, 40px)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#111827",
                marginBottom: 12,
              }}
            >
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
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
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
                    <div style={{ fontSize: 36, fontWeight: 700, color: card.scoreColor, lineHeight: 1 }}>{card.score}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>/100</div>
                  </div>
                </div>
                <div style={{ height: 6, background: "#F3F4F6", borderRadius: 3, margin: "12px 0" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${card.score}%`,
                      background: card.scoreColor,
                      borderRadius: 3,
                    }}
                  />
                </div>
                {card.rows.map((row) => (
                  <div
                    key={row.ai}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 0",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#6B7280" }}>{row.ai}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: 9999,
                        background: row.bg,
                        color: row.color,
                      }}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}
                <div
                  style={{
                    borderTop: "1px solid #F3F4F6",
                    paddingTop: 12,
                    marginTop: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                    flex: 1,
                    alignSelf: "flex-end",
                    width: "100%",
                  }}
                >
                  <p style={{ fontSize: 13, color: "#6B7280", margin: 0, fontStyle: "italic", lineHeight: 1.5, flex: 1 }}>
                    {card.insight}
                  </p>
                  <button
                    onClick={() => setLocation(`/audit?url=${card.domain}`)}
                    style={{
                      fontSize: 12,
                      color: PRIMARY,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      fontWeight: 500,
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    Run it →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Stat banner */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3"
            style={{
              background: "#111827",
              borderRadius: 16,
              padding: "32px 40px",
            }}
          >
            {[
              { num: "24/100", label: "Average GEO IQ we found" },
              { num: "3/3", label: "Known brands scoring below 50" },
              { num: "0", label: "Founders who knew before GeoIQ" },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  textAlign: "center",
                  padding: "12px 0",
                  borderRight: "none",
                }}
                className={i < 2 ? "sm:border-r sm:border-white/10" : ""}
              >
                <div style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 700, color: "white", lineHeight: 1 }}>
                  {s.num}
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 32 }}>
            <button
              onClick={() => scrollToInput()}
              style={{
                height: 44,
                padding: "0 28px",
                background: PRIMARY,
                color: "white",
                border: "none",
                borderRadius: 9999,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = PRIMARY_HOVER)}
              onMouseLeave={(e) => (e.currentTarget.style.background = PRIMARY)}
            >
              Check your brand free →
            </button>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        id="how-it-works"
        style={{ background: "#F9FAFB", padding: "96px 24px" }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: PRIMARY,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              HOW IT WORKS
            </div>
            <h2
              style={{
                fontSize: "clamp(28px, 3.5vw, 40px)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#111827",
              }}
            >
              Your GEO IQ in 60 seconds
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Enter your URL",
                desc: "Type your website address. We handle the rest automatically.",
              },
              {
                step: "2",
                title: "We query 3 AI systems",
                desc: "We programmatically ask ChatGPT, Gemini and Perplexity about your brand using real buyer-intent prompts.",
              },
              {
                step: "3",
                title: "Get your GEO IQ score",
                desc: "See exactly where you are visible, where you are invisible, and what to do about it today.",
              },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background: PRIMARY,
                    color: "white",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 700,
                    margin: "0 auto 16px",
                  }}
                >
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
      <section style={{ background: "white", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: PRIMARY,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              PRICING
            </div>
            <h2
              style={{
                fontSize: "clamp(28px, 3.5vw, 40px)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#111827",
                marginBottom: 8,
              }}
            >
              Simple, honest pricing
            </h2>
            <p style={{ fontSize: 18, color: "#6B7280" }}>Start free. Upgrade when ready.</p>
          </div>
          <PricingCards />
        </div>
      </section>

      <Footer />
    </div>
  );
}
