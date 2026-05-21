import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PricingCards } from "@/components/pricing/PricingCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, TrendingUp, Target, Eye, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [url, setUrl] = useState("");

  const handleAuditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      setLocation(`/audit?url=${encodeURIComponent(url.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="pt-24 pb-20 px-4 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-light text-primary text-sm font-medium mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Generative Engine Optimization is here
          </div>
          
          <h1 className="text-5xl md:text-6xl font-semibold text-text-primary mb-6 tracking-tight max-w-4xl mx-auto leading-tight">
            Is your startup invisible in <span className="text-primary">AI search?</span>
          </h1>
          
          <p className="text-xl text-text-secondary mb-10 max-w-2xl mx-auto">
            Check how often ChatGPT, Gemini, and Perplexity recommend your brand over competitors. Get your free AI visibility audit in 60 seconds.
          </p>

          <Card className="max-w-2xl mx-auto p-2 bg-card shadow-lg border-primary/20 mb-8 rounded-2xl">
            <form onSubmit={handleAuditSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                <Input 
                  type="text" 
                  placeholder="Enter your startup's domain (e.g., razorpay.com)" 
                  className="pl-12 h-14 text-lg border-none shadow-none focus-visible:ring-0 bg-transparent"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="h-14 px-8 text-lg rounded-xl shrink-0" disabled={!url.trim()}>
                Check now <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </form>
          </Card>

          <div className="flex items-center justify-center gap-6 text-sm text-text-secondary font-medium">
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> No signup needed</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Free</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Instant results</span>
          </div>

          <div className="mt-20 pt-10 border-t border-border">
            <p className="text-sm font-medium text-text-tertiary mb-6 uppercase tracking-wider">Trusted by 500+ founders across India</p>
            <div className="flex justify-center gap-8 opacity-60 grayscale grayscale-100">
              {/* Fake logos using text for now */}
              <span className="font-bold text-xl">Zepto</span>
              <span className="font-bold text-xl">Cred</span>
              <span className="font-bold text-xl">Groww</span>
              <span className="font-bold text-xl">Meesho</span>
            </div>
          </div>
        </section>

        {/* Pain Points Section */}
        <section className="py-24 bg-bg-secondary px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-semibold text-text-primary mb-4">The new SEO is GEO</h2>
              <p className="text-text-secondary text-lg max-w-2xl mx-auto">Your customers aren't Googling anymore. They're asking AI. And right now, AI is recommending your competitors.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-8">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-6">
                  <Eye className="w-6 h-6 text-destructive" />
                </div>
                <h3 className="text-xl font-medium mb-3">ChatGPT recommends competitors</h3>
                <p className="text-text-secondary leading-relaxed">When users ask for tools in your category, ChatGPT suggests your funded competitors because they optimized for AI context.</p>
              </Card>
              <Card className="p-8">
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center mb-6">
                  <Target className="w-6 h-6 text-warning" />
                </div>
                <h3 className="text-xl font-medium mb-3">Gemini hasn't heard of you</h3>
                <p className="text-text-secondary leading-relaxed">Despite having great SEO traffic, Gemini's knowledge graph doesn't connect your brand to the problems you solve.</p>
              </Card>
              <Card className="p-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-3">No way to track this</h3>
                <p className="text-text-secondary leading-relaxed">Search Console is useless for AI systems. You have no dashboard to know if your PR and content are actually working.</p>
              </Card>
            </div>
          </div>
        </section>

        {/* Real Examples Section */}
        <section className="py-24 px-4 max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Real audit results</p>
            <h2 className="text-3xl font-semibold text-text-primary mb-4">Even well-known brands are mostly invisible</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">These are live audit results from real domains — not estimates.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Card 1 — Notion */}
            <Card className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-text-primary text-lg">notion.so</div>
                  <div className="text-xs text-text-tertiary mt-0.5">SaaS tool · Global</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-warning">24</div>
                  <div className="text-xs text-text-tertiary">/100</div>
                </div>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-warning h-2 rounded-full" style={{ width: "24%" }} />
              </div>
              <div className="text-xs text-text-tertiary italic">Used by 30M+ people worldwide</div>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">ChatGPT</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">Partial</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Gemini</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">Invisible</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Perplexity</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">Invisible</span>
                </div>
              </div>
              <p className="text-sm text-text-secondary border-t border-border pt-4 leading-relaxed">
                30 million users. Still mostly invisible in AI search.
              </p>
            </Card>

            {/* Card 2 — Groww */}
            <Card className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-text-primary text-lg">groww.in</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Fintech · India</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-warning">38</div>
                  <div className="text-xs text-text-tertiary">/100</div>
                </div>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-warning h-2 rounded-full" style={{ width: "38%" }} />
              </div>
              <div className="text-xs text-text-tertiary italic">India's most downloaded investment app</div>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">ChatGPT</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">Partial</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Gemini</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">Invisible</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Perplexity</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">Partial</span>
                </div>
              </div>
              <p className="text-sm text-text-secondary border-t border-border pt-4 leading-relaxed">
                India's most trusted investment app. Missing from most AI answers.
              </p>
            </Card>

            {/* Card 3 — Lemlist */}
            <Card className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-text-primary text-lg">lemlist.com</div>
                  <div className="text-xs text-text-tertiary mt-0.5">SaaS tool · Global</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-destructive">0</div>
                  <div className="text-xs text-text-tertiary">/100</div>
                </div>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-destructive h-2 rounded-full" style={{ width: "0%" }} />
              </div>
              <div className="text-xs text-text-tertiary italic">Popular sales tool with massive content marketing</div>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">ChatGPT</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">Invisible</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Gemini</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">Invisible</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Perplexity</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">Invisible</span>
                </div>
              </div>
              <p className="text-sm text-text-secondary border-t border-border pt-4 leading-relaxed">
                Huge blog. Strong SEO. Active community. Zero AI visibility. SEO does not equal GEO.
              </p>
            </Card>
          </div>

          {/* Insight Banner */}
          <div
            className="rounded-xl text-center px-6 py-6"
            style={{ background: "#fff8f0", border: "0.5px solid #FAEEDA" }}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5" style={{ color: "#F59E0B" }} />
              <h3 className="text-lg font-medium" style={{ color: "#633806" }}>SEO does not equal GEO</h3>
            </div>
            <p className="text-sm leading-relaxed mx-auto max-w-[480px]" style={{ color: "#854F0B", lineHeight: "1.7" }}>
              Lemlist has thousands of blog posts, strong backlinks, and a massive SEO presence.
              It still scores 0/100 for AI visibility.
              Google rankings and AI recommendations are completely separate signals.
            </p>
            <Button
              className="mt-5 px-6 h-11 rounded-xl text-sm font-medium"
              style={{ background: "#534AB7", color: "#fff" }}
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Check your AI visibility free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-24 px-4 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-text-primary mb-4">How GEOscore works</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">We reverse-engineer AI recommendation engines to give you actionable visibility data.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-border z-0"></div>
            
            {[
              { step: "1", title: "Query Engines", desc: "We programmatically query ChatGPT, Gemini, and Perplexity with buyer-intent prompts in your niche." },
              { step: "2", title: "Analyze Context", desc: "We analyze the responses to see if your brand is recommended, mentioned, or ignored completely." },
              { step: "3", title: "Score & Monitor", desc: "We calculate your GEOscore and track it daily so you can measure the impact of your marketing." }
            ].map((item, i) => (
              <div key={i} className="relative z-10 text-center flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-card border-4 border-bg-secondary shadow-md flex items-center justify-center text-2xl font-bold text-primary mb-6">
                  {item.step}
                </div>
                <h3 className="text-xl font-medium mb-3">{item.title}</h3>
                <p className="text-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Founder Story */}
        <section className="py-24 bg-primary text-primary-foreground px-4">
          <div className="max-w-4xl mx-auto text-center">
            <blockquote className="text-2xl md:text-4xl font-medium leading-tight mb-10">
              "I built MealCoreAI to 12,000 users, but our growth stalled. Turns out, Perplexity was telling our exact target audience to use our competitor. I built GEOscore to fix my own problem."
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary-dark border-2 border-white/20"></div>
              <div className="text-left">
                <div className="font-semibold text-lg">Aarav Patel</div>
                <div className="text-primary-light">Founder, GEOscore</div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Preview */}
        <section className="py-24 px-4 bg-bg-secondary">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-text-primary mb-4">Start monitoring today</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">Stop guessing what AI thinks of your startup.</p>
          </div>
          <PricingCards />
        </section>
      </main>

      <Footer />
    </div>
  );
}
