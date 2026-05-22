import OpenAI from "openai";
import { logger } from "./logger";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface TechCheck {
  id: string;
  name: string;
  score: number;
  status: string;
  detail: string;
}

export interface TechnicalAudit {
  checks: TechCheck[];
  overallScore: number;
  brandDescription?: string;
  socialLinks?: string[];
  contactEmail?: string;
  currentTitle?: string;
  currentMetaDescription?: string;
}

export interface AuditDataForRoadmap {
  auditId: string;
  domain: string;
  brandName: string;
  category: string;
  market: string;
  scoreTotal: number;
  competitorsFound: string[];
  technicalAudit: TechnicalAudit | null;
  keywords: string[];
}

export interface RoadmapAiContent {
  brandSummary: string;
  crunchbaseDescription: string;
  productHuntTagline: string;
  productHuntDescription: string;
  productHuntTopics: string[];
  suggestedPageTitle: string;
  suggestedMetaDescription: string;
  brandHomepageSummary: string;
  articleTitle: string;
  articleOutline: string[];
  articleKeywords: string[];
  redditSubreddits: string[];
  redditQuestionTypes: string[];
  redditReplyTemplate: string;
  redditThreadTitle: string;
  redditThreadBody: string;
  comparisonTitle: string;
  comparisonCompetitor1: string;
  comparisonCompetitor2: string;
  comparisonOutline: string[];
  newsletters: Array<{
    name: string;
    url: string;
    subscribers: string;
    pitch: string;
    subject: string;
  }>;
  competitorGaps: Array<{
    platform: string;
    url: string;
    reason: string;
  }>;
}

export interface RoadmapTaskItem {
  id: string;
  title: string;
  priority: string;
  timeMinutes: number;
  impactMin: number;
  impactMax: number;
  url?: string | null;
  content: Record<string, unknown>;
}

export interface RoadmapWeek {
  id: string;
  label: string;
  subtitle: string;
  targetScore: number;
  fromScore: number;
  toScore: number;
  tasks: RoadmapTaskItem[];
}

function getTechCheck(checks: TechCheck[], id: string): TechCheck | undefined {
  return checks.find((c) => c.id === id);
}

function isPassOrWarn(check: TechCheck | undefined): boolean {
  return check?.status === "pass" || check?.status === "warn";
}

function getAiDirectories(category: string, market: string): Array<{ name: string; url: string }> {
  const base = [
    { name: "There's an AI for That", url: "https://theresanaiforthat.com/submit" },
    { name: "FutureTools", url: "https://futuretools.io/submit" },
    { name: "AI Tools Directory", url: "https://aitoolsdirectory.com/submit-tool" },
    { name: "Toolify.ai", url: "https://toolify.ai/submit" },
  ];
  const india = market.toLowerCase().includes("india")
    ? [
        { name: "Startup India", url: "https://startupindia.gov.in" },
        { name: "YourStory", url: "https://yourstory.com/submit" },
      ]
    : [];
  const catLower = category.toLowerCase();
  const isTech = catLower.includes("saas") || catLower.includes("ai") || catLower.includes("software") || catLower.includes("tool") || catLower.includes("app");
  return isTech ? [...base, ...india] : india;
}

function getNewsletters(category: string, market: string): Array<{ name: string; url: string; subscribers: string }> {
  const catLower = category.toLowerCase();
  const isAi = catLower.includes("ai") || catLower.includes("machine learning");
  const isIndia = market.toLowerCase().includes("india");
  const list: Array<{ name: string; url: string; subscribers: string }> = [];
  if (isAi) {
    list.push(
      { name: "TLDR AI", url: "https://tldr.tech/ai", subscribers: "500K+" },
      { name: "The Rundown AI", url: "https://therundown.ai", subscribers: "600K+" },
      { name: "Ben's Bites", url: "https://bensbites.co", subscribers: "100K+" },
    );
  } else {
    list.push(
      { name: "TLDR Tech", url: "https://tldr.tech", subscribers: "750K+" },
      { name: "The Hustle", url: "https://thehustle.co", subscribers: "2M+" },
      { name: "Morning Brew", url: "https://morningbrew.com", subscribers: "4M+" },
    );
  }
  if (isIndia) {
    list.push(
      { name: "The Ken", url: "https://the-ken.com", subscribers: "100K+" },
      { name: "YourStory", url: "https://yourstory.com/newsletters", subscribers: "500K+" },
    );
  }
  return list.slice(0, 4);
}

export async function generateRoadmapAiContent(data: AuditDataForRoadmap): Promise<RoadmapAiContent> {
  const competitors = data.competitorsFound.slice(0, 3).join(", ") || "alternatives in your space";
  const keywords = data.keywords.slice(0, 5).join(", ") || data.category;
  const tech = data.technicalAudit;
  const currentTitle = tech?.currentTitle ?? "";
  const currentMeta = tech?.currentMetaDescription ?? "";
  const brandDesc = tech?.brandDescription ?? "";
  const newsletters = getNewsletters(data.category, data.market);
  const newsletterNames = newsletters.map((n) => n.name).join(", ");

  const systemPrompt = `You are a GEO (Generative Engine Optimization) expert helping a startup improve their visibility in AI systems like ChatGPT, Gemini, and Perplexity. Generate specific, actionable content for the brand below. Write like a smart founder giving advice to another founder - no filler words, no "leverage" or "seamlessly", just direct and useful. Return a single valid JSON object with no markdown.`;

  const userPrompt = `Brand: ${data.brandName}
Domain: ${data.domain}
Category: ${data.category}
Market: ${data.market}
Current GEO IQ Score: ${data.scoreTotal}/100
Competitors: ${competitors}
Top keywords: ${keywords}
Current page title: "${currentTitle}"
Current meta description: "${currentMeta}"
Brand description scraped: "${brandDesc.substring(0, 300)}"
Target newsletters: ${newsletterNames}

Generate a JSON object with exactly these fields:
{
  "brandSummary": "3 clear factual sentences about what this brand does, who it is for, and what makes it different. This will be quoted by AI systems.",
  "crunchbaseDescription": "150-word professional company description for Crunchbase",
  "productHuntTagline": "Snappy 60-char tagline for Product Hunt",
  "productHuntDescription": "200-word Product Hunt description that explains the product, the problem it solves, and why now",
  "productHuntTopics": ["3 relevant Product Hunt topics"],
  "suggestedPageTitle": "SEO-optimised page title under 60 chars with brand name and main keyword",
  "suggestedMetaDescription": "Meta description under 155 chars with main keyword naturally included",
  "brandHomepageSummary": "3-sentence brand summary to place at top of homepage so AI systems can quote it when asked about this brand",
  "articleTitle": "Specific long-form article title that will rank and get cited by AI systems",
  "articleOutline": ["H2: What is ${data.brandName}?", "H2: How ${data.brandName} works", "H2: Key use cases for ${data.brandName}", "H2: ${data.brandName} vs alternatives", "H2: How to get started with ${data.brandName}", "H2: Frequently asked questions"],
  "articleKeywords": ["5 target keywords based on brand category"],
  "redditSubreddits": ["3 specific subreddits relevant to this brand's category"],
  "redditQuestionTypes": ["3 types of questions this brand should answer on Reddit"],
  "redditReplyTemplate": "A 4-5 sentence helpful reply template that mentions the brand naturally. Must feel authentic, not like an ad.",
  "redditThreadTitle": "A specific question thread title to post in relevant subreddits",
  "redditThreadBody": "150-word thread body asking for advice that establishes credibility and leads to mentioning the brand",
  "comparisonTitle": "Specific comparison article title: Brand vs Competitor1 vs Competitor2",
  "comparisonCompetitor1": "First competitor name",
  "comparisonCompetitor2": "Second competitor name",
  "comparisonOutline": ["H2: Quick comparison table", "H2: ${data.brandName} overview", "H2: Competitor 1 overview", "H2: Competitor 2 overview", "H2: Side-by-side feature comparison", "H2: Which should you choose?", "H2: FAQ"],
  "newsletters": ${JSON.stringify(newsletters.map((n) => ({
    name: n.name,
    url: n.url,
    subscribers: n.subscribers,
    pitch: `[Generate a 3-sentence pitch for ${n.name} newsletter about ${data.brandName}]`,
    subject: `[Generate email subject line for ${n.name} pitch about ${data.brandName}]`,
  })))},
  "competitorGaps": [
    {"platform": "G2", "url": "https://g2.com/products/new", "reason": "Competitor profiles on G2 boost AI citations significantly"},
    {"platform": "Capterra", "url": "https://www.capterra.com/vendors/sign-up", "reason": "Capterra is heavily cited by ChatGPT for software comparisons"},
    {"platform": "Trustpilot", "url": "https://business.trustpilot.com/signup", "reason": "Review sites strengthen entity signals for AI systems"},
    {"platform": "Slant.co", "url": "https://www.slant.co/", "reason": "Frequently cited in ChatGPT responses for tool comparisons"}
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    return JSON.parse(cleaned) as RoadmapAiContent;
  } catch (err) {
    logger.error({ err }, "roadmap ai generation failed, using fallback");
    return buildFallbackContent(data);
  }
}

function buildFallbackContent(data: AuditDataForRoadmap): RoadmapAiContent {
  const c1 = data.competitorsFound[0] ?? "Competitor A";
  const c2 = data.competitorsFound[1] ?? "Competitor B";
  const newsletters = getNewsletters(data.category, data.market);
  return {
    brandSummary: `${data.brandName} is a ${data.category} tool built for ${data.market}. It helps teams get results faster with less effort. Unlike most alternatives, ${data.brandName} focuses on doing one thing really well.`,
    crunchbaseDescription: `${data.brandName} (${data.domain}) is a ${data.category} startup based in ${data.market}. The company builds software that helps businesses improve their online presence and visibility. Founded by a team of experienced engineers and marketers, ${data.brandName} has grown to serve hundreds of customers across multiple markets.`,
    productHuntTagline: `The smartest ${data.category} tool for modern teams`,
    productHuntDescription: `${data.brandName} is the easiest way to handle ${data.category}. We built it because existing tools were too complex and too expensive. Just connect your account, run your first check in 5 minutes, and get actionable results immediately. Hundreds of teams use us every day.`,
    productHuntTopics: [data.category, "SaaS", "Productivity"],
    suggestedPageTitle: `${data.brandName} - ${data.category} for ${data.market} teams`,
    suggestedMetaDescription: `${data.brandName} helps ${data.market} teams with ${data.category}. Get started free. No credit card required.`,
    brandHomepageSummary: `${data.brandName} is a ${data.category} platform that helps businesses improve visibility and grow faster. Based in ${data.market}, ${data.brandName} has helped hundreds of companies achieve measurable results in under 30 days. The platform combines AI analysis with actionable recommendations to make ${data.category} accessible for every team size.`,
    articleTitle: `${data.brandName}: The Complete ${data.category} Guide for ${new Date().getFullYear()}`,
    articleOutline: [
      `H2: What is ${data.brandName}?`,
      `H2: How ${data.brandName} works`,
      `H2: Key use cases for ${data.brandName}`,
      `H2: ${data.brandName} vs alternatives`,
      `H2: How to get started with ${data.brandName}`,
      "H2: Frequently asked questions",
    ],
    articleKeywords: [data.brandName, `${data.brandName} review`, `best ${data.category}`, `${data.category} tool`, `${data.brandName} pricing`],
    redditSubreddits: ["r/startups", "r/saas", "r/marketing"],
    redditQuestionTypes: [`Which ${data.category} tool do you recommend?`, `Has anyone tried ${data.brandName}?`, `Best tools for ${data.category} in 2025?`],
    redditReplyTemplate: `I've been using ${data.brandName} for this exact problem. The setup took about 15 minutes and it immediately flagged a few issues I didn't know existed. Happy to share more details about our setup if that's useful.`,
    redditThreadTitle: `Anyone using AI tools for ${data.category}? What's actually working in 2025?`,
    redditThreadBody: `We've been trying to improve our ${data.category} results for the last 6 months with mixed results. Tried a few different approaches. Curious what others are doing - specifically around ${data.keywords[0] ?? "visibility"} and ${data.keywords[1] ?? "growth"}. What tools or strategies have actually moved the needle for you?`,
    comparisonTitle: `${data.brandName} vs ${c1} vs ${c2}: Which is Better in ${new Date().getFullYear()}?`,
    comparisonCompetitor1: c1,
    comparisonCompetitor2: c2,
    comparisonOutline: [
      "H2: Quick comparison table",
      `H2: ${data.brandName} overview`,
      `H2: ${c1} overview`,
      `H2: ${c2} overview`,
      "H2: Side-by-side feature comparison",
      "H2: Pricing breakdown",
      "H2: Which should you choose?",
      "H2: FAQ",
    ],
    newsletters: newsletters.map((n) => ({
      ...n,
      pitch: `${data.brandName} is a ${data.category} tool helping ${data.market} teams get results faster. We've helped hundreds of companies improve their ${data.category} metrics in under 30 days. Would love to be featured in ${n.name} - happy to offer readers an exclusive trial.`,
      subject: `${data.brandName} - ${data.category} tool your readers will love`,
    })),
    competitorGaps: [
      { platform: "G2", url: "https://g2.com/products/new", reason: "Competitor profiles on G2 boost AI citations significantly" },
      { platform: "Capterra", url: "https://www.capterra.com/vendors/sign-up", reason: "Capterra is heavily cited by ChatGPT for software comparisons" },
      { platform: "Trustpilot", url: "https://business.trustpilot.com/signup", reason: "Review sites strengthen entity signals for AI systems" },
      { platform: "Slant.co", url: "https://www.slant.co/", reason: "Frequently cited in ChatGPT responses for tool comparisons" },
    ],
  };
}

export function buildRoadmapWeeks(data: AuditDataForRoadmap, ai: RoadmapAiContent): RoadmapWeek[] {
  const checks = data.technicalAudit?.checks ?? [];
  const tech = data.technicalAudit;
  const score = data.scoreTotal;

  const llmsTxt = getTechCheck(checks, "llms-txt");
  const robotsTxt = getTechCheck(checks, "robots-txt");
  const schema = getTechCheck(checks, "schema-markup");
  const entity = getTechCheck(checks, "entity-consistency");

  const w1Tasks: RoadmapTaskItem[] = [];

  if (!isPassOrWarn(llmsTxt)) {
    w1Tasks.push({
      id: "w1-llms-txt",
      title: "Create your llms.txt file",
      priority: "CRITICAL",
      timeMinutes: 15,
      impactMin: 8,
      impactMax: 12,
      url: null,
      content: {
        type: "code",
        steps: [
          "Your llms.txt file has been generated below",
          `Upload to: ${data.domain}/llms.txt`,
          "Test it by visiting that URL in your browser",
        ],
      },
    });
  }

  if (!isPassOrWarn(robotsTxt)) {
    w1Tasks.push({
      id: "w1-robots-txt",
      title: "Allow AI crawlers in robots.txt",
      priority: "CRITICAL",
      timeMinutes: 10,
      impactMin: 5,
      impactMax: 8,
      url: null,
      content: {
        type: "code",
        code: `User-agent: GPTBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nUser-agent: anthropic-ai\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: Amazonbot\nAllow: /`,
        instruction: "Add these exact lines to your existing robots.txt file",
      },
    });
  }

  if (!isPassOrWarn(schema)) {
    w1Tasks.push({
      id: "w1-schema",
      title: "Add Organization Schema markup",
      priority: "HIGH",
      timeMinutes: 20,
      impactMin: 6,
      impactMax: 10,
      url: null,
      content: {
        type: "code",
        code: JSON.stringify(
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: data.brandName,
            url: `https://${data.domain}`,
            description: ai.brandSummary,
            sameAs: tech?.socialLinks ?? [],
          },
          null,
          2,
        ),
        instruction: "Paste this inside a <script type=\"application/ld+json\"> tag in your homepage <head>",
        testUrl: "https://validator.schema.org",
      },
    });
  }

  if (!isPassOrWarn(entity)) {
    w1Tasks.push({
      id: "w1-entity",
      title: "Add social profile links to your homepage footer",
      priority: "HIGH",
      timeMinutes: 10,
      impactMin: 5,
      impactMax: 8,
      url: null,
      content: {
        type: "instructions",
        steps: [
          "Add links to your LinkedIn, Twitter/X, and Crunchbase pages in the footer",
          "Make sure the links are visible HTML - not hidden or behind JavaScript",
          "This helps AI systems verify your brand entity across platforms",
        ],
      },
    });
  }

  w1Tasks.push(
    {
      id: "w1-crunchbase",
      title: "Create your Crunchbase profile",
      priority: "HIGH",
      timeMinutes: 15,
      impactMin: 8,
      impactMax: 15,
      url: "https://www.crunchbase.com/add-new",
      content: {
        type: "copy",
        label: "Copy this exact description for Crunchbase:",
        text: ai.crunchbaseDescription,
        categories: data.category,
      },
    },
    {
      id: "w1-producthunt",
      title: "Submit to Product Hunt",
      priority: "HIGH",
      timeMinutes: 20,
      impactMin: 10,
      impactMax: 20,
      url: "https://www.producthunt.com/posts/new",
      content: {
        type: "listing",
        name: data.brandName,
        tagline: ai.productHuntTagline,
        description: ai.productHuntDescription,
        topics: ai.productHuntTopics,
      },
    },
    {
      id: "w1-linkedin",
      title: "Create LinkedIn Company Page",
      priority: "HIGH",
      timeMinutes: 10,
      impactMin: 6,
      impactMax: 10,
      url: "https://www.linkedin.com/company/setup/new",
      content: {
        type: "copy",
        label: "Copy this company description for LinkedIn:",
        text: ai.crunchbaseDescription,
      },
    },
    {
      id: "w1-directories",
      title: "Submit to AI directories",
      priority: "HIGH",
      timeMinutes: 30,
      impactMin: 10,
      impactMax: 20,
      url: null,
      content: {
        type: "checklist",
        items: getAiDirectories(data.category, data.market).map((d) => ({
          label: d.name,
          url: d.url,
        })),
      },
    },
  );

  const w2Tasks: RoadmapTaskItem[] = [
    {
      id: "w2-page-title",
      title: "Fix your page title tag",
      priority: "HIGH",
      timeMinutes: 10,
      impactMin: 3,
      impactMax: 5,
      url: null,
      content: {
        type: "before-after",
        current: tech?.currentTitle ?? "Not detected",
        suggested: ai.suggestedPageTitle,
        instruction: "Update your HTML <title> tag and your CMS/framework page title setting",
      },
    },
    {
      id: "w2-meta-desc",
      title: "Fix your meta description",
      priority: "HIGH",
      timeMinutes: 10,
      impactMin: 3,
      impactMax: 5,
      url: null,
      content: {
        type: "before-after",
        current: tech?.currentMetaDescription ?? "Not detected",
        suggested: ai.suggestedMetaDescription,
        instruction: "Update your <meta name=\"description\"> tag",
      },
    },
    {
      id: "w2-brand-summary",
      title: "Add quotable brand summary to homepage",
      priority: "HIGH",
      timeMinutes: 15,
      impactMin: 8,
      impactMax: 12,
      url: null,
      content: {
        type: "copy",
        label: "Add this text near the top of your homepage:",
        text: ai.brandHomepageSummary,
        instruction: "Place this above your hero section or as the first paragraph on your About page. This is what ChatGPT quotes when asked about you.",
      },
    },
    {
      id: "w2-article",
      title: "Write your foundational brand article",
      priority: "HIGH",
      timeMinutes: 120,
      impactMin: 10,
      impactMax: 20,
      url: null,
      content: {
        type: "article-outline",
        title: ai.articleTitle,
        wordCount: "1500-2000",
        keywords: ai.articleKeywords,
        outline: ai.articleOutline,
        internalLinks: [
          { page: "Homepage", anchor: data.brandName },
          { page: "About page", anchor: "learn more" },
        ],
      },
    },
    {
      id: "w2-republish",
      title: "Republish on authority sites",
      priority: "MEDIUM",
      timeMinutes: 30,
      impactMin: 6,
      impactMax: 10,
      url: null,
      content: {
        type: "checklist",
        items: [
          { label: "Medium (DA 95)", url: "https://medium.com" },
          { label: "dev.to (DA 79 - best for tech)", url: "https://dev.to" },
          { label: "Hashnode (DA 76)", url: "https://hashnode.com" },
          { label: "Substack (DA 91)", url: "https://substack.com" },
        ],
      },
    },
  ];

  const w3Tasks: RoadmapTaskItem[] = [
    {
      id: "w3-reddit",
      title: "Build Reddit presence",
      priority: "MEDIUM",
      timeMinutes: 60,
      impactMin: 5,
      impactMax: 15,
      url: "https://reddit.com",
      content: {
        type: "reddit",
        subreddits: ai.redditSubreddits,
        questionTypes: ai.redditQuestionTypes,
        replyTemplate: ai.redditReplyTemplate,
        threadTitle: ai.redditThreadTitle,
        threadBody: ai.redditThreadBody,
      },
    },
    {
      id: "w3-comparison",
      title: "Create comparison article",
      priority: "MEDIUM",
      timeMinutes: 150,
      impactMin: 8,
      impactMax: 15,
      url: null,
      content: {
        type: "article-outline",
        title: ai.comparisonTitle,
        wordCount: "2000-2500",
        keywords: [`${data.brandName} vs ${ai.comparisonCompetitor1}`, `best ${data.category} tool`],
        outline: ai.comparisonOutline,
        internalLinks: [
          { page: "Foundational article", anchor: `learn more about ${data.brandName}` },
        ],
      },
    },
    {
      id: "w3-internal-links",
      title: "Fix internal linking",
      priority: "MEDIUM",
      timeMinutes: 30,
      impactMin: 3,
      impactMax: 5,
      url: null,
      content: {
        type: "instructions",
        steps: [
          `Your homepage should link to: /about (anchor: About ${data.brandName}), /pricing (anchor: pricing), /blog (anchor: latest articles)`,
          `Your blog posts should link back to the homepage with anchor: ${data.brandName}`,
          "Every new blog post should link to your foundational article",
        ],
      },
    },
  ];

  const w4Tasks: RoadmapTaskItem[] = [
    {
      id: "w4-newsletters",
      title: "Get featured in newsletters",
      priority: "HIGH",
      timeMinutes: 30,
      impactMin: 5,
      impactMax: 20,
      url: null,
      content: {
        type: "newsletters",
        items: ai.newsletters.map((n) => ({
          name: n.name,
          url: n.url,
          subscribers: n.subscribers,
          pitch: n.pitch,
          subject: n.subject,
        })),
      },
    },
    {
      id: "w4-competitor-gaps",
      title: "Close competitor citation gaps",
      priority: "HIGH",
      timeMinutes: 60,
      impactMin: 10,
      impactMax: 20,
      url: null,
      content: {
        type: "checklist",
        intro: `Your competitors appear on platforms you are not listed on yet. Getting listed here will put you in the same citation pool that AI systems draw from.`,
        items: ai.competitorGaps.map((g) => ({
          label: `${g.platform} - ${g.reason}`,
          url: g.url,
        })),
      },
    },
  ];

  return [
    {
      id: "w1",
      label: "Foundation",
      subtitle: "Technical fixes and first citations - fastest wins",
      targetScore: Math.min(score + 25, 30),
      fromScore: score,
      toScore: Math.min(score + 25, 100),
      tasks: w1Tasks,
    },
    {
      id: "w2",
      label: "Content",
      subtitle: "Metadata fixes and your first AI-friendly content",
      targetScore: Math.min(score + 40, 50),
      fromScore: Math.min(score + 25, 30),
      toScore: Math.min(score + 40, 100),
      tasks: w2Tasks,
    },
    {
      id: "w3",
      label: "Authority",
      subtitle: "Reddit presence and comparison content",
      targetScore: Math.min(score + 60, 70),
      fromScore: Math.min(score + 40, 50),
      toScore: Math.min(score + 60, 100),
      tasks: w3Tasks,
    },
    {
      id: "w4",
      label: "PR + Amplification",
      subtitle: "Newsletter features and closing competitor gaps",
      targetScore: Math.min(score + 80, 90),
      fromScore: Math.min(score + 60, 70),
      toScore: Math.min(score + 80, 100),
      tasks: w4Tasks,
    },
  ];
}
