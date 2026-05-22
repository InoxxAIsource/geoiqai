import { useState, useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ExternalLink, Copy, Check, Lock, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getAuthToken } from "@/lib/auth";

interface TaskContent {
  type: string;
  [key: string]: unknown;
}

interface RoadmapTaskItem {
  id: string;
  title: string;
  priority: string;
  timeMinutes: number;
  impactMin: number;
  impactMax: number;
  url?: string | null;
  content?: TaskContent;
}

interface RoadmapWeek {
  id: string;
  label: string;
  subtitle: string;
  targetScore: number;
  fromScore: number;
  toScore: number;
  tasks: RoadmapTaskItem[];
}

interface RoadmapData {
  auditId: string;
  generatedAt: string;
  weeks: RoadmapWeek[];
  completedTaskIds: string[];
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: copied ? "#ecfdf5" : "#f3f4f6", color: copied ? "#059669" : "#374151",
        border: `0.5px solid ${copied ? "#6ee7b7" : "#e5e7eb"}`,
        borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 500,
      }}
    >
      {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
      {copied ? "Copied" : (label ?? "Copy")}
    </button>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    CRITICAL: { bg: "#fef2f2", color: "#991b1b" },
    HIGH:     { bg: "#fffbeb", color: "#92400e" },
    MEDIUM:   { bg: "#f0f9ff", color: "#075985" },
  };
  const s = cfg[priority] ?? cfg.MEDIUM;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>
      {priority}
    </span>
  );
}

function CodeBlock({ code, filename }: { code: string; filename?: string }) {
  return (
    <div style={{ borderRadius: 8, overflow: "hidden", marginTop: 10 }}>
      {filename && (
        <div style={{ background: "#1e2533", padding: "6px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#8b949e", fontFamily: "monospace" }}>{filename}</span>
          <CopyBtn text={code} />
        </div>
      )}
      <div style={{ background: "#0d1117", padding: "14px 16px", position: "relative" }}>
        {!filename && (
          <div style={{ position: "absolute", top: 10, right: 12 }}>
            <CopyBtn text={code} />
          </div>
        )}
        <pre style={{ fontSize: 12, color: "#e6edf3", fontFamily: "monospace", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, paddingRight: 60 }}>
          {code}
        </pre>
      </div>
    </div>
  );
}

function BeforeAfterBlock({ current, suggested, copyLabel }: { current: string; suggested: string; copyLabel?: string }) {
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Current</div>
        <div style={{ background: "#fef2f2", border: "0.5px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#7f1d1d", lineHeight: 1.5 }}>
          {current || "Not detected"}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Suggested</span>
          <CopyBtn text={suggested} label={copyLabel ?? "Copy"} />
        </div>
        <div style={{ background: "#f0fdf4", border: "0.5px solid #86efac", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#14532d", lineHeight: 1.5 }}>
          {suggested}
        </div>
      </div>
    </div>
  );
}

function TaskContentBlock({ content, brandName }: { content: TaskContent; brandName: string }) {
  if (!content) return null;

  if (content.type === "code") {
    return (
      <div style={{ marginTop: 10 }}>
        {content.instruction && <p style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>{content.instruction as string}</p>}
        {content.code && <CodeBlock code={content.code as string} />}
        {Array.isArray(content.steps) && (
          <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, color: "#374151", lineHeight: 1.8 }}>
            {(content.steps as string[]).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        )}
        {content.testUrl && (
          <a href={content.testUrl as string} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#4F46E5", marginTop: 8, textDecoration: "none" }}>
            Test at: {content.testUrl as string} <ExternalLink style={{ width: 11, height: 11 }} />
          </a>
        )}
      </div>
    );
  }

  if (content.type === "copy") {
    return (
      <div style={{ marginTop: 10 }}>
        {content.label && <p style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>{content.label as string}</p>}
        <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#111827", lineHeight: 1.65, position: "relative" }}>
          {content.text as string}
          <div style={{ marginTop: 8 }}>
            <CopyBtn text={content.text as string} />
          </div>
        </div>
        {content.instruction && <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>{content.instruction as string}</p>}
        {content.categories && <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Categories to select: <strong>{content.categories as string}</strong></p>}
      </div>
    );
  }

  if (content.type === "before-after") {
    return (
      <div style={{ marginTop: 10 }}>
        <BeforeAfterBlock current={content.current as string} suggested={content.suggested as string} />
        {content.instruction && <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>{content.instruction as string}</p>}
      </div>
    );
  }

  if (content.type === "listing") {
    const listing = content as { type: string; name: string; tagline: string; description: string; topics: string[] };
    return (
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { label: "Product name", value: listing.name },
          { label: "Tagline", value: listing.tagline },
          { label: "Topics", value: (listing.topics ?? []).join(", ") },
        ].map((row) => (
          <div key={row.label}>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>{row.label}</div>
            <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#111827", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <span>{row.value}</span>
              <CopyBtn text={row.value} />
            </div>
          </div>
        ))}
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>Description (200 words)</div>
          <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "12px 14px", fontSize: 13, color: "#111827", lineHeight: 1.65 }}>
            {listing.description}
            <div style={{ marginTop: 8 }}><CopyBtn text={listing.description} label="Copy description" /></div>
          </div>
        </div>
      </div>
    );
  }

  if (content.type === "checklist") {
    const items = (content.items ?? []) as Array<{ label: string; url: string }>;
    return (
      <div style={{ marginTop: 10 }}>
        {content.intro && <p style={{ fontSize: 13, color: "#374151", marginBottom: 10, lineHeight: 1.5 }}>{content.intro as string}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item) => (
            <div key={item.url} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "8px 12px" }}>
              <span style={{ fontSize: 13, color: "#374151" }}>{item.label}</span>
              <a href={item.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#4F46E5", textDecoration: "none", fontWeight: 500, flexShrink: 0 }}>
                Open <ExternalLink style={{ width: 11, height: 11 }} />
              </a>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (content.type === "article-outline") {
    const c = content as { type: string; title: string; wordCount: string; keywords: string[]; outline: string[]; internalLinks: Array<{ page: string; anchor: string }> };
    return (
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>Suggested title</div>
          <div style={{ background: "#f0f9ff", border: "0.5px solid #bae6fd", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#0c4a6e", fontWeight: 500, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <span>{c.title}</span>
            <CopyBtn text={c.title} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>Target word count</div>
            <div style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{c.wordCount} words</div>
          </div>
        </div>
        {c.keywords && c.keywords.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Target keywords</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {c.keywords.map((k) => (
                <span key={k} style={{ background: "#ede9fe", color: "#5b21b6", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 500 }}>{k}</span>
              ))}
            </div>
          </div>
        )}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Full outline</div>
            <CopyBtn text={c.outline.join("\n")} label="Copy outline" />
          </div>
          <div style={{ background: "#0d1117", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 13, color: "#e6edf3", fontFamily: "monospace", lineHeight: 1.9 }}>
              <div style={{ color: "#58a6ff", fontWeight: 600, marginBottom: 4 }}>H1: {c.title}</div>
              {c.outline.map((line, i) => (
                <div key={i} style={{ color: "#e6edf3" }}>{line}</div>
              ))}
            </div>
          </div>
        </div>
        {c.internalLinks && c.internalLinks.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Internal link suggestions</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8 }}>
              Once published, link to this article from:
              {c.internalLinks.map((l) => (
                <div key={l.page} style={{ marginLeft: 12 }}>- {l.page} - anchor: <strong>{l.anchor}</strong></div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (content.type === "reddit") {
    const c = content as { type: string; subreddits: string[]; questionTypes: string[]; replyTemplate: string; threadTitle: string; threadBody: string };
    return (
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Target subreddits (1 hour/week)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(c.subreddits ?? []).map((s) => (
              <a key={s} href={`https://reddit.com/${s}`} target="_blank" rel="noreferrer"
                style={{ background: "#fff7ed", color: "#c2410c", border: "0.5px solid #fed7aa", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                {s}
              </a>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Find threads asking about</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151", lineHeight: 1.8 }}>
            {(c.questionTypes ?? []).map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Reply template - adapt naturally</span>
            <CopyBtn text={c.replyTemplate} />
          </div>
          <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#111827", lineHeight: 1.65 }}>
            {c.replyTemplate}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Post this thread yourself</div>
          <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "10px 14px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span>{c.threadTitle}</span>
              <CopyBtn text={c.threadTitle} label="Copy title" />
            </div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.65, borderTop: "0.5px solid #e5e7eb", paddingTop: 8 }}>
              {c.threadBody}
              <div style={{ marginTop: 8 }}><CopyBtn text={c.threadBody} label="Copy body" /></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (content.type === "newsletters") {
    const items = (content.items ?? []) as Array<{ name: string; url: string; subscribers: string; pitch: string; subject: string }>;
    return (
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((n) => (
          <div key={n.name} style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <a href={n.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 14, color: "#4F46E5", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {n.name} <ExternalLink style={{ width: 11, height: 11 }} />
                </a>
                <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>{n.subscribers} subscribers</span>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Subject line</span>
                <CopyBtn text={n.subject} label="Copy subject" />
              </div>
              <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 5, padding: "7px 10px", fontSize: 12, color: "#374151", fontStyle: "italic" }}>
                {n.subject}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Pitch (3 sentences)</span>
                <CopyBtn text={n.pitch} label="Copy pitch" />
              </div>
              <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 5, padding: "10px 12px", fontSize: 13, color: "#374151", lineHeight: 1.65 }}>
                {n.pitch}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (content.type === "instructions") {
    return (
      <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, color: "#374151", lineHeight: 1.8 }}>
        {((content.steps ?? []) as string[]).map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    );
  }

  return null;
}

function TaskCard({
  task, completed, onToggle, brandName,
}: {
  task: RoadmapTaskItem; completed: boolean; onToggle: (id: string) => void; brandName: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: "white", border: "0.5px solid #e5e7eb",
      borderLeft: `3px solid ${completed ? "#10b981" : task.priority === "CRITICAL" ? "#ef4444" : task.priority === "HIGH" ? "#f59e0b" : "#4F46E5"}`,
      borderRadius: 10, marginBottom: 8, overflow: "hidden",
      opacity: completed ? 0.8 : 1,
    }}>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <button
            onClick={() => onToggle(task.id)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, marginTop: 1 }}
          >
            {completed
              ? <CheckCircle2 style={{ width: 20, height: 20, color: "#10b981" }} />
              : <Circle style={{ width: 20, height: 20, color: "#d1d5db" }} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
              <PriorityBadge priority={task.priority} />
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{task.timeMinutes} mins</span>
              <span style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>+{task.impactMin} to +{task.impactMax} points</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: completed ? "#6b7280" : "#111827", textDecoration: completed ? "line-through" : "none" }}>
              {task.title}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {task.url && (
              <a href={task.url} target="_blank" rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#4F46E5", textDecoration: "none", fontWeight: 500, background: "#ede9fe", borderRadius: 5, padding: "4px 8px" }}>
                Open <ExternalLink style={{ width: 11, height: 11 }} />
              </a>
            )}
            {task.content && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4, display: "flex" }}
              >
                {expanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
              </button>
            )}
          </div>
        </div>
      </div>
      {expanded && task.content && (
        <div style={{ borderTop: "0.5px solid #f3f4f6", padding: "12px 14px 16px 14px" }}>
          <TaskContentBlock content={task.content} brandName={brandName} />
        </div>
      )}
    </div>
  );
}

function WeekProgress({ week, completed }: { week: RoadmapWeek; completed: number }) {
  const total = week.tasks.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const estGain = week.tasks.reduce((sum, t) => sum + Math.round((t.impactMin + t.impactMax) / 2), 0);
  return (
    <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
          {week.label} Progress: {completed}/{total} tasks done
        </span>
        <span style={{ fontSize: 12, color: "#10b981", fontWeight: 500 }}>
          Estimated gain: +{estGain} points
        </span>
      </div>
      <div style={{ height: 5, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#4F46E5,#7C3AED)", borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

export default function Roadmap() {
  const params = new URLSearchParams(window.location.search);
  const auditId = params.get("auditId");

  const { data: me, isLoading: meLoading } = useGetMe();
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState("w1");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!auditId) { setError("No audit ID provided"); setLoading(false); return; }
    const token = getAuthToken();
    if (!token) { setError("Sign in to view your roadmap"); setLoading(false); return; }

    fetch(`/api/roadmap/${auditId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
        }
        return r.json() as Promise<RoadmapData>;
      })
      .then((data) => {
        setRoadmap(data);
        setCompletedIds(new Set(data.completedTaskIds));
        setLoading(false);
      })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [auditId]);

  async function toggleTask(taskId: string) {
    if (!auditId || toggling) return;
    setToggling(taskId);
    const token = getAuthToken();
    try {
      const r = await fetch(`/api/roadmap/${auditId}/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const j = await r.json() as { completed: boolean; taskId: string };
      setCompletedIds((prev) => {
        const next = new Set(prev);
        if (j.completed) next.add(taskId); else next.delete(taskId);
        return next;
      });
    } catch {
      // silently ignore toggle errors
    } finally {
      setToggling(null);
    }
  }

  const isPaid = me?.plan === "starter" || me?.plan === "agency";
  const brandParam = params.get("brand") ?? "";
  const brandName = brandParam || (roadmap ? roadmap.auditId : "your brand");

  if (loading || meLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
        <Navbar />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80 }}>
          <div style={{ width: 40, height: 40, border: "3px solid #4F46E5", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 16 }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: "#6b7280", fontSize: 14 }}>Building your execution roadmap...</p>
          <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>This may take up to 30 seconds the first time</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
        <Navbar />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, textAlign: "center" }}>
          <Lock style={{ width: 40, height: 40, color: "#d1d5db", marginBottom: 16 }} />
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", marginBottom: 8 }}>{error}</h2>
          {!isPaid && (
            <a href="/pricing" style={{ background: "#4F46E5", color: "white", padding: "12px 28px", borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: "none", marginTop: 16, display: "inline-block" }}>
              Upgrade to unlock roadmap
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!roadmap) return null;

  const activeWeekData = roadmap.weeks.find((w) => w.id === activeWeek) ?? roadmap.weeks[0];
  const weekCompletedCount = activeWeekData?.tasks.filter((t) => completedIds.has(t.id)).length ?? 0;
  const totalTasks = roadmap.weeks.reduce((sum, w) => sum + w.tasks.length, 0);
  const totalCompleted = roadmap.weeks.reduce((sum, w) => sum + w.tasks.filter((t) => completedIds.has(t.id)).length, 0);
  const WEEK_LABELS = ["Week 1-2", "Week 2-3", "Week 3-4", "Week 4-5"];

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <Navbar />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px 60px" }}>

        {/* Back */}
        <a href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "#6b7280", textDecoration: "none", marginBottom: 20 }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Back to dashboard
        </a>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>GEO IQ Execution Roadmap</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
            Your step-by-step plan to improve visibility in ChatGPT, Gemini, and Perplexity.
          </p>

          {/* Overall progress */}
          <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>Total progress: {totalCompleted}/{totalTasks} tasks</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Generated {new Date(roadmap.generatedAt).toLocaleDateString()}</span>
            </div>
            <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100)}%`, background: "linear-gradient(90deg,#4F46E5,#7C3AED)", borderRadius: 3, transition: "width 0.5s ease" }} />
            </div>
          </div>
        </div>

        {/* Week tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "0.5px solid #e5e7eb" }}>
          {roadmap.weeks.map((week, i) => {
            const wCompleted = week.tasks.filter((t) => completedIds.has(t.id)).length;
            const isDone = wCompleted === week.tasks.length && week.tasks.length > 0;
            const isActive = activeWeek === week.id;
            return (
              <button
                key={week.id}
                onClick={() => setActiveWeek(week.id)}
                style={{
                  flex: 1, padding: "10px 8px", border: "none", borderBottom: isActive ? "2px solid #4F46E5" : "2px solid transparent",
                  background: "none", cursor: "pointer",
                  color: isActive ? "#4F46E5" : "#6b7280",
                  fontWeight: isActive ? 600 : 400, fontSize: 13,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {isDone && <CheckCircle2 style={{ width: 12, height: 12, color: "#10b981" }} />}
                  {WEEK_LABELS[i]}
                </span>
                <span style={{ fontSize: 11, fontWeight: 400, color: isDone ? "#10b981" : "#9ca3af" }}>
                  {week.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active week */}
        {activeWeekData && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                    Target: {activeWeekData.targetScore}+ GEO IQ
                  </h2>
                  <p style={{ fontSize: 13, color: "#6b7280" }}>{activeWeekData.subtitle}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>Score journey</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    {activeWeekData.fromScore} <span style={{ color: "#9ca3af" }}>-</span> {activeWeekData.toScore}+ GEO IQ
                  </div>
                </div>
              </div>
            </div>

            <WeekProgress week={activeWeekData} completed={weekCompletedCount} />

            <div style={{ display: "flex", flexDirection: "column" }}>
              {activeWeekData.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  completed={completedIds.has(task.id)}
                  onToggle={toggleTask}
                  brandName={brandName}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
