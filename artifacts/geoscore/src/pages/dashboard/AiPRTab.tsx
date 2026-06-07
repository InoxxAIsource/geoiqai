import { useState, useCallback } from "react";
import { ExternalLink, Search, Loader2, Copy, Check, RefreshCw, Plus, Trash2, ChevronRight, BarChart2, Mail, Eye, AlertCircle } from "lucide-react";
import { getToken } from "@/lib/auth";

const P = "#4F46E5";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";
const SIDEBAR_W = 200;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article { title: string; url: string; date: string | null | undefined; snippet: string }

interface Journalist {
  name: string;
  publication: string;
  domain: string;
  articles: Article[];
  article_count: number;
  twitter: string | null;
  linkedin_url: string | null;
  whySelected: string | null;
}

interface Outlet {
  domain: string;
  name: string;
  articles: { title: string; url: string; date: string | null | undefined }[];
  aiTrustScore: number;
  aiTrustReason: string;
  articleCount: number;
}

interface Mention {
  title: string;
  url: string;
  publishedDate: string | null | undefined;
  author: string | null;
  publication: string;
  snippets: string[];
  sentiment: "Positive" | "Neutral" | "Negative";
}

interface MediaContact {
  id: string;
  listId: string;
  name: string;
  publication: string;
  twitter: string | null;
  linkedinUrl: string | null;
  recentArticleUrl: string;
  recentArticleTitle: string;
  addedAt: string;
}

interface MediaList {
  id: string;
  name: string;
  createdAt: string;
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

interface MonitorAlert {
  id: string;
  keyword: string;
  frequency: "daily" | "weekly";
  createdAt: string;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function lsGet<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") as T ?? fallback; } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ─── API helper ───────────────────────────────────────────────────────────────

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

function fmt(d: string | null | undefined) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; }
}

// ─── Shared small components ──────────────────────────────────────────────────

function ErrorBanner({ msg }: { msg: string }) {
  return <div style={{ padding: "10px 14px", background: "#FEF2F2", border: `1px solid ${RED}44`, borderRadius: 8, color: RED, fontSize: 13, marginBottom: 16 }}>{msg}</div>;
}

function Spinner() {
  return <Loader2 size={15} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />;
}

function TrustBar({ score }: { score: number }) {
  const color = score >= 70 ? GREEN : score >= 40 ? AMBER : RED;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 80, height: 6, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{score}</span>
    </div>
  );
}

function SentimentBadge({ s }: { s: "Positive" | "Neutral" | "Negative" }) {
  const colors: Record<string, string> = { Positive: GREEN, Neutral: AMBER, Negative: RED };
  const c = colors[s] ?? MUTED;
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: `${c}1A`, color: c }}>{s}</span>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: subtitle ? 4 : 0 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>{subtitle}</div>}
    </div>
  );
}

// ─── Section: Dashboard ───────────────────────────────────────────────────────

function DashboardSection({ onNav }: { onNav: (id: SectionId) => void }) {
  const cards: { icon: React.ReactNode; title: string; desc: string; label: string; target: SectionId }[] = [
    { icon: <BarChart2 size={20} color={P} />, title: "Find AI-Cited Media", desc: "Discover outlets LLMs trust most in your industry", label: "Find Media", target: "ai-cited-media" },
    { icon: <Search size={20} color={P} />, title: "Find Journalists", desc: "Search by topic, keyword, or outlet name", label: "Search Contacts", target: "contact-search" },
    { icon: <Mail size={20} color={P} />, title: "Create Pitch Email", desc: "AI writes personalized pitches from your press release or angle", label: "Draft Pitch", target: "create-pitch" },
    { icon: <Eye size={20} color={P} />, title: "Monitor Coverage", desc: "Track brand mentions across news, blogs, and media", label: "Set Up Monitoring", target: "media-monitoring" },
  ];
  return (
    <div>
      <SectionTitle title="AI PR Toolkit" subtitle="Find AI-trusted media, pitch journalists, monitor your coverage" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {cards.map(c => (
          <div key={c.target} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px 20px", background: "white" }}>
            <div style={{ marginBottom: 10 }}>{c.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{c.title}</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 14, lineHeight: 1.5 }}>{c.desc}</div>
            <button onClick={() => onNav(c.target)}
              style={{ fontSize: 12, fontWeight: 600, color: P, background: "#EEF2FF", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              {c.label} <ChevronRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: AI-Cited Media ──────────────────────────────────────────────────

function AiCitedMediaSection({ onFindContact }: { onFindContact: (outlet: string) => void }) {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function search() {
    if (!topic.trim()) return;
    setLoading(true); setError(null); setOutlets([]);
    try {
      const data = await apiFetch<{ outlets: Outlet[] }>("/api/ai-pr/cited-media", { topic });
      setOutlets(data.outlets);
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed"); }
    finally { setLoading(false); }
  }

  const toggleSelect = (domain: string) => {
    setSelected(s => { const n = new Set(s); n.has(domain) ? n.delete(domain) : n.add(domain); return n; });
  };

  const combinedScore = selected.size === 0 ? 0 : Math.round(
    outlets.filter(o => selected.has(o.domain)).reduce((s, o) => s + o.aiTrustScore, 0) / selected.size
  );

  return (
    <div>
      <SectionTitle title="Find AI-Cited Media Outlets"
        subtitle="Discover media outlets that LLMs cite most in your niche. Coverage from these outlets gives your brand the best chance of appearing in AI answers." />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Topic of interest (e.g. AI SEO, GEO, SaaS tools)"
          style={{ flex: 1, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none" }} />
        <button onClick={search} disabled={loading || !topic.trim()}
          style={{ padding: "9px 18px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: !topic.trim() ? 0.5 : 1 }}>
          {loading ? <Spinner /> : <Search size={14} />} Find Media
        </button>
      </div>

      {error && <ErrorBanner msg={error} />}

      {selected.size > 0 && (
        <div style={{ padding: "10px 14px", background: "#EEF2FF", borderRadius: 8, fontSize: 13, color: P, fontWeight: 600, marginBottom: 14 }}>
          {selected.size} outlet{selected.size > 1 ? "s" : ""} selected - Combined AI reach score: {combinedScore}
        </div>
      )}

      {outlets.length > 0 && (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "24px 2fr 1fr 80px 1fr", gap: 12, padding: "10px 16px", background: BG, borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", alignItems: "center" }}>
            <div />
            <div>Outlet</div>
            <div>AI Trust Score</div>
            <div>Articles</div>
            <div>Actions</div>
          </div>
          {outlets.map(o => (
            <div key={o.domain} style={{ display: "grid", gridTemplateColumns: "24px 2fr 1fr 80px 1fr", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, alignItems: "center", background: selected.has(o.domain) ? "#F5F3FF" : "white" }}>
              <input type="checkbox" checked={selected.has(o.domain)} onChange={() => toggleSelect(o.domain)} style={{ accentColor: P }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{o.domain}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{o.aiTrustReason}</div>
              </div>
              <TrustBar score={o.aiTrustScore} />
              <div style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>{o.articleCount}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => onFindContact(o.domain)}
                  style={{ fontSize: 11, color: P, background: "#EEF2FF", border: "none", borderRadius: 5, padding: "4px 9px", cursor: "pointer", fontWeight: 600 }}>
                  Find Contact
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section: Contact Search ──────────────────────────────────────────────────

const KW_CHIPS = ["AI SEO", "GEO", "ChatGPT SEO", "AI search", "LLM", "Brand visibility"];

function ContactSearchSection({ prefillOutlet, onAddToList }: { prefillOutlet?: string; onAddToList: (j: Journalist) => void }) {
  const [tab, setTab] = useState<"ai" | "keyword" | "outlet">(prefillOutlet ? "outlet" : "keyword");
  const [storyDesc, setStoryDesc] = useState("");
  const [keyword, setKeyword] = useState("");
  const [outletName, setOutletName] = useState(prefillOutlet ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journalists, setJournalists] = useState<Journalist[]>([]);

  const search = useCallback(async (mode: "ai" | "keyword" | "outlet", params: Record<string, string>) => {
    setLoading(true); setError(null); setJournalists([]);
    try {
      const data = await apiFetch<{ journalists: Journalist[] }>("/api/ai-pr/find-journalists", { mode, ...params });
      setJournalists(data.journalists);
      if (data.journalists.length === 0) setError("No journalists found for this search. Try broader terms like 'SEO' or 'AI search'.");
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed"); }
    finally { setLoading(false); }
  }, []);

  const TABS: { id: "ai" | "keyword" | "outlet"; label: string }[] = [
    { id: "ai", label: "Search with AI" },
    { id: "keyword", label: "Search by keyword" },
    { id: "outlet", label: "Search by outlet" },
  ];

  return (
    <div>
      <SectionTitle title="Find Journalists" subtitle="Search by topic, keyword, or outlet to find the right reporter for your story." />

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? P : "transparent"}`, fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? P : MUTED, cursor: "pointer", marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ai" && (
        <div>
          <textarea value={storyDesc} onChange={e => setStoryDesc(e.target.value)}
            placeholder="Describe your story and industry. e.g. We built an AI visibility tool that tracks if brands appear in ChatGPT. Looking for journalists covering AI search and marketing technology."
            rows={4}
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
          <button onClick={() => search("ai", { storyDescription: storyDesc })} disabled={loading || !storyDesc.trim()}
            style={{ marginTop: 10, padding: "9px 18px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: !storyDesc.trim() ? 0.5 : 1 }}>
            {loading ? <Spinner /> : <Search size={14} />} Find Journalists
          </button>
        </div>
      )}

      {tab === "keyword" && (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
            {KW_CHIPS.map(chip => (
              <button key={chip} onClick={() => { setKeyword(chip); search("keyword", { topic: chip }); }}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, border: `1px solid ${BORDER}`, background: keyword === chip ? P : "white", color: keyword === chip ? "white" : "#374151", cursor: "pointer", fontWeight: keyword === chip ? 600 : 400 }}>
                {chip}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === "Enter" && search("keyword", { topic: keyword })}
              placeholder="Or type a keyword..."
              style={{ flex: 1, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none" }} />
            <button onClick={() => search("keyword", { topic: keyword })} disabled={loading || !keyword.trim()}
              style={{ padding: "9px 16px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: !keyword.trim() ? 0.5 : 1 }}>
              {loading ? <Spinner /> : <Search size={14} />}
            </button>
          </div>
        </div>
      )}

      {tab === "outlet" && (
        <div style={{ display: "flex", gap: 8 }}>
          <input value={outletName} onChange={e => setOutletName(e.target.value)} onKeyDown={e => e.key === "Enter" && search("outlet", { outlet: outletName })}
            placeholder="Outlet name (e.g. Search Engine Land, TechCrunch)"
            style={{ flex: 1, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none" }} />
          <button onClick={() => search("outlet", { outlet: outletName })} disabled={loading || !outletName.trim()}
            style={{ padding: "9px 18px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: !outletName.trim() ? 0.5 : 1 }}>
            {loading ? <Spinner /> : <Search size={14} />} Search
          </button>
        </div>
      )}

      {error && <div style={{ marginTop: 14 }}><ErrorBanner msg={error} /></div>}

      {journalists.length > 0 && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {journalists.map(j => (
            <div key={`${j.name}:${j.domain}`} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", background: "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{j.name}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{j.publication}</div>
                </div>
                <button onClick={() => onAddToList(j)}
                  style={{ fontSize: 12, color: P, background: "#EEF2FF", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <Plus size={12} /> Add to List
                </button>
              </div>

              {j.whySelected && (
                <div style={{ marginTop: 8, padding: "7px 10px", background: "#F0FDF4", border: `1px solid ${GREEN}33`, borderRadius: 6, fontSize: 12, color: "#166534" }}>
                  Why selected: {j.whySelected}
                </div>
              )}

              {j.articles[0] && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: MUTED, marginBottom: 2 }}>Recent:</div>
                  <a href={j.articles[0].url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: P, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                    <ExternalLink size={11} /> "{j.articles[0].title}" {j.articles[0].date ? `- ${fmt(j.articles[0].date)}` : ""}
                  </a>
                  {j.articles[0].snippet && <p style={{ fontSize: 11, color: "#4B5563", margin: "4px 0 0", lineHeight: 1.5 }}>{j.articles[0].snippet}</p>}
                </div>
              )}

              {j.articles.length > 1 && (
                <div style={{ marginTop: 6, fontSize: 11, color: MUTED }}>{j.article_count} articles found on this topic</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section: Media Lists ─────────────────────────────────────────────────────

function MediaListsSection({ onWritePitch }: { onWritePitch: (j: { name: string; publication: string }) => void }) {
  const [lists, setLists] = useState<MediaList[]>(() => lsGet("geo_pr_lists", []));
  const [contacts, setContacts] = useState<MediaContact[]>(() => lsGet("geo_pr_contacts", []));
  const [newListName, setNewListName] = useState("");
  const [viewingList, setViewingList] = useState<string | null>(null);

  function createList() {
    if (!newListName.trim()) return;
    const l: MediaList = { id: Date.now().toString(), name: newListName.trim(), createdAt: new Date().toISOString() };
    const updated = [l, ...lists];
    setLists(updated); lsSet("geo_pr_lists", updated); setNewListName("");
  }

  function deleteList(id: string) {
    const ul = lists.filter(l => l.id !== id);
    const uc = contacts.filter(c => c.listId !== id);
    setLists(ul); setContacts(uc); lsSet("geo_pr_lists", ul); lsSet("geo_pr_contacts", uc);
    if (viewingList === id) setViewingList(null);
  }

  function removeContact(id: string) {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated); lsSet("geo_pr_contacts", updated);
  }

  const viewing = viewingList ? lists.find(l => l.id === viewingList) : null;
  const viewingContacts = viewingList ? contacts.filter(c => c.listId === viewingList) : [];

  if (viewing) {
    return (
      <div>
        <button onClick={() => setViewingList(null)} style={{ fontSize: 12, color: MUTED, background: "none", border: "none", cursor: "pointer", padding: "0 0 16px", display: "flex", alignItems: "center", gap: 4 }}>
          Back to lists
        </button>
        <SectionTitle title={viewing.name} subtitle={`${viewingContacts.length} contacts`} />
        {viewingContacts.length === 0
          ? <div style={{ fontSize: 13, color: MUTED, padding: "20px 0" }}>No contacts in this list yet. Add journalists from Contact Search.</div>
          : (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, padding: "9px 14px", background: BG, borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <div>Name</div><div>Outlet</div><div>Added</div><div />
              </div>
              {viewingContacts.map(c => (
                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, padding: "11px 14px", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{c.publication}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{fmt(c.addedAt)}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onWritePitch({ name: c.name, publication: c.publication })}
                      style={{ fontSize: 11, color: P, background: "#EEF2FF", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontWeight: 600 }}>
                      Write Pitch
                    </button>
                    <button onClick={() => removeContact(c.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 2 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    );
  }

  return (
    <div>
      <SectionTitle title="Media Lists" subtitle="Organize journalists into lists to manage your outreach campaigns." />
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === "Enter" && createList()}
          placeholder="New list name (e.g. AI SEO Journalists)"
          style={{ flex: 1, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none" }} />
        <button onClick={createList} disabled={!newListName.trim()}
          style={{ padding: "9px 16px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, opacity: !newListName.trim() ? 0.5 : 1 }}>
          <Plus size={14} /> Create List
        </button>
      </div>
      {lists.length === 0
        ? <div style={{ fontSize: 13, color: MUTED, padding: "20px 0" }}>No lists yet. Create one above, then add journalists from Contact Search.</div>
        : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {lists.map(l => {
              const count = contacts.filter(c => c.listId === l.id).length;
              return (
                <div key={l.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", background: "white" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{l.name}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>{count} contact{count !== 1 ? "s" : ""} - Created {fmt(l.createdAt)}</div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button onClick={() => setViewingList(l.id)}
                      style={{ fontSize: 12, color: P, background: "#EEF2FF", border: "none", borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontWeight: 600 }}>View</button>
                    <button onClick={() => deleteList(l.id)}
                      style={{ fontSize: 12, color: RED, background: "#FEF2F2", border: "none", borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontWeight: 600 }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

// ─── Add to List modal ────────────────────────────────────────────────────────

function AddToListModal({ journalist, onClose }: { journalist: Journalist; onClose: () => void }) {
  const [lists, setLists] = useState<MediaList[]>(() => lsGet("geo_pr_lists", []));
  const [contacts, setContacts] = useState<MediaContact[]>(() => lsGet("geo_pr_contacts", []));
  const [newListName, setNewListName] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  function addToList(listId: string) {
    const contact: MediaContact = {
      id: Date.now().toString(),
      listId,
      name: journalist.name,
      publication: journalist.publication,
      twitter: journalist.twitter,
      linkedinUrl: journalist.linkedin_url,
      recentArticleUrl: journalist.articles[0]?.url ?? "",
      recentArticleTitle: journalist.articles[0]?.title ?? "",
      addedAt: new Date().toISOString(),
    };
    const updated = [contact, ...contacts];
    setContacts(updated); lsSet("geo_pr_contacts", updated);
    setAdded(listId);
  }

  function createAndAdd() {
    if (!newListName.trim()) return;
    const l: MediaList = { id: Date.now().toString(), name: newListName.trim(), createdAt: new Date().toISOString() };
    const ul = [l, ...lists]; setLists(ul); lsSet("geo_pr_lists", ul);
    addToList(l.id);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0006", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 12, padding: 24, width: 360, boxShadow: "0 20px 60px #0002" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Add to list</div>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Adding {journalist.name} ({journalist.publication})</div>

        {added ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: GREEN, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            <Check size={16} /> Added successfully
          </div>
        ) : (
          <>
            {lists.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Existing lists</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {lists.map(l => (
                    <button key={l.id} onClick={() => addToList(l.id)}
                      style={{ textAlign: "left", padding: "8px 12px", border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 13, color: "#111827", cursor: "pointer", background: "white" }}>
                      {l.name} ({contacts.filter(c => c.listId === l.id).length} contacts)
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Create new list</div>
            <div style={{ display: "flex", gap: 7 }}>
              <input value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === "Enter" && createAndAdd()}
                placeholder="List name"
                style={{ flex: 1, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 13, outline: "none" }} />
              <button onClick={createAndAdd} disabled={!newListName.trim()}
                style={{ padding: "8px 12px", background: P, color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: !newListName.trim() ? 0.5 : 1 }}>
                Create
              </button>
            </div>
          </>
        )}
        <button onClick={onClose} style={{ marginTop: 14, width: "100%", padding: "8px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 13, color: MUTED, cursor: "pointer" }}>
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Section: Create Pitch ────────────────────────────────────────────────────

function CreatePitchSection({ prefill }: { prefill: { name?: string; publication?: string } | null }) {
  const [mode, setMode] = useState<"scratch" | "press-release" | "key-message">("key-message");
  const [journalistName, setJournalistName] = useState(prefill?.name ?? "");
  const [publication, setPublication] = useState(prefill?.publication ?? "");
  const [journalistEmail, setJournalistEmail] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [pressReleaseUrl, setPressReleaseUrl] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [pitchAngle, setPitchAngle] = useState("Tool review request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [personalization, setPersonalization] = useState("");
  const [copiedField, setCopiedField] = useState<"subject" | "body" | "dm" | null>(null);

  const [outreach, setOutreach] = useState<OutreachEntry[]>(() => lsGet("geo_pr_outreach", []));

  async function generate() {
    if (!journalistName.trim() || !publication.trim()) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetch<{ pitch: { subject: string; body: string; personalization: string } }>("/api/ai-pr/generate-pitch", {
        journalistName, publication, mode,
        pressReleaseUrl: mode === "press-release" ? pressReleaseUrl : undefined,
        keyMessage: mode === "key-message" ? keyMessage : undefined,
        pitchAngle,
      });
      setSubject(data.pitch.subject);
      setBody(data.pitch.body);
      setPersonalization(data.pitch.personalization);
      // Save to tracker
      const entry: OutreachEntry = {
        id: Date.now().toString(), journalist: journalistName, publication,
        subject: data.pitch.subject, body: data.pitch.body, status: "draft", createdAt: new Date().toISOString(),
      };
      const updated = [entry, ...outreach];
      setOutreach(updated); lsSet("geo_pr_outreach", updated);
    } catch (e) { setError(e instanceof Error ? e.message : "Generation failed"); }
    finally { setLoading(false); }
  }

  function updateStatus(id: string, status: OutreachEntry["status"]) {
    const updated = outreach.map(e => e.id === id ? { ...e, status } : e);
    setOutreach(updated); lsSet("geo_pr_outreach", updated);
  }

  function copy(text: string, field: "subject" | "body") {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  const MODES: { id: typeof mode; label: string; desc: string }[] = [
    { id: "scratch", label: "Write from scratch", desc: "Just journalist details and angle" },
    { id: "press-release", label: "Generate from press release URL", desc: "Paste URL, AI reads and pitches" },
    { id: "key-message", label: "Generate from key messages", desc: "Tell us your story, AI writes the email" },
  ];

  const ANGLES = ["Tool review request", "Original research data", "Expert commentary", "Guest post offer", "Product launch"];

  return (
    <div>
      <SectionTitle title="Create Pitch Email" subtitle="AI writes a personalized pitch referencing the journalist's recent work." />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {MODES.map(m => (
          <label key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", border: `1.5px solid ${mode === m.id ? P : BORDER}`, borderRadius: 8, cursor: "pointer", background: mode === m.id ? "#F5F3FF" : "white" }}>
            <input type="radio" name="pitchMode" value={m.id} checked={mode === m.id} onChange={() => setMode(m.id)} style={{ accentColor: P, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{m.label}</div>
              <div style={{ fontSize: 12, color: MUTED }}>{m.desc}</div>
            </div>
          </label>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Email <span style={{ fontWeight: 400, color: MUTED }}>(optional, for Gmail)</span></label>
          <input value={journalistEmail} onChange={e => setJournalistEmail(e.target.value)} placeholder="journalist@outlet.com" type="email"
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>X handle <span style={{ fontWeight: 400, color: MUTED }}>(optional, for DM)</span></label>
          <input value={xHandle} onChange={e => setXHandle(e.target.value.replace(/^@/, ""))} placeholder="username (without @)"
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>

      {mode === "press-release" && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Press release URL</label>
          <input value={pressReleaseUrl} onChange={e => setPressReleaseUrl(e.target.value)} placeholder="https://..."
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
      )}

      {(mode === "key-message" || mode === "scratch") && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
            {mode === "key-message" ? "Key message / story angle" : "Any specific context to include (optional)"}
          </label>
          <textarea value={keyMessage} onChange={e => setKeyMessage(e.target.value)} rows={3}
            placeholder={mode === "key-message" ? "e.g. GeoIQ found that 95% of Indian startups are invisible to ChatGPT" : "Optional context..."}
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Pitch angle</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ANGLES.map(a => (
            <label key={a} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input type="radio" name="pitchAngle" value={a} checked={pitchAngle === a} onChange={() => setPitchAngle(a)} style={{ accentColor: P }} />
              <span style={{ fontSize: 13, color: "#374151" }}>{a}</span>
            </label>
          ))}
        </div>
      </div>

      <button onClick={generate} disabled={loading || !journalistName.trim() || !publication.trim()}
        style={{ padding: "10px 22px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 7, opacity: !journalistName.trim() || !publication.trim() ? 0.5 : 1 }}>
        {loading && <Spinner />} {loading ? "Generating..." : "Generate Pitch"}
      </button>

      {error && <div style={{ marginTop: 14 }}><ErrorBanner msg={error} /></div>}

      {subject && (
        <div style={{ marginTop: 20, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ background: BG, borderBottom: `1px solid ${BORDER}`, padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email Preview</span>
            <div style={{ display: "flex", gap: 7 }}>
              {[{ label: "Copy Subject", field: "subject" as const, text: subject }, { label: "Copy Email", field: "body" as const, text: body }].map(btn => (
                <button key={btn.field} onClick={() => copy(btn.text, btn.field)}
                  style={{ fontSize: 11, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "3px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  {copiedField === btn.field ? <Check size={11} color={GREEN} /> : <Copy size={11} />} {btn.label}
                </button>
              ))}
              <a href={`https://mail.google.com/mail/?view=cm${journalistEmail ? `&to=${encodeURIComponent(journalistEmail)}` : ""}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: P, background: "white", border: `1px solid ${P}44`, borderRadius: 5, padding: "3px 9px", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <ExternalLink size={11} /> Open in Gmail
              </a>
              {xHandle && (
                <button onClick={() => {
                  const dmText = body.split("\n").filter(Boolean).slice(0, 3).join(" ").slice(0, 260) + "...";
                  navigator.clipboard.writeText(dmText);
                  setCopiedField("dm");
                  setTimeout(() => setCopiedField(null), 2000);
                  window.open(`https://x.com/${xHandle}`, "_blank");
                }}
                  style={{ fontSize: 11, color: "#000", background: "white", border: "1px solid #000", borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  {copiedField === "dm" ? <Check size={11} color={GREEN} /> : <ExternalLink size={11} />}
                  {copiedField === "dm" ? "Copied - DM sent?" : "DM on X"}
                </button>
              )}
              <button onClick={generate}
                style={{ fontSize: 11, color: MUTED, background: "white", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "3px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <RefreshCw size={11} /> Regenerate
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontWeight: 600, color: "#111827", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, color: "#374151", lineHeight: 1.7, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            {personalization && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: BG, borderRadius: 6, fontSize: 12, color: MUTED, fontStyle: "italic" }}>
                {personalization}
              </div>
            )}
          </div>
        </div>
      )}

      {outreach.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Outreach tracker</div>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 2fr 100px", gap: 10, padding: "8px 14px", background: BG, borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <div>Journalist</div><div>Publication</div><div>Subject</div><div>Status</div>
            </div>
            {outreach.slice(0, 20).map(e => (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 2fr 100px", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{e.journalist}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{e.publication}</div>
                <div style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.subject}</div>
                <select value={e.status} onChange={ev => updateStatus(e.id, ev.target.value as OutreachEntry["status"])}
                  style={{ fontSize: 11, padding: "3px 6px", border: `1px solid ${BORDER}`, borderRadius: 5, background: "white", cursor: "pointer", outline: "none", color: e.status === "replied" ? GREEN : e.status === "sent" ? AMBER : e.status === "pass" ? RED : MUTED }}>
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

// ─── Section: Media Monitoring ────────────────────────────────────────────────

function MediaMonitoringSection() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [searched, setSearched] = useState("");

  const [alerts, setAlerts] = useState<MonitorAlert[]>(() => lsGet("geo_pr_alerts", []));
  const [alertKw, setAlertKw] = useState("");
  const [alertFreq, setAlertFreq] = useState<"daily" | "weekly">("weekly");

  async function monitor() {
    if (!keyword.trim()) return;
    setLoading(true); setError(null); setMentions([]);
    try {
      const data = await apiFetch<{ mentions: Mention[] }>("/api/ai-pr/monitor", { keyword });
      setMentions(data.mentions);
      setSearched(keyword);
      if (data.mentions.length === 0) setError(`No mentions found for "${keyword}". This is normal for newer brands.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Monitor failed"); }
    finally { setLoading(false); }
  }

  function createAlert() {
    if (!alertKw.trim()) return;
    const a: MonitorAlert = { id: Date.now().toString(), keyword: alertKw.trim(), frequency: alertFreq, createdAt: new Date().toISOString() };
    const updated = [a, ...alerts];
    setAlerts(updated); lsSet("geo_pr_alerts", updated); setAlertKw("");
  }

  function deleteAlert(id: string) {
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated); lsSet("geo_pr_alerts", updated);
  }

  const positive = mentions.filter(m => m.sentiment === "Positive").length;
  const neutral = mentions.filter(m => m.sentiment === "Neutral").length;
  const negative = mentions.filter(m => m.sentiment === "Negative").length;

  return (
    <div>
      <SectionTitle title="Monitor Mentions" subtitle="Track when your brand or competitors appear in media coverage." />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === "Enter" && monitor()}
          placeholder="Keyword to monitor (e.g. GeoIQ, AI visibility tool)"
          style={{ flex: 1, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none" }} />
        <button onClick={monitor} disabled={loading || !keyword.trim()}
          style={{ padding: "9px 18px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: !keyword.trim() ? 0.5 : 1 }}>
          {loading ? <Spinner /> : <Search size={14} />} Monitor
        </button>
      </div>

      {error && <ErrorBanner msg={error} />}

      {mentions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Mentions for "{searched}" - last 12 months</div>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>{positive} Positive</span>
              <span style={{ fontSize: 12, color: AMBER, fontWeight: 600 }}>{neutral} Neutral</span>
              <span style={{ fontSize: 12, color: RED, fontWeight: 600 }}>{negative} Negative</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mentions.map(m => (
              <div key={m.url} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", background: "white" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{m.title || m.url}</a>
                    </div>
                    <div style={{ fontSize: 11, color: MUTED }}>
                      {m.publication}{m.author ? ` - ${m.author}` : ""}{m.publishedDate ? ` - ${fmt(m.publishedDate)}` : ""}
                    </div>
                  </div>
                  <SentimentBadge s={m.sentiment} />
                </div>
                {m.snippets[0] && <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5, margin: "0 0 10px", fontStyle: "italic" }}>"{m.snippets[0]}"</p>}
                <a href={m.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: P, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <ExternalLink size={11} /> Read article
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={15} color={AMBER} /> Alerts
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input value={alertKw} onChange={e => setAlertKw(e.target.value)} onKeyDown={e => e.key === "Enter" && createAlert()}
            placeholder="Keyword to watch"
            style={{ flex: 1, padding: "8px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none" }} />
          <select value={alertFreq} onChange={e => setAlertFreq(e.target.value as "daily" | "weekly")}
            style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: "none", background: "white" }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <button onClick={createAlert} disabled={!alertKw.trim()}
            style={{ padding: "8px 14px", background: P, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, opacity: !alertKw.trim() ? 0.5 : 1 }}>
            <Plus size={13} /> Create Alert
          </button>
        </div>
        {alerts.length === 0
          ? <div style={{ fontSize: 13, color: MUTED }}>No alerts set up yet. Create one above to track keywords.</div>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {alerts.map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "white" }}>
                  <div style={{ flex: 1, fontSize: 13, color: "#111827", fontWeight: 500 }}>"{a.keyword}"</div>
                  <div style={{ fontSize: 12, color: MUTED, textTransform: "capitalize" }}>{a.frequency} digest</div>
                  <button onClick={() => deleteAlert(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 2 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// ─── Nav config ───────────────────────────────────────────────────────────────

type SectionId = "dashboard" | "ai-cited-media" | "contact-search" | "media-lists" | "create-pitch" | "your-emails" | "media-monitoring" | "alerts";

interface NavGroup { label?: string; items: { id: SectionId; label: string }[] }

const NAV_GROUPS: NavGroup[] = [
  { items: [{ id: "dashboard", label: "Dashboard" }, { id: "ai-cited-media", label: "AI-Cited Media" }] },
  { label: "Media Database", items: [{ id: "contact-search", label: "Contact Search" }, { id: "media-lists", label: "Media Lists" }] },
  { label: "Outreach", items: [{ id: "create-pitch", label: "Your Emails" }] },
  { label: "Media Monitoring", items: [{ id: "media-monitoring", label: "Monitor Mentions" }, { id: "alerts", label: "Alerts" }] },
];

// ─── Main AiPRTab ─────────────────────────────────────────────────────────────

export function AiPRTab() {
  const [section, setSection] = useState<SectionId>("dashboard");
  const [contactSearchOutlet, setContactSearchOutlet] = useState<string | undefined>();
  const [pitchPrefill, setPitchPrefill] = useState<{ name?: string; publication?: string } | null>(null);
  const [addToListJournalist, setAddToListJournalist] = useState<Journalist | null>(null);

  function navTo(id: SectionId, extras?: { outlet?: string; journalist?: { name?: string; publication?: string } }) {
    setSection(id);
    if (extras?.outlet) setContactSearchOutlet(extras.outlet);
    if (extras?.journalist) setPitchPrefill(extras.journalist);
  }

  return (
    <div style={{ display: "flex", gap: 0, minHeight: 500 }}>
      {/* Left sidebar */}
      <div style={{ width: SIDEBAR_W, flexShrink: 0, borderRight: `1px solid ${BORDER}`, paddingRight: 0 }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 6 }}>
            {group.label && (
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 14px 4px" }}>{group.label}</div>
            )}
            {group.items.map(item => (
              <button key={item.id} onClick={() => setSection(item.id)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "7px 14px",
                  background: section === item.id ? "#EEF2FF" : "transparent",
                  border: "none", borderLeft: `2.5px solid ${section === item.id ? P : "transparent"}`,
                  fontSize: 13, fontWeight: section === item.id ? 600 : 400,
                  color: section === item.id ? P : "#374151", cursor: "pointer",
                }}>
                {item.label}
              </button>
            ))}
            {gi < NAV_GROUPS.length - 1 && <div style={{ borderBottom: `1px solid ${BORDER}`, margin: "8px 14px" }} />}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "0 0 0 28px", minWidth: 0 }}>
        {section === "dashboard" && <DashboardSection onNav={id => navTo(id)} />}
        {section === "ai-cited-media" && <AiCitedMediaSection onFindContact={outlet => navTo("contact-search", { outlet })} />}
        {section === "contact-search" && (
          <ContactSearchSection
            prefillOutlet={contactSearchOutlet}
            onAddToList={j => setAddToListJournalist(j)}
          />
        )}
        {section === "media-lists" && <MediaListsSection onWritePitch={j => navTo("create-pitch", { journalist: j })} />}
        {section === "create-pitch" && <CreatePitchSection prefill={pitchPrefill} />}
        {section === "your-emails" && <CreatePitchSection prefill={pitchPrefill} />}
        {section === "media-monitoring" && <MediaMonitoringSection />}
        {section === "alerts" && <MediaMonitoringSection />}
      </div>

      {addToListJournalist && (
        <AddToListModal journalist={addToListJournalist} onClose={() => setAddToListJournalist(null)} />
      )}
    </div>
  );
}
