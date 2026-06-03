import { useEffect } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

function setMeta(name: string, content: string, isProperty = false) {
  const attr = isProperty ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
  el.setAttribute("href", href);
}

const Check = ({ color = "#4F46E5" }: { color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="9" cy="9" r="9" fill={color} fillOpacity="0.12" />
    <path d="M5 9l3 3 5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Cross = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="9" cy="9" r="9" fill="#EF4444" fillOpacity="0.1" />
    <path d="M6 6l6 6M12 6l-6 6" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const Partial = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="9" cy="9" r="9" fill="#F59E0B" fillOpacity="0.12" />
    <path d="M5.5 9h7" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CTA = () => (
  <div style={{ background: "linear-gradient(135deg, #4F46E5 0%, #0891B2 100%)", borderRadius: 14, padding: "32px 28px", textAlign: "center", margin: "48px 0" }}>
    <div style={{ fontSize: 22, fontWeight: 700, color: "white", marginBottom: 8 }}>Try GeoIQ free today</div>
    <div style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", marginBottom: 24 }}>Free audit in 60 seconds. No signup. Track ChatGPT, Gemini, Perplexity, Claude, and Grok.</div>
    <Link href="/audit">
      <button style={{ background: "white", color: "#4F46E5", border: "none", borderRadius: 9, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Run free audit
      </button>
    </Link>
  </div>
);

const faqItems = [
  { q: "Is GeoIQ better than Profound?", a: "It depends on your use case. GeoIQ is better for founders and startups who want a fast, affordable way to track AI visibility with a free audit, INR pricing, and a built-in GEO Agent. Profound is stronger for enterprise teams who need multi-region tracking, advanced analytics, and agency-grade reporting. If you're a startup or indie founder, GeoIQ is the right starting point." },
  { q: "Does Profound have a free plan?", a: "Profound does not offer a free public audit or a free tier as of 2026. GeoIQ offers a completely free audit for any domain - no signup, no email, no credit card required. You get a full GEO score across ChatGPT, Gemini, Perplexity, Claude, and Grok in 60 seconds." },
  { q: "Does Profound support Indian startups?", a: "Profound is a US-focused tool with USD pricing. It does not have India-specific features, INR billing, or a free tier that works for early-stage Indian startups. GeoIQ is the only AI visibility tool built specifically for the Indian market, with Razorpay billing, INR pricing, and tracking calibrated for Gemini's India-specific knowledge graph." },
  { q: "Which AI systems does GeoIQ track?", a: "GeoIQ tracks 6 AI systems: ChatGPT, Gemini, Perplexity, Claude, Grok, and Google AI Overview. Profound tracks a similar set of major LLMs focused on the US market. For most startups, the 6 systems GeoIQ monitors cover the AI search channels where your customers are actually doing research." },
  { q: "Can I use both GeoIQ and Profound?", a: "Yes, and some enterprise teams do this when they want both startup-friendly pricing for day-to-day monitoring (GeoIQ) and Profound's deeper analytics for quarterly reports. For most founders, GeoIQ alone is sufficient. Start with GeoIQ's free audit and paid plans before adding another tool on top." },
  { q: "What is the price difference between GeoIQ and Profound?", a: "GeoIQ's Starter plan is Rs 3,999/month (roughly $48/month at current rates) and the Agency plan is Rs 11,999/month. Profound's pricing starts around $99/month and scales significantly for agency use. GeoIQ is significantly cheaper for Indian teams and comparable or cheaper in USD terms for most use cases." },
];

const compRows = [
  { feature: "Free public audit", geoiq: "check", profound: "cross", note: "" },
  { feature: "Signup required to audit", geoiq: "cross", profound: "check", note: "" },
  { feature: "AI systems tracked", geoiq: "6 (ChatGPT, Gemini, Perplexity, Claude, Grok, AI Overview)", profound: "partial", note: "Profound covers major LLMs" },
  { feature: "INR pricing (Razorpay)", geoiq: "check", profound: "cross", note: "" },
  { feature: "India-specific tracking", geoiq: "check", profound: "cross", note: "" },
  { feature: "Built-in GEO Agent", geoiq: "check", profound: "cross", note: "" },
  { feature: "Competitor tracking", geoiq: "check", profound: "check", note: "" },
  { feature: "Keyword/prompt tracking", geoiq: "check", profound: "check", note: "" },
  { feature: "Technical site audit", geoiq: "check", profound: "partial", note: "" },
  { feature: "API access", geoiq: "check", profound: "check", note: "" },
  { feature: "Enterprise reporting", geoiq: "partial", profound: "check", note: "Profound is stronger here" },
  { feature: "Starting price (USD equiv.)", geoiq: "~$48/mo", profound: "~$99/mo", note: "" },
];

export default function GeoIQVsProfound() {
  useEffect(() => {
    document.title = "GeoIQ vs Profound (2026): Which AI Visibility Tool Is Better?";
    setMeta("description", "Honest comparison of GeoIQ AI vs Profound for brand visibility tracking across ChatGPT, Gemini and Perplexity. Pricing, features, verdict.");
    setMeta("og:title", "GeoIQ vs Profound (2026): Which AI Visibility Tool Is Better?", true);
    setMeta("og:description", "Honest comparison of GeoIQ AI vs Profound for brand visibility tracking across ChatGPT, Gemini and Perplexity. Pricing, features, verdict.", true);
    setMeta("og:type", "article", true);
    setMeta("og:url", "https://geoiqai.com/geoiq-vs-profound", true);
    setMeta("og:image", "https://geoiqai.com/opengraph.jpg", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", "GeoIQ vs Profound (2026): Which AI Visibility Tool Is Better?");
    setMeta("twitter:description", "Honest comparison of GeoIQ vs Profound for AI visibility. Pricing, features, free audit, INR support.");
    setLink("canonical", "https://geoiqai.com/geoiq-vs-profound");
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Navbar />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "56px 24px 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ background: "#EDE9FE", color: "#5B3FEA", borderRadius: 9999, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>Tool comparison</span>
            <span style={{ background: "#F3F4F6", color: "#374151", borderRadius: 9999, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>Updated 2026</span>
          </div>
          <h1 style={{ fontSize: "clamp(26px, 5vw, 38px)", fontWeight: 700, color: "#111827", lineHeight: 1.2, marginBottom: 16 }}>
            GeoIQ vs Profound: which AI visibility tool is better for your startup?
          </h1>
          <p style={{ fontSize: 17, color: "#4B5563", lineHeight: 1.7 }}>
            Both GeoIQ and Profound help you track how your brand appears in AI answers. This is an honest, feature-by-feature comparison written by the GeoIQ team. We'll tell you when Profound is the better choice too.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 40 }}>
          {[
            { name: "GeoIQ", tagline: "Best for founders, startups, and Indian teams", price: "Free audit + from Rs 3,999/mo", highlight: "#5B3FEA" },
            { name: "Profound", tagline: "Best for enterprise teams needing deep analytics", price: "From ~$99/mo, no free tier", highlight: "#374151" },
          ].map((tool) => (
            <div key={tool.name} style={{ background: "white", border: `1.5px solid ${tool.highlight === "#5B3FEA" ? "#C4B5FD" : "#E5E7EB"}`, borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: tool.highlight, marginBottom: 4 }}>{tool.name}</div>
              <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 8 }}>{tool.tagline}</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>{tool.price}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Feature comparison</h2>
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 40 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", padding: "10px 16px", gap: 8 }}>
            {["Feature", "GeoIQ", "Profound"].map(h => (
              <div key={h} style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
            ))}
          </div>
          {compRows.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "12px 16px", gap: 8, borderBottom: i < compRows.length - 1 ? "1px solid #F3F4F6" : "none", background: i % 2 === 0 ? "white" : "#FAFAFA", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, color: "#111827" }}>{row.feature}</div>
                {row.note && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{row.note}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {row.geoiq === "check" ? <Check /> : row.geoiq === "cross" ? <Cross /> : row.geoiq === "partial" ? <Partial /> : <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{row.geoiq}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {row.profound === "check" ? <Check color="#374151" /> : row.profound === "cross" ? <Cross /> : row.profound === "partial" ? <Partial /> : <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{row.profound}</span>}
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 16 }}>The verdict</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40 }}>
          {[
            {
              title: "Choose GeoIQ if...",
              color: "#5B3FEA",
              bg: "#EDE9FE",
              points: [
                "You're a startup or indie founder with a limited budget",
                "You want to start with a free audit right now, no signup",
                "You're based in India and need INR pricing via Razorpay",
                "You want a built-in GEO Agent for content and fix recommendations",
                "You want to track 6 AI systems including Grok and Google AI Overview",
              ],
            },
            {
              title: "Choose Profound if...",
              color: "#374151",
              bg: "#F3F4F6",
              points: [
                "You're an enterprise or agency managing 20+ brands",
                "You need detailed analytics dashboards for client reporting",
                "USD billing and enterprise SLAs matter for your procurement team",
                "You need multi-region tracking across US, EU, and APAC markets",
              ],
            },
          ].map((section) => (
            <div key={section.title} style={{ background: section.bg, borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: section.color, marginBottom: 12 }}>{section.title}</div>
              {section.points.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < section.points.length - 1 ? 8 : 0, alignItems: "flex-start" }}>
                  <Check color={section.color} />
                  <span style={{ fontSize: 14, color: "#374151" }}>{p}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <CTA />

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 20 }}>Frequently asked questions</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faqItems.map((item, i) => (
            <div key={i} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 6 }}>{item.q}</div>
              <div style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
