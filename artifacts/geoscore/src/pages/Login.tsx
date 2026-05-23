import { useState } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
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
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center bg-bg-secondary p-4">
          <div className="w-full max-w-md bg-card p-8 rounded-xl border border-border shadow-sm text-center">
            <div style={{ width: 56, height: 56, background: "#ecfdf5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-text-primary mb-3">Check your email</h1>
            <p className="text-text-secondary text-sm mb-6" style={{ lineHeight: 1.6 }}>
              If a paid account exists for <strong>{email}</strong>, we sent a login link. It expires in 15 minutes.
            </p>
            <p className="text-text-secondary text-sm">
              No account yet?{" "}
              <Link href="/pricing" className="text-primary hover:underline font-medium">See pricing</Link>
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center bg-bg-secondary p-4">
        <div className="w-full max-w-md bg-card p-8 rounded-xl border border-border shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-text-primary">Sign in to GeoIQ</h1>
            <p className="text-text-secondary text-sm mt-2">
              No account?{" "}
              <Link href="/signup" className="text-primary hover:underline font-medium">Create one free</Link>
            </p>
          </div>

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

          {/* Password sign in */}
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Email</label>
              <Input
                type="email"
                placeholder="founder@startup.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Password</label>
              <div style={{ position: "relative" }}>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 44 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading && mode === "password"} style={{ background: "#4F46E5", color: "white" }}>
              {loading && mode === "password" ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="text-center mt-2">
            <Link href="/forgot-password" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>
              Forgot password? Reset it
            </Link>
          </div>

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
            <span style={{ fontSize: 12, color: "#9ca3af" }}>or sign in with a magic link</span>
            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          </div>

          <form onSubmit={handleMagicLink} className="space-y-3">
            <Input
              type="email"
              placeholder="founder@startup.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading && mode === "magic"}
              style={{ width: "100%", padding: "10px 0", border: "1px solid #e5e7eb", borderRadius: 8, background: "white", fontSize: 14, color: "#374151", cursor: "pointer", fontWeight: 500 }}
            >
              {loading && mode === "magic" ? "Sending..." : "Send magic link"}
            </button>
          </form>
          <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 6 }}>We will email you a one-click login link (for paid plans)</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
