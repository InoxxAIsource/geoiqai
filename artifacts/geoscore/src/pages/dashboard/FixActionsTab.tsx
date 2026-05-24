import { useState, useEffect } from "react";
import { Copy, ChevronDown, ChevronRight, ExternalLink, CheckCircle2 } from "lucide-react";

interface Brand {
  id: string;
  domain: string;
  brandName: string | null;
  category: string | null;
  latestScore: number | null;
}

interface TechCheck {
  name: string;
  score: number;
  status: string;
}

interface Platform {
  name: string;
  dr: number;
  url: string;
  forCategories?: string[];
}

interface Task {
  id: string;
  cite: "C" | "I" | "T" | "E";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  time: string;
  impact: number;
  instructions?: string;
  code?: string;
  codeLabel?: string;
  url?: string;
  urlLabel?: string;
  platforms?: Platform[];
  generated?: string;
}

interface Week {
  label: string;
  shortLabel: string;
  tasks: Task[];
}

const CITE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  C: { bg: "#EFF6FF", text: "#1E40AF", label: "Citations" },
  I: { bg: "#F0FDF4", text: "#166534", label: "Indexability" },
  T: { bg: "#FFFBEB", text: "#92400E", label: "Trustworthiness" },
  E: { bg: "#FAF5FF", text: "#6B21A8", label: "Entity" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: "#FEE2E2", text: "#991B1B" },
  HIGH: { bg: "#FEF3C7", text: "#92400E" },
  MEDIUM: { bg: "#DBEAFE", text: "#1E40AF" },
  LOW: { bg: "#F3F4F6", text: "#374151" },
};

const ALL_PLATFORMS: Platform[] = [
  { name: "There's An AI For That", dr: 67, url: "https://theresanaiforthat.com/submit-tool" },
  { name: "FutureTools", dr: 58, url: "https://futuretools.io/submit" },
  { name: "Toolify.ai", dr: 45, url: "https://toolify.ai/submit-tool" },
  { name: "HealthShots", dr: 67, url: "https://healthshots.com/submit", forCategories: ["health", "diet", "fitness", "medical"] },
  { name: "1mg", dr: 78, url: "https://1mg.com/contact", forCategories: ["health", "diet", "fitness", "medical"] },
  { name: "Practo", dr: 79, url: "https://practo.com/partners", forCategories: ["health", "diet", "fitness", "medical"] },
  { name: "G2", dr: 91, url: "https://g2.com/products/new", forCategories: ["saas", "tool", "software", "platform"] },
  { name: "Capterra", dr: 88, url: "https://capterra.com/vendors/sign-up", forCategories: ["saas", "tool", "software", "platform"] },
  { name: "GetApp", dr: 82, url: "https://getapp.com/list-your-software", forCategories: ["saas", "tool", "software", "platform"] },
  { name: "Inc42", dr: 71, url: "https://inc42.com/submit-startup", forCategories: ["fintech", "finance", "payment", "startup"] },
  { name: "Entrackr", dr: 55, url: "https://entrackr.com/contact", forCategories: ["fintech", "finance", "payment"] },
];

function getPlatforms(category: string | null): Platform[] {
  const cat = (category ?? "").toLowerCase();
  const base = ALL_PLATFORMS.filter(p => !p.forCategories);
  const specific = ALL_PLATFORMS.filter(p => p.forCategories?.some(c => cat.includes(c)));
  return [...base, ...specific];
}

function buildWeeks(brand: Brand): Week[] {
  const bn = brand.brandName ?? brand.domain;
  const domain = brand.domain;
  const platforms = getPlatforms(brand.category);

  const robotsTxtCode = `# AI Crawler Access (GEO-optimized)
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
Allow: /`;

  const llmsTxtCode = `# ${bn}
> ${bn} helps founders and startups track and improve AI visibility.

## About
${bn} is a GEO platform that monitors how your brand appears in ChatGPT, Gemini, and Perplexity.

## Key Pages
- [Homepage](https://${domain}/): Main page
- [About](https://${domain}/about): About us
- [Features](https://${domain}/features): What we do

## Social Profiles
https://twitter.com/${domain.split(".")[0]}
https://linkedin.com/company/${domain.split(".")[0]}

## Sitemap
https://${domain}/sitemap.xml`;

  const schemaCode = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${bn}",
  "url": "https://${domain}",
  "description": "AI visibility tracking and GEO optimization for startups.",
  "logo": "https://${domain}/logo.png",
  "sameAs": [
    "https://twitter.com/${domain.split(".")[0]}",
    "https://linkedin.com/company/${domain.split(".")[0]}",
    "https://www.crunchbase.com/organization/${domain.split(".")[0]}"
  ]
}
</script>`;

  return [
    {
      label: "Week 1-2: Foundation",
      shortLabel: "Foundation",
      tasks: [
        {
          id: "w1-1", cite: "I", priority: "CRITICAL",
          title: "Allow AI crawlers in robots.txt",
          time: "10 mins", impact: 8,
          instructions: "Add these exact lines to your existing robots.txt file. This allows ChatGPT, Perplexity, Claude, and other AI systems to index your site. Without this, some systems will skip your content entirely.",
          code: robotsTxtCode, codeLabel: "Add to robots.txt",
          url: `https://${domain}/robots.txt`, urlLabel: "Test your robots.txt",
        },
        {
          id: "w1-2", cite: "I", priority: "CRITICAL",
          title: "Create your llms.txt file",
          time: "15 mins", impact: 10,
          instructions: `Create a file called llms.txt and upload it to https://${domain}/llms.txt. This is the AI equivalent of a sitemap - it tells language models exactly who you are and what you do.`,
          code: llmsTxtCode, codeLabel: "Save as llms.txt",
          url: `https://${domain}/llms.txt`, urlLabel: "Test your llms.txt URL",
        },
        {
          id: "w1-3", cite: "T", priority: "HIGH",
          title: "Add Organization Schema markup",
          time: "20 mins", impact: 8,
          instructions: "Paste this inside the <head> tag of your homepage. Schema markup helps AI systems understand your brand as a real entity, not just a website. Google and Gemini both use this data.",
          code: schemaCode, codeLabel: "Copy Schema markup",
          url: "https://validator.schema.org", urlLabel: "Validate your schema",
        },
        {
          id: "w1-4", cite: "T", priority: "HIGH",
          title: "Add social profile links",
          time: "10 mins", impact: 6,
          instructions: `Make sure your Twitter/X and LinkedIn profiles link back to https://${domain} in their bio. Then add those profile URLs to your homepage footer. AI systems cross-reference social profiles to validate brand legitimacy.`,
        },
        {
          id: "w1-5", cite: "C", priority: "HIGH",
          title: "Create Crunchbase profile",
          time: "15 mins", impact: 12,
          instructions: `Crunchbase is one of the most-cited sources by ChatGPT for company lookups. Create a complete profile for ${bn} - include your founding date, team size, funding status, and what you do.`,
          url: "https://www.crunchbase.com/add-new/organization", urlLabel: "Create Crunchbase profile",
          generated: `${bn} is a GEO (Generative Engine Optimization) platform that helps startups track and improve their AI visibility in ChatGPT, Gemini, and Perplexity. Founded to help founders understand and improve how AI systems talk about their brand.`,
        },
        {
          id: "w1-6", cite: "C", priority: "HIGH",
          title: "Submit to Product Hunt",
          time: "20 mins", impact: 15,
          instructions: `Product Hunt is a high-DR site that AI systems actively cite. Submit ${bn} with a clear tagline and description. Schedule it for a Tuesday-Thursday 12:01am PT launch for best visibility.`,
          url: "https://www.producthunt.com/posts/new", urlLabel: "Submit to Product Hunt",
          generated: `Tagline: "Know exactly where your brand stands in ChatGPT, Gemini, and Perplexity"\n\nDescription: ${bn} is the first GEO score for startups. Enter your domain and get a real score across all three major AI systems in 60 seconds. Track daily, fix what's broken, and watch your AI visibility climb.\n\nTopics: Artificial Intelligence, SEO, Analytics, Marketing, Startups`,
        },
        {
          id: "w1-7", cite: "C", priority: "HIGH",
          title: "Create LinkedIn Company Page",
          time: "10 mins", impact: 8,
          instructions: `LinkedIn company pages get indexed by Bing and are cited by Copilot AI. Create or update your ${bn} company page with a full description, logo, and website URL.`,
          url: "https://www.linkedin.com/company/setup/new", urlLabel: "Create LinkedIn Company Page",
          generated: `${bn} helps founders track how their brand appears in ChatGPT, Gemini, and Perplexity. Think of it as Google Search Console, but for AI search. Get your GEO IQ score free in 60 seconds.`,
        },
        {
          id: "w1-8", cite: "C", priority: "MEDIUM",
          title: "Submit to AI tool directories",
          time: "30 mins", impact: 15,
          instructions: "Submit to these directories. Check each one off as you go. The combined DR boost significantly improves how AI systems perceive your domain authority.",
          platforms,
        },
      ],
    },
    {
      label: "Week 2-3: Content",
      shortLabel: "Content",
      tasks: [
        {
          id: "w2-1", cite: "T", priority: "HIGH",
          title: "Fix your page title tag",
          time: "5 mins", impact: 5,
          instructions: `Your title tag is one of the first things AI systems read. It should follow this pattern: "[Primary keyword] - [Brand name] | [Secondary benefit]". Keep it under 60 characters. Include your main category keyword.`,
          generated: `${bn} - AI Visibility Score for Startups | GEO IQ`,
          code: `<title>${bn} - AI Visibility Score for Startups | GEO IQ</title>`,
          codeLabel: "Copy optimized title",
        },
        {
          id: "w2-2", cite: "T", priority: "HIGH",
          title: "Fix your meta description",
          time: "5 mins", impact: 5,
          instructions: "Your meta description should answer: what does this do, who is it for, and what's the outcome. Keep it under 155 characters. Use active voice.",
          code: `<meta name="description" content="Track how ${bn} appears in ChatGPT, Gemini, and Perplexity. Get your AI visibility score free in 60 seconds. Fix what's broken and watch your GEO IQ climb." />`,
          codeLabel: "Copy meta description",
        },
        {
          id: "w2-3", cite: "T", priority: "HIGH",
          title: "Add AI-quotable brand summary",
          time: "5 mins", impact: 10,
          instructions: `AI systems need a clear, quotable paragraph near the top of your homepage to cite when asked about your brand. Add this to the first paragraph visible without scrolling.`,
          generated: `${bn} is a GEO (Generative Engine Optimization) platform that helps startup founders track and improve how their brand appears in AI systems like ChatGPT, Gemini, and Perplexity. Founders use ${bn} to get a daily AI visibility score, identify citation gaps, and run fix actions that improve their brand's presence in AI-generated answers. It works like Google Search Console, but for AI search.`,
          code: `<p class="brand-summary">${bn} is a GEO platform that helps startup founders track and improve how their brand appears in AI systems like ChatGPT, Gemini, and Perplexity. Get a daily AI visibility score and run fix actions that improve your brand's presence in AI-generated answers.</p>`,
          codeLabel: "Copy brand summary paragraph",
        },
        {
          id: "w2-4", cite: "C", priority: "HIGH",
          title: "Write your foundational brand article",
          time: "2-3 hours", impact: 15,
          instructions: `This is the most important content piece you can create for GEO. A 2000-word article titled "What is ${bn}?" becomes the primary source AI systems cite about your brand. Use the FAQ generator to get your outline, then expand each section.`,
          generated: `Suggested title: "What is ${bn}? A Complete Guide to GEO Tracking for Startups"\n\nOutline:\nH2: What is ${bn}?\nH2: How ${bn} works\nH2: Key benefits for startup founders\nH2: ${bn} vs traditional SEO tools\nH2: Getting started with ${bn}\nH2: Frequently asked questions`,
        },
        {
          id: "w2-5", cite: "C", priority: "MEDIUM",
          title: "Create a FAQ page",
          time: "30 mins", impact: 10,
          instructions: `FAQ pages in conversational format are cited heavily by AI systems. Create /faq on your site with 20+ questions people actually ask about your product. Use the FAQ generator to get the content.`,
        },
      ],
    },
    {
      label: "Week 3-4: Authority",
      shortLabel: "Authority",
      tasks: [
        {
          id: "w3-1", cite: "C", priority: "MEDIUM",
          title: "Build Reddit presence",
          time: "1 hour", impact: 8,
          instructions: `Reddit threads show up in Perplexity's real-time search constantly. Share your founder story and what problem ${bn} solves. Ask for feedback, not promotion. AI systems index popular Reddit threads.`,
          generated: `r/startupindia, r/SaaS, r/indiehackers\n\nPost idea: "We built ${bn} after spending months trying to figure out why ChatGPT never mentioned our startup - here's what we learned"\n\nAngle: Share the problem (not being in AI results), the insight (why it happens), and the solution you built. Ask what others have tried.`,
        },
        {
          id: "w3-2", cite: "C", priority: "MEDIUM",
          title: "Write a comparison article",
          time: "2 hours", impact: 12,
          instructions: `"X vs Y" articles rank well and get cited by AI when users ask comparison questions. Write a fair, specific comparison of your product against 2-3 alternatives.`,
          generated: `Suggested title: "${bn} vs [Competitor 1] vs [Competitor 2]: Honest Comparison 2026"\nTarget keyword: "[your product] alternative"\nNote: Be genuinely fair. AI systems penalize obviously biased comparisons.`,
        },
        {
          id: "w3-3", cite: "E", priority: "MEDIUM",
          title: "Submit to Wikidata",
          time: "30 mins", impact: 6,
          instructions: `Wikidata is the structured knowledge base that feeds Google Knowledge Graph, and AI systems reference it for entity recognition. Creating a Wikidata entry for ${bn} signals that you are a real, verifiable entity.`,
          url: "https://www.wikidata.org/wiki/Special:NewItem", urlLabel: "Create Wikidata entry",
        },
        {
          id: "w3-4", cite: "C", priority: "LOW",
          title: "Content calendar - 4 weeks",
          time: "2 hours", impact: 20,
          instructions: "Publishing consistently signals to AI systems that your brand is active and authoritative. Here's a 4-week content plan using the content angles that perform best for GEO.",
          generated: `Week 1 (Struggle): "Why ChatGPT Has Never Heard of Your Startup (And How to Fix It)"\nWeek 2 (How): "How to Check if Your Brand Shows Up in ChatGPT, Gemini, and Perplexity"\nWeek 3 (Best): "The Best GEO Strategies for Early-Stage Startups in 2026"\nWeek 4 (What): "What is Generative Engine Optimization and Why Every Founder Needs It"`,
        },
        {
          id: "w3-5", cite: "C", priority: "HIGH",
          title: "Close your citation gap",
          time: "2 hours", impact: 22,
          instructions: `Your competitors are getting cited by sites you haven't targeted yet. These are your highest-value outreach targets because the site has already shown it covers your space. Use the Competition tab to run a backlink gap analysis and get a live list of sites linking to your competitors. Prioritise DR 50+ domains. For each one: find the relevant article, send a personalised email explaining how your product adds value, and offer to contribute a quote or data point.`,
          generated: `Outreach template:\n\nSubject: Quick addition for your [topic] article\n\nHi [Name],\n\nSaw your piece on [topic] - really useful breakdown. You mentioned [Competitor]. We built ${bn} to solve a similar problem, but focused on [your differentiator].\n\nWould it make sense to add us to the roundup? Happy to provide a demo, a data point, or a quote from our founder.\n\n[Your name]\n${bn}\n\nKeep it under 100 words. Specificity beats length every time.`,
        },
      ],
    },
    {
      label: "Week 4-5: PR",
      shortLabel: "PR",
      tasks: [
        {
          id: "w4-1", cite: "C", priority: "HIGH",
          title: "Newsletter outreach",
          time: "1 hour", impact: 20,
          instructions: `Newsletter features drive both direct traffic and AI citations. A mention in TLDR AI or The Ken can result in 10+ downstream citations. Keep your pitch under 3 sentences.`,
          generated: `India newsletters:\n- The Ken (theken.in, 200K subs): "Hi, I'm building ${bn}, a GEO score for Indian startups. We help founders track how their brand appears in ChatGPT, Gemini, and Perplexity - think Google Search Console but for AI. Happy to share data on how Indian startups perform in AI search if useful for a story."\n\n- YourStory (yourstory.com, 500K subs): "Covering a new wave of AI-native tools for Indian founders? ${bn} gives startups a daily GEO IQ score across all major AI systems. We've seen [X]% of Indian startups are invisible in ChatGPT. Happy to share the data."\n\nGlobal:\n- TLDR AI (tldr.tech, 500K+ subs): "Tool worth knowing: ${bn} scores how visible your startup is in ChatGPT, Gemini, and Perplexity. Free audit at ${domain}."\n\n- Ben's Bites (bensbites.co, 100K subs): "Founders are realizing Google SEO doesn't translate to AI visibility. ${bn} tracks your GEO IQ score daily and shows you exactly what to fix."`,
        },
        {
          id: "w4-2", cite: "C", priority: "MEDIUM",
          title: "Guest post outreach",
          time: "1 hour", impact: 15,
          instructions: `Guest posts on high-DR publications create citations that AI systems trust heavily. Target publications your audience reads. Focus on providing genuine insight, not promotion.`,
          generated: `High-value targets:\n- dev.to (DR 79): Technical deep-dive on how AI systems decide which brands to mention\n- Hacker News: Share your GEO data findings as a Show HN or Ask HN\n- Indie Hackers (DR 72): Founder story on building for AI visibility\n- HealthShots (health brands, DR 67): Data-driven piece on AI health advice gaps`,
        },
      ],
    },
  ];
}

function CodeBox({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ marginTop: 10, marginBottom: 10 }}>
      <div style={{ background: "#0F172A", borderRadius: 8, padding: "12px 14px", overflowX: "auto", marginBottom: 6 }}>
        <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 11.5, color: "#CBD5E1", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{code}</pre>
      </div>
      <button
        onClick={handleCopy}
        style={{ display: "flex", alignItems: "center", gap: 5, background: copied ? "#ECFDF5" : "transparent", border: `0.5px solid ${copied ? "#10b981" : "#e5e7eb"}`, borderRadius: 5, padding: "4px 10px", fontSize: 11, color: copied ? "#059669" : "#6b7280", cursor: "pointer", fontWeight: copied ? 500 : 400 }}
      >
        <Copy size={10} />
        {copied ? "Copied!" : (label ?? "Copy")}
      </button>
    </div>
  );
}

const TECH_TASK_MAP: { taskId: string; keyword: string }[] = [
  { taskId: "w1-1", keyword: "robot" },
  { taskId: "w1-2", keyword: "llm" },
  { taskId: "w1-3", keyword: "schema" },
];

function computeAutoCompleted(checks: TechCheck[]): Set<string> {
  const auto = new Set<string>();
  for (const { taskId, keyword } of TECH_TASK_MAP) {
    const check = checks.find(c => c.name.toLowerCase().includes(keyword));
    if (check && check.score >= 70) auto.add(taskId);
  }
  return auto;
}

export function FixActionsTab({ brand }: { brand: Brand }) {
  const [activeWeek, setActiveWeek] = useState(0);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [platformChecks, setPlatformChecks] = useState<Record<string, boolean>>({});
  const [autoCompleted, setAutoCompleted] = useState<Set<string>>(new Set());
  const [showDoneSection, setShowDoneSection] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("geoscore_token");
    if (!token || !brand.id) return;
    fetch(`/api/dashboard/brands/${brand.id}/technical-checks`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() as Promise<{ checks: TechCheck[] }> : Promise.resolve({ checks: [] }))
      .then(data => setAutoCompleted(computeAutoCompleted(data.checks)))
      .catch(() => {});
  }, [brand.id]);

  const weeks = buildWeeks(brand);
  const currentWeek = weeks[activeWeek]!;
  const isDone = (id: string) => completed.has(id) || autoCompleted.has(id);
  const doneCount = currentWeek.tasks.filter(t => isDone(t.id)).length;
  const totalImpact = currentWeek.tasks.reduce((s, t) => s + t.impact, 0);
  const progress = currentWeek.tasks.length > 0 ? (doneCount / currentWeek.tasks.length) * 100 : 0;
  const manualOrAutoCompleted = currentWeek.tasks.filter(t => isDone(t.id));

  const toggleDone = (id: string) => {
    if (autoCompleted.has(id)) return;
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 2 }}>4-week execution roadmap</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Work through these in order for maximum GEO score gain.</div>
      </div>

      {/* Week tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {weeks.map((w, i) => (
          <button
            key={i}
            onClick={() => setActiveWeek(i)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              background: activeWeek === i ? "#4F46E5" : "white",
              color: activeWeek === i ? "white" : "#6B7280",
              boxShadow: activeWeek === i ? "none" : "0 0 0 1px #E5E7EB inset",
              transition: "all 150ms",
            }}
          >
            {w.shortLabel}
          </button>
        ))}
      </div>

      {/* Progress tracker */}
      <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
            {currentWeek.label}: {doneCount} of {currentWeek.tasks.length} tasks complete
          </div>
          <div style={{ fontSize: 12, color: "#16A34A", fontWeight: 500 }}>+{totalImpact} pts estimated</div>
        </div>
        <div style={{ height: 6, background: "#F3F4F6", borderRadius: 9999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "#4F46E5", borderRadius: 9999, transition: "width 500ms ease" }} />
        </div>
        {doneCount === currentWeek.tasks.length && currentWeek.tasks.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#059669", fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
            <CheckCircle2 size={13} /> Week complete - move to {weeks[activeWeek + 1]?.shortLabel ?? "publishing"}!
          </div>
        )}
      </div>

      {/* Task cards - only show incomplete tasks */}
      {currentWeek.tasks.filter(t => !isDone(t.id)).map(task => {
        const cite = CITE_COLORS[task.cite]!;
        const prio = PRIORITY_COLORS[task.priority]!;
        const isExpanded = expandedTask === task.id;

        return (
          <div
            key={task.id}
            style={{
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              padding: 16,
              marginBottom: 10,
              transition: "all 200ms",
            }}
          >
            {/* Card header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: isExpanded ? 12 : 0 }}>
              {/* CITE tag */}
              <span style={{ background: cite.bg, color: cite.text, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>
                [{task.cite}] {cite.label}
              </span>
              {/* Priority */}
              <span style={{ background: prio.bg, color: prio.text, borderRadius: 9999, padding: "2px 8px", fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>
                {task.priority}
              </span>
              {/* Title */}
              <div
                style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#111827", cursor: "pointer" }}
                onClick={() => setExpandedTask(isExpanded ? null : task.id)}
              >
                {task.title}
              </div>
              {/* Right side */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{task.time}</span>
                <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 600 }}>+{task.impact} pts</span>
                <button
                  onClick={() => toggleDone(task.id)}
                  style={{
                    background: "transparent",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: 11,
                    color: "#6b7280",
                    cursor: "pointer",
                    fontWeight: 400,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Mark done
                </button>
                <button
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9ca3af" }}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ borderTop: "0.5px solid #f3f4f6", paddingTop: 12 }}>
                {task.instructions && (
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.65, marginBottom: task.code || task.url || task.platforms || task.generated ? 10 : 0 }}>
                    {task.instructions}
                  </div>
                )}

                {task.code && <CodeBox code={task.code} label={task.codeLabel} />}

                {task.generated && !task.code && (
                  <div style={{ marginTop: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 5, fontWeight: 500 }}>Generated content:</div>
                    <div style={{ background: "#F9FAFB", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#374151", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                      {task.generated}
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(task.generated ?? ""); }}
                      style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 5, padding: "4px 10px", fontSize: 11, color: "#6b7280", cursor: "pointer" }}
                    >
                      <Copy size={10} /> Copy content
                    </button>
                  </div>
                )}

                {task.url && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#EEF2FF", color: "#4F46E5", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 500, textDecoration: "none" }}
                    >
                      {task.urlLabel ?? task.url} <ExternalLink size={11} />
                    </a>
                  </div>
                )}

                {task.platforms && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8, fontWeight: 500 }}>Check each platform off as you submit:</div>
                    {task.platforms.map(p => {
                      const checked = platformChecks[p.name] ?? false;
                      return (
                        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "0.5px solid #f9fafb" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => setPlatformChecks(prev => ({ ...prev, [p.name]: e.target.checked }))}
                            style={{ width: 14, height: 14, accentColor: "#4F46E5", cursor: "pointer" }}
                          />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 12, color: checked ? "#9ca3af" : "#374151", textDecoration: checked ? "line-through" : "none" }}>{p.name}</span>
                            <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>DR {p.dr}</span>
                          </div>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 11, color: "#4F46E5", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
                          >
                            Submit <ExternalLink size={9} />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}

                {task.generated && task.code && (
                  <div style={{ marginTop: 8, background: "#F9FAFB", borderRadius: 8, padding: "8px 10px", fontSize: 11.5, color: "#374151", lineHeight: 1.65 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>Suggested description:</div>
                    {task.generated}
                    <button
                      onClick={() => { navigator.clipboard.writeText(task.generated ?? ""); }}
                      style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#6b7280", cursor: "pointer" }}
                    >
                      <Copy size={9} /> Copy description
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* What you have done section */}
      {manualOrAutoCompleted.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => setShowDoneSection(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: "4px 0", width: "100%" }}
          >
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, whiteSpace: "nowrap" }}>
              {manualOrAutoCompleted.length} task{manualOrAutoCompleted.length !== 1 ? "s" : ""} done
            </span>
            {showDoneSection ? <ChevronDown size={13} color="#9ca3af" /> : <ChevronRight size={13} color="#9ca3af" />}
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
          </button>

          {showDoneSection && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {manualOrAutoCompleted.map(task => {
                const isAuto = autoCompleted.has(task.id);
                return (
                  <div
                    key={task.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: isAuto ? "#F0FDF4" : "#F9FAFB",
                      border: `1px solid ${isAuto ? "#D1FAE5" : "#E5E7EB"}`,
                      borderRadius: 8,
                      padding: "9px 12px",
                    }}
                  >
                    <CheckCircle2 size={14} color={isAuto ? "#059669" : "#9ca3af"} />
                    <div style={{ flex: 1, fontSize: 12, color: "#6b7280", textDecoration: "line-through" }}>{task.title}</div>
                    <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 600, flexShrink: 0 }}>+{task.impact} pts</span>
                    {isAuto && (
                      <span style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 9999, padding: "1px 7px", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                        verified
                      </span>
                    )}
                    {!isAuto && (
                      <button
                        onClick={() => toggleDone(task.id)}
                        style={{ background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 5, padding: "2px 8px", fontSize: 10, color: "#9ca3af", cursor: "pointer" }}
                      >
                        Undo
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
