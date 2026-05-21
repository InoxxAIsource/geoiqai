import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRunAudit, useEmailSubscribe } from "@workspace/api-client-react";
import { useQuery } from "@/hooks/use-query";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SystemCard } from "@/components/audit/SystemCard";
import { ScoreBar } from "@/components/ui/score-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";

const emailSchema = z.object({
  email: z.string().email("Valid email required")
});

export default function Audit() {
  const [, setLocation] = useLocation();
  const query = useQuery();
  const urlParam = query.get("url");
  const { toast } = useToast();
  
  const runAuditMutation = useRunAudit();
  const subscribeMutation = useEmailSubscribe();
  
  const [auditResult, setAuditResult] = useState<any>(null);
  
  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" }
  });

  useEffect(() => {
    if (!urlParam) {
      setLocation("/");
      return;
    }
    
    // Auto trigger audit on mount
    runAuditMutation.mutate({ data: { url: urlParam } }, {
      onSuccess: (data) => {
        setAuditResult(data);
      },
      onError: () => {
        toast({ title: "Audit failed", description: "Could not analyze the domain. Please try again.", variant: "destructive" });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParam, setLocation, toast]);

  const onSubscribe = (values: z.infer<typeof emailSchema>) => {
    subscribeMutation.mutate({ 
      data: { 
        email: values.email, 
        domain: auditResult?.domain,
        auditId: auditResult?.id 
      } 
    }, {
      onSuccess: () => {
        toast({ title: "Subscribed", description: "You'll receive updates about this audit." });
        emailForm.reset();
      }
    });
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high": return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case "medium": return <AlertCircle className="w-5 h-5 text-warning" />;
      case "low": return <CheckCircle2 className="w-5 h-5 text-success" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-secondary">
      <Navbar />
      
      <main className="flex-1 py-12 px-4 max-w-7xl mx-auto w-full">
        <Link href="/" className="inline-flex items-center text-text-secondary hover:text-primary mb-8 font-medium text-sm transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to home
        </Link>
        
        {runAuditMutation.isPending && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-6" />
            <h2 className="text-2xl font-semibold mb-2">Querying AI Systems...</h2>
            <p className="text-text-secondary max-w-md">We are currently asking ChatGPT, Gemini, and Perplexity about {urlParam}. This takes ~15 seconds to complete.</p>
          </div>
        )}
        
        {runAuditMutation.isError && (
          <div className="text-center py-32">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Audit Failed</h2>
            <p className="text-text-secondary mb-6">We encountered an error analyzing {urlParam}.</p>
            <Button onClick={() => runAuditMutation.mutate({ data: { url: urlParam! } })}>Try Again</Button>
          </div>
        )}

        {auditResult && !runAuditMutation.isPending && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <h1 className="text-3xl font-semibold text-text-primary mb-2">
                  Visibility Audit: {auditResult.domain}
                </h1>
                <p className="text-text-secondary">
                  Ran on {new Date(auditResult.createdAt).toLocaleDateString()} at {new Date(auditResult.createdAt).toLocaleTimeString()}
                </p>
              </div>
              
              <Card className="p-6 bg-card border-border flex items-center gap-6 shadow-sm min-w-[300px]">
                <div className="shrink-0">
                  <div className="text-sm text-text-secondary font-medium uppercase tracking-wider mb-1">GEOscore</div>
                  <div className="text-5xl font-bold tracking-tighter text-text-primary">{auditResult.scoreTotal}</div>
                </div>
                <div className="flex-1">
                  <ScoreBar score={auditResult.scoreTotal} />
                  <div className="text-xs text-text-tertiary mt-2">out of 100</div>
                </div>
              </Card>
            </div>

            {/* AI Systems */}
            <h2 className="text-xl font-semibold mb-6">AI System Breakdown</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <SystemCard 
                system="chatgpt" 
                score={auditResult.scoreChatgpt} 
                found={auditResult.chatgptFound} 
                detail={auditResult.chatgptDetail} 
              />
              <SystemCard 
                system="gemini" 
                score={auditResult.scoreGemini} 
                found={auditResult.geminiFound} 
                detail={auditResult.geminiDetail} 
              />
              <SystemCard 
                system="perplexity" 
                score={auditResult.scorePerplexity} 
                found={auditResult.perplexityFound} 
                detail={auditResult.perplexityDetail} 
              />
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-16">
              {/* Recommendations */}
              <div className="md:col-span-2 space-y-6">
                <h2 className="text-xl font-semibold">Actionable Recommendations</h2>
                {auditResult.recommendations?.length > 0 ? (
                  <div className="space-y-4">
                    {auditResult.recommendations.map((rec: any, i: number) => (
                      <Card key={i} className="p-5 border-l-4" style={{ 
                        borderLeftColor: rec.priority === 'high' ? 'hsl(var(--destructive))' : 
                                        rec.priority === 'medium' ? 'hsl(var(--warning))' : 'hsl(var(--success))'
                      }}>
                        <div className="flex gap-4">
                          <div className="shrink-0 mt-1">
                            {getPriorityIcon(rec.priority)}
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium">{rec.title}</h3>
                              <Badge variant="outline" className="text-xs bg-bg-secondary">{rec.aiSystem}</Badge>
                            </div>
                            <p className="text-sm text-text-secondary">{rec.description}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-8 text-center text-text-secondary">
                    No urgent recommendations at this time.
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-8">
                <Card className="p-6">
                  <h3 className="font-medium mb-4">Competitors Found</h3>
                  {auditResult.competitorsFound?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {auditResult.competitorsFound.map((comp: string, i: number) => (
                        <Badge key={i} variant="secondary" className="bg-bg-tertiary text-text-primary hover:bg-bg-tertiary">
                          {comp}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">None mentioned in responses.</p>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="font-medium mb-4">Keywords Analyzed</h3>
                  {auditResult.keywordsUsed?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {auditResult.keywordsUsed.map((kw: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-text-secondary font-normal">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">General brand queries used.</p>
                  )}
                </Card>
              </div>
            </div>

            {/* CTA Section */}
            <Card className="bg-primary text-primary-foreground p-10 text-center rounded-2xl flex flex-col items-center">
              <h2 className="text-3xl font-semibold mb-4">Don't let competitors steal your AI traffic</h2>
              <p className="text-primary-light mb-8 max-w-2xl text-lg">
                Your GEOscore changes as AI models update their training data. Monitor {auditResult.domain} daily and get alerts when your visibility drops.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/pricing">
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-medium h-12 px-8">
                    Start Daily Monitoring
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 h-12 px-8">
                    Create Free Account
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Email Subscribe */}
            <div className="mt-20 max-w-md mx-auto text-center border-t pt-12">
              <div className="inline-flex w-12 h-12 rounded-full bg-primary-light items-center justify-center mb-4">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-medium text-lg mb-2">Get the PDF report</h3>
              <p className="text-sm text-text-secondary mb-6">Enter your email to receive a detailed breakdown of this audit.</p>
              
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onSubscribe)} className="flex gap-2">
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="founder@startup.com" {...field} className="bg-card" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={subscribeMutation.isPending}>
                    {subscribeMutation.isPending ? "Sending..." : "Send PDF"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
