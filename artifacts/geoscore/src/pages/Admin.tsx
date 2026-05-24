import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, Users, Ban, CheckCircle, LogOut } from "lucide-react";

const ADMIN_EMAILS = ["inoxxprotocol@gmail.com"];

interface AdminUser {
  id: string;
  email: string;
  plan: string;
  subscriptionStatus: string | null;
  auditCount: number;
  agentMessagesUsed: number;
  emailVerified: boolean;
  blocked: boolean;
  createdAt: string;
  lastLogin: string | null;
  planStartedAt: string | null;
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    agency: { bg: "#EDE9FE", color: "#6D28D9" },
    starter: { bg: "#DBEAFE", color: "#1D4ED8" },
    free: { bg: "#F3F4F6", color: "#6B7280" },
  };
  const c = colors[plan] ?? colors.free;
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 600, borderRadius: 4, padding: "2px 7px", textTransform: "capitalize" as const }}>
      {plan}
    </span>
  );
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const token = localStorage.getItem("auth_token") || localStorage.getItem("geoscore_token");

  useEffect(() => {
    const loadMe = async () => {
      if (!token) { setLocation("/login"); return; }
      try {
        const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { setLocation("/login"); return; }
        const data = (await res.json()) as { email: string };
        setCurrentUserEmail(data.email);
        if (!ADMIN_EMAILS.includes(data.email)) {
          setLocation("/dashboard");
          return;
        }
      } catch {
        setLocation("/login");
      }
    };
    loadMe();
  }, [token, setLocation]);

  useEffect(() => {
    if (!currentUserEmail || !ADMIN_EMAILS.includes(currentUserEmail)) return;
    const loadUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Failed to load users");
        const data = (await res.json()) as { users: AdminUser[] };
        setUsers(data.users);
      } catch {
        setError("Failed to load users. Check your connection.");
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [currentUserEmail, token]);

  const toggleBlock = async (user: AdminUser) => {
    setActionLoading(user.id);
    const action = user.blocked ? "unblock" : "block";
    try {
      const res = await fetch(`/api/admin/users/${user.id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        alert(d.error ?? "Action failed");
        return;
      }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, blocked: !u.blocked } : u));
    } catch {
      alert("Network error. Try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const totalUsers = users.length;
  const paidUsers = users.filter(u => u.plan !== "free").length;
  const blockedUsers = users.filter(u => u.blocked).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "white", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em" }}>GeoIQ</span>
            <span style={{ fontSize: 11, background: "#4F46E5", color: "white", borderRadius: 4, padding: "2px 7px", fontWeight: 600 }}>ADMIN</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>{currentUserEmail}</span>
            <button
              onClick={() => setLocation("/dashboard")}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 12px", fontSize: 12, color: "#94A3B8", cursor: "pointer" }}
            >
              <LogOut size={13} /> Dashboard
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 32px" }}>
        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Shield size={20} color="#4F46E5" />
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>User Management</h1>
          </div>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>View and manage all registered users.</p>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Total users", value: totalUsers, icon: <Users size={16} color="#4F46E5" />, accent: "#4F46E5" },
            { label: "Paid users", value: paidUsers, icon: <CheckCircle size={16} color="#059669" />, accent: "#059669" },
            { label: "Blocked", value: blockedUsers, icon: <Ban size={16} color="#DC2626" />, accent: "#DC2626" },
          ].map(card => (
            <div key={card.label} style={{ background: "#1E293B", borderRadius: 10, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                {card.icon}
                <span style={{ fontSize: 12, color: "#64748B" }}>{card.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: card.accent }}>{loading ? "-" : card.value}</div>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div style={{ background: "#1E293B", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={15} color="#64748B" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0" }}>All users</span>
            {!loading && <span style={{ fontSize: 12, color: "#64748B", marginLeft: 4 }}>({totalUsers})</span>}
          </div>

          {loading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748B", fontSize: 13 }}>Loading users...</div>
          ) : error ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#DC2626", fontSize: 13 }}>{error}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Email", "Plan", "Subscription", "Signed up", "Last login", "Audits", "Status", "Action"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, i) => (
                    <tr
                      key={user.id}
                      style={{ borderBottom: i < users.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: user.blocked ? "rgba(220,38,38,0.04)" : "transparent" }}
                    >
                      <td style={{ padding: "12px 16px", color: "#E2E8F0", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {user.email}
                        {ADMIN_EMAILS.includes(user.email) && (
                          <span style={{ fontSize: 9, background: "#4F46E5", color: "white", borderRadius: 3, padding: "1px 5px", marginLeft: 6, fontWeight: 700 }}>YOU</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}><PlanBadge plan={user.plan} /></td>
                      <td style={{ padding: "12px 16px", color: "#94A3B8", whiteSpace: "nowrap" }}>{fmt(user.createdAt)}</td>
                      <td style={{ padding: "12px 16px", color: "#94A3B8", whiteSpace: "nowrap" }}>{fmt(user.lastLogin)}</td>
                      <td style={{ padding: "12px 16px", color: "#94A3B8", textAlign: "center" }}>{user.auditCount}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 11, color: user.subscriptionStatus === "active" ? "#059669" : "#94A3B8", fontWeight: 500, textTransform: "capitalize" as const }}>
                            {user.subscriptionStatus ?? "inactive"}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {user.blocked ? (
                          <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                            <Ban size={12} /> Blocked
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#059669", fontWeight: 500 }}>Active</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {ADMIN_EMAILS.includes(user.email) ? (
                          <span style={{ fontSize: 11, color: "#475569" }}>-</span>
                        ) : (
                          <button
                            onClick={() => toggleBlock(user)}
                            disabled={actionLoading === user.id}
                            style={{
                              background: user.blocked ? "#064E3B" : "#450A0A",
                              color: user.blocked ? "#10B981" : "#F87171",
                              border: `1px solid ${user.blocked ? "#065F46" : "#7F1D1D"}`,
                              borderRadius: 6,
                              padding: "5px 12px",
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: actionLoading === user.id ? "not-allowed" : "pointer",
                              opacity: actionLoading === user.id ? 0.6 : 1,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {actionLoading === user.id ? "..." : user.blocked ? "Unblock" : "Block"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
