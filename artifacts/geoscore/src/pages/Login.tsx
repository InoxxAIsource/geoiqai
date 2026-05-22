import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const search = useSearch();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      // Always show success to avoid leaking whether email exists
      setSent(true);
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center bg-bg-secondary p-4">
        <div className="w-full max-w-md bg-card p-8 rounded-xl border border-border shadow-sm">
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, background: "#ecfdf5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-text-primary mb-3">Check your email</h1>
              <p className="text-text-secondary text-sm mb-6" style={{ lineHeight: 1.6 }}>
                If a paid account exists for <strong>{email}</strong>, we sent you a login link. It expires in 15 minutes.
              </p>
              <p className="text-text-secondary text-sm">
                No account yet?{" "}
                <Link href="/pricing" className="text-primary hover:underline font-medium">
                  See pricing
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-semibold text-text-primary">Sign in to GeoIQ</h1>
                <p className="text-text-secondary text-sm mt-2">For paid subscribers - we will send you a login link</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending link..." : "Send login link"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-text-secondary">
                No paid account?{" "}
                <Link href="/pricing" className="text-primary hover:underline font-medium">
                  Start for $49/month
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
