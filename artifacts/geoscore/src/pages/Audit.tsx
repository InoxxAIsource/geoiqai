import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRunAudit, useEmailSubscribe } from "@workspace/api-client-react";
import { useQuery } from "@/hooks/use-query";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";

const emailSchema = z.object({
  email: z.string().email("Valid email required"),
});

const LOADING_STEPS = [
  "Scraping your website",
  "Extracting keywords",
  "Querying ChatGPT",
  "Querying Gemini",
  "Querying Perplexity",
  "Computing your GEO IQ",
];

const FINGER_TAP_CSS = `
@keyframes finger-drum {
  0%   { transform: translateY(0px)  rotate(0deg); }
  7%   { transform: translateY(-14px) rotate(-2.5deg); }
  14%  { transform: translateY(2px)  rotate(0.5deg); }
  22%  { transform: translateY(-10px) rotate(-2deg); }
  29%  { transform: translateY(1px)  rotate(0deg); }
  38%  { transform: translateY(-12px) rotate(-2.5deg); }
  45%  { transform: translateY(2px)  rotate(0.5deg); }
  54%  { transform: translateY(-7px)  rotate(-1.5deg); }
  61%  { transform: translateY(0px)  rotate(0deg); }
  100% { transform: translateY(0px)  rotate(0deg); }
}
@keyframes tap-shadow {
  0%,61%,100% { transform: scaleX(1);   opacity: 0.18; }
  7%,22%,38%,54% { transform: scaleX(0.7); opacity: 0.08; }
  14%,29%,45%,61% { transform: scaleX(1.1); opacity: 0.22; }
}
@keyframes audit-fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.finger-drum-anim {
  animation: finger-drum 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  transform-origin: bottom center;
}
.tap-shadow-anim {
  animation: tap-shadow 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.audit-result-anim {
  animation: audit-fade-in 0.45s ease forwards;
}
`;

function getScoreColor(score: number): string {
  if (score < 34) return "#ef4444";
  if (score < 67) return "#f59e0b";
  return "#10b981";
}

function getStatusBadge(found: boolean, score: number): { label: string; bg: string; text: string } {
  if (!found) return { label: "Invisible", bg: "#FCEBEB", text: "#791F1F" };
  if (score >= 20) return { label: "Visible", bg: "#E1F5EE", text: "#085041" };
  return { label: "Partial", bg: "#FAEEDA", text: "#633806" };
}

function SystemRow({
  system, found, score, detail,
}: {
  system: string; found: boolean; score: number; detail?: string | null;
}) {
  const badge = getStatusBadge(found, score);
  const systemColors: Record<string, string> = {
    ChatGPT: "#10a37f", Gemini: "#4285f4", Perplexity: "#22d3ee",
  };
  const color = systemColors[system] ?? "#4F46E5";
  return (
    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: found ? "#E1F5EE" : "#FCEBEB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {found
            ? <CheckCircle2 style={{ width: 18, height: 18, color: "#10b981" }} />
            : <XCircle style={{ width: 18, height: 18, color: "#ef4444" }} />}
        </div>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, color: "#111827", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color }} />
            {system}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            {found
              ? detail ? detail.substring(0, 80) + (detail.length > 80 ? "..." : "") : "Mentioned in responses"
              : "Not found in responses"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0, marginLeft: 16 }}>
        <span style={{ background: badge.bg, color: badge.text, borderRadius: 9999, padding: "2px 10px", fontSize: 12, fontWeight: 500 }}>
          {badge.label}
        </span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{system} IQ: {score}/33</span>
      </div>
    </div>
  );
}

export default function Audit() {
  useEffect(() => { document.title = "Your GEO IQ Score | GeoIQ"; }, []);
  const [, setLocation] = useLocation();
  const query = useQuery();
  const urlParam = query.get("url");
  const { toast } = useToast();

  const runAuditMutation = useRunAudit();
  const subscribeMutation = useEmailSubscribe();

  const [auditResult, setAuditResult] = useState<any>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<boolean[]>(LOADING_STEPS.map(() => false));

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (!urlParam) { setLocation("/"); return; }
    runAuditMutation.mutate(
      { data: { url: urlParam } },
      {
        onSuccess: (data) => setAuditResult(data),
        onError: () => toast({ title: "Audit failed", description: "Could not analyze the domain. Please try again.", variant: "destructive" }),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParam]);

  useEffect(() => {
    if (!runAuditMutation.isPending) return;
    let step = 0;
    const interval = setInterval(() => {
      if (step < LOADING_STEPS.length - 1) {
        setDoneSteps((prev) => { const n = [...prev]; n[step] = true; return n; });
        step++;
        setLoadingStep(step);
      }
    }, 1800);
    return () => clearInterval(interval);
  }, [runAuditMutation.isPending]);

  const onSubscribe = (values: z.infer<typeof emailSchema>) => {
    subscribeMutation.mutate(
      { data: { email: values.email, domain: auditResult?.domain, auditId: auditResult?.id } },
      {
        onSuccess: () => {
          toast({ title: "Subscribed", description: "You will receive your weekly digest." });
          emailForm.reset();
        },
      },
    );
  };

  const shareText = auditResult
    ? `I just checked my GEO IQ score with GeoIQ, ${auditResult.domain} got ${auditResult.scoreTotal}/100. Check yours free at geoiqai.com`
    : "";
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  const progress = Math.round(((loadingStep + (doneSteps[loadingStep] ? 1 : 0)) / LOADING_STEPS.length) * 100);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f9fafb" }}>
      <style>{FINGER_TAP_CSS}</style>
      <Navbar />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px" }}>

        {/* ── Loading state ── */}
        {runAuditMutation.isPending && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40, width: "100%", maxWidth: 440 }}>

            {/* Animated tapping fingers */}
            <div style={{ position: "relative", marginBottom: 32, userSelect: "none" }}>
              <img
                src="/fingers-tapping.jpeg"
                alt="Scanning…"
                className="finger-drum-anim"
                style={{ width: 200, height: "auto", display: "block", filter: "grayscale(0.1) contrast(1.05)" }}
              />
              {/* Ground shadow that pulses with the tap */}
              <div
                className="tap-shadow-anim"
                style={{
                  position: "absolute",
                  bottom: -8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 160,
                  height: 12,
                  borderRadius: "50%",
                  background: "radial-gradient(ellipse, rgba(0,0,0,0.25) 0%, transparent 70%)",
                }}
              />
            </div>

            {/* Heading */}
            <div style={{ fontWeight: 700, fontSize: 18, color: "#111827", textAlign: "center", marginBottom: 6 }}>
              Hang tight...
            </div>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32, textAlign: "center", lineHeight: 1.5 }}>
              Scanning <strong style={{ color: "#374151" }}>{urlParam}</strong> across<br />
              ChatGPT, Gemini &amp; Perplexity
            </p>

            {/* Step list */}
            <div style={{ width: "100%", marginBottom: 28 }}>
              {LOADING_STEPS.map((label, i) => {
                const isDone = doneSteps[i];
                const isCurrent = loadingStep === i && !isDone;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "9px 0",
                      opacity: i > loadingStep ? 0.3 : 1,
                      transition: "opacity 0.4s",
                    }}
                  >
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isDone ? "#10b981" : isCurrent ? "#4F46E5" : "#e5e7eb",
                      transition: "background 0.35s",
                    }}>
                      {isDone
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        : isCurrent
                          ? <Loader2 style={{ width: 13, height: 13, color: "white", animation: "spin 1s linear infinite" }} />
                          : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9ca3af", display: "block" }} />}
                    </div>
                    <span style={{ fontSize: 14, color: isDone ? "#10b981" : isCurrent ? "#4F46E5" : "#6b7280", fontWeight: isCurrent ? 500 : 400 }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div style={{ width: "100%", height: 6, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                background: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                borderRadius: 4,
                width: `${progress}%`,
                transition: "width 1.6s ease",
              }} />
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {runAuditMutation.isError && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <XCircle style={{ width: 48, height: 48, color: "#ef4444", margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Audit Failed</h2>
            <p style={{ color: "#6b7280", marginBottom: 24 }}>We could not analyze {urlParam}. Please try again.</p>
            <Button onClick={() => runAuditMutation.mutate({ data: { url: urlParam! } })}>Try Again</Button>
          </div>
        )}

        {/* ── Results ── */}
        {auditResult && !runAuditMutation.isPending && (
          <div className="audit-result-anim" style={{ width: "100%", maxWidth: 680 }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 18, color: "#111827" }}>{auditResult.domain}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  AI visibility audit · just now · {auditResult.category ?? "saas tool"} · {auditResult.market ?? "India"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 40, fontWeight: 500, color: getScoreColor(auditResult.scoreTotal), lineHeight: 1 }}>
                    {auditResult.scoreTotal}
                  </span>
                  <span style={{ fontSize: 16, color: "#6b7280" }}>/100</span>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>GEO IQ score</div>
              </div>
            </div>

            {/* Score Bar */}
            <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ height: "100%", width: `${auditResult.scoreTotal}%`, background: getScoreColor(auditResult.scoreTotal), borderRadius: 4, transition: "width 0.8s ease" }} />
            </div>

            {/* 3 Metric Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { label: `${[auditResult.chatgptFound, auditResult.geminiFound, auditResult.perplexityFound].filter(Boolean).length}/3 AI systems found you` },
                { label: auditResult.chatgptFound ? "Visible on ChatGPT" : auditResult.geminiFound ? "Visible on Gemini" : "Not ranked #1 anywhere" },
                { label: `${[!auditResult.chatgptFound, !auditResult.geminiFound, !auditResult.perplexityFound].filter(Boolean).length} blind spot${[!auditResult.chatgptFound, !auditResult.geminiFound, !auditResult.perplexityFound].filter(Boolean).length !== 1 ? "s" : ""} found` },
              ].map((card, i) => (
                <div key={i} style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#374151", fontWeight: 500, textAlign: "center" }}>
                  {card.label}
                </div>
              ))}
            </div>

            {/* AI System Rows */}
            <div style={{ marginBottom: 20 }}>
              <SystemRow system="ChatGPT" found={auditResult.chatgptFound} score={auditResult.scoreChatgpt} detail={auditResult.chatgptDetail} />
              <SystemRow system="Gemini" found={auditResult.geminiFound} score={auditResult.scoreGemini} detail={auditResult.geminiDetail} />
              <SystemRow system="Perplexity" found={auditResult.perplexityFound} score={auditResult.scorePerplexity} detail={auditResult.perplexityDetail} />
            </div>

            {/* Locked Recommendations */}
            <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 24, marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: "#111827", marginBottom: 6 }}>Boost your GEO IQ</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                5 specific actions to appear in Gemini and Perplexity
              </div>
              <div style={{ filter: "blur(5px)", pointerEvents: "none", marginBottom: 20, textAlign: "left" }}>
                {[
                  { dot: "#ef4444", w1: 280, w2: 220 },
                  { dot: "#f59e0b", w1: 240, w2: 200 },
                  { dot: "#10b981", w1: 260, w2: 180 },
                ].map((row, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: i < 2 ? "0.5px solid #e5e7eb" : "none" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.dot, marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ height: 12, background: "#d1d5db", borderRadius: 4, width: row.w1, marginBottom: 6 }} />
                      <div style={{ height: 10, background: "#e5e7eb", borderRadius: 4, width: row.w2 }} />
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/pricing">
                <Button style={{ width: "100%", background: "#4F46E5", color: "white", marginBottom: 16, height: 42 }}>
                  Unlock full GEO IQ report, ₹3,999/mo →
                </Button>
              </Link>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, fontSize: 13, color: "#9ca3af" }}>
                <div style={{ flex: 1, height: "0.5px", background: "#e5e7eb" }} />
                or
                <div style={{ flex: 1, height: "0.5px", background: "#e5e7eb" }} />
              </div>
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onSubscribe)} style={{ display: "flex", gap: 8 }}>
                  <FormField control={emailForm.control} name="email" render={({ field }) => (
                    <FormItem style={{ flex: 1 }}>
                      <FormControl>
                        <Input placeholder="Enter your email for free weekly digest" style={{ background: "white" }} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" variant="outline" disabled={subscribeMutation.isPending} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                    {subscribeMutation.isPending ? "Sending..." : "Send me the free report →"}
                  </Button>
                </form>
              </Form>
            </div>

            {/* Share */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderTop: "0.5px solid #e5e7eb" }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>Share your score:</span>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#000", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
                <ExternalLink style={{ width: 14, height: 14 }} />
                Share on X
              </a>
            </div>

            {/* Back */}
            <div style={{ textAlign: "center", paddingTop: 8 }}>
              <Link href="/" style={{ fontSize: 13, color: "#9ca3af", textDecoration: "none" }}>
                ← Check another domain
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
