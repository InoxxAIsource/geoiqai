import { useState } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type LoginMode = "password" | "magic";

export default function Login() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const { toast } = useToast();

  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);

  const verified = params.get("verified") === "true";
  const reset = params.get("reset") === "true";

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: "Enter your password", variant: "destructive" });
      return;
    }
    setLoading(true);
    setUnverifiedEmail(null);
    try {
      const res = await fetch("/api/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json() as { token?: string; error?: string; emailNotVerified?: boolean; email?: string };
      if (!res.ok) {
        if (data.emailNotVerified) {
          setUnverifiedEmail(data.email ?? email);
        } else {
          toast({ title: data.error ?? "Sign in failed", variant: "destructive" });
        }
        return;
      }
      if (data.token) {
        localStorage.setItem("geoscore_token", data.token);
        setLocation("/dashboard");
      }
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setMode("magic");
    setLoading(true);
    try {
      await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setMagicSent(true);
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    setResendingVerification(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      toast({ title: "Verification email sent", description: "Check your inbox." });
    } catch {
      toast({ title: "Could not resend", variant: "destructive" });
    } finally {
      setResendingVerification(false);
    }
  };

  if (magicSent) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
        <div style={{ width: "100%", maxWidth: 420, background: "white", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", padding: "48px 40px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, background: "#ede9fe", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#111827", marginBottom: 10 }}>Check your inbox</h1>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 24 }}>
            If a paid account exists for <strong style={{ color: "#374151" }}>{email}</strong>, we sent a login link. It expires in 15 minutes.
          </p>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            No account yet?{" "}
            <Link href="/pricing" style={{ color: "#4F46E5", fontWeight: 500 }}>See pricing</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      {/* Left - Form */}
      <div style={{ flex: "0 0 480px", minHeight: "100vh", background: "white", display: "flex", flexDirection: "column", padding: "40px 56px", overflowY: "auto" }}>
        {/* Logo */}
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 56 }}>
          <div style={{ width: 32, height: 32, background: "#4F46E5", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: "#111827" }}>GeoIQ</span>
        </Link>

        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, color: "#111827", marginBottom: 8 }}>Welcome back</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>
            Sign in to your dashboard and track your AI visibility.
          </p>

          {verified && (
            <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#065F46" }}>
              Email verified. You can now sign in.
            </div>
          )}
          {reset && (
            <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#065F46" }}>
              Password reset successfully. Sign in with your new password.
            </div>
          )}

          {/* Password form */}
          <form onSubmit={handlePasswordLogin} style={{ marginBottom: 0 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Email</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <Input
                  type="email"
                  placeholder="founder@startup.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: 36, borderColor: "#e5e7eb", fontSize: 14 }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: 36, paddingRight: 44, borderColor: "#e5e7eb", fontSize: 14 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <div style={{ textAlign: "right", marginBottom: 20 }}>
              <Link href="/forgot-password" style={{ fontSize: 13, color: "#4F46E5", fontWeight: 500, textDecoration: "none" }}>
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading && mode === "password"}
              style={{ width: "100%", padding: "11px 0", background: "#4F46E5", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading && mode === "password" ? "not-allowed" : "pointer", opacity: loading && mode === "password" ? 0.7 : 1, transition: "opacity 0.15s" }}
            >
              {loading && mode === "password" ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {unverifiedEmail && (
            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#92400E" }}>
              Please verify your email first.{" "}
              <button
                onClick={handleResendVerification}
                disabled={resendingVerification}
                style={{ color: "#4F46E5", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0, fontSize: 13, textDecoration: "underline" }}
              >
                {resendingVerification ? "Sending..." : "Resend verification"}
              </button>
            </div>
          )}

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>or use a magic link</span>
            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          </div>

          {/* Magic link form */}
          <form onSubmit={handleMagicLink}>
            <button
              type="submit"
              disabled={loading && mode === "magic"}
              style={{ width: "100%", padding: "11px 0", background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading && mode === "magic" ? "not-allowed" : "pointer", opacity: loading && mode === "magic" ? 0.7 : 1, transition: "all 0.15s" }}
            >
              {loading && mode === "magic" ? "Sending link..." : "Send magic link to my email"}
            </button>
            <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>One-click login, no password needed (paid plans)</p>
          </form>
        </div>

        {/* Footer link */}
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 40, textAlign: "center" }}>
          Don't have an account?{" "}
          <Link href="/signup" style={{ color: "#4F46E5", fontWeight: 600, textDecoration: "none" }}>Sign up free</Link>
        </p>
      </div>

      {/* Right - Hero panel */}
      <div style={{
        flex: 1,
        minHeight: "100vh",
        background: "linear-gradient(135deg, #312e81 0%, #1e1b4b 40%, #0F172A 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 64px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background glow */}
        <div style={{ position: "absolute", top: -120, right: -120, width: 500, height: 500, background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 400, height: 400, background: "radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "4px 12px", marginBottom: 32 }}>
            <div style={{ width: 6, height: 6, background: "#a5b4fc", borderRadius: "50%" }} />
            <span style={{ fontSize: 12, color: "#c7d2fe", fontWeight: 500, letterSpacing: "0.03em" }}>AI VISIBILITY PLATFORM</span>
          </div>

          <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 42, color: "white", lineHeight: 1.15, marginBottom: 48 }}>
            Know exactly where<br />
            <span style={{ color: "#a5b4fc" }}>AI recommends</span><br />
            your brand
          </h2>

          {/* Testimonial */}
          <div style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "24px 28px", maxWidth: 460 }}>
            <div style={{ color: "#818cf8", fontSize: 32, lineHeight: 1, marginBottom: 14, fontFamily: "Georgia, serif" }}>"</div>
            <p style={{ fontSize: 15, color: "#e0e7ff", lineHeight: 1.7, marginBottom: 20 }}>
              GeoIQ showed us we were invisible in Perplexity but ranking well in ChatGPT. We fixed it in a week. Our inbound from AI search went up by 40%.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "white" }}>
                A
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>Arjun Mehta</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Founder, Stackwise</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats at bottom */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", marginBottom: 20 }}>TRUSTED BY FOUNDERS AT</div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {["ChatGPT", "Gemini", "Perplexity", "Claude", "Grok"].map((ai) => (
              <div key={ai} style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{ai}</div>
            ))}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "20px 0" }} />
          <div style={{ display: "flex", gap: 40 }}>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, color: "white" }}>500+</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>brands tracked</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, color: "white" }}>5</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>AI platforms</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, color: "white" }}>60s</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>free audit</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
