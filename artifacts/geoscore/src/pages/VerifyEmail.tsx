import { useEffect, useState } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function VerifyEmail() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";

  const [status, setStatus] = useState<"verifying" | "success" | "error" | "expired">("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token found in the link.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data: { verified?: boolean; error?: string; expired?: boolean; alreadyUsed?: boolean }) => {
        if (data.verified) {
          setStatus("success");
          setTimeout(() => setLocation("/login?verified=true"), 2000);
        } else if (data.expired) {
          setStatus("expired");
        } else if (data.alreadyUsed) {
          setStatus("success");
          setTimeout(() => setLocation("/login?verified=true"), 1500);
        } else {
          setStatus("error");
          setErrorMsg(data.error ?? "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Could not verify. Please try again.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center bg-bg-secondary p-4">
        <div className="w-full max-w-md bg-card p-8 rounded-xl border border-border shadow-sm text-center">
          {status === "verifying" && (
            <>
              <div style={{ width: 48, height: 48, border: "3px solid #e5e7eb", borderTopColor: "#4F46E5", borderRadius: "50%", margin: "0 auto 20px", animation: "spin 0.8s linear infinite" }} />
              <p className="text-text-secondary text-sm">Verifying your email...</p>
            </>
          )}
          {status === "success" && (
            <>
              <div style={{ width: 56, height: 56, background: "#ECFDF5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-text-primary mb-2">Email verified</h1>
              <p className="text-text-secondary text-sm">Taking you to sign in...</p>
            </>
          )}
          {status === "expired" && (
            <>
              <h1 className="text-xl font-semibold text-text-primary mb-3">Link expired</h1>
              <p className="text-text-secondary text-sm mb-6">This verification link has expired. Sign in to request a new one.</p>
              <Link href="/login" style={{ fontSize: 13, color: "#4F46E5", textDecoration: "none", fontWeight: 500 }}>
                Back to sign in
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <h1 className="text-xl font-semibold text-text-primary mb-3">Verification failed</h1>
              <p className="text-text-secondary text-sm mb-6">{errorMsg}</p>
              <Link href="/signup" style={{ fontSize: 13, color: "#4F46E5", textDecoration: "none", fontWeight: 500 }}>
                Back to sign up
              </Link>
            </>
          )}
        </div>
      </main>
      <Footer />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
