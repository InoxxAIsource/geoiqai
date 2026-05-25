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
    <div style={{ color: "white", fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>See how your score compares</div>
    <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 18, lineHeight: 1.6 }}>Free audit in 60 seconds. See where you rank versus category benchmarks with no signup required.</p>
    <Link href="/">
      <button style={{ background: "white", color: "#4F46E5", fontWeight: 700, fontSize: 14, padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
        Check my GEO score →
      </button>
    </Link>
  </div>
);

const faqItems = [
  { q: "What is a GEO score?", a: "A GEO score (Generative Engine Optimization score) is a 0-100 metric that measures how visible your brand is to AI systems like ChatGPT, Gemini, and Perplexity. GeoIQ calculates it by running standardized prompts across 6 AI systems and tracking brand mention rates." },
  { q: "What is a good GEO score?", a: "Anything above 60/100 is strong - you appear regularly in AI recommendations. The average score across all brands GeoIQ has audited is 24/100, so even a score of 40/100 puts you in the top third of all brands. Most brands are below 30/100." },
  { q: "How do I improve my GEO score?", a: "The highest-impact actions: allow all AI crawlers in robots.txt, create an llms.txt file, add Organization schema to your homepage, build citations on G2/ProductHunt/Crunchbase, and get covered in relevant publications in your category. Technical fixes take 1-2 hours. Citation building takes weeks to months." },
  { q: "Does GEO score affect revenue?", a: "Increasingly yes. As more product discovery happens through AI assistants, brands with low GEO scores miss a growing share of high-intent purchase queries. The connection between AI visibility and revenue is still emerging but directionally clear - being absent from AI recommendations means missing buyers who never visit traditional search results." },
  { q: "How often does GEO score change?", a: "Perplexity-driven components can shift within days of new web content being published. ChatGPT and Gemini scores are more stable - they improve as training data updates incorporate new citations. GeoIQ's paid plans run daily checks to track changes." },
  { q: "Why is my GEO score lower than my competitor's?", a: "The most common reasons are fewer third-party citations on globally-indexed platforms (G2, Crunchbase, ProductHunt), blocked AI crawlers in robots.txt, no Organization schema, or launching more recently than your competitor. Run a GeoIQ audit - it shows exactly which factors are causing the gap." },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "What's a Good GEO Score? We Analyzed 500 Brands to Find Out",
  "author": { "@type": "Person", "name": "Tauheed" },
  "publisher": { "@type": "Organization", "name": "GeoIQ", "logo": { "@type": "ImageObject", "url": "https://geoiqai.com/favicon.svg" } },
  "datePublished": "2026-05-25",
  "dateModified": "2026-05-25",
  "description": "The average GEO score across 500+ brands is 24/100. Find out what a good score looks like and how yours compares.",
  "url": "https://geoiqai.com/blog/what-is-geo-score",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://geoiqai.com/blog/what-is-geo-score" },
};
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItems.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })),
};

const PAGE_URL = "https://geoiqai.com/blog/what-is-geo-score";
const PAGE_TITLE = "What's a Good GEO Score? We Analyzed 500 Brands to Find Out";

export default function BlogWhatIsGeoScore() {
  useEffect(() => {
    document.title = `${PAGE_TITLE} | GeoIQ Blog`;
    setMeta("description", "The average GEO score across 500+ brands is 24/100. Find out what a good score looks like and how yours compares.");
    setMeta("og:title", `${PAGE_TITLE} | GeoIQ Blog`, true);
    setMeta("og:description", "The average GEO score across 500+ brands is 24/100. Find out what a good score looks like.", true);
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
            <span>What is a good GEO score</span>
          </div>

          <h1 style={{ fontSize: 34, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.2, marginBottom: 14 }}>
            What's a Good GEO Score? We Analyzed 500 Brands to Find Out.
          </h1>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#9CA3AF", marginBottom: 10, flexWrap: "wrap" }}>
            <span>By Tauheed</span>
            <span>·</span>
            <span>May 25, 2026</span>
            <span>·</span>
            <span>8 min read</span>
          </div>

          <ShareButtons url={PAGE_URL} title={PAGE_TITLE} />

          <div style={{ background: "#EEF2FF", borderLeft: "4px solid #4F46E5", borderRadius: 8, padding: "16px 20px", marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>The short answer</div>
            <p style={{ fontSize: 15, color: "#1E1B4B", lineHeight: 1.7, margin: 0 }}>
              The average GEO score across all brands GeoIQ has audited is 24/100. Anything above 60/100 is genuinely strong. Most brands - including well-funded ones with millions of users - score below 35/100. If you score 40+, you are already ahead of most of your competitors in AI visibility.
            </p>
          </div>

          <P>When someone asks me "what's a good GEO score?", the honest answer is: it depends on what you're comparing to. A score that looks low in absolute terms might be excellent for your category and stage. A score that seems decent might be well below the average for established SaaS companies.</P>

          <P>To give founders actual benchmarks, we analyzed GeoIQ audit data across 500+ brands. This is what the distribution looks like, by score range, by category, and by company age.</P>

          <H2>The overall distribution</H2>

          <P>Here is how scores are distributed across the 500+ brands in our audit data:</P>

          <div style={{ marginBottom: 32 }}>
            {[
              { range: "81-100", label: "Dominant", pct: "3%", count: "~15 brands", color: "#059669", bg: "#ECFDF5", desc: "Almost entirely enterprise brands with 10+ years of global citation building. Think Salesforce, HubSpot, Shopify. No Indian brand in our dataset scores above 75." },
              { range: "61-80", label: "Strong", pct: "8%", count: "~40 brands", color: "#0284C7", bg: "#F0F9FF", desc: "Established brands with strong third-party citation infrastructure. Most are 5+ years old with significant G2/Capterra review counts. Indian brands in this range: Zoho (72), Freshdesk (61)." },
              { range: "41-60", label: "Visible", pct: "19%", count: "~95 brands", color: "#D97706", bg: "#FFFBEB", desc: "Growth-stage brands with solid citations on some platforms but gaps on others. Usually strong on 2-3 AI systems, weak on the rest. OYO (55), Razorpay (54), PhonePe (47) are in this band." },
              { range: "21-40", label: "Emerging", pct: "35%", count: "~175 brands", color: "#DC2626", bg: "#FEF2F2", desc: "The largest segment. Brands that appear occasionally in AI responses but inconsistently. Often have good Perplexity scores (live web) but low ChatGPT/Gemini scores (training data). Groww (38), Meesho (33), MealCoreAI (30) sit here." },
              { range: "0-20", label: "Invisible", pct: "35%", count: "~175 brands", color: "#6B7280", bg: "#F9FAFB", desc: "AI systems have essentially no awareness of these brands. Often a combination of blocked AI crawlers, no third-party citations, and very recent launches. Unstop (18) is the largest Indian brand we found here." },
            ].map((item) => (
              <div key={item.range} style={{ background: item.bg, borderRadius: 10, padding: "16px 18px", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: item.color, fontFamily: "'Syne', sans-serif" }}>{item.range}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: item.color, alignSelf: "center" }}>{item.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 12, background: "white", color: item.color, padding: "2px 10px", borderRadius: 9999, fontWeight: 700 }}>{item.pct} of brands</span>
                    <span style={{ fontSize: 12, background: "white", color: "#6b7280", padding: "2px 10px", borderRadius: 9999 }}>{item.count}</span>
                  </div>
                </div>
                <P style={{ fontSize: 13, margin: 0 }}>{item.desc}</P>
              </div>
            ))}
          </div>

          <CTA />

          <H2>Scores by category</H2>

          <P>Category matters a lot. Some sectors have structurally higher average scores because they attract more global attention and review platform activity. Others are structurally disadvantaged because their users are local or their content is primarily non-English.</P>

          <div style={{ overflowX: "auto", marginBottom: 32 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Category", "Avg score", "Top quartile", "Why the gap"].map(h => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { cat: "B2B SaaS (global)", avg: "51/100", top: "72/100", why: "High review platform activity (G2, Capterra), global buyer base creates global citations" },
                  { cat: "Developer tools", avg: "48/100", top: "69/100", why: "GitHub, Hacker News, Stack Overflow citations are heavily indexed by all AI systems" },
                  { cat: "Fintech (global)", avg: "44/100", top: "63/100", why: "Strong press coverage but compliance limits public content depth" },
                  { cat: "Health / wellness", avg: "38/100", top: "58/100", why: "Category growing fast in AI, but most health apps are newer brands without deep citation history" },
                  { cat: "E-commerce", avg: "35/100", top: "54/100", why: "Highly local brands struggle to build global citations; AI systems are category-wide, not geographically scoped" },
                  { cat: "Fintech (India-only)", avg: "31/100", top: "47/100", why: "India-centric press, UPI/regulatory restrictions, limited G2/Capterra presence" },
                  { cat: "EdTech (India)", avg: "24/100", top: "38/100", why: "User base is India-local, content is often in Hindi, global platform citations are rare" },
                  { cat: "Q-commerce / delivery", avg: "19/100", top: "33/100", why: "Hyperlocal business model means almost no global platform coverage; offline-heavy brand building" },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ padding: "11px 14px", fontWeight: 500, color: "#374151" }}>{row.cat}</td>
                    <td style={{ padding: "11px 14px", fontWeight: 700, color: "#4F46E5" }}>{row.avg}</td>
                    <td style={{ padding: "11px 14px", color: "#059669", fontWeight: 600 }}>{row.top}</td>
                    <td style={{ padding: "11px 14px", color: "#6b7280", fontSize: 13 }}>{row.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H2>Scores by company age</H2>

          <P>Age is one of the strongest predictors of GEO score, because the primary driver is citation accumulation - and citations take time.</P>

          <div style={{ overflowX: "auto", marginBottom: 32 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Age", "Avg score", "Typical ceiling", "What to focus on"].map(h => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { age: "Under 1 year", avg: "8/100", ceiling: "25/100", focus: "Technical fixes + first citations (Crunchbase, ProductHunt, G2 listing)" },
                  { age: "1-2 years", avg: "18/100", ceiling: "40/100", focus: "Review building, publication coverage, llms.txt, Organization schema" },
                  { age: "2-4 years", avg: "31/100", ceiling: "55/100", focus: "Citation depth on global platforms, content-based entity building" },
                  { age: "4-7 years", avg: "44/100", ceiling: "68/100", focus: "Citation consistency, competitor gap analysis, emerging platforms" },
                  { age: "7+ years", avg: "58/100", ceiling: "80/100", focus: "Optimization and fine-tuning; the baseline is already strong" },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ padding: "11px 14px", fontWeight: 500, color: "#374151" }}>{row.age}</td>
                    <td style={{ padding: "11px 14px", fontWeight: 700, color: "#4F46E5" }}>{row.avg}</td>
                    <td style={{ padding: "11px 14px", color: "#059669", fontWeight: 600 }}>{row.ceiling}</td>
                    <td style={{ padding: "11px 14px", color: "#6b7280", fontSize: 13 }}>{row.focus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <CTA />

          <H2>The 5 factors that affect GEO score the most</H2>

          <P>After analyzing 500+ audits, these are the factors that most consistently explain score differences between brands in the same category and age cohort:</P>

          <div style={{ marginBottom: 32 }}>
            {[
              { rank: 1, factor: "Third-party citation count", impact: "Very high", explanation: "Brands with 30+ independent citations on globally-indexed platforms (G2, Crunchbase, ProductHunt, Capterra, major publications) score an average of 22 points higher than brands in the same category with fewer than 10 citations. This is the single biggest predictor of GEO score." },
              { rank: 2, factor: "AI crawler accessibility", impact: "High", explanation: "Brands with all major AI crawlers explicitly allowed in robots.txt score an average of 11 points higher than brands where at least one major AI crawler is blocked. Fixing this takes 10 minutes and has the fastest impact on Perplexity-driven scores." },
              { rank: 3, factor: "llms.txt presence", impact: "High", explanation: "Brands with a well-written llms.txt file score an average of 9 points higher than comparable brands without one. The effect is strongest on Perplexity and Claude, which actively parse the file during live crawls." },
              { rank: 4, factor: "Organization schema on homepage", impact: "Medium", explanation: "Brands with JSON-LD Organization schema score an average of 7 points higher. The effect is strongest on the Gemini component because Gemini uses Google's knowledge graph, which is fed by structured data." },
              { rank: 5, factor: "Publication coverage recency", impact: "Medium", explanation: "Brands covered in major publications within the last 6 months score an average of 6 points higher than brands whose last significant press coverage was over a year ago. Recency matters because Perplexity uses live crawl data and weights fresh content higher." },
            ].map((item) => (
              <div key={item.rank} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{item.rank}</div>
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, color: "#111827", fontSize: 15 }}>{item.factor}</span>
                    <span style={{ background: item.impact === "Very high" ? "#ECFDF5" : "#EEF2FF", color: item.impact === "Very high" ? "#059669" : "#4F46E5", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9999 }}>{item.impact} impact</span>
                  </div>
                  <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: 0 }}>{item.explanation}</p>
                </div>
              </div>
            ))}
          </div>

          <H2>What "good" looks like for a brand at your stage</H2>

          <P>Rather than comparing to an absolute number, compare to what is achievable for a brand at your stage with 3-6 months of focused effort:</P>

          <P><strong>Pre-launch / under 1 year old:</strong> Getting to 25-35/100 within your first year is excellent. Your Perplexity score can be built quickly through live web content. ChatGPT and Gemini scores take longer because they depend on training data, but Crunchbase + ProductHunt + a few publication mentions can get you to 20+ on those components within 6 months.</P>

          <P><strong>1-3 years old:</strong> Targeting 35-50/100 is realistic with consistent citation building. The brands in this range that have moved fastest are the ones that treated GEO like a product - systematically building citations, publishing original data, and standardizing entity signals across platforms.</P>

          <P><strong>3+ years old:</strong> If you have been building and growing for 3+ years and still score below 35/100, there is usually a fixable technical issue. Check your robots.txt first - we frequently find 4-6 year old brands still blocking AI crawlers with legacy robots.txt rules from their early WordPress days.</P>

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
              <Link href="/ai-visibility-score" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>AI visibility score: what it is and how to improve it →</Link>
              <Link href="/blog/geo-vs-seo-2026" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>GEO vs SEO in 2026: where should you focus? →</Link>
              <Link href="/how-to-rank-in-chatgpt" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>Full guide: how to rank in ChatGPT →</Link>
              <Link href="/blog/robots-txt-blocking-ai" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>Is your robots.txt blocking ChatGPT? →</Link>
            </div>
          </div>

        </article>
      </main>
      <Footer />
    </div>
  );
}
