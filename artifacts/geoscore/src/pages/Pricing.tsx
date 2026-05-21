import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useCreatePaymentOrder, useGetMe, PaymentOrderInputPlan } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PricingCards } from "@/components/pricing/PricingCards";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@/hooks/use-query";
import { Loader2 } from "lucide-react";

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
  const { isAuthenticated } = useAuthGuard();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryParams = useQuery();
  const requestedPlan = queryParams.get("plan");
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user } = useGetMe({ query: { enabled: isAuthenticated } as any });
  const createOrder = useCreatePaymentOrder();

  const handleSelectPlan = async (planId: string) => {
    if (planId === "free") {
      if (isAuthenticated) setLocation("/dashboard");
      else setLocation("/register");
      return;
    }

    if (!isAuthenticated) {
      setLocation(`/login?redirect=/pricing?plan=${planId}`);
      return;
    }

    setLoading(true);
    try {
      const order = await new Promise<{ orderId: string; amount: number; currency: string; keyId: string }>(
        (resolve, reject) => {
          createOrder.mutate(
            { data: { plan: planId as PaymentOrderInputPlan } },
            { onSuccess: resolve, onError: reject },
          );
        },
      );

      await loadRazorpayScript();

      const userEmail = user?.email ?? "";

      const options: Record<string, unknown> = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "GeoIQ",
        description: planId === "starter"
          ? "GeoIQ Starter, Daily AI Visibility Monitoring"
          : "GeoIQ Agency, 10 Brands AI Monitoring",
        theme: { color: "#4F46E5" },
        prefill: { email: userEmail },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("geoscore_token") ?? ""}`,
              },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                plan: planId,
              }),
            });

            if (verifyRes.ok) {
              toast({ title: "Payment successful", description: "Your plan is now active." });
              setLocation("/dashboard");
            } else {
              toast({ title: "Verification failed", description: "Contact support if payment was deducted.", variant: "destructive" });
            }
          } catch {
            toast({ title: "Error", description: "Could not verify payment.", variant: "destructive" });
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      toast({ title: "Error", description: "Could not initiate payment. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-secondary">
      <Navbar />

      <main className="flex-1 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-semibold text-text-primary mb-6">
            Simple, honest pricing
          </h1>
          <p className="text-lg text-text-secondary">
            Start free. Upgrade when ready.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center items-center gap-3 mb-8 text-text-secondary text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Opening payment...
          </div>
        )}

        <PricingCards onSelectPlan={(plan) => { handleSelectPlan(plan).catch(() => {}); }} />

        <div className="max-w-3xl mx-auto mt-24">
          <h3 className="text-2xl font-medium text-center mb-8">Frequently Asked Questions</h3>
          <div className="space-y-6">
            {[
              {
                q: "What is GEO?",
                a: "Generative Engine Optimization (GEO) is the process of optimizing your brand's presence in AI search engines like ChatGPT, Gemini, and Perplexity, so you get recommended when users ask about your category.",
              },
              {
                q: "Is the free audit really free? No credit card?",
                a: "Yes, completely free. Enter any domain and get your AI visibility score in 60 seconds. No account, no credit card, no strings.",
              },
              {
                q: "How does daily monitoring work?",
                a: "Every day at 2am IST, we run a full audit of your brand across ChatGPT, Gemini, and Perplexity using multiple prompts. We save your score and send you a weekly digest with changes and recommendations.",
              },
              {
                q: "Can I switch plans later?",
                a: "Yes, you can upgrade or downgrade at any time from your dashboard.",
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
