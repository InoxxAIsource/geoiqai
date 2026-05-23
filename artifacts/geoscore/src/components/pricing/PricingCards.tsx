import { Check } from "lucide-react";
import { useLocation } from "wouter";

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  inrNote?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref?: string;
  isPopular?: boolean;
  isOutline?: boolean;
}

const plans: PricingPlan[] = [
  {
    id: "free",
    name: "Free Audit",
    price: "$0",
    period: "",
    description: "Check any brand right now, no card needed.",
    isOutline: true,
    features: [
      "GEO IQ score (0-100)",
      "AI engine breakdown (5 engines)",
      "Technical GEO audit",
      "Download llms.txt + Schema files",
      "2 audits per day",
      "5 audits/month with email",
    ],
    cta: "Check my GEO IQ",
  },
  {
    id: "starter",
    name: "Starter",
    price: "$49",
    period: "/month",
    inrNote: "Billed as ₹4,743/mo in INR",
    description: "For founders who want to stay ahead of AI search.",
    isPopular: true,
    features: [
      "Everything in Free",
      "Daily automated monitoring",
      "4-week fix roadmap with tasks",
      "Full recommendations with instructions",
      "Generated content (articles, pitches)",
      "Weekly digest email",
      "3 competitors tracked",
      "90 days of score history",
      "Unlimited audits",
    ],
    cta: "Start monitoring",
  },
  {
    id: "agency",
    name: "Agency",
    price: "$99",
    period: "/month",
    inrNote: "Billed as ₹9,583/mo in INR",
    description: "For agencies managing multiple brands.",
    isOutline: true,
    features: [
      "Everything in Starter",
      "10 brands monitored",
      "White label PDF reports",
      "10 competitors tracked",
      "Team seats (3 users)",
      "Priority support",
      "API access",
    ],
    cta: "Contact us",
    ctaHref: "mailto:hello@geoiqai.com",
  },
];

export function PricingCards({ onSelectPlan }: { onSelectPlan?: (planId: string) => void }) {
  const [, setLocation] = useLocation();

  const handleClick = (plan: PricingPlan) => {
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
    } else if (plan.ctaHref) {
      window.location.href = plan.ctaHref;
    } else {
      setLocation(`/pricing?plan=${plan.id}`);
    }
  };

  return (
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
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: plan.inrNote ? 4 : 8 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>{plan.price}</span>
              {plan.period && <span style={{ fontSize: 14, color: "#9ca3af" }}>{plan.period}</span>}
            </div>
            {plan.inrNote && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>{plan.inrNote}</div>
            )}
            <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5, margin: 0 }}>{plan.description}</p>
          </div>

          <ul style={{ flex: 1, listStyle: "none", margin: "0 0 24px", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {plan.features.map((feature, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#374151" }}>
                <Check style={{ width: 15, height: 15, color: "#4F46E5", flexShrink: 0, marginTop: 1 }} />
                {feature}
              </li>
            ))}
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
        </div>
      ))}
      <div style={{ gridColumn: "1 / -1", textAlign: "center", margin: "8px 0 0" }}>
        <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 6px" }}>
          All plans include the free audit. No card for the free tier. Cancel anytime on paid plans.
        </p>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, lineHeight: 1.6 }}>
          Prices in USD. Charged in INR at current exchange rate. Powered by Razorpay.
        </p>
      </div>
    </div>
  );
}
