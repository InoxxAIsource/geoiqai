import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";

export default function HowToRankInChatGPT() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <article className="max-w-2xl mx-auto px-4 py-16">
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
            <Link href="/" style={{ color: "#6b7280", textDecoration: "none" }}>Home</Link>
            <span style={{ margin: "0 8px" }}>·</span>
            <span>How to rank in ChatGPT</span>
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 600, color: "#111827", lineHeight: 1.3, marginBottom: 16 }}>
            How to Appear in ChatGPT Results: A Complete Founder's Guide
          </h1>

          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 40 }}>
            By GEOscore Team · Updated May 2026 · 10 min read
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 24 }}>
            Getting your startup mentioned by ChatGPT is one of the highest-leverage distribution moves available to founders in 2026. When someone asks ChatGPT for a recommendation in your category, they get one synthesized answer — not a list of ten blue links. If your brand is in that answer, you have a direct line to an engaged, high-intent user. If you are not, you are effectively invisible to that query forever.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            This guide explains exactly how ChatGPT decides what to recommend, and what you can do — starting today — to get your brand into those answers.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            How ChatGPT retrieves information
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            ChatGPT is a large language model trained on a large corpus of text collected from the internet, books, and curated datasets. Unlike Google, it does not do a fresh search every time you ask it a question — it draws on the patterns and facts it learned during training, plus (in its browsing-enabled mode) real-time web results.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            This means two things for founders. First, if your brand was not represented in the training data, ChatGPT literally does not know you exist. Second, even if you appear in training data, you need to appear frequently enough and in authoritative enough contexts for the model to reliably recommend you when relevant.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            ChatGPT's browsing mode (available in GPT-4o and later) can retrieve real-time information, but it still prioritizes pages it considers authoritative. The same principles that make a page rank well for Google's crawler — domain authority, inbound links, clear structured content — also make a page more likely to be retrieved and cited by ChatGPT's browser.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            What signals ChatGPT trusts
          </h2>

          <div style={{ marginBottom: 40 }}>
            {[
              {
                signal: "Frequency of mention across independent sources",
                detail: "If 50 independent websites mention your brand in the context of your category, ChatGPT is much more likely to include you when that category comes up. Each independent mention is a vote from a different source that your brand belongs in the conversation.",
              },
              {
                signal: "Recency and freshness of coverage",
                detail: "More recent training data carries more weight, especially for a fast-moving category like AI tools or fintech. Coverage from 2024-2026 in relevant publications will be more impactful than old mentions from 2020, even from authoritative sources.",
              },
              {
                signal: "Context of mentions — are you recommended or just listed?",
                detail: "Being mentioned as a recommendation ('founders should check out X') is more powerful than being listed as an option. Reviews, case studies, and comparisons that position your brand favorably carry more signal than plain directory listings.",
              },
              {
                signal: "Consistency of brand description across sources",
                detail: "If different sources describe your product differently — one calls it a CRM, another calls it a sales tool — ChatGPT builds an uncertain picture. Consistent, precise descriptions compound across sources.",
              },
            ].map((item, i) => (
              <div key={i} style={{ padding: "16px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontWeight: 600, color: "#111827", marginBottom: 6, fontSize: 15 }}>
                  {item.signal}
                </div>
                <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, margin: 0 }}>{item.detail}</p>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            Step-by-step optimization guide
          </h2>

          <div style={{ marginBottom: 40 }}>
            {[
              {
                title: "Claim your brand on authoritative sites",
                body: "G2, Capterra, Trustpilot, ProductHunt, Crunchbase, AngelList, and BuiltWith. These platforms are heavily indexed by OpenAI's training crawls and by ChatGPT's browsing mode. A complete, accurate profile on each of these takes 2-3 hours and pays dividends for years. For Indian startups: also claim profiles on YourStory, Inc42's startup database, and Tracxn.",
              },
              {
                title: "Write a clear, factual About page",
                body: "Your About page should contain a precise one-paragraph description of what your product does, who it serves, and what makes it different — in plain language. Avoid jargon and marketing superlatives. Write the paragraph you would want ChatGPT to read aloud if someone asked 'what is [your brand]?' Include specific numbers: users, countries, use cases.",
              },
              {
                title: "Get covered in publications ChatGPT cites",
                body: "ChatGPT's training data is heavily weighted toward Tech publications: TechCrunch, The Verge, Wired, Hacker News discussions, Substack newsletters from credible authors, and Reddit's startup-focused communities. A genuine mention in any of these, even a small one, carries significant signal. For Indian coverage targeting Gemini: YourStory, Inc42, Economic Times Tech.",
              },
              {
                title: "Build consistent NAP signals",
                body: "NAP stands for Name, Address, Phone — a concept borrowed from local SEO. For AI visibility, extend this to: your brand name (exact spelling, capitalization), your tagline (one consistent version), your category label (pick one and use it everywhere), and your founding year. AI systems build their understanding of your brand by aggregating mentions across the web.",
              },
              {
                title: "Create content that answers questions in your niche",
                body: "ChatGPT is trained on content that answers questions well. Publish long-form, structured guides that address the questions your customers actually ask. Use headings that mirror natural questions. Include specific, factual answers. This type of content serves two purposes: it ranks in Google, which brings traffic, and it trains future ChatGPT versions to associate your brand with authoritative answers in your niche.",
              },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EEEDFE", color: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flexShrink: 0, marginTop: 2 }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "#111827", marginBottom: 6, fontSize: 15 }}>
                    {item.title}
                  </div>
                  <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, margin: 0 }}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            How to track your ChatGPT visibility
          </h2>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            Tracking ChatGPT visibility manually is tedious — you have to open ChatGPT, ask a dozen different prompts, and note whether your brand appeared. That takes 30 minutes per audit, gives you no historical trend data, and cannot be done consistently.
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, marginBottom: 40 }}>
            GEOscore automates this. It runs multiple prompts across ChatGPT, Gemini, and Perplexity every day, calculates a 0-100 visibility score per system, and sends you a weekly digest with score changes. When your ChatGPT score drops — because a competitor got new coverage or a model update changed the weights — you get an alert so you can act fast.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
            Common mistakes founders make
          </h2>

          <div style={{ marginBottom: 48 }}>
            {[
              {
                mistake: "Publishing only on your own website",
                fix: "Your own website carries almost no weight as a third-party citation. AI systems discount self-published content. Every dollar of effort on your own site should be matched by effort getting mentioned on other sites.",
              },
              {
                mistake: "Using different names for the same product",
                fix: "If your product is called 'AcmeAI' in your navigation but 'Acme.ai' in your social bio and 'Acme AI Tool' in press releases, ChatGPT sees three different entities. Standardize and never deviate.",
              },
              {
                mistake: "Waiting until you have a big press hit",
                fix: "Small, consistent mentions across many sources outperform one big TechCrunch article. Start building citations from 10 niche directories and review sites — that creates a web of references ChatGPT can triangulate.",
              },
              {
                mistake: "Not tracking changes over time",
                fix: "ChatGPT's responses change as models update. A brand that was visible last quarter may not be visible this quarter. Without ongoing monitoring, you have no idea whether your efforts are working.",
              },
            ].map((item, i) => (
              <div key={i} style={{ padding: "16px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9999 }}>Mistake</span>
                  <div style={{ fontWeight: 600, color: "#111827", fontSize: 15 }}>{item.mistake}</div>
                </div>
                <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, margin: 0 }}>
                  <strong>Fix:</strong> {item.fix}
                </p>
              </div>
            ))}
          </div>

          <div style={{ background: "#534AB7", borderRadius: 16, padding: 32, textAlign: "center", marginBottom: 48 }}>
            <h3 style={{ color: "white", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Check if ChatGPT knows your brand
            </h3>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, marginBottom: 20 }}>
              Free audit. No signup. Results in 60 seconds.
            </p>
            <Link href="/">
              <Button style={{ background: "white", color: "#534AB7", fontWeight: 600 }}>
                Check my score →
              </Button>
            </Link>
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/what-is-geo" style={{ fontSize: 14, color: "#534AB7", textDecoration: "none" }}>
              ← What is GEO?
            </Link>
            <Link href="/geo-tools" style={{ fontSize: 14, color: "#534AB7", textDecoration: "none" }}>
              Best GEO tools 2026 →
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
