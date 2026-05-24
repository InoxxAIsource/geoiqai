import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PricingCards } from "@/components/pricing/PricingCards";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@/hooks/use-query";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

export default function Pricing() {
  useEffect(() => { document.title = "Pricing | GeoIQ"; }, []);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryParams = useQuery();
  const requestedPlan = queryParams.get("plan");

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [pendingPlan, setPendingPlan] = useState<string | null>(requestedPlan ?? null);
  const [paymentDone, setPaymentDone] = useState(false);
  const [paidEmail, setPaidEmail] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (requestedPlan && requestedPlan !== "free") {
      setPendingPlan(requestedPlan);
      setTimeout(() => {
        document.getElementById("checkout-email-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
        emailInputRef.current?.focus();
      }, 300);
    }
  }, [requestedPlan]);

  const handleSelectPlan = (planId: string) => {
    if (planId === "free") {
      setLocation("/");
      return;
    }
    if (planId === "agency") {
      setPendingPlan("agency");
      setTimeout(() => {
        document.getElementById("checkout-email-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
        emailInputRef.current?.focus();
      }, 100);
      return;
    }
    setPendingPlan(planId);
    setTimeout(() => {
      document.getElementById("checkout-email-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      emailInputRef.current?.focus();
    }, 100);
  };

  const handleCheckout = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError("");
    setLoading(true);

    try {
      await loadRazorpayScript();

      const subRes = await fetch("/api/payment/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: pendingPlan, email: trimmedEmail }),
      });

      if (!subRes.ok) {
        const err = await subRes.json() as { error?: string };
        toast({ title: "Could not create subscription", description: err.error ?? "Try again in a moment.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const sub = await subRes.json() as {
        subscription_id: string;
        razorpay_key: string;
        plan_name: string;
      };

      const options: Record<string, unknown> = {
        key: sub.razorpay_key,
        subscription_id: sub.subscription_id,
        name: "GeoIQ",
        description: sub.plan_name,
        theme: { color: "#4F46E5" },
        prefill: { email: trimmedEmail },
        handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
                email: trimmedEmail,
                plan: pendingPlan,
              }),
            });
            if (verifyRes.ok) {
              const data = await verifyRes.json() as { magicUrl?: string };
              if (data.magicUrl) {
                window.location.href = data.magicUrl;
              } else {
                setPaidEmail(trimmedEmail);
                setPaymentDone(true);
              }
            } else {
              toast({ title: "Verification failed", description: "Contact hello@geoiqai.com if payment was deducted.", variant: "destructive" });
            }
          } catch {
            toast({ title: "Error verifying payment", description: "Contact hello@geoiqai.com if payment was deducted.", variant: "destructive" });
          }
          setLoading(false);
        },
        modal: { ondismiss: () => setLoading(false) },
      };

      new window.Razorpay(options).open();
    } catch {
      toast({ title: "Error", description: "Could not initiate payment. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  const handleResendLink = async () => {
    await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: paidEmail }),
    });
    toast({ title: "Login link sent", description: "Check your inbox." });
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-secondary">
      <Navbar />

      <main className="flex-1 py-20 px-4">
        {paymentDone ? (
          <div style={{ textAlign: "center", maxWidth: 480, margin: "0 auto", padding: "60px 24px" }}>
            <div style={{ width: 64, height: 64, background: "#ecfdf5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>You are in.</h2>
            <p style={{ color: "#374151", lineHeight: 1.7, marginBottom: 8 }}>
              We sent a login link to <strong>{paidEmail}</strong>. Click it to open your dashboard.
            </p>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 24 }}>
              Link expires in 24 hours. Check your spam folder if you do not see it.
            </p>
            <button
              onClick={() => { void handleResendLink(); }}
              style={{ background: "#4F46E5", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}
            >
              Resend login link
            </button>
            <br />
            <button
              onClick={() => setLocation("/")}
              style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 13, cursor: "pointer", marginTop: 8 }}
            >
              Back to homepage
            </button>
          </div>
        ) : (
          <>
            <div className="max-w-4xl mx-auto text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-semibold text-text-primary mb-6">
                Simple, honest pricing
              </h1>
              <p className="text-lg text-text-secondary">
                Start free. Upgrade when ready.
              </p>
            </div>

            <PricingCards onSelectPlan={handleSelectPlan} />

            {pendingPlan && pendingPlan !== "free" && (
              <div
                id="checkout-email-section"
                style={{ maxWidth: 440, margin: "40px auto 0", background: "white", border: "1.5px solid #4F46E5", borderRadius: 12, padding: "28px 24px", boxShadow: "0 4px 24px rgba(79,70,229,0.10)" }}
              >
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                  {pendingPlan === "starter" ? "Start GeoIQ Starter" : "Start GeoIQ Agency"}
                </h3>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.5 }}>
                  Enter your email - we will send your login link here after payment.
                </p>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#374151" }}>
                  Email address
                </label>
                <Input
                  ref={emailInputRef}
                  id="checkout-email"
                  type="email"
                  placeholder="founder@startup.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { void handleCheckout(); } }}
                  style={{ marginBottom: 8 }}
                />
                {emailError && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{emailError}</p>}
                <Button
                  onClick={() => { void handleCheckout(); }}
                  disabled={loading}
                  style={{ width: "100%", background: "#4F46E5", color: "white", height: 44 }}
                >
                  {loading ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                      Opening payment...
                    </span>
                  ) : (
                    `Pay ${pendingPlan === "starter" ? "Rs 3,999" : "Rs 11,999"}/mo`
                  )}
                </Button>
                <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 12 }}>
                  Monthly subscription, cancel anytime. Secured by Razorpay.<br />
                  Supports UPI, Net Banking, cards, and wallets.
                </p>
              </div>
            )}
          </>
        )}

        <div className="max-w-3xl mx-auto mt-24">
          <h3 className="text-2xl font-medium text-center mb-8">Frequently asked questions</h3>
          <div className="space-y-6">
            {[
              {
                q: "What is GEO?",
                a: "Generative Engine Optimization (GEO) is the process of making your brand visible in AI search engines like ChatGPT, Gemini, and Perplexity, so you get recommended when someone asks about your category.",
              },
              {
                q: "Is the free audit really free?",
                a: "Yes. Enter any domain and get your AI visibility score in about 60 seconds. No account, no card. You get 2 free audits per day from the same IP, or 5 per month when you add your email.",
              },
              {
                q: "How does daily monitoring work?",
                a: "Every day we run a full audit of your brand across ChatGPT, Gemini, Perplexity, Claude, and Grok. We track your score over time and send you a weekly digest with what changed and what to fix.",
              },
              {
                q: "How do I log in? There is no password.",
                a: "After subscribing, we send a login link to your email. Click it and you are in. No password to remember. If you need a new link, visit the Sign in page.",
              },
              {
                q: "What payment methods are accepted?",
                a: "We use Razorpay, which supports UPI, Net Banking, credit cards, debit cards, and wallets including Paytm and PhonePe.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel from your dashboard or email us at hello@geoiqai.com and we will handle it same day.",
              },
            ].map(({ q, a }, i) => (
              <div key={i} className="bg-card p-6 rounded-xl border border-border">
                <h4 className="font-medium text-text-primary mb-2">{q}</h4>
                <p className="text-text-secondary text-sm">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
