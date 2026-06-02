import { useEffect } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function Blog() {
  useEffect(() => {
    document.title = "Blog | GeoIQ";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "GEO insights, AI visibility tips, and founder stories from the GeoIQ team.");
  }, []);

  const posts = [
    {
      href: "/blog/indian-startups-chatgpt-scores",
      date: "May 25, 2026",
      title: "I Checked 10 Indian Startups on ChatGPT. The Scores Shocked Me.",
      excerpt: "We ran every major Indian startup through GeoIQ. The average score was 43/100. Zepto: 22. Unstop: 18. Here is what is causing the gap and how to fix it.",
      tag: "Data",
    },
    {
      href: "/blog/geo-vs-seo-2026",
      date: "May 25, 2026",
      title: "GEO vs SEO in 2026: Where Should You Focus?",
      excerpt: "AI search is eating traditional search. But should you abandon SEO for GEO? The honest answer - and what to prioritize based on your stage.",
      tag: "Strategy",
    },
    {
      href: "/blog/what-is-geo-score",
      date: "May 25, 2026",
      title: "What's a Good GEO Score? We Analyzed 500 Brands to Find Out.",
      excerpt: "The average GEO score across 500+ brands is 24/100. A score breakdown by category, company age, and what separates the top performers from the rest.",
      tag: "Data",
    },
    {
      href: "/blog/robots-txt-blocking-ai",
      date: "May 25, 2026",
      title: "Your robots.txt is Probably Blocking ChatGPT Right Now",
      excerpt: "30% of Indian startup sites accidentally block AI crawlers in robots.txt. Check yours in 30 seconds - and copy the exact fix if you need it.",
      tag: "Technical",
    },
    {
      href: "/blog/why-startup-not-showing-chatgpt",
      date: "May 2026",
      title: "Why Your Startup Doesn't Show Up in ChatGPT (And How to Fix It)",
      excerpt: "Most founders assume strong SEO means AI visibility. It does not. Here are the three root causes and five free fixes you can apply today.",
      tag: "Guide",
    },
  ];

  const tagColors: Record<string, { bg: string; color: string }> = {
    Data: { bg: "#EEF2FF", color: "#5B3FEA" },
    Strategy: { bg: "#ECFDF5", color: "#059669" },
    Technical: { bg: "#FEF2F2", color: "#DC2626" },
    Guide: { bg: "#FFFBEB", color: "#D97706" },
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F2F0EB" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 24px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#5B3FEA", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            BLOG
          </div>
          <h1 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 700, letterSpacing: "-0.03em", color: "#0A0A0A", marginBottom: 16 }}>
            GEO Insights
          </h1>
          <p style={{ fontSize: 18, color: "#6B7280", marginBottom: 48, lineHeight: 1.6 }}>
            Practical guides and real data on AI visibility for founders.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40 }}>
            {posts.map((post, i) => {
              const tc = tagColors[post.tag] ?? { bg: "#f3f4f6", color: "#6b7280" };
              return (
                <Link key={i} href={post.href} style={{ textDecoration: "none", display: "block" }}>
                  <div
                    style={{ borderRadius: 14, border: "1px solid #D4D0C8", padding: "24px 28px", background: "#F2F0EB", transition: "background 150ms, border-color 150ms" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#E8E4DC"; e.currentTarget.style.borderColor = "#A89EE8"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#F2F0EB"; e.currentTarget.style.borderColor = "#D4D0C8"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>{post.date}</span>
                      <span style={{ background: tc.bg, color: tc.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.04em" }}>{post.tag}</span>
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0A0A0A", marginBottom: 8, lineHeight: 1.35, fontFamily: "'Syne', sans-serif" }}>
                      {post.title}
                    </h2>
                    <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.6, margin: 0 }}>{post.excerpt}</p>
                    <div style={{ marginTop: 14, fontSize: 14, fontWeight: 600, color: "#5B3FEA" }}>Read article →</div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div style={{ background: "#E8E4DC", border: "1px solid #D4D0C8", borderRadius: 14, padding: 28, textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 16 }}>
              We write about GEO, AI visibility, and what is actually working for Indian founders. New posts every week.
            </p>
            <a href="mailto:hello@geoiqai.com" style={{ fontSize: 14, fontWeight: 600, color: "#5B3FEA", textDecoration: "none" }}>
              Suggest a topic →
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
