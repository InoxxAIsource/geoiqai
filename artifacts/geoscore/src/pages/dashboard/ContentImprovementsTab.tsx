import { useState } from "react";
import { Copy, CheckCircle2, RefreshCw, Loader2, AlertCircle, ClipboardList } from "lucide-react";

interface CategoryScores {
  contentQuality: number;
  authoritySignals: number;
  technicalStructure: number;
  engagementSignals: number;
}

interface ImprovementSection {
  id: string;
  name: string;
  currentContent: string;
  improvedContent: string;
  reason: string;
  citabilityBefore: number;
  citabilityAfter: number;
  eeat: string[];
}

interface AnalysisResult {
  domain: string;
  analyzedAt: string;
  readinessScore: number;
  categoryScores: CategoryScores;
  sections: ImprovementSection[];
}

const EEAT_COLORS: Record<string, { bg: string; text: string }> = {
  Experience:   { bg: "#EFF6FF", text: "#1D4ED8" },
  Expertise:    { bg: "#F0FDF4", text: "#166534" },
  Authority:    { bg: "#FFF7ED", text: "#9A3412" },
  Trust:        { bg: "#FAF5FF", text: "#7E22CE" },
};

function CitabilityBar({ before, after }: { before: number; after: number }) {
  return (
    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>Before</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#DC2626" }}>{before}/100</span>
        </div>
        <div style={{ height: 5, background: "#FEE2E2", borderRadius: 3 }}>
          <div style={{ height: "100%", width: `${before}%`, background: "#DC2626", borderRadius: 3 }} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>After</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#059669" }}>{after}/100</span>
        </div>
        <div style={{ height: 5, background: "#DCFCE7", borderRadius: 3 }}>
          <div style={{ height: "100%", width: `${after}%`, background: "#059669", borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  domain,
}: {
  section: ImprovementSection;
  domain: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(section.improvedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMissing = section.currentContent.startsWith("[Missing");

  return (
    <div style={{
      background: "white",
      border: isMissing ? "1px solid #E0E7FF" : "1px solid #E5E7EB",
      borderRadius: 12,
      padding: 24,
      marginBottom: 16,
    }}>
      {/* Card header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{section.name}</div>
          {isMissing && (
            <span style={{
              background: "#EEF2FF",
              color: "#4F46E5",
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 4,
              letterSpacing: "0.02em",
            }}>
              RECOMMENDED ADDITION
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{domain}</div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Left: Current */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isMissing ? "#C7D2FE" : "#9CA3AF" }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: isMissing ? "#818CF8" : "#6B7280" }}>
              {isMissing ? "Currently missing" : "Current Content"}
            </span>
          </div>
          <div style={{
            background: isMissing ? "#F5F3FF" : "#F9FAFB",
            border: isMissing ? "1.5px dashed #C7D2FE" : "1px solid #E5E7EB",
            borderRadius: 8,
            padding: 16,
            fontSize: 14,
            color: isMissing ? "#818CF8" : "#374151",
            lineHeight: 1.7,
            minHeight: 80,
            fontStyle: isMissing ? "italic" : "normal",
          }}>
            {isMissing ? "This section does not exist on the site yet. Adding it will significantly improve AI citability." : section.currentContent}
          </div>
        </div>

        {/* Right: Improved */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <CheckCircle2 size={14} color="#059669" />
            <span style={{ fontSize: 13, fontWeight: 500, color: "#059669" }}>Improved Version</span>
          </div>
          <div style={{
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: 8,
            padding: 16,
            fontSize: 14,
            color: "#065F46",
            lineHeight: 1.7,
            minHeight: 80,
          }}>
            {section.improvedContent}
          </div>
          <button
            onClick={handleCopy}
            style={{
              marginTop: 8,
              width: "100%",
              height: 36,
              background: copied ? "#059669" : "#059669",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "opacity 150ms",
            }}
          >
            {copied ? (
              <><CheckCircle2 size={14} /> Copied!</>
            ) : (
              <><Copy size={14} /> Copy improved version</>
            )}
          </button>
        </div>
      </div>

      {/* Citability bars */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "#6B7280", marginBottom: 4 }}>
          Citability score
        </div>
        <CitabilityBar before={section.citabilityBefore} after={section.citabilityAfter} />
      </div>

      {/* EEAT tags */}
      {section.eeat && section.eeat.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {section.eeat.map(tag => {
            const colors = EEAT_COLORS[tag] ?? { bg: "#F3F4F6", text: "#374151" };
            return (
              <span key={tag} style={{
                background: colors.bg,
                color: colors.text,
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
              }}>
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {/* Why explanation */}
      <div style={{
        background: "#EFF6FF",
        border: "1px solid #BFDBFE",
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
        <p style={{ fontSize: 13, color: "#1E40AF", lineHeight: 1.6, margin: 0 }}>
          <strong>Why this improves AI visibility:</strong> {section.reason}
        </p>
      </div>
    </div>
  );
}

function ReadinessHeader({ result }: { result: AnalysisResult }) {
  const { readinessScore, categoryScores, domain, analyzedAt } = result;
  const scoreColor = readinessScore >= 67 ? "#059669" : readinessScore >= 34 ? "#D97706" : "#DC2626";

  const cats = [
    { label: "Content Quality", value: categoryScores.contentQuality },
    { label: "Authority Signals", value: categoryScores.authoritySignals },
    { label: "Technical Structure", value: categoryScores.technicalStructure },
    { label: "Engagement Signals", value: categoryScores.engagementSignals },
  ];

  const date = new Date(analyzedAt).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div style={{
      background: "white",
      border: "1px solid #E2E8F0",
      borderRadius: 16,
      padding: 28,
      marginBottom: 20,
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    }}>
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
            AI Search Readiness
          </div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 64, fontWeight: 800, lineHeight: 1, color: scoreColor }}>
            {readinessScore}<span style={{ fontSize: 20, color: "#CBD5E1", fontWeight: 400 }}>%</span>
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
            Based on content analysis of {domain}
          </div>
          <div style={{ fontSize: 11, color: "#CBD5E1", marginTop: 2 }}>Last analyzed: {date}</div>
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          {cats.map(c => (
            <div key={c.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: "#374151" }}>{c.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: c.value >= 60 ? "#059669" : c.value >= 40 ? "#D97706" : "#DC2626" }}>{c.value}%</span>
              </div>
              <div style={{ height: 6, background: "#F1F5F9", borderRadius: 3 }}>
                <div style={{
                  height: "100%",
                  width: `${c.value}%`,
                  background: c.value >= 60 ? "#059669" : c.value >= 40 ? "#D97706" : "#DC2626",
                  borderRadius: 3,
                  transition: "width 0.8s ease",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Props {
  brand: { id: string; domain: string; brandName: string | null } | null;
}

export function ContentImprovementsTab({ brand }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const analyze = async () => {
    if (!brand) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("geoscore_token");
      const resp = await fetch("/api/content-improvements/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ domain: brand.domain }),
      });
      const data = (await resp.json()) as AnalysisResult & { error?: string };
      if (!resp.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    if (!result) return;
    const text = [
      `GeoIQ Content Improvements for ${result.domain}`,
      `Generated: ${new Date(result.analyzedAt).toLocaleDateString("en-IN")}`,
      `AI Search Readiness Score: ${result.readinessScore}%`,
      "",
      ...result.sections.map(s => [
        `SECTION: ${s.name}`,
        `Current: ${s.currentContent}`,
        `Improved: ${s.improvedContent}`,
        `Why: ${s.reason}`,
        "",
      ].join("\n")),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  if (!brand) {
    return (
      <div style={{ textAlign: "center", paddingTop: 60, color: "#9CA3AF", fontSize: 14 }}>
        Select a brand to analyze its content.
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
            Content Improvements
          </h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
            AI-optimized rewrites of your actual homepage content. Copy and replace to immediately improve AI citability.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {result && (
            <button
              onClick={copyAll}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "white", border: "1px solid #E2E8F0", borderRadius: 8,
                padding: "8px 14px", fontSize: 13, color: "#374151", cursor: "pointer",
              }}
            >
              {copiedAll ? <CheckCircle2 size={14} color="#059669" /> : <ClipboardList size={14} />}
              {copiedAll ? "Copied!" : "Copy all"}
            </button>
          )}
          <button
            onClick={analyze}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#4F46E5", color: "white", border: "none", borderRadius: 8,
              padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Analyzing...</>
            ) : (
              <><RefreshCw size={14} /> {result ? "Re-analyze" : "Analyze latest content"} &rarr;</>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10,
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
        }}>
          <AlertCircle size={16} color="#DC2626" />
          <span style={{ fontSize: 13, color: "#991B1B" }}>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && !result && (
        <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <Loader2 size={28} color="#4F46E5" style={{ animation: "spin 1s linear infinite", marginBottom: 16 }} />
          <div style={{ fontSize: 15, fontWeight: 500, color: "#0F172A", marginBottom: 8 }}>
            Analyzing {brand.domain}...
          </div>
          <div style={{ fontSize: 13, color: "#94A3B8" }}>
            Scraping content, detecting sections, and generating AI-optimized improvements.
            <br />This takes 15-30 seconds.
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div style={{
          background: "white", border: "1px dashed #E2E8F0", borderRadius: 12,
          padding: "48px 24px", textAlign: "center",
        }}>
          <div style={{ width: 48, height: 48, background: "#EEF2FF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <ClipboardList size={22} color="#4F46E5" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#0F172A", marginBottom: 8 }}>
            No analysis yet for {brand.domain}
          </div>
          <p style={{ fontSize: 14, color: "#94A3B8", maxWidth: 420, margin: "0 auto 24px", lineHeight: 1.6 }}>
            Click "Analyze latest content" to scrape your homepage and get AI-generated rewrites of each section, optimized for ChatGPT, Gemini, and Perplexity.
          </p>
          <button
            onClick={analyze}
            style={{
              background: "#4F46E5", color: "white", border: "none", borderRadius: 8,
              padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Analyze latest content &rarr;
          </button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          <ReadinessHeader result={result} />

          <div style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            Section improvements ({result.sections.length})
          </div>

          {result.sections.map(section => (
            <SectionCard key={section.id} section={section} domain={result.domain} />
          ))}
        </>
      )}
    </div>
  );
}
