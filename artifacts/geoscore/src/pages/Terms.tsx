import { useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const SECTIONS = [
  {
    title: "Acceptance of Terms",
    body: "By using GeoIQ (geoiqai.com), you agree to these Terms of Service. If you do not agree, please do not use our product. We may update these terms at any time; continued use constitutes acceptance of changes.",
  },
  {
    title: "Service Description",
    body: "GeoIQ is an AI visibility auditing platform that queries ChatGPT, Gemini, and Perplexity to calculate how well a brand is represented in AI-generated search results. Scores are indicative and based on live queries at the time of the audit.",
  },
  {
    title: "Free Audits",
    body: "Free audits are available to any visitor without registration. Each domain is cached for 24 hours. We reserve the right to rate-limit free audits to prevent abuse. Free audit results do not include full recommendations.",
  },
  {
    title: "Paid Plans",
    body: "Paid plans (Starter and Agency) are billed monthly. You may cancel at any time. Refunds are not provided for partial months. Payments are processed by Razorpay. By subscribing, you authorize recurring charges to your payment method.",
  },
  {
    title: "Acceptable Use",
    body: "You may not use GeoIQ to audit domains you do not own or have permission to audit. You may not attempt to reverse-engineer, scrape, or abuse our API. We reserve the right to suspend accounts that violate these terms without notice.",
  },
  {
    title: "Accuracy Disclaimer",
    body: "GEO IQ scores are computed from live AI queries and represent a snapshot in time. AI models update frequently, which may affect scores without notice. We make no guarantees about score accuracy or the outcome of any GEO optimization effort.",
  },
  {
    title: "Limitation of Liability",
    body: "GeoIQ is provided 'as is'. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability to you shall not exceed the amount you paid in the 30 days preceding any claim.",
  },
  {
    title: "Governing Law",
    body: "These terms are governed by the laws of India. Any disputes shall be resolved in the courts of Hyderabad, Telangana, India.",
  },
];

export default function Terms() {
  useEffect(() => {
    document.title = "Terms of Service | GeoIQ";
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
            Terms of Service
          </h1>
          <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 48 }}>
            Last updated: May 2026
          </p>

          <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.7, marginBottom: 40 }}>
            Please read these terms carefully before using GeoIQ. They govern your use of
            our AI visibility auditing platform.
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
