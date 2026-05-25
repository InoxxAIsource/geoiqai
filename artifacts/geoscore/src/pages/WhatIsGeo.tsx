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
  { q: "What is GEO optimization?", a: "GEO optimization (Generative Engine Optimization) is the practice of making your brand appear in AI-generated answers from ChatGPT, Gemini, and Perplexity. It is to AI search what SEO is to Google - a systematic way to earn recommendations from the systems your customers use to make decisions." },
  { q: "How is GEO different from SEO?", a: "SEO targets Google's ranking algorithm through backlinks and keyword density. GEO targets AI citation frequency through authority signals, factual content, and third-party mentions. The two compound each other - content that ranks well on Google is more likely to appear in AI training data, which improves GEO." },
  { q: "How long does GEO take to work?", a: "Most brands see measurable improvement in 4-8 weeks after building citations on G2, ProductHunt, and Crunchbase. Perplexity responds fastest because it crawls the web in real time. ChatGPT and Gemini depend on training cycles and may take 8-12 weeks to fully reflect new coverage." },
  { q: "What is a good GEO score?", a: "A GEO score above 60/100 indicates strong AI visibility - your brand appears in responses across most major AI systems. Scores between 30-60 mean partial visibility with room to grow. Below 30 means AI systems rarely or never mention your brand. The average Indian SaaS startup scores 15-25 when first audited." },
  { q: "Does GEO work for Indian brands?", a: "Yes, and it is particularly urgent for Indian brands. Gemini is deeply integrated into Android (dominant in India), so brands that appear in Gemini's knowledge graph reach hundreds of millions of Indian users. GeoIQ specifically tracks Indian publications like YourStory and Inc42 as citation sources for Gemini." },
  { q: "What is llms.txt?", a: "llms.txt is a text file placed at yourdomain.com/llms.txt that tells AI systems about your brand in a structured way. Similar to robots.txt for search crawlers, it signals to AI that your site is AI-crawler-friendly and provides brand context in a format AI systems can parse directly." },
  { q: "How do I check my GEO score?", a: "Use GeoIQ's free audit tool at geoiqai.com. Enter your domain and within 60 seconds you receive a 0-100 GEO score broken down by AI system - ChatGPT, Gemini, Perplexity, Claude, and Grok. No signup or credit card required." },
  { q: "What is ChatGPT brand visibility?", a: "ChatGPT brand visibility is how often and how prominently ChatGPT mentions your brand when users ask questions in your product category. A brand with high ChatGPT visibility appears in responses to queries like 'best project management tool' or 'recommended fintech apps in India.'" },
  { q: "What is the most important GEO signal?", a: "Third-party citations. A brand mentioned by 20-30 independent sources - review sites, tech publications, and community platforms - will consistently appear in AI answers before a brand with a better product but no external mentions. First-party content (your own website) carries far less weight than independent references." },
  { q: "Does my website content help with GEO?", a: "Somewhat. Perplexity crawls the web in real time, so a well-structured, factual homepage with clear headings helps. For ChatGPT and Gemini, third-party mentions matter far more than anything you publish on your own domain. Your About page and product description should be optimized as source material for AI to quote." },
  { q: "What is the difference between GEO, AEO, and SEO?", a: "SEO (Search Engine Optimization) targets Google rankings. AEO (Answer Engine Optimization) targets featured snippets and voice search answers. GEO (Generative Engine Optimization) targets AI chatbot citations. All three are distinct tracks with overlapping signals - content optimized for GEO typically also improves SEO and AEO performance." },
  { q: "Which AI systems should I optimize for first?", a: "Start with ChatGPT (200 million weekly users, largest AI recommendation surface) and Gemini (critical for India due to deep Android integration). Add Perplexity next for real-time citation traffic. GeoIQ monitors all five major AI systems - ChatGPT, Gemini, Perplexity, Claude, and Grok - simultaneously." },
  { q: "What is a GEO audit?", a: "A GEO audit measures how visible your brand is across major AI systems by running standardized prompts and checking whether your brand appears in the responses. A full GEO audit includes an AI visibility score per system, technical signals check (robots.txt, llms.txt, schema), and actionable recommendations." },
  { q: "Can I pay to appear in AI recommendations?", a: "No. None of the major AI systems (ChatGPT, Gemini, Perplexity) accept paid placements in their conversational responses. AI visibility comes entirely from organic signals - citation frequency, training data coverage, and authority signals. This makes GEO a level playing field where content quality and citation building beat ad budgets." },
  { q: "How does Perplexity decide what to cite?", a: "Perplexity crawls the live web in real time and prioritizes pages that directly answer the user's query with factual, well-structured content. It favors pages with clear headings, specific numbers, and authoritative sources. Fast-loading pages with schema markup have an additional advantage in Perplexity's source selection." },
  { q: "What schema markup helps with GEO?", a: "Organization schema (confirms your brand entity), Article schema (signals content authority), FAQPage schema (makes Q&A content directly extractable by AI), and HowTo schema (structures step-by-step content for AI citation). All should be implemented as JSON-LD in your page head." },
  { q: "How many citations do I need to appear in ChatGPT?", a: "Brands with approximately 20-30 independent citations on authoritative platforms consistently appear in category recommendations. There is no hard minimum, but brands with fewer than 5-10 external mentions rarely appear reliably. Each new citation on a high-DA source adds measurable GEO signal." },
  { q: "Does GEO replace SEO?", a: "No. GEO and SEO compound each other. Pages that rank well on Google are more likely to appear in AI training data. Content that gets cited by AI systems often generates more backlinks, improving SEO. Treat them as parallel investment tracks, not alternatives - the overlap in signals means effort in one benefits the other." },
  { q: "What is entity optimization in GEO?", a: "Entity optimization means making sure AI systems can unambiguously identify your brand as a specific, real thing. This involves consistent brand name usage across all web properties, Organization schema markup, a Google Knowledge Panel, Crunchbase and Wikidata listings, and social media profiles with consistent descriptions." },
  { q: "How do I track GEO progress over time?", a: "Use GeoIQ to run weekly automated audits across ChatGPT, Gemini, and Perplexity and track your score trend. Manual tracking requires opening each AI system, running 10-15 prompts, and noting brand appearances - which takes 45 minutes per audit with no historical data. GeoIQ's dashboard shows score changes over time with the specific prompts that changed." },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "What is GEO? Generative Engine Optimization Explained (2026)",
  "author": { "@type": "Person", "name": "Tauheed" },
  "publisher": { "@type": "Organization", "name": "GeoIQ", "logo": { "@type": "ImageObject", "url": "https://geoiqai.com/favicon.svg" } },
  "datePublished": "2026-01-01",
  "dateModified": "2026-05-25",
  "description": "GEO (Generative Engine Optimization) is how brands get recommended by ChatGPT, Gemini and Perplexity. Complete guide with examples, tools and free audit.",
  "url": "https://geoiqai.com/what-is-geo",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://geoiqai.com/what-is-geo" },
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

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.25, marginBottom: 16, marginTop: 40 }}>
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

export default function WhatIsGeo() {
  useEffect(() => {
    document.title = "What is GEO? Generative Engine Optimization Explained (2026) | GeoIQ";
    setMeta("description", "GEO (Generative Engine Optimization) is how brands get recommended by ChatGPT, Gemini and Perplexity. Complete guide with examples, tools and free audit.");
    setMeta("og:title", "What is GEO? Generative Engine Optimization Explained (2026) | GeoIQ", true);
    setMeta("og:description", "GEO (Generative Engine Optimization) is how brands get recommended by ChatGPT, Gemini and Perplexity. Complete guide with examples, tools and free audit.", true);
    setMeta("og:url", "https://geoiqai.com/what-is-geo", true);
    setMeta("og:type", "article", true);
    setMeta("og:image", "https://geoiqai.com/og-what-is-geo.png", true);
    setLink("canonical", "https://geoiqai.com/what-is-geo");
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "white" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <article style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>

          {/* Breadcrumb */}
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
            <Link href="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <span>What is GEO</span>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.2, marginBottom: 16 }}>
            What is GEO? Generative Engine Optimization Explained (2026)
          </h1>

          {/* Byline */}
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9CA3AF", marginBottom: 28, flexWrap: "wrap" }}>
            <span>By Tauheed</span>
            <span>·</span>
            <span>Last updated: May 2026</span>
            <span>·</span>
            <span>12 min read</span>
          </div>

          {/* Summary box */}
          <div style={{ background: "#EEF2FF", borderLeft: "4px solid #4F46E5", borderRadius: 8, padding: 20, marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Quick answer</div>
            <p style={{ fontSize: 15, color: "#1E1B4B", lineHeight: 1.75, margin: 0 }}>
              GEO (Generative Engine Optimization) is the practice of optimizing your brand so AI systems like ChatGPT, Gemini and Perplexity recommend it when users ask questions in your category. Unlike SEO which targets Google rankings, GEO targets AI citations. Brands with strong GEO appear in the one answer AI gives - brands without it are invisible even if they rank #1 on Google.
            </p>
          </div>

          {/* Key stats */}
          <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "14px 20px", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Key stats</div>
            <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              <li style={{ fontSize: 14, color: "#374151" }}>Adding statistics to content improves AI visibility by 33.9%, expert quotes by 32% (Princeton/IIT Delhi, KDD 2024)</li>
              <li style={{ fontSize: 14, color: "#374151" }}>74% of AI citations come from structured lists and comparison formats</li>
              <li style={{ fontSize: 14, color: "#374151" }}>Google AI Overviews appear on over 40% of all searches; ChatGPT has 200 million weekly active users as of 2026</li>
              <li style={{ fontSize: 14, color: "#374151" }}>Overlap between Google top-10 results and AI-cited sources dropped from 70% to below 20% in 2026</li>
            </ul>
          </div>

          <P>
            GEO, Generative Engine Optimization, is the practice of optimizing your brand and content to appear in AI-generated answers from systems like ChatGPT, Gemini, Perplexity, and Google AI Overviews. Just as SEO helped brands rank in Google's blue links through the 2000s and 2010s, GEO helps brands get recommended by AI systems that now answer millions of questions every day.
          </P>

          <P>
            The shift is fundamental. When someone asks ChatGPT "best project management tool for a 10-person startup in India," they are not clicking through ten blue links. They are reading one synthesized answer. If your brand is not in that answer, you are invisible to that query - regardless of your Google ranking. That is the core problem GEO solves.
          </P>

          <H2>Why GEO matters in 2026</H2>

          <P>
            Perplexity serves over 15 million daily queries. ChatGPT has more than 200 million weekly active users. Google's AI Overviews appear on over 40% of all searches. The critical insight: overlap between Google's top 10 organic results and the sources AI systems cite has collapsed from 70% to below 20% in 2026. Ranking on Google no longer guarantees AI visibility.
          </P>

          <P>
            Users trust AI recommendations differently from ad results or organic listings. When ChatGPT recommends a tool, it reads like advice from a knowledgeable colleague rather than a sponsored placement. This trust makes AI visibility more valuable per impression than almost any other channel - and yet most founders are not measuring it.
          </P>

          <P>
            For Indian founders specifically: Gemini is deeply integrated into Google's ecosystem and Android, which dominates Indian smartphones. A startup invisible on Gemini is invisible to hundreds of millions of users who are beginning to use AI search as their default way to find products and services.
          </P>

          <H2>GEO vs SEO vs AEO: what is the difference?</H2>

          <div style={{ overflowX: "auto", marginBottom: 32 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["", "SEO", "AEO", "GEO"].map((h, i) => (
                    <th key={i} style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: i === 3 ? "#4F46E5" : "#374151" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Target", "Google", "Voice search", "AI chatbots"],
                  ["Goal", "Rankings", "Featured snippets", "AI citations"],
                  ["Metric", "Rank position", "Snippet wins", "Mention rate"],
                  ["Tools", "Ahrefs, SEMrush", "AnswerThePublic", "GeoIQ"],
                  ["Time to results", "3-6 months", "2-4 months", "4-8 weeks"],
                  ["User intent", "Search and click", "Ask and listen", "Ask and trust"],
                ].map(([label, seo, aeo, geo], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ padding: "11px 16px", fontWeight: 600, color: "#374151" }}>{label}</td>
                    <td style={{ padding: "11px 16px", color: "#6b7280" }}>{seo}</td>
                    <td style={{ padding: "11px 16px", color: "#6b7280" }}>{aeo}</td>
                    <td style={{ padding: "11px 16px", color: "#4F46E5", fontWeight: 500 }}>{geo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H2>How AI systems decide what to cite</H2>

          <P>Every AI system uses slightly different weights, but three factors determine whether your brand gets cited:</P>

          <div style={{ marginBottom: 32 }}>
            {[
              {
                n: "1",
                title: "Training data - is your brand in sources AI was trained on?",
                body: "ChatGPT's knowledge comes from its training data: web crawls, books, and curated datasets collected before its cutoff date. If your brand appeared in authoritative sources - tech blogs, news articles, industry directories, ProductHunt - before that cutoff, it is in the model's memory. Brands that launched after the cutoff or were never covered externally are simply unknown to the model.",
              },
              {
                n: "2",
                title: "Web presence - can Perplexity find you on the live web?",
                body: "Perplexity and Google AI Overviews crawl the web in real time. For these systems, your current website structure, content quality, and page speed all matter. A well-structured, fast-loading page with clear headings, schema markup, and factual content is more likely to be retrieved and cited. Your robots.txt must explicitly allow AI crawlers (GPTBot, PerplexityBot, Claude-Web).",
              },
              {
                n: "3",
                title: "Authority signals - do high-DR sites mention your brand?",
                body: "All AI systems weight third-party mentions heavily. A G2 review, a TechCrunch mention, a ProductHunt launch that gained traction - these signals confirm your brand is real and relevant to a specific category. A brand mentioned by 20-30 independent authoritative sources consistently appears in AI answers before a brand with a better product but no external citations.",
              },
            ].map((item) => (
              <div key={item.n} style={{ display: "flex", gap: 16, padding: "18px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0, fontFamily: "'Syne', sans-serif" }}>
                  {item.n}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "#111827", marginBottom: 8, fontSize: 15 }}>{item.title}</div>
                  <P style={{ margin: 0 }}>{item.body}</P>
                </div>
              </div>
            ))}
          </div>

          <H2>The 3 pillars of GEO</H2>

          <P>Effective GEO strategy works across three layers. Each layer is necessary - gaps in any one pillar create a ceiling on your overall score.</P>

          <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
            {[
              {
                title: "Technical GEO",
                color: "#4F46E5",
                bg: "#EEF2FF",
                items: ["Allow AI crawlers in robots.txt (GPTBot, PerplexityBot, Claude-Web)", "Create llms.txt at your domain root", "Add Organization schema markup in JSON-LD", "Ensure fast page load - AI crawlers deprioritize slow sites", "Submit sitemap to search console for fresh indexing"],
              },
              {
                title: "Content GEO",
                color: "#059669",
                bg: "#ECFDF5",
                items: ["Factual density - specific numbers and claims per paragraph", "Quotable writing - sentences that work as standalone citations", "Answer-first format - direct answer in first 40-60 words", "Comprehensive FAQ sections covering all user questions", "Consistent brand description across all content"],
              },
              {
                title: "Authority GEO",
                color: "#D97706",
                bg: "#FFFBEB",
                items: ["Citations on high-DA review sites (G2, Capterra, Trustpilot)", "Crunchbase and AngelList profiles with full company details", "ProductHunt listing with launch-day traction", "Coverage in category-relevant publications", "India: YourStory, Inc42, Entrackr for Gemini signals"],
              },
            ].map((pillar) => (
              <div key={pillar.title} style={{ background: pillar.bg, borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: pillar.color, fontFamily: "'Syne', sans-serif", marginBottom: 12 }}>{pillar.title}</div>
                <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {pillar.items.map((item, i) => (
                    <li key={i} style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <H2>GEO ranking factors 2026</H2>

          <P>These eight factors have the highest impact on AI citation frequency, ranked by effect size from the Princeton/IIT Delhi GEO research (KDD 2024) and observed patterns across 500+ GeoIQ audits:</P>

          <div style={{ marginBottom: 32 }}>
            {[
              { n: 1, factor: "llms.txt file present", why: "Signals AI-crawler-friendliness and provides structured brand context that AI systems can parse directly. Brands with llms.txt see faster inclusion in Perplexity responses." },
              { n: 2, factor: "AI crawlers allowed in robots.txt", why: "Blocking GPTBot, PerplexityBot, or Claude-Web prevents training data inclusion and real-time retrieval. Missing or incorrect robots.txt rules are the most common technical GEO failure." },
              { n: 3, factor: "Organization schema markup", why: "JSON-LD Organization schema tells AI systems your brand name, description, URL, and social profiles in a machine-readable format. Gemini uses this directly to build knowledge graph entries." },
              { n: 4, factor: "Citations on high-DA sources", why: "Adding statistics to content improves AI visibility by 33.9% (Princeton, 2024). Each G2 review, TechCrunch mention, or ProductHunt listing is a citation vote AI systems count." },
              { n: 5, factor: "Factual, quotable content", why: "AI systems extract sentences and short paragraphs. Content with specific claims ('serves 15,000 founders across 40 countries') gets cited 3x more often than vague marketing language." },
              { n: 6, factor: "Entity consistency across the web", why: "Your brand name, description, and category should be identical across LinkedIn, Crunchbase, your website, and every directory. Inconsistency creates multiple weak entity signals instead of one strong one." },
              { n: 7, factor: "Conversational content format", why: "Content structured as questions and answers ('How does X work? X works by...') matches the query format AI systems receive. FAQ sections are the highest-density GEO content format." },
              { n: 8, factor: "Regular content updates", why: "Perplexity prioritizes fresh content. Pages last updated over 12 months ago score lower in real-time AI retrieval. Adding a 'Last updated' date and refreshing content quarterly maintains freshness signals." },
            ].map((item) => (
              <div key={item.n} style={{ display: "flex", gap: 16, padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#E0E7FF", fontFamily: "'Syne', sans-serif", flexShrink: 0, width: 28, textAlign: "right" }}>
                  {String(item.n).padStart(2, "0")}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "#111827", marginBottom: 5, fontSize: 15 }}>{item.factor}</div>
                  <P style={{ fontSize: 14, margin: 0 }}>{item.why}</P>
                </div>
              </div>
            ))}
          </div>

          <H2>Real brand GEO scores</H2>

          <P>These are real audit results from GeoIQ showing what actual GEO scores look like and the most common limiting factor at each score level:</P>

          <div style={{ overflowX: "auto", marginBottom: 32 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Brand", "GEO Score", "Main issue"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { brand: "Notion", score: "24/100", issue: "Low citation depth - mentioned but not recommended", scoreColor: "#D97706" },
                  { brand: "Lemlist", score: "0/100", issue: "Not in AI training data for India-market queries", scoreColor: "#DC2626" },
                  { brand: "Groww", score: "38/100", issue: "Weak entity signals - inconsistent brand descriptions", scoreColor: "#D97706" },
                  { brand: "MealCoreAI", score: "30/100", issue: "No Perplexity presence - robots.txt blocking crawlers", scoreColor: "#D97706" },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>{row.brand}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: row.scoreColor }}>{row.score}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{row.issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H2>The 3 pillars of GEO content strategy</H2>

          <H3>How AI systems process your content</H3>
          <P>
            AI systems do not read your website the way humans do. They parse it as a collection of facts, claims, and descriptions that can be extracted and recombined in response to future questions. The most effective GEO content is written specifically to be extracted: direct definitions, specific statistics, named sources, and complete sentences that stand alone without surrounding context.
          </P>

          <H3>What "quotable writing" actually means</H3>
          <P>
            A quotable sentence is one that makes complete sense without the paragraph before or after it. "GeoIQ monitors 5 AI systems daily and calculates a 0-100 visibility score per domain" is quotable. "Our platform provides comprehensive monitoring across the AI landscape" is not - it requires inference and context to mean anything. Write every key claim as a standalone, citable fact.
          </P>

          <H3>Why third-party sources matter more than your homepage</H3>
          <P>
            AI systems treat first-party content (your own website) as potentially biased. Third-party mentions on G2, TechCrunch, ProductHunt, and Crunchbase are treated as independent confirmation. Think of it as peer review: a claim about your brand is more credible when it comes from multiple independent sources than when it comes from your own About page. Building a citation profile across 20-30 independent sources is the highest-leverage GEO investment most early-stage founders can make.
          </P>

          <H2>GEO for Indian startups</H2>

          <P>
            Indian founders face a specific challenge: most AI training data is US-centric. A fintech startup from Bangalore may rank well in India on Google but be completely unknown to ChatGPT, which was trained primarily on English-language web content skewed toward American and European sources.
          </P>

          <P>
            Gemini is the most important AI to optimize for in India. Since Gemini is Google's model and deeply integrated with Android (which holds over 95% of India's smartphone market), Gemini will increasingly become the default AI interface for hundreds of millions of Indian users. Getting into Gemini's knowledge graph now - through Google Business Profile, Organization schema, and coverage in Google-indexed Indian publications - is a significant early advantage.
          </P>

          <P>
            Building citations on Indian platforms specifically improves Gemini visibility: YourStory articles, Inc42 features, Entrackr coverage, and StartupStories mentions all feed into Google's understanding of Indian startups and brands. These are not just PR wins - they are direct GEO signals with measurable impact on Gemini citation rates.
          </P>

          {/* CTA */}
          <div style={{ background: "#4F46E5", borderRadius: 16, padding: "36px 32px", textAlign: "center", marginBottom: 48, marginTop: 40 }}>
            <h3 style={{ color: "white", fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>
              Check your GEO score free
            </h3>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Enter your domain and see exactly where you stand in ChatGPT, Gemini, Perplexity, Claude, and Grok. No signup needed. Results in 60 seconds.
            </p>
            <Link href="/">
              <button style={{ background: "white", color: "#4F46E5", fontWeight: 700, fontSize: 15, padding: "12px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
                Check your GEO score free →
              </button>
            </Link>
          </div>

          {/* FAQ */}
          <H2>Frequently asked questions about GEO optimization</H2>

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
                Run a free AI visibility audit →
              </Link>
              <Link href="/how-to-rank-in-chatgpt" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>
                How to rank in ChatGPT →
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
