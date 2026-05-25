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
    <a
      href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
      target="_blank" rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#000", color: "white", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 6, textDecoration: "none" }}
    >
      Share on X
    </a>
    <a
      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
      target="_blank" rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#0A66C2", color: "white", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 6, textDecoration: "none" }}
    >
      Share on LinkedIn
    </a>
  </div>
);

const CTA = () => (
  <div style={{ background: "#4F46E5", borderRadius: 14, padding: "28px 28px", textAlign: "center", margin: "40px 0" }}>
    <div style={{ color: "white", fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>Check your brand free</div>
    <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 18, lineHeight: 1.6 }}>See your AI visibility score across ChatGPT, Gemini, and Perplexity in 60 seconds. No signup.</p>
    <Link href="/">
      <button style={{ background: "white", color: "#4F46E5", fontWeight: 700, fontSize: 14, padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
        Check my score →
      </button>
    </Link>
  </div>
);

const brands = [
  { brand: "Zoho", sector: "B2B SaaS", chatgpt: 34, gemini: 22, perplexity: 16, total: "72/100", note: "Best score in the group - 20+ years of global citations", color: "#059669" },
  { brand: "Freshdesk", sector: "SaaS", chatgpt: 28, gemini: 18, perplexity: 15, total: "61/100", note: "Strong globally, weaker on India-specific queries", color: "#0284C7" },
  { brand: "OYO", sector: "Travel", chatgpt: 26, gemini: 16, perplexity: 13, total: "55/100", note: "Good coverage but inconsistent brand descriptions across sources", color: "#0284C7" },
  { brand: "Razorpay", sector: "Fintech", chatgpt: 24, gemini: 16, perplexity: 14, total: "54/100", note: "Strong but fintech compliance limits public content", color: "#D97706" },
  { brand: "PhonePe", sector: "Fintech", chatgpt: 18, gemini: 18, perplexity: 11, total: "47/100", note: "Stronger in India-context queries, weaker globally", color: "#D97706" },
  { brand: "Groww", sector: "Fintech", chatgpt: 16, gemini: 14, perplexity: 8, total: "38/100", note: "Young brand with fast growth but limited Western citations", color: "#DC2626" },
  { brand: "Meesho", sector: "E-commerce", chatgpt: 10, gemini: 12, perplexity: 11, total: "33/100", note: "India-dominant brand - barely exists in US-centric AI training data", color: "#DC2626" },
  { brand: "MealCoreAI", sector: "Health", chatgpt: 0, gemini: 0, perplexity: 30, total: "30/100", note: "Perplexity knows it from live web, but training-data AI systems have zero awareness", color: "#DC2626" },
  { brand: "Groww", sector: "Fintech", chatgpt: 8, gemini: 6, perplexity: 8, total: "22/100", note: "", color: "#DC2626" },
  { brand: "Zepto", sector: "Q-commerce", chatgpt: 8, gemini: 6, perplexity: 8, total: "22/100", note: "Massive offline user base, near-zero AI visibility", color: "#DC2626" },
  { brand: "Unstop", sector: "EdTech", chatgpt: 4, gemini: 6, perplexity: 8, total: "18/100", note: "Under 20 independent citations on globally-indexed platforms", color: "#DC2626" },
];

const faqItems = [
  { q: "Why do Indian startups score low on ChatGPT?", a: "ChatGPT's training data is heavily weighted toward US and European sources. Indian startups that haven't built presence on platforms like Crunchbase, ProductHunt, G2, and Hacker News are invisible to ChatGPT - even if they're well-known in India." },
  { q: "Is Gemini better for Indian brands?", a: "Somewhat. Gemini uses Google's India knowledge graph, which includes YourStory, Inc42, and Economic Times. Indian brands covered in these publications tend to score better on Gemini than on ChatGPT. But even Gemini scores for most Indian startups are below 25/100." },
  { q: "Can an early-stage startup improve its AI visibility?", a: "Yes. AI visibility is gated on citations, not stage or revenue. A pre-revenue startup that creates a Crunchbase profile, submits to ProductHunt, gets a YourStory feature, and adds an llms.txt file can move from 0 to 35-45/100 within 8 weeks." },
  { q: "How do I check my own score?", a: "Go to geoiqai.com, enter your domain name, and click Audit. You get a full breakdown in 60 seconds. No signup, no email, completely free." },
  { q: "Does revenue affect AI visibility score?", a: "No. AI systems score brands based on citation frequency and content quality, not revenue or user counts. MealCoreAI has 12,000 users but a 30/100 score. Zoho has millions but earned its 72/100 through decades of consistent citation building." },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "I Checked 10 Indian Startups on ChatGPT - The Scores Shocked Me",
  "author": { "@type": "Person", "name": "Tauheed" },
  "publisher": { "@type": "Organization", "name": "GeoIQ", "logo": { "@type": "ImageObject", "url": "https://geoiqai.com/favicon.svg" } },
  "datePublished": "2026-05-25",
  "dateModified": "2026-05-25",
  "description": "We ran every major Indian startup through GeoIQ. The average score was 31/100. Here are the results and what they mean for your brand.",
  "url": "https://geoiqai.com/blog/indian-startups-chatgpt-scores",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://geoiqai.com/blog/indian-startups-chatgpt-scores" },
};
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItems.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })),
};

const PAGE_URL = "https://geoiqai.com/blog/indian-startups-chatgpt-scores";
const PAGE_TITLE = "I Checked 10 Indian Startups on ChatGPT - The Scores Shocked Me";

export default function BlogIndianStartupScores() {
  useEffect(() => {
    document.title = `${PAGE_TITLE} | GeoIQ Blog`;
    setMeta("description", "We ran every major Indian startup through GeoIQ. The average score was 31/100. Here are the results and what they mean for your brand.");
    setMeta("og:title", `${PAGE_TITLE} | GeoIQ Blog`, true);
    setMeta("og:description", "We ran every major Indian startup through GeoIQ. The average score was 31/100.", true);
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

          {/* Breadcrumb */}
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 18 }}>
            <Link href="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <Link href="/blog" style={{ color: "#9CA3AF", textDecoration: "none" }}>Blog</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <span>Indian startups ChatGPT scores</span>
          </div>

          <h1 style={{ fontSize: 34, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.2, marginBottom: 14 }}>
            I Checked 10 Indian Startups on ChatGPT. The Scores Shocked Me.
          </h1>

          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#9CA3AF", marginBottom: 10, flexWrap: "wrap" }}>
            <span>By Tauheed</span>
            <span>·</span>
            <span>May 25, 2026</span>
            <span>·</span>
            <span>7 min read</span>
          </div>

          <ShareButtons url={PAGE_URL} title={PAGE_TITLE} />

          {/* Hook */}
          <blockquote style={{ borderLeft: "3px solid #4F46E5", paddingLeft: 20, margin: "0 0 28px 0" }}>
            <p style={{ fontSize: 17, color: "#374151", lineHeight: 1.8, fontStyle: "italic", margin: 0 }}>
              "I was running MealCoreAI, a health app with 12,000 active users in India. I asked ChatGPT to recommend meal planning apps for people managing diabetes in India. It gave me three tools, none of which were Indian. MealCoreAI did not appear at all. That was the moment I knew something was structurally broken."
            </p>
          </blockquote>

          <P>That conversation sent me down a rabbit hole. Over the next two weeks, I systematically tested every major Indian startup I could think of across ChatGPT, Gemini, and Perplexity using GeoIQ's audit tool. The results were worse than I expected.</P>

          <P>The average AI visibility score across the 10 brands I tested: 43/100. Brands with millions of users scoring in the teens. One brand - Unstop, which serves over 10 million students - scoring 18/100. A startup that is essentially the Handshake of India, completely unknown to ChatGPT.</P>

          <H2>The methodology</H2>

          <P>I used GeoIQ's free audit tool for every brand. It runs standardized prompts across ChatGPT, Gemini, Perplexity, Claude, and Grok, tracking brand mention rate across each system. Each component score goes from 0-50 for a total out of 100. The same tool, same queries, same day - so results are directly comparable.</P>

          <P>I tested brands from different sectors: fintech, SaaS, health, e-commerce, edtech, and quick commerce. I wanted to see if the pattern held across categories or if it was specific to one type of company.</P>

          <P>It held across every single one.</P>

          <H2>The results</H2>

          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Brand", "Sector", "Score", "ChatGPT", "Gemini", "Perplexity"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { brand: "Zoho", sector: "B2B SaaS", chatgpt: 34, gemini: 22, perplexity: 16, total: "72/100", color: "#059669" },
                  { brand: "Freshdesk", sector: "SaaS", chatgpt: 28, gemini: 18, perplexity: 15, total: "61/100", color: "#0284C7" },
                  { brand: "OYO", sector: "Travel", chatgpt: 26, gemini: 16, perplexity: 13, total: "55/100", color: "#0284C7" },
                  { brand: "Razorpay", sector: "Fintech", chatgpt: 24, gemini: 16, perplexity: 14, total: "54/100", color: "#D97706" },
                  { brand: "PhonePe", sector: "Fintech", chatgpt: 18, gemini: 18, perplexity: 11, total: "47/100", color: "#D97706" },
                  { brand: "Groww", sector: "Fintech", chatgpt: 16, gemini: 14, perplexity: 8, total: "38/100", color: "#DC2626" },
                  { brand: "Meesho", sector: "E-commerce", chatgpt: 10, gemini: 12, perplexity: 11, total: "33/100", color: "#DC2626" },
                  { brand: "MealCoreAI", sector: "Health", chatgpt: 0, gemini: 0, perplexity: 30, total: "30/100", color: "#DC2626" },
                  { brand: "Zepto", sector: "Q-commerce", chatgpt: 8, gemini: 6, perplexity: 8, total: "22/100", color: "#DC2626" },
                  { brand: "Unstop", sector: "EdTech", chatgpt: 4, gemini: 6, perplexity: 8, total: "18/100", color: "#DC2626" },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{row.brand}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>{row.sector}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: row.color }}>{row.total}</td>
                    <td style={{ padding: "10px 12px", color: "#374151", textAlign: "center" }}>{row.chatgpt}</td>
                    <td style={{ padding: "10px 12px", color: "#374151", textAlign: "center" }}>{row.gemini}</td>
                    <td style={{ padding: "10px 12px", color: "#374151", textAlign: "center" }}>{row.perplexity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 32 }}>GeoIQ audit, May 25 2026. Sub-scores out of 50 each (ChatGPT+Gemini combined as AI Memory, Perplexity as Live Web). Total out of 100.</p>

          <CTA />

          <H2>What the numbers actually mean</H2>

          <P><strong>Zoho and Freshdesk:</strong> The highest scorers are not a surprise. Zoho has been building global citations for over 20 years. It is on G2, Capterra, Crunchbase, TechCrunch, every analyst report. Freshdesk is similar - years of global presence with thousands of independent reviews. Their scores reflect the compounding effect of a long citation history, not some secret optimization strategy.</P>

          <P><strong>Razorpay and PhonePe:</strong> Both are well-known brands with significant press coverage, but their scores are pulled down by fintech-specific problems. Regulatory constraints limit how much public technical content they can publish. Both are also deeply India-centric brands - most of their press is in Indian publications, which feeds Gemini better than ChatGPT.</P>

          <P><strong>Meesho and Zepto:</strong> Here is where it gets interesting. Meesho has over 150 million users. Zepto raised $1 billion at a $3.6 billion valuation. Both score under 35/100. The reason: their user base is hyperlocal India, their press is primarily Hindi-language or regional, and their product categories (social commerce, dark stores) do not map cleanly to the English query templates that dominate AI training data.</P>

          <P><strong>MealCoreAI:</strong> This one is the most telling. ChatGPT score: 0. Gemini score: 0. Perplexity score: 30/100. What does this tell us? MealCoreAI has live web content that Perplexity can crawl and cite. But ChatGPT and Gemini, which rely on training data, have no knowledge of the brand at all. It launched too recently. It has no Crunchbase profile. It has no ProductHunt page. The web knows it exists; the AI models' training data does not.</P>

          <P><strong>Unstop:</strong> 18/100. 10 million users. That gap between product scale and AI visibility is the whole problem in one number.</P>

          <H2>The three things separating the top from the bottom</H2>

          <P>After looking at these scores, I kept asking: what is the actual difference between Zoho at 72 and Unstop at 18? Three things.</P>

          <P><strong>1. Years of English-language, globally-indexed citations.</strong> Zoho has been covered in TechCrunch, Wired, Forbes, and hundreds of analyst reports for two decades. Every one of those articles is a training data citation. Unstop has been covered primarily in Hindi-language press, startup competition announcements, and campus newsletters - most of which never made it into the data pipelines that trained GPT-4 or Gemini.</P>

          <P><strong>2. Presence on global review platforms.</strong> G2, Capterra, ProductHunt, and Crunchbase are crawled heavily by AI training pipelines. Zoho has thousands of G2 reviews. Freshdesk same. Unstop, Zepto, and MealCoreAI have near-zero presence on these platforms. That is not a criticism - these platforms were not obviously important before AI search became the dominant discovery channel. But they matter enormously now.</P>

          <P><strong>3. Consistent entity signals.</strong> When you search for "Zoho" across LinkedIn, Crunchbase, Wikipedia, G2, and Capterra, you get consistent descriptions of the same company. Same brand name, same product category, same founding story. AI systems use this consistency to build a strong entity signal. For newer Indian brands, descriptions are often inconsistent across platforms, which fragments the signal and reduces recommendation confidence.</P>

          <CTA />

          <H2>What to do about it - the five most effective fixes</H2>

          <div style={{ marginBottom: 32 }}>
            {[
              { n: 1, action: "Allow all AI crawlers in robots.txt", time: "10 min", detail: "Visit yourdomain.com/robots.txt right now. Add Allow: / rules for GPTBot, PerplexityBot, ClaudeBot, and Google-Extended. If these crawlers are blocked, no other fix matters - they cannot read your site." },
              { n: 2, action: "Create llms.txt", time: "15 min", detail: "Put a plain text file at yourdomain.com/llms.txt with your brand name, one-sentence description, key pages, and social profiles. AI crawlers read this to understand your brand before parsing individual pages. Under 5% of Indian startups have done this. Takes 15 minutes." },
              { n: 3, action: "Create a Crunchbase profile", time: "20 min", detail: "Go to crunchbase.com/add-new/organization. Fill in every field. This is the single highest-impact citation for ChatGPT visibility. ChatGPT's training data indexes Crunchbase heavily and Crunchbase gives your brand a structured, authoritative identity on the global web." },
              { n: 4, action: "Submit to ProductHunt and G2", time: "1-2 hours", detail: "A ProductHunt listing and 10+ G2 reviews each contribute independent citations that AI training data picks up. Encourage your existing users to review you on G2 - it takes 3 minutes per reviewer and has outsized impact on AI visibility." },
              { n: 5, action: "Get covered in YourStory and Inc42", time: "2-4 weeks", detail: "For Gemini specifically, Indian publication coverage matters. YourStory (DR 71) and Inc42 (DR 71) are indexed in Google's knowledge graph which feeds Gemini's India entity recognition. Submit your startup story to both. Even a startup database listing helps." },
            ].map((item) => (
              <div key={item.n} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{item.n}</div>
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, color: "#111827", fontSize: 15 }}>{item.action}</span>
                    <span style={{ background: "#EEF2FF", color: "#4F46E5", fontSize: 11, padding: "2px 8px", borderRadius: 9999 }}>{item.time}</span>
                  </div>
                  <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: 0 }}>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <H2>The window is still open</H2>

          <P>Less than 5% of Indian startups have an llms.txt file. Less than 30% allow all AI crawlers in robots.txt. Most have no Crunchbase profile, no G2 reviews, and no Organization schema on their homepage.</P>

          <P>That means the brands that move on this in the next 3-6 months will have a meaningful head start before the rest of the market catches up. AI visibility, like SEO a decade ago, rewards early movers significantly. The brands that built strong Google visibility in 2012-2015 dominated organic traffic for years because their competitors were late.</P>

          <P>The same window is open right now for AI visibility. The question is who uses it.</P>

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

          {/* Related posts */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>Related articles</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/ai-visibility-for-indian-startups" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>AI visibility for Indian startups: full guide →</Link>
              <Link href="/what-is-geo" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>What is GEO? →</Link>
              <Link href="/llms-txt-guide" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>How to create llms.txt in 15 minutes →</Link>
              <Link href="/blog/robots-txt-blocking-ai" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>Is your robots.txt blocking ChatGPT? →</Link>
            </div>
          </div>

        </article>
      </main>
      <Footer />
    </div>
  );
}
