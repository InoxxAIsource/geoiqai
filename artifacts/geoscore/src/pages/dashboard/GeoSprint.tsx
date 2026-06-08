import { useState, useEffect, useCallback } from "react";
import { CheckCircle, Circle, ExternalLink, Copy, Check, RefreshCw, Bot, ArrowRight, Rocket, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { getToken } from "@/lib/auth";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SprintStep {
  id: string;
  phase: number;
  phase_name: string;
  title: string;
  why: string;
  affects: string[];
  score_impact: number;
  time: string;
  action_type: "generate" | "internal" | "link";
  action_label: string;
  action_endpoint?: string;
  action_route?: string;
  action_url?: string;
  verify_url?: string;
  research: string;
  completed: boolean;
  completed_at?: string | null;
}

interface SprintStats {
  total_steps: number;
  completed_count: number;
  current_score: number;
  projected_score: number;
  target_score: number;
  pts_remaining: number;
}

interface SprintSession {
  id: string;
  domain: string;
  started_at: string;
  target_score: number;
  current_score: number;
}

interface SprintData {
  session: SprintSession;
  steps: SprintStep[];
  stats: SprintStats;
}

interface GenerateModal {
  step: SprintStep;
  code: string;
  questions: Array<{ name: string; answer: string }>;
  fields: Array<{ label: string; value: string }>;
  loading: boolean;
}

interface ConfirmDialog {
  step: SprintStep;
}

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<number, { bg: string; border: string; text: string; badge: string; badgeBg: string }> = {
  1: { bg: "#EEF2FF", border: "#C7D2FE", text: P, badge: "Phase 1", badgeBg: "#EEF2FF" },
  2: { bg: "#FDF4FF", border: "#E9D5FF", text: "#7C3AED", badge: "Phase 2", badgeBg: "#F3E8FF" },
  3: { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C", badge: "Phase 3", badgeBg: "#FFEDD5" },
  4: { bg: "#ECFDF5", border: "#A7F3D0", text: "#065F46", badge: "Phase 4", badgeBg: "#D1FAE5" },
};

const PHASE_DESCRIPTIONS: Record<number, string> = {
  1: "Fix the technical issues that block AI crawlers. These unblock everything else.",
  2: "Create the content types AI systems are most likely to quote and cite.",
  3: "Publish on the platforms AI systems pull citations from most.",
  4: "Media coverage is the fastest way to spike AI visibility. One article = 15+ points.",
};

// ─── AI badge colors ──────────────────────────────────────────────────────────

const AI_BADGE: Record<string, { bg: string; color: string }> = {
  "ChatGPT": { bg: "#D1FAE5", color: "#065F46" },
  "Gemini": { bg: "#DBEAFE", color: "#1E40AF" },
  "Perplexity": { bg: "#EDE9FE", color: "#5B21B6" },
  "Claude": { bg: "#FEF3C7", color: "#92400E" },
  "Grok": { bg: "#F3F4F6", color: "#111827" },
  "Google AI": { bg: "#DBEAFE", color: "#1D4ED8" },
  "Google AI Overview": { bg: "#DBEAFE", color: "#1D4ED8" },
  "All platforms": { bg: "#F3F4F6", color: "#374151" },
};

function aiBadgeStyle(name: string) {
  return AI_BADGE[name] ?? { bg: "#F3F4F6", color: "#374151" };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface GeoSprintProps {
  domain: string;
  onNavigate: (nav: string) => void;
  onOpenCopilot: () => void;
}

export function GeoSprint({ domain, onNavigate, onOpenCopilot }: GeoSprintProps) {
  const [data, setData] = useState<SprintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [generateModal, setGenerateModal] = useState<GenerateModal | null>(null);
  const [copiedModal, setCopiedModal] = useState(false);
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSprint = useCallback(async () => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sprint/${encodeURIComponent(domain)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to load sprint data");
      const json = await res.json() as SprintData;
      setData(json);
    } catch {
      setError("Could not load your sprint data. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    fetchSprint();
  }, [fetchSprint]);

  async function handleCompleteStep(step: SprintStep) {
    setCompletingId(step.id);
    try {
      const res = await fetch("/api/sprint/complete-step", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ domain, step_id: step.id }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchSprint();
      showToast(`Step complete! +${step.score_impact} pts toward 30%`);

      // Check if phase is now fully complete
      if (data) {
        const phaseSteps = data.steps.filter((s) => s.phase === step.phase);
        const nowCompleted = phaseSteps.filter((s) => s.completed || s.id === step.id);
        if (nowCompleted.length === phaseSteps.length && step.phase < 4) {
          setTimeout(() => {
            showToast(`Phase ${step.phase} complete! Phase ${step.phase + 1} unlocked.`);
          }, 1200);
        }
      }
    } catch {
      showToast("Something went wrong. Try again.");
    } finally {
      setCompletingId(null);
      setConfirmDialog(null);
    }
  }

  async function handleGenerate(step: SprintStep) {
    if (!step.action_endpoint) return;
    setCodeExpanded(false);
    setGenerateModal({ step, code: "", questions: [], fields: [], loading: true });
    try {
      const res = await fetch(step.action_endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ domain }),
      });
      const json = await res.json() as Record<string, unknown>;
      const code = ((json.code ?? json.content) as string | undefined) ?? "";
      const questions = (json.questions ?? []) as Array<{ name: string; answer: string }>;
      const fields = (json.fields ?? []) as Array<{ label: string; value: string }>;
      setGenerateModal({ step, code, questions, fields, loading: false });
    } catch {
      setGenerateModal({ step, code: "Failed to generate content. Try again.", questions: [], fields: [], loading: false });
    }
  }

  function handleCopyModal() {
    if (!generateModal?.code) return;
    navigator.clipboard.writeText(generateModal.code).then(() => {
      setCopiedModal(true);
      setTimeout(() => setCopiedModal(false), 2000);
    });
  }

  function handleSprintAction(step: SprintStep) {
    if (step.action_type === "generate") { handleGenerate(step); return; }
    if (step.action_type === "link" && step.action_url) {
      window.open(step.action_url, "_blank", "noopener,noreferrer");
      return;
    }
    // Internal steps: store intent in sessionStorage then navigate
    type PrefillData = Record<string, string | undefined>;
    let prefill: PrefillData | null = null;
    let navTarget = "content-creation";

    switch (step.id) {
      case "definition_page":
        prefill = { tab: "writer", topic: "Brand definition page", contentType: "Landing page", step_id: step.id, step_title: step.title };
        break;
      case "statistics_page":
        prefill = { tab: "optimizer", url: `https://${domain}`, step_id: step.id, step_title: step.title };
        break;
      case "faq_content":
        prefill = { tab: "writer", topic: "FAQ page - common questions about this product", contentType: "FAQ page", step_id: step.id, step_title: step.title };
        break;
      case "comparison_content":
        prefill = { tab: "writer", topic: `${domain} vs competitors comparison`, contentType: "Comparison page (X vs Y)", step_id: step.id, step_title: step.title };
        break;
      case "reddit":
        prefill = { tab: "repurposer", platform: "reddit", url: `https://${domain}`, step_id: step.id, step_title: step.title };
        break;
      case "linkedin_content":
        prefill = { tab: "repurposer", platform: "linkedin", url: `https://${domain}`, step_id: step.id, step_title: step.title };
        break;
      case "product_hunt":
        prefill = { tab: "repurposer", platform: "producthunt", url: `https://${domain}`, step_id: step.id, step_title: step.title };
        break;
      case "hacker_news":
        prefill = { tab: "repurposer", platform: "hackernews", url: `https://${domain}`, step_id: step.id, step_title: step.title };
        break;
      case "x_thread":
        prefill = { tab: "repurposer", platform: "twitter", url: `https://${domain}`, step_id: step.id, step_title: step.title };
        break;
      case "journalist_find":
        prefill = { section: "journalist-search", step_id: step.id, step_title: step.title };
        navTarget = "ai-pr";
        break;
      case "journalist_pitch":
        prefill = { section: "pitch-studio", step_id: step.id, step_title: step.title };
        navTarget = "ai-pr";
        break;
      case "monitor_mentions":
        prefill = { section: "mention-radar", step_id: step.id, step_title: step.title };
        navTarget = "ai-pr";
        break;
      default:
        if (step.action_route) navTarget = step.action_route.replace("/dashboard/", "");
    }

    if (prefill) sessionStorage.setItem("sprint_prefill", JSON.stringify(prefill));
    onNavigate(navTarget);
  }

  async function handleRescan() {
    setRescanning(true);
    try {
      await fetch(`/api/audit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ url: `https://${domain}` }),
      });
      await fetchSprint();
      showToast("AI Presence rescanned. Score updated.");
    } catch {
      showToast("Rescan failed. Try again.");
    } finally {
      setRescanning(false);
    }
  }

  if (!domain) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <Rocket size={40} color={MUTED} style={{ margin: "0 auto 16px" }} />
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Add a brand to start your GEO Sprint</div>
        <div style={{ fontSize: 13, color: MUTED }}>Select or add a monitored brand from the sidebar.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 13, color: MUTED }}>Loading your sprint...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontSize: 14, color: "#DC2626", marginBottom: 12 }}>{error ?? "Could not load sprint data."}</div>
        <button onClick={fetchSprint} style={{ padding: "8px 18px", background: P, color: "white", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Retry
        </button>
      </div>
    );
  }

  const { stats, steps } = data;
  const progressPct = Math.min((stats.current_score / 30) * 100, 100);
  const projectedPct = Math.min((stats.projected_score / 30) * 100, 100);

  // Group steps by phase
  const phases = [1, 2, 3, 4];
  const stepsByPhase = phases.reduce<Record<number, SprintStep[]>>((acc, p) => {
    acc[p] = steps.filter((s) => s.phase === p);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Rocket size={22} color={P} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>GEO Sprint</h1>
          </div>
          <div style={{ fontSize: 14, color: MUTED }}>Your plan to get cited by AI - {stats.completed_count} of {stats.total_steps} steps done</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleRescan}
            disabled={rescanning}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: `1.5px solid ${BORDER}`, borderRadius: 7, background: "white", fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer" }}
          >
            <RefreshCw size={14} style={{ animation: rescanning ? "spin 0.8s linear infinite" : "none" }} />
            {rescanning ? "Rescanning..." : "Rescan AI Presence"}
          </button>
          <button
            onClick={onOpenCopilot}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: `1.5px solid ${P}`, borderRadius: 7, background: "#EEF2FF", fontSize: 13, fontWeight: 600, color: P, cursor: "pointer" }}
          >
            <Bot size={14} />
            Ask GEO Copilot
          </button>
        </div>
      </div>

      {/* Research callout */}
      <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 18px", marginBottom: 24, fontSize: 13, color: "#78350F", lineHeight: 1.6 }}>
        <strong>Why these steps?</strong> Based on Princeton University GEO research (10,000 queries), 680M AI citation analysis (5W Communications, 2026), and Perplexity citation data from 30M sources (Peec AI). Each step is ranked by proven citation impact.
      </div>

      {/* Sprint status card */}
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 2 }}>Your Journey - {domain}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
              {stats.current_score}% <span style={{ color: MUTED, fontWeight: 400 }}>to</span> 30% AI Visibility
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: MUTED }}>Complete all steps</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: P }}>~{stats.projected_score}% projected</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ position: "relative", height: 10, background: "#F3F4F6", borderRadius: 9999, overflow: "hidden", marginBottom: 8 }}>
          {/* Projected (lighter) */}
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${projectedPct}%`, background: "#C7D2FE", borderRadius: 9999, transition: "width 0.6s ease" }} />
          {/* Current (solid) */}
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${progressPct}%`, background: P, borderRadius: 9999, transition: "width 0.6s ease" }} />
          {/* 30% goal marker */}
          <div style={{ position: "absolute", right: 0, top: -3, bottom: -3, width: 2, background: "#9CA3AF", borderRadius: 1 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED }}>
          <span>{stats.current_score}% now</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", width: 10, height: 6, background: "#C7D2FE", borderRadius: 2 }} /> projected {stats.projected_score}%
            <span style={{ marginLeft: 8 }}>30% goal</span>
          </span>
        </div>

        {stats.pts_remaining > 0 ? (
          <div style={{ marginTop: 12, fontSize: 13, color: MUTED }}>
            {stats.pts_remaining} more points to hit 30%. Complete the highest-impact steps first.
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 13, color: "#059669", fontWeight: 600 }}>
            You have hit the 30% target! Keep going to reach 50%+.
          </div>
        )}
      </div>

      {/* Phase sections */}
      {phases.map((phaseNum) => {
        const phaseSteps = stepsByPhase[phaseNum] ?? [];
        const phaseConfig = PHASE_CONFIG[phaseNum]!;
        const completedInPhase = phaseSteps.filter((s) => s.completed).length;
        const phaseComplete = completedInPhase === phaseSteps.length;
        const phasePts = phaseSteps.reduce((sum, s) => sum + s.score_impact, 0);
        const description = PHASE_DESCRIPTIONS[phaseNum]!;

        return (
          <div key={phaseNum} style={{ marginBottom: 28 }}>
            {/* Phase header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: phaseComplete ? "#D1FAE5" : phaseConfig.badgeBg,
                border: `2px solid ${phaseComplete ? "#10B981" : phaseConfig.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                color: phaseComplete ? "#065F46" : phaseConfig.text,
                flexShrink: 0,
              }}>
                {phaseComplete ? <Check size={14} color="#065F46" /> : phaseNum}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{phaseSteps[0]?.phase_name ?? `Phase ${phaseNum}`}</span>
                  {phaseComplete && (
                    <span style={{ fontSize: 11, fontWeight: 600, background: "#D1FAE5", color: "#065F46", padding: "2px 8px", borderRadius: 9999 }}>
                      Complete
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{description}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: phaseConfig.text }}>{completedInPhase}/{phaseSteps.length} done</div>
                <div style={{ fontSize: 11, color: MUTED }}>+{phasePts} pts available</div>
              </div>
            </div>

            {/* Steps */}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
              {phaseSteps.map((step, idx) => (
                <StepRow
                  key={step.id}
                  step={step}
                  isLast={idx === phaseSteps.length - 1}
                  completing={completingId === step.id}
                  onCheck={() => setConfirmDialog({ step })}
                  onAction={() => handleSprintAction(step)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Confirm dialog */}
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div style={{ background: "white", borderRadius: 12, padding: 28, maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
              Mark as complete?
            </div>
            <div style={{ fontSize: 14, color: MUTED, marginBottom: 20, lineHeight: 1.6 }}>
              "{confirmDialog.step.title}"
              <br />
              <span style={{ color: "#059669", fontWeight: 600 }}>+{confirmDialog.step.score_impact} pts toward 30%</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => handleCompleteStep(confirmDialog.step)}
                disabled={completingId === confirmDialog.step.id}
                style={{ flex: 1, padding: "10px 16px", background: "#059669", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                {completingId === confirmDialog.step.id ? "Saving..." : "Yes, done"}
              </button>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{ flex: 1, padding: "10px 16px", background: "white", color: "#374151", border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate modal */}
      {generateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div style={{ background: "white", borderRadius: 12, padding: 28, maxWidth: 640, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{generateModal.step.title}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{generateModal.step.why}</div>
              </div>
              <button onClick={() => setGenerateModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: MUTED, lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>
                x
              </button>
            </div>

            {generateModal.loading ? (
              <div style={{ textAlign: "center", padding: "48px 20px", flex: 1 }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ fontSize: 13, color: MUTED }}>Generating for {domain}...</div>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* SECTION 1: Human-readable preview */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 10 }}>Preview</div>

                  {/* FAQ Q&A */}
                  {generateModal.step.id === "faq_schema" && generateModal.questions.length > 0 && (
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      {generateModal.questions.map((q, i) => (
                        <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < generateModal.questions.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 4 }}>Q: {q.name}</div>
                          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>A: {q.answer.length > 220 ? q.answer.slice(0, 220) + "..." : q.answer}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Org schema key-value */}
                  {generateModal.step.id === "org_schema" && generateModal.fields.length > 0 && (
                    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                      {generateModal.fields.map((f, i) => (
                        <div key={f.label} style={{ display: "flex", gap: 12, padding: "9px 14px", borderBottom: i < generateModal.fields.length - 1 ? `1px solid ${BORDER}` : "none", fontSize: 13 }}>
                          <span style={{ color: MUTED, width: 110, flexShrink: 0 }}>{f.label}</span>
                          <span style={{ color: "#111827" }}>{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Plain text (llms.txt or robots.txt) */}
                  {(generateModal.step.id === "llmstxt" || generateModal.step.id === "robots_txt") && (
                    <pre style={{ fontSize: 12, background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#374151", margin: 0, maxHeight: 240, overflowY: "auto", lineHeight: 1.65, fontFamily: "monospace" }}>
                      {generateModal.code}
                    </pre>
                  )}

                  {/* Fallback for unknown step */}
                  {generateModal.step.id !== "faq_schema" && generateModal.step.id !== "org_schema" && generateModal.step.id !== "llmstxt" && generateModal.step.id !== "robots_txt" && (
                    <pre style={{ fontSize: 12, background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#374151", margin: 0, maxHeight: 200, overflowY: "auto", lineHeight: 1.65 }}>
                      {generateModal.code}
                    </pre>
                  )}
                </div>

                {/* SECTION 2: Collapsible code (for schema steps only) */}
                {(generateModal.step.id === "faq_schema" || generateModal.step.id === "org_schema") && (
                  <div>
                    <button
                      onClick={() => setCodeExpanded(v => !v)}
                      style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 600, color: MUTED }}
                    >
                      {codeExpanded ? <ChevronDown size={13} /> : <ChevronRightIcon size={13} />}
                      {codeExpanded ? "Hide code" : "Show code"}
                    </button>
                    {codeExpanded && (
                      <pre style={{ fontSize: 11, background: "#F8FAFC", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#374151", marginTop: 10, maxHeight: 200, overflowY: "auto", lineHeight: 1.5, fontFamily: "monospace" }}>
                        {generateModal.code}
                      </pre>
                    )}
                  </div>
                )}

                {/* SECTION 3: How to implement */}
                <div style={{ background: BG, borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 10 }}>How to add this</div>

                  {(generateModal.step.id === "faq_schema" || generateModal.step.id === "org_schema") && (
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#374151", lineHeight: 2.1 }}>
                      <li>Click "Copy code" below</li>
                      <li>Open your website editor. In Replit: <code style={{ background: "#E5E7EB", padding: "1px 5px", borderRadius: 3 }}>index.html</code> or <code style={{ background: "#E5E7EB", padding: "1px 5px", borderRadius: 3 }}>_document.tsx</code>. In Webflow: Settings - Custom Code - Head. In WordPress: Plugins - Insert Headers</li>
                      <li>Paste before the <code style={{ background: "#E5E7EB", padding: "1px 5px", borderRadius: 3 }}>&lt;/head&gt;</code> tag</li>
                      <li>Save and verify it works using the Verify button</li>
                    </ol>
                  )}

                  {generateModal.step.id === "llmstxt" && (
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#374151", lineHeight: 2.1 }}>
                      <li>Click "Copy content" below</li>
                      <li>Create a new file named <code style={{ background: "#E5E7EB", padding: "1px 5px", borderRadius: 3 }}>llms.txt</code></li>
                      <li>In Replit: add it to the <code style={{ background: "#E5E7EB", padding: "1px 5px", borderRadius: 3 }}>/public</code> folder. It will be live at <code style={{ background: "#E5E7EB", padding: "1px 5px", borderRadius: 3 }}>{domain}/llms.txt</code></li>
                      <li>Click "Check it's live" to confirm</li>
                    </ol>
                  )}

                  {generateModal.step.id === "robots_txt" && (
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#374151", lineHeight: 2.1 }}>
                      <li>Click "Copy content" below</li>
                      <li>Find or create <code style={{ background: "#E5E7EB", padding: "1px 5px", borderRadius: 3 }}>robots.txt</code> in your site's root directory</li>
                      <li>In Replit: add it to the <code style={{ background: "#E5E7EB", padding: "1px 5px", borderRadius: 3 }}>/public</code> folder. In other hosts: upload to domain root</li>
                      <li>Click "Check it's live" to confirm it's accessible</li>
                    </ol>
                  )}
                </div>
              </div>
            )}

            {/* Footer buttons */}
            {!generateModal.loading && (
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button
                  onClick={handleCopyModal}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "white", border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer" }}
                >
                  {copiedModal ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                  {copiedModal ? "Copied!" : (generateModal.step.id === "faq_schema" || generateModal.step.id === "org_schema") ? "Copy code" : "Copy content"}
                </button>

                {generateModal.step.verify_url && (
                  <a
                    href={generateModal.step.verify_url.replace("{domain}", domain)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "white", border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer", textDecoration: "none" }}
                  >
                    <ExternalLink size={13} />
                    {generateModal.step.id === "llmstxt" || generateModal.step.id === "robots_txt" ? "Check it's live" : "Verify"}
                  </a>
                )}

                <button
                  onClick={() => {
                    const step = generateModal.step;
                    setGenerateModal(null);
                    setConfirmDialog({ step });
                  }}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 16px", background: "#059669", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", minWidth: 130 }}
                >
                  <Check size={14} />
                  Mark as done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "white", padding: "12px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 1000, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Step Row ─────────────────────────────────────────────────────────────────

interface StepRowProps {
  step: SprintStep;
  isLast: boolean;
  completing: boolean;
  onCheck: () => void;
  onAction: () => void;
}

function StepRow({ step, isLast, completing, onCheck, onAction }: StepRowProps) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px",
      borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
      background: step.completed ? "#F9FAFB" : "white",
      transition: "background 0.2s",
    }}>
      {/* Checkbox */}
      <button
        onClick={onCheck}
        disabled={step.completed || completing}
        style={{ background: "none", border: "none", cursor: step.completed ? "default" : "pointer", padding: 0, marginTop: 2, flexShrink: 0, opacity: completing ? 0.6 : 1 }}
        title={step.completed ? "Done" : "Mark complete"}
      >
        {step.completed ? (
          <CheckCircle size={20} color="#10B981" />
        ) : (
          <Circle size={20} color={completing ? MUTED : "#D1D5DB"} />
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: step.completed ? 500 : 600, color: step.completed ? MUTED : "#111827", textDecoration: step.completed ? "line-through" : "none" }}>
            {step.title}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, background: "#DCFCE7", color: "#166534", padding: "1px 7px", borderRadius: 9999, flexShrink: 0 }}>
            +{step.score_impact} pts
          </span>
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 6, lineHeight: 1.5 }}>{step.why}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {step.affects.map((ai) => {
            const s = aiBadgeStyle(ai);
            return (
              <span key={ai} style={{ fontSize: 10, fontWeight: 600, background: s.bg, color: s.color, padding: "2px 7px", borderRadius: 9999 }}>
                {ai}
              </span>
            );
          })}
          <span style={{ fontSize: 11, color: MUTED, marginLeft: 2 }}>{step.time}</span>
        </div>
      </div>

      {/* Action button */}
      {!step.completed && (
        <button
          onClick={onAction}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 13px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: "white", border: `1.5px solid ${BORDER}`, color: "#374151",
            flexShrink: 0, whiteSpace: "nowrap",
            transition: "all 0.12s",
          }}
        >
          {step.action_type === "link" ? <ExternalLink size={12} /> : <ArrowRight size={12} />}
          {step.action_label}
        </button>
      )}
      {step.completed && step.completed_at && (
        <div style={{ fontSize: 11, color: "#10B981", fontWeight: 500, flexShrink: 0 }}>
          Done
        </div>
      )}
    </div>
  );
}

export default GeoSprint;
