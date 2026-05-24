import { useEffect } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";

export default function BlogChatGPT() {
  useEffect(() => { document.title = "Why Your Startup Doesn't Show Up in ChatGPT | GeoIQ Blog"; }, []);
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <article className="max-w-2xl mx-auto px-4 py-16">
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
            <Link href="/" style={{ color: "#6b7280", textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <Link href="/" style={{ color: "#6b7280", textDecoration: "none" }}>Blog</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <span>Why your startup doesn't show up in ChatGPT</span>
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 600, color: "#111827", lineHeight: 1.3, marginBottom: 16 }}>
            Why Your Startup Doesn't Show Up in ChatGPT (And How to Fix It)
          </h1>

          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 40 }}>
            By GeoIQ Team · May 2026 · 9 min read
          </p>

          {/* Opening hook */}
          <blockquote style={{ borderLeft: "3px solid #4F46E5", paddingLeft: 20, marginBottom: 32 }}>
            <p style={{ fontSize: 17, color: "#374151", lineHeight: 1.8, fontStyle: "italic", margin: 0 }}>
              "I asked ChatGPT 'best cricket arbitrage scanner for IPL.' My site came fourth. Fine, I could work with that. Then I asked about MealCoreAI, a product with 12,000 users and incredibly deep content about meal planning for Indian households. Gemini had never heard of it. Perplexity same. That was the moment I realized AI visibility is broken for indie founders, especially in India."
            </p>
          </blockquote>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            That conversation changed how I thought about distribution. We had been pouring energy into SEO, into content, into building a product people actually used, and AI search had no idea we existed. Not because our product was bad. Because we had not learned to speak the language AI systems use to discover brands.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            The discovery
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            I started running systematic tests. I would ask ChatGPT, Gemini, and Perplexity the same questions in different formats, "best tool for X," "recommend something for Y," "what do founders use for Z." Then I would note which brands came up, how consistently, and how they were described.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            The pattern was striking. The brands AI systems consistently recommended were not necessarily the best products. They were the brands with the most mentions across independent, authoritative sources. A SaaS tool with 500 users but 40 reviews on G2 and a ProductHunt top-of-the-day badge consistently beat tools with 50,000 users but no third-party citations.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            This was not SEO. SEO rewards the page. GEO rewards the brand. The optimization target is different, the signals are different, and, critically, the measurement is different.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            Why this happens
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            There are three root causes for why most indie startups are invisible in AI search, and each one has a specific fix.
          </p>

          <div style={{ marginBottom: 40 }}>
            {[
              {
                cause: "AI training data gaps",
                explanation: "ChatGPT and Gemini are trained on web data collected up to a certain cutoff date. If your startup launched recently, or if your early growth happened quietly without press coverage, you may simply not be in the training data. The model does not know you exist, not because you are unworthy of mention, but because you never made it into the data pipelines that trained the model.",
                fix: "The fix for training data gaps is a long-term play: get into as many indexed, authoritative web sources as possible before the next training cycle. But for Perplexity, which uses real-time search, the fix is immediate, any indexed page that mentions your brand is fair game today.",
              },
              {
                cause: "Citation scarcity for new brands",
                explanation: "AI systems do not just check if a brand exists, they check how many independent sources validate it. A brand with one mention (its own website) looks like an unverified claim. A brand with 30 independent mentions across review sites, news articles, and community discussions looks established. Most early-stage startups have only first-party content, their own website, their own social media, which AI systems discount heavily.",
                fix: "Third-party citations are the single highest-leverage thing you can do for GEO. G2, ProductHunt, Hacker News Show HN posts, relevant Subreddits, newsletter features, each of these is a citation that tells AI systems your brand is real and relevant.",
              },
              {
                cause: "Geographic blind spots",
                explanation: "This is particularly acute for Indian founders. The majority of AI training data is English-language content with a heavy US and European bias. An Indian fintech that is well-known in Mumbai startup circles might be completely absent from US-centric tech publications, which means it is effectively invisible to models trained on that data. Gemini has somewhat better India coverage due to Google's Indian market focus, but even Gemini's knowledge of India-specific startups is thin compared to its US knowledge.",
                fix: "Get covered on publications that are indexed globally but have India-specific content: YourStory, Inc42, The Ken, Economic Times Tech, and international outlets with India coverage like Rest of World and TechCrunch India pieces. These publications are in the training data and carry significant authority.",
              },
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 600, color: "#111827", margin: 0 }}>{item.cause}</h3>
                </div>
                <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.8, marginBottom: 12, paddingLeft: 36 }}>{item.explanation}</p>
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 16px", marginLeft: 36, borderLeft: "3px solid #4F46E5" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.05em" }}>Fix: </span>
                  <span style={{ fontSize: 14, color: "#374151" }}>{item.fix}</span>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            What you can do today (free)
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            Five immediate actions that cost nothing and take less than a week to complete:
          </p>

          <div style={{ marginBottom: 40 }}>
            {[
              {
                action: "Submit to G2 and Capterra",
                time: "2 hours",
                impact: "High",
                detail: "Create a complete brand profile with your logo, description, pricing, and category. Encourage your first 10 users to leave a review. These platforms are heavily crawled by AI training pipelines.",
              },
              {
                action: "Launch on ProductHunt",
                time: "1 day",
                impact: "High",
                detail: "A ProductHunt listing, even without a huge launch, gives you a permanent, indexed page that gets picked up by AI training data. Write a clear, factual description of what your product does.",
              },
              {
                action: "Post a Show HN on Hacker News",
                time: "30 minutes",
                impact: "High",
                detail: "Hacker News is one of the most-crawled, highest-authority sites on the internet. A genuine Show HN post with even modest engagement creates a citation that will appear in AI training data for years.",
              },
              {
                action: "Write your Wikipedia-style brand description",
                time: "1 hour",
                impact: "Medium",
                detail: "Write a 150-word, purely factual description of your brand in third-person, neutral language. Include: what it does, who founded it, when, where, and what makes it different. Use this exact text on Crunchbase, AngelList, and every directory listing.",
              },
              {
                action: "Add JSON-LD structured data to your homepage",
                time: "1 hour",
                impact: "Medium",
                detail: "Add Organization schema markup to your homepage with your brand name, URL, description, and founding date. This feeds directly into Google's knowledge graph, which Gemini uses to understand and recommend brands.",
              },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flexShrink: 0, marginTop: 2 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, color: "#111827", fontSize: 15 }}>{item.action}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ background: "#f3f4f6", color: "#6b7280", fontSize: 11, padding: "2px 8px", borderRadius: 9999 }}>
                        {item.time}
                      </span>
                      <span style={{ background: item.impact === "High" ? "#E1F5EE" : "#FAEEDA", color: item.impact === "High" ? "#085041" : "#633806", fontSize: 11, padding: "2px 8px", borderRadius: 9999, fontWeight: 600 }}>
                        {item.impact} impact
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: 0 }}>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            How to track it going forward
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            The five actions above will improve your AI visibility. But without measurement, you have no idea if they are working or how quickly. AI systems update their responses, a brand that was invisible last month might be visible today because of new coverage, or vice versa because of a model update that changed how the system weights information.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 24 }}>
            Use GeoIQ's free tool to check your baseline right now, it takes 60 seconds and requires no account. Then, if you want daily monitoring and weekly alerts, upgrade to a paid plan. The weekly digest tells you your score change, which AI systems you gained or lost visibility on, and what specific actions are likely to move the needle most for your brand.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            The brands winning at GEO in 2026 are the ones that started measuring first. Most of your competitors are not tracking this yet. That is your window.
          </p>

          <div style={{ background: "#4F46E5", borderRadius: 16, padding: 32, textAlign: "center", marginBottom: 48 }}>
            <h3 style={{ color: "white", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Check your brand right now, free
            </h3>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, marginBottom: 20 }}>
              No signup. No email needed. See where you stand in ChatGPT, Gemini, and Perplexity in 60 seconds.
            </p>
            <Link href="/">
              <Button style={{ background: "white", color: "#4F46E5", fontWeight: 600 }}>
                Check my score →
              </Button>
            </Link>
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/what-is-geo" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>
              What is GEO? →
            </Link>
            <Link href="/how-to-rank-in-chatgpt" style={{ fontSize: 14, color: "#4F46E5", textDecoration: "none" }}>
              Full ChatGPT ranking guide →
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
