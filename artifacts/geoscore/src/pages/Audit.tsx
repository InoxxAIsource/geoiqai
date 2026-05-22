import { useEffect, useState, useRef } from "react";
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
import { CheckCircle2, XCircle, Loader2, ExternalLink, ChevronDown, ChevronUp, Copy, Check, AlertTriangle } from "lucide-react";

const emailSchema = z.object({
  email: z.string().email("Valid email required"),
});

const LOADING_STEPS = [
  "Scraping your website",
  "Extracting keywords",
  "Querying ChatGPT",
  "Querying Gemini",
  "Querying Perplexity",
  "Querying Claude",
  "Querying Grok",
  "Running technical GEO audit",
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

function getUnderstandingLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 25) return { label: "Strong understanding", color: "#059669", bg: "#ecfdf5" };
  if (score >= 10) return { label: "Partial understanding", color: "#D97706", bg: "#fffbeb" };
  if (score >= 1)  return { label: "No current info", color: "#DC2626", bg: "#fef2f2" };
  return { label: "Unknown or unclear", color: "#DC2626", bg: "#fef2f2" };
}

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", background: copied ? "#ecfdf5" : "#f3f4f6",
        color: copied ? "#059669" : "#374151", border: "0.5px solid",
        borderColor: copied ? "#6ee7b7" : "#d1d5db", borderRadius: 6,
        fontSize: 12, fontWeight: 500, cursor: "pointer",
      }}
    >
      {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
      {copied ? "Copied" : "Copy to clipboard"}
    </button>
  );
}

const ENGINE_CONFIG: Record<string, { color: string; barColor: string; label: string }> = {
  ChatGPT:    { color: "#10a37f", barColor: "linear-gradient(90deg,#0d9068,#10a37f)", label: "ChatGPT says:" },
  Gemini:     { color: "#4285f4", barColor: "linear-gradient(90deg,#1a6fe8,#4285f4)", label: "Gemini says:" },
  Perplexity: { color: "#9333ea", barColor: "linear-gradient(90deg,#7c22d4,#9333ea)", label: "Perplexity says:" },
  Claude:     { color: "#d97706", barColor: "linear-gradient(90deg,#b45309,#d97706)", label: "Claude says:" },
  Grok:       { color: "#374151", barColor: "linear-gradient(90deg,#1f2937,#374151)", label: "Grok says:" },
};

function SystemCard({
  system, found, score, detail, rawResponse, checkedAt, simulated,
}: {
  system: string; found: boolean; score: number; detail?: string | null;
  rawResponse?: string | null; checkedAt: string; simulated?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const understanding = getUnderstandingLabel(score);
  const scaledScore = Math.round((score / 33) * 100);
  const cfg = ENGINE_CONFIG[system] ?? { color: "#4F46E5", barColor: "linear-gradient(90deg,#4F46E5,#7C3AED)", label: `${system} says:` };

  return (
    <div style={{
      background: "white",
      border: "0.5px solid #e5e7eb",
      borderLeft: `3px solid ${cfg.color}`,
      borderRadius: 10,
      marginBottom: 8,
      overflow: "hidden",
    }}>
      <div style={{ padding: "12px 14px 10px" }}>
        {/* Engine name row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{system}</span>
            {simulated && (
              <span style={{ fontSize: 10, color: "#9ca3af", background: "#f3f4f6", border: "0.5px solid #e5e7eb", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.02em" }}>simulated</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              background: understanding.bg, color: understanding.color,
              borderRadius: 9999, padding: "2px 9px", fontSize: 11, fontWeight: 500,
            }}>
              {understanding.label}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: scaledScore > 0 ? cfg.color : "#d1d5db", minWidth: 38, textAlign: "right" }}>
              {scaledScore}<span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>/100</span>
            </span>
          </div>
        </div>

        {/* Score bar */}
        <div style={{ height: 5, background: "#f3f4f6", borderRadius: 3, overflow: "hidden", marginBottom: 9 }}>
          <div style={{
            height: "100%",
            width: `${scaledScore}%`,
            background: scaledScore === 0 ? "#e5e7eb" : cfg.barColor,
            borderRadius: 3,
            transition: "width 1.1s cubic-bezier(0.4,0,0.2,1)",
          }} />
        </div>

        {/* Detail line */}
        <div style={{ fontSize: 12, color: found ? "#4b5563" : "#9ca3af", lineHeight: 1.5 }}>
          {found && detail
            ? detail.substring(0, 110) + (detail.length > 110 ? "..." : "")
            : "Not mentioned when AI systems were asked about your category"}
        </div>
      </div>

      {rawResponse && (
        <>
          <div
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: "7px 14px", borderTop: "0.5px solid #f3f4f6",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", background: expanded ? "#f9fafb" : "white",
              fontSize: 11, color: "#6b7280", userSelect: "none",
            }}
          >
            <span>What {system} actually said about you</span>
            {expanded
              ? <ChevronUp style={{ width: 13, height: 13 }} />
              : <ChevronDown style={{ width: 13, height: 13 }} />}
          </div>
          {expanded && (
            <div style={{ background: "#0d1117", padding: "16px" }}>
              <div style={{
                fontSize: 11, color: "#8b949e", fontFamily: "monospace",
                marginBottom: 10, display: "flex", justifyContent: "space-between",
                alignItems: "center", flexWrap: "wrap", gap: 8,
              }}>
                <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: "#6b7280" }}>Checked {formatTimestamp(checkedAt)}</span>
                  <CopyButton text={rawResponse ?? ""} />
                </div>
              </div>
              <pre style={{
                fontSize: 12, color: "#e6edf3", fontFamily: "monospace",
                lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word",
                margin: 0, maxHeight: 320, overflowY: "auto",
              }}>
                {rawResponse}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TechCheckCard({ check }: { check: { id: string; name: string; score: number; status: string; detail: string } }) {
  const statusConfig = {
    pass: { bg: "#ecfdf5", border: "#6ee7b7", icon: <CheckCircle2 style={{ width: 16, height: 16, color: "#059669" }} />, badgeBg: "#dcfce7", badgeColor: "#15803d", label: "Pass" },
    warn: { bg: "#fffbeb", border: "#fde68a", icon: <AlertTriangle style={{ width: 16, height: 16, color: "#D97706" }} />, badgeBg: "#fef9c3", badgeColor: "#854d0e", label: "Warn" },
    fail: { bg: "#fef2f2", border: "#fca5a5", icon: <XCircle style={{ width: 16, height: 16, color: "#DC2626" }} />, badgeBg: "#fee2e2", badgeColor: "#991b1b", label: "Fail" },
  };
  const cfg = statusConfig[check.status as "pass" | "warn" | "fail"] ?? statusConfig.fail;

  return (
    <div style={{
      background: "white", border: `0.5px solid #e5e7eb`,
      borderLeft: `3px solid ${check.status === "pass" ? "#10b981" : check.status === "warn" ? "#f59e0b" : "#ef4444"}`,
      borderRadius: 10, padding: "14px 16px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {cfg.icon}
          <span style={{ fontWeight: 500, fontSize: 14, color: "#111827" }}>{check.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: check.score >= 70 ? "#059669" : check.score >= 40 ? "#D97706" : "#DC2626" }}>
            {check.score}/100
          </span>
          <span style={{
            background: cfg.badgeBg, color: cfg.badgeColor,
            borderRadius: 9999, padding: "2px 8px", fontSize: 11, fontWeight: 600,
          }}>
            {cfg.label}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{check.detail}</p>
    </div>
  );
}

function GeoFileBlock({ title, filename, instruction, content }: {
  title: string; filename: string; instruction: string; content: string;
}) {
  return (
    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, color: "#111827" }}>{title}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, fontFamily: "monospace" }}>{filename}</div>
        </div>
        <CopyButton text={content} />
      </div>
      <div style={{ background: "#0d1117", padding: "16px", overflowX: "auto" }}>
        <pre style={{ fontSize: 12, color: "#e6edf3", fontFamily: "monospace", lineHeight: 1.65, whiteSpace: "pre", margin: 0 }}>
          {content}
        </pre>
      </div>
      <div style={{ padding: "10px 16px", background: "#f9fafb", borderTop: "0.5px solid #e5e7eb" }}>
        <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{instruction}</p>
      </div>
    </div>
  );
}

function generateLlmsTxt(brandName: string, domain: string, description: string, socialLinks: string[], contactEmail: string | null): string {
  const socialBlock = socialLinks.length > 0
    ? `\n## Social Profiles\n${socialLinks.map((l) => `- ${l}`).join("\n")}`
    : "";
  const contactBlock = contactEmail
    ? `\n## Contact\n${contactEmail}`
    : "";
  return `# ${brandName}
> ${description || `${brandName} official website`}

## About
${brandName} is available at ${domain}.

## Key Pages
- [Homepage](https://${domain}/): Main page
- [About](https://${domain}/about): About us
- [Blog](https://${domain}/blog): Articles and updates${socialBlock}${contactBlock}

## Sitemap
https://${domain}/sitemap.xml`;
}

function generateRobotsTxtAdditions(): string {
  return `# AI Crawler Access (GEO-optimized)
# Add these lines to your robots.txt

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: GoogleBot-Extended
Allow: /`;
}

function generateSchemaJson(brandName: string, domain: string, description: string, socialLinks: string[], contactEmail: string | null): string {
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": brandName,
    "url": `https://${domain}`,
    "description": description || `${brandName} - official website`,
    "logo": `https://${domain}/logo.png`,
  };
  if (socialLinks.length > 0) obj["sameAs"] = socialLinks;
  if (contactEmail) {
    obj["contactPoint"] = {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "email": contactEmail,
    };
  }
  return JSON.stringify(obj, null, 2);
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

  const tech = auditResult?.technicalAudit ?? null;
  const hasTechnicalData = tech && Array.isArray(tech.checks) && tech.checks.length > 0;
  const brandName = auditResult?.brandName ?? auditResult?.domain ?? "";
  const domain = auditResult?.domain ?? "";
  const description = tech?.brandDescription ?? "";
  const socialLinks: string[] = tech?.socialLinks ?? [];
  const contactEmail: string | null = tech?.contactEmail ?? null;

  const aiVisibilityScore = auditResult?.scoreAiVisibility ?? Math.min((auditResult?.scoreChatgpt ?? 0) + (auditResult?.scoreGemini ?? 0) + (auditResult?.scorePerplexity ?? 0), 100);
  const scoreTechnical = hasTechnicalData ? (auditResult?.scoreTechnical ?? tech?.overallScore ?? 0) : null;
  const aiContribution = hasTechnicalData ? Math.round(aiVisibilityScore * 0.6) : null;
  const techContribution = hasTechnicalData ? Math.round((scoreTechnical ?? 0) * 0.4) : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f9fafb" }}>
      <style>{FINGER_TAP_CSS}</style>
      <Navbar />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px" }}>

        {/* Loading state */}
        {runAuditMutation.isPending && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40, width: "100%", maxWidth: 440 }}>
            <div style={{ position: "relative", marginBottom: 32, userSelect: "none" }}>
              <img
                src="/fingers-tapping.jpeg"
                alt="Scanning..."
                className="finger-drum-anim"
                style={{ width: 200, height: "auto", display: "block", filter: "grayscale(0.1) contrast(1.05)" }}
              />
              <div
                className="tap-shadow-anim"
                style={{
                  position: "absolute", bottom: -8, left: "50%",
                  transform: "translateX(-50%)", width: 160, height: 12,
                  borderRadius: "50%",
                  background: "radial-gradient(ellipse, rgba(0,0,0,0.25) 0%, transparent 70%)",
                }}
              />
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#111827", textAlign: "center", marginBottom: 6 }}>
              Hang tight...
            </div>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32, textAlign: "center", lineHeight: 1.5 }}>
              Scanning <strong style={{ color: "#374151" }}>{urlParam}</strong> across<br />
              ChatGPT, Gemini, Perplexity, Claude &amp; Grok
            </p>
            <div style={{ width: "100%", marginBottom: 28 }}>
              {LOADING_STEPS.map((label, i) => {
                const isDone = doneSteps[i];
                const isCurrent = loadingStep === i && !isDone;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", opacity: i > loadingStep ? 0.3 : 1, transition: "opacity 0.4s" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isDone ? "#10b981" : isCurrent ? "#4F46E5" : "#e5e7eb", transition: "background 0.35s" }}>
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
            <div style={{ width: "100%", height: 6, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg, #4F46E5, #7C3AED)", borderRadius: 4, width: `${progress}%`, transition: "width 1.6s ease" }} />
            </div>
          </div>
        )}

        {/* Error state */}
        {runAuditMutation.isError && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <XCircle style={{ width: 48, height: 48, color: "#ef4444", margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Audit Failed</h2>
            <p style={{ color: "#6b7280", marginBottom: 24 }}>We could not analyze {urlParam}. Please try again.</p>
            <Button onClick={() => runAuditMutation.mutate({ data: { url: urlParam! } })}>Try Again</Button>
          </div>
        )}

        {/* Results */}
        {auditResult && !runAuditMutation.isPending && (
          <div className="audit-result-anim" style={{ width: "100%", maxWidth: 700 }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 18, color: "#111827" }}>{auditResult.domain}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  AI visibility audit, just now, {auditResult.category ?? "saas tool"}, {auditResult.market ?? "India"}
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
                {hasTechnicalData && (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, textAlign: "right" }}>
                    <span style={{ color: "#4F46E5" }}>AI Visibility: {aiContribution}/60</span>
                    <span style={{ color: "#9ca3af", margin: "0 4px" }}>+</span>
                    <span style={{ color: "#7C3AED" }}>Technical: {techContribution}/40</span>
                  </div>
                )}
              </div>
            </div>

            {/* Score Bar */}
            <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
              {hasTechnicalData ? (
                <div style={{ height: "100%", display: "flex", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${aiContribution}%`, background: "#4F46E5", transition: "width 0.8s ease" }} />
                  <div style={{ width: `${techContribution}%`, background: "#7C3AED", transition: "width 0.8s ease" }} />
                </div>
              ) : (
                <div style={{ height: "100%", width: `${auditResult.scoreTotal}%`, background: getScoreColor(auditResult.scoreTotal), borderRadius: 4, transition: "width 0.8s ease" }} />
              )}
            </div>
            {hasTechnicalData ? (
              <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
                  <span style={{ width: 8, height: 8, background: "#4F46E5", borderRadius: 2, flexShrink: 0 }} />
                  AI Visibility ({aiContribution}/60)
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
                  <span style={{ width: 8, height: 8, background: "#7C3AED", borderRadius: 2, flexShrink: 0 }} />
                  Technical GEO ({techContribution}/40)
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 20 }} />
            )}

            {/* 3 Summary Cards */}
            {(() => {
              const allFound = [auditResult.chatgptFound, auditResult.geminiFound, auditResult.perplexityFound, auditResult.claudeFound ?? false, auditResult.grokFound ?? false];
              const foundCount = allFound.filter(Boolean).length;
              const blindSpots = allFound.filter(f => !f).length;
              const bestEngine = auditResult.chatgptFound ? "ChatGPT" : auditResult.geminiFound ? "Gemini" : auditResult.perplexityFound ? "Perplexity" : auditResult.claudeFound ? "Claude" : auditResult.grokFound ? "Grok" : null;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28 }}>
                  {[
                    { label: `${foundCount}/5 AI engines found you` },
                    { label: bestEngine ? `Visible on ${bestEngine}` : "Not ranked anywhere" },
                    { label: `${blindSpots} blind spot${blindSpots !== 1 ? "s" : ""} found` },
                  ].map((card, i) => (
                    <div key={i} style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#374151", fontWeight: 500, textAlign: "center" }}>
                      {card.label}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Section 01: AI Visibility */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  01 - Brand Recognition by AI Engine
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  5 engines checked
                </div>
              </div>
              <SystemCard system="ChatGPT" found={auditResult.chatgptFound} score={auditResult.scoreChatgpt} detail={auditResult.chatgptDetail} rawResponse={auditResult.chatgptRawResponse} checkedAt={auditResult.createdAt} />
              <SystemCard system="Gemini" found={auditResult.geminiFound} score={auditResult.scoreGemini} detail={auditResult.geminiDetail} rawResponse={auditResult.geminiRawResponse} checkedAt={auditResult.createdAt} />
              <SystemCard system="Perplexity" found={auditResult.perplexityFound} score={auditResult.scorePerplexity} detail={auditResult.perplexityDetail} rawResponse={auditResult.perplexityRawResponse} checkedAt={auditResult.createdAt} />
              <SystemCard system="Claude" found={auditResult.claudeFound ?? false} score={auditResult.scoreClaude ?? 0} detail={auditResult.claudeDetail} rawResponse={auditResult.claudeRawResponse} checkedAt={auditResult.createdAt} simulated />
              <SystemCard system="Grok" found={auditResult.grokFound ?? false} score={auditResult.scoreGrok ?? 0} detail={auditResult.grokDetail} rawResponse={auditResult.grokRawResponse} checkedAt={auditResult.createdAt} simulated />
            </div>

            {/* Section 02: Technical GEO Audit */}
            {tech && tech.checks && tech.checks.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                  02 - Technical GEO Audit
                </div>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
                  These technical signals directly affect how AI engines crawl and understand your brand.
                </p>
                {tech.checks.map((check: any) => (
                  <TechCheckCard key={check.id} check={check} />
                ))}
                <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Technical GEO Score</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: getScoreColor(tech.overallScore) }}>{tech.overallScore}/100</span>
                </div>
              </div>
            )}

            {/* Section 03: Free GEO Files */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                03 - Free GEO Files for Your Site
              </div>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
                Download and add these files to immediately improve your technical GEO score.
              </p>
              <GeoFileBlock
                title="llms.txt"
                filename={`Save as llms.txt and upload to ${domain}/llms.txt`}
                instruction={`Upload this file to your web root at https://${domain}/llms.txt — it tells AI systems about your brand directly.`}
                content={generateLlmsTxt(brandName, domain, description, socialLinks, contactEmail)}
              />
              <GeoFileBlock
                title="robots.txt additions"
                filename="Add these lines to your existing robots.txt"
                instruction="Open your robots.txt file and paste these lines at the end. This explicitly allows all major AI crawlers to index your site."
                content={generateRobotsTxtAdditions()}
              />
              <GeoFileBlock
                title="Schema markup (JSON-LD)"
                filename={`Add inside a <script type="application/ld+json"> tag in your homepage <head>`}
                instruction={`Paste this block inside your homepage's <head> section inside a <script type="application/ld+json"> tag. It helps AI engines identify your brand entity.`}
                content={generateSchemaJson(brandName, domain, description, socialLinks, contactEmail)}
              />
            </div>

            {/* Section 04: Boost */}
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
                  Unlock full GEO IQ report, Rs 3,999/mo
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
                    {subscribeMutation.isPending ? "Sending..." : "Send me the free report"}
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
                Check another domain
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
