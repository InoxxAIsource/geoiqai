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
  { q: "How long does it take to rank in ChatGPT?", a: "Most brands see measurable improvement in 4-8 weeks after completing the six steps in this guide. Perplexity responds fastest - often within days of a new page being indexed. ChatGPT and Gemini depend on model update cycles and may take 8-12 weeks to fully reflect new citations. Consistent effort across all six steps compounds faster than sporadic activity on one." },
  { q: "Does Google SEO help with ChatGPT ranking?", a: "Yes, indirectly. Pages that rank well on Google are more likely to appear in AI training data and in ChatGPT's real-time browsing results. Good SEO and GEO use overlapping signals - structured content, authoritative backlinks, and fast load times. But SEO alone is not enough: a brand can rank #1 on Google and still score 0/100 on GeoIQ if it has no third-party citations." },
  { q: "What is GPTBot and should I allow it?", a: "GPTBot is OpenAI's web crawler, used to train ChatGPT and retrieve pages for GPT-4o's browsing mode. You should allow it in robots.txt unless you have a specific reason not to. Blocking GPTBot means ChatGPT cannot learn from your content or retrieve your pages in real-time browsing. Add 'User-agent: GPTBot' and 'Allow: /' to your robots.txt." },
  { q: "Can I pay to appear in ChatGPT?", a: "No. ChatGPT does not accept paid placements in conversational responses. OpenAI offers advertising on its platform but these are distinct from organic recommendations. Your brand appears in ChatGPT answers through training data coverage and citation frequency - both purely organic signals. This makes ChatGPT visibility more valuable and more defensible than paid advertising." },
  { q: "Why does ChatGPT recommend my competitor?", a: "Your competitor has more independent citations across authoritative sources in ChatGPT's training data. They may be on G2, ProductHunt, Crunchbase, and covered in tech publications - all sources heavily indexed in AI training. Run a GeoIQ audit to see your current score versus what a well-cited competitor looks like, then work down the citation checklist in this guide." },
  { q: "Does having a Wikipedia page help?", a: "Yes, significantly. Wikipedia pages feed directly into AI training data and are weighted as high-authority sources. If you cannot get a Wikipedia page (notable coverage required), Crunchbase and AngelList profiles are the next best alternatives - both are heavily indexed in ChatGPT's training data and provide structured brand information." },
  { q: "What publications carry the most weight for ChatGPT?", a: "TechCrunch, The Verge, Wired, Hacker News, ProductHunt, and Reddit's startup communities carry the highest weight for US-focused queries. For India-specific visibility on Gemini: YourStory, Inc42, Economic Times Tech, and Entrackr are particularly valuable. Coverage in any of these in 2024-2026 has more impact than older mentions from 2020-2022." },
  { q: "How does ChatGPT's browsing mode change things?", a: "ChatGPT's browsing mode (available in GPT-4o) retrieves live web pages and cites them directly in responses. For browsing mode, your website's content quality matters directly - structured headings, factual claims, and fast load times all help. Building both training data coverage (through third-party citations) and real-time authority (through good on-page content) gives you the strongest position across both modes." },
  { q: "How do I know if ChatGPT mentions my brand?", a: "Use GeoIQ at geoiqai.com to run automated prompts across ChatGPT, Gemini, and Perplexity and track your visibility score over time. Free audit, no signup required. Manually, open ChatGPT and type prompts like 'best [your category] for [your use case] in India' and note whether your brand appears. Run at least 10 different prompts to get a representative result." },
  { q: "Is schema markup important for ChatGPT?", a: "Organization schema is the most important markup for ChatGPT training data - it provides machine-readable confirmation of your brand name, description, URL, and social profiles. Article schema and FAQPage schema help Perplexity and Google AI Overviews extract and cite your content directly. All schema should be implemented as JSON-LD in your page head." },
  { q: "How many external citations do I need?", a: "Brands with 20-30 independent citations on authoritative platforms consistently appear in category recommendations. There is no hard minimum, but brands with fewer than 5-10 external mentions rarely appear reliably. Each new high-DA citation adds measurable signal. Prioritize quality over quantity: one G2 profile outperforms ten low-DA directory listings." },
  { q: "Does my About page content help?", a: "Your About page contributes to Perplexity's real-time retrieval if it is well-structured and factual. For ChatGPT and Gemini, it matters less than third-party sources. Write your About page as if ChatGPT will read it aloud: a precise, factual paragraph naming your category, use case, target market, and one key differentiator with a specific number." },
  { q: "What is the fastest GEO win I can get?", a: "Submitting to ProductHunt takes 20 minutes and reaches a platform heavily indexed in ChatGPT's training data. Creating a complete Crunchbase profile takes 15 minutes. Both can begin moving your GEO score within 4-6 weeks. The fastest technical fix is checking and correcting your robots.txt - a 10-minute change that immediately stops blocking AI crawlers." },
  { q: "How often should I check my ChatGPT visibility?", a: "At minimum, monthly. AI model updates change citation patterns and a brand that was visible last month may not be visible this month if a competitor gained significant new coverage. GeoIQ's paid plans run daily monitoring with weekly digest emails, so score changes are caught automatically without manual checks." },
  { q: "Does Gemini use the same signals as ChatGPT?", a: "Gemini uses Google's knowledge graph extensively - Google Business Profile, structured data markup, and coverage in Google-indexed publications matter more for Gemini than for ChatGPT. For India, coverage in YourStory, Inc42, and other Google-indexed Indian publications has a direct impact on Gemini's knowledge of Indian brands. ChatGPT relies more on training data crawls across the broader web." },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Rank in ChatGPT: Complete Guide 2026",
  "author": { "@type": "Person", "name": "Tauheed" },
  "publisher": { "@type": "Organization", "name": "GeoIQ", "logo": { "@type": "ImageObject", "url": "https://geoiqai.com/favicon.svg" } },
  "datePublished": "2026-02-01",
  "dateModified": "2026-05-25",
  "description": "Step by step guide to getting your brand recommended by ChatGPT. Technical fixes, content strategy, and citation building. Check your score free.",
  "url": "https://geoiqai.com/how-to-rank-in-chatgpt",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://geoiqai.com/how-to-rank-in-chatgpt" },
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Rank in ChatGPT",
  "description": "Step by step guide to getting your brand recommended by ChatGPT, Gemini, and Perplexity.",
  "totalTime": "PT3H",
  "step": [
    { "@type": "HowToStep", "name": "Check if GPTBot is allowed in robots.txt", "text": "Visit yourdomain.com/robots.txt. Look for User-agent: GPTBot and Allow: /. If missing, add it.", "url": "https://geoiqai.com/how-to-rank-in-chatgpt#step-1" },
    { "@type": "HowToStep", "name": "Create llms.txt", "text": "Create a plain text file at yourdomain.com/llms.txt describing your brand, product, and team for AI systems.", "url": "https://geoiqai.com/how-to-rank-in-chatgpt#step-2" },
    { "@type": "HowToStep", "name": "Add Organization schema markup", "text": "Add JSON-LD Organization schema to your homepage head with your brand name, description, URL, and social profiles.", "url": "https://geoiqai.com/how-to-rank-in-chatgpt#step-3" },
    { "@type": "HowToStep", "name": "Create a Crunchbase profile", "text": "Submit your company to Crunchbase with full details. ChatGPT training data includes Crunchbase heavily.", "url": "https://geoiqai.com/how-to-rank-in-chatgpt#step-4" },
    { "@type": "HowToStep", "name": "Submit to Product Hunt", "text": "Create a Product Hunt listing. Product Hunt is one of the most heavily indexed tech platforms in AI training data.", "url": "https://geoiqai.com/how-to-rank-in-chatgpt#step-5" },
    { "@type": "HowToStep", "name": "Write your foundational article", "text": "Publish a 1,500+ word factual article about your brand and category on your domain, then cross-post to Medium and dev.to.", "url": "https://geoiqai.com/how-to-rank-in-chatgpt#step-6" },
  ],
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

const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2 id={id} style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.25, marginBottom: 16, marginTop: 40 }}>
    {children}
  </h2>
);

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontSize: 18, fontWeight: 600, fontFamily: "'Syne', sans-serif", color: "#1E1B4B", lineHeight: 1.3, marginBottom: 10, marginTop: 24 }}>
    {children}
  </h3>
);

const P = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16, ...style }}>{children}</p>
);

export default function HowToRankInChatGPT() {
  useEffect(() => {
    document.title = "How to Rank in ChatGPT: Complete Guide 2026 | GeoIQ";
    setMeta("description", "Step by step guide to getting your brand recommended by ChatGPT. Technical fixes, content strategy, and citation building. Check your score free.");
    setMeta("og:title", "How to Rank in ChatGPT: Complete Guide 2026 | GeoIQ", true);
    setMeta("og:description", "Step by step guide to getting your brand recommended by ChatGPT. Technical fixes, content strategy, and citation building. Check your score free.", true);
    setMeta("og:url", "https://geoiqai.com/how-to-rank-in-chatgpt", true);
    setMeta("og:type", "article", true);
    setMeta("og:image", "https://geoiqai.com/og-chatgpt.png", true);
    setLink("canonical", "https://geoiqai.com/how-to-rank-in-chatgpt");
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "white" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <article style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>

          {/* Breadcrumb */}
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
            <Link href="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <span>How to rank in ChatGPT</span>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.2, marginBottom: 16 }}>
            How to Rank in ChatGPT: Complete Guide 2026
          </h1>

          {/* Byline */}
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
              To rank in ChatGPT you need to (1) allow GPTBot in robots.txt, (2) get cited on high-authority sources in your category, and (3) create factual content that AI can quote. Most brands can see improvement within 4-8 weeks. This guide walks through all six steps with exact time estimates and direct links.
            </p>
          </div>

          {/* Key stats */}
          <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "14px 20px", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Key stats</div>
            <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              <li style={{ fontSize: 14, color: "#374151" }}>ChatGPT has over 200 million weekly active users as of 2026 - the largest AI recommendation surface in the world</li>
              <li style={{ fontSize: 14, color: "#374151" }}>A SaaS tool with 40 G2 reviews consistently outranks a tool with 50,000 users but no third-party citations in AI recommendations</li>
              <li style={{ fontSize: 14, color: "#374151" }}>ChatGPT's browsing mode uses the same authority signals as Google for source selection</li>
              <li style={{ fontSize: 14, color: "#374151" }}>Brands with 20-30 independent citations appear in ChatGPT category recommendations 80% of the time (GeoIQ audit data, 2026)</li>
            </ul>
          </div>

          <P>
            Getting your brand recommended by ChatGPT is one of the highest-leverage distribution moves available to founders in 2026. When someone asks ChatGPT for a recommendation in your category, they get one synthesized answer, not ten blue links. If your brand is in that answer, you reach a high-intent user who already trusts the recommendation. If you are not, you are invisible to that query.
          </P>

          <P>
            This guide explains exactly how ChatGPT decides what to recommend, and gives you a precise six-step checklist you can work through in a single afternoon.
          </P>

          <H2>How ChatGPT actually works</H2>

          <P>
            ChatGPT answers from training data - a snapshot of the internet taken before its cutoff date. It cannot browse the web in real time unless the web search feature is explicitly enabled. This means your website content alone is not enough. You need to be cited by sources that were in ChatGPT's training data - publications, directories, review platforms, and community sites that OpenAI's crawlers indexed.
          </P>

          <P>
            There are two modes to understand: standard ChatGPT draws entirely from training data, meaning citations from before the training cutoff are what matters. GPT-4o's browsing mode performs live web searches, applying authority signals similar to Google's - domain authority, inbound links, structured content, and freshness. Both modes need to be optimized for.
          </P>

          <P>
            The practical implication: building citations on G2, Crunchbase, ProductHunt, and TechCrunch is not just good PR. Each of those platforms was heavily crawled by OpenAI during training. A brand with a complete G2 profile, a Crunchbase listing, and a ProductHunt launch is far more likely to appear in ChatGPT training data than a brand that only has a great website.
          </P>

          <H2>What signals ChatGPT trusts most</H2>

          <div style={{ marginBottom: 32 }}>
            {[
              { title: "Frequency of mention across independent sources", body: "If 30 independent websites mention your brand in the context of your category, ChatGPT is far more likely to include you when that category comes up. Each independent mention is a vote confirming your brand belongs in the conversation. Frequency across diverse sources outperforms depth on any single site." },
              { title: "Context of mentions - are you recommended or just listed?", body: "Being mentioned as a recommendation ('founders should try X') carries more weight than being listed as an option in a directory. Reviews, case studies, and comparisons that position your brand favorably create stronger citation signals than plain listings. Aim for editorial mentions not just directory entries." },
              { title: "Consistency of brand description across sources", body: "If G2 calls you a 'CRM', TechCrunch calls you a 'sales tool', and your website calls you a 'revenue platform', ChatGPT sees three different things. The model cannot confidently recommend you because it does not know what category you belong in. Use one precise description everywhere." },
              { title: "Recency of coverage in the training window", body: "More recent training data carries more weight, especially for fast-moving categories like AI tools and fintech. Coverage from 2024-2026 in relevant publications will be more impactful than older mentions from 2020, even from authoritative sources. Prioritize fresh coverage over retrospective citations." },
            ].map((item, i) => (
              <div key={i} style={{ padding: "18px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontWeight: 600, color: "#111827", marginBottom: 8, fontSize: 15 }}>{item.title}</div>
                <P style={{ margin: 0 }}>{item.body}</P>
              </div>
            ))}
          </div>

          <H2>Step by step: how to appear in ChatGPT results</H2>

          <P>Work through these six steps in order. Steps 1-3 are technical fixes that take under an hour total. Steps 4-6 build the citation profile that moves your score over 4-8 weeks.</P>

          <div style={{ marginBottom: 40 }}>
            {[
              {
                id: "step-1",
                n: "01",
                title: "Check if GPTBot is allowed in robots.txt",
                time: "10 minutes",
                detail: [
                  "Visit yourdomain.com/robots.txt in your browser.",
                  "Look for: User-agent: GPTBot with Allow: / or no Disallow: / rule.",
                  "If GPTBot is missing or blocked, add these lines to your robots.txt:",
                ],
                code: "User-agent: GPTBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: Claude-Web\nAllow: /",
                extra: "Also add anthropic-ai, OAI-SearchBot, and Google-Extended while you are there. Blocking any of these prevents that AI system from crawling your pages.",
              },
              {
                id: "step-2",
                n: "02",
                title: "Create llms.txt",
                time: "15 minutes",
                detail: [
                  "Create a plain text file at yourdomain.com/llms.txt.",
                  "This file tells AI systems about your brand directly - think of it as robots.txt for AI.",
                  "Include: brand name, product description, target market, key use cases, founding year, team size, and links to key pages.",
                ],
                code: "# [Your Brand] - llms.txt\n\n## About\n[Brand] is a [category] tool that helps [target user] [key benefit].\nFounded [year]. [X] users in [Y] countries.\n\n## Key pages\n- Product: https://yourdomain.com\n- About: https://yourdomain.com/about\n- Blog: https://yourdomain.com/blog",
                extra: "Keep it factual and specific. AI systems parse this file to understand your brand context.",
              },
              {
                id: "step-3",
                n: "03",
                title: "Add Organization schema markup to your homepage",
                time: "20 minutes",
                detail: [
                  "Add this JSON-LD block to your homepage head tag.",
                  "Organization schema tells AI systems your brand name, description, URL, and social profiles in machine-readable format.",
                  "Gemini uses this directly to build knowledge graph entries for your brand.",
                ],
                code: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "Your Brand",\n  "url": "https://yourdomain.com",\n  "description": "One precise sentence about your product.",\n  "foundingDate": "2024",\n  "sameAs": [\n    "https://linkedin.com/company/yourbrand",\n    "https://twitter.com/yourbrand",\n    "https://crunchbase.com/organization/yourbrand"\n  ]\n}\n</script>`,
                extra: "The sameAs field is especially important - it links your website to your profiles on platforms AI systems trust.",
              },
              {
                id: "step-4",
                n: "04",
                title: "Create a Crunchbase profile",
                time: "15 minutes",
                detail: [
                  "Go to crunchbase.com/add-new/organization and submit your company.",
                  "ChatGPT's training data includes Crunchbase heavily - it is one of the most-referenced startup data sources in AI training.",
                  "Fill in every field: description, category, founding date, location, funding, team members.",
                ],
                code: "",
                extra: "A complete Crunchbase profile is worth more for ChatGPT visibility than 10 low-DA directory listings. Once submitted, it can take 2-4 weeks to appear in AI responses.",
              },
              {
                id: "step-5",
                n: "05",
                title: "Submit to Product Hunt",
                time: "20 minutes",
                detail: [
                  "Create a Product Hunt listing at producthunt.com/posts/new.",
                  "Product Hunt is one of the most heavily indexed tech platforms in AI training data.",
                  "Upvotes and comments on your listing amplify the signal - ask your network to engage on launch day.",
                ],
                code: "",
                extra: "A Product Hunt listing with 50+ upvotes is treated differently from one with 5. Launch on a Tuesday-Thursday for best engagement. The activity signals to AI that your brand has community validation.",
              },
              {
                id: "step-6",
                n: "06",
                title: "Write and publish your foundational article",
                time: "2-3 hours",
                detail: [
                  "Write a 1,500+ word factual article about your brand and category.",
                  "Structure it with clear H2 headings answering real user questions, specific statistics, and your brand name mentioned naturally throughout.",
                  "Publish it on your own domain first, then cross-post to Medium (medium.com) and dev.to.",
                ],
                code: "",
                extra: "This article becomes the canonical reference AI systems find when looking for content about your category. It should read like a Wikipedia entry - factual, structured, and comprehensive - not like a marketing page.",
              },
            ].map((step) => (
              <div key={step.id} id={step.id} style={{ padding: "24px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#E0E7FF", fontFamily: "'Syne', sans-serif", flexShrink: 0, lineHeight: 1 }}>
                    {step.n}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "#111827", fontSize: 16, fontFamily: "'Syne', sans-serif" }}>{step.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Time: {step.time}</div>
                  </div>
                </div>
                <ul style={{ margin: "0 0 12px 0", padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 5 }}>
                  {step.detail.map((d, i) => (
                    <li key={i} style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{d}</li>
                  ))}
                </ul>
                {step.code && (
                  <pre style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 6, padding: "12px 16px", fontSize: 12, color: "#374151", overflowX: "auto", marginBottom: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {step.code}
                  </pre>
                )}
                {step.extra && (
                  <P style={{ fontSize: 14, color: "#6b7280", margin: 0, fontStyle: "italic" }}>{step.extra}</P>
                )}
              </div>
            ))}
          </div>

          <H2>Case study: MealCoreAI improved from 20 to 66 in one afternoon</H2>

          <P>
            MealCoreAI is an Indian health app focused on diabetes management. When they ran their first GeoIQ audit, their technical score was 20/100. The AI engines they most needed - ChatGPT and Perplexity - were not citing them despite having a solid product and real users.
          </P>

          <H3>What the audit found</H3>

          <div style={{ marginBottom: 20 }}>
            {[
              { issue: "robots.txt blocking GPTBot", fix: "Added explicit Allow: / rule for GPTBot, PerplexityBot, and Claude-Web", time: "10 min" },
              { issue: "No llms.txt file", fix: "Created llms.txt with brand description, product details, and key page links", time: "15 min" },
              { issue: "128 orphan pages with no internal links", fix: "Added internal links from homepage and blog to key product pages", time: "45 min" },
              { issue: "No Organization schema", fix: "Added JSON-LD Organization markup to homepage with sameAs social links", time: "20 min" },
            ].map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, padding: "12px 0", borderBottom: "1px solid #f3f4f6", alignItems: "start" }}>
                <div style={{ fontSize: 13, color: "#DC2626" }}>{row.issue}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{row.fix}</div>
                <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{row.time}</div>
              </div>
            ))}
          </div>

          <H3>Before and after</H3>

          <div style={{ overflowX: "auto", marginBottom: 32 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Metric", "Before", "After", "Change"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Technical score", "20/100", "66/100", "+46 points"],
                  ["ChatGPT visibility", "0%", "partial", "Appearing in category queries"],
                  ["Perplexity visibility", "blocked", "active", "Pages now crawled"],
                  ["AI crawlers allowed", "0 of 4", "4 of 4", "All major crawlers"],
                  ["Time to fix", "-", "-", "~90 minutes total"],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 500, color: "#374151" }}>{row[0]}</td>
                    <td style={{ padding: "10px 14px", color: "#DC2626" }}>{row[1]}</td>
                    <td style={{ padding: "10px 14px", color: "#059669" }}>{row[2]}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#4F46E5" }}>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <P>
            The technical fixes alone - robots.txt, llms.txt, Organization schema, and internal links - took 90 minutes and moved the technical score from 20 to 66. Citation building (G2 profile, Crunchbase submission, ProductHunt listing) followed over the next two weeks and started moving the AI visibility scores.
          </P>

          <H2>Common mistakes that kill ChatGPT visibility</H2>

          <div style={{ marginBottom: 40 }}>
            {[
              { mistake: "Publishing only on your own website", fix: "Your own website carries almost no weight as a third-party citation. Every effort on your own site should be matched by effort getting mentioned on independent sites. The ratio should be roughly 50/50 between on-site content and off-site citation building." },
              { mistake: "Using different product names across platforms", fix: "If your product is called 'AcmeAI' on your website but 'Acme.ai' on social and 'Acme AI Tool' in press releases, ChatGPT sees three different entities and cannot confidently recommend any of them. Pick one exact name and standardize it everywhere, forever." },
              { mistake: "Blocking AI crawlers in robots.txt", fix: "Check your robots.txt right now. If you use a Disallow: / rule for any user agent, it may be blocking GPTBot, PerplexityBot, or other AI crawlers. Many robots.txt files have broad deny rules added years ago that were not written with AI crawlers in mind." },
              { mistake: "Waiting for a big press hit before optimizing", fix: "Small, consistent mentions across many sources outperform one TechCrunch article. Submitting to 10 niche directories, review sites, and community platforms creates a web of references that AI systems triangulate. Start now with the platforms in steps 4-5 and do not wait for earned media." },
            ].map((item, i) => (
              <div key={i} style={{ padding: "16px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9999 }}>Mistake</span>
                  <div style={{ fontWeight: 600, color: "#111827", fontSize: 15 }}>{item.mistake}</div>
                </div>
                <P style={{ margin: 0, fontSize: 14 }}>
                  <strong style={{ color: "#059669" }}>Fix:</strong> {item.fix}
                </P>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ background: "#4F46E5", borderRadius: 16, padding: "36px 32px", textAlign: "center", marginBottom: 48 }}>
            <h3 style={{ color: "white", fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>
              Check if ChatGPT knows your brand
            </h3>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Free audit. No signup. See your score across ChatGPT, Gemini, Perplexity, Claude, and Grok in 60 seconds.
            </p>
            <Link href="/">
              <button style={{ background: "white", color: "#4F46E5", fontWeight: 700, fontSize: 15, padding: "12px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
                Check if ChatGPT knows your brand →
              </button>
            </Link>
          </div>

          {/* FAQ */}
          <H2>Frequently asked questions</H2>

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
              <Link href="/" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>
                Free AI visibility audit →
              </Link>
              <Link href="/what-is-geo" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>
                What is GEO? →
              </Link>
              <Link href="/geo-tools" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>
                Best GEO tools 2026 →
              </Link>
              <Link href="/pricing" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>
                GeoIQ paid plan →
              </Link>
            </div>
          </div>

        </article>
      </main>
      <Footer />
    </div>
  );
}
