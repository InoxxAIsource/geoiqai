import { Check, X } from "lucide-react";
import { useLocation } from "wouter";

type FeatureItem = string | { text: string; badge: string };

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  inrNote?: string;
  description: string;
  features: FeatureItem[];
  cta: string;
  ctaNote?: string;
  ctaHref?: string;
  isPopular?: boolean;
  isOutline?: boolean;
}

const plans: PricingPlan[] = [
  {
    id: "free",
    name: "Free Audit",
    price: "$0",
    period: "/month",
    description: "Check any brand right now, no card needed.",
    isOutline: true,
    features: [
      "Free AI visibility audit",
      "Checks 6 AI systems",
      "Technical GEO audit",
      "Download llms.txt + schema files",
      "5 audits per month",
      "No signup required for first audit",
    ],
    cta: "Check my GEO IQ →",
  },
  {
    id: "starter",
    name: "Starter",
    price: "$69",
    period: "/month",
    inrNote: "Billed as ₹6,679/mo via Razorpay",
    description: "For founders who want to stay ahead of AI search.",
    isPopular: true,
    features: [
      "Everything in Free",
      "Answer Monitoring - 50 prompts/month",
      "50 GEO Copilot messages/month",
      "Score history (builds over time)",
      "3 competitors tracked",
      "AI Crawler Audit (2 domains)",
      "PR Intelligence (50 journalist lookups/mo)",
      "Content Multiplier (repurpose to 9 platforms)",
      "GEO Writer (AI-optimized content)",
      "Citation Optimizer (page scoring)",
      "Brand Benchmarks vs 3 competitors",
    ],
    cta: "Start free - then $69/mo →",
    ctaNote: "7-day free trial · Cancel anytime",
  },
  {
    id: "agency",
    name: "Agency",
    price: "$129",
    period: "/month",
    inrNote: "Billed as ₹12,487/mo via Razorpay",
    description: "For agencies managing multiple brands.",
    isOutline: true,
    features: [
      "Everything in Starter",
      "3 domains for AI scanning",
      "200 GEO Copilot messages/month",
      "10 competitors tracked",
      "Google AI Overview tracking",
      "AI Crawler Audit (5 domains)",
      "PR Intelligence (200 journalist lookups/mo)",
      "Priority DataForSEO data refresh",
      { text: "White label PDF reports", badge: "Building now" },
      { text: "Team seats", badge: "Coming July 2026" },
      { text: "API access", badge: "Coming July 2026" },
    ],
    cta: "Contact us →",
    ctaHref: "mailto:hello@geoiqai.com",
  },
];

type CellValue = boolean | string;

interface CompareRow {
  label: string;
  free: CellValue;
  starter: CellValue;
  agency: CellValue;
}

const compareRows: CompareRow[] = [
  { label: "AI Presence score", free: true, starter: true, agency: true },
  { label: "AI systems checked", free: "6", starter: "6", agency: "6" },
  { label: "Technical GEO audit", free: true, starter: true, agency: true },
  { label: "GEO files download", free: true, starter: true, agency: true },
  { label: "AI Crawler Audit", free: "1 basic", starter: "2 domains", agency: "5 domains" },
  { label: "GEO Copilot", free: false, starter: "50 msg/mo", agency: "200 msg/mo" },
  { label: "Answer Monitoring", free: false, starter: "50 prompts", agency: "150 prompts" },
  { label: "AI Content Studio", free: false, starter: true, agency: true },
  { label: "Citation Optimizer", free: false, starter: true, agency: true },
  { label: "Brand Benchmarks", free: false, starter: "3 rivals", agency: "10 rivals" },
  { label: "PR Intelligence", free: false, starter: "50/mo", agency: "200/mo" },
  { label: "Signal Tracker", free: false, starter: true, agency: true },
  { label: "Score history", free: false, starter: true, agency: true },
  { label: "Brands monitored", free: "1 audit", starter: "1 domain", agency: "3 domains" },
  { label: "Google AI Overview", free: false, starter: true, agency: true },
  { label: "White label reports", free: false, starter: false, agency: "Soon" },
  { label: "Team seats", free: false, starter: false, agency: "Soon" },
  { label: "API access", free: false, starter: false, agency: "Soon" },
  { label: "Audits per month", free: "5", starter: "Unlimited", agency: "Unlimited" },
];

function CellDisplay({ value }: { value: CellValue }) {
  if (value === true) {
    return <Check style={{ width: 16, height: 16, color: "#059669", margin: "0 auto" }} />;
  }
  if (value === false) {
    return <X style={{ width: 14, height: 14, color: "#9CA3AF", margin: "0 auto" }} />;
  }
  return <span style={{ fontSize: 13, color: "#374151" }}>{value}</span>;
}

function ComingSoonBadge({ text }: { text: string }) {
  const isBuilding = text === "Building now";
  return (
    <span style={{
      background: isBuilding ? "#EEF2FF" : "#F3F4F6",
      color: isBuilding ? "#4F46E5" : "#6B7280",
      borderRadius: 4,
      padding: "2px 6px",
      fontSize: 10,
      fontWeight: 500,
      marginLeft: 6,
      whiteSpace: "nowrap" as const,
      flexShrink: 0,
    }}>
      {text}
    </span>
  );
}

export function PricingCards({ onSelectPlan }: { onSelectPlan?: (planId: string) => void }) {
  const [, setLocation] = useLocation();

  const handleClick = (plan: PricingPlan) => {
    if (plan.ctaHref) {
      window.location.href = plan.ctaHref;
      return;
    }
    if (onSelectPlan) {
      onSelectPlan(plan.id);
      return;
    }
    if (plan.id === "free") {
      const input = document.getElementById("hero-input") as HTMLInputElement | null;
      if (input) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => input.focus(), 500);
      } else {
        setLocation("/");
      }
    } else {
      setLocation(`/pricing?plan=${plan.id}`);
    }
  };

  return (
    <div>
      {/* GEO Agent callout */}
      <div style={{
        background: "#EEF2FF",
        border: "1px solid #C7D2FE",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 32,
        textAlign: "center",
        maxWidth: 1000,
        margin: "0 auto 32px",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#6366F1", marginBottom: 10 }}>Included in every paid plan</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#1E1B4B", marginBottom: 8 }}>
          GeoIQ Agent
        </div>
        <p style={{ fontSize: 14, color: "#4338CA", margin: 0, lineHeight: 1.6 }}>
          A Claude-powered AI strategist that knows your brand, scores, and competitors.
          Ask it anything, run live audits, generate content - all from a single conversation.
        </p>
      </div>

      {/* Pricing cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
        {plans.map((plan) => (
          <div
            key={plan.id}
            style={{
              position: "relative",
              background: "white",
              border: plan.isPopular ? "2px solid #4F46E5" : "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              boxShadow: plan.isPopular ? "0 4px 24px rgba(79,70,229,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {plan.isPopular && (
              <div style={{
                position: "absolute",
                top: -14,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#4F46E5",
                color: "white",
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 14px",
                borderRadius: 9999,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>
                Most popular
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: plan.inrNote ? 2 : 8 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>{plan.price}</span>
                {plan.period && <span style={{ fontSize: 14, color: "#9ca3af" }}>{plan.period}</span>}
              </div>
              {plan.inrNote && (
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>{plan.inrNote}</div>
              )}
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5, margin: 0 }}>{plan.description}</p>
            </div>

            <ul style={{ flex: 1, listStyle: "none", margin: "0 0 24px", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {plan.features.map((feature, i) => {
                const text = typeof feature === "string" ? feature : feature.text;
                const badge = typeof feature === "string" ? null : feature.badge;
                return (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#374151" }}>
                    <Check style={{ width: 15, height: 15, color: "#4F46E5", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: 2 }}>
                      {text}
                      {badge && <ComingSoonBadge text={badge} />}
                    </span>
                  </li>
                );
              })}
            </ul>

            <button
              onClick={() => handleClick(plan)}
              style={{
                width: "100%",
                padding: "11px 16px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                border: plan.isPopular ? "none" : "1.5px solid #4F46E5",
                background: plan.isPopular ? "#4F46E5" : "transparent",
                color: plan.isPopular ? "white" : "#4F46E5",
                transition: "opacity 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              {plan.cta}
            </button>
            {plan.ctaNote && (
              <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 8 }}>
                {plan.ctaNote}
              </div>
            )}
          </div>
        ))}
        <div style={{ gridColumn: "1 / -1", textAlign: "center", margin: "8px 0 0" }}>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 4px" }}>
            Comparable tools charge $797+/month for manual GEO services. GeoIQ automates everything for $69/month.
          </p>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 4px", lineHeight: 1.6 }}>
            Prices in USD. Charged in INR via Razorpay. Supports UPI, cards, Net Banking, and wallets.
          </p>
          <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, lineHeight: 1.6 }}>
            Team seats and API access coming July 2026. Agency subscribers get priority early access.
          </p>
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ maxWidth: 1000, margin: "56px auto 0" }}>
        <h3 style={{ fontSize: 22, fontWeight: 600, color: "#111827", textAlign: "center", marginBottom: 24 }}>
          Full feature comparison
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#6b7280", borderBottom: "2px solid #e5e7eb", background: "white" }}>
                  Feature
                </th>
                <th style={{ textAlign: "center", padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#6b7280", borderBottom: "2px solid #e5e7eb", background: "white", minWidth: 80 }}>
                  Free
                </th>
                <th style={{ textAlign: "center", padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#4F46E5", borderBottom: "2px solid #4F46E5", background: "#F5F3FF", minWidth: 100 }}>
                  Starter
                </th>
                <th style={{ textAlign: "center", padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#6b7280", borderBottom: "2px solid #e5e7eb", background: "white", minWidth: 80 }}>
                  Agency
                </th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row, i) => (
                <tr key={row.label} style={{ background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                  <td style={{ padding: "11px 16px", color: "#374151", fontWeight: 500 }}>{row.label}</td>
                  <td style={{ padding: "11px 16px", textAlign: "center" }}>
                    <CellDisplay value={row.free} />
                  </td>
                  <td style={{ padding: "11px 16px", textAlign: "center", background: i % 2 === 0 ? "#F5F3FF" : "#EDE9FE" }}>
                    <CellDisplay value={row.starter} />
                  </td>
                  <td style={{ padding: "11px 16px", textAlign: "center" }}>
                    <CellDisplay value={row.agency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
