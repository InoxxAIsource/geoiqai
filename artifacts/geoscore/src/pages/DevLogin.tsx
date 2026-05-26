import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { setToken, setPlan } from "@/lib/auth";

export default function DevLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/test-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json() as { token?: string; user?: { plan: string; email: string }; error?: string };
      if (!res.ok || !data.token) {
        toast({ title: data.error ?? "Wrong password", variant: "destructive" });
        return;
      }
      setToken(data.token);
      setPlan(data.user?.plan ?? "agency");
      setLocation("/dashboard");
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
      <div style={{ width: "100%", maxWidth: 380, background: "white", borderRadius: 14, border: "1px solid #e5e7eb", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", padding: "40px 36px" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.06em", marginBottom: 8 }}>DEVELOPER ACCESS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Test account login</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Logs in as <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>test@geoiqai.com</code> with agency plan. Works on both dev and production.</div>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#111827", outline: "none", marginBottom: 14 }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "11px 0", background: "#111827", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Signing in..." : "Enter dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
