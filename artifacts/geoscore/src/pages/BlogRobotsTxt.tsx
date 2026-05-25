import { useEffect, useState } from "react";
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

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{ marginBottom: 24 }}>
      {label && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 600 }}>{label}</div>}
      <div style={{ position: "relative" }}>
        <pre style={{ background: "#111827", color: "#e5e7eb", borderRadius: 8, padding: "18px 20px", fontSize: 13, lineHeight: 1.7, overflowX: "auto", margin: 0, fontFamily: "'Courier New', Courier, monospace", whiteSpace: "pre" }}>
          {code}
        </pre>
        <button
          onClick={handleCopy}
          style={{ position: "absolute", top: 10, right: 10, background: copied ? "#059669" : "#374151", color: "white", border: "none", borderRadius: 5, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 200ms" }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

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
    <div style={{ color: "white", fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>Check your full AI audit free</div>
    <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 18, lineHeight: 1.6 }}>GeoIQ checks your robots.txt, llms.txt, Organization schema, and 6 AI systems. 60 seconds. No signup.</p>
    <Link href="/">
      <button style={{ background: "white", color: "#4F46E5", fontWeight: 700, fontSize: 14, padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
        Check my AI audit free →
      </button>
    </Link>
  </div>
);

const faqItems = [
  { q: "Does blocking GPTBot affect SEO?", a: "No. GPTBot is OpenAI's crawler, separate from Googlebot. Blocking GPTBot has no effect on your Google rankings. It only prevents OpenAI from crawling your site for ChatGPT training data and browsing mode." },
  { q: "Which AI crawlers should I allow in robots.txt?", a: "The main ones: GPTBot (OpenAI/ChatGPT), PerplexityBot (Perplexity), ClaudeBot (Anthropic/Claude), Google-Extended (Gemini training data), OAI-SearchBot (ChatGPT browsing). Also worth adding CCBot and ChatGPT-User for completeness." },
  { q: "My robots.txt does not mention AI crawlers - are they blocked?", a: "No. If a user-agent is not mentioned in robots.txt, it follows the rules for User-agent: * (the wildcard). If you have Disallow: / under User-agent: *, all crawlers including AI ones are blocked. If you have Allow: / under User-agent: *, all crawlers are allowed unless specifically restricted." },
  { q: "Should I block AI crawlers to protect my content?", a: "That is a valid choice but comes with a cost: you become invisible in AI recommendations. If your business benefits from being discovered via ChatGPT or Perplexity answers, blocking AI crawlers removes that channel entirely. If content protection is more important than AI discovery, blocking is reasonable." },
  { q: "How do I check if PerplexityBot can access my site?", a: "Visit yourdomain.com/robots.txt in your browser. Look for 'PerplexityBot' - if it is not listed, check the User-agent: * rules. If those have Disallow: /, PerplexityBot is blocked. Add User-agent: PerplexityBot followed by Allow: / to explicitly allow it." },
  { q: "Does fixing robots.txt immediately improve my AI visibility score?", a: "It opens the door but the effect takes time. Once AI crawlers can access your site, they still need to crawl it, index it, and either incorporate it into training data (slow) or surface it in live-search mode (faster, 1-4 weeks for Perplexity). Think of it as removing a blocker rather than an instant score booster." },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your robots.txt is Probably Blocking ChatGPT Right Now",
  "author": { "@type": "Person", "name": "Tauheed" },
  "publisher": { "@type": "Organization", "name": "GeoIQ", "logo": { "@type": "ImageObject", "url": "https://geoiqai.com/favicon.svg" } },
  "datePublished": "2026-05-25",
  "dateModified": "2026-05-25",
  "description": "Most websites accidentally block AI crawlers in robots.txt. Check yours in 30 seconds. Here is how to fix it.",
  "url": "https://geoiqai.com/blog/robots-txt-blocking-ai",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://geoiqai.com/blog/robots-txt-blocking-ai" },
};
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItems.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })),
};

const PAGE_URL = "https://geoiqai.com/blog/robots-txt-blocking-ai";
const PAGE_TITLE = "Your robots.txt is Probably Blocking ChatGPT Right Now";

export default function BlogRobotsTxt() {
  useEffect(() => {
    document.title = `${PAGE_TITLE} | GeoIQ Blog`;
    setMeta("description", "Most websites accidentally block AI crawlers in robots.txt. Check yours in 30 seconds. Here is how to fix it.");
    setMeta("og:title", `${PAGE_TITLE} | GeoIQ Blog`, true);
    setMeta("og:description", "Most websites accidentally block AI crawlers in robots.txt. Check yours in 30 seconds.", true);
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
            <span>robots.txt and AI crawlers</span>
          </div>

          <h1 style={{ fontSize: 34, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#111827", lineHeight: 1.2, marginBottom: 14 }}>
            Your robots.txt is Probably Blocking ChatGPT Right Now
          </h1>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#9CA3AF", marginBottom: 10, flexWrap: "wrap" }}>
            <span>By Tauheed</span>
            <span>·</span>
            <span>May 25, 2026</span>
            <span>·</span>
            <span>6 min read</span>
          </div>

          <ShareButtons url={PAGE_URL} title={PAGE_TITLE} />

          <div style={{ background: "#FEF2F2", borderLeft: "4px solid #DC2626", borderRadius: 8, padding: "16px 20px", marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Check right now</div>
            <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, margin: 0 }}>
              Open a new tab and go to <strong>yourdomain.com/robots.txt</strong>. If you see <code style={{ background: "#fee2e2", padding: "1px 5px", borderRadius: 3, fontSize: 13 }}>Disallow: /</code> under <code style={{ background: "#fee2e2", padding: "1px 5px", borderRadius: 3, fontSize: 13 }}>User-agent: *</code> and no specific Allow rules for AI crawlers, ChatGPT and Perplexity cannot read your site.
            </p>
          </div>

          <P>Here is a mistake that costs founders AI visibility every single day: they set up robots.txt years ago - possibly using a WordPress plugin default, a developer template, or a Shopify preset - and never thought about it again. That file is now silently blocking every AI crawler that visits their domain.</P>

          <P>In GeoIQ audits, we find robots.txt blocking issues in roughly 30% of the Indian startup sites we check. Some block AI crawlers intentionally (a valid choice). Most block them by accident - a legacy Disallow: / rule under User-agent: * that was meant to keep staging content out of Google, but now catches everything including GPTBot, PerplexityBot, and ClaudeBot.</P>

          <H2>What AI crawlers are and why they matter</H2>

          <P>Each major AI system has its own web crawler that reads your site to build knowledge of your brand:</P>

          <div style={{ marginBottom: 28 }}>
            {[
              { bot: "GPTBot", company: "OpenAI / ChatGPT", ua: "GPTBot", purpose: "Crawls for ChatGPT training data and knowledge updates. Blocking this means ChatGPT cannot learn about new content on your site." },
              { bot: "OAI-SearchBot", company: "OpenAI / ChatGPT browsing", ua: "OAI-SearchBot", purpose: "Used when ChatGPT's browsing mode searches the web in real time. Blocking this means ChatGPT cannot cite your pages in live responses." },
              { bot: "PerplexityBot", company: "Perplexity", ua: "PerplexityBot", purpose: "Perplexity crawls the live web in real time. This crawler is how Perplexity finds your content and cites your brand in answers." },
              { bot: "ClaudeBot", company: "Anthropic / Claude", ua: "ClaudeBot", purpose: "Claude's web crawler for training data and knowledge. Blocking this makes your site invisible to Claude's training pipeline." },
              { bot: "Google-Extended", company: "Google / Gemini", ua: "Google-Extended", purpose: "Google's crawler specifically for Gemini training data. Separate from Googlebot - blocking Googlebot does NOT block Google-Extended." },
            ].map((item) => (
              <div key={item.bot} style={{ padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "#111827", fontSize: 15 }}>{item.bot}</span>
                  <span style={{ background: "#f3f4f6", color: "#6b7280", fontSize: 11, padding: "2px 8px", borderRadius: 9999 }}>{item.company}</span>
                </div>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: 0 }}>{item.purpose}</p>
              </div>
            ))}
          </div>

          <CTA />

          <H2>How to check your robots.txt in 30 seconds</H2>

          <P>Go to yourdomain.com/robots.txt in your browser. You will see the raw text content. Here is what to look for:</P>

          <CodeBlock label="Problematic robots.txt - this blocks ALL crawlers including AI" code={`User-agent: *
Disallow: /

# AI crawlers cannot get past this
# Even if GPTBot is not mentioned, the Disallow: / above blocks it`} />

          <CodeBlock label="Also problematic - blocking specific AI crawlers" code={`User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Disallow: /`} />

          <CodeBlock label="Common false positive - looks fine but has a hidden problem" code={`User-agent: *
Disallow: /wp-admin/
Disallow: /staging/

# Looks fine... but if you have a Noindex directive on most pages,
# AI crawlers see the pages but cannot cite them`} />

          <H2>The fix: exact rules to add</H2>

          <P>Here is the minimal robots.txt that correctly handles all major AI crawlers. Copy this and adjust for your specific needs:</P>

          <CodeBlock label="Recommended robots.txt with AI crawler rules" code={`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /account/
Disallow: /checkout/

# Allow all major AI crawlers explicitly
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

# Sitemap location (required)
Sitemap: https://yourdomain.com/sitemap.xml`} />

          <P>Replace <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 3, fontSize: 13 }}>/admin/</code> and <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 3, fontSize: 13 }}>/account/</code> with whatever directories you legitimately want to keep private. Keep the AI crawler sections exactly as shown.</P>

          <H2>If you have a WordPress site</H2>

          <P>WordPress sometimes auto-generates robots.txt rules, especially if "Discourage search engines" is checked in Settings under Reading. Check that first. If you use a plugin like Yoast SEO or Rank Math, those tools manage robots.txt - find the robots.txt editor inside the plugin settings and add the AI crawler rules there.</P>

          <CodeBlock label="Yoast SEO / Rank Math: paste into their robots.txt editor" code={`# AI crawler allow rules - add to your existing robots.txt

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /`} />

          <H2>Case study: MealCoreAI</H2>

          <P>MealCoreAI is a health app for Indian users managing diabetes. When we ran a GeoIQ audit in May 2026, the AI audit flagged two issues: no llms.txt and no explicit AI crawler rules in robots.txt. The site was not actively blocking crawlers (no Disallow: /), but it also was not explicitly allowing them.</P>

          <P>After adding explicit Allow rules for all five major AI crawlers and creating a basic llms.txt, GeoIQ's Perplexity sub-score improved from 18 to 30 within three weeks. ChatGPT and Gemini scores remained near zero - they rely on training data, not live crawls, and that takes longer to update. But the live-web component improved immediately.</P>

          <P>The lesson: robots.txt fixes are the fastest-acting technical GEO change you can make. Perplexity responds within 2-4 weeks of new crawler access. ChatGPT training data cycles more slowly, but you cannot improve that score at all if you are blocking GPTBot.</P>

          <CTA />

          <H2>What to do after fixing robots.txt</H2>

          <P>Fixing robots.txt removes a blocker. It does not directly add citations or tell AI systems what your brand is. After the fix, do these two things to compound the benefit:</P>

          <P><strong>Create llms.txt.</strong> Place a plain text file at yourdomain.com/llms.txt that describes your brand to AI crawlers. When GPTBot and PerplexityBot visit your site and find a well-written llms.txt, they get structured brand context without needing to parse dozens of pages. See our <Link href="/llms-txt-guide" style={{ color: "#4F46E5" }}>llms.txt complete guide</Link> for the exact format.</P>

          <P><strong>Run a full GeoIQ audit.</strong> The audit checks your robots.txt, llms.txt, Organization schema, AI crawler accessibility, and your live scores across 6 AI systems. It tells you exactly what is working and what to fix next, ranked by impact.</P>

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
              <Link href="/llms-txt-guide" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>How to create llms.txt in 15 minutes →</Link>
              <Link href="/ai-visibility-score" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>What is an AI visibility score? →</Link>
              <Link href="/how-to-rank-in-chatgpt" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>Full guide: how to rank in ChatGPT →</Link>
              <Link href="/blog/what-is-geo-score" style={{ fontSize: 15, color: "#4F46E5", textDecoration: "none" }}>What is a good GEO score? →</Link>
            </div>
          </div>

        </article>
      </main>
      <Footer />
    </div>
  );
}
