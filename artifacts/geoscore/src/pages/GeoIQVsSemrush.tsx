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
    <div style={{ color: "white", fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif", marginBottom: 10 }}>
      Check your AI visibility score free
    </div>
    <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, marginBottom: 22, lineHeight: 1.6 }}>
      No signup. No credit card. See exactly where you stand across ChatGPT, Gemini, and Perplexity in 60 seconds.
    </p>
    <Link href="/audit">
      <button style={{ background: "white", color: "#4F46E5", fontWeight: 700, fontSize: 15, padding: "12px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
        Run free audit
      </button>
    </Link>
  </div>
);

type RowStatus = "yes" | "no" | "partial";

interface CompareRow {
  feature: string;
  geoiq: RowStatus;
  geoiqNote?: string;
  semrush: RowStatus;
  semrushNote?: string;
}

const rows: CompareRow[] = [
  {
    feature: "Free audit (no signup)",
    geoiq: "yes", geoiqNote: "Unlimited free audits",
    semrush: "no", semrushNote: "Requires paid subscription",
  },
  {
    feature: "AI systems tracked",
    geoiq: "yes", geoiqNote: "ChatGPT, Gemini, Perplexity, Claude, Grok (5 systems)",
    semrush: "partial", semrushNote: "ChatGPT, Google AI, Gemini, Perplexity (4 systems, no Claude or Grok)",
  },
  {
    feature: "Custom prompt tracking",
    geoiq: "yes", geoiqNote: "Custom prompts per brand",
    semrush: "partial", semrushNote: "25 custom prompts per domain",
  },
  {
    feature: "Number of domains monitored",
    geoiq: "yes", geoiqNote: "Multiple brands (Starter), unlimited (Agency)",
    semrush: "partial", semrushNote: "1 domain per subscription on AI Visibility plan",
  },
  {
    feature: "Daily score tracking",
    geoiq: "yes",
    semrush: "yes", semrushNote: "Daily, weekly, monthly updates",
  },
  {
    feature: "Historical score trend",
    geoiq: "yes", geoiqNote: "Score trend graph in dashboard",
    semrush: "yes",
  },
  {
    feature: "Competitor comparison",
    geoiq: "yes",
    semrush: "yes", semrushNote: "AI competitor analysis and prompt research",
  },
  {
    feature: "Site AI-readiness audit",
    geoiq: "yes", geoiqNote: "robots.txt, llms.txt, schema checks",
    semrush: "yes", semrushNote: "Site audit for AI readiness",
  },
  {
    feature: "Indian market focus",
    geoiq: "yes", geoiqNote: "INR pricing, Indian publication signals (YourStory, Inc42), India-specific prompts",
    semrush: "no", semrushNote: "USD pricing, no India-specific tracking",
  },
  {
    feature: "Grok (xAI) tracking",
    geoiq: "yes",
    semrush: "no",
  },
  {
    feature: "Claude (Anthropic) tracking",
    geoiq: "yes",
    semrush: "no",
  },
  {
    feature: "llms.txt guidance",
    geoiq: "yes", geoiqNote: "Built-in llms.txt generator and guide",
    semrush: "no",
  },
  {
    feature: "Standalone AI visibility tool",
    geoiq: "yes", geoiqNote: "Purpose-built for AI visibility",
    semrush: "partial", semrushNote: "Add-on inside a large SEO platform (extra cost on top of base Semrush plan)",
  },
  {
    feature: "Price (entry paid plan)",
    geoiq: "yes", geoiqNote: "Rs 3,999/mo (~$48/mo)",
    semrush: "no", semrushNote: "$99/mo per domain billed annually (~Rs 8,300/mo) - plus base Semrush plan cost",
  },
];

function StatusCell({ status, note }: { status: RowStatus; note?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      {status === "yes" && <Check />}
      {status === "no" && <Cross />}
      {status === "partial" && <Partial />}
      <span style={{ fontSize: 14, color: note ? "#374151" : "#6B7280", lineHeight: 1.55 }}>
        {note ?? (status === "yes" ? "Yes" : status === "no" ? "No" : "Limited")}
      </span>
    </div>
  );
}

const schemaJson = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "GeoIQ vs Semrush AI Visibility: Which Tool Should You Use in 2026?",
  "author": { "@type": "Person", "name": "Tauheed" },
  "publisher": { "@type": "Organization", "name": "GeoIQ", "logo": { "@type": "ImageObject", "url": "https://geoiqai.com/favicon.svg" } },
  "datePublished": "2026-05-27",
  "dateModified": "2026-05-27",
  "description": "GeoIQ vs Semrush AI Visibility feature comparison. Pricing, AI systems tracked, Indian market focus, and which tool is right for your brand.",
  "url": "https://geoiqai.com/geoiq-vs-semrush",
};

export default function GeoIQVsSemrush() {
  useEffect(() => {
    document.title = "GeoIQ vs Semrush AI Visibility (2026) | Comparison";
    setMeta("description", "GeoIQ vs Semrush AI Visibility: side-by-side feature and pricing comparison. 5 AI systems vs 4, INR pricing, free audit, and India-specific tracking.");
    setMeta("og:title", "GeoIQ vs Semrush AI Visibility (2026)", true);
    setMeta("og:description", "GeoIQ tracks ChatGPT, Gemini, Perplexity, Claude, and Grok. Semrush AI Visibility tracks 4. See the full comparison.", true);
    setMeta("og:type", "article", true);
    setMeta("og:url", "https://geoiqai.com/geoiq-vs-semrush", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", "GeoIQ vs Semrush AI Visibility (2026)");
    setLink("canonical", "https://geoiqai.com/geoiq-vs-semrush");

    let script = document.querySelector('script[data-schema="geoiq-vs-semrush"]') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-schema", "geoiq-vs-semrush");
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schemaJson);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'Inter', sans-serif" }}>
      <Navbar />

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 20px 80px" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 28, fontSize: 13, color: "#6B7280" }}>
          <Link href="/" style={{ color: "#6B7280", textDecoration: "none" }}>Home</Link>
          <span>/</span>
          <span style={{ color: "#374151" }}>GeoIQ vs Semrush</span>
        </div>

        {/* Hero */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "inline-block", background: "#EEF2FF", color: "#4F46E5", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20, marginBottom: 16, letterSpacing: "0.04em" }}>
            COMPARISON
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.2, marginBottom: 16 }}>
            GeoIQ vs Semrush AI Visibility: Which one actually tracks AI search?
          </h1>
          <p style={{ fontSize: 17, color: "#374151", lineHeight: 1.75, marginBottom: 0 }}>
            Semrush launched an AI Visibility add-on in 2025. It is a solid first step, especially if you already pay for Semrush. But it tracks 4 AI systems, prices in USD, and costs $99/mo per domain on top of your existing Semrush subscription. GeoIQ is built specifically for AI visibility from day one - 5 systems, INR pricing, free audit, and India-specific signals. Here is the full breakdown.
          </p>
        </div>

        {/* Quick verdict */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 48 }}>
          <div style={{ background: "#EEF2FF", border: "2px solid #4F46E5", borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Syne', sans-serif", color: "#4F46E5", marginBottom: 8 }}>GeoIQ</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Rs 3,999/mo</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>Starter plan, or free forever</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {["5 AI systems (incl. Claude + Grok)", "Free audit, no signup", "INR pricing, India-focused", "Built only for AI visibility"].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151" }}>
                  <Check /> {f}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Syne', sans-serif", color: "#374151", marginBottom: 8 }}>Semrush AI Visibility</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 4 }}>$99/mo per domain</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>Billed annually, plus base Semrush plan</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {["4 AI systems (no Claude, no Grok)", "Requires paid subscription to start", "USD pricing only", "Add-on inside broader SEO suite"].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151" }}>
                  <Partial /> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Feature comparison table */}
        <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#111827", marginBottom: 20 }}>
          Feature-by-feature comparison
        </h2>

        <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 48 }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", background: "#F3F4F6" }}>
            <div style={{ padding: "14px 20px", fontSize: 13, fontWeight: 700, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>Feature</div>
            <div style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "#4F46E5", borderBottom: "1px solid #E5E7EB", borderLeft: "1px solid #E5E7EB" }}>GeoIQ</div>
            <div style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "#374151", borderBottom: "1px solid #E5E7EB", borderLeft: "1px solid #E5E7EB" }}>Semrush AI Visibility</div>
          </div>
          {rows.map((row, i) => (
            <div key={row.feature} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
              <div style={{ padding: "14px 20px", fontSize: 14, fontWeight: 500, color: "#111827", lineHeight: 1.5, borderBottom: i < rows.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                {row.feature}
              </div>
              <div style={{ padding: "14px 16px", borderLeft: "1px solid #F3F4F6", borderBottom: i < rows.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                <StatusCell status={row.geoiq} note={row.geoiqNote} />
              </div>
              <div style={{ padding: "14px 16px", borderLeft: "1px solid #F3F4F6", borderBottom: i < rows.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                <StatusCell status={row.semrush} note={row.semrushNote} />
              </div>
            </div>
          ))}
        </div>

        <CTA />

        {/* Pricing section */}
        <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#111827", marginBottom: 16, marginTop: 48 }}>
          Pricing comparison
        </h2>
        <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.75, marginBottom: 24 }}>
          Semrush AI Visibility costs $99/mo per domain billed annually - roughly Rs 8,300/mo at current exchange rates. That is before your base Semrush subscription, which starts at $140/mo. So realistically you are looking at $240+/mo to get Semrush plus its AI Visibility add-on for a single domain.
        </p>
        <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.75, marginBottom: 24 }}>
          GeoIQ Starter is Rs 3,999/mo and covers multiple brands. The Agency plan at Rs 11,999/mo covers unlimited brands. There is no base subscription cost - GeoIQ is the whole product, not an add-on.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 48 }}>
          {[
            { name: "GeoIQ Free", price: "Rs 0", note: "Public audit, no signup", highlight: false },
            { name: "GeoIQ Starter", price: "Rs 3,999/mo", note: "Multiple brands, daily tracking", highlight: true },
            { name: "GeoIQ Agency", price: "Rs 11,999/mo", note: "Unlimited brands, white-label", highlight: false },
            { name: "Semrush AI Visibility", price: "~Rs 8,300/mo", note: "$99/mo per domain + base plan not included", highlight: false },
          ].map(plan => (
            <div key={plan.name} style={{
              background: plan.highlight ? "#EEF2FF" : "white",
              border: `1px solid ${plan.highlight ? "#4F46E5" : "#E5E7EB"}`,
              borderRadius: 10,
              padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: plan.highlight ? "#4F46E5" : "#6B7280", marginBottom: 6 }}>{plan.name}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{plan.price}</div>
              <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>{plan.note}</div>
            </div>
          ))}
        </div>

        {/* AI systems section */}
        <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#111827", marginBottom: 16 }}>
          Which AI systems does each tool track?
        </h2>
        <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.75, marginBottom: 20 }}>
          This is probably the biggest functional gap. Semrush tracks ChatGPT, Google AI, Gemini, and Perplexity - four systems. That covers the majority of AI search volume today. But Claude (Anthropic) and Grok (xAI) are growing fast, and Semrush does not track either.
        </p>
        <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.75, marginBottom: 28 }}>
          GeoIQ tracks all five: ChatGPT, Gemini, Perplexity, Claude, and Grok. As AI search fragments across more systems, that coverage gap matters more over time.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 48 }}>
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#4F46E5", marginBottom: 14, fontFamily: "'Syne', sans-serif" }}>GeoIQ tracks</div>
            {["ChatGPT (OpenAI)", "Gemini (Google)", "Perplexity", "Claude (Anthropic)", "Grok (xAI)"].map(s => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14, color: "#111827" }}>
                <Check /> {s}
              </div>
            ))}
          </div>
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 14, fontFamily: "'Syne', sans-serif" }}>Semrush AI Visibility tracks</div>
            {[
              { name: "ChatGPT (OpenAI)", ok: true },
              { name: "Google AI / Gemini", ok: true },
              { name: "Perplexity", ok: true },
              { name: "Claude (Anthropic)", ok: false },
              { name: "Grok (xAI)", ok: false },
            ].map(s => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14, color: s.ok ? "#111827" : "#9CA3AF" }}>
                {s.ok ? <Check color="#10B981" /> : <Cross />} {s.name}
              </div>
            ))}
          </div>
        </div>

        {/* India section */}
        <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#111827", marginBottom: 16 }}>
          What about Indian brands?
        </h2>
        <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.75, marginBottom: 16 }}>
          Semrush is a global tool priced and designed for global (mostly US/EU) companies. If you are an Indian startup, you are paying $99/mo in USD with no special consideration for Indian publication signals, Indian audience search patterns, or the way Gemini weights regional sources.
        </p>
        <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.75, marginBottom: 32 }}>
          GeoIQ is built for the Indian market. INR pricing removes currency risk. The audit engine specifically checks YourStory, Inc42, and other Indian publications as citation signals for Gemini. Prompts are tuned for how Indian users actually ask questions - "best fintech app in India" versus generic global queries. For founders building products for India, that specificity matters.
        </p>

        {/* When to use each */}
        <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#111827", marginBottom: 16 }}>
          When to use each
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 48 }}>
          <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#4F46E5", marginBottom: 14, fontFamily: "'Syne', sans-serif" }}>Use GeoIQ if you...</div>
            {[
              "Are an Indian startup or targeting Indian users",
              "Want a free audit before committing to any paid plan",
              "Need Claude and Grok tracking alongside the big four",
              "Are tracking multiple brands or client accounts",
              "Want a tool built entirely around AI visibility, not an SEO add-on",
            ].map(r => (
              <div key={r} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10, fontSize: 14, color: "#1E1B4B", lineHeight: 1.5 }}>
                <Check /> {r}
              </div>
            ))}
          </div>
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#374151", marginBottom: 14, fontFamily: "'Syne', sans-serif" }}>Consider Semrush if you...</div>
            {[
              "Already pay for Semrush and want to add AI tracking in one place",
              "Primarily need SEO plus AI visibility in a single platform",
              "Are a global/US company with USD budget",
              "Need deep SEO features alongside AI visibility",
            ].map(r => (
              <div key={r} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                <Partial /> {r}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom line */}
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 28, marginBottom: 48 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#111827", marginBottom: 10, fontFamily: "'Syne', sans-serif" }}>Bottom line</div>
          <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.75, margin: 0 }}>
            If you are comparing tools specifically to track AI visibility, GeoIQ covers more AI systems, costs less, does not require a base subscription, and has a free tier you can use today without entering a credit card. Semrush AI Visibility makes sense if you already live inside Semrush and want to add AI tracking without switching tools - but you will pay more and track fewer AI systems.
          </p>
        </div>

        <CTA />

        {/* Related */}
        <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#6B7280", marginBottom: 16, letterSpacing: "0.05em" }}>RELATED READING</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { href: "/what-is-geo", label: "What is GEO? Generative Engine Optimization explained" },
              { href: "/ai-visibility-score", label: "What is an AI visibility score and how is it calculated?" },
              { href: "/blog/geo-vs-seo-2026", label: "GEO vs SEO in 2026: what changes and what stays the same" },
              { href: "/llms-txt-guide", label: "llms.txt guide: make your site readable by AI systems" },
            ].map(link => (
              <Link key={link.href} href={link.href} style={{ color: "#4F46E5", fontSize: 15, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                {link.label} <span style={{ fontSize: 12 }}>-&gt;</span>
              </Link>
            ))}
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
