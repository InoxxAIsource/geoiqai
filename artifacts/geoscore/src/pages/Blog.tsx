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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 24px" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#4F46E5",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            BLOG
          </div>
          <h1
            style={{
              fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#111827",
              marginBottom: 16,
            }}
          >
            GEO Insights
          </h1>
          <p style={{ fontSize: 18, color: "#6B7280", marginBottom: 48, lineHeight: 1.6 }}>
            Practical guides and real data on AI visibility for founders.
          </p>

          <div
            style={{
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              overflow: "hidden",
              marginBottom: 24,
            }}
          >
            <Link
              href="/blog/why-startup-not-showing-chatgpt"
              style={{ textDecoration: "none", display: "block" }}
            >
              <div
                style={{
                  padding: 28,
                  background: "white",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              >
                <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10, fontWeight: 500 }}>
                  May 2026
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", marginBottom: 8, letterSpacing: "-0.01em" }}>
                  Why Your Startup Doesn't Show Up in ChatGPT (And How to Fix It)
                </h2>
                <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.6, margin: 0 }}>
                  Most founders assume that if they have a strong SEO presence, AI systems like ChatGPT will
                  recommend them. This is wrong. Here's why, and what you can do about it today.
                </p>
                <div style={{ marginTop: 16, fontSize: 14, fontWeight: 500, color: "#4F46E5" }}>
                  Read article →
                </div>
              </div>
            </Link>
          </div>

          <div
            style={{
              background: "#F9FAFB",
              border: "1px solid #F3F4F6",
              borderRadius: 16,
              padding: 28,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 16 }}>
              More articles coming soon. We write about GEO, AI visibility, and what's
              actually working for Indian founders.
            </p>
            <a
              href="mailto:hello@geoiqai.com"
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#4F46E5",
                textDecoration: "none",
              }}
            >
              Suggest a topic →
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
