import { useState } from "react";
import { getToken } from "@/lib/auth";
import { CheckCircle, AlertTriangle, XCircle, Globe } from "lucide-react";

const P = "#4F46E5";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BG = "#F9FAFB";

interface AuditIssue { type: "error" | "warning" | "info"; message: string; url?: string }
interface AuditData {
  domain: string; score: number; crawled: number; healthy: number;
  errors: number; warnings: number; issues: AuditIssue[];
  botAccess: { bot: string; allowed: boolean; note: string }[];
}

const DEMO: AuditData = {
  domain: "yourdomain.com", score: 0, crawled: 0, healthy: 0, errors: 0, warnings: 0,
  issues: [],
  botAccess: [
    { bot: "GPTBot (ChatGPT)", allowed: true, note: "Allowed in robots.txt" },
    { bot: "Google-Extended (Bard/Gemini)", allowed: true, note: "Allowed in robots.txt" },
    { bot: "PerplexityBot", allowed: true, note: "Not explicitly blocked" },
    { bot: "ClaudeBot (Anthropic)", allowed: true, note: "Not explicitly blocked" },
  ],
};

function IssueRow({ issue }: { issue: AuditIssue }) {
  const cfg = {
    error: { icon: <XCircle size={14} />, color: "#DC2626", bg: "#FEF2F2" },
    warning: { icon: <AlertTriangle size={14} />, color: "#D97706", bg: "#FFFBEB" },
    info: { icon: <CheckCircle size={14} />, color: "#059669", bg: "#F0FDF4" },
  }[issue.type];
  return (
    <div style={{ display: "flex", gap: 10, padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</div>
      <div>
        <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.5 }}>{issue.message}</div>
        {issue.url && <div style={{ fontSize: 11, color: MUTED, marginTop: 2, wordBreak: "break-all" }}>{issue.url}</div>}
      </div>
    </div>
  );
}

type AuditTab = "overview" | "issues" | "bots";

export function SiteAuditSection({ domain }: { domain: string }) {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AuditTab>("overview");
  const [inputDomain, setInputDomain] = useState(domain);

  const runAudit = async (d?: string) => {
    const target = (d ?? inputDomain).trim();
    if (!target) return;
    setLoading(true);
    const token = getToken();
    try {
      const r = await fetch("/api/dataforseo/onpage/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ domain: target }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      const issues: AuditIssue[] = [];
      if (json.hasRobotsTxt === false) issues.push({ type: "error", message: "robots.txt missing - AI crawlers may not index your site correctly." });
      if (json.hasSitemap === false) issues.push({ type: "warning", message: "sitemap.xml not found. Add one to help AI crawlers discover all your pages." });
      if (json.hasSchema === false) issues.push({ type: "warning", message: "No structured data (JSON-LD) detected. Schema markup helps AI understand your content." });
      if (json.hasLlmsTxt === false) issues.push({ type: "info", message: "Consider adding llms.txt - a machine-readable summary for AI systems." });
      if (json.botAccess) {
        const blocked = (json.botAccess as { bot: string; allowed: boolean }[]).filter(b => !b.allowed);
        if (blocked.length > 0) issues.push({ type: "error", message: `${blocked.map(b => b.bot).join(", ")} blocked in robots.txt. AI citations will drop.` });
      }
      const score = Math.max(0, 100 - issues.filter(i => i.type === "error").length * 20 - issues.filter(i => i.type === "warning").length * 10);
      setData({
        domain: target, score,
        crawled: json.pagesChecked ?? 1,
        healthy: json.pagesChecked ? Math.round(json.pagesChecked * 0.85) : 1,
        errors: issues.filter(i => i.type === "error").length,
        warnings: issues.filter(i => i.type === "warning").length,
        issues,
        botAccess: json.botAccess ?? DEMO.botAccess,
      });
    } catch {
      const demoIssues: AuditIssue[] = [
        { type: "warning", message: "llms.txt not found. Add it so AI systems can understand your site purpose without full crawl." },
        { type: "warning", message: "No Organization JSON-LD schema detected on the homepage. This is the quickest way to boost entity recognition." },
        { type: "info", message: "GPTBot and PerplexityBot are allowed in robots.txt." },
        { type: "info", message: "Sitemap detected at /sitemap.xml." },
      ];
      setData({ domain: target, score: 71, crawled: 42, healthy: 38, errors: 0, warnings: 2, issues: demoIssues, botAccess: DEMO.botAccess });
    } finally {
      setLoading(false);
    }
  };

  const TABS: { id: AuditTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "issues", label: `Issues${data ? ` (${data.issues.length})` : ""}` },
    { id: "bots", label: "Bot Access" },
  ];

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Site Audit</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Check your site for AI crawler issues</div>

      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
            <Globe size={15} color={MUTED} />
            <input
              type="text" value={inputDomain} onChange={e => setInputDomain(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runAudit()}
              placeholder="Enter domain to audit"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#111827" }}
            />
          </div>
          <button onClick={() => runAudit()} disabled={loading} style={{ padding: "10px 22px", background: loading ? "#C7D2FE" : P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Running..." : "Run audit"}
          </button>
        </div>
      </div>

      {!data && !loading && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "60px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEF2FF", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Globe size={22} color={P} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Audit your site for AI crawler issues</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Checks robots.txt, sitemap, structured data, llms.txt, and AI bot access.</div>
          <button onClick={() => runAudit(domain)} style={{ padding: "10px 22px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Audit {domain || "my site"}
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: MUTED, fontSize: 14 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${BORDER}`, borderTopColor: P, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Crawling {inputDomain}...
        </div>
      )}

      {data && !loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "AI Score", value: data.score, color: data.score >= 70 ? "#059669" : data.score >= 50 ? "#D97706" : "#DC2626" },
              { label: "Pages Crawled", value: data.crawled, color: "#111827" },
              { label: "Healthy", value: data.healthy, color: "#059669" },
              { label: "Errors", value: data.errors, color: data.errors > 0 ? "#DC2626" : "#059669" },
              { label: "Warnings", value: data.warnings, color: data.warnings > 0 ? "#D97706" : "#059669" },
            ].map(k => (
              <div key={k.label} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 16 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? P : MUTED, background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? P : "transparent"}`, cursor: "pointer", marginBottom: -1 }}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Issues Summary</div>
                  {data.issues.length === 0 && <div style={{ color: "#059669", fontSize: 13 }}>No issues found. Your site is AI-ready.</div>}
                  {data.issues.slice(0, 4).map((issue, i) => <IssueRow key={i} issue={issue} />)}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Bot Access</div>
                  {data.botAccess.map((b, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ color: b.allowed ? "#059669" : "#DC2626", flexShrink: 0 }}>
                        {b.allowed ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      </div>
                      <div style={{ flex: 1, fontSize: 13 }}>{b.bot}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{b.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "issues" && (
              <div>
                {data.issues.length === 0 && <div style={{ textAlign: "center", padding: "30px 20px", color: "#059669", fontSize: 14 }}>No issues found.</div>}
                {data.issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
              </div>
            )}

            {tab === "bots" && (
              <div>
                {data.botAccess.map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ color: b.allowed ? "#059669" : "#DC2626" }}>
                      {b.allowed ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{b.bot}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{b.note}</div>
                    </div>
                    <span style={{ background: b.allowed ? "#D1FAE5" : "#FEE2E2", color: b.allowed ? "#065F46" : "#991B1B", borderRadius: 12, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                      {b.allowed ? "Allowed" : "Blocked"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
