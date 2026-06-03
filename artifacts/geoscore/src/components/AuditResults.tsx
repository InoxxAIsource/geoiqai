import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useEmailSubscribe } from "@workspace/api-client-react";

const AI_ENGINES_CONFIG = [
  { name: "ChatGPT",    logo: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/openai.svg",       color: "#10a37f", bg: "#f0fdf9", hue: "150deg" },
  { name: "Gemini",     logo: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/googlegemini.svg", color: "#4285f4", bg: "#eff6ff", hue: "220deg" },
  { name: "Perplexity", logo: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/perplexity.svg",   color: "#20b2aa", bg: "#f0fdfc", hue: "170deg" },
  { name: "Claude",     logo: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/claude.svg",       color: "#cc785c", bg: "#fdf6f3", hue: "20deg"  },
  { name: "Grok",       logo: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/x.svg",            color: "#0f172a", bg: "#f8fafc", hue: null     },
];

interface AuditResultsProps {
  domain: string;
  score: number;
  enginesFound: number;
  blindSpots: number;
  techScore: number;
  engines: Array<{ name: string; score: number; status: string }>;
  techChecks: Array<{ label: string; score: number; pass: boolean }>;
  roadmap: Array<{ week: string; target: string; label: string; detail: string; locked: boolean }>;
  isPaid: boolean;
  onReset: () => void;
}

function EngineLogo({ name, hue, logo, bg }: { name: string; hue: string | null; logo: string; bg: string }) {
  return (
    <div style={{ width: 22, height: 22, borderRadius: 6, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <img
        src={logo}
        width={14} height={14}
        style={{
          objectFit: "contain",
          filter: hue ? `invert(40%) sepia(100%) saturate(500%) hue-rotate(${hue})` : "none",
        }}
        alt={name}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}

export function AuditResults({ domain, score, enginesFound, blindSpots, techScore, engines, techChecks, roadmap, isPaid, onReset }: AuditResultsProps) {
  const [activeTab, setActiveTab] = useState<"visibility" | "technical" | "roadmap">("visibility");
  const [displayScore, setDisplayScore] = useState(0);
  const [barsVisible, setBarsVisible] = useState(false);
  const [email, setEmail] = useState("");
  const rafRef = useRef<number | null>(null);
  const subscribeMutation = useEmailSubscribe();

  const scoreColor = score >= 60 ? "#16a34a" : score >= 35 ? "#d97706" : "#dc2626";
  const arcR = 50;
  const arcCirc = 2 * Math.PI * arcR;
  const arcMax = arcCirc * 0.75;
  const arcDash = `${arcMax} ${arcCirc}`;
  const arcOffset = arcMax * (1 - displayScore / 100);

  useEffect(() => {
    const start = performance.now();
    const duration = 1400;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(eased * score));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    const barTimer = setTimeout(() => setBarsVisible(true), 500);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(barTimer);
    };
  }, [score]);

  const scoreLabel = score >= 60
    ? { text: "Partially visible", color: "#d97706", bg: "#fffbeb" }
    : score >= 35
    ? { text: "Low visibility", color: "#d97706", bg: "#fffbeb" }
    : { text: "Invisible to AI", color: "#dc2626", bg: "#fef2f2" };

  const shareText = `My brand scored ${score}/100 on AI visibility. ${enginesFound}/5 AI engines found me. Checked with @BeingtauheedTk GeoIQ → geoiqai.com`;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  const fadeStyle = (delay: number): React.CSSProperties => ({
    opacity: 1,
    transform: "none",
    animation: `ar-fade-up 0.45s ease ${delay}s both`,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f0", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes ar-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ar-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>

      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 50, padding: "0 24px" }}>
        <div style={{ maxWidth: 740, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "6px 14px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "ar-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>Audit complete</span>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 740, margin: "0 auto", padding: "24px 16px 48px" }}>

        {/* Domain row */}
        <div style={{ marginBottom: 20, ...fadeStyle(0.05) }}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>AI Visibility Audit - just now</div>
          <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-0.04em", color: "#0f172a" }}>{domain}</div>
        </div>

        {/* Score hero card */}
        <div style={{ background: "#0f172a", borderRadius: 20, padding: 24, marginBottom: 16, position: "relative", overflow: "hidden", ...fadeStyle(0.12) }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            {/* Arc ring */}
            <svg width="118" height="118" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
              <circle cx="60" cy="60" r={arcR} fill="none" stroke="#1e293b" strokeWidth="7" />
              <circle
                cx="60" cy="60" r={arcR} fill="none"
                stroke={scoreColor} strokeWidth="7"
                strokeDasharray={arcDash}
                strokeDashoffset={arcOffset}
                strokeLinecap="round"
                transform="rotate(135 60 60)"
                style={{ transition: "stroke-dashoffset 0.05s linear" }}
              />
              <text x="60" y="56" textAnchor="middle" dominantBaseline="middle"
                fontSize="28" fontWeight="900" fill={scoreColor} fontFamily="Inter, sans-serif">
                {displayScore}
              </text>
              <text x="60" y="74" textAnchor="middle" dominantBaseline="middle"
                fontSize="11" fill="#475569" fontFamily="Inter, sans-serif">/100</text>
            </svg>

            {/* Right side */}
            <div style={{ flex: 1, minWidth: 180 }}>
              <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: scoreLabel.color, background: scoreLabel.bg, borderRadius: 99, padding: "3px 10px", marginBottom: 10 }}>
                {scoreLabel.text}
              </span>
              <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-0.04em", color: "#f1f5f9", lineHeight: 1.25, marginBottom: 8 }}>
                Your brand is{" "}
                <em style={{ fontStyle: "italic", color: "#818cf8" }}>invisible</em>{" "}
                to AI right now.
              </div>
              <div style={{ fontSize: 13, color: "#475569" }}>{enginesFound} of 5 AI engines are recommending you.</div>
            </div>
          </div>

          {/* Stat pills */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 20 }}>
            {[
              { label: "Engines found",  value: `${enginesFound}/5`, color: "#ef4444" },
              { label: "Blind spots",    value: blindSpots,           color: "#f59e0b" },
              { label: "Tech score",     value: `${techScore}/100`,   color: "#22c55e" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#1e293b", borderRadius: 10, padding: "12px 14px", textAlign: "center" as const }}>
                <div style={{ fontWeight: 900, fontSize: 20, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "#64748b", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 4, display: "flex", gap: 2, marginBottom: 16, ...fadeStyle(0.19) }}>
          {(["visibility", "technical", "roadmap"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "9px 0", border: "none", cursor: "pointer", borderRadius: 9,
              background: activeTab === tab ? "#0f172a" : "transparent",
              color: activeTab === tab ? "#f1f5f9" : "#9ca3af",
              fontWeight: 700, fontSize: 12, fontFamily: "Inter, sans-serif",
              textTransform: "capitalize" as const,
              transition: "all 0.2s",
            }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* VISIBILITY TAB */}
        {activeTab === "visibility" && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px", marginBottom: 16, ...fadeStyle(0.05) }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Brand recognition by AI</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>5 engines checked</div>
            </div>

            {engines.map((engine) => {
              const cfg = AI_ENGINES_CONFIG.find((c) => c.name === engine.name) ?? AI_ENGINES_CONFIG[0]!;
              const isFound = engine.score > 0;
              return (
                <div key={engine.name} style={{ padding: "11px 0", borderBottom: "1px solid #f9fafb" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, display: "inline-block", flexShrink: 0 }} />
                      <EngineLogo name={cfg.name} hue={cfg.hue} logo={cfg.logo} bg={cfg.bg} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>{engine.name}</span>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                      background: isFound ? "#fffbeb" : "#fef2f2",
                      color: isFound ? "#d97706" : "#dc2626",
                    }}>{engine.status}</span>
                  </div>
                  <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      background: isFound ? cfg.color : "#f3f4f6",
                      width: barsVisible ? `${Math.max(engine.score, 0)}%` : "0%",
                      transition: "width 1.2s cubic-bezier(0.16,1,0.3,1)",
                      minWidth: engine.score > 0 ? 5 : 0,
                    }} />
                  </div>
                </div>
              );
            })}

            {!isPaid && (
              <div style={{ marginTop: 16, border: "1.5px dashed #e5e7eb", borderRadius: 10, background: "#fafafa", textAlign: "center" as const, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                  See what Claude, Grok + Google AI say about you
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>Unlock 4 more AI responses with a paid plan</div>
                <Link href="/pricing" style={{ display: "inline-block", marginTop: 12, background: "#6366f1", color: "white", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                  Unlock full results
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TECHNICAL TAB */}
        {activeTab === "technical" && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px", marginBottom: 16, ...fadeStyle(0.05) }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Technical GEO audit</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{techChecks.length} signals checked</div>
            </div>

            {techChecks.length === 0 && (
              <div style={{ textAlign: "center" as const, padding: "24px 0", color: "#9ca3af", fontSize: 13 }}>
                No technical data available for this domain yet.
              </div>
            )}

            {techChecks.map((check, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #f9fafb" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: check.pass ? "#f0fdf4" : "#fffbeb",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                  }}>
                    {check.pass ? "+" : "!"}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{check.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: check.pass ? "#16a34a" : "#d97706" }}>
                    {check.score}/100
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                    background: check.pass ? "#f0fdf4" : "#fffbeb",
                    color: check.pass ? "#16a34a" : "#d97706",
                    border: `1px solid ${check.pass ? "#bbf7d0" : "#fde68a"}`,
                  }}>
                    {check.pass ? "PASS" : "WARN"}
                  </span>
                </div>
              </div>
            ))}

            {techChecks.length > 0 && (
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Technical GEO Score</span>
                <span style={{ fontWeight: 900, fontSize: 22, color: "#16a34a", letterSpacing: "-0.04em" }}>{techScore}/100</span>
              </div>
            )}
          </div>
        )}

        {/* ROADMAP TAB */}
        {activeTab === "roadmap" && (
          <div style={{ marginBottom: 16, ...fadeStyle(0.05) }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Your visibility roadmap</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Score {score}/100 - path to 80+</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {roadmap.map((item, i) => (
                  <div key={i} style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
                    {item.locked ? (
                      <div style={{ background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, filter: "blur(2px)", userSelect: "none" as const }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#9ca3af", marginBottom: 6 }}>{item.week}</div>
                        <div style={{ fontWeight: 900, fontSize: 18, color: "#6366f1", letterSpacing: "-0.04em", marginBottom: 4 }}>{item.target}</div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.detail}</div>
                      </div>
                    ) : (
                      <div style={{ background: "#fff", border: "1px solid #c7d2fe", borderRadius: 12, padding: 16, boxShadow: "0 0 0 2px rgba(99,102,241,0.06)" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#9ca3af", marginBottom: 6 }}>{item.week}</div>
                        <div style={{ fontWeight: 900, fontSize: 18, color: "#6366f1", letterSpacing: "-0.04em", marginBottom: 4 }}>{item.target}</div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.detail}</div>
                      </div>
                    )}
                    {item.locked && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(248,250,252,0.5)", backdropFilter: "blur(2px)", borderRadius: 12 }}>
                        <span style={{ fontSize: 20 }}>&#128274;</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* CTA card */}
            <div style={{ background: "#0f172a", borderRadius: 16, padding: 24, textAlign: "center" as const, position: "relative", overflow: "hidden", marginBottom: 16 }}>
              <div style={{ position: "absolute", bottom: -30, right: -30, width: 160, height: 160, background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
              <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-0.04em", color: "#f1f5f9", marginBottom: 10, lineHeight: 1.3 }}>
                Go from <em style={{ fontStyle: "italic", color: "#818cf8" }}>invisible</em> to recommended.
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 20, lineHeight: 1.6 }}>
                Get exact tasks, AI-ready content, and a 4-week fix plan. Most brands reach 50+ GEO IQ in 30 days.
              </div>
              <Link href="/pricing" style={{
                display: "block", background: "#6366f1", color: "white",
                borderRadius: 10, padding: 15, fontSize: 15, fontWeight: 800,
                textDecoration: "none", letterSpacing: "-0.02em",
                transition: "background 0.2s, transform 0.2s, box-shadow 0.2s",
              }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = "#4f46e5"; el.style.transform = "translateY(-1px)"; el.style.boxShadow = "0 6px 20px rgba(99,102,241,0.35)"; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = "#6366f1"; el.style.transform = "none"; el.style.boxShadow = "none"; }}
              >
                Unlock full roadmap - Rs 3,999/mo
              </Link>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 10 }}>
                7-day free trial - cancel anytime - Rs 3,999/mo via Razorpay
              </div>
            </div>
          </div>
        )}

        {/* Share + Reset buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, ...fadeStyle(0.26) }}>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 11, fontSize: 12, fontWeight: 700, color: "#374151", textDecoration: "none", cursor: "pointer" }}
          >
            Share score on X
          </a>
          <button
            onClick={onReset}
            style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 11, fontSize: 12, fontWeight: 700, color: "#374151", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
          >
            Check another domain
          </button>
        </div>

        {/* Email subscribe card */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 18, textAlign: "center" as const, ...fadeStyle(0.33) }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 4 }}>Get free weekly GEO digest</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>Tips to improve your AI visibility score every week</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              placeholder="founder@startup.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none", color: "#0f172a" }}
            />
            <button
              onClick={() => { if (email) { subscribeMutation.mutate({ data: { email, domain } }); setEmail(""); } }}
              disabled={subscribeMutation.isPending}
              style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", flexShrink: 0 }}
            >
              {subscribeMutation.isPending ? "..." : "Subscribe"}
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
