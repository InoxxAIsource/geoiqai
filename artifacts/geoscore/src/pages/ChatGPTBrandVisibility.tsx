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

const faqItems = [
  { q: "Why isn't my brand showing up in ChatGPT?", a: "The most common reasons are: AI crawlers blocked in robots.txt, no llms.txt file, fewer than 10 third-party citations on authoritative platforms (G2, Crunchbase, ProductHunt), no Organization schema markup, and inconsistent brand descriptions across sources. A GeoIQ audit tells you exactly which factor is hurting you most." },
  { q: "How does ChatGPT decide which brands to mention?", a: "ChatGPT pulls from its training data and, in browse mode, from real-time web sources. For training data, citation count and authority of the sources matter most. For browse mode, your domain's authority, llms.txt, and schema markup affect how reliably you appear. Consistent, factual descriptions across many sources create a strong entity signal." },
  { q: "How many citations do I need to appear in ChatGPT?", a: "There's no exact threshold, but brands that regularly appear in ChatGPT typically have 15+ citations on high-authority platforms (G2, TechCrunch, YourStory, Crunchbase, ProductHunt) and a consistent brand description across all of them. Start with the top 5 platforms in your category and build from there." },
  { q: "Does ChatGPT index my website directly?", a: "OpenAI's crawler (OAI-SearchBot) does index websites, but training data is the bigger factor for most brands. Your website content matters when ChatGPT uses browse mode or when users are asking about you specifically. Make sure your homepage has a clear, factual description of your product in the first paragraph." },
  { q: "How long does it take to appear in ChatGPT?", a: "For ChatGPT's training data, new citations take months to reflect since model retraining happens on a schedule. For ChatGPT's browse mode (search-enabled), improvements in domain authority and on-page content can show results faster, sometimes within weeks. This is why ongoing monitoring matters." },
  { q: "What is GEO and how is it different from SEO?", a: "SEO (Search Engine Optimization) optimizes for Google rankings. GEO (Generative Engine Optimization) optimizes for AI recommendation engines like ChatGPT, Gemini, and Perplexity. The tactics overlap partially (citations, authority, clear content) but GEO also requires llms.txt, entity consistency, and structured data that AI systems can parse directly." },
];

const steps = [
  {
    n: 1,
    title: "Audit where you stand today",
    body: "Run a free GeoIQ audit to see your current ChatGPT visibility score. You need a baseline before you can improve. The audit checks all six AI systems in 60 seconds and tells you exactly where your brand is and isn't appearing.",
    time: "5 min",
  },
  {
    n: 2,
    title: "Fix your robots.txt",
    body: "Check that you haven't accidentally blocked OAI-SearchBot (OpenAI's crawler) or CCBot (Common Crawl). Many founders add blanket bot-blocking rules that prevent AI training data collection. Add an explicit allow rule for these crawlers.",
    time: "10 min",
  },
  {
    n: 3,
    title: "Create an llms.txt file",
    body: "Add a plain text file at yourdomain.com/llms.txt describing your brand, product, and key pages. This is the AI equivalent of a sitemap. Include your brand name, one-sentence description, target market, and links to your key pages.",
    time: "15 min",
  },
  {
    n: 4,
    title: "Add Organization schema to your homepage",
    body: "Add JSON-LD Organization schema markup to your homepage head. This gives AI systems machine-readable confirmation of your brand name, description, URL, and social profiles. Gemini and Bing AI use this directly for entity recognition.",
    time: "20 min",
    code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Brand",
  "url": "https://yourdomain.com",
  "description": "One precise sentence about your product.",
  "foundingDate": "2023",
  "sameAs": [
    "https://linkedin.com/company/yourbrand",
    "https://twitter.com/yourbrand",
    "https://crunchbase.com/organization/yourbrand"
  ]
}
</script>`,
  },
  {
    n: 5,
    title: "Build citations on authoritative platforms",
    body: "Get your brand listed and described consistently on G2, Crunchbase, ProductHunt, and industry-specific directories. For Indian startups, add YourStory, Inc42, and Entrackr. Each high-authority citation strengthens your entity signal.",
    time: "2-4 hours",
  },
  {
    n: 6,
    title: "Standardize your brand description everywhere",
    body: "Pick one precise sentence describing your product and use it identically across your homepage, About page, LinkedIn bio, Twitter bio, and every platform listing. Inconsistency creates weak, conflicting entity signals that AI systems cannot confidently cite.",
    time: "1 hour",
  },
  {
    n: 7,
    title: "Create factual, citation-worthy content",
    body: "Publish content that makes factual, specific claims about your product, use cases, and customer results. Vague marketing copy ('we help businesses grow') doesn't get cited. Specific facts ('reduces onboarding time by 40%') do. Target the exact queries your customers ask AI systems.",
    time: "Ongoing",
  },
  {
    n: 8,
    title: "Monitor and track your progress",
    body: "ChatGPT visibility changes as models update and new training data is indexed. Set up weekly monitoring with GeoIQ so you catch drops immediately and can respond. The brands that maintain AI visibility are the ones that treat it as an ongoing channel, not a one-time fix.",
    time: "Ongoing",
  },
];

export default function ChatGPTBrandVisibility() {
  useEffect(() => {
    document.title = "ChatGPT Brand Visibility: How to Get Your Brand Cited by ChatGPT (2026)";
    setMeta("description", "Learn why your brand isn't appearing in ChatGPT answers and how to fix it. Free audit tool included. Trusted by Indian startups.");
    setMeta("og:title", "ChatGPT Brand Visibility: How to Get Your Brand Cited by ChatGPT (2026)", true);
    setMeta("og:description", "Learn why your brand isn't appearing in ChatGPT answers and how to fix it. Free audit tool included. Trusted by Indian startups.", true);
    setMeta("og:type", "article", true);
    setMeta("og:url", "https://geoiqai.com/chatgpt-brand-visibility", true);
    setMeta("og:image", "https://geoiqai.com/opengraph.jpg", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", "ChatGPT Brand Visibility: How to Get Cited by ChatGPT (2026)");
    setMeta("twitter:description", "Learn why your brand isn't appearing in ChatGPT answers and how to fix it. Free audit included.");
    setLink("canonical", "https://geoiqai.com/chatgpt-brand-visibility");
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Navbar />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ background: "#EDE9FE", color: "#5B3FEA", borderRadius: 9999, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>ChatGPT</span>
            <span style={{ background: "#F3F4F6", color: "#374151", borderRadius: 9999, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>GEO Guide 2026</span>
          </div>
          <h1 style={{ fontSize: "clamp(26px, 5vw, 38px)", fontWeight: 700, color: "#111827", lineHeight: 1.2, marginBottom: 16 }}>
            ChatGPT brand visibility: how to get your brand cited by ChatGPT
          </h1>
          <p style={{ fontSize: 17, color: "#4B5563", lineHeight: 1.7, marginBottom: 24 }}>
            Most brands are invisible in ChatGPT. Not because they aren't good products, but because ChatGPT has never seen a reliable, consistent description of what they do. This guide covers exactly why that happens and what to do about it, in order of impact.
          </p>
          <div style={{ background: "#EDE9FE", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#3730A3", marginBottom: 2 }}>Check your ChatGPT visibility now</div>
              <div style={{ fontSize: 13, color: "#5B3FEA" }}>Free audit in 60 seconds. No signup needed.</div>
            </div>
            <Link href="/audit">
              <button style={{ background: "#5B3FEA", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                Run free audit
              </button>
            </Link>
          </div>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Why your brand isn't in ChatGPT</h2>
        <p style={{ fontSize: 15, color: "#4B5563", lineHeight: 1.7, marginBottom: 24 }}>
          ChatGPT builds its knowledge from training data (web crawls, curated datasets) and, in browse mode, from live web results. For your brand to appear, ChatGPT needs to have encountered your brand name paired with a clear, consistent description across multiple authoritative sources. If it has only seen you once, or if different sources describe you differently, it won't confidently recommend you.
        </p>

        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px", marginBottom: 40 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 12 }}>The four signals ChatGPT uses to decide whether to cite a brand</div>
          {[
            { label: "Citation count", desc: "How many authoritative sources mention your brand by name" },
            { label: "Entity consistency", desc: "Whether your brand name and description are identical across sources" },
            { label: "Domain authority", desc: "Whether sources that cite you are trusted by search engines and AI crawlers" },
            { label: "Structured data", desc: "Whether your website has machine-readable schema markup confirming your identity" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 3 ? 12 : 0, alignItems: "flex-start" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#EDE9FE", color: "#5B3FEA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{s.label}: </span>
                <span style={{ fontSize: 14, color: "#6B7280" }}>{s.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 20 }}>8 steps to improve your ChatGPT visibility</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 48 }}>
          {steps.map((step) => (
            <div key={step.n} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#5B3FEA", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{step.n}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{step.title}</div>
                    <span style={{ background: "#F3F4F6", color: "#6B7280", borderRadius: 9999, padding: "2px 10px", fontSize: 11, fontWeight: 500, whiteSpace: "nowrap" }}>{step.time}</span>
                  </div>
                  <p style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.6, margin: 0 }}>{step.body}</p>
                  {step.code && (
                    <pre style={{ background: "#1E1E2E", color: "#CDD6F4", borderRadius: 8, padding: "12px 16px", fontSize: 12, lineHeight: 1.6, overflow: "auto", marginTop: 12 }}>
                      <code>{step.code}</code>
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "20px 24px", marginBottom: 48 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#15803D", marginBottom: 8 }}>Quick wins vs long-term plays</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6 }}>This week (quick wins)</div>
              {["Fix robots.txt", "Create llms.txt", "Add Organization schema", "Claim and complete Crunchbase profile"].map((item, i) => (
                <div key={i} style={{ fontSize: 13, color: "#4B5563", marginBottom: 4, display: "flex", gap: 6 }}>
                  <span style={{ color: "#16A34A" }}>+</span>{item}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6 }}>This month (compounding)</div>
              {["Get 10+ platform listings", "Standardize brand description everywhere", "Publish citation-worthy content", "Set up weekly visibility monitoring"].map((item, i) => (
                <div key={i} style={{ fontSize: 13, color: "#4B5563", marginBottom: 4, display: "flex", gap: 6 }}>
                  <span style={{ color: "#16A34A" }}>+</span>{item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 20 }}>Frequently asked questions</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 48 }}>
          {faqItems.map((item, i) => (
            <div key={i} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 6 }}>{item.q}</div>
              <div style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "linear-gradient(135deg, #4F46E5 0%, #0891B2 100%)", borderRadius: 14, padding: "32px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "white", marginBottom: 8 }}>See your ChatGPT visibility score</div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", marginBottom: 24 }}>Free audit across ChatGPT, Gemini, Perplexity, Claude, and Grok. 60 seconds. No signup.</div>
          <Link href="/audit">
            <button style={{ background: "white", color: "#4F46E5", border: "none", borderRadius: 9, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Run free audit
            </button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
