import { useEffect, useState } from "react";
import { Link } from "wouter";

const STEPS = [
  { label: "Fetching & crawling your domain",       category: "TECHNICAL", color: "#3b82f6", signals: 4  },
  { label: "Detecting brand category & market",     category: "ENTITY",    color: "#8b5cf6", signals: 6  },
  { label: "Running ChatGPT visibility prompts",    category: "AI MEMORY", color: "#10b981", signals: 8  },
  { label: "Running Gemini & Perplexity prompts",   category: "LIVE WEB",  color: "#20b2aa", signals: 8  },
  { label: "Scoring technical GEO signals",         category: "TECHNICAL", color: "#3b82f6", signals: 12 },
  { label: "Building your fix roadmap",             category: "CITATIONS", color: "#f59e0b", signals: 9  },
];

const TOTAL_SIGNALS = STEPS.reduce((s, st) => s + st.signals, 0);

const CITE_CARDS = [
  { key: "C", label: "Citations",    color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", sub: "Checking citation sources"  },
  { key: "I", label: "Indexability", color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", sub: "Crawlability & llms.txt"    },
  { key: "T", label: "Technical",    color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", sub: "Schema & content signals"   },
  { key: "E", label: "Entity",       color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", sub: "Brand entity mapping"       },
];

const ENGINES = [
  { name: "ChatGPT",    logo: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/openai.svg",        color: "#10a37f", bg: "#f0fdf9", sub: "AI Memory scan", hue: "150deg"  },
  { name: "Gemini",     logo: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/googlegemini.svg",  color: "#4285f4", bg: "#eff6ff", sub: "Live web scan",  hue: "220deg"  },
  { name: "Perplexity", logo: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/perplexity.svg",    color: "#20b2aa", bg: "#f0fdfc", sub: "Live web scan",  hue: "170deg"  },
  { name: "Claude",     logo: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/anthropic.svg",     color: "#cc785c", bg: "#fdf6f3", sub: "AI Memory scan", hue: "20deg"   },
  { name: "Grok",       logo: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/x.svg",             color: "#0f172a", bg: "#f8fafc", sub: "AI Memory scan", hue: null      },
];

const MESSAGES = [
  { cat: "AI MEMORY", color: "#10b981", text: "Asking ChatGPT if it knows your brand"    },
  { cat: "CITATIONS", color: "#f59e0b", text: "Scanning Gemini for brand citations"       },
  { cat: "TECHNICAL", color: "#3b82f6", text: "Analysing your llms.txt & robots.txt"     },
  { cat: "ENTITY",    color: "#8b5cf6", text: "Mapping entity consistency across AI"      },
  { cat: "LIVE WEB",  color: "#20b2aa", text: "Checking Perplexity live web results"      },
  { cat: "CITATIONS", color: "#f59e0b", text: "Scoring citation gap opportunities"        },
  { cat: "AI MEMORY", color: "#10b981", text: "Detecting competitor AI mentions"          },
  { cat: "TECHNICAL", color: "#3b82f6", text: "Building your GEO IQ score"               },
];

interface Props {
  url: string;
  loadingStep: number;
  doneSteps: boolean[];
  elapsedSeconds: number;
}

export function AuditThinking({ url, loadingStep, doneSteps, elapsedSeconds }: Props) {
  const [citeActive, setCiteActive] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const citeTimer = setInterval(() => setCiteActive((p) => (p + 1) % 4), 1800);
    const msgTimer  = setInterval(() => setMsgIndex((p) => (p + 1) % MESSAGES.length), 2400);
    const dotTimer  = setInterval(() => setDots((p) => (p + 1) % 4), 450);
    return () => { clearInterval(citeTimer); clearInterval(msgTimer); clearInterval(dotTimer); };
  }, []);

  const progress = Math.round(
    ((loadingStep + (doneSteps[loadingStep] ? 1 : 0)) / STEPS.length) * 100
  );
  const signalsChecked = STEPS.reduce((sum, step, i) => {
    if (doneSteps[i]) return sum + step.signals;
    if (i === loadingStep) return sum + Math.floor(step.signals * 0.5);
    return sum;
  }, 0);
  const issuesFound = Math.round((progress / 100) * 28);
  const aiSystemsChecked = doneSteps[4] ? 5 : doneSteps[3] ? 3 : doneSteps[2] ? 1 : 0;

  const engineStatus = (i: number): "done" | "scanning" | "queued" => {
    if (i === 0) return doneSteps[2] ? "done" : loadingStep >= 2 ? "scanning" : "queued";
    if (i === 1) return doneSteps[3] ? "done" : loadingStep >= 3 ? "scanning" : "queued";
    if (i === 2) return doneSteps[3] ? "done" : loadingStep >= 3 ? "scanning" : "queued";
    if (i === 3) return doneSteps[4] ? "done" : loadingStep >= 4 ? "scanning" : "queued";
    if (i === 4) return doneSteps[4] ? "done" : loadingStep >= 4 ? "scanning" : "queued";
    return "queued";
  };

  const msg = MESSAGES[msgIndex]!;
  const dotStr = ".".repeat(dots);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f0", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>

      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 50, padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
              <path d="M32 20 A12 12 0 1 1 20 8" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
              <path d="M20 8 L28 8 L28 16" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="20" cy="20" r="2.5" fill="#6366f1"/>
            </svg>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.04em", color: "#0f172a" }}>
              Geo<span style={{ color: "#6366f1" }}>IQ</span>
            </span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 20, padding: "6px 14px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", display: "inline-block", animation: "iq-pulse 1.4s ease-in-out infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6366f1" }}>Scanning now</span>
          </div>
        </div>
      </nav>

      <style>{`
        @keyframes iq-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes iq-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes iq-progress-glow {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(99,102,241,0.5); }
          50% { box-shadow: 0 0 16px 4px rgba(99,102,241,0.8); }
        }
      `}</style>

      <main style={{ flex: 1, padding: "32px 16px 48px", maxWidth: 860, margin: "0 auto", width: "100%" }}>

        {/* Dark main card */}
        <div style={{ background: "#0f172a", borderRadius: 20, padding: "28px 28px 24px", marginBottom: 20 }}>

          {/* Top row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontWeight: 900, fontSize: 18, color: "#fff", letterSpacing: "-0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "70%" }}>
              {url || "your domain"}
            </span>
            <span style={{ fontWeight: 900, fontSize: 22, color: "#6366f1", letterSpacing: "-0.04em" }}>{progress}%</span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: "#1e293b", borderRadius: 99, overflow: "visible", marginBottom: 20 }}>
            <div style={{
              height: 4, borderRadius: 99,
              background: "linear-gradient(90deg, #6366f1, #818cf8)",
              width: `${progress}%`,
              transition: "width 1.6s ease",
              animation: "iq-progress-glow 2s ease-in-out infinite",
            }} />
          </div>

          {/* Signals counter */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e293b", borderRadius: 10, padding: "12px 16px", marginBottom: 24 }}>
            <span style={{ fontSize: 14, color: "#94a3b8" }}>
              <strong style={{ fontWeight: 900, fontSize: 20, color: "#fff", fontFamily: "Inter, sans-serif" }}>{signalsChecked}</strong>
              <span style={{ marginLeft: 4 }}>/ {TOTAL_SIGNALS} signals checked</span>
            </span>
            <span style={{ fontWeight: 900, fontSize: 22, color: "#6366f1", letterSpacing: "-0.04em" }}>{progress}%</span>
          </div>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {STEPS.map((step, i) => {
              const isDone = doneSteps[i];
              const isCurrent = loadingStep === i && !isDone;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: i < STEPS.length - 1 ? "1px solid #1e293b" : "none",
                  opacity: i > loadingStep ? 0.3 : 1,
                  transition: "opacity 0.4s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isDone ? "#10b981" : isCurrent ? "#6366f1" : "#334155",
                      transition: "background 0.35s",
                    }}>
                      {isDone ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : isCurrent ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "iq-spin 1s linear infinite" }}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      ) : null}
                    </div>
                    <span style={{ fontSize: 14, color: isDone ? "#e2e8f0" : isCurrent ? "#fff" : "#64748b", fontWeight: isCurrent ? 600 : 400 }}>
                      {step.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                      padding: "2px 7px", borderRadius: 99,
                      background: isDone || isCurrent ? `${step.color}22` : "#1e293b",
                      color: isDone || isCurrent ? step.color : "#475569",
                      border: `1px solid ${isDone || isCurrent ? step.color + "44" : "#334155"}`,
                    }}>
                      {step.category}
                    </span>
                    <span style={{ fontSize: 11, color: isDone ? "#10b981" : isCurrent ? "#6366f1" : "#334155", fontWeight: 500, minWidth: 44, textAlign: "right" as const }}>
                      {step.signals} sig
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom counters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
            <div style={{ background: "#1e293b", borderRadius: 10, padding: "14px 16px", textAlign: "center" as const }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-0.04em" }}>{aiSystemsChecked}</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#64748b", marginTop: 5 }}>AI Systems Checked</div>
            </div>
            <div style={{ background: "#1e293b", borderRadius: 10, padding: "14px 16px", textAlign: "center" as const }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#6366f1", lineHeight: 1, letterSpacing: "-0.04em" }}>{issuesFound}</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#64748b", marginTop: 5 }}>Issues Found</div>
            </div>
          </div>
        </div>

        {/* CITE signal categories card */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px 20px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#9ca3af", marginBottom: 16 }}>
            Checking CITE signal categories
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {CITE_CARDS.map((card, i) => {
              const active = citeActive === i;
              return (
                <div key={card.key} style={{
                  borderRadius: 10, padding: "14px 14px",
                  background: active ? card.bg : "#f8fafc",
                  border: `1px solid ${active ? card.border : "#e5e7eb"}`,
                  transition: "all 0.4s ease",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                      background: active ? card.color : "#e5e7eb",
                      color: "#fff", fontWeight: 900, fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 0.4s",
                    }}>{card.key}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: active ? card.color : "#6b7280", transition: "color 0.4s" }}>
                      {card.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: active ? card.color : "#9ca3af", paddingLeft: 34, transition: "color 0.4s" }}>
                    {card.sub}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Engines card */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#9ca3af", marginBottom: 16 }}>
            Querying AI engines
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ENGINES.map((eng, i) => {
              const status = engineStatus(i);
              return (
                <div key={eng.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: eng.bg, display: "flex", alignItems: "center", justifyContent: "center",
                      ["--hue" as string]: eng.hue ?? "0deg",
                    }}>
                      <img
                        src={eng.logo}
                        alt={eng.name}
                        width={20} height={20}
                        style={{
                          objectFit: "contain",
                          filter: eng.hue
                            ? "invert(40%) sepia(100%) saturate(500%) hue-rotate(var(--hue, 120deg))"
                            : "invert(0)",
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          if (target.parentElement) {
                            target.parentElement.innerHTML = eng.name.charAt(0);
                            target.parentElement.style.fontWeight = "800";
                            target.parentElement.style.color = eng.color;
                            target.parentElement.style.fontSize = "14px";
                          }
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{eng.name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>
                        {status === "done" ? "Visibility data collected" : status === "scanning" ? "Running prompts" + dotStr : "Queued"}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99,
                    background: status === "done" ? "#f0fdf4" : status === "scanning" ? "#eef2ff" : "#f1f5f9",
                    color: status === "done" ? "#10b981" : status === "scanning" ? "#6366f1" : "#94a3b8",
                    border: `1px solid ${status === "done" ? "#bbf7d0" : status === "scanning" ? "#c7d2fe" : "#e2e8f0"}`,
                    transition: "all 0.4s",
                  }}>
                    {status === "done" ? "Done" : status === "scanning" ? "Scanning..." : "Queued"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live message ticker */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: msg.color, flexShrink: 0, display: "inline-block", animation: "iq-pulse 1.4s ease-in-out infinite" }} />
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              padding: "2px 8px", borderRadius: 99,
              background: `${msg.color}18`, color: msg.color,
              border: `1px solid ${msg.color}33`,
            }}>{msg.cat}</span>
            <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{msg.text}</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" as const, flexShrink: 0 }}>{elapsedSeconds}s</span>
          </div>
        </div>

        {/* Bottom note */}
        <p style={{ textAlign: "center" as const, fontSize: 12, color: "#9ca3af", margin: 0 }}>
          Free audit checks 5 AI engines across 47 signals. Usually completes in 60-90 seconds.
        </p>

      </main>
    </div>
  );
}
