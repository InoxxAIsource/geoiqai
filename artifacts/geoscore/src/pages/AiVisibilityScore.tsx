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
  { q: "What is an AI visibility score?", a: "An AI visibility score is a 0-100 metric that measures how frequently and accurately AI systems like ChatGPT, Gemini, and Perplexity recommend your brand when users ask questions in your product category. GeoIQ calculates this score by running standardized prompts across 6 AI systems and tracking brand mention rates." },
  { q: "How is the AI visibility score calculated?", a: "GeoIQ's AI visibility score combines two components: an AI Memory Score (0-50 points) measuring your brand's presence in ChatGPT and Gemini training data, and a Live Web Score (0-50 points) measuring your real-time visibility in Perplexity and similar live-crawl systems. The two scores add up to a total out of 100." },
  { q: "What is a good AI visibility score?", a: "Any score above 60/100 indicates strong AI visibility - your brand appears consistently across major AI systems. Scores between 40-60 show regular mentions with room to improve. Below 40 means AI systems rarely recommend you. The average score for brands audited by GeoIQ is 31/100, which means most brands have significant room to grow." },
  { q: "How do I check my AI visibility score?", a: "Go to geoiqai.com, enter your domain name, and click the audit button. You receive a full breakdown of your AI visibility score across 6 systems in 60 seconds. No signup, email, or credit card required. GeoIQ's free audit is completely unlimited." },
  { q: "How often does the AI visibility score change?", a: "AI visibility scores can change daily as AI models update their responses, new training data gets incorporated, and competitors build new citations. Perplexity-driven scores can shift within hours of new web content being published. ChatGPT and Gemini scores are more stable but change with model updates. GeoIQ's paid plans run daily monitoring to catch these changes." },
  { q: "Why is my AI visibility score low?", a: "The most common reasons for a low AI visibility score are: (1) AI crawlers blocked in robots.txt, (2) no llms.txt file, (3) fewer than 10 third-party citations on high-authority platforms like G2, Crunchbase, or ProductHunt, (4) no Organization schema markup on your homepage, and (5) inconsistent brand descriptions across different platforms. Running a GeoIQ audit identifies exactly which factors are pulling down your score." },
  { q: "Is AI visibility score different from SEO ranking?", a: "Yes, significantly. SEO rank measures your position in Google's organic search results. AI visibility score measures how often AI chatbots cite your brand in their responses. In 2026, the overlap between top Google results and AI-cited sources has dropped below 20%. A brand can rank #1 on Google and score 0/100 for AI visibility - and vice versa." },
  { q: "Does my AI visibility score affect my revenue?", a: "Increasingly yes. As AI search handles more product discovery queries, brands invisible to AI miss a growing share of purchase-intent interactions. When someone asks ChatGPT for a project management tool recommendation and your competitor appears but you do not, that is a customer you never got the chance to win. The revenue impact compounds as AI search usage grows." },
  { q: "Can I improve my AI visibility score quickly?", a: "Yes. The technical fixes - allowing AI crawlers in robots.txt, creating llms.txt, and adding Organization schema - can be done in under 90 minutes and often produce measurable score improvements within 2-4 weeks. Citation building (G2, ProductHunt, Crunchbase) takes more time but produces the largest long-term score gains." },
  { q: "How does GeoIQ measure Perplexity visibility?", a: "GeoIQ runs standardized search queries on Perplexity and checks whether your domain is cited as a source and whether your brand name appears in the response text. Because Perplexity crawls the live web in real time, this component of your score reflects your current web presence and content quality." },
  { q: "Does a higher AI visibility score guarantee more traffic?", a: "AI visibility score correlates with traffic from AI-referred users but is not a direct guarantee. A brand scoring 80/100 on AI visibility will appear in AI recommendations far more frequently than one scoring 20/100, and each mention is a potential referral. The conversion from AI mention to user visit depends on how compelling the recommendation sounds and whether a link is included." },
  { q: "What is the AI Memory Score component?", a: "The AI Memory Score (0-50 points) measures how well-represented your brand is in the training data of ChatGPT and Gemini. It reflects citation frequency in the sources these models were trained on - publications, review platforms, directories, and community sites. This component changes slowly, improving as you build more authoritative citations over time." },
  { q: "What is the Live Web Score component?", a: "The Live Web Score (0-50 points) measures your real-time web visibility as assessed by Perplexity and similar crawlers. It reflects your current website quality, content freshness, and how recently authoritative sources have mentioned your brand. This component can improve faster than the AI Memory Score because it responds to live web changes." },
  { q: "How is GeoIQ's AI visibility score different from other GEO tools?", a: "GeoIQ is the only GEO tool that breaks the score into two distinct components (AI Memory + Live Web), tracks 6 AI systems simultaneously, and includes a GEO Agent that can explain your score and generate specific fix recommendations in real time. Other tools like Rankscale and Elmo provide scores but without the fix-action layer." },
  { q: "Does AI visibility score matter for B2B brands?", a: "Yes, especially for B2B. Enterprise buyers increasingly use AI assistants to research software purchases, compare vendors, and build shortlists. A B2B brand invisible in AI responses is invisible to a growing share of top-of-funnel research activity. B2B brands that appear consistently in AI responses when buyers search for solutions in their category have a measurable advantage in pipeline generation." },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "AI Visibility Score: What It Is and How to Check Yours Free",
  "author": { "@type": "Person", "name": "Tauheed" },
  "publisher": { "@type": "Organization", "name": "GeoIQ", "logo": { "@type": "ImageObject", "url": "https://geoiqai.com/favicon.svg" } },
  "datePublished": "2026-04-15",
  "dateModified": "2026-05-25",
  "description": "Your AI visibility score measures how often ChatGPT, Gemini and Perplexity recommend your brand. Check your score free in 60 seconds.",
  "url": "https://geoiqai.com/ai-visibility-score",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://geoiqai.com/ai-visibility-score" },
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "GeoIQ AI Visibility Score",
  "applicationCategory": "BusinessApplication",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "description": "Free AI visibility score checker. Measures how often ChatGPT, Gemini and Perplexity recommend your brand. Results in 60 seconds.",
  "url": "https://geoiqai.com",
  "operatingSystem": "Web",
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
    { "@type": "ListItem", "position": 2, "name": "AI Visibility Score", "item": "https://geoiqai.com/ai-visibility-score" },
  ],
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.25, marginBottom: 16, marginTop: 40 }}>
    {children}
  </h2>
);

const P = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16, ...style }}>{children}</p>
);

const scoreRanges = [
  { range: "81-100", label: "Dominant", desc: "AI systems consistently recommend your brand as a category leader. You appear in most relevant queries by name.", color: "#059669", bg: "#ECFDF5" },
  { range: "61-80", label: "Strong", desc: "Your brand appears consistently in AI responses. Users asking about your category will encounter your brand regularly.", color: "#0284C7", bg: "#F0F9FF" },
  { range: "41-60", label: "Visible", desc: "Regular AI mentions with some gaps. You appear in some but not all relevant queries. The gap is closeable with 4-8 weeks of citation building.", color: "#D97706", bg: "#FFFBEB" },
  { range: "21-40", label: "Emerging", desc: "Occasional mentions - AI systems have partial knowledge of your brand. You appear in some queries but disappear in others.", color: "#DC2626", bg: "#FEF2F2" },
  { range: "0-20", label: "Invisible", desc: "AI systems do not know your brand exists. You are absent from AI responses even for queries directly about your product category.", color: "#6B7280", bg: "#F9FAFB" },
];

export default function AiVisibilityScore() {
  useEffect(() => {
    document.title = "AI Visibility Score: What It Is and How to Check Yours Free | GeoIQ";
    setMeta("description", "Your AI visibility score measures how often ChatGPT, Gemini and Perplexity recommend your brand. Check your score free in 60 seconds.");
    setMeta("og:title", "AI Visibility Score: What It Is and How to Check Yours Free | GeoIQ", true);
    setMeta("og:description", "Your AI visibility score measures how often ChatGPT, Gemini and Perplexity recommend your brand. Check your score free in 60 seconds.", true);
    setMeta("og:url", "https://geoiqai.com/ai-visibility-score", true);
    setMeta("og:type", "article", true);
    setMeta("og:image", "https://geoiqai.com/og-ai-visibility-score.png", true);
    setLink("canonical", "https://geoiqai.com/ai-visibility-score");
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "white" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

        <article style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>

          {/* Breadcrumb */}
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
            <Link href="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <span>AI Visibility Score</span>
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.2, marginBottom: 16 }}>
            What is an AI Visibility Score? (And How to Improve Yours)
          </h1>

          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9CA3AF", marginBottom: 28, flexWrap: "wrap" }}>
            <span>By Tauheed</span>
            <span>·</span>
            <span>Last updated: May 2026</span>
            <span>·</span>
            <span>7 min read</span>
          </div>

          {/* Summary box */}
          <div style={{ background: "#EEF2FF", borderLeft: "4px solid #4F46E5", borderRadius: 8, padding: 20, marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Quick answer</div>
            <p style={{ fontSize: 15, color: "#1E1B4B", lineHeight: 1.75, margin: 0 }}>
              An AI visibility score measures how frequently and accurately AI systems like ChatGPT, Gemini, and Perplexity recommend your brand when users ask questions in your category. GeoIQ scores brands from 0-100 by running standardized prompts across 6 AI systems and tracking mention rates. The average brand scores 31/100 - most brands are largely invisible to AI search.
            </p>
          </div>

          {/* Key stats */}
          <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "14px 20px", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Key stats</div>
            <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              <li style={{ fontSize: 14, color: "#374151" }}>Gartner predicts traditional search volume will drop 25% by 2026 due to AI assistants replacing standard queries</li>
              <li style={{ fontSize: 14, color: "#374151" }}>Overlap between Google top-10 results and AI-cited sources dropped from 70% to below 20% in 2026</li>
              <li style={{ fontSize: 14, color: "#374151" }}>Average AI visibility score for brands audited by GeoIQ: 31/100. Most brands are largely invisible in AI search.</li>
            </ul>
          </div>

          <H2>Why AI visibility matters more than Google ranking in 2026</H2>

          <P>
            Gartner predicts traditional search engine volume will drop 25% by 2026 as users shift to AI assistants for product discovery, research, and recommendations. This is not a distant forecast - it is happening now. ChatGPT has 200 million weekly users. Google AI Overviews appear on over 40% of all searches. Perplexity handles 15 million daily queries.
          </P>

          <P>
            The critical insight for founders: the overlap between Google's top organic results and the sources AI systems cite has collapsed from 70% to below 20% in 2026. Ranking #1 on Google for your category keyword no longer gives you AI visibility. These are separate channels with separate signal sets, and most brands are managing only one.
          </P>

          <P>
            When a founder asks ChatGPT "best CRM for a 20-person Indian SaaS company," they get one synthesized answer. The brands in that answer get a direct line to a high-intent, AI-trusting buyer. The brands not in it are invisible - not ranked lower, but completely absent from the conversation.
          </P>

          <H2>How the AI visibility score is calculated</H2>

          <P>GeoIQ's 0-100 score combines two distinct components that reflect how AI systems actually retrieve information:</P>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
            <div style={{ background: "#EEF2FF", borderRadius: 10, padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>AI Memory Score</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#4F46E5", fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>0-50</div>
              <P style={{ fontSize: 13, margin: 0 }}>Measures your brand's presence in ChatGPT and Gemini training data. Reflects how well-cited you are in the sources these models learned from. Changes slowly - improves with consistent citation building over weeks and months.</P>
            </div>
            <div style={{ background: "#ECFDF5", borderRadius: 10, padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Live Web Score</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#059669", fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>0-50</div>
              <P style={{ fontSize: 13, margin: 0 }}>Measures real-time visibility via Perplexity and live-crawling systems. Reflects your current website quality, content freshness, and recent mentions. Can improve within days of new content being published.</P>
            </div>
          </div>

          <P>GeoIQ also tracks 4 additional AI systems - Claude, Grok, Google AI Overviews, and Bing Copilot - and weights them into the overall score. The result is a composite 0-100 metric that reflects your brand's AI visibility across the entire AI search landscape, not just one system.</P>

          <H2>What your score means</H2>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
            {scoreRanges.map((range) => (
              <div key={range.range} style={{ display: "flex", gap: 16, alignItems: "flex-start", background: range.bg, borderRadius: 8, padding: "14px 18px" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: range.color, fontFamily: "'Syne', sans-serif", minWidth: 60, flexShrink: 0 }}>{range.range}</div>
                <div>
                  <div style={{ fontWeight: 700, color: range.color, fontSize: 14, marginBottom: 3 }}>{range.label}</div>
                  <P style={{ fontSize: 13, margin: 0, color: "#374151" }}>{range.desc}</P>
                </div>
              </div>
            ))}
          </div>

          <H2>Average AI visibility scores by company stage</H2>

          <P>Based on GeoIQ audits across hundreds of brands, here is what scores typically look like by stage:</P>

          <div style={{ overflowX: "auto", marginBottom: 32 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Stage", "Avg score", "Typical bottleneck"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { stage: "Pre-launch / under 1 year", score: "8/100", bottleneck: "No citations exist yet, AI has no training data", scoreColor: "#DC2626" },
                  { stage: "Early startup (1-3 years)", score: "24/100", bottleneck: "Few third-party citations, basic technical issues", scoreColor: "#D97706" },
                  { stage: "Growth stage (3-6 years)", score: "45/100", bottleneck: "Inconsistent entity signals, citation gaps", scoreColor: "#D97706" },
                  { stage: "Scale-up / Series B+", score: "67/100", bottleneck: "Strong presence but Perplexity gaps", scoreColor: "#0284C7" },
                  { stage: "Enterprise / established brand", score: "78/100", bottleneck: "Optimization gaps, not fundamental visibility", scoreColor: "#059669" },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 500, color: "#374151" }}>{row.stage}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: row.scoreColor }}>{row.score}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{row.bottleneck}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H2>Check your AI visibility score free</H2>

          <P>Enter your domain below to get your AI visibility score across ChatGPT, Gemini, Perplexity, Claude, and Grok in 60 seconds. No signup required.</P>

          <div style={{ background: "#EEF2FF", border: "1.5px solid #C7D2FE", borderRadius: 12, padding: "28px 24px", marginBottom: 40, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1E1B4B", marginBottom: 20 }}>Free AI visibility audit - no signup needed</div>
            <Link href="/">
              <button style={{ background: "#4F46E5", color: "white", fontWeight: 700, fontSize: 15, padding: "14px 32px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
                Check my AI visibility score →
              </button>
            </Link>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 12 }}>Results in 60 seconds. Covers ChatGPT, Gemini, Perplexity, Claude, and Grok.</div>
          </div>

          <H2>How to improve your AI visibility score</H2>

          <P>The six actions below address the most common reasons brands score low. Work through them in order - the top three are technical fixes that take under 90 minutes total.</P>

          <div style={{ marginBottom: 40 }}>
            {[
              { rank: 1, action: "Allow AI crawlers in robots.txt", time: "10 min", impact: "High", detail: "Check yourdomain.com/robots.txt. Add explicit Allow: / rules for GPTBot, PerplexityBot, Claude-Web, and Google-Extended. Blocking any of these prevents that AI system from reading your site." },
              { rank: 2, action: "Create llms.txt", time: "15 min", impact: "High", detail: "Create a plain text file at yourdomain.com/llms.txt describing your brand, product, and key pages. AI crawlers read this file to understand your brand context before parsing individual pages. See our llms.txt guide for the exact format." },
              { rank: 3, action: "Add Organization schema markup", time: "20 min", impact: "High", detail: "Add JSON-LD Organization schema to your homepage head. This tells AI systems your brand name, description, URL, and social profiles in machine-readable format. Gemini uses this directly for entity recognition." },
              { rank: 4, action: "Build third-party citations", time: "2-4 weeks", impact: "Very High", detail: "Submit to G2, Capterra, Crunchbase, AngelList, and ProductHunt. Each listing is a citation that AI training data indexes. Brands with 20-30 independent citations consistently appear in ChatGPT recommendations. This is the highest-impact long-term investment." },
              { rank: 5, action: "Write factual, quotable content", time: "Ongoing", impact: "Medium", detail: "Publish content with specific claims, named statistics, and direct answers to user questions. AI systems extract and cite sentences that are factual and self-contained. Marketing language ('the best solution') is ignored; specific claims ('reduces onboarding time by 40%') get cited." },
              { rank: 6, action: "Standardize entity signals", time: "1-2 hours", impact: "Medium", detail: "Make sure your brand name, description, and category are identical across LinkedIn, Crunchbase, your website, Twitter/X, and every directory listing. Inconsistency creates multiple weak entity signals instead of one strong one that AI systems can confidently cite." },
            ].map((item) => (
              <div key={item.rank} style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {item.rank}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 600, color: "#111827", fontSize: 15 }}>{item.action}</div>
                    <span style={{ background: "#f3f4f6", color: "#374151", fontSize: 11, padding: "2px 8px", borderRadius: 9999 }}>{item.time}</span>
                    <span style={{ background: item.impact === "Very High" ? "#ECFDF5" : item.impact === "High" ? "#EEF2FF" : "#FFFBEB", color: item.impact === "Very High" ? "#059669" : item.impact === "High" ? "#4F46E5" : "#D97706", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9999 }}>{item.impact} impact</span>
                  </div>
                  <P style={{ margin: 0, fontSize: 14 }}>{item.detail}</P>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ background: "#4F46E5", borderRadius: 16, padding: "36px 32px", textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ color: "white", fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", marginBottom: 8, marginTop: 0 }}>
              Check your AI visibility score free
            </h2>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              See your score across ChatGPT, Gemini, Perplexity, Claude, and Grok in 60 seconds. No signup, no credit card, no limit on free audits.
            </p>
            <Link href="/">
              <button style={{ background: "white", color: "#4F46E5", fontWeight: 700, fontSize: 15, padding: "12px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
                Check my AI visibility score →
              </button>
            </Link>
          </div>

          <H2>Frequently asked questions about AI visibility score</H2>

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
