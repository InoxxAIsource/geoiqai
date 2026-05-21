import { useEffect } from "react";
import { useLocation } from "wouter";
import { useCreatePaymentOrder, PaymentOrderInputPlan } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PricingCards } from "@/components/pricing/PricingCards";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@/hooks/use-query";

export default function Pricing() {
  const { isAuthenticated } = useAuthGuard();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const query = useQuery();
  const requestedPlan = query.get("plan");

  const createOrder = useCreatePaymentOrder();

  const handleSelectPlan = (planId: string) => {
    if (planId === "free") {
      if (isAuthenticated) setLocation("/dashboard");
      else setLocation("/register");
      return;
    }

    if (!isAuthenticated) {
      setLocation(`/login?redirect=/pricing?plan=${planId}`);
      return;
    }

    createOrder.mutate({ data: { plan: planId as PaymentOrderInputPlan } }, {
      onSuccess: (order) => {
        // In a real app we'd open Razorpay modal here
        toast({ title: "Payment Initiated", description: `Order ${order.orderId} created for ${order.amount} ${order.currency}. Check your email to complete payment.` });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to initiate payment", variant: "destructive" });
      }
    });
  };

  useEffect(() => {
    if (requestedPlan && isAuthenticated) {
      handleSelectPlan(requestedPlan);
    }
  }, [requestedPlan, isAuthenticated]);

  return (
    <div className="min-h-screen flex flex-col bg-bg-secondary">
      <Navbar />
      
      <main className="flex-1 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-semibold text-text-primary mb-6">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-text-secondary">
            No hidden fees. Just the insights you need to dominate AI search.
          </p>
        </div>

        <PricingCards onSelectPlan={handleSelectPlan} />

        <div className="max-w-3xl mx-auto mt-24">
          <h3 className="text-2xl font-medium text-center mb-8">Frequently Asked Questions</h3>
          <div className="space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border">
              <h4 className="font-medium text-text-primary mb-2">What is GEO?</h4>
              <p className="text-text-secondary text-sm">Generative Engine Optimization (GEO) is the process of optimizing your brand's presence in AI search engines like ChatGPT, Gemini, and Perplexity.</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
              <h4 className="font-medium text-text-primary mb-2">Can I switch plans later?</h4>
              <p className="text-text-secondary text-sm">Yes, you can upgrade or downgrade your plan at any time from your dashboard.</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
              <h4 className="font-medium text-text-primary mb-2">How accurate is the GEOscore?</h4>
              <p className="text-text-secondary text-sm">Our proprietary algorithm analyzes keyword presence, sentiment, and competitor mentions across multiple AI engines to calculate a highly accurate 0-100 score.</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
