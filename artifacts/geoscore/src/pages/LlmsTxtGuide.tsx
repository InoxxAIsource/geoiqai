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
  { q: "What is llms.txt?", a: "llms.txt is a plain text file placed at yourdomain.com/llms.txt that describes your brand to AI systems. It tells AI crawlers what your product does, who it serves, where to find key pages, and how to contact you. Think of it as a business card specifically formatted for AI engines." },
  { q: "Is llms.txt required?", a: "No, llms.txt is not a required standard like robots.txt. It is an emerging convention that AI-forward brands use to provide better context to AI crawlers and models. Adopting it now puts you ahead of most competitors, who have not heard of it yet." },
  { q: "Does llms.txt improve ChatGPT visibility?", a: "Directly, the evidence is mixed because ChatGPT draws primarily from training data rather than live crawling. Indirectly, yes - having llms.txt signals AI-crawler-friendliness, provides clean structured context for Perplexity and other real-time crawlers, and may influence future training crawls. It takes 15 minutes to create and has no downside." },
  { q: "How long should llms.txt be?", a: "Aim for 300-800 words. Long enough to give meaningful context about your brand, product, team, and key pages. Short enough to be parseable in a single read. Extremely short files (under 100 words) provide little useful context. Very long files (over 2,000 words) risk being partially ignored." },
  { q: "Who created the llms.txt standard?", a: "The llms.txt convention was proposed by Jeremy Howard (fast.ai founder) in 2024 as an informal standard to help AI systems understand websites better. It has since been adopted by a growing number of AI-forward companies. It is not an official W3C or IETF standard but has significant community momentum." },
  { q: "Where do I put llms.txt on my website?", a: "Place llms.txt at your domain root, accessible at yourdomain.com/llms.txt. It must be served as plain text (content-type: text/plain). Do not place it in a subdirectory. If you use a CDN or static host, make sure the file is not blocked or redirected." },
  { q: "What is the difference between llms.txt and robots.txt?", a: "robots.txt tells crawlers what NOT to access - it is a restriction file. llms.txt tells AI systems what your brand IS - it is a context file. They serve opposite purposes. You need both: robots.txt to allow AI crawlers access, and llms.txt to give them context about your brand once they arrive." },
  { q: "Do I need llms.txt if I already have a sitemap?", a: "Yes. A sitemap tells crawlers which pages exist. llms.txt tells AI systems what your brand does, who it serves, and why it matters. They serve different purposes and both are useful. Include a link to your sitemap inside your llms.txt for maximum context." },
  { q: "Can llms.txt hurt my website?", a: "No. llms.txt is a purely additive file. It does not affect page performance, SEO, or user experience. If an AI crawler ignores it, there is no penalty. The only risk is providing inaccurate information in the file, which could cause AI systems to misunderstand your brand - so keep it factual and up to date." },
  { q: "Should I include my pricing in llms.txt?", a: "Yes, if you have public pricing. Include your pricing tiers with plan names and price points. AI systems often answer questions like 'how much does X cost?' and having accurate pricing in your llms.txt helps ensure the answer is correct." },
  { q: "How often should I update llms.txt?", a: "Update llms.txt whenever your brand has a significant change: new product, pivot, new pricing, major funding round, or change in target audience. At minimum, review it quarterly. AI systems that crawl your site may cache the file, so keeping it current ensures they have accurate context." },
  { q: "Does Google use llms.txt?", a: "Google's traditional search crawler (Googlebot) does not specifically use llms.txt. However, Google-Extended (the crawler for Gemini's training data) may benefit from the structured context. As Gemini becomes more important, ensuring your site is well-understood by Google's AI systems makes llms.txt increasingly valuable." },
  { q: "What encoding should llms.txt use?", a: "Use UTF-8 encoding. This supports all characters including non-Latin scripts, which matters for Indian, Japanese, and other multilingual brands. Avoid BOM (Byte Order Mark) at the start of the file, which can cause parsing issues." },
  { q: "Can I have llms.txt for subdomains?", a: "Yes. Each subdomain can have its own llms.txt file (e.g., app.yourdomain.com/llms.txt, docs.yourdomain.com/llms.txt). Your root domain llms.txt should reference the main product. Subdomains serving different products or audiences should have their own context files." },
  { q: "How do I test if my llms.txt is working?", a: "Visit yourdomain.com/llms.txt in your browser. It should display as plain text with no HTML wrapper. Use GeoIQ's free audit tool to check if AI systems are correctly understanding your brand context - a successful llms.txt contributes to a higher technical GEO score." },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "llms.txt: What It Is and How to Create It (2026 Guide)",
  "author": { "@type": "Person", "name": "Tauheed" },
  "publisher": { "@type": "Organization", "name": "GeoIQ", "logo": { "@type": "ImageObject", "url": "https://geoiqai.com/favicon.svg" } },
  "datePublished": "2026-04-01",
  "dateModified": "2026-05-25",
  "description": "llms.txt is a file that tells AI systems about your brand. Learn how to create it in 15 minutes. Free generator included.",
  "url": "https://geoiqai.com/llms-txt-guide",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://geoiqai.com/llms-txt-guide" },
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Create llms.txt",
  "description": "Create a llms.txt file for your website to improve AI visibility.",
  "totalTime": "PT15M",
  "step": [
    { "@type": "HowToStep", "position": 1, "name": "Create the file", "text": "Open any text editor and create a new file named llms.txt with no extension." },
    { "@type": "HowToStep", "position": 2, "name": "Add the basic structure", "text": "Add your brand name as a heading, a one-sentence description, About section, Key Pages, Social Profiles, and Contact information." },
    { "@type": "HowToStep", "position": 3, "name": "Upload to domain root", "text": "Upload llms.txt to your server root so it is accessible at yourdomain.com/llms.txt." },
    { "@type": "HowToStep", "position": 4, "name": "Test it", "text": "Visit yourdomain.com/llms.txt in your browser. It should display as plain text. Run a GeoIQ audit to confirm it is being detected." },
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

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://geoiqai.com" },
    { "@type": "ListItem", "position": 2, "name": "llms.txt Guide", "item": "https://geoiqai.com/llms-txt-guide" },
  ],
};

const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2 id={id} style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.25, marginBottom: 16, marginTop: 40 }}>
    {children}
  </h2>
);

const P = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16, ...style }}>{children}</p>
);

const Code = ({ children }: { children: string }) => (
  <pre style={{ background: "#111827", color: "#e5e7eb", borderRadius: 8, padding: "20px 24px", fontSize: 13, lineHeight: 1.7, overflowX: "auto", marginBottom: 24, whiteSpace: "pre", fontFamily: "'Courier New', Courier, monospace" }}>
    {children}
  </pre>
);

export default function LlmsTxtGuide() {
  useEffect(() => {
    document.title = "llms.txt: What It Is and How to Create It (2026 Guide) | GeoIQ";
    setMeta("description", "llms.txt is a file that tells AI systems about your brand. Learn how to create it in 15 minutes. Free generator included.");
    setMeta("og:title", "llms.txt: What It Is and How to Create It (2026 Guide) | GeoIQ", true);
    setMeta("og:description", "llms.txt is a file that tells AI systems about your brand. Learn how to create it in 15 minutes. Free generator included.", true);
    setMeta("og:url", "https://geoiqai.com/llms-txt-guide", true);
    setMeta("og:type", "article", true);
    setMeta("og:image", "https://geoiqai.com/og-llms-txt.png", true);
    setLink("canonical", "https://geoiqai.com/llms-txt-guide");
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "white" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

        <article style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>

          {/* Breadcrumb */}
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
            <Link href="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <span>llms.txt Guide</span>
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.2, marginBottom: 16 }}>
            llms.txt: The Complete Guide for AI Visibility (2026)
          </h1>

          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9CA3AF", marginBottom: 28, flexWrap: "wrap" }}>
            <span>By Tauheed</span>
            <span>·</span>
            <span>Last updated: May 2026</span>
            <span>·</span>
            <span>8 min read</span>
          </div>

          {/* Summary box */}
          <div style={{ background: "#EEF2FF", borderLeft: "4px solid #4F46E5", borderRadius: 8, padding: 20, marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Quick answer</div>
            <p style={{ fontSize: 15, color: "#1E1B4B", lineHeight: 1.75, margin: 0 }}>
              llms.txt is a plain text file placed at yourdomain.com/llms.txt that tells AI systems what your brand does, who it serves, and where to find more information. Think of it as a business card for AI crawlers. It takes 15 minutes to create and has no downside - only upside for your AI visibility.
            </p>
          </div>

          {/* Key stats */}
          <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "14px 20px", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Key stats</div>
            <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              <li style={{ fontSize: 14, color: "#374151" }}>Proposed by Jeremy Howard (fast.ai) in 2024 - now adopted by hundreds of AI-forward companies</li>
              <li style={{ fontSize: 14, color: "#374151" }}>Less than 3% of websites currently have an llms.txt file, giving early adopters a significant advantage</li>
              <li style={{ fontSize: 14, color: "#374151" }}>GeoIQ technical audits show llms.txt presence correlates with faster AI crawler indexing and higher Perplexity citation rates</li>
            </ul>
          </div>

          <H2>What is llms.txt?</H2>

          <P>
            llms.txt is a plain text file placed at the root of your domain (yourdomain.com/llms.txt) that provides structured information about your brand to AI language models and crawlers. The concept was proposed by Jeremy Howard, founder of fast.ai, in September 2024 as an informal standard analogous to robots.txt but serving the opposite purpose.
          </P>

          <P>
            Where robots.txt restricts what crawlers can access, llms.txt is purely informational - it helps AI systems understand your brand, product, and content even before they crawl your individual pages. A well-written llms.txt file gives AI crawlers the context they need to accurately represent your brand in responses.
          </P>

          <P>
            The format uses Markdown-like syntax: a heading for your brand name, a blockquote for your one-sentence description, and sections for About, Key Pages, Social Profiles, Contact, and Sitemap. Any AI system that crawls or reads this file gets a structured, factual overview of your brand in a single document.
          </P>

          <H2>How AI systems use llms.txt</H2>

          <div style={{ marginBottom: 32 }}>
            {[
              {
                system: "Perplexity",
                color: "#4F46E5",
                usage: "Perplexity crawls the live web in real time. When it visits your domain, llms.txt gives it immediate brand context without needing to parse dozens of pages. Brands with llms.txt get more accurate entity recognition and are less likely to be confused with similarly-named companies.",
              },
              {
                system: "ChatGPT (GPT-4o browsing)",
                color: "#059669",
                usage: "When ChatGPT's browsing mode retrieves pages from your domain, it may also read llms.txt to build context. More importantly, if OpenAI crawls your site for future training data, llms.txt ensures the training snapshot includes a clean, authoritative description of your brand.",
              },
              {
                system: "Gemini / Google-Extended",
                color: "#D97706",
                usage: "Google's AI crawler (Google-Extended) indexes content for Gemini's training and knowledge graph. llms.txt provides structured brand signals that contribute to entity recognition - the process by which Gemini determines what your brand is and what category it belongs to.",
              },
              {
                system: "Claude / Anthropic",
                color: "#7C3AED",
                usage: "Anthropic's web crawler reads llms.txt as part of its content collection for Claude's training and retrieval. The file's structured format makes it easier for Claude to accurately describe your brand when users ask about it.",
              },
            ].map((item) => (
              <div key={item.system} style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 6, borderRadius: 3, background: item.color, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, color: "#111827", fontSize: 15, marginBottom: 6 }}>{item.system}</div>
                  <P style={{ margin: 0, fontSize: 15 }}>{item.usage}</P>
                </div>
              </div>
            ))}
          </div>

          <H2>llms.txt vs robots.txt</H2>

          <div style={{ overflowX: "auto", marginBottom: 32 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["", "robots.txt", "llms.txt"].map((h, i) => (
                    <th key={i} style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: i === 2 ? "#4F46E5" : "#374151" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Purpose", "Restrict crawler access", "Provide brand context to AI"],
                  ["Format", "Key: value directives", "Markdown-like plain text"],
                  ["Who reads it", "All web crawlers", "AI crawlers and LLMs"],
                  ["Effect", "Blocks or allows paths", "Informs AI about your brand"],
                  ["Required", "No, but expected", "No, but increasingly useful"],
                  ["Created by", "Martijn Koster, 1994", "Jeremy Howard, 2024"],
                ].map(([label, robots, llms], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ padding: "11px 16px", fontWeight: 600, color: "#374151" }}>{label}</td>
                    <td style={{ padding: "11px 16px", color: "#6b7280" }}>{robots}</td>
                    <td style={{ padding: "11px 16px", color: "#4F46E5", fontWeight: 500 }}>{llms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H2 id="how-to-create">How to create your llms.txt (step by step)</H2>

          <P>Creating llms.txt takes about 15 minutes. Follow these four steps:</P>

          {/* Steps */}
          <div style={{ marginBottom: 32 }}>
            {[
              {
                n: "01", title: "Create the file", time: "2 minutes",
                body: "Open any text editor (Notepad, TextEdit, VS Code). Create a new file and name it exactly llms.txt with no extension. Make sure your system is not hiding extensions and accidentally saving it as llms.txt.txt.",
              },
              {
                n: "02", title: "Add the basic structure", time: "10 minutes",
                body: "Copy the template below and fill in your brand's details. Every section is optional but the more you include, the more context AI systems have.",
              },
              {
                n: "03", title: "Upload to your domain root", time: "2 minutes",
                body: "Upload llms.txt to your web server's root directory so it is accessible at yourdomain.com/llms.txt. In most hosting setups, this is the public_html or www folder. Ensure it is served with content-type: text/plain.",
              },
              {
                n: "04", title: "Test it", time: "1 minute",
                body: "Open yourdomain.com/llms.txt in your browser. You should see plain text with no HTML tags or styling. If you see a rendered page instead of raw text, your server is not serving the file correctly. Run a GeoIQ free audit to confirm AI systems are detecting it.",
              },
            ].map((step) => (
              <div key={step.n} style={{ padding: "20px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 10 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#E0E7FF", fontFamily: "'Syne', sans-serif", flexShrink: 0, lineHeight: 1 }}>{step.n}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: "#111827", fontSize: 16, fontFamily: "'Syne', sans-serif" }}>{step.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Time: {step.time}</div>
                  </div>
                </div>
                <P style={{ fontSize: 15, margin: 0 }}>{step.body}</P>
              </div>
            ))}
          </div>

          <H2>llms.txt format and template</H2>

          <P>Copy this template and replace the placeholder content with your brand's details:</P>

          <Code>{`# [Your Brand Name]

> [One clear sentence: what you do, for whom, and what makes you different.]

## About

[Paragraph 1: What your product does and the core problem it solves. Include 
your category name explicitly - e.g. "AI visibility platform", "B2B CRM", 
"health tracking app".]

[Paragraph 2: Who your customers are. Be specific - "SaaS founders in India 
with 1-50 employees" is better than "businesses".]

[Paragraph 3: Key numbers if you have them - users, countries, founding year, 
team size, funding.]

## Key Pages

- [Homepage](https://yourdomain.com): [One sentence about what visitors find here]
- [About](https://yourdomain.com/about): [Team, mission, founding story]
- [Pricing](https://yourdomain.com/pricing): [Plan names and starting prices]
- [Blog](https://yourdomain.com/blog): [Topics covered]
- [Documentation](https://docs.yourdomain.com): [What is documented]

## Products / Features

- [Feature 1]: [One sentence description]
- [Feature 2]: [One sentence description]
- [Feature 3]: [One sentence description]

## Social Profiles

- LinkedIn: https://linkedin.com/company/yourbrand
- Twitter/X: https://twitter.com/yourbrand
- GitHub: https://github.com/yourbrand
- Product Hunt: https://producthunt.com/products/yourbrand

## Press / Coverage

- [Publication name]: [URL to article or listing]
- [Crunchbase]: https://crunchbase.com/organization/yourbrand

## Contact

support@yourdomain.com

## Sitemap

https://yourdomain.com/sitemap.xml`}</Code>

          <H2>llms.txt examples by type</H2>

          <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 12, marginTop: 24 }}>SaaS tool example (GeoIQ)</div>
          <Code>{`# GeoIQ

> AI visibility platform that tracks how Indian startups appear in ChatGPT, 
> Gemini, and Perplexity - think of it as Google Search Console for AI search.

## About

GeoIQ is a Generative Engine Optimization (GEO) platform built for founders 
and startups, particularly in the Indian market. It tracks brand visibility 
across 6 major AI systems: ChatGPT, Gemini, Perplexity, Claude, Grok, and 
Google AI Overviews.

GeoIQ serves early-stage to growth-stage startups and SaaS companies that 
need to understand and improve how AI systems represent their brand. The free 
audit requires no signup and delivers results in 60 seconds.

Founded in 2025. Based in India. INR pricing available via Razorpay.

## Key Pages

- Homepage: https://geoiqai.com - Free AI visibility audit, no signup required
- Pricing: https://geoiqai.com/pricing - Free, Starter (Rs 3,999/mo), Agency (Rs 11,999/mo)
- What is GEO: https://geoiqai.com/what-is-geo - Guide to Generative Engine Optimization

## Products / Features

- Free AI audit: Score your brand across 6 AI systems in 60 seconds
- GEO Agent: AI assistant for live fix recommendations and content generation
- Daily monitoring: Automated daily checks with weekly email digest
- Competitor tracking: Compare your AI visibility against up to 5 competitors

## Social Profiles

- LinkedIn: https://linkedin.com/company/geoiq
- Twitter/X: https://twitter.com/geoiqai

## Contact

hello@geoiqai.com

## Sitemap

https://geoiqai.com/sitemap.xml`}</Code>

          <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 12, marginTop: 24 }}>Health app example (MealCoreAI)</div>
          <Code>{`# MealCoreAI

> AI-powered meal planning app for people managing diabetes and metabolic 
> health in India, with calorie tracking tailored to Indian cuisine.

## About

MealCoreAI is a health app that helps people with diabetes and metabolic 
conditions manage their diet using AI-powered meal planning. The app includes 
a comprehensive database of Indian foods, restaurant dishes, and regional 
cuisines not covered by US-centric calorie trackers.

MealCoreAI serves patients, caregivers, and health-conscious individuals in 
India who need culturally relevant nutrition guidance. The app works with 
diabetes educators and nutritionists as a monitoring tool.

Founded 2024. 15,000 users across India. Hindi and English supported.

## Key Pages

- Homepage: https://mealcoreai.com - Download the app, free for basic use
- About: https://mealcoreai.com/about - Team and health advisory board
- Blog: https://mealcoreai.com/blog - Indian nutrition, diabetes management

## Products / Features

- Indian food database: 50,000+ Indian dishes with nutritional data
- AI meal planner: Personalized plans based on health goals and cuisine preferences
- Blood sugar correlation: Connect glucose data with meal logs
- Dietitian connect: In-app consultations with certified Indian dietitians

## Social Profiles

- Instagram: https://instagram.com/mealcoreai
- LinkedIn: https://linkedin.com/company/mealcoreai

## Contact

support@mealcoreai.com

## Sitemap

https://mealcoreai.com/sitemap.xml`}</Code>

          <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 12, marginTop: 24 }}>E-commerce example</div>
          <Code>{`# Artisanal Collective

> Online marketplace connecting Indian artisans directly with buyers globally, 
> specializing in handmade textiles, pottery, and home decor.

## About

Artisanal Collective is an e-commerce platform that sources handmade products 
directly from artisan communities across Rajasthan, Gujarat, West Bengal, 
and Andhra Pradesh. All products are certified handmade and come with the 
artisan's story and location.

The platform serves buyers in 35 countries who want authentic Indian crafts 
with verified provenance. We work with over 800 artisan families and pay 
at least 60% of the retail price directly to makers.

Founded 2022. 12,000 products listed. $2.4M in artisan earnings to date.

## Key Pages

- Homepage: https://artisanalcollective.com - Shop by region, category, or artisan
- About: https://artisanalcollective.com/about - Our sourcing model and artisan partners
- Collections: https://artisanalcollective.com/collections - Textiles, pottery, jewelry, decor

## Products / Features

- Curated handmade: Every item individually reviewed before listing
- Artisan profiles: Full background on every maker
- International shipping: 35 countries with tracked delivery
- Gift wrapping: Traditional Indian wrapping with personalized card

## Social Profiles

- Instagram: https://instagram.com/artisanalcollective
- Pinterest: https://pinterest.com/artisanalcollective

## Contact

hello@artisanalcollective.com

## Sitemap

https://artisanalcollective.com/sitemap.xml`}</Code>

          <H2>Common llms.txt mistakes</H2>

          <div style={{ marginBottom: 32 }}>
            {[
              { n: 1, mistake: "Saving as HTML instead of plain text", fix: "Some text editors default to saving as .html or .rtf. Make sure your file is plain text with no formatting. Open it in a browser and check that you see raw text, not a styled page." },
              { n: 2, mistake: "Placing it in a subdirectory", fix: "llms.txt must be at yourdomain.com/llms.txt, not yourdomain.com/files/llms.txt. AI crawlers look for it at the domain root, the same convention as robots.txt and sitemap.xml." },
              { n: 3, mistake: "Blocking it with robots.txt", fix: "Make sure your robots.txt does not have a Disallow: /llms.txt rule. The file should be accessible to all crawlers including GPTBot, PerplexityBot, and Google-Extended." },
              { n: 4, mistake: "Writing too little context", fix: "A 50-word llms.txt is nearly useless. Aim for at least 300 words. Include your category name, target customer, key features, and founding year. The more factual context you provide, the better AI systems can represent your brand." },
              { n: 5, mistake: "Not updating it when your brand changes", fix: "llms.txt goes stale if your product pivots, you change your category positioning, or your pricing changes. Set a quarterly reminder to review and update it. Outdated llms.txt can cause AI systems to represent your brand incorrectly." },
            ].map((item) => (
              <div key={item.n} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#FEF2F2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{item.n}</div>
                <div>
                  <div style={{ fontWeight: 600, color: "#111827", fontSize: 15, marginBottom: 5 }}>{item.mistake}</div>
                  <P style={{ margin: 0, fontSize: 14 }}>{item.fix}</P>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ background: "#4F46E5", borderRadius: 16, padding: "36px 32px", textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ color: "white", fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", marginBottom: 8, marginTop: 0 }}>
              Check your llms.txt and full GEO score free
            </h2>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              GeoIQ checks if your llms.txt exists, if AI crawlers can access it, and scores your overall AI visibility across 6 systems. Free audit, no signup.
            </p>
            <Link href="/">
              <button style={{ background: "white", color: "#4F46E5", fontWeight: 700, fontSize: 15, padding: "12px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
                Check my llms.txt and GEO score →
              </button>
            </Link>
          </div>

          <H2>Frequently asked questions about llms.txt</H2>

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
              <Link href="/how-to-rank-in-chatgpt" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>How to rank in ChatGPT →</Link>
              <Link href="/pricing" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>GeoIQ paid plan →</Link>
            </div>
          </div>

        </article>
      </main>
      <Footer />
    </div>
  );
}
