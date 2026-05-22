import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { setToken, setPlan } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Link } from "wouter";

export default function MagicAuth() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "expired" | "used" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    fetch("/api/auth/verify-magic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.token && data.user) {
          setToken(data.token);
          setPlan(data.user.plan ?? "free");
          setStatus("success");
          setTimeout(() => setLocation("/dashboard"), 800);
        } else if (data.expired) {
          setStatus("expired");
        } else if (data.alreadyUsed) {
          setStatus("used");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "white" }}>
      <Navbar />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          {status === "loading" && (
            <>
              <div style={{ width: 48, height: 48, border: "3px solid #e5e7eb", borderTop: "3px solid #4F46E5", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 20px" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ color: "#6b7280", fontSize: 15 }}>Signing you in...</p>
            </>
          )}
          {status === "success" && (
            <>
              <div style={{ width: 56, height: 56, background: "#ecfdf5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Signed in</h2>
              <p style={{ color: "#6b7280" }}>Redirecting you to your dashboard...</p>
            </>
          )}
          {status === "expired" && (
            <>
              <div style={{ width: 56, height: 56, background: "#fef3c7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>This login link has expired</h2>
              <p style={{ color: "#6b7280", marginBottom: 24 }}>Login links are valid for 15 minutes. Request a new one.</p>
              <Link href="/login" style={{ display: "inline-block", background: "#4F46E5", color: "white", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
                Request a new link
              </Link>
            </>
          )}
          {status === "used" && (
            <>
              <div style={{ width: 56, height: 56, background: "#fef3c7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>This link has already been used</h2>
              <p style={{ color: "#6b7280", marginBottom: 24 }}>Each login link can only be used once. Request a new login link.</p>
              <Link href="/login" style={{ display: "inline-block", background: "#4F46E5", color: "white", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
                Request a new link
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <div style={{ width: 56, height: 56, background: "#fee2e2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
              <p style={{ color: "#6b7280", marginBottom: 24 }}>This link may be invalid or expired.</p>
              <Link href="/login" style={{ display: "inline-block", background: "#4F46E5", color: "white", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
                Try signing in again
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
