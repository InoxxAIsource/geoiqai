import { useEffect, useRef, useState } from "react";
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

const SUBTITLES = [
  "Querying AI systems...",
  "Analyzing brand signals...",
  "Checking ChatGPT responses...",
  "Cross-referencing Gemini data...",
  "Computing your GEO IQ...",
];

const AI_CARDS = [
  { name: "ChatGPT", activeStep: 2, doneStep: 3 },
  { name: "Gemini", activeStep: 3, doneStep: 4 },
  { name: "Perplexity", activeStep: 4, doneStep: 5 },
];

function parseBrand(url: string): string {
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return hostname.replace(/^www\./, "").split(".")[0] ?? "yourbrand";
  } catch {
    return url.split(".")[0] ?? "yourbrand";
  }
}

function parseDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function playBeep(muted: boolean): void {
  if (muted) return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {}
}

function buildTerminalLines(domain: string, brand: string): string[] {
  const cap = brand.charAt(0).toUpperCase() + brand.slice(1);
  return [
    "> Connecting to OpenAI API...",
    `> Scraping ${domain} homepage...`,
    `> Detected: SaaS · India`,
    `> DataForSEO: fetching keywords...`,
    `> Found 15 keywords for ${domain}`,
    `> Running prompt: "What is ${cap}?"`,
    `> ChatGPT response received (1.2s)`,
    `> Running prompt: "best SaaS tool"`,
    `> Gemini response received (2.1s)`,
    `> Checking brand mentions...`,
    `> "${cap}" found in ChatGPT \u2713`,
    `> "${cap}" not found in Gemini \u2717`,
    `> Running Perplexity query...`,
    `> Perplexity response received (1.8s)`,
    `> Calculating GEO IQ score...`,
    `> Score computation complete.`,
  ];
}

function terminalLineColor(line: string): string {
  if (line.includes("\u2713")) return "#4ADE80";
  if (line.includes("\u2717")) return "#F87171";
  if (line.includes("...")) return "#94A3B8";
  return "#4ADE80";
}

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
  system,
  found,
  score,
  detail,
}: {
  system: string;
  found: boolean;
  score: number;
  detail?: string | null;
}) {
  const badge = getStatusBadge(found, score);
  const systemColors: Record<string, string> = {
    ChatGPT: "#10a37f",
    Gemini: "#4285f4",
    Perplexity: "#22d3ee",
  };
  const color = systemColors[system] ?? "#4F46E5";

  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e5e7eb",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: found ? "#E1F5EE" : "#FCEBEB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {found ? (
            <CheckCircle2 style={{ width: 18, height: 18, color: "#10b981" }} />
          ) : (
            <XCircle style={{ width: 18, height: 18, color: "#ef4444" }} />
          )}
        </div>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, color: "#111827", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color }} />
            {system}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            {found
              ? detail
                ? detail.substring(0, 80) + (detail.length > 80 ? "..." : "")
                : "Mentioned in responses"
              : "Not found in responses"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0, marginLeft: 16 }}>
        <span
          style={{
            background: badge.bg,
            color: badge.text,
            borderRadius: 9999,
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {badge.label}
        </span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{system} IQ: {score}/33</span>
      </div>
    </div>
  );
}

/* ─── Audit Loading Screen ───────────────────────────────────────── */

const LOADING_CSS = `
@keyframes geo-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
@keyframes geo-blink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
@keyframes geo-pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(79,70,229,0.5) }
  100% { box-shadow: 0 0 0 10px rgba(79,70,229,0) }
}
@keyframes geo-shimmer {
  0% { background-position: 100% 50% }
  100% { background-position: 0% 50% }
}
@keyframes geo-fade-sub {
  0% { opacity: 0; transform: translateY(4px) }
  15% { opacity: 1; transform: translateY(0) }
  85% { opacity: 1; transform: translateY(0) }
  100% { opacity: 0; transform: translateY(-4px) }
}
@keyframes geo-slide-up {
  0% { transform: translateY(0); opacity: 1 }
  100% { transform: translateY(-100vh); opacity: 0.8 }
}
@keyframes geo-pop {
  0% { transform: scale(1) }
  50% { transform: scale(1.06) }
  100% { transform: scale(1) }
}
@keyframes geo-fade-in-up {
  from { opacity: 0; transform: translateY(24px) }
  to { opacity: 1; transform: translateY(0) }
}
.geo-spin { animation: geo-spin 1s linear infinite; }
.geo-blink { animation: geo-blink 1s step-start infinite; }
.geo-pulse-ring { animation: geo-pulse-ring 1s ease-out infinite; }
.geo-shimmer {
  background: linear-gradient(90deg, #4F46E5, #7C3AED, #06B6D4, #4F46E5);
  background-size: 300% 100%;
  animation: geo-shimmer 2s linear infinite;
}
.geo-slide-up { animation: geo-slide-up 0.7s cubic-bezier(0.4,0,0.2,1) forwards; }
.geo-fade-in-up { animation: geo-fade-in-up 0.5s ease forwards; }
`;

function AuditLoadingScreen({
  urlParam,
  loadingStep,
  doneSteps,
  terminalLines,
  subtitleIdx,
  subtitleVisible,
  liveTimer,
  stepDurations,
  muted,
  setMuted,
  isRevealing,
}: {
  urlParam: string;
  loadingStep: number;
  doneSteps: boolean[];
  terminalLines: string[];
  subtitleIdx: number;
  subtitleVisible: boolean;
  liveTimer: number;
  stepDurations: number[];
  muted: boolean;
  setMuted: (v: boolean) => void;
  isRevealing: boolean;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const domain = parseDomain(urlParam);
  const progress = Math.round(((loadingStep + (doneSteps[loadingStep] ? 1 : 0)) / LOADING_STEPS.length) * 100);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  return (
    <div
      className={isRevealing ? "geo-slide-up" : ""}
      style={{
        position: "fixed",
        inset: 0,
        background: "#0F0F1A",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <style>{LOADING_CSS}</style>

      {/* Mute toggle */}
      <button
        onClick={() => setMuted(!muted)}
        title={muted ? "Unmute sounds" : "Mute sounds"}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          color: "rgba(255,255,255,0.5)",
          padding: "6px 10px",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          zIndex: 10,
        }}
      >
        {muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"}
      </button>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "48px 16px 80px",
          maxWidth: 520,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Logo */}
        <div style={{ fontWeight: 700, fontSize: 22, color: "#4F46E5", letterSpacing: "-0.03em", marginBottom: 16 }}>
          GeoIQ
        </div>

        {/* Domain heading */}
        <div style={{ fontWeight: 600, fontSize: 20, color: "white", textAlign: "center", marginBottom: 6 }}>
          Running GEO IQ scan on {domain}
        </div>

        {/* Cycling subtitle */}
        <div style={{ height: 22, marginBottom: 20, overflow: "hidden" }}>
          <div
            key={subtitleIdx}
            style={{
              fontSize: 14,
              color: "#6B7280",
              textAlign: "center",
              animation: "geo-fade-sub 2s ease forwards",
              opacity: subtitleVisible ? 1 : 0,
            }}
          >
            {SUBTITLES[subtitleIdx % SUBTITLES.length]}
          </div>
        </div>

        {/* Terminal feed */}
        <div
          ref={terminalRef}
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 12,
            height: 120,
            overflowY: "hidden",
            background: "#1A1A2E",
            border: "1px solid #2D2D4E",
            borderRadius: 8,
            padding: "10px 12px",
            width: "100%",
            marginBottom: 24,
            boxSizing: "border-box",
          }}
        >
          {terminalLines.map((line, i) => (
            <div key={i} style={{ color: terminalLineColor(line), lineHeight: 1.6 }}>
              {line}
            </div>
          ))}
          <span className="geo-blink" style={{ color: "#4ADE80", fontSize: 12 }}>█</span>
        </div>

        {/* AI status cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, width: "100%", marginBottom: 28 }}>
          {AI_CARDS.map((card) => {
            const isDone = loadingStep >= card.doneStep;
            const isActive = loadingStep === card.activeStep && !doneSteps[card.activeStep];
            return (
              <div
                key={card.name}
                className={isDone ? "geo-pop" : ""}
                style={{
                  background: "#1A1A2E",
                  border: `1px solid ${isDone ? "#059669" : isActive ? "#4F46E5" : "#2D2D4E"}`,
                  borderRadius: 8,
                  padding: "10px 8px",
                  textAlign: "center",
                  transition: "border-color 0.3s",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
                  {card.name}
                </div>
                {isDone ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 14, color: "#4ADE80" }}>✓</span>
                    <span style={{ fontSize: 10, color: "#4ADE80" }}>Done</span>
                  </div>
                ) : isActive ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#4F46E5",
                        margin: "0 auto 2px",
                        animation: "geo-pulse-ring 1s ease-out infinite",
                      }}
                    />
                    <span style={{ fontSize: 10, color: "#4F46E5" }}>Querying...</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2D2D4E", margin: "0 auto 2px" }} />
                    <span style={{ fontSize: 10, color: "#4B5563" }}>Waiting...</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Steps */}
        <div style={{ width: "100%" }}>
          {LOADING_STEPS.map((label, i) => {
            const isDone = doneSteps[i];
            const isCurrent = loadingStep === i && !isDone;
            const isPast = i < loadingStep;
            const isPending = i > loadingStep;
            const dur = stepDurations[i];

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 0",
                  opacity: isPending ? 0.3 : 1,
                  transition: "opacity 0.4s",
                }}
              >
                {/* Circle */}
                <div
                  className={isCurrent ? "geo-pulse-ring" : ""}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDone || isPast
                      ? "#059669"
                      : isCurrent
                        ? "#4F46E5"
                        : "transparent",
                    border: isPending ? "2px solid #2D2D4E" : "none",
                    transition: "background 0.4s",
                  }}
                >
                  {isDone || isPast ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isCurrent ? (
                    <Loader2 className="geo-spin" style={{ width: 15, height: 15, color: "white" }} />
                  ) : (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4B5563", display: "block" }} />
                  )}
                </div>

                {/* Label + timer */}
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontSize: 14,
                      color: isDone || isPast ? "#4ADE80" : isCurrent ? "white" : "#4B5563",
                      fontWeight: isCurrent ? 500 : 400,
                    }}
                  >
                    {label}
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 8 }}>
                      ({(liveTimer / 1000).toFixed(1)}s)
                    </span>
                  )}
                  {(isDone || isPast) && dur !== undefined && (
                    <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 8 }}>
                      done in {dur.toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed bottom progress bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "#1A1A2E",
          zIndex: 201,
        }}
      >
        <div
          className="geo-shimmer"
          style={{
            height: "100%",
            width: `${progress}%`,
            borderRadius: 2,
            transition: "width 1.4s ease",
          }}
        />
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */

export default function Audit() {
  useEffect(() => { document.title = "Your GEO IQ Score — GeoIQ"; }, []);
  const [, setLocation] = useLocation();
  const query = useQuery();
  const urlParam = query.get("url");
  const { toast } = useToast();

  const runAuditMutation = useRunAudit();
  const subscribeMutation = useEmailSubscribe();

  const [auditResult, setAuditResult] = useState<any>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<boolean[]>(LOADING_STEPS.map(() => false));
  const [stepDurations, setStepDurations] = useState<number[]>([]);
  const [stepStartTime, setStepStartTime] = useState<number>(Date.now());
  const [liveTimer, setLiveTimer] = useState(0);

  const [subtitleIdx, setSubtitleIdx] = useState(0);
  const [subtitleVisible, setSubtitleVisible] = useState(true);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [muted, setMuted] = useState(true);
  const [revealPhase, setRevealPhase] = useState<"loading" | "waiting" | "revealing" | "done">("loading");

  const pendingResultRef = useRef<any>(null);
  const terminalIndexRef = useRef(0);
  const terminalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  // Start audit
  useEffect(() => {
    if (!urlParam) { setLocation("/"); return; }
    runAuditMutation.mutate(
      { data: { url: urlParam } },
      {
        onSuccess: (data) => {
          pendingResultRef.current = data;
          setRevealPhase("waiting");
          // let terminal run for ~1.5s after completion before reveal
          setTimeout(() => {
            setAuditResult(data);
            setRevealPhase("revealing");
            setTimeout(() => setRevealPhase("done"), 750);
          }, 1500);
        },
        onError: () =>
          toast({ title: "Audit failed", description: "Could not analyze the domain. Please try again.", variant: "destructive" }),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParam]);

  // Step advancement (every 1800ms)
  useEffect(() => {
    if (!runAuditMutation.isPending) return;
    let step = 0;
    setStepStartTime(Date.now());
    const interval = setInterval(() => {
      if (step < LOADING_STEPS.length - 1) {
        const elapsed = Date.now() - stepStartTime;
        setDoneSteps((prev) => { const n = [...prev]; n[step] = true; return n; });
        setStepDurations((prev) => { const n = [...prev]; n[step] = elapsed / 1000; return n; });
        playBeep(muted);
        step++;
        setLoadingStep(step);
        setStepStartTime(Date.now());
        setLiveTimer(0);
      }
    }, 1800);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runAuditMutation.isPending]);

  // Live step timer (tick every 100ms)
  useEffect(() => {
    if (!runAuditMutation.isPending && revealPhase !== "waiting") return;
    const tick = setInterval(() => setLiveTimer(Date.now() - stepStartTime), 100);
    return () => clearInterval(tick);
  }, [runAuditMutation.isPending, revealPhase, stepStartTime]);

  // Cycling subtitle
  useEffect(() => {
    if (revealPhase === "done") return;
    const interval = setInterval(() => {
      setSubtitleVisible(false);
      setTimeout(() => {
        setSubtitleIdx((i) => i + 1);
        setSubtitleVisible(true);
      }, 200);
    }, 2000);
    return () => clearInterval(interval);
  }, [revealPhase]);

  // Terminal feed — add lines one by one
  useEffect(() => {
    if (!urlParam || revealPhase === "done") return;
    const lines = buildTerminalLines(parseDomain(urlParam), parseBrand(urlParam));
    terminalIndexRef.current = 0;
    setTerminalLines([]);

    const addNext = () => {
      const i = terminalIndexRef.current;
      if (i >= lines.length) return;
      setTerminalLines((prev) => [...prev.slice(-14), lines[i]!]);
      terminalIndexRef.current = i + 1;
      terminalTimerRef.current = setTimeout(addNext, 600 + Math.random() * 200);
    };

    terminalTimerRef.current = setTimeout(addNext, 400);
    return () => {
      if (terminalTimerRef.current) clearTimeout(terminalTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParam]);

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
    ? `I just checked my GEO IQ score with GeoIQ — ${auditResult.domain} got ${auditResult.scoreTotal}/100. Check yours free at geoiqai.com`
    : "";
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  const showLoader =
    runAuditMutation.isPending || revealPhase === "waiting" || revealPhase === "revealing";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f9fafb" }}>
      {/* Loading overlay — covers entire viewport */}
      {showLoader && urlParam && (
        <AuditLoadingScreen
          urlParam={urlParam}
          loadingStep={loadingStep}
          doneSteps={doneSteps}
          terminalLines={terminalLines}
          subtitleIdx={subtitleIdx}
          subtitleVisible={subtitleVisible}
          liveTimer={liveTimer}
          stepDurations={stepDurations}
          muted={muted}
          setMuted={setMuted}
          isRevealing={revealPhase === "revealing"}
        />
      )}

      <Navbar />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px" }}>
        {runAuditMutation.isError && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <XCircle style={{ width: 48, height: 48, color: "#ef4444", margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Audit Failed</h2>
            <p style={{ color: "#6b7280", marginBottom: 24 }}>
              We could not analyze {urlParam}. Please try again.
            </p>
            <Button onClick={() => runAuditMutation.mutate({ data: { url: urlParam! } })}>
              Try Again
            </Button>
          </div>
        )}

        {auditResult && revealPhase === "done" && (
          <div style={{ width: "100%", maxWidth: 680, animation: "geo-fade-in-up 0.5s ease forwards" }}>
            <style>{LOADING_CSS}</style>

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
              <div
                style={{
                  height: "100%",
                  width: `${auditResult.scoreTotal}%`,
                  background: getScoreColor(auditResult.scoreTotal),
                  borderRadius: 4,
                  transition: "width 0.8s ease",
                }}
              />
            </div>

            {/* 3 Metric Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                {
                  label: `${[auditResult.chatgptFound, auditResult.geminiFound, auditResult.perplexityFound].filter(Boolean).length}/3 AI systems found you`,
                },
                {
                  label: auditResult.chatgptFound
                    ? "Visible on ChatGPT"
                    : auditResult.geminiFound
                      ? "Visible on Gemini"
                      : "Not ranked #1 anywhere",
                },
                {
                  label: `${[!auditResult.chatgptFound, !auditResult.geminiFound, !auditResult.perplexityFound].filter(Boolean).length} blind spot${[!auditResult.chatgptFound, !auditResult.geminiFound, !auditResult.perplexityFound].filter(Boolean).length !== 1 ? "s" : ""} found`,
                },
              ].map((card, i) => (
                <div
                  key={i}
                  style={{
                    background: "#f9fafb",
                    border: "0.5px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "12px 14px",
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 500,
                    textAlign: "center",
                  }}
                >
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
                  Unlock full GEO IQ report — ₹3,999/mo →
                </Button>
              </Link>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, fontSize: 13, color: "#9ca3af" }}>
                <div style={{ flex: 1, height: "0.5px", background: "#e5e7eb" }} />
                or
                <div style={{ flex: 1, height: "0.5px", background: "#e5e7eb" }} />
              </div>
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onSubscribe)} style={{ display: "flex", gap: 8 }}>
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem style={{ flex: 1 }}>
                        <FormControl>
                          <Input placeholder="Enter your email for free weekly digest" style={{ background: "white" }} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" variant="outline" disabled={subscribeMutation.isPending} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                    {subscribeMutation.isPending ? "Sending..." : "Send me the free report →"}
                  </Button>
                </form>
              </Form>
            </div>

            {/* Share */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderTop: "0.5px solid #e5e7eb" }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>Share your score:</span>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#000", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none" }}
              >
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
