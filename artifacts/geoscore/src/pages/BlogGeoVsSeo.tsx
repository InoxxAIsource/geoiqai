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

const P = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.85, marginBottom: 18, ...style }}>{children}</p>
);
const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#111827", marginBottom: 14, marginTop: 40, lineHeight: 1.3 }}>{children}</h2>
);
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1E1B4B", marginBottom: 10, marginTop: 24, fontFamily: "'Syne', sans-serif" }}>{children}</h3>
);

const ShareButtons = ({ url, title }: { url: string; title: string }) => (
  <div style={{ display: "flex", gap: 10, margin: "32px 0" }}>
    <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#000", color: "white", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 6, textDecoration: "none" }}>
      Share on X
    </a>
    <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#0A66C2", color: "white", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 6, textDecoration: "none" }}>
      Share on LinkedIn
    </a>
  </div>
);

const CTA = () => (
  <div style={{ background: "#4F46E5", borderRadius: 14, padding: "28px 28px", textAlign: "center", margin: "40px 0" }}>
    <div style={{ color: "white", fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>Check your GEO score free</div>
    <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 18, lineHeight: 1.6 }}>See where you stand across ChatGPT, Gemini, Perplexity, and more in 60 seconds. No signup required.</p>
    <Link href="/">
      <button style={{ background: "white", color: "#4F46E5", fontWeight: 700, fontSize: 14, padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
        Check my GEO score →
      </button>
    </Link>
  </div>
);

const faqItems = [
  { q: "What is the difference between GEO and SEO?", a: "SEO (Search Engine Optimization) improves your visibility in Google's organic search results. GEO (Generative Engine Optimization) improves how often AI systems like ChatGPT, Gemini, and Perplexity cite your brand in their responses. The signals that drive SEO (page rank, keyword matching, backlinks) and GEO (citation frequency, entity recognition, structured data) overlap but are not the same." },
  { q: "Should I do GEO or SEO first?", a: "For new brands (under 2 years old), GEO should be the priority because AI visibility is easier to build from scratch than Google authority, and the competitive landscape in AI recommendations is far less saturated than in Google search. For established brands with existing SEO investment, add GEO without reducing SEO effort - many technical SEO improvements also help GEO." },
  { q: "Does good SEO automatically mean good GEO?", a: "No. The overlap between top Google results and AI-cited sources dropped from 70% to below 20% in 2026. A brand can rank #1 on Google and have a GEO score of 0. SEO ranking helps GEO indirectly (high-authority pages are more likely to be in AI training data) but does not guarantee it." },
  { q: "Do backlinks help both SEO and GEO?", a: "Yes, but differently. For SEO, backlinks from high-DA sites improve your domain authority and ranking. For GEO, the same backlinks are citations - each one is a signal that AI training data picks up. A TechCrunch mention helps your Google rank (SEO) and also adds a training-data citation (GEO). The benefit compounds." },
  { q: "What is the most important GEO action for a new startup?", a: "Creating a Crunchbase profile. It takes 20 minutes, is indexed by Google with high authority, is explicitly included in AI training crawls, and establishes your brand as a globally-recognized entity rather than just a local website. After Crunchbase: ProductHunt, G2, and llms.txt." },
  { q: "Is GEO just a trend or is it here to stay?", a: "The underlying driver - users shifting discovery behavior to AI assistants - is structural, not a trend. Gartner forecasts 25% of traditional search volume will shift to AI by 2026. That trajectory does not reverse. GEO is as durable as the shift to AI-assisted search, which every major technology company (Google, Microsoft, OpenAI, Anthropic) is actively accelerating." },
  { q: "Can GEO hurt my SEO?", a: "No. GEO actions do not negatively impact SEO. They either are neutral (llms.txt, Organization schema) or directly beneficial (citation building, high-quality content). The worst-case scenario of a GEO action is that it does nothing for your Google rankings - but it also will not hurt them." },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "GEO vs SEO in 2026: Where Should You Focus?",
  "author": { "@type": "Person", "name": "Tauheed" },
  "publisher": { "@type": "Organization", "name": "GeoIQ", "logo": { "@type": "ImageObject", "url": "https://geoiqai.com/favicon.svg" } },
  "datePublished": "2026-05-25",
  "dateModified": "2026-05-25",
  "description": "AI search is eating traditional search. But should you abandon SEO for GEO? The honest answer - and what to prioritize first.",
  "url": "https://geoiqai.com/blog/geo-vs-seo-2026",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://geoiqai.com/blog/geo-vs-seo-2026" },
};
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItems.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })),
};

const PAGE_URL = "https://geoiqai.com/blog/geo-vs-seo-2026";
const PAGE_TITLE = "GEO vs SEO in 2026: Where Should You Focus?";

export default function BlogGeoVsSeo() {
  useEffect(() => {
    document.title = `${PAGE_TITLE} | GeoIQ Blog`;
    setMeta("description", "AI search is eating traditional search. But should you abandon SEO for GEO? The honest answer - and what to prioritize first.");
    setMeta("og:title", `${PAGE_TITLE} | GeoIQ Blog`, true);
    setMeta("og:description", "AI search is eating traditional search. Should you abandon SEO for GEO? The honest answer.", true);
    setMeta("og:url", PAGE_URL, true);
    setMeta("og:type", "article", true);
    setLink("canonical", PAGE_URL);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "white" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <article style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>

          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 18 }}>
            <Link href="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <Link href="/blog" style={{ color: "#9CA3AF", textDecoration: "none" }}>Blog</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <span>GEO vs SEO in 2026</span>
          </div>

          <h1 style={{ fontSize: 34, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.2, marginBottom: 14 }}>
            GEO vs SEO in 2026: Where Should You Focus?
          </h1>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#9CA3AF", marginBottom: 10, flexWrap: "wrap" }}>
            <span>By Tauheed</span>
            <span>·</span>
            <span>May 25, 2026</span>
            <span>·</span>
            <span>9 min read</span>
          </div>

          <ShareButtons url={PAGE_URL} title={PAGE_TITLE} />

          <div style={{ background: "#EEF2FF", borderLeft: "4px solid #4F46E5", borderRadius: 8, padding: "16px 20px", marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>The short answer</div>
            <p style={{ fontSize: 15, color: "#1E1B4B", lineHeight: 1.7, margin: 0 }}>
              Do both, but start with GEO if you are a new or early-stage brand. AI search is a less saturated channel than Google, the competitive landscape is still forming, and the technical actions to improve GEO visibility take hours, not months. SEO remains important, especially for intent-heavy queries - but the marginal return on GEO investment is higher for most Indian startups right now.
            </p>
          </div>

          <P>Every few months, someone declares that SEO is dead. It never quite is. But 2026 is genuinely different. The shift happening now is not incremental - it is structural. AI systems are handling queries that would previously have gone to Google, and users who get a direct answer from ChatGPT or Gemini do not need to click a search result.</P>

          <P>That does not mean SEO is worthless. It means the calculus has changed, and founders who have not updated their mental model of how customers discover products are making allocation decisions based on outdated data.</P>

          <H2>The state of search in 2026: what the numbers say</H2>

          <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "16px 20px", marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Key stats, May 2026</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "ChatGPT: 200 million weekly active users, up from 100 million in 2023",
                "Google AI Overviews: present on 40%+ of Google search results, reducing organic click-through by 15-35%",
                "Perplexity: 15 million daily queries, growing 4x year-over-year",
                "Overlap between Google top-10 and AI-cited sources: dropped from 70% to under 20% in the last 18 months",
                "Gartner forecast: 25% reduction in traditional search volume by end of 2026 due to AI assistant adoption",
              ].map((stat, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4F46E5", flexShrink: 0, marginTop: 8 }} />
                  <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{stat}</span>
                </div>
              ))}
            </div>
          </div>

          <P>The most important number there is the overlap drop. When 70% of AI-cited sources were in Google's top-10, investing in SEO was a reasonable proxy for AI visibility. When that overlap drops to 20%, SEO and GEO become genuinely separate channels that each require their own strategy.</P>

          <H2>What SEO still does well</H2>

          <P>SEO is not disappearing - it is specializing. The queries where Google still dominates and AI is weaker:</P>

          <H3>Local searches</H3>
          <P>When someone searches for "best restaurant near me" or "dentist in Koramangala," they want a local result with a map, reviews, and current hours. AI systems are improving at local queries but Google Maps + local SEO is still dominant for this intent. If your business has a local component, local SEO is still highly valuable.</P>

          <H3>Commercial and transactional queries</H3>
          <P>When someone is ready to buy and searches "buy iPhone 15 Pro 256GB," they want a product page with price, availability, and a buy button. AI systems currently redirect most of these queries back to search or shopping results rather than giving a direct answer. E-commerce SEO is still very effective for transactional intent.</P>

          <H3>News and freshness-sensitive content</H3>
          <P>Breaking news, stock prices, today's weather - queries where freshness is the primary requirement. Google News indexing is faster and more comprehensive than AI training cycles. For news publishers and content sites covering fast-moving topics, SEO remains the dominant channel.</P>

          <CTA />

          <H2>What GEO does that SEO cannot</H2>

          <H3>Direct recommendations</H3>
          <P>When someone asks ChatGPT "what is the best CRM for a 15-person Indian B2B startup," they want a recommendation, not a list of pages to browse. AI systems give that recommendation directly, citing specific brands. There is no ranking position to optimize for - you are either recommended or you are not. GEO determines whether you make the cut.</P>

          <H3>Zero-click discovery</H3>
          <P>An AI response that recommends your brand by name, describes what it does, and explains why it fits the user's situation has delivered value to you without anyone clicking anything. The user now knows your brand exists, what it does, and has a positive framing for it - all from an AI response. That kind of brand exposure does not have an SEO equivalent.</P>

          <H3>High-intent buyer queries</H3>
          <P>The people asking AI systems for software recommendations are high-intent buyers. They are not browsing - they are actively researching. Being recommended in AI responses for "best project management tool for remote Indian teams" is worth far more than ranking #5 on Google for the same query, because the AI user gets a direct answer and acts on it.</P>

          <H2>Where SEO and GEO overlap - the double-benefit actions</H2>

          <P>The good news: several actions improve both SEO and GEO. Do these regardless of which channel you prioritize:</P>

          <div style={{ marginBottom: 32 }}>
            {[
              { action: "High-quality backlinks from authoritative sites", seo: "Improves domain authority and ranking", geo: "Each backlink is a training-data citation for AI systems", impact: "Very high" },
              { action: "Original data and research content", seo: "Earns natural backlinks and featured snippets", geo: "Specific statistics get cited directly in AI responses", impact: "Very high" },
              { action: "E-E-A-T signals (expertise, experience, authority, trust)", seo: "Core Google quality ranking factor", geo: "AI systems use the same signals to determine citation trustworthiness", impact: "High" },
              { action: "Organization schema markup", seo: "Helps Google understand and display your brand in knowledge panels", geo: "Feeds directly into Gemini's entity recognition via Google's knowledge graph", impact: "High" },
              { action: "Fast, technically sound website", seo: "Core Web Vitals affect ranking", geo: "Slow sites get crawled less thoroughly by AI crawlers", impact: "Medium" },
            ].map((item, i) => (
              <div key={i} style={{ padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: "#111827", fontSize: 15 }}>{item.action}</span>
                  <span style={{ background: item.impact === "Very high" ? "#ECFDF5" : item.impact === "High" ? "#EEF2FF" : "#FFFBEB", color: item.impact === "Very high" ? "#059669" : item.impact === "High" ? "#4F46E5" : "#D97706", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9999 }}>{item.impact}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#f9fafb", borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>SEO benefit</div>
                    <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.5 }}>{item.seo}</p>
                  </div>
                  <div style={{ background: "#EEF2FF", borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>GEO benefit</div>
                    <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.5 }}>{item.geo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <H2>Where SEO and GEO diverge - the critical differences</H2>

          <div style={{ overflowX: "auto", marginBottom: 32 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Dimension", "SEO", "GEO"].map((h, i) => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: i === 2 ? "#4F46E5" : "#374151" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Optimization target", "Individual pages and keywords", "Brand entity and citations"],
                  ["Result type", "Ranked list of links", "Direct answer citing brands by name"],
                  ["Success metric", "Rankings position, organic traffic", "Brand mention rate across AI systems"],
                  ["Primary signal", "Backlinks, page authority, relevance", "Citation frequency, entity consistency"],
                  ["Time to results", "Weeks to months", "Weeks (Perplexity), months (ChatGPT/Gemini)"],
                  ["Content type that wins", "Keyword-optimized, long-form pages", "Factual, quotable, citable statements"],
                  ["Platform control", "Google controls the algorithm", "Multiple AI platforms, less single-point risk"],
                  ["Geographic bias", "Relatively unbiased if content is indexed", "Heavily US-centric training data for ChatGPT"],
                ].map(([dim, seo, geo], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ padding: "11px 14px", fontWeight: 500, color: "#374151" }}>{dim}</td>
                    <td style={{ padding: "11px 14px", color: "#6b7280" }}>{seo}</td>
                    <td style={{ padding: "11px 14px", color: "#4F46E5", fontWeight: 500 }}>{geo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H2>The recommendation: what to do based on your situation</H2>

          <H3>New brand, under 2 years old</H3>
          <P><strong>Start with GEO.</strong> Building Google authority from zero takes 6-18 months. Building AI visibility can start producing results in 4-8 weeks. Create your Crunchbase and ProductHunt profiles, write your llms.txt, add Organization schema, and get 2-3 publication features. This gets you to 30-40/100 GEO score and gives you a visible brand in AI recommendations before Google has even started ranking your site meaningfully.</P>

          <H3>Established brand, 3+ years, existing SEO investment</H3>
          <P><strong>Add GEO without reducing SEO.</strong> Your existing SEO investment is producing returns - don't stop. But add the GEO layer on top: audit your robots.txt for AI crawlers, create llms.txt, run a GeoIQ check to identify which AI systems are not mentioning you. The incremental effort to add GEO is relatively small for an established brand - you already have citations; the work is about optimizing and expanding them.</P>

          <H3>Growth-stage brand, strong SEO but weak GEO</H3>
          <P><strong>Prioritize the GEO gap.</strong> If you are ranking well on Google but scoring low on GEO, you are leaving high-intent discovery on the table. The highest-leverage action for you is citation building on platforms that AI training data uses heavily - G2, ProductHunt, major tech publications. Your existing content authority gives you an advantage; you just need to make it visible to AI crawlers.</P>

          <CTA />

          <H2>Frequently asked questions</H2>
          <div style={{ marginBottom: 40 }}>
            {faqItems.map((item, i) => (
              <div key={i} style={{ borderBottom: "1px solid #f3f4f6", padding: "14px 0" }}>
                <div style={{ fontWeight: 600, color: "#111827", fontSize: 15, marginBottom: 7 }}>{item.q}</div>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: 0 }}>{item.a}</p>
              </div>
            ))}
          </div>

          <ShareButtons url={PAGE_URL} title={PAGE_TITLE} />

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>Related articles</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/what-is-geo" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>What is GEO? Full explanation →</Link>
              <Link href="/ai-visibility-score" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>What is an AI visibility score? →</Link>
              <Link href="/blog/what-is-geo-score" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>What is a good GEO score? →</Link>
              <Link href="/blog/indian-startups-chatgpt-scores" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>I checked 10 Indian startups on ChatGPT →</Link>
            </div>
          </div>

        </article>
      </main>
      <Footer />
    </div>
  );
}
