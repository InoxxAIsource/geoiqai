import { useState, useEffect } from "react";
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

  // If a plan was requested in query params, scroll into the email input
  useEffect(() => {
    if (requestedPlan && requestedPlan !== "free") {
      setPendingPlan(requestedPlan);
      setTimeout(() => {
        document.getElementById("checkout-email")?.scrollIntoView({ behavior: "smooth", block: "center" });
        document.getElementById("checkout-email")?.focus();
      }, 300);
    }
  }, [requestedPlan]);

  const handleSelectPlan = async (planId: string) => {
    if (planId === "free") {
      const input = document.getElementById("hero-input") as HTMLInputElement | null;
      if (input) {
        setLocation("/");
        setTimeout(() => {
          document.getElementById("hero-input")?.scrollIntoView({ behavior: "smooth", block: "center" });
          (document.getElementById("hero-input") as HTMLInputElement)?.focus();
        }, 200);
      } else {
        setLocation("/");
      }
      return;
    }

    if (planId === "agency") {
      window.location.href = "mailto:hello@geoiqai.com?subject=GeoIQ Agency Inquiry";
      return;
    }

    setPendingPlan(planId);
    setTimeout(() => {
      document.getElementById("checkout-email")?.scrollIntoView({ behavior: "smooth", block: "center" });
      (document.getElementById("checkout-email") as HTMLInputElement)?.focus();
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
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: pendingPlan, email: trimmedEmail }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        toast({ title: "Could not create order", description: err.error ?? "Try again in a moment.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const order = await orderRes.json() as { orderId: string; amount: number; currency: string; keyId: string };
      await loadRazorpayScript();

      const options: Record<string, unknown> = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "GeoIQ",
        description: pendingPlan === "starter"
          ? "GeoIQ Starter - Daily AI Visibility Monitoring"
          : "GeoIQ Agency - 10 Brands AI Monitoring",
        theme: { color: "#4F46E5" },
        prefill: { email: trimmedEmail },
        notes: { email: trimmedEmail, plan: pendingPlan ?? "" },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                plan: pendingPlan,
                email: trimmedEmail,
              }),
            });

            if (verifyRes.ok) {
              setPaymentDone(true);
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
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>Payment confirmed</h2>
            <p style={{ color: "#6b7280", lineHeight: 1.7, marginBottom: 8 }}>
              We sent a login link to <strong>{email}</strong>. Click it to access your dashboard.
            </p>
            <p style={{ color: "#9ca3af", fontSize: 13 }}>
              Did not receive it? Check your spam folder, or{" "}
              <button onClick={() => setLocation("/login")} style={{ color: "#4F46E5", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                request a new login link
              </button>
              .
            </p>
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

            <PricingCards onSelectPlan={(plan) => { void handleSelectPlan(plan); }} />

            {pendingPlan && pendingPlan !== "free" && pendingPlan !== "agency" && (
              <div style={{ maxWidth: 440, margin: "40px auto 0", background: "white", border: "1.5px solid #4F46E5", borderRadius: 12, padding: "28px 24px", boxShadow: "0 4px 24px rgba(79,70,229,0.10)" }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                  One more step
                </h3>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.5 }}>
                  Enter your email so we know where to send your login link and invoices.
                </p>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#374151" }}>
                  Email address
                </label>
                <Input
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
                  style={{ width: "100%", background: "#4F46E5", color: "white" }}
                >
                  {loading ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                      Opening payment...
                    </span>
                  ) : (
                    `Pay Rs ${pendingPlan === "starter" ? "3,999" : "9,999"}/month`
                  )}
                </Button>
                <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 12 }}>
                  Secured by Razorpay. Cancel any time.
                </p>
              </div>
            )}
          </>
        )}

        <div className="max-w-3xl mx-auto mt-24">
          <h3 className="text-2xl font-medium text-center mb-8">Frequently Asked Questions</h3>
          <div className="space-y-6">
            {[
              {
                q: "What is GEO?",
                a: "Generative Engine Optimization (GEO) is the process of optimizing your brand's presence in AI search engines like ChatGPT, Gemini, and Perplexity, so you get recommended when users ask about your category.",
              },
              {
                q: "Is the free audit really free?",
                a: "Yes. Enter any domain and get your AI visibility score in 60 seconds. No account, no card. You get 2 free audits per day, or 5 per month when you add your email.",
              },
              {
                q: "How does daily monitoring work?",
                a: "Every day we run a full audit of your brand across ChatGPT, Gemini, Perplexity, Claude, and Grok. We save your score and send you a weekly digest with changes and recommendations.",
              },
              {
                q: "How do I log in? There is no password.",
                a: "After subscribing, we send a login link to your email. Click it and you are in. No password to remember. If you need a new link, visit the Sign in page.",
              },
              {
                q: "What payment methods are accepted?",
                a: "We use Razorpay, which accepts all major Indian payment methods: UPI, Net Banking, credit cards, debit cards, and wallets including Paytm and PhonePe.",
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
