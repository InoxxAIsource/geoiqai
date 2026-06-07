import { useState } from "react";
import { ExternalLink, Search, Loader2, Copy, Check, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { getToken } from "@/lib/auth";

const P = "#4F46E5";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  title: string;
  url: string;
  date: string | null;
  snippet: string;
}

interface Journalist {
  name: string;
  publication: string;
  articles: Article[];
  article_count: number;
  twitter: string | null;
  linkedin_url: string | null;
  profile_snippet: string | null;
}

interface CoverageResult {
  title?: string;
  url: string;
  publishedDate?: string;
  author?: string;
  highlights?: string[];
  opportunity?: boolean;
  note?: string;
}

interface Pitch {
  subject: string;
  body: string;
  personalization: string;
}

interface OutreachEntry {
  id: string;
  journalist: string;
  publication: string;
  subject: string;
  body: string;
  status: "draft" | "sent" | "replied" | "pass";
  createdAt: string;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; }
}

function CoverageCard({ item, onPitch }: { item: CoverageResult; onPitch?: () => void }) {
  return (
    <div style={{ border: `1px solid ${item.opportunity ? RED + "55" : BORDER}`, borderRadius: 8, padding: "12px 14px", background: item.opportunity ? "#FEF2F2" : "white" }}>
      {item.opportunity && (
        <div style={{ display: "inline-block", background: RED, color: "white", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 7px", marginBottom: 6, letterSpacing: "0.04em" }}>
          PITCH OPPORTUNITY
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 4, lineHeight: 1.4 }}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
          {item.title ?? item.url}
        </a>
      </div>
      {(item.author || item.publishedDate) && (
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>
          {item.author && <span>{item.author}</span>}
          {item.author && item.publishedDate && <span> - </span>}
          {item.publishedDate && <span>{formatDate(item.publishedDate)}</span>}
        </div>
      )}
      {item.highlights && item.highlights.length > 0 && (
        <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5, margin: "0 0 8px" }}>{item.highlights[0]}</p>
      )}
      {item.note && <p style={{ fontSize: 11, color: RED, margin: "0 0 8px" }}>{item.note}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: P, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
          <ExternalLink size={11} /> Read article
        </a>
        {onPitch && (
          <button onClick={onPitch} style={{ fontSize: 11, color: item.opportunity ? RED : P, background: "none", border: `1px solid ${item.opportunity ? RED + "55" : P + "44"}`, borderRadius: 5, padding: "2px 9px", cursor: "pointer", fontWeight: 600 }}>
            {item.opportunity ? "Pitch this author" : "Pitch author"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Tab 1: Journalist Finder ─────────────────────────────────────────────────

const TOPIC_CHIPS = ["AI SEO", "GEO", "ChatGPT SEO", "AI search", "LLM marketing", "Perplexity SEO"];

function JournalistFinder({ onWritePitch }: { onWritePitch: (j: Journalist) => void }) {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journalists, setJournalists] = useState<Journalist[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  async function search(t: string) {
    if (!t.trim()) return;
    setLoading(true);
    setError(null);
    setJournalists([]);
    try {
      const data = await apiFetch<{ journalists: Journalist[] }>("/api/ai-pr/find-journalists", { topic: t });
      setJournalists(data.journalists);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Find journalists covering AI search and GEO</div>
        <div style={{ fontSize: 13, color: MUTED }}>Searches recent articles to surface reporters who write about your space.</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {TOPIC_CHIPS.map(chip => (
          <button key={chip} onClick={() => { setTopic(chip); search(chip); }}
            style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, border: `1px solid ${BORDER}`, background: topic === chip ? P : "white", color: topic === chip ? "white" : "#374151", cursor: "pointer", fontWeight: topic === chip ? 600 : 400 }}>
            {chip}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search(topic)}
          placeholder="Or type a custom topic..."
          style={{ flex: 1, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none" }}
        />
        <button onClick={() => search(topic)} disabled={loading || !topic.trim()}
          style={{ padding: "9px 18px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: !topic.trim() ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}>
          {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={14} />}
          Search
        </button>
      </div>

      {error && <div style={{ padding: "10px 14px", background: "#FEF2F2", border: `1px solid ${RED}44`, borderRadius: 8, color: RED, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {journalists.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {journalists.map((j, idx) => (
            <div key={j.name} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", background: "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{j.name}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{j.publication} - {j.article_count} {j.article_count === 1 ? "article" : "articles"}</div>
                </div>
              </div>

              {j.profile_snippet && (
                <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5, margin: "8px 0", fontStyle: "italic" }}>"{j.profile_snippet}"</p>
              )}

              {j.articles[0] && (
                <div style={{ background: BG, borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 2, lineHeight: 1.4 }}>
                    <a href={j.articles[0].url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                      {j.articles[0].title}
                    </a>
                  </div>
                  {j.articles[0].date && <div style={{ fontSize: 11, color: MUTED }}>{formatDate(j.articles[0].date)}</div>}
                  {j.articles[0].snippet && <p style={{ fontSize: 11, color: "#4B5563", margin: "4px 0 0", lineHeight: 1.4 }}>{j.articles[0].snippet}</p>}
                </div>
              )}

              {j.articles.length > 1 && (
                <button onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  style={{ fontSize: 11, color: MUTED, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 8, display: "flex", alignItems: "center", gap: 3 }}>
                  {expandedIdx === idx ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {expandedIdx === idx ? "Hide" : `+${j.articles.length - 1} more articles`}
                </button>
              )}

              {expandedIdx === idx && j.articles.slice(1).map(a => (
                <div key={a.url} style={{ background: BG, borderRadius: 6, padding: "6px 10px", marginBottom: 4 }}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: P, textDecoration: "none", lineHeight: 1.4, display: "block" }}>{a.title}</a>
                  {a.date && <div style={{ fontSize: 10, color: MUTED }}>{formatDate(a.date)}</div>}
                </div>
              ))}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {j.twitter && (
                    <span style={{ fontSize: 11, color: MUTED, background: BG, borderRadius: 4, padding: "2px 7px" }}>{j.twitter}</span>
                  )}
                  {j.linkedin_url && (
                    <a href={j.linkedin_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: P, textDecoration: "none", background: BG, borderRadius: 4, padding: "2px 7px" }}>
                      LinkedIn
                    </a>
                  )}
                </div>
                <button onClick={() => onWritePitch(j)}
                  style={{ fontSize: 12, color: "white", background: P, border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
                  Write Pitch
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && journalists.length === 0 && topic && !error && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: MUTED, fontSize: 13 }}>
          No journalists found for this topic. Try a different search term.
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Coverage Monitor ──────────────────────────────────────────────────

function CoverageMonitor({ onPitch }: { onPitch: (j: { name?: string; pub?: string }) => void }) {
  const [brand, setBrand] = useState("GeoIQ");
  const [competitor, setCompetitor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    brand_mentions: CoverageResult[];
    competitor_mentions: CoverageResult[];
    opportunities: CoverageResult[];
    similar_sites: CoverageResult[];
  } | null>(null);

  async function monitor() {
    if (!brand.trim() || !competitor.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<typeof result & { success: boolean }>("/api/ai-pr/monitor-coverage", { brand, competitor });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Monitor failed");
    } finally {
      setLoading(false);
    }
  }

  function SectionHeader({ title, count, highlight }: { title: string; count: number; highlight?: string }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{title}</div>
        <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: highlight ? RED + "1A" : BG, color: highlight ? RED : MUTED }}>
          {count}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Monitor coverage</div>
        <div style={{ fontSize: 13, color: MUTED }}>See who's writing about you vs. your competitor, and find articles to target.</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Your brand name"
          style={{ flex: 1, minWidth: 160, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none" }} />
        <input value={competitor} onChange={e => setCompetitor(e.target.value)} onKeyDown={e => e.key === "Enter" && monitor()} placeholder="Competitor name"
          style={{ flex: 1, minWidth: 160, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none" }} />
        <button onClick={monitor} disabled={loading || !brand.trim() || !competitor.trim()}
          style={{ padding: "9px 18px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: !brand.trim() || !competitor.trim() ? 0.5 : 1 }}>
          {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={14} />}
          Monitor Coverage
        </button>
      </div>

      {error && <div style={{ padding: "10px 14px", background: "#FEF2F2", border: `1px solid ${RED}44`, borderRadius: 8, color: RED, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {result.opportunities.length > 0 && (
            <div>
              <SectionHeader title="Pitch Opportunities" count={result.opportunities.length} highlight="yes" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.opportunities.map(item => (
                  <CoverageCard key={item.url} item={item} onPitch={() => onPitch({ name: item.author })} />
                ))}
              </div>
            </div>
          )}

          <div>
            <SectionHeader title={`${brand} Mentions`} count={result.brand_mentions.length} />
            {result.brand_mentions.length === 0
              ? <div style={{ fontSize: 13, color: MUTED, padding: "12px 0" }}>No recent articles found mentioning {brand}. This is normal for newer brands.</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.brand_mentions.map(item => <CoverageCard key={item.url} item={item} onPitch={() => onPitch({ name: item.author })} />)}
              </div>
            }
          </div>

          <div>
            <SectionHeader title={`${competitor} Mentions`} count={result.competitor_mentions.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.competitor_mentions.map(item => <CoverageCard key={item.url} item={item} onPitch={() => onPitch({ name: item.author })} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Pitch Generator ───────────────────────────────────────────────────

const PITCH_ANGLES = [
  "Tool review request",
  "Original research data",
  "Expert commentary",
  "Guest post offer",
  "Product launch",
];

function PitchGenerator({ prefill }: { prefill: { name?: string; publication?: string } | null }) {
  const [journalistName, setJournalistName] = useState(prefill?.name ?? "");
  const [publication, setPublication] = useState(prefill?.publication ?? "");
  const [articleUrl, setArticleUrl] = useState("");
  const [pitchAngle, setPitchAngle] = useState(PITCH_ANGLES[0]!);
  const [keyMessage, setKeyMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [copiedField, setCopiedField] = useState<"subject" | "body" | null>(null);

  // Local outreach tracker stored in localStorage
  const [outreach, setOutreach] = useState<OutreachEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("geo_pr_outreach") ?? "[]") as OutreachEntry[]; } catch { return []; }
  });

  function saveToTracker(p: Pitch) {
    const entry: OutreachEntry = {
      id: Date.now().toString(),
      journalist: journalistName,
      publication,
      subject: p.subject,
      body: p.body,
      status: "draft",
      createdAt: new Date().toISOString(),
    };
    const updated = [entry, ...outreach];
    setOutreach(updated);
    localStorage.setItem("geo_pr_outreach", JSON.stringify(updated));
    return entry;
  }

  function updateStatus(id: string, status: OutreachEntry["status"]) {
    const updated = outreach.map(e => e.id === id ? { ...e, status } : e);
    setOutreach(updated);
    localStorage.setItem("geo_pr_outreach", JSON.stringify(updated));
  }

  async function generate() {
    if (!journalistName.trim() || !publication.trim()) return;
    setLoading(true);
    setError(null);
    setPitch(null);
    try {
      const data = await apiFetch<{ pitch: Pitch }>("/api/ai-pr/generate-pitch", {
        journalistName, publication, articleUrl, pitchAngle, keyMessage,
      });
      setPitch(data.pitch);
      saveToTracker(data.pitch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, field: "subject" | "body") {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function gmailLink(p: Pitch) {
    return `https://mail.google.com/mail/?view=cm&su=${encodeURIComponent(p.subject)}&body=${encodeURIComponent(p.body)}`;
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Generate a pitch email</div>
        <div style={{ fontSize: 13, color: MUTED }}>Writes a personalized email referencing the journalist's recent work.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Journalist name</label>
          <input value={journalistName} onChange={e => setJournalistName(e.target.value)} placeholder="e.g. Danny Goodwin"
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Publication</label>
          <input value={publication} onChange={e => setPublication(e.target.value)} placeholder="e.g. Search Engine Land"
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Article URL (optional - helps personalize)</label>
        <input value={articleUrl} onChange={e => setArticleUrl(e.target.value)} placeholder="https://..."
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Pitch angle</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PITCH_ANGLES.map(angle => (
            <label key={angle} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="radio" name="pitchAngle" value={angle} checked={pitchAngle === angle} onChange={() => setPitchAngle(angle)} style={{ accentColor: P }} />
              <span style={{ fontSize: 13, color: "#374151" }}>{angle}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Key message (optional)</label>
        <input value={keyMessage} onChange={e => setKeyMessage(e.target.value)} placeholder="e.g. GeoIQ is the first free AI visibility audit tool for Indian startups"
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      </div>

      <button onClick={generate} disabled={loading || !journalistName.trim() || !publication.trim()}
        style={{ padding: "10px 22px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 7, opacity: !journalistName.trim() || !publication.trim() ? 0.5 : 1 }}>
        {loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : null}
        {loading ? "Generating..." : "Generate Pitch"}
      </button>

      {error && <div style={{ marginTop: 14, padding: "10px 14px", background: "#FEF2F2", border: `1px solid ${RED}44`, borderRadius: 8, color: RED, fontSize: 13 }}>{error}</div>}

      {pitch && (
        <div style={{ marginTop: 20, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ background: BG, borderBottom: `1px solid ${BORDER}`, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Email Preview</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => copy(pitch.subject, "subject")}
                style={{ fontSize: 11, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "3px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                {copiedField === "subject" ? <Check size={11} color={GREEN} /> : <Copy size={11} />}
                Subject
              </button>
              <button onClick={() => copy(pitch.body, "body")}
                style={{ fontSize: 11, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "3px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                {copiedField === "body" ? <Check size={11} color={GREEN} /> : <Copy size={11} />}
                Email
              </button>
              <a href={gmailLink(pitch)} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: P, background: "white", border: `1px solid ${P}44`, borderRadius: 5, padding: "3px 10px", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                <ExternalLink size={11} /> Open in Gmail
              </a>
              <button onClick={generate}
                style={{ fontSize: 11, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "3px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <RefreshCw size={11} /> Regenerate
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Subject: {pitch.subject}</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{pitch.body}</div>
            {pitch.personalization && (
              <div style={{ marginTop: 14, padding: "8px 12px", background: BG, borderRadius: 6, fontSize: 12, color: MUTED, fontStyle: "italic" }}>
                {pitch.personalization}
              </div>
            )}
          </div>
        </div>
      )}

      {outreach.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Outreach tracker</div>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr", padding: "8px 14px", background: BG, borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <div>Journalist</div>
              <div>Publication</div>
              <div>Subject</div>
              <div>Status</div>
            </div>
            {outreach.slice(0, 20).map(entry => (
              <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr", padding: "10px 14px", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{entry.journalist}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{entry.publication}</div>
                <div style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.subject}</div>
                <select
                  value={entry.status}
                  onChange={e => updateStatus(entry.id, e.target.value as OutreachEntry["status"])}
                  style={{ fontSize: 11, padding: "3px 7px", border: `1px solid ${BORDER}`, borderRadius: 5, color: entry.status === "replied" ? GREEN : entry.status === "sent" ? AMBER : entry.status === "pass" ? RED : MUTED, background: "white", cursor: "pointer", outline: "none" }}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="replied">Replied</option>
                  <option value="pass">Pass</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main AiPRTab component ───────────────────────────────────────────────────

const TABS = ["Journalist Finder", "Coverage Monitor", "Pitch Generator"] as const;
type Tab = typeof TABS[number];

export function AiPRTab() {
  const [activeTab, setActiveTab] = useState<Tab>("Journalist Finder");
  const [pitchPrefill, setPitchPrefill] = useState<{ name?: string; publication?: string } | null>(null);

  function goToPitch(j: { name?: string; publication?: string }) {
    setPitchPrefill(j);
    setActiveTab("Pitch Generator");
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 4 }}>AI PR</div>
        <div style={{ fontSize: 13, color: MUTED }}>Find journalists covering your space, monitor coverage, and generate personalized pitches.</div>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 24 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: "9px 18px", background: "none", border: "none", borderBottom: `2px solid ${activeTab === tab ? P : "transparent"}`,
              fontSize: 13, fontWeight: activeTab === tab ? 600 : 400, color: activeTab === tab ? P : MUTED,
              cursor: "pointer", marginBottom: -1,
            }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Journalist Finder" && (
        <JournalistFinder onWritePitch={j => goToPitch({ name: j.name, publication: j.publication })} />
      )}
      {activeTab === "Coverage Monitor" && (
        <CoverageMonitor onPitch={goToPitch} />
      )}
      {activeTab === "Pitch Generator" && (
        <PitchGenerator prefill={pitchPrefill} />
      )}
    </div>
  );
}
