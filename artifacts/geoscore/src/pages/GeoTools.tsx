import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";

const tools = [
  {
    name: "GEOscore",
    tagline: "Best for founders and startups in India",
    price: "Free audit + ₹3,999/mo",
    features: [
      "Free unlimited public audits",
      "ChatGPT, Gemini, Perplexity monitoring",
      "Daily score tracking",
      "Weekly email digest",
      "Competitor tracking",
      "AI-generated fix actions",
      "Razorpay payments (INR)",
      "India market optimized",
    ],
    rating: 5,
    highlight: true,
    url: "/",
    cta: "Start free →",
  },
  {
    name: "Profound.com",
    tagline: "Best for enterprise brands",
    price: "$99+/mo USD",
    features: [
      "Brand monitoring dashboard",
      "Share of voice tracking",
      "Multi-AI coverage",
      "Enterprise reporting",
      "API access",
      "Team seats included",
    ],
    rating: 4,
    highlight: false,
    url: "https://profound.com",
    cta: "Visit site →",
  },
  {
    name: "Otterly.ai",
    tagline: "Best for agencies",
    price: "$49+/mo USD",
    features: [
      "Multi-brand tracking",
      "White label reports",
      "Client dashboards",
      "ChatGPT + Gemini coverage",
      "Weekly reports",
    ],
    rating: 3,
    highlight: false,
    url: "https://otterly.ai",
    cta: "Visit site →",
  },
  {
    name: "Peec.ai",
    tagline: "Best for B2B SaaS",
    price: "$79+/mo USD",
    features: [
      "Competitor comparison",
      "Prompt testing suite",
      "Score trend charts",
      "Slack notifications",
      "API access",
    ],
    rating: 3,
    highlight: false,
    url: "https://peec.ai",
    cta: "Visit site →",
  },
];

const comparisonRows = [
  { feature: "Free audit (no signup)", geoscore: true, profound: false, otterly: false, peec: false },
  { feature: "INR pricing", geoscore: true, profound: false, otterly: false, peec: false },
  { feature: "ChatGPT monitoring", geoscore: true, profound: true, otterly: true, peec: true },
  { feature: "Gemini monitoring", geoscore: true, profound: true, otterly: true, peec: false },
  { feature: "Perplexity monitoring", geoscore: true, profound: true, otterly: false, peec: true },
  { feature: "Daily monitoring", geoscore: true, profound: true, otterly: false, peec: true },
  { feature: "Weekly email digest", geoscore: true, profound: false, otterly: true, peec: false },
  { feature: "AI fix recommendations", geoscore: true, profound: false, otterly: false, peec: false },
  { feature: "Competitor tracking", geoscore: true, profound: true, otterly: true, peec: true },
  { feature: "India market focus", geoscore: true, profound: false, otterly: false, peec: false },
];

function Stars({ count }: { count: number }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: 14 }}>
      {"★".repeat(count)}{"☆".repeat(5 - count)}
    </span>
  );
}

function Check({ value }: { value: boolean }) {
  return (
    <span style={{ color: value ? "#10b981" : "#d1d5db", fontSize: 16, fontWeight: 600 }}>
      {value ? "✓" : "—"}
    </span>
  );
}

export default function GeoTools() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
            <Link href="/" style={{ color: "#6b7280", textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <span>GEO Tools 2026</span>
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 600, color: "#111827", lineHeight: 1.3, marginBottom: 16 }}>
            Best GEO Tools 2026: AI Visibility Platforms Compared
          </h1>

          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 40 }}>
            By GEOscore Team · Updated May 2026 · 7 min read
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 24 }}>
            As AI search becomes the dominant way users discover products and services, a new category of tools has emerged to help brands track and improve their AI visibility. These platforms — called GEO (Generative Engine Optimization) tools — work like Google Search Console but for ChatGPT, Gemini, and Perplexity.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            We evaluated four GEO tools across features, pricing, and market focus. Here is our breakdown.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 24 }}>
            Why you need a GEO tool
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            Checking AI visibility manually means opening ChatGPT, typing dozens of prompts, noting whether your brand appeared, and doing that across three or four different systems. Even a single manual audit takes 30-45 minutes. Doing it weekly means two hours per month of tedious manual work with no historical data and no alerts when things change. A GEO tool automates this entirely — running hundreds of prompts daily and delivering the results as a clean score with trend charts.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 24 }}>
            Tool comparison
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 48 }}>
            {tools.map((tool) => (
              <div
                key={tool.name}
                style={{
                  border: tool.highlight ? "1.5px solid #534AB7" : "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 24,
                  position: "relative",
                  background: tool.highlight ? "#fafafe" : "white",
                }}
              >
                {tool.highlight && (
                  <div style={{ position: "absolute", top: -12, left: 20, background: "#534AB7", color: "white", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 9999 }}>
                    RECOMMENDED
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "#111827" }}>{tool.name}</div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{tool.tagline}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{tool.price}</div>
                    <Stars count={tool.rating} />
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {tool.features.map((f) => (
                    <span key={f} style={{ background: "#f3f4f6", color: "#374151", fontSize: 12, padding: "4px 10px", borderRadius: 9999 }}>
                      {f}
                    </span>
                  ))}
                </div>
                {tool.highlight ? (
                  <Link href={tool.url}>
                    <Button size="sm" style={{ background: "#534AB7", color: "white" }}>{tool.cta}</Button>
                  </Link>
                ) : (
                  <a href={tool.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">{tool.cta}</Button>
                  </a>
                )}
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            Feature comparison table
          </h2>

          <div style={{ overflowX: "auto", marginBottom: 48 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #e5e7eb", color: "#374151" }}>Feature</th>
                  {["GEOscore", "Profound", "Otterly", "Peec"].map((t) => (
                    <th key={t} style={{ padding: "12px 16px", textAlign: "center", borderBottom: "1px solid #e5e7eb", color: t === "GEOscore" ? "#534AB7" : "#374151", fontWeight: t === "GEOscore" ? 700 : 600 }}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ padding: "10px 16px", color: "#374151" }}>{row.feature}</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}><Check value={row.geoscore} /></td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}><Check value={row.profound} /></td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}><Check value={row.otterly} /></td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}><Check value={row.peec} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: "#534AB7", borderRadius: 16, padding: 32, textAlign: "center", marginBottom: 48 }}>
            <h3 style={{ color: "white", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Try GEOscore free — no signup, instant results
            </h3>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, marginBottom: 20 }}>
              Enter your domain and see your AI visibility score across ChatGPT, Gemini, and Perplexity in 60 seconds.
            </p>
            <Link href="/">
              <Button style={{ background: "white", color: "#534AB7", fontWeight: 600 }}>
                Check my score →
              </Button>
            </Link>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            How to choose the right GEO tool
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            For most early-stage founders and startups, GEOscore is the obvious starting point: the free audit requires no signup and gives you immediate data on where you stand. If you are building a product for Indian users, the INR pricing and India-specific monitoring (Gemini focus, Indian publication citations) make it the most directly useful tool.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            For enterprise brands with larger budgets and US/global focus, Profound.com offers more sophisticated share-of-voice tracking and team features. For agencies managing multiple client brands, Otterly's white-label reports and multi-brand dashboards add specific value.
          </p>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/what-is-geo" style={{ fontSize: 14, color: "#534AB7", textDecoration: "none" }}>
              ← What is GEO?
            </Link>
            <Link href="/how-to-rank-in-chatgpt" style={{ fontSize: 14, color: "#534AB7", textDecoration: "none" }}>
              How to rank in ChatGPT →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
