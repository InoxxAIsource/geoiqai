import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  isPopular?: boolean;
}

const plans: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "/forever",
    description: "Perfect for a quick health check.",
    features: [
      "1 AI Search Audit per month",
      "Overall GEOscore",
      "Basic recommendations",
      "No historical tracking"
    ]
  },
  {
    id: "starter",
    name: "Starter",
    price: "₹3,999",
    period: "/mo",
    description: "For founders obsessed with AI visibility.",
    isPopular: true,
    features: [
      "Track up to 3 brands",
      "Daily automated audits",
      "Historical trend charts",
      "Competitor AI tracking",
      "Detailed keyword analysis",
      "Priority recommendations"
    ]
  },
  {
    id: "agency",
    name: "Agency",
    price: "₹11,999",
    period: "/mo",
    description: "For agencies and large portfolios.",
    features: [
      "Track up to 15 brands",
      "Everything in Starter",
      "Export PDF reports",
      "API access",
      "Custom tracking keywords",
      "Dedicated account manager"
    ]
  }
];

export function PricingCards({ onSelectPlan }: { onSelectPlan?: (planId: string) => void }) {
  const [, setLocation] = useLocation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {plans.map((plan) => (
        <Card 
          key={plan.id} 
          className={`p-6 flex flex-col relative ${plan.isPopular ? 'border-primary shadow-md' : 'border-border shadow-sm'}`}
        >
          {plan.isPopular && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">
              Most Popular
            </div>
          )}
          
          <div className="mb-6">
            <h3 className="text-lg font-medium text-text-primary mb-2">{plan.name}</h3>
            <p className="text-sm text-text-secondary h-10">{plan.description}</p>
          </div>
          
          <div className="mb-6">
            <span className="text-3xl font-semibold text-text-primary">{plan.price}</span>
            <span className="text-text-secondary ml-1">{plan.period}</span>
          </div>

          <ul className="flex-1 space-y-3 mb-8">
            {plan.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm text-text-primary">{feature}</span>
              </li>
            ))}
          </ul>

          <Button 
            variant={plan.isPopular ? "default" : "outline"} 
            className={`w-full ${plan.isPopular ? '' : 'border-primary text-primary hover:bg-primary-light'}`}
            onClick={() => {
              if (onSelectPlan) onSelectPlan(plan.id);
              else setLocation(plan.id === 'free' ? '/register' : `/pricing?plan=${plan.id}`);
            }}
          >
            {plan.id === 'free' ? 'Get Started' : 'Upgrade'}
          </Button>
        </Card>
      ))}
    </div>
  );
}
