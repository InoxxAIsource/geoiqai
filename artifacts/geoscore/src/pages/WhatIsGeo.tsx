import { useEffect } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";

export default function WhatIsGeo() {
  useEffect(() => { document.title = "What is GEO? Generative Engine Optimization Explained | GeoIQ"; }, []);
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <article className="max-w-2xl mx-auto px-4 py-16">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "What is Generative Engine Optimization (GEO)?",
                author: { "@type": "Organization", name: "GeoIQ" },
                datePublished: "2026-01-01",
                description:
                  "GEO is the practice of optimizing your brand to appear in AI-generated answers from ChatGPT, Gemini, and Perplexity.",
              }),
            }}
          />

          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
            <Link href="/" style={{ color: "#6b7280", textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <span>What is GEO</span>
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 600, color: "#111827", lineHeight: 1.3, marginBottom: 16 }}>
            What is Generative Engine Optimization (GEO)?
          </h1>

          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 40 }}>
            By GeoIQ Team · Updated May 2026 · 8 min read
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 24 }}>
            GEO, Generative Engine Optimization, is the practice of optimizing your brand and content to appear in AI-generated answers from systems like ChatGPT, Gemini, Perplexity, and Bing Copilot. Just as SEO helped brands rank in Google's blue links through the 2000s and 2010s, GEO helps brands get recommended by AI systems that now answer millions of questions every day.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            The shift is significant. When someone asks ChatGPT "best project management tool for a 10-person startup in India," they are not clicking through ten blue links. They are reading one answer. If your brand is not in that answer, you are invisible, even if you rank #1 on Google for the same query. That is the core problem GEO solves.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            Why GEO matters in 2026
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            The numbers are no longer small. Perplexity serves over 15 million daily queries. ChatGPT has more than 200 million weekly active users. Google's AI Overviews, the AI-generated summaries that appear above search results, now appear on over 40% of all searches, and that percentage is growing every month.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            More critically, users trust AI recommendations differently from ad results or even organic results. When ChatGPT recommends a tool, it feels like advice from a knowledgeable friend rather than a sponsored placement. This trust makes AI visibility more valuable per impression than almost any other channel.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            For Indian founders specifically, the urgency is compounded: Gemini is deeply integrated into Google's ecosystem and Android, which dominates Indian smartphones. A startup invisible on Gemini is invisible to a huge share of India's tech-savvy users who are beginning to use AI search daily.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            How is GEO different from SEO?
          </h2>

          <div style={{ overflowX: "auto", marginBottom: 40 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Aspect", "SEO", "GEO"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Goal", "Rank in Google blue links", "Get mentioned in AI answers"],
                  ["Primary signal", "Backlinks + keyword density", "Citations + topical authority"],
                  ["Tracking tool", "Google Search Console", "AI monitoring platforms"],
                  ["Update cycle", "Weeks to months", "Days to weeks"],
                  ["User intent", "Search and click", "Ask and trust"],
                  ["Result format", "10 blue links", "One synthesized answer"],
                ].map(([aspect, seo, geo], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 500, color: "#374151" }}>{aspect}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{seo}</td>
                    <td style={{ padding: "12px 16px", color: "#4F46E5", fontWeight: 500 }}>{geo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            How AI systems decide what to recommend
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            Each AI system uses different signals, but there are consistent patterns across all of them:
          </p>

          <div style={{ marginBottom: 40 }}>
            {[
              {
                title: "Training data coverage",
                body: "ChatGPT's knowledge comes from its training data, which includes web crawls, books, and curated datasets. If your brand appeared in authoritative sources before the training cutoff, tech blogs, news articles, industry directories, it is more likely to be in the model's memory.",
              },
              {
                title: "Third-party citations and mentions",
                body: "All AI systems weight third-party mentions heavily. A review on G2, a mention in TechCrunch, a ProductHunt launch that got traction, these signals tell AI systems your brand is real and relevant. First-party content (your own website) carries far less weight.",
              },
              {
                title: "Structured, factual content",
                body: "AI systems love content they can parse cleanly into facts. Precise claims like \"GeoIQ monitors 3 AI systems daily\" are easier for models to retain and cite than vague marketing language like \"the best AI visibility platform.\"",
              },
              {
                title: "Brand consistency across the web",
                body: "Your brand name, tagline, and core product description should be consistent across LinkedIn, Crunchbase, your website, and every directory listing. Inconsistency confuses AI systems trying to build a knowledge graph of your brand.",
              },
              {
                title: "Wikipedia and knowledge graph presence",
                body: "Gemini in particular relies on Google's knowledge graph. A Wikipedia page, a Google Business Profile, and structured data markup (JSON-LD) on your website all feed into this. Indian startups that have been covered in YourStory, Inc42, or Economic Times have a distinct advantage here.",
              },
            ].map((item, i) => (
              <div key={i} style={{ padding: "16px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontWeight: 600, color: "#111827", marginBottom: 6, fontSize: 15 }}>
                  {i + 1}. {item.title}
                </div>
                <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            5 steps to improve your GEO score
          </h2>

          <div style={{ marginBottom: 40 }}>
            {[
              {
                step: "Get a baseline score",
                desc: "Use GeoIQ's free tool to check your current AI visibility across ChatGPT, Gemini, and Perplexity. You cannot improve what you do not measure. The free audit takes 60 seconds and shows you exactly which systems know your brand and which do not.",
              },
              {
                step: "Build citations on authoritative sites",
                desc: "Submit your brand to G2, Capterra, ProductHunt, Crunchbase, and AngelList. For India-specific visibility on Gemini, get covered on YourStory, Inc42, or Entrackr. Each citation is a data point AI systems use to verify your brand exists and is relevant.",
              },
              {
                step: "Optimize your brand description",
                desc: "Write a precise, factual one-paragraph description of your product and publish it consistently everywhere. Include your category, primary use case, target market, and key differentiator. AI systems will use this exact language when referencing your brand.",
              },
              {
                step: "Create quotable, factual content",
                desc: "Publish original research, data reports, or surveys. Content that contains specific statistics gets cited more frequently by Perplexity (which uses real-time web search) and appears more in ChatGPT answers when the same questions come up in future training runs.",
              },
              {
                step: "Monitor and iterate weekly",
                desc: "GEO is not a one-time fix. AI models update their responses as new content enters their training data and search indexes. Use weekly monitoring to catch score drops early and understand which actions are moving the needle.",
              },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flexShrink: 0, marginTop: 2 }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "#111827", marginBottom: 6, fontSize: 15 }}>
                    {item.step}
                  </div>
                  <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, margin: 0 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ background: "#4F46E5", borderRadius: 16, padding: 32, textAlign: "center", marginBottom: 48 }}>
            <h3 style={{ color: "white", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Check your GEO score free in 60 seconds
            </h3>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, marginBottom: 20 }}>
              No signup needed. Enter your domain and see exactly where you stand in ChatGPT, Gemini, and Perplexity.
            </p>
            <Link href="/">
              <Button style={{ background: "white", color: "#4F46E5", fontWeight: 600 }}>
                Check my score →
              </Button>
            </Link>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            GEO for Indian startups
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            Indian founders face a specific challenge with AI visibility: most training data is US-centric. A fintech startup from Bangalore may have a strong Google ranking in India but be completely unknown to ChatGPT, which was trained primarily on English-language web content with a heavy American and European skew.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            Gemini is particularly important for India. Since Gemini is Google's model and Android dominates India's smartphone market, Gemini will increasingly become the default AI interface for hundreds of millions of Indian users. Getting into Gemini's knowledge graph now, through Google Business Profile, structured data markup, and coverage in Google-indexed Indian publications, is a significant early advantage.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            Building citations on Indian platforms matters specifically for Gemini: YourStory articles, Inc42 features, Entrackr coverage, and StartupStories mentions all feed into Google's understanding of Indian startups. These are not just PR wins, they are GEO signals.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            The good news: the Indian GEO landscape is early. Most Indian SaaS founders are not yet thinking about AI visibility, which means the opportunity to be the brand that AI systems recommend in your category is real and available right now, before your competitors wake up to it.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            Conclusion
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            GEO is not a replacement for SEO, it is an additional layer that becomes more important as AI search captures a larger share of information-seeking behavior. The brands that invest in GEO now will have a compounding advantage: early citations lead to more AI mentions, which lead to more brand searches, which lead to more backlinks, which improves both SEO and GEO simultaneously. Start with a free audit, understand your baseline, and begin building the citations that will put you in the AI answer.
          </p>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/how-to-rank-in-chatgpt" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>
              How to rank in ChatGPT →
            </Link>
            <Link href="/geo-tools" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>
              Best GEO tools 2026 →
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
