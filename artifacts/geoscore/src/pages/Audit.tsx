import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRunAudit, useEmailSubscribe, useGetMe } from "@workspace/api-client-react";
import { useQuery } from "@/hooks/use-query";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, ExternalLink, ChevronDown, ChevronUp, Copy, Check, AlertTriangle, Info } from "lucide-react";

const emailSchema = z.object({
  email: z.string().email("Valid email required"),
});

const LOADING_STEPS = [
  { label: "Fetching & crawling your domain",        signals: 4,  issues: 2 },
  { label: "Detecting brand category & market",      signals: 6,  issues: 3 },
  { label: "Running ChatGPT visibility prompts",     signals: 8,  issues: 5 },
  { label: "Running Gemini & Perplexity prompts",    signals: 8,  issues: 6 },
  { label: "Scoring technical GEO signals",          signals: 12, issues: 8 },
  { label: "Building your fix roadmap",              signals: 9,  issues: 6 },
];

const TOTAL_SIGNALS = LOADING_STEPS.reduce((s, st) => s + st.signals, 0);

const LOADING_CSS = `
@keyframes audit-fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.audit-result-anim {
  animation: audit-fade-in 0.45s ease forwards;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.audit-sidebar { display: block; }
@media (max-width: 900px) { .audit-sidebar { display: none; } }
`;

function AuditLoadingCard({
  loadingStep,
  doneSteps,
  elapsedSeconds,
  url,
}: {
  loadingStep: number;
  doneSteps: boolean[];
  elapsedSeconds: number;
  url: string;
}) {
  const progress = Math.round(
    ((loadingStep + (doneSteps[loadingStep] ? 1 : 0)) / LOADING_STEPS.length) * 100
  );
  const signalsChecked = LOADING_STEPS.reduce((sum, step, i) => {
    if (doneSteps[i]) return sum + step.signals;
    if (i === loadingStep) return sum + Math.floor(step.signals * 0.5);
    return sum;
  }, 0);
  const issuesFound = LOADING_STEPS.reduce(
    (sum, step, i) => (doneSteps[i] ? sum + step.issues : sum),
    0
  );
  const aiSystemsChecked = doneSteps[5] ? 6 : doneSteps[4] ? 5 : doneSteps[3] ? 3 : doneSteps[2] ? 1 : 0;

  return (
    <div style={{
      width: "100%", maxWidth: 480,
      background: "#fff",
      borderRadius: 12,
      border: "1px solid #E5E7EB",
      borderLeft: "4px solid #5B3FEA",
      boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      padding: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#9CA3AF" }}>
          Live Readout
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#6B7280" }}>
          {elapsedSeconds}s elapsed
        </span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "75%" }}>
            {url}
          </span>
          <span style={{ fontSize: 12, color: "#5B3FEA", fontWeight: 600 }}>{progress}%</span>
        </div>
        <div style={{ height: 6, background: "#EDE9FE", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", background: "linear-gradient(90deg, #5B3FEA, #7C3AED)", borderRadius: 4, width: `${progress}%`, transition: "width 1.6s ease" }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F9FAFB", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: "#6B7280" }}>
          <strong style={{ color: "#111827" }}>{signalsChecked}</strong> / {TOTAL_SIGNALS} signals checked
        </span>
        <span style={{ fontSize: 28, fontWeight: 800, color: "#5B3FEA", lineHeight: 1 }}>
          {progress}%
        </span>
      </div>

      <div style={{ marginBottom: 20 }}>
        {LOADING_STEPS.map((step, i) => {
          const isDone = doneSteps[i];
          const isCurrent = loadingStep === i && !isDone;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 0",
              opacity: i > loadingStep ? 0.35 : 1,
              transition: "opacity 0.4s",
              borderBottom: i < LOADING_STEPS.length - 1 ? "1px solid #F3F4F6" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isDone ? "#10b981" : isCurrent ? "#5B3FEA" : "#E5E7EB", transition: "background 0.35s" }}>
                  {isDone
                    ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    : isCurrent
                      ? <Loader2 style={{ width: 11, height: 11, color: "white", animation: "spin 1s linear infinite" }} />
                      : null}
                </div>
                <span style={{ fontSize: 13, color: isDone ? "#111827" : isCurrent ? "#5B3FEA" : "#9CA3AF", fontWeight: isCurrent ? 500 : 400 }}>
                  {step.label}
                </span>
              </div>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: isDone ? "#10b981" : isCurrent ? "#5B3FEA" : "#D1D5DB", fontWeight: 500, whiteSpace: "nowrap" as const, marginLeft: 8 }}>
                {step.signals} sig
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "12px 14px", textAlign: "center" as const }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{aiSystemsChecked}</div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#9CA3AF", marginTop: 4 }}>AI Systems Checked</div>
        </div>
        <div style={{ background: "#EDE9FE", borderRadius: 8, padding: "12px 14px", textAlign: "center" as const }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#5B3FEA", lineHeight: 1 }}>{issuesFound}</div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#9CA3AF", marginTop: 4 }}>Issues Found</div>
        </div>
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score < 34) return "#ef4444";
  if (score < 67) return "#f59e0b";
  return "#10b981";
}

// isLiveWeb=true means Perplexity (real-time web search), false means training-data engines
function getUnderstandingLabel(score: number, isLiveWeb = false): { label: string; color: string; bg: string } {
  if (score >= 25) return { label: "Strong understanding", color: "#059669", bg: "#ecfdf5" };
  if (score >= 10) return { label: "Partial understanding", color: "#D97706", bg: "#fffbeb" };
  if (score >= 1)  return { label: "Mentioned briefly", color: "#D97706", bg: "#fffbeb" };
  if (isLiveWeb)   return { label: "Not found on web", color: "#DC2626", bg: "#fef2f2" };
  return { label: "Not in training data", color: "#F97316", bg: "#fff7ed" };
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

function AiExplainerBox({ aiMemoryScore, liveWebScore }: { aiMemoryScore: number; liveWebScore: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#f0f4ff", border: "0.5px solid #c7d2fe", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Info style={{ width: 14, height: 14, color: "#5B3FEA", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#5B3FEA" }}>How AI systems see your brand</span>
        </div>
        {open ? <ChevronUp style={{ width: 13, height: 13, color: "#6366f1" }} /> : <ChevronDown style={{ width: 13, height: 13, color: "#6366f1" }} />}
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid #c7d2fe" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, marginBottom: 12 }}>
            <div style={{ background: "white", border: "0.5px solid #c7d2fe", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#5B3FEA", marginBottom: 4 }}>AI Memory Score: {aiMemoryScore}/50</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 4 }}>ChatGPT + Gemini</div>
              <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
                These answer from training data, like a snapshot of the internet taken in 2023-2024. If your brand is newer than that, or lacks citations in sources they were trained on, they won't know you exist yet.
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>To improve: Crunchbase, Product Hunt, press coverage, Reddit. Takes 3-6 months.</div>
            </div>
            <div style={{ background: "white", border: "0.5px solid #c7d2fe", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9333ea", marginBottom: 4 }}>Live Web Score: {liveWebScore}/50</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 4 }}>Perplexity</div>
              <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
                Perplexity searches the live web in real time. It can find you right now if you have sufficient web presence and your site is indexable. Score 0 here means fix your web presence first.
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>To improve: fix technical issues, add content, get web mentions. Impact within days.</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#5B3FEA", fontWeight: 500 }}>
            Two different problems, two different timelines. Your roadmap below covers both.
          </div>
        </div>
      )}
    </div>
  );
}

function SystemCard({
  system, found, score, detail, rawResponse, checkedAt, simulated, isLiveWeb,
}: {
  system: string; found: boolean; score: number; detail?: string | null;
  rawResponse?: string | null; checkedAt: string; simulated?: boolean; isLiveWeb?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const understanding = getUnderstandingLabel(score, isLiveWeb);
  const scaledScore = Math.round((score / 33) * 100);
  const cfg = ENGINE_CONFIG[system] ?? { color: "#5B3FEA", barColor: "linear-gradient(90deg,#5B3FEA,#7C3AED)", label: `${system} says:` };

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
            : isLiveWeb
              ? "Not found when Perplexity searched the live web for your category"
              : "Not in training data - not yet cited in sources AI systems learn from"}
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

function getVerdict(score: number): { label: string; color: string; bg: string } {
  if (score <= 20) return { label: "INVISIBLE", color: "#DC2626", bg: "#FEF2F2" };
  if (score <= 40) return { label: "WEAK", color: "#EA580C", bg: "#FFF7ED" };
  if (score <= 60) return { label: "AVERAGE", color: "#CA8A04", bg: "#FEFCE8" };
  if (score <= 80) return { label: "GOOD", color: "#2563EB", bg: "#EFF6FF" };
  return { label: "STRONG", color: "#16A34A", bg: "#F0FDF4" };
}

function LockedSection({ title, linkText = "See plans →", children }: { title: string; linkText?: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", marginBottom: 28 }}>
      <div style={{ filter: "blur(4px)", pointerEvents: "none", userSelect: "none" as const }}>
        {children}
      </div>
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(249,250,251,0.7)",
        display: "flex", flexDirection: "column" as const,
        alignItems: "center", justifyContent: "center",
        gap: 10, borderRadius: 12,
      }}>
        <div style={{ background: "#5B3FEA", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", textAlign: "center" as const, maxWidth: 280 }}>{title}</div>
        <a href="/pricing" style={{ fontSize: 12, fontWeight: 600, color: "#5B3FEA", textDecoration: "none" }}>{linkText}</a>
      </div>
    </div>
  );
}

function LockWall({ remaining, domain }: { remaining: number; domain: string }) {
  return (
    <div style={{ background: "#0F0F14", borderRadius: 12, padding: "32px 24px", textAlign: "center", marginTop: 8, marginBottom: 28 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(79,70,229,0.15)", border: "1px solid rgba(79,70,229,0.3)", borderRadius: 99, padding: "5px 16px", marginBottom: 20 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#818CF8", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
          {remaining} more fixes locked
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "white", marginBottom: 10 }}>
        {remaining} more fixes locked
      </div>
      <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.7, maxWidth: 360, margin: "0 auto 6px" }}>
        Your audit found {remaining + 1} total fixes. Unlock all ranked by score impact.
      </div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 24 }}>
        Most brands reach 50+ GEO IQ in 30 days
      </div>
      <a href="/pricing" style={{ display: "inline-block", background: "#5B3FEA", color: "white", borderRadius: 8, padding: "13px 32px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
        Unlock full report - $69/mo
      </a>
      <div style={{ fontSize: 11, color: "#64748B", marginTop: 12 }}>7-day free trial · cancel anytime</div>
    </div>
  );
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });
}

function UpgradeBox({ domain }: { domain: string }) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [paidEmail, setPaidEmail] = useState("");
  const { toast } = useToast();

  const handlePay = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) { setEmailError("Enter a valid email"); return; }
    setEmailError("");
    setLoading(true);
    try {
      await loadRazorpay();
      const subRes = await fetch("/api/payment/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "starter", email: trimmed, domain }),
      });
      if (!subRes.ok) {
        const err = await subRes.json() as { error?: string };
        toast({ title: "Could not create subscription", description: err.error ?? "Try again.", variant: "destructive" });
        setLoading(false);
        return;
      }
      const sub = await subRes.json() as { subscription_id: string; razorpay_key: string; plan_name: string };
      new window.Razorpay({
        key: sub.razorpay_key,
        subscription_id: sub.subscription_id,
        name: "GeoIQ",
        description: sub.plan_name,
        theme: { color: "#5B3FEA" },
        prefill: { email: trimmed },
        handler: async (r: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          const v = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ razorpay_payment_id: r.razorpay_payment_id, razorpay_subscription_id: r.razorpay_subscription_id, razorpay_signature: r.razorpay_signature, email: trimmed, plan: "starter", domain }),
          });
          if (v.ok) { setPaidEmail(trimmed); setDone(true); }
          else { toast({ title: "Verification failed", description: "Email hello@geoiqai.com if payment was deducted.", variant: "destructive" }); }
          setLoading(false);
        },
        modal: { ondismiss: () => setLoading(false) },
      }).open();
    } catch {
      toast({ title: "Error", description: "Could not start payment. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  }, [email, domain, toast]);

  if (done) {
    return (
      <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 12, padding: "24px", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#065f46", marginBottom: 8 }}>You are in.</div>
        <p style={{ fontSize: 13, color: "#047857", lineHeight: 1.6 }}>
          Login link sent to <strong>{paidEmail}</strong>. Click it to access your full roadmap.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "#0f172a", border: "1px solid #5B3FEA", borderRadius: 12, padding: "24px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: "white", marginBottom: 8 }}>
        Unlock your complete execution roadmap
      </div>
      <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.6, maxWidth: 460, margin: "0 auto 8px" }}>
        Get exact tasks, direct URLs, generated content and keyword suggestions for all 4 weeks.
        Most brands reach 50+ GEO IQ in 30 days.
      </div>
      <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 4 }}>$69/mo - 7-day free trial, cancel anytime</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 20 }}>Billed as ₹6,679/mo via Razorpay</div>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{ background: "#5B3FEA", color: "white", border: "none", borderRadius: 8, padding: "12px 32px", fontSize: 15, fontWeight: 600, cursor: "pointer", width: "100%", maxWidth: 400 }}
        >
          Unlock full roadmap - $69/mo
        </button>
      ) : (
        <div style={{ maxWidth: 400, margin: "0 auto" }}>
          <input
            type="email"
            placeholder="founder@startup.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { void handlePay(); } }}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "white", fontSize: 14, marginBottom: 6, boxSizing: "border-box" }}
            autoFocus
          />
          {emailError && <p style={{ color: "#f87171", fontSize: 12, marginBottom: 8, textAlign: "left" }}>{emailError}</p>}
          <button
            onClick={() => { void handlePay(); }}
            disabled={loading}
            style={{ width: "100%", background: "#5B3FEA", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {loading
              ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Opening payment...</>
              : "Pay ₹6,679/mo"}
          </button>
          <p style={{ fontSize: 11, color: "#4b5563", marginTop: 8 }}>Secured by Razorpay. Cancel anytime.</p>
        </div>
      )}
    </div>
  );
}

interface EntityDescriptions {
  titleTag: string | null;
  metaDescription: string | null;
  llmsTxtDescription: string | null;
  schemaDescription: string | null;
  fragmentationDetected: boolean;
}

interface TechCheck {
  id: string;
  name: string;
  score: number;
  status: string;
  detail: string;
  entityDescriptions?: EntityDescriptions;
}

function TechCheckCard({ check, hideDetail = false }: { check: TechCheck; hideDetail?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = {
    pass: { icon: <CheckCircle2 style={{ width: 16, height: 16, color: "#059669" }} />, badgeBg: "#dcfce7", badgeColor: "#15803d", label: "Pass" },
    warn: { icon: <AlertTriangle style={{ width: 16, height: 16, color: "#D97706" }} />, badgeBg: "#fef9c3", badgeColor: "#854d0e", label: "Warn" },
    fail: { icon: <XCircle style={{ width: 16, height: 16, color: "#DC2626" }} />, badgeBg: "#fee2e2", badgeColor: "#991b1b", label: "Fail" },
  };
  const cfg = statusConfig[check.status as "pass" | "warn" | "fail"] ?? statusConfig.fail;
  const ed = check.entityDescriptions;
  const hasDescriptions = ed && (ed.titleTag || ed.metaDescription || ed.llmsTxtDescription || ed.schemaDescription);

  const descRows: { label: string; value: string | null }[] = ed ? [
    { label: "Homepage title", value: ed.titleTag },
    { label: "Meta description", value: ed.metaDescription },
    { label: "llms.txt description", value: ed.llmsTxtDescription },
    { label: "Schema description", value: ed.schemaDescription },
  ] : [];

  return (
    <div style={{
      background: "white", border: "0.5px solid #e5e7eb",
      borderLeft: `3px solid ${check.status === "pass" ? "#10b981" : check.status === "warn" ? "#f59e0b" : "#ef4444"}`,
      borderRadius: 10, marginBottom: 10, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {cfg.icon}
            <span style={{ fontWeight: 500, fontSize: 14, color: "#111827" }}>{check.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: check.score >= 70 ? "#059669" : check.score >= 40 ? "#D97706" : "#DC2626" }}>
              {check.score}/100
            </span>
            <span style={{ background: cfg.badgeBg, color: cfg.badgeColor, borderRadius: 9999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
              {cfg.label}
            </span>
            {!hideDetail && check.id === "entity" && hasDescriptions && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 2, display: "flex", alignItems: "center" }}
              >
                {expanded ? <ChevronUp style={{ width: 15, height: 15 }} /> : <ChevronDown style={{ width: 15, height: 15 }} />}
              </button>
            )}
          </div>
        </div>
        {!hideDetail && <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{check.detail}</p>}
      </div>

      {!hideDetail && check.id === "entity" && expanded && ed && (
        <div style={{ borderTop: "0.5px solid #f3f4f6", padding: "14px 16px 16px" }}>
          <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: "0 0 14px", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "10px 12px" }}>
            AI systems consolidate your brand into a single entity node. Inconsistent descriptions across platforms fragment this signal and reduce citation confidence.
          </p>

          {ed.fragmentationDetected && hasDescriptions && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fffbeb", border: "0.5px solid #fde68a", borderRadius: 7, padding: "8px 12px", marginBottom: 14 }}>
              <AlertTriangle style={{ width: 14, height: 14, color: "#D97706", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>Entity fragmentation detected - descriptions vary significantly across sources</span>
            </div>
          )}
          {!ed.fragmentationDetected && hasDescriptions && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ecfdf5", border: "0.5px solid #6ee7b7", borderRadius: 7, padding: "8px 12px", marginBottom: 14 }}>
              <CheckCircle2 style={{ width: 14, height: 14, color: "#059669", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#15803d" }}>Descriptions are consistent across sources</span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {descRows.map((row) => (
              <div key={row.label} style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "#9ca3af", marginBottom: 6 }}>{row.label}</div>
                {row.value
                  ? <p style={{ fontSize: 12, color: "#111827", lineHeight: 1.55, margin: 0 }}>{row.value}</p>
                  : <p style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic", margin: 0 }}>Not found</p>
                }
              </div>
            ))}
          </div>
        </div>
      )}
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

  const meQuery = useGetMe();
  const isPaidUser = (meQuery.data as any)?.plan && (meQuery.data as any).plan !== "free";

  // Guard against the effect firing multiple times for the same URL
  // (can happen due to React re-renders or route remounts)
  const firedForUrlRef = useRef<string | null>(null);

  const [auditResult, setAuditResult] = useState<any>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<boolean[]>(LOADING_STEPS.map(() => false));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [auditError, setAuditError] = useState<{
    type: "ip_limit" | "email_limit" | "generic";
    message?: string;
    resetsAt?: string;
  } | null>(null);
  const [subscriberEmail, setSubscriberEmail] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [siteHealth, setSiteHealth] = useState<{
    ttfbMs: number;
    isHttps: boolean;
    security: { hsts: boolean; clickjacking: boolean; mimeSniffing: boolean; referrerPolicy: boolean; score: number; total: number };
    techStack: { cms: string | null; framework: string | null; cdn: string | null; analytics: string[]; server: string | null };
  } | null>(null);
  const [siteHealthLoading, setSiteHealthLoading] = useState(false);

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const handleAuditError = (err: unknown) => {
    const status = (err as any)?.status ?? (err as any)?.response?.status;
    const body = (err as any)?.body ?? (err as any)?.data ?? {};
    if (status === 429) {
      if (body?.rateLimitType === "email") {
        setAuditError({ type: "email_limit", message: body.error, resetsAt: body.resetsAt });
      } else {
        setAuditError({ type: "ip_limit", message: body.error });
      }
      return;
    }
    setAuditError({ type: "generic" });
  };

  const retryWithEmail = async (email: string) => {
    setRetrying(true);
    setAuditError(null);
    setLoadingStep(0);
    setDoneSteps(LOADING_STEPS.map(() => false));
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Subscriber-Email": email,
        },
        body: JSON.stringify({ url: urlParam }),
      });
      const data = await res.json();
      if (!res.ok) {
        handleAuditError({ status: res.status, body: data });
        return;
      }
      setAuditResult(data);
    } catch {
      setAuditError({ type: "generic" });
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (!urlParam) { setLocation("/"); return; }
    // Prevent firing twice for the same URL during re-renders or strict-mode double-invoke
    if (firedForUrlRef.current === urlParam) return;
    firedForUrlRef.current = urlParam;
    setAuditResult(null);
    setAuditError(null);
    setLoadingStep(0);
    setDoneSteps(LOADING_STEPS.map(() => false));
    runAuditMutation.mutate(
      { data: { url: urlParam } },
      {
        onSuccess: (data) => { setAuditError(null); setAuditResult(data); },
        onError: handleAuditError,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParam]);

  // Fetch quick site health after audit result arrives
  useEffect(() => {
    if (!auditResult?.domain) return;
    setSiteHealth(null);
    setSiteHealthLoading(true);
    fetch("/api/onpage/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: auditResult.domain }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSiteHealth(data); })
      .catch(() => {})
      .finally(() => setSiteHealthLoading(false));
  }, [auditResult?.domain]);


  useEffect(() => {
    const isActive = runAuditMutation.isPending || retrying || refreshing;
    if (!isActive) return;
    let step = 0;
    const interval = setInterval(() => {
      if (step < LOADING_STEPS.length - 1) {
        setDoneSteps((prev) => { const n = [...prev]; n[step] = true; return n; });
        step++;
        setLoadingStep(step);
      }
    }, 1800);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runAuditMutation.isPending, retrying, refreshing]);

  useEffect(() => {
    const isActive = runAuditMutation.isPending || retrying || refreshing;
    if (!isActive) { setElapsedSeconds(0); return; }
    setElapsedSeconds(0);
    const timer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runAuditMutation.isPending, retrying, refreshing]);

  const runFreshAudit = async () => {
    if (!urlParam) return;
    setRefreshing(true);
    setAuditResult(null);
    setAuditError(null);
    setLoadingStep(0);
    setDoneSteps(LOADING_STEPS.map(() => false));
    const token = localStorage.getItem("geoscore_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (subscriberEmail) headers["X-Subscriber-Email"] = subscriberEmail;
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: urlParam, force: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        handleAuditError({ status: res.status, body: data });
        return;
      }
      setAuditResult(data);
    } catch {
      setAuditError({ type: "generic" });
    } finally {
      setRefreshing(false);
    }
  };

  const onSubscribeAndRetry = (values: z.infer<typeof emailSchema>) => {
    const email = values.email;
    subscribeMutation.mutate(
      { data: { email, domain: auditResult?.domain ?? new URL(urlParam!.startsWith("http") ? urlParam! : `https://${urlParam!}`).hostname, auditId: auditResult?.id } },
      {
        onSuccess: () => {
          setSubscriberEmail(email);
          emailForm.reset();
          retryWithEmail(email);
        },
        onError: () => {
          // Might already be subscribed - try the retry anyway
          setSubscriberEmail(email);
          emailForm.reset();
          retryWithEmail(email);
        },
      },
    );
  };

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

  // Split score: AI Memory (ChatGPT + Gemini) vs Live Web (Perplexity), each /50
  const aiMemoryScore = Math.round(
    ((auditResult?.scoreChatgpt ?? 0) + (auditResult?.scoreGemini ?? 0)) / 66 * 50
  );
  const liveWebScore = Math.round((auditResult?.scorePerplexity ?? 0) / 33 * 50);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F2F0EB" }}>
      <style>{LOADING_CSS}</style>
      <Navbar />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px" }}>

        {/* Loading state */}
        {runAuditMutation.isPending && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 48, width: "100%" }}>
            <AuditLoadingCard loadingStep={loadingStep} doneSteps={doneSteps} elapsedSeconds={elapsedSeconds} url={urlParam ?? ""} />
          </div>
        )}

        {/* Refreshing state - force fresh audit */}
        {refreshing && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 48, width: "100%" }}>
            <AuditLoadingCard loadingStep={loadingStep} doneSteps={doneSteps} elapsedSeconds={elapsedSeconds} url={urlParam ?? ""} />
          </div>
        )}

        {/* Retrying with email state */}
        {retrying && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 48, width: "100%" }}>
            <AuditLoadingCard loadingStep={loadingStep} doneSteps={doneSteps} elapsedSeconds={elapsedSeconds} url={urlParam ?? ""} />
          </div>
        )}

        {/* Error state */}
        {auditError && !retrying && (
          <div style={{ textAlign: "center", paddingTop: 80, maxWidth: 440, margin: "0 auto", width: "100%" }}>
            {auditError.type === "ip_limit" ? (
              <>
                <div style={{ width: 56, height: 56, background: "#eff6ff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <AlertTriangle style={{ width: 28, height: 28, color: "#3b82f6" }} />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>You have used your 2 free audits today</h2>
                <p style={{ color: "#6b7280", marginBottom: 24, lineHeight: 1.6 }}>
                  Enter your email to unlock 5 audits per month free. No password, no card.
                </p>
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(onSubscribeAndRetry)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <FormField
                      control={emailForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="founder@startup.com"
                              style={{ textAlign: "left" }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={subscribeMutation.isPending} style={{ background: "#5B3FEA", color: "white" }}>
                      {subscribeMutation.isPending ? "Sending..." : "Get my audit results"}
                    </Button>
                  </form>
                </Form>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 16 }}>
                  No spam. Unsubscribe any time.
                </p>
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #f3f4f6" }}>
                  <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Want unlimited audits and daily monitoring?</p>
                  <Button variant="outline" size="sm" onClick={() => setLocation("/pricing")} style={{ borderColor: "#5B3FEA", color: "#5B3FEA" }}>
                    See pricing
                  </Button>
                </div>
              </>
            ) : auditError.type === "email_limit" ? (
              <>
                <div style={{ width: 56, height: 56, background: "#fef3c7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <AlertTriangle style={{ width: 28, height: 28, color: "#d97706" }} />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>You have used all 5 free audits this month</h2>
                <p style={{ color: "#6b7280", marginBottom: 8, lineHeight: 1.6 }}>
                  {auditError.message ?? "Your free audits reset at the start of next month."}
                </p>
                {auditError.resetsAt && (
                  <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>
                    Resets on {new Date(auditError.resetsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
                  </p>
                )}
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <Button onClick={() => setLocation("/pricing")} style={{ background: "#5B3FEA", color: "white" }}>
                    Upgrade for $69/mo
                  </Button>
                  <Button variant="outline" onClick={() => setLocation("/")}>
                    Back to home
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: 56, height: 56, background: "#fee2e2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <XCircle style={{ width: 28, height: 28, color: "#ef4444" }} />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Audit failed</h2>
                <p style={{ color: "#6b7280", marginBottom: 24 }}>Could not analyze {urlParam}. Please try again.</p>
                <Button onClick={() => { setAuditError(null); runAuditMutation.mutate({ data: { url: urlParam! } }); }}>
                  Try again
                </Button>
              </>
            )}
          </div>
        )}

        {/* Results */}
        {auditResult && !runAuditMutation.isPending && !refreshing && !retrying && (
          <div className="audit-result-anim" style={{ width: "100%", maxWidth: isPaidUser ? 720 : 1020, display: "flex", gap: 28, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, maxWidth: 700 }}>

            {/* Cache age banner - show for ANY cached result so users who just fixed their site know to refresh */}
            {auditResult.fromCache && auditResult.cachedHoursAgo < 24 && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#92400e" }}>
                  {auditResult.cachedHoursAgo === 0
                    ? "These results were cached recently. If you just made changes to your site, run a fresh audit to see your updated score."
                    : `These results are from ${auditResult.cachedHoursAgo} hour${auditResult.cachedHoursAgo !== 1 ? "s" : ""} ago. Fixed your issues? Run a fresh audit to see your updated score.`
                  }
                </span>
                <button onClick={runFreshAudit} style={{ fontSize: 12, color: "#5B3FEA", border: "1px solid #5B3FEA", background: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500 }}>
                  Run fresh audit
                </button>
              </div>
            )}
            {auditResult.fromCache && auditResult.cachedHoursAgo >= 24 && (
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#1e40af" }}>
                  Last checked {auditResult.cachedHoursAgo} hours ago. Made changes to your site? Run a fresh audit.
                </span>
                <button onClick={runFreshAudit} style={{ fontSize: 12, color: "#5B3FEA", border: "1px solid #5B3FEA", background: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500 }}>
                  Run now
                </button>
              </div>
            )}

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 18, color: "#111827" }}>{auditResult.domain}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {auditResult.fromCache && auditResult.cachedHoursAgo != null
                    ? <>
                        AI visibility audit, {auditResult.cachedHoursAgo === 0 ? "just now" : `${auditResult.cachedHoursAgo}h ago`},{" "}
                        {auditResult.category ?? "saas tool"}, {auditResult.market ?? "India"}
                        <button onClick={runFreshAudit} style={{ fontSize: 11, color: "#5B3FEA", border: "none", background: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontWeight: 500 }}>
                          Refresh
                        </button>
                      </>
                    : <>AI visibility audit, just now, {auditResult.category ?? "saas tool"}, {auditResult.market ?? "India"}</>
                  }
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 40, fontWeight: 500, color: getScoreColor(aiMemoryScore + liveWebScore), lineHeight: 1 }}>
                    {aiMemoryScore + liveWebScore}
                  </span>
                  <span style={{ fontSize: 16, color: "#6b7280" }}>/100</span>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>GEO IQ score</div>
                {(() => { const v = getVerdict(aiMemoryScore + liveWebScore); return (
                  <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: v.color, background: v.bg, borderRadius: 99, padding: "3px 10px", marginTop: 6 }}>
                    {v.label}
                  </span>
                ); })()}
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 5, textAlign: "right", lineHeight: 1.6 }}>
                  <span style={{ color: "#5B3FEA", display: "block" }}>AI Memory: {aiMemoryScore}/50 (ChatGPT + Gemini)</span>
                  <span style={{ color: "#9333ea", display: "block" }}>Live Web: {liveWebScore}/50 (Perplexity)</span>
                </div>
              </div>
            </div>

            {/* Score Bar - split between AI Memory and Live Web */}
            <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", display: "flex", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${aiMemoryScore}%`, background: "#5B3FEA", transition: "width 0.8s ease" }} />
                <div style={{ width: `${liveWebScore}%`, background: "#9333ea", transition: "width 0.8s ease" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
                <span style={{ width: 8, height: 8, background: "#5B3FEA", borderRadius: 2, flexShrink: 0 }} />
                AI Memory ({aiMemoryScore}/50) - ChatGPT + Gemini
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
                <span style={{ width: 8, height: 8, background: "#9333ea", borderRadius: 2, flexShrink: 0 }} />
                Live Web ({liveWebScore}/50) - Perplexity
              </div>
            </div>

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

              {/* How AI systems work - collapsible explainer */}
              <AiExplainerBox aiMemoryScore={aiMemoryScore} liveWebScore={liveWebScore} />

              <SystemCard system="ChatGPT" found={auditResult.chatgptFound} score={auditResult.scoreChatgpt} detail={auditResult.chatgptDetail} rawResponse={auditResult.chatgptRawResponse} checkedAt={auditResult.createdAt} />
              {isPaidUser ? (
                <>
                  <SystemCard system="Gemini" found={auditResult.geminiFound} score={auditResult.scoreGemini} detail={auditResult.geminiDetail} rawResponse={auditResult.geminiRawResponse} checkedAt={auditResult.createdAt} />
                  <SystemCard system="Perplexity" found={auditResult.perplexityFound} score={auditResult.scorePerplexity} detail={auditResult.perplexityDetail} rawResponse={auditResult.perplexityRawResponse} checkedAt={auditResult.createdAt} isLiveWeb />
                  <SystemCard system="Claude" found={auditResult.claudeFound ?? false} score={auditResult.scoreClaude ?? 0} detail={auditResult.claudeDetail} rawResponse={auditResult.claudeRawResponse} checkedAt={auditResult.createdAt} simulated />
                  <SystemCard system="Grok" found={auditResult.grokFound ?? false} score={auditResult.scoreGrok ?? 0} detail={auditResult.grokDetail} rawResponse={auditResult.grokRawResponse} checkedAt={auditResult.createdAt} />
                </>
              ) : (
                <LockedSection title="See what Gemini, Perplexity, Claude and Grok say about you" linkText="Unlock 4 more AI responses →">
                  <div>
                    <SystemCard system="Gemini" found={auditResult.geminiFound} score={auditResult.scoreGemini} detail={auditResult.geminiDetail} rawResponse={auditResult.geminiRawResponse} checkedAt={auditResult.createdAt} />
                    <SystemCard system="Perplexity" found={auditResult.perplexityFound} score={auditResult.scorePerplexity} detail={auditResult.perplexityDetail} rawResponse={auditResult.perplexityRawResponse} checkedAt={auditResult.createdAt} isLiveWeb />
                    <SystemCard system="Claude" found={auditResult.claudeFound ?? false} score={auditResult.scoreClaude ?? 0} detail={auditResult.claudeDetail} rawResponse={auditResult.claudeRawResponse} checkedAt={auditResult.createdAt} simulated />
                    <SystemCard system="Grok" found={auditResult.grokFound ?? false} score={auditResult.scoreGrok ?? 0} detail={auditResult.grokDetail} rawResponse={auditResult.grokRawResponse} checkedAt={auditResult.createdAt} />
                  </div>
                </LockedSection>
              )}
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
                  <TechCheckCard key={check.id} check={check} hideDetail={!isPaidUser} />
                ))}
                <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Technical GEO Score</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: getScoreColor(tech.overallScore) }}>{tech.overallScore}/100</span>
                </div>
              </div>
            )}

            {/* Section 03: EEAT Content Quality Score */}
            {auditResult.eeatScore && (() => {
              const eeat = auditResult.eeatScore as { total: number; experience: number; expertise: number; authoritativeness: number; trustworthiness: number; strengths: string; weaknesses: string };
              const dims = [
                { key: "Experience", value: eeat.experience, label: "E", desc: "Firsthand knowledge" },
                { key: "Expertise", value: eeat.expertise, label: "EX", desc: "Technical accuracy" },
                { key: "Authoritativeness", value: eeat.authoritativeness, label: "A", desc: "External validation" },
                { key: "Trustworthiness", value: eeat.trustworthiness, label: "T", desc: "Factual density" },
              ];
              const pct = Math.round((eeat.total / 100) * 100);
              const scoreColor = eeat.total >= 70 ? "#059669" : eeat.total >= 45 ? "#D97706" : "#DC2626";
              const eeatEl = (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                    03 - Content Quality (EEAT)
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
                    How well your content signals Experience, Expertise, Authoritativeness, and Trustworthiness to AI engines.
                  </p>
                  <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "20px", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>EEAT Score</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>out of 100</div>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: scoreColor }}>{eeat.total}<span style={{ fontSize: 14, fontWeight: 400, color: "#9ca3af" }}>/100</span></div>
                    </div>
                    <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: scoreColor, borderRadius: 3, transition: "width 0.6s ease" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
                      {dims.map((d) => (
                        <div key={d.key} style={{ background: "#f9fafb", borderRadius: 8, padding: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{d.key}</div>
                              <div style={{ fontSize: 11, color: "#9ca3af" }}>{d.desc}</div>
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: d.value >= 18 ? "#059669" : d.value >= 12 ? "#D97706" : "#DC2626" }}>
                              {d.value}<span style={{ fontSize: 10, fontWeight: 400, color: "#9ca3af" }}>/25</span>
                            </div>
                          </div>
                          <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(d.value / 25) * 100}%`, background: d.value >= 18 ? "#059669" : d.value >= 12 ? "#D97706" : "#DC2626", borderRadius: 2 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {(eeat.strengths || eeat.weaknesses) && (
                      <div style={{ borderTop: "0.5px solid #e5e7eb", paddingTop: 12 }}>
                        {eeat.strengths && <p style={{ fontSize: 12, color: "#059669", margin: "0 0 4px" }}>{eeat.strengths}</p>}
                        {eeat.weaknesses && <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{eeat.weaknesses}</p>}
                      </div>
                    )}
                  </div>
                </div>
              );
              return isPaidUser ? eeatEl : <LockedSection title="Your EEAT score and content quality breakdown">{eeatEl}</LockedSection>;
            })()}

            {/* Section 04: Fix Actions - CITE Framework */}
            {auditResult.recommendations && (auditResult.recommendations as unknown[]).length > 0 && (() => {
              const recs = auditResult.recommendations as { action: string; priority: string; effortHours: number; impactScore: number; category: string; citeCategory: string }[];
              const CITE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; desc: string }> = {
                C: { label: "C", color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd", desc: "Citations" },
                I: { label: "I", color: "#92400e", bg: "#fffbeb", border: "#fcd34d", desc: "Indexability" },
                T: { label: "T", color: "#065f46", bg: "#ecfdf5", border: "#6ee7b7", desc: "Trustworthiness" },
                E: { label: "E", color: "#5b21b6", bg: "#f5f3ff", border: "#c4b5fd", desc: "Entity" },
              };
              const PRIORITY_COLOR: Record<string, string> = { high: "#DC2626", medium: "#D97706", low: "#6b7280" };
              return (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                    04 - Fix Actions
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
                    Prioritized by impact. Each action is tagged with its CITE category.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    {(["C", "I", "T", "E"] as const).map((k) => {
                      const cfg = CITE_CONFIG[k]!;
                      return (
                        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, color: cfg.color, fontWeight: 600 }}>
                          [{cfg.label}] {cfg.desc}
                        </span>
                      );
                    })}
                  </div>
                  {recs.slice(0, isPaidUser ? recs.length : 1).map((rec, i) => {
                    const cite = CITE_CONFIG[rec.citeCategory] ?? CITE_CONFIG["C"]!;
                    return (
                      <div key={i} style={{ background: "white", border: "0.5px solid #e5e7eb", borderLeft: `3px solid ${cite.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: cite.bg, border: `0.5px solid ${cite.border}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: cite.color }}>
                            {cite.label}
                          </span>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, color: "#111827", lineHeight: 1.6, margin: "0 0 8px" }}>{rec.action}</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_COLOR[rec.priority] ?? "#6b7280", textTransform: "capitalize" }}>{rec.priority} priority</span>
                              <span style={{ fontSize: 11, color: "#9ca3af" }}>{rec.effortHours}h effort</span>
                              <span style={{ fontSize: 11, color: "#9ca3af" }}>+{rec.impactScore} score impact</span>
                              <span style={{ fontSize: 11, color: cite.color, background: cite.bg, padding: "1px 6px", borderRadius: 4 }}>{cite.desc}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!isPaidUser && recs.length > 1 && (
                    <LockWall remaining={recs.length - 1} domain={domain} />
                  )}
                </div>
              );
            })()}

            {/* Section 05: Free GEO Files - only show what still needs fixing */}
            {(() => {
              const robotsCheck = tech?.checks?.find((c: { id: string; status: string }) => c.id === "robots");
              const schemaCheck = tech?.checks?.find((c: { id: string; status: string }) => c.id === "schema");
              const llmsCheck = tech?.checks?.find((c: { id: string; status: string }) => c.id === "llms");
              const needsRobots = !robotsCheck || robotsCheck.status !== "pass";
              const needsSchema = !schemaCheck || schemaCheck.status !== "pass";
              const needsLlms = !llmsCheck || llmsCheck.status !== "pass";
              const hasAnything = needsRobots || needsSchema || needsLlms;
              return (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                    03 - Free GEO Files for Your Site
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
                    {hasAnything
                      ? "Add these files to immediately improve your technical GEO score."
                      : "Your technical setup looks good. Keep your llms.txt updated as your product evolves."}
                  </p>
                  {needsLlms && (
                    <GeoFileBlock
                      title="llms.txt"
                      filename={`Save as llms.txt and upload to ${domain}/llms.txt`}
                      instruction={`Upload this file to your web root at https://${domain}/llms.txt - it tells AI systems about your brand directly.`}
                      content={generateLlmsTxt(brandName, domain, description, socialLinks, contactEmail)}
                    />
                  )}
                  {needsRobots && (
                    <GeoFileBlock
                      title="robots.txt additions"
                      filename="Add these lines to your existing robots.txt"
                      instruction="Open your robots.txt file and paste these lines at the end. This explicitly allows all major AI crawlers to index your site."
                      content={generateRobotsTxtAdditions()}
                    />
                  )}
                  {needsSchema && (
                    <GeoFileBlock
                      title="Schema markup (JSON-LD)"
                      filename={`Add inside a <script type="application/ld+json"> tag in your homepage <head>`}
                      instruction={`Paste this block inside your homepage's <head> section inside a <script type="application/ld+json"> tag. It helps AI engines identify your brand entity.`}
                      content={generateSchemaJson(brandName, domain, description, socialLinks, contactEmail)}
                    />
                  )}
                  {!hasAnything && (
                    <GeoFileBlock
                      title="llms.txt (keep updated)"
                      filename={`Save as llms.txt and upload to ${domain}/llms.txt`}
                      instruction={`Your llms.txt is live. Re-upload this whenever your product description, features, or social profiles change.`}
                      content={generateLlmsTxt(brandName, domain, description, socialLinks, contactEmail)}
                    />
                  )}
                </div>
              );
            })()}

            {/* Site Health Card */}
            {(siteHealthLoading || siteHealth) && (() => {
              const siteHealthEl = (
              <div style={{ marginBottom: 28, background: "white", border: "0.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Site Health Snapshot</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>TTFB, security headers, tech stack</div>
                  </div>
                  {siteHealthLoading && <div style={{ width: 18, height: 18, border: "2px solid #e5e7eb", borderTopColor: "#5B3FEA", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                </div>

                {siteHealth && (
                  <div style={{ padding: 16 }}>
                    {/* Row 1: TTFB + Security score */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      {/* TTFB */}
                      <div style={{
                        padding: "12px 14px", borderRadius: 10,
                        background: siteHealth.ttfbMs < 800 ? "#ecfdf5" : siteHealth.ttfbMs < 1800 ? "#fffbeb" : "#fef2f2",
                        border: `0.5px solid ${siteHealth.ttfbMs < 800 ? "#6ee7b7" : siteHealth.ttfbMs < 1800 ? "#fcd34d" : "#fca5a5"}`,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Time to First Byte</div>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, lineHeight: 1, color: siteHealth.ttfbMs < 800 ? "#059669" : siteHealth.ttfbMs < 1800 ? "#D97706" : "#DC2626" }}>
                          {siteHealth.ttfbMs}ms
                        </div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                          {siteHealth.ttfbMs < 800 ? "Fast server response" : siteHealth.ttfbMs < 1800 ? "Acceptable, but could be faster" : "Slow - add a CDN or cache your pages"}
                        </div>
                      </div>

                      {/* Security score */}
                      <div style={{ padding: "12px 14px", borderRadius: 10, background: "#f0f4ff", border: "0.5px solid #c7d2fe" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Security Headers</div>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, lineHeight: 1, color: siteHealth.security.score >= 4 ? "#059669" : siteHealth.security.score >= 2 ? "#D97706" : "#DC2626" }}>
                          {siteHealth.security.score}/{siteHealth.security.total}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" as const }}>
                          {[
                            { key: "isHttps", label: "HTTPS", pass: siteHealth.isHttps },
                            { key: "hsts", label: "HSTS", pass: siteHealth.security.hsts },
                            { key: "cj", label: "X-Frame", pass: siteHealth.security.clickjacking },
                            { key: "mime", label: "MIME", pass: siteHealth.security.mimeSniffing },
                            { key: "ref", label: "Referrer", pass: siteHealth.security.referrerPolicy },
                          ].map(item => (
                            <span key={item.key} style={{
                              fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99,
                              background: item.pass ? "#d1fae5" : "#fee2e2",
                              color: item.pass ? "#065f46" : "#991b1b",
                            }}>
                              {item.pass ? "+" : "-"}{item.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Tech stack pills */}
                    {(siteHealth.techStack.cms || siteHealth.techStack.framework || siteHealth.techStack.cdn || siteHealth.techStack.analytics.length > 0) && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 8 }}>Tech Stack Detected</div>
                        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                          {siteHealth.techStack.cms && (
                            <span style={{ background: "#e0e7ff", color: "#3730a3", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                              {siteHealth.techStack.cms}
                            </span>
                          )}
                          {siteHealth.techStack.framework && (
                            <span style={{ background: "#dbeafe", color: "#1e40af", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                              {siteHealth.techStack.framework}
                            </span>
                          )}
                          {siteHealth.techStack.cdn && (
                            <span style={{ background: "#d1fae5", color: "#065f46", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                              CDN: {siteHealth.techStack.cdn}
                            </span>
                          )}
                          {siteHealth.techStack.analytics.map(a => (
                            <span key={a} style={{ background: "#fef3c7", color: "#92400e", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                              {a}
                            </span>
                          ))}
                        </div>
                        {!siteHealth.techStack.cdn && (
                          <div style={{ marginTop: 10, padding: "8px 12px", background: "#fffbeb", border: "0.5px solid #fcd34d", borderRadius: 8, fontSize: 11, color: "#92400e" }}>
                            No CDN detected. Adding Cloudflare (free) could cut your TTFB by 30-60% and improve your PageSpeed score.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Upgrade nudge for full audit */}
                    <div style={{ marginTop: 14, padding: "10px 14px", background: "#f0f4ff", border: "0.5px solid #c7d2fe", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
                      <div style={{ fontSize: 12, color: "#374151" }}>
                        Get the full audit with PageSpeed score, LCP, CLS, and 20+ checks in the dashboard.
                      </div>
                      <a href="/pricing" style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: "#5B3FEA", textDecoration: "none", whiteSpace: "nowrap" as const }}>
                        See plans
                      </a>
                    </div>
                  </div>
                )}
              </div>
              );
              return isPaidUser ? siteHealthEl : <LockedSection title="Full technical audit in dashboard">{siteHealthEl}</LockedSection>;
            })()}

            {/* Section 04: GEO IQ Roadmap */}
            {(() => {
              const MILESTONES = [
                { week: "Week 1-2", label: "Foundation", target: "20+ GEO IQ", from: 0, to: 20, teaser: "4 technical fixes + 3 citation tasks" },
                { week: "Week 2-3", label: "Content", target: "30+ GEO IQ", from: 20, to: 30, teaser: "2 content pieces + metadata fixes" },
                { week: "Week 3-4", label: "Authority", target: "50+ GEO IQ", from: 30, to: 50, teaser: "Reddit strategy + comparison content" },
                { week: "Week 4-5", label: "PR", target: "80+ GEO IQ", from: 50, to: 80, teaser: "Newsletter outreach + competitor gap closing" },
              ];
              const roadmapUrl = `/roadmap?auditId=${auditResult.id}&brand=${encodeURIComponent(auditResult.domain)}`;
              return (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Your GEO IQ Visibility Roadmap</div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      Based on your score of {auditResult.scoreTotal}/100, here is how long it takes to improve
                    </div>
                  </div>

                  {/* 4 milestone cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                    {MILESTONES.map((m) => (
                      <div key={m.label} style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "12px 12px 10px", position: "relative" }}>
                        <div style={{ position: "absolute", top: 10, right: 10 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </div>
                        <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>{m.week}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{m.target}</div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>{m.label}</div>
                        <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: "0%", background: "#ef4444", borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>{m.teaser}</div>
                      </div>
                    ))}
                  </div>

                  {/* Upgrade box */}
                  <UpgradeBox domain={auditResult.domain} />
                  <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12, textAlign: "center", marginTop: 12 }}>or get free weekly digest updates</div>
                  <Form {...emailForm}>
                    <form onSubmit={emailForm.handleSubmit(onSubscribe)} style={{ display: "flex", gap: 8, maxWidth: 400, margin: "0 auto" }}>
                      <FormField control={emailForm.control} name="email" render={({ field }) => (
                        <FormItem style={{ flex: 1 }}>
                          <FormControl>
                            <Input placeholder="your@email.com" style={{ background: "white", border: "0.5px solid #d1d5db", color: "#111827" }} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" variant="outline" disabled={subscribeMutation.isPending} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                        {subscribeMutation.isPending ? "..." : "Subscribe"}
                      </Button>
                    </form>
                  </Form>
                </div>
              );
            })()}

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

          {/* Sticky sidebar - desktop only, free users only */}
          {!isPaidUser && auditResult.recommendations && (auditResult.recommendations as unknown[]).length > 0 && (() => {
            const sidebarRecs = auditResult.recommendations as { action: string; priority: string; effortHours: number; impactScore: number; category: string; citeCategory: string }[];
            const criticalCount = sidebarRecs.filter((r) => r.priority === "high").length;
            const topFix = sidebarRecs[0];
            return (
              <div className="audit-sidebar" style={{ width: 252, flexShrink: 0, position: "sticky", top: 24 }}>
                <div style={{ background: "white", border: "0.5px solid #E5E7EB", borderRadius: 12, padding: "20px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#9CA3AF", marginBottom: 8 }}>
                    Top Priority Fix
                  </div>
                  <p style={{ fontSize: 13, color: "#111827", lineHeight: 1.5, margin: "0 0 16px" }}>
                    {topFix?.action}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                    <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "10px 12px", textAlign: "center" as const }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{sidebarRecs.length}</div>
                      <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginTop: 4 }}>Total Issues</div>
                    </div>
                    <div style={{ background: "#FEF2F2", borderRadius: 8, padding: "10px 12px", textAlign: "center" as const }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#DC2626", lineHeight: 1 }}>{criticalCount}</div>
                      <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginTop: 4 }}>Critical</div>
                    </div>
                  </div>
                  <a
                    href="/pricing"
                    style={{ display: "block", background: "#5B3FEA", color: "white", borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center" as const }}
                  >
                    Unlock all fixes →
                  </a>
                  <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center" as const, marginTop: 10 }}>
                    7-day free trial
                  </div>
                </div>
              </div>
            );
          })()}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
