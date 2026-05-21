import { useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const SECTIONS = [
  {
    title: "Information We Collect",
    body: "We collect information you provide directly, including domain names you audit, email addresses for reports, and payment information for paid plans. We also collect usage data such as audit history, score trends, and feature interactions to improve our product.",
  },
  {
    title: "How We Use Your Information",
    body: "We use your information to run AI visibility audits, deliver weekly score reports, process payments, and send product updates. We do not sell your data to third parties. Audit data is used solely to compute your GEO IQ score and provide actionable recommendations.",
  },
  {
    title: "AI Queries",
    body: "To compute your GEO IQ score, we send queries to ChatGPT (OpenAI), Gemini (Google), and Perplexity. These queries include your domain name and category. We do not send personally identifiable information to these services. Audit results are cached for 24 hours to reduce API calls.",
  },
  {
    title: "Data Retention",
    body: "Audit results are retained for as long as your account is active. You may request deletion of your data at any time by emailing hello@geoiqai.com. We will process deletion requests within 30 days.",
  },
  {
    title: "Cookies",
    body: "We use session cookies to maintain your login state. We do not use tracking or advertising cookies. We use a minimal analytics solution to understand aggregate product usage.",
  },
  {
    title: "Security",
    body: "All data is transmitted over HTTPS. Passwords are hashed using bcrypt. Payment data is processed by Razorpay and never stored on our servers. We follow industry-standard security practices.",
  },
  {
    title: "Contact",
    body: "For any privacy-related questions, contact us at hello@geoiqai.com. We are based in India and comply with applicable data protection laws.",
  },
];

export default function Privacy() {
  useEffect(() => {
    document.title = "Privacy Policy | GeoIQ";
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px" }}>
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
            LEGAL
          </div>
          <h1
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#111827",
              marginBottom: 8,
            }}
          >
            Privacy Policy
          </h1>
          <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 48 }}>
            Last updated: May 2026
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.7, marginBottom: 40 }}>
            GeoIQ ("we", "our", "us") is committed to protecting your privacy. This policy
            explains what data we collect, how we use it, and your rights.
          </p>

          {SECTIONS.map((section) => (
            <div key={section.title} style={{ marginBottom: 36 }}>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#111827",
                  marginBottom: 10,
                  letterSpacing: "-0.01em",
                }}
              >
                {section.title}
              </h2>
              <p style={{ fontSize: 15, color: "#4B5563", lineHeight: 1.7, margin: 0 }}>
                {section.body}
              </p>
            </div>
          ))}

          <div
            style={{
              marginTop: 48,
              padding: 24,
              background: "#F9FAFB",
              borderRadius: 12,
              border: "1px solid #F3F4F6",
            }}
          >
            <p style={{ fontSize: 14, color: "#6B7280", margin: 0 }}>
              Questions? Email us at{" "}
              <a href="mailto:hello@geoiqai.com" style={{ color: "#4F46E5", textDecoration: "none" }}>
                hello@geoiqai.com
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
