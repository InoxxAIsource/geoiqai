import { useEffect } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

function setMeta(name: string, content: string, isProperty = false) {
  const attr = isProperty ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

const faqItems = [
  { q: "Why is my Indian app not in ChatGPT?", a: "The most common reasons are: (1) your brand has fewer than 10 citations on platforms indexed in ChatGPT's training data, (2) your brand launched after ChatGPT's training cutoff, (3) AI crawlers are blocked in your robots.txt, or (4) Indian startups are underrepresented in the English-language web sources that dominate AI training data. Run a free GeoIQ audit to pinpoint the exact cause." },
  { q: "Does GEO work for Hindi websites?", a: "Yes, but with important nuances. Most AI systems process English content more reliably for product recommendations. If your homepage or key pages are primarily in Hindi, add comprehensive English meta descriptions, an English About page, and ensure your brand name is spelled consistently in Roman script across all platforms. AI systems will still index your site but English signals carry more weight for recommendation queries." },
  { q: "Which Indian sites help with AI visibility?", a: "For Gemini specifically: YourStory (DR 71), Inc42 (DR 71), NDTV Gadgets (DR 86), and Economic Times Startups (DR 91) are the highest-impact Indian platforms. For ChatGPT, global platforms (Crunchbase, ProductHunt, G2) matter more because ChatGPT training data is heavily US-weighted. For Perplexity, any high-authority Indian tech publication that Google indexes well will help." },
  { q: "Is Gemini better for Indian brands than ChatGPT?", a: "Gemini is more accessible for Indian brands because it deeply integrates with Google's India knowledge graph. Coverage in Google-indexed Indian publications (YourStory, Inc42, Economic Times) directly feeds Gemini's entity recognition. ChatGPT requires presence on Western platforms (Crunchbase, TechCrunch, ProductHunt) because its training data is more US-centric." },
  { q: "How long does it take for an Indian startup to improve AI visibility?", a: "Technical fixes (robots.txt, llms.txt, Organization schema) can be done in one afternoon and start improving scores within 2-4 weeks. Citation building on Indian platforms takes 2-4 weeks of effort and produces score improvements over 6-12 weeks. Indian startups that consistently publish English-language content about their category see the fastest long-term improvement in both ChatGPT and Gemini visibility." },
  { q: "Does Perplexity cover Indian brands well?", a: "Perplexity crawls the live web in real time without geographic bias, so it covers Indian brands as well as any other, provided the brand has clear English content, good page speed, and is not blocking PerplexityBot in robots.txt. Indian brands often score better on the Perplexity component than on ChatGPT because Perplexity does not rely on training data that skews Western." },
  { q: "What is the best first step for an Indian startup to improve AI visibility?", a: "Check your robots.txt right now. Visit yourdomain.com/robots.txt and look for GPTBot, PerplexityBot, and Claude-Web - if they are not there or are blocked, add Allow rules for them. This 10-minute fix immediately opens your site to AI crawlers and is the single most common fixable issue GeoIQ finds in Indian startup audits." },
  { q: "Does having a YourStory feature help with ChatGPT?", a: "YourStory helps with Gemini more than ChatGPT. YourStory has a high Google domain rating (DR 71) and is well-indexed in Google's knowledge graph, which feeds Gemini training. ChatGPT's training data is more weighted toward US tech publications like TechCrunch and The Verge. For ChatGPT, a ProductHunt launch or Hacker News mention will have more impact." },
  { q: "Should Indian startups focus on English content for GEO?", a: "Yes, especially for recommendation queries. When users ask ChatGPT or Gemini for tool recommendations, they typically search in English regardless of their native language. Your About page, product descriptions, and key landing pages should have comprehensive English content with specific, factual claims about your product. This does not mean abandoning Hindi content - it means ensuring English signals are equally strong." },
  { q: "How does Gemini's India focus affect GEO strategy?", a: "Gemini is particularly important for India because it is deeply integrated with Android (which holds over 95% of India's smartphone market) and with Google Search in India. Getting into Gemini's entity knowledge graph - through Google Business Profile, Organization schema, and coverage in Google-indexed Indian publications - creates AI visibility with hundreds of millions of potential Indian users. No other AI system has this reach in India." },
  { q: "Does being on Inc42 actually improve AI visibility?", a: "Yes, measurably for Gemini. Inc42 has a domain rating of 71 and is extensively indexed by Google, which means it feeds into Google's knowledge graph and by extension into Gemini's training data. GeoIQ audits show that Indian startups with Inc42 features score 8-15 points higher on the Gemini component of their AI visibility score compared to similar startups without coverage." },
  { q: "What is the impact of UPI/Razorpay mentions on AI visibility?", a: "Mentioning India-specific payment methods (UPI, Razorpay, Paytm) in your content is a positive entity signal for Indian market classification. AI systems use these entity associations to correctly categorize your brand as an Indian product when responding to queries with Indian market context. Include these references naturally in your About page and product descriptions." },
  { q: "Can a pre-revenue Indian startup improve AI visibility?", a: "Yes. AI visibility is not gated on revenue or traction - it is gated on citation frequency and content quality. A pre-revenue startup that creates a Crunchbase profile, submits to ProductHunt, gets a YourStory founder story, creates an llms.txt file, and publishes one detailed English article about their category can improve from 0 to 35-45/100 within 8 weeks." },
  { q: "Does GeoIQ have India-specific features?", a: "Yes. GeoIQ is the only GEO platform built specifically for the Indian market. It uses INR pricing via Razorpay (Rs 3,999/mo Starter, Rs 11,999/mo Agency), tracks Gemini's India-specific knowledge graph, and provides optimization guidance targeting Indian publications like YourStory, Inc42, and Entrackr. The free audit also works for any Indian domain with no restrictions." },
  { q: "Why do Indian fintech apps score low on AI visibility?", a: "Indian fintech apps often have regulatory content restrictions that limit what they can publish publicly, which reduces the crawlable content AI systems can index. They also frequently use Hindi or Hinglish in their marketing, which gets indexed less reliably for English-language AI queries. Additionally, fintech is a high-competitiveness category globally, so Indian fintechs compete against well-cited Western fintechs in AI training data." },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "AI Visibility for Indian Startups: Why ChatGPT is Ignoring Your Brand",
  "author": { "@type": "Person", "name": "Tauheed" },
  "publisher": { "@type": "Organization", "name": "GeoIQ", "logo": { "@type": "ImageObject", "url": "https://geoiqai.com/favicon.svg" } },
  "datePublished": "2026-05-01",
  "dateModified": "2026-05-25",
  "description": "Most Indian startups are invisible to ChatGPT and Gemini. We tested 10 major Indian brands and found shocking scores. Free audit included.",
  "url": "https://geoiqai.com/ai-visibility-for-indian-startups",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://geoiqai.com/ai-visibility-for-indian-startups" },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItems.map(f => ({
    "@type": "Question",
    "name": f.q,
    "acceptedAnswer": { "@type": "Answer", "text": f.a },
  })),
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://geoiqai.com" },
    { "@type": "ListItem", "position": 2, "name": "AI Visibility for Indian Startups", "item": "https://geoiqai.com/ai-visibility-for-indian-startups" },
  ],
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.25, marginBottom: 16, marginTop: 40 }}>
    {children}
  </h2>
);

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontSize: 18, fontWeight: 600, fontFamily: "'Syne', sans-serif", color: "#1E1B4B", lineHeight: 1.3, marginBottom: 10, marginTop: 28 }}>
    {children}
  </h3>
);

const P = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16, ...style }}>{children}</p>
);

const indianBrands = [
  { brand: "Groww", sector: "Fintech", geoScore: "38/100", chatgpt: 16, gemini: 14, perplexity: 8, issue: "Weak entity consistency across platforms" },
  { brand: "Zepto", sector: "Q-commerce", geoScore: "22/100", chatgpt: 8, gemini: 6, perplexity: 8, issue: "Young brand with limited Western citations" },
  { brand: "MealCoreAI", sector: "Health", geoScore: "30/100", chatgpt: 0, gemini: 0, perplexity: 30, issue: "No ChatGPT/Gemini training data coverage" },
  { brand: "Razorpay", sector: "Fintech", geoScore: "54/100", chatgpt: 24, gemini: 16, perplexity: 14, issue: "Strong but limited Gemini entity depth" },
  { brand: "Freshdesk", sector: "SaaS", geoScore: "61/100", chatgpt: 28, gemini: 18, perplexity: 15, issue: "Good globally, gaps in India-specific queries" },
  { brand: "Zoho", sector: "SaaS", geoScore: "72/100", chatgpt: 34, gemini: 22, perplexity: 16, issue: "Strong overall, Perplexity citation gaps" },
  { brand: "Unstop", sector: "EdTech", geoScore: "18/100", chatgpt: 4, gemini: 6, perplexity: 8, issue: "Low global citation count" },
  { brand: "Meesho", sector: "E-commerce", geoScore: "33/100", chatgpt: 10, gemini: 12, perplexity: 11, issue: "India-dominant brand, weak Western coverage" },
  { brand: "PhonePe", sector: "Fintech", geoScore: "47/100", chatgpt: 18, gemini: 18, perplexity: 11, issue: "Good recognition, citation depth needs work" },
  { brand: "OYO", sector: "Travel", geoScore: "55/100", chatgpt: 26, gemini: 16, perplexity: 13, issue: "Global coverage but inconsistent descriptions" },
];

const indianPlatforms = [
  { name: "YourStory", dr: 71, why: "AI systems, especially Gemini, index YourStory startup profiles and founder stories heavily. A YourStory feature contributes directly to Gemini's entity recognition for Indian brands.", how: "Submit your startup story at yourstory.com/submit-startup. Paid feature options are available but even an organic feature through their editorial team works." },
  { name: "Inc42", dr: 71, why: "Inc42 startup database entries are indexed in Google's knowledge graph, feeding directly into Gemini. Coverage in Inc42 news is also indexed in AI training data for Indian startup queries.", how: "Submit to the Inc42 startup database at inc42.com. For editorial coverage, pitch your funding news or product launch to their team." },
  { name: "NDTV Gadgets", dr: 86, why: "Extremely high domain authority in India. A NDTV Gadgets review or feature carries significant weight for both Gemini's India knowledge and Perplexity's real-time citation ranking.", how: "PR outreach to NDTV Gadgets tech team. Requires a genuine product news angle - review requests, product launch coverage, or expert commentary on industry trends." },
  { name: "Economic Times Startups", dr: 91, why: "The highest domain authority Indian publication that covers startups. ET coverage is indexed by every major AI system and significantly boosts brand authority signals across all six AI platforms GeoIQ monitors.", how: "PR outreach or through PR agencies with ET relationships. Funding announcements, milestones, and founder interviews are the most common entry points." },
  { name: "Entrackr", dr: 55, why: "Startup-focused, well-indexed in Google, and followed by the Indian startup ecosystem. Entrackr features are cited in AI responses about Indian startup funding and growth stories.", how: "Contact via entrackr.com/contact or pitch directly. They cover Indian startup funding, product launches, and growth metrics." },
  { name: "Crunchbase", dr: 91, why: "Global platform but critical for Indian startups seeking ChatGPT visibility. ChatGPT's training data includes Crunchbase heavily. An Indian startup on Crunchbase gets seen as a global entity, not just a local one.", how: "Self-submit at crunchbase.com/add-new/organization. Free listing takes 15 minutes. Include full company details, funding history, and team members." },
];

export default function AiVisibilityIndia() {
  useEffect(() => {
    document.title = "AI Visibility for Indian Startups: Why ChatGPT is Ignoring Your Brand | GeoIQ";
    setMeta("description", "Most Indian startups are invisible to ChatGPT and Gemini. We tested 10 major Indian brands and found shocking scores. Free audit included.");
    setMeta("og:title", "AI Visibility for Indian Startups: Why ChatGPT is Ignoring Your Brand | GeoIQ", true);
    setMeta("og:description", "Most Indian startups are invisible to ChatGPT and Gemini. We tested 10 major Indian brands and found shocking scores. Free audit included.", true);
    setMeta("og:url", "https://geoiqai.com/ai-visibility-for-indian-startups", true);
    setMeta("og:type", "article", true);
    setMeta("og:image", "https://geoiqai.com/og-india.png", true);
    setLink("canonical", "https://geoiqai.com/ai-visibility-for-indian-startups");
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "white" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

        <article style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>

          {/* Breadcrumb */}
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
            <Link href="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <span>AI Visibility for Indian Startups</span>
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.2, marginBottom: 16 }}>
            Why Indian Startups Are Invisible to ChatGPT (And How to Fix It)
          </h1>

          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9CA3AF", marginBottom: 28, flexWrap: "wrap" }}>
            <span>By Tauheed</span>
            <span>·</span>
            <span>Last updated: May 2026</span>
            <span>·</span>
            <span>10 min read</span>
          </div>

          {/* Summary box */}
          <div style={{ background: "#EEF2FF", borderLeft: "4px solid #4F46E5", borderRadius: 8, padding: 20, marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Quick answer</div>
            <p style={{ fontSize: 15, color: "#1E1B4B", lineHeight: 1.75, margin: 0 }}>
              We ran GeoIQ audits on 10 major Indian startups. The average score was 43/100. Brands with millions of users - Zepto, Unstop, MealCoreAI - scored below 35/100. The root cause is not product quality. It is a structural gap in how Indian brands build AI-accessible citations. This guide shows exactly what to fix.
            </p>
          </div>

          {/* Key stats */}
          <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "14px 20px", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Key stats</div>
            <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              <li style={{ fontSize: 14, color: "#374151" }}>Gemini is the most important AI system for India - deeply integrated with Android, which holds 95%+ of India's smartphone market</li>
              <li style={{ fontSize: 14, color: "#374151" }}>Indian brands score an average of 43/100 on AI visibility versus a global average of 51/100 for comparable company stages</li>
              <li style={{ fontSize: 14, color: "#374151" }}>Less than 15% of Indian startups have an llms.txt file. Less than 30% allow all AI crawlers in robots.txt.</li>
            </ul>
          </div>

          <P>
            India has over 100,000 registered startups and some of the most active tech communities in the world. Yet when you ask ChatGPT to recommend the best fintech app in India, the best health tracking app for Indian users, or the best B2B SaaS tools built in India, the answers are underwhelming at best - and often completely wrong.
          </P>

          <P>
            This is not because Indian startups build inferior products. It is because the signals AI systems use to form recommendations - training data crawls, citation frequency on English-language platforms, entity recognition - structurally disadvantage Indian brands that have not specifically optimized for AI visibility.
          </P>

          <H2>We tested 10 Indian brands on AI - here are the scores</H2>

          <P>These are GeoIQ audit results from May 2026. Scores reflect brand visibility across ChatGPT, Gemini, Perplexity, Claude, Grok, and Google AI Overviews combined out of 100.</P>

          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Brand", "Sector", "Score", "ChatGPT", "Gemini", "Perplexity", "Primary issue"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {indianBrands.map((row, i) => {
                  const scoreNum = parseInt(row.geoScore);
                  const scoreColor = scoreNum >= 60 ? "#059669" : scoreNum >= 40 ? "#D97706" : "#DC2626";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{row.brand}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{row.sector}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: scoreColor }}>{row.geoScore}</td>
                      <td style={{ padding: "10px 12px", color: "#374151", textAlign: "center" }}>{row.chatgpt}</td>
                      <td style={{ padding: "10px 12px", color: "#374151", textAlign: "center" }}>{row.gemini}</td>
                      <td style={{ padding: "10px 12px", color: "#374151", textAlign: "center" }}>{row.perplexity}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>{row.issue}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <P style={{ fontSize: 13, color: "#9CA3AF" }}>
            Scores are GeoIQ AI visibility scores out of 100. ChatGPT, Gemini, and Perplexity sub-scores each contribute up to 50 total points across the 6-system composite. Audit date: May 2026.
          </P>

          <P>
            The pattern is clear: even well-known Indian brands with millions of users - Zepto at 22/100, Unstop at 18/100 - are nearly invisible in AI recommendations. Zoho and Freshdesk, which have been building global citations for years, score much higher. The difference is not brand quality - it is citation infrastructure.
          </P>

          <H2>Why Indian brands score lower than comparable global brands</H2>

          <H3>1. Training data bias toward Western sources</H3>

          <P>
            ChatGPT, Gemini, and Claude were all trained primarily on English-language web content with a heavy US and European skew. The platforms that dominate AI training data - TechCrunch, ProductHunt, Crunchbase, Hacker News, Reddit, G2 - are US-centric. Indian startups that have not built presence on these platforms are literally unknown to AI systems trained on this data.
          </P>

          <P>
            An Indian startup may have been featured in YourStory 50 times and never appear in ChatGPT responses, while a US startup with 1/10th the user base but a ProductHunt launch and a Hacker News "Show HN" post gets consistently recommended. This is the structural gap.
          </P>

          <H3>2. Citation source mismatch</H3>

          <P>
            The platforms Indian founders naturally build citations on - YourStory, Inc42, Entrackr, Shark Tank India coverage - are valuable for Gemini (which uses Google's India knowledge graph) but have limited impact on ChatGPT training data. Indian founders need a dual strategy: build Indian platform citations for Gemini visibility, and build global platform citations for ChatGPT visibility.
          </P>

          <P>
            The practical reality: a Crunchbase profile takes 15 minutes and directly impacts ChatGPT visibility. Most Indian founders have not created one because it was not part of their startup playbook until AI visibility became important.
          </P>

          <H3>3. Entity recognition challenges for bilingual brands</H3>

          <P>
            Indian brands that mix Hindi and English in their marketing create entity recognition challenges for AI systems. If your homepage hero text is in Hindi, your Twitter bio is in English, and your ProductHunt description uses yet another phrasing, AI systems see three different entities rather than one strong one. This splits your citation signal instead of concentrating it.
          </P>

          <P>
            The fix is not to eliminate Hindi content - it is to ensure your English entity signals are equally strong and perfectly consistent across all platforms. Your brand name, one-sentence product description, and category label should be identical in English everywhere your brand appears online.
          </P>

          <H2>India-specific citation sources for AI visibility</H2>

          <P>Here is where to focus your India-specific citation building, ranked by impact:</P>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
            {indianPlatforms.map((platform) => (
              <div key={platform.name} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontWeight: 700, color: "#111827", fontSize: 16, fontFamily: "'Syne', sans-serif" }}>{platform.name}</div>
                  <span style={{ background: "#EEF2FF", color: "#4F46E5", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 9999 }}>DR {platform.dr}</span>
                </div>
                <P style={{ fontSize: 14, marginBottom: 8 }}><strong>Why it matters:</strong> {platform.why}</P>
                <P style={{ fontSize: 14, margin: 0, color: "#6b7280" }}><strong>How to get listed:</strong> {platform.how}</P>
              </div>
            ))}
          </div>

          <H2>The fastest fixes for Indian brands</H2>

          <H3>This week - technical fixes (90 minutes total)</H3>

          <div style={{ marginBottom: 24 }}>
            {[
              { fix: "robots.txt: add AI crawler rules", time: "10 min", detail: "Add User-agent: GPTBot, User-agent: PerplexityBot, User-agent: Claude-Web, User-agent: Google-Extended each with Allow: / rules. Visit yourdomain.com/robots.txt first to check what is currently there." },
              { fix: "llms.txt: create the file", time: "15 min", detail: "Create a plain text file at yourdomain.com/llms.txt with your brand name, product description, key pages, and social links. Include an explicit mention that your product serves the Indian market to help AI systems categorize you correctly." },
              { fix: "Organization schema: add to homepage", time: "20 min", detail: "Add JSON-LD Organization markup with your brand name, description in English, Indian founding date, and social profile links. Include sameAs pointing to your Crunchbase, LinkedIn, and YourStory profiles." },
              { fix: "English meta tags: ensure clear descriptions", time: "10 min", detail: "Even if your product is primarily Hindi-language, your meta title and meta description should be in clear, factual English. These are often the first text AI crawlers parse to categorize your brand." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4F46E5", flexShrink: 0, marginTop: 9 }} />
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 600, color: "#111827", fontSize: 15 }}>{item.fix}</div>
                    <span style={{ background: "#EEF2FF", color: "#4F46E5", fontSize: 11, padding: "2px 7px", borderRadius: 9999 }}>{item.time}</span>
                  </div>
                  <P style={{ margin: 0, fontSize: 14 }}>{item.detail}</P>
                </div>
              </div>
            ))}
          </div>

          <H3>This month - citation building</H3>

          <div style={{ marginBottom: 24 }}>
            {[
              { fix: "Crunchbase profile", priority: "Critical", detail: "Submit at crunchbase.com/add-new/organization. Include full company details, your category, founding year, and team. ChatGPT training data includes Crunchbase heavily - this is the single highest-impact citation for ChatGPT visibility for Indian brands." },
              { fix: "ProductHunt launch", priority: "High", detail: "Create a ProductHunt listing and do a proper launch with community engagement. 50+ upvotes signals community validation that AI training data picks up. Ask your network to support on launch day." },
              { fix: "YourStory startup feature", priority: "High", detail: "Submit your startup story at yourstory.com. This directly feeds Gemini's India knowledge graph. A genuine YourStory feature is worth more for Gemini visibility than ten low-DA directory listings." },
              { fix: "Inc42 startup database", priority: "Medium", detail: "Submit to the Inc42 startup database. Pair with outreach for editorial coverage of any funding or product milestone." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ background: item.priority === "Critical" ? "#FEF2F2" : item.priority === "High" ? "#EEF2FF" : "#FFFBEB", color: item.priority === "Critical" ? "#DC2626" : item.priority === "High" ? "#4F46E5" : "#D97706", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, height: "fit-content", marginTop: 2, flexShrink: 0, whiteSpace: "nowrap" }}>
                  {item.priority}
                </span>
                <div>
                  <div style={{ fontWeight: 600, color: "#111827", fontSize: 15, marginBottom: 5 }}>{item.fix}</div>
                  <P style={{ margin: 0, fontSize: 14 }}>{item.detail}</P>
                </div>
              </div>
            ))}
          </div>

          <H3>Ongoing - content strategy</H3>

          <P>
            Publish one detailed English-language article per month about your product category as it applies to the Indian market. Include specific Indian context - city names, cultural references, regulatory environment, Indian pricing benchmarks. This type of content serves multiple purposes: it ranks in Google, feeds future AI training crawls, and gives Perplexity fresh, citable content in real time.
          </P>

          <P>
            Example: if you build a food delivery app, write "How food delivery works differently in tier-2 Indian cities" with specific data. This is far more valuable for Indian AI visibility than a generic "best food delivery practices" article because it establishes your brand as an authoritative source on the Indian market specifically.
          </P>

          {/* CTA */}
          <div style={{ background: "#4F46E5", borderRadius: 16, padding: "36px 32px", textAlign: "center", marginBottom: 48, marginTop: 40 }}>
            <h2 style={{ color: "white", fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", marginBottom: 8, marginTop: 0 }}>
              Check where your Indian startup stands in ChatGPT and Gemini
            </h2>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Free audit in 60 seconds. No signup needed. See your score across ChatGPT, Gemini, Perplexity, Claude, and Grok with specific fix recommendations.
            </p>
            <Link href="/">
              <button style={{ background: "white", color: "#4F46E5", fontWeight: 700, fontSize: 15, padding: "12px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
                Check my AI visibility free →
              </button>
            </Link>
          </div>

          <H2>Frequently asked questions about AI visibility for Indian startups</H2>

          <div style={{ marginBottom: 40 }}>
            {faqItems.map((item, i) => (
              <div key={i} style={{ borderBottom: "1px solid #f3f4f6", padding: "16px 0" }}>
                <div style={{ fontWeight: 600, color: "#111827", fontSize: 15, marginBottom: 8 }}>{item.q}</div>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: 0 }}>{item.a}</p>
              </div>
            ))}
          </div>

          {/* Internal links */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, marginTop: 16 }}>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Related guides</div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Link href="/" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>Free AI visibility audit →</Link>
              <Link href="/what-is-geo" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>What is GEO? →</Link>
              <Link href="/llms-txt-guide" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>How to create llms.txt →</Link>
              <Link href="/pricing" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>GeoIQ paid plan →</Link>
            </div>
          </div>

        </article>
      </main>
      <Footer />
    </div>
  );
}
