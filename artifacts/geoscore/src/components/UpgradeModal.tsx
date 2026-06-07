import { X } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

interface UpgradeModalProps {
  onClose: () => void;
  feature: string;
  currentPlan: string;
  context?: "llm_mention" | "competitor" | "brand_performance" | "geo_optimizer" | "audit";
}

const CONTEXT_LIMITS: Record<string, { starter: string; agency: string }> = {
  llm_mention: { starter: "1 domain for AI Presence", agency: "3 domains for AI Presence" },
  competitor: { starter: "3 competitor slots", agency: "10 competitor slots" },
  brand_performance: { starter: "1 domain for Signal Tracker", agency: "3 domains for Signal Tracker" },
  geo_optimizer: { starter: "1 domain for GEO Optimizer", agency: "3 domains for GEO Optimizer" },
  audit: { starter: "2 domains for Site Audit", agency: "5 domains for Site Audit" },
};

export function UpgradeModal({
  onClose,
  feature,
  currentPlan,
  context = "llm_mention",
}: UpgradeModalProps) {
  const limits = CONTEXT_LIMITS[context] ?? CONTEXT_LIMITS.llm_mention!;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15,15,15,0.45)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 16,
          padding: "40px 44px 36px",
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: `linear-gradient(90deg, ${P}, #8B5CF6)`,
            borderRadius: "16px 16px 0 0",
          }}
        />
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#9CA3AF",
            display: "flex",
            padding: 4,
            borderRadius: 6,
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#FEF2F2",
              color: "#DC2626",
              borderRadius: 20,
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 16,
            }}
          >
            Plan Limit Reached
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#111827",
              margin: "0 0 10px",
              letterSpacing: "-0.02em",
            }}
          >
            Upgrade to unlock {feature}
          </h2>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, margin: 0 }}>
            Your {currentPlan === "free" ? "free" : currentPlan} plan does not include this
            feature. Upgrade to get access.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
          <div
            style={{
              background: "#F9FAFB",
              borderRadius: 10,
              padding: "14px 16px",
              border: `1px solid ${BORDER}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: P,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              Starter - Rs 3,999/mo
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                "1 monitored brand",
                limits.starter,
                "50 tracked prompts",
                "GEO Optimizer",
                "Content Studio",
              ].map(item => (
                <div
                  key={item}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}
                >
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: "50%",
                      background: "#EEF2FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 10,
                      color: P,
                      fontWeight: 900,
                    }}
                  >
                    +
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "#EEF2FF",
              borderRadius: 10,
              padding: "14px 16px",
              border: `1.5px solid ${P}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: P,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Agency - Rs 11,999/mo
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: P,
                  color: "white",
                  borderRadius: 10,
                  padding: "2px 8px",
                }}
              >
                Best value
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                limits.agency,
                "10 competitor slots",
                "150 tracked prompts",
                "Up to 5 monitored brands",
                "Priority support",
              ].map(item => (
                <div
                  key={item}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}
                >
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: "50%",
                      background: "#EEF2FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 10,
                      color: P,
                      fontWeight: 900,
                    }}
                  >
                    +
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <a
            href="/pricing"
            style={{
              flex: 1,
              padding: "12px 20px",
              background: P,
              color: "white",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              textAlign: "center",
              display: "block",
            }}
          >
            View Plans
          </a>
          <button
            onClick={onClose}
            style={{
              padding: "12px 20px",
              background: "white",
              color: MUTED,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
