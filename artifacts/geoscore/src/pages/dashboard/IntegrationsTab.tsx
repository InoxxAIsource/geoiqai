import { useState } from "react";

interface IntegrationDef {
  id: "gsc" | "bing";
  name: string;
  desc: string;
  icon: string;
  iconBg: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  { id: "gsc", name: "Google Search Console", desc: "Use real Google keywords for more accurate AI checks", icon: "G", iconBg: "#4285f4" },
  { id: "bing", name: "Bing Webmaster Tools", desc: "Track Copilot AI visibility with real search data", icon: "B", iconBg: "#0078d4" },
];

interface IntegrationsTabProps {
  userEmail: string | null;
  authToken: string | null;
}

export function IntegrationsTab({ userEmail, authToken }: IntegrationsTabProps) {
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});

  const handleNotify = async (id: "gsc" | "bing") => {
    if (!authToken) return;
    setLoading((prev) => ({ ...prev, [id]: true }));
    setError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch("/api/integrations/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ integration: id }),
      });
      if (!res.ok) throw new Error("Failed");
      setJoined((prev) => ({ ...prev, [id]: true }));
    } catch {
      setError((prev) => ({ ...prev, [id]: "Something went wrong. Try again." }));
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const integrationLabel: Record<string, string> = {
    gsc: "GSC",
    bing: "Bing Webmaster",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 3 }}>Connect data sources</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          Integrations help GeoIQ use your real search data for more accurate AI visibility tracking. Vote for which to build first.
        </div>

        {INTEGRATIONS.map((integration, i) => (
          <div
            key={integration.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 0",
              borderTop: i > 0 ? "0.5px solid #f3f4f6" : "none",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: integration.iconBg,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {integration.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{integration.name}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{integration.desc}</div>
              {joined[integration.id] && (
                <div style={{ fontSize: 12, color: "#059669", marginTop: 3, fontWeight: 500 }}>
                  We'll email {userEmail ?? "you"} when {integrationLabel[integration.id]} integration launches.
                </div>
              )}
              {error[integration.id] && (
                <div style={{ fontSize: 12, color: "#dc2626", marginTop: 3 }}>{error[integration.id]}</div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  background: "#f3f4f6",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: 9999,
                  padding: "2px 8px",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                }}
              >
                Coming soon
              </span>
              {!joined[integration.id] ? (
                <button
                  onClick={() => handleNotify(integration.id)}
                  disabled={loading[integration.id]}
                  style={{
                    background: loading[integration.id] ? "#e0e7ff" : "#eef2ff",
                    border: "0.5px solid #c7d2fe",
                    borderRadius: 6,
                    padding: "6px 13px",
                    fontSize: 12,
                    color: "#4F46E5",
                    fontWeight: 500,
                    cursor: loading[integration.id] ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {loading[integration.id] ? "Saving..." : "Get notified"}
                </button>
              ) : (
                <span
                  style={{
                    fontSize: 12,
                    color: "#059669",
                    background: "#ecfdf5",
                    border: "0.5px solid #6ee7b7",
                    borderRadius: 6,
                    padding: "6px 13px",
                    fontWeight: 500,
                  }}
                >
                  Notified
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
