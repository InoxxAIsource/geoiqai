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
  citeCode: string;
  cite: "C" | "I" | "T" | "E";
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  time: string;
  impact: number;
  instructions: string;
  code?: string;
  codeLabel?: string;
  url?: string;
  urlLabel?: string;
  generated?: string;
  platforms?: Platform[];
}

interface Dimension {
  cite: "C" | "I" | "T" | "E";
  label: string;
  shortLabel: string;
  description: string;
  tasks: Task[];
}

const CITE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  C: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  I: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  T: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  E: { bg: "#FAF5FF", text: "#6B21A8", border: "#E9D5FF" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: "#FEF3C7", text: "#92400E" },
  MEDIUM: { bg: "#DBEAFE", text: "#1E40AF" },
  LOW: { bg: "#F3F4F6", text: "#374151" },
};

const ALL_PLATFORMS: Platform[] = [
  { name: "There's An AI For That", dr: 67, url: "https://theresanaiforthat.com/submit-tool" },
  { name: "FutureTools", dr: 58, url: "https://futuretools.io/submit" },
  { name: "Toolify.ai", dr: 45, url: "https://toolify.ai/submit-tool" },
  { name: "AI Scout", dr: 42, url: "https://aiscout.net/submit" },
  { name: "TopAI.tools", dr: 48, url: "https://topai.tools/submit" },
  { name: "G2", dr: 91, url: "https://g2.com/products/new", forCategories: ["saas", "tool", "software", "platform"] },
  { name: "Capterra", dr: 88, url: "https://capterra.com/vendors/sign-up", forCategories: ["saas", "tool", "software", "platform"] },
  { name: "GetApp", dr: 82, url: "https://getapp.com/list-your-software", forCategories: ["saas", "tool", "software", "platform"] },
  { name: "Inc42", dr: 71, url: "https://inc42.com/submit-startup", forCategories: ["fintech", "finance", "payment", "startup"] },
  { name: "Entrackr", dr: 55, url: "https://entrackr.com/contact", forCategories: ["fintech", "finance", "payment"] },
  { name: "HealthShots", dr: 67, url: "https://healthshots.com/submit", forCategories: ["health", "diet", "fitness", "medical"] },
];

function getPlatforms(category: string | null): Platform[] {
  const cat = (category ?? "").toLowerCase();
  const base = ALL_PLATFORMS.filter(p => !p.forCategories);
  const specific = ALL_PLATFORMS.filter(p => p.forCategories?.some(c => cat.includes(c)));
  return [...base, ...specific];
}

function buildDimensions(brand: Brand): Dimension[] {
  const bn = brand.brandName ?? brand.domain;
  const domain = brand.domain;
  const platforms = getPlatforms(brand.category);

  const robotsTxtCode = `# AI Crawler Access
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
Allow: /

User-agent: Bingbot
Allow: /`;

  const llmsTxtCode = `# ${bn}
> ${bn} helps founders and startups track and improve AI visibility.

## About
${bn} is a platform that monitors how your brand appears in ChatGPT, Gemini, and Perplexity.

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
  "description": "[Your 1-2 sentence description here]",
  "logo": "https://${domain}/logo.png",
  "foundingDate": "2024",
  "sameAs": [
    "https://twitter.com/${domain.split(".")[0]}",
    "https://linkedin.com/company/${domain.split(".")[0]}",
    "https://www.crunchbase.com/organization/${domain.split(".")[0]}"
  ]
}
</script>`;

  const articleSchemaCode = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Article Title",
  "datePublished": "2026-05-01",
  "dateModified": "2026-05-28",
  "author": {
    "@type": "Person",
    "name": "Founder Name",
    "url": "https://linkedin.com/in/yourprofile"
  },
  "publisher": {
    "@type": "Organization",
    "name": "${bn}",
    "logo": { "@type": "ImageObject", "url": "https://${domain}/logo.png" }
  }
}
</script>`;

  const faqSchemaCode = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is ${bn}?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${bn} is [your 1-sentence description]."
      }
    },
    {
      "@type": "Question",
      "name": "How does ${bn} work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[How it works in 1-2 sentences]."
      }
    }
  ]
}
</script>`;

  const indexNowCode = `# Step 1: Generate a key (any random string, e.g. ${domain.split(".")[0]}2026key)
# Step 2: Create a file at https://${domain}/[your-key].txt
#   File content: just the key string itself
# Step 3: Submit your URLs:

curl -X POST "https://api.indexnow.org/indexnow" \\
  -H "Content-Type: application/json" \\
  -d '{
    "host": "${domain}",
    "key": "${domain.split(".")[0]}2026key",
    "keyLocation": "https://${domain}/${domain.split(".")[0]}2026key.txt",
    "urlList": [
      "https://${domain}/",
      "https://${domain}/about",
      "https://${domain}/blog/your-latest-post"
    ]
  }'

# HTTP 202 = accepted. Run this every time you publish a new page.`;

  const canonicalDescCode = `<!-- Add this as your first visible paragraph on the homepage -->
<p class="brand-summary">
  ${bn} is [category] that helps [target audience] [achieve outcome].
  [One more sentence on what makes it different.]
</p>

<!-- Also update your llms.txt ">" line and Organization schema description
     to use the exact same wording. Consistency across all 3 is the goal. -->`;

  return [
    {
      cite: "C",
      label: "Citations",
      shortLabel: "C - Citations",
      description: "External mentions on high-authority sites. AI systems cite these sources when generating answers.",
      tasks: [
        {
          id: "C01", citeCode: "C01", cite: "C", priority: "HIGH",
          title: "Create Crunchbase profile",
          time: "30 mins", impact: 12,
          instructions: `Crunchbase is one of the most frequently cited sources by ChatGPT and Gemini for company lookups. Create a complete profile for ${bn} - include your founding date, team size, funding status, location, and a clear description of what you do. Use the exact same description you use on your homepage.`,
          url: "https://www.crunchbase.com/add-new/organization",
          urlLabel: "Create Crunchbase profile",
          generated: `${bn} is a [category] platform that helps [target audience] [achieve outcome]. Founded in [year], ${bn} [key differentiator]. Based in [city], India.`,
        },
        {
          id: "C02", citeCode: "C02", cite: "C", priority: "HIGH",
          title: "Submit to Product Hunt",
          time: "1 hour", impact: 15,
          instructions: `Product Hunt (DR 90+) is heavily indexed by AI systems and frequently cited when users ask for tool recommendations. Submit ${bn} with a punchy tagline and full description. Best launch days are Tuesday-Thursday. Aim for 12:01am PT to maximize upvotes from the US audience. Ask your network to support you on launch day - the ranking matters for how long your listing stays visible.`,
          url: "https://www.producthunt.com/posts/new",
          urlLabel: "Submit to Product Hunt",
          generated: `Tagline: "Know exactly where your brand stands in ChatGPT, Gemini, and Perplexity"\n\nDescription: ${bn} is the first GEO score for startups. Enter your domain and get a real score across all major AI systems in 60 seconds. Track daily, fix what's broken, and watch your AI visibility climb.\n\nTopics: Artificial Intelligence, SEO, Analytics, Marketing, Startups`,
        },
        {
          id: "C03", citeCode: "C03", cite: "C", priority: "HIGH",
          title: "Get a G2 listing",
          time: "30 mins", impact: 10,
          instructions: `G2 (DR 91) is one of the highest-authority software review sites and is cited constantly by AI systems for software recommendations. Create your product listing with a full description, screenshots, and category tags. The listing itself helps even before you have reviews.`,
          url: "https://g2.com/products/new",
          urlLabel: "Create G2 listing",
          generated: `Product description for G2:\n\n${bn} helps startup founders understand and improve how their brand appears in AI systems like ChatGPT, Gemini, and Perplexity. Enter your domain and get a GEO IQ score in under 60 seconds. Track your score daily, identify what's holding you back, and run specific fix actions to improve AI visibility.\n\nCategories: SEO Software, AI Tools, Marketing Analytics`,
        },
        {
          id: "C04", citeCode: "C04", cite: "C", priority: "MEDIUM",
          title: "Post Show HN on Hacker News",
          time: "1 hour", impact: 8,
          instructions: `Hacker News posts (especially popular ones) get indexed by AI systems and cited in technical discussions. A Show HN works best when you share a genuine story - what problem you found, how you built the solution, and what you learned. Be ready to respond to comments quickly. Post on weekdays between 9am-12pm ET for best visibility.`,
          url: "https://news.ycombinator.com/submit",
          urlLabel: "Submit to Hacker News",
          generated: `Title: "Show HN: ${bn} - We built a GEO score to see how AI systems talk about your startup"\n\nOpening comment:\nHi HN, I'm [Name], founder of ${bn}.\n\nWe noticed that our startup wasn't showing up in ChatGPT or Gemini responses, even though we had decent SEO. After digging in, we realized AI systems use different signals than Google - citations, schema markup, entity recognition, and crawl access.\n\nSo we built ${bn}: enter your domain and get a score across ChatGPT, Gemini, and Perplexity in 60 seconds. It shows you exactly what's missing and gives you specific fixes.\n\nWould love your feedback.`,
        },
        {
          id: "C05", citeCode: "C05", cite: "C", priority: "HIGH",
          title: "Get covered in an industry publication",
          time: "2 hours", impact: 20,
          instructions: `A mention in a publication like YourStory, Inc42, The Ken, or TechCrunch carries enormous weight with AI systems. Pitch a data angle - something specific you've found (e.g. "72% of Indian startups are invisible in ChatGPT"). Journalists need a hook, not a press release. Keep your pitch to 3-4 sentences and offer to share the data first.`,
          generated: `Pitch for YourStory / Inc42:\nSubject: Data: X% of Indian startups don't show up in ChatGPT - we measured it\n\n"Hi [Name], I'm [Founder] from ${bn}. We've run AI visibility audits on [N] Indian startups and found that [X]% don't appear in ChatGPT responses even for direct brand queries - mainly because AI systems can't access or recognize them. Happy to share the full dataset if it's useful for a story. We built a free tool to check: ${domain}"\n\nKeep it under 100 words. Data beats adjectives.`,
        },
        {
          id: "C06", citeCode: "C06", cite: "C", priority: "MEDIUM",
          title: "Submit to AI tool directories",
          time: "1 hour", impact: 15,
          instructions: "Each directory submission adds a backlink and a citation source that AI systems index. Check each off as you go. These compound - the more directories you appear in, the more likely AI systems are to pick up your brand.",
          platforms,
        },
        {
          id: "C07", citeCode: "C07", cite: "C", priority: "HIGH",
          title: "Get a newsletter feature",
          time: "1 hour", impact: 20,
          instructions: `Newsletter features create downstream citations. A mention in TLDR AI or The Ken often results in 10+ other sites picking up the story. Keep your pitch under 3 sentences. Lead with what makes ${bn} different, not what it does.`,
          generated: `India newsletters:\n- The Ken (theken.in, 200K subs): "Hi, I'm building ${bn}, a GEO score for Indian startups. We track how your brand appears in ChatGPT, Gemini, and Perplexity - like Google Search Console but for AI. Happy to share data on how Indian startups perform in AI search if useful."\n\n- YourStory Newsletter (500K subs): "Covering AI-native tools for Indian founders? ${bn} gives startups a daily GEO IQ score across all major AI systems. We've seen most Indian startups are invisible in ChatGPT. Happy to share the data."\n\nGlobal:\n- TLDR AI (tldr.tech, 500K+ subs): "Tool: ${bn} scores how visible your startup is in ChatGPT, Gemini, and Perplexity. Free audit at ${domain}"\n\n- Ben's Bites (bensbites.co, 100K subs): "Founders are realizing Google SEO doesn't translate to AI visibility. ${bn} tracks your GEO IQ score daily."`,
        },
        {
          id: "C08", citeCode: "C08", cite: "C", priority: "HIGH",
          title: "Create LinkedIn Company Page",
          time: "15 mins", impact: 8,
          instructions: `LinkedIn company pages are indexed by Bing and directly cited by Microsoft Copilot. Create or update your ${bn} company page with a complete description, logo, website URL, and industry tags. Use the exact same 1-2 sentence description you use everywhere else.`,
          url: "https://www.linkedin.com/company/setup/new",
          urlLabel: "Create LinkedIn Company Page",
          generated: `${bn} helps founders track how their brand appears in ChatGPT, Gemini, and Perplexity. Think of it as Google Search Console, but for AI search. Get your GEO IQ score free in 60 seconds.\n\nIndustry: Software Development / Marketing Technology\nCompany size: 1-10 employees\nType: Privately Held`,
        },
        {
          id: "C09", citeCode: "C09", cite: "C", priority: "MEDIUM",
          title: "Get 10+ G2 reviews",
          time: "Ongoing", impact: 12,
          instructions: `Reviews on G2 are cited by AI systems when users ask "what do people say about X?" Ask your current users directly - a personal message converts at 30-40%. Offer to help them write it. The goal is 10+ reviews to reach "Reviewed" status, which unlocks G2's badge and increases how often you appear in AI comparisons.`,
          url: "https://g2.com/products/new",
          urlLabel: "View your G2 profile",
          generated: `Review request message to send to users:\n\n"Hi [Name], quick favour - would you be willing to leave us a 2-minute review on G2? You've been using ${bn} for a while and your honest take would really help other founders find us. Here's the direct link: [G2 review link]\n\nHappy to do the same for any tool you use - just say the word."`,
        },
        {
          id: "C10", citeCode: "C10", cite: "C", priority: "MEDIUM",
          title: "Guest post on a high-DR site",
          time: "3 hours", impact: 15,
          instructions: `Guest posts on DR 60+ publications create authoritative citations that AI systems trust heavily. Focus on genuinely useful content - not a product pitch. Target publications where your audience already spends time. The byline and the link back to your site are what matter for AI visibility.`,
          generated: `High-value targets:\n- dev.to (DR 79): "How AI systems decide which brands to mention - and what you can do about it"\n- Hacker News: Show HN or Ask HN with your GEO data findings\n- Indie Hackers (DR 72): Founder story on building for AI visibility\n- ScrollStack or Substack: Long-form piece on GEO for a newsletter audience\n\nOutreach template:\nSubject: Guest post idea for [Publication]\n\n"Hi [Name], I read your piece on [topic] - good breakdown. I have data on [specific finding related to their audience] and could turn it into a 1500-word piece for [Publication]. The angle: [one sentence]. No product pitch - just the data and the insight. Interested?"\n\nKeep it under 80 words.`,
        },
      ],
    },
    {
      cite: "I",
      label: "Indexability",
      shortLabel: "I - Indexability",
      description: "Whether AI crawlers can access and read your content. If bots can't crawl you, nothing else matters.",
      tasks: [
        {
          id: "I01", citeCode: "I01", cite: "I", priority: "HIGH",
          title: "Allow GPTBot in robots.txt",
          time: "5 mins", impact: 8,
          instructions: `GPTBot is OpenAI's web crawler - it builds ChatGPT's training data and powers real-time browsing. If it's blocked or missing from your robots.txt, ChatGPT may never know you exist. Add the allow rule to your existing robots.txt file.`,
          code: `User-agent: GPTBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /`,
          codeLabel: "Add to robots.txt",
          url: `https://${domain}/robots.txt`,
          urlLabel: "Check your robots.txt",
        },
        {
          id: "I02", citeCode: "I02", cite: "I", priority: "HIGH",
          title: "Allow PerplexityBot in robots.txt",
          time: "5 mins", impact: 6,
          instructions: `PerplexityBot crawls the web for Perplexity's real-time search results. Perplexity is heavily used by researchers and developers - a strong presence here drives direct traffic and citations.`,
          code: `User-agent: PerplexityBot\nAllow: /`,
          codeLabel: "Add to robots.txt",
          url: `https://${domain}/robots.txt`,
          urlLabel: "Check your robots.txt",
        },
        {
          id: "I03", citeCode: "I03", cite: "I", priority: "HIGH",
          title: "Allow ClaudeBot in robots.txt",
          time: "5 mins", impact: 6,
          instructions: `ClaudeBot is Anthropic's crawler for Claude AI. Claude is the default AI assistant for many enterprise teams and developers. Allowing it ensures your content feeds into Claude's knowledge.`,
          code: `User-agent: Claude-Web\nAllow: /\n\nUser-agent: anthropic-ai\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /`,
          codeLabel: "Add to robots.txt",
          url: `https://${domain}/robots.txt`,
          urlLabel: "Check your robots.txt",
        },
        {
          id: "I04", citeCode: "I04", cite: "I", priority: "MEDIUM",
          title: "Allow Bingbot in robots.txt",
          time: "5 mins", impact: 5,
          instructions: `Bing powers Microsoft Copilot. Allowing Bingbot ensures your content shows up in Copilot responses and Bing's index, which feeds several AI systems. This is often already allowed by default but worth verifying.`,
          code: `User-agent: Bingbot\nAllow: /\n\nUser-agent: msnbot\nAllow: /`,
          codeLabel: "Add to robots.txt",
          url: `https://${domain}/robots.txt`,
          urlLabel: "Check your robots.txt",
        },
        {
          id: "I05", citeCode: "I05", cite: "I", priority: "HIGH",
          title: "Create llms.txt",
          time: "15 mins", impact: 10,
          instructions: `llms.txt is the AI equivalent of a sitemap. It tells language models exactly who you are, what you do, and where to find your key pages - in a format they can parse without inference. Place it at https://${domain}/llms.txt. Use simple Markdown with a clear description in the first blockquote line.`,
          code: llmsTxtCode,
          codeLabel: "Save as llms.txt",
          url: `https://${domain}/llms.txt`,
          urlLabel: "Test your llms.txt URL",
        },
        {
          id: "I06", citeCode: "I06", cite: "I", priority: "HIGH",
          title: "Submit sitemap to Google",
          time: "10 mins", impact: 7,
          instructions: `Submitting your sitemap to Google Search Console ensures all your pages are discovered and indexed. This directly feeds Google's AI Overview and Gemini. If you don't have a sitemap, create one first at ${domain}/sitemap.xml listing all your main pages.`,
          url: "https://search.google.com/search-console",
          urlLabel: "Open Google Search Console",
          generated: `In Google Search Console:\n1. Go to Sitemaps (left sidebar)\n2. Enter your sitemap URL: https://${domain}/sitemap.xml\n3. Click Submit\n\nIf you see an error, check that your sitemap is publicly accessible and returns Content-Type: application/xml or text/xml.`,
        },
        {
          id: "I07", citeCode: "I07", cite: "I", priority: "MEDIUM",
          title: "Submit sitemap to Bing",
          time: "10 mins", impact: 5,
          instructions: `Bing Webmaster Tools feeds Microsoft Copilot. Submitting your sitemap here ensures Copilot can find and cite your content. Bing also shares indexed data with several other search and AI systems.`,
          url: "https://www.bing.com/webmasters/sitemaps",
          urlLabel: "Open Bing Webmaster Tools",
          generated: `In Bing Webmaster Tools:\n1. Sign in with a Microsoft account\n2. Add your site if not already added\n3. Go to Sitemaps in the left menu\n4. Click Submit Sitemap\n5. Enter: https://${domain}/sitemap.xml`,
        },
        {
          id: "I08", citeCode: "I08", cite: "I", priority: "HIGH",
          title: "Send IndexNow ping",
          time: "10 mins", impact: 7,
          instructions: `IndexNow notifies Bing, Yandex, Seznam, and Naver simultaneously with a single API call. Bing shares this indexed data with Microsoft Copilot - so this directly improves your AI visibility. Run this every time you publish a new page.`,
          code: indexNowCode,
          codeLabel: "Copy IndexNow script",
          url: "https://www.bing.com/webmasters/indexnow",
          urlLabel: "IndexNow on Bing Webmaster Tools",
        },
        {
          id: "I09", citeCode: "I09", cite: "I", priority: "MEDIUM",
          title: "Fix crawl errors",
          time: "1 hour", impact: 6,
          instructions: `Crawl errors (404s, redirect loops, server errors) signal to AI systems that your site is unreliable. Check Google Search Console's Coverage report and fix every error you find. Prioritize pages that get organic traffic or are linked from other sites.`,
          url: "https://search.google.com/search-console",
          urlLabel: "Check Coverage report in GSC",
          generated: `Common fixes:\n- 404 pages: Either restore the content or add a 301 redirect to a relevant existing page\n- Soft 404s: Pages that return 200 but say "not found" - update the content or return a real 404\n- Redirect chains: A -> B -> C should be A -> C directly\n- Blocked by robots.txt: Check your disallow rules aren't accidentally blocking key pages`,
        },
        {
          id: "I10", citeCode: "I10", cite: "I", priority: "LOW",
          title: "Improve page speed (LCP under 2.5s)",
          time: "4 hours", impact: 5,
          instructions: `Google uses Core Web Vitals as a ranking signal, and page speed affects whether AI systems like Google's AI Overview include your content. Aim for LCP (Largest Contentful Paint) under 2.5 seconds. The biggest wins are usually image optimization and eliminating render-blocking scripts.`,
          url: "https://pagespeed.web.dev",
          urlLabel: "Test page speed",
          generated: `Quick wins for speed:\n1. Compress all images - use WebP format, lazy load below-the-fold images\n2. Serve images from a CDN if possible\n3. Defer non-critical JavaScript: add defer or async to script tags\n4. Preload your hero image: <link rel="preload" as="image" href="/hero.webp">\n5. Remove unused CSS and JS\n\nTarget: LCP under 2.5s, FID under 100ms, CLS under 0.1`,
        },
      ],
    },
    {
      cite: "T",
      label: "Trustworthiness",
      shortLabel: "T - Trustworthiness",
      description: "Signals that tell AI systems your content is accurate and credible. Trust drives citation confidence.",
      tasks: [
        {
          id: "T01", citeCode: "T01", cite: "T", priority: "HIGH",
          title: "Add Organization schema",
          time: "20 mins", impact: 8,
          instructions: `Organization schema markup tells AI systems that ${bn} is a real, structured entity - not just a collection of web pages. Paste this inside the <head> tag of your homepage. Google and Gemini actively use this data to populate Knowledge Panels and AI Overviews.`,
          code: schemaCode,
          codeLabel: "Copy Organization schema",
          url: "https://validator.schema.org",
          urlLabel: "Validate your schema",
        },
        {
          id: "T02", citeCode: "T02", cite: "T", priority: "HIGH",
          title: "Add Article schema to blog posts",
          time: "30 mins", impact: 6,
          instructions: `Article schema helps AI systems understand the authorship, publication date, and credibility of your blog content. Add this to every blog post's <head>. This is especially important for content you want AI systems to cite in responses.`,
          code: articleSchemaCode,
          codeLabel: "Copy Article schema",
          url: "https://validator.schema.org",
          urlLabel: "Validate your schema",
        },
        {
          id: "T03", citeCode: "T03", cite: "T", priority: "MEDIUM",
          title: "Add FAQPage schema",
          time: "30 mins", impact: 6,
          instructions: `FAQ schema is one of the most effective types for AI citation. When users ask questions in ChatGPT or Gemini, these systems look for structured Q+A content they can quote directly. Add FAQ schema to your FAQ page and any page with a questions section.`,
          code: faqSchemaCode,
          codeLabel: "Copy FAQPage schema",
          url: "https://validator.schema.org",
          urlLabel: "Validate your schema",
        },
        {
          id: "T04", citeCode: "T04", cite: "T", priority: "MEDIUM",
          title: "Add author bio with credentials",
          time: "30 mins", impact: 5,
          instructions: `AI systems apply E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) signals. Author bios with real credentials increase the likelihood that your content gets cited. Every blog post should have a clear byline with the author's name, role, and a link to their LinkedIn or Twitter profile.`,
          generated: `Author bio template:\n\n"[Name] is [role] at ${bn}. [One sentence about their background or expertise relevant to the article topic]. Follow [him/her/them] on LinkedIn: [link]"\n\nKeep it to 2-3 sentences. Specific expertise beats vague credentials ("10 years in B2B SaaS" is better than "marketing expert").`,
        },
        {
          id: "T05", citeCode: "T05", cite: "T", priority: "MEDIUM",
          title: "Add publication dates to all content",
          time: "15 mins", impact: 4,
          instructions: `AI systems deprioritize content with no publication date - they can't tell if it's current or outdated. Add a visible "Published" and "Last updated" date to every blog post and long-form page. Use ISO date format (YYYY-MM-DD) in your HTML for schema compatibility.`,
          code: `<!-- Add to each article or long-form page -->
<time datetime="2026-05-01">Published May 1, 2026</time>
<time datetime="2026-05-28">Updated May 28, 2026</time>`,
          codeLabel: "Copy date markup",
        },
        {
          id: "T06", citeCode: "T06", cite: "T", priority: "MEDIUM",
          title: "Add first-person case studies",
          time: "2 hours", impact: 8,
          instructions: `First-person case studies with real numbers are highly cited by AI systems because they contain verifiable claims. Write a detailed story of how a customer used ${bn} and what results they got. Include specific numbers, timelines, and quotes. This is more credible than a testimonial.`,
          generated: `Case study structure:\n\nTitle: "How [Company] improved their AI visibility from [before score] to [after score] in [timeframe]"\n\n1. The situation: What was the problem before\n2. What they tried: Previous approaches that didn't work\n3. The fix: What specific actions they took with ${bn}\n4. The result: Specific metrics with timeframe\n5. What's next: What they're doing now\n\nTarget length: 800-1200 words. Include a direct quote from the customer.`,
        },
        {
          id: "T07", citeCode: "T07", cite: "T", priority: "HIGH",
          title: "Create an About page with founder story",
          time: "1 hour", impact: 7,
          instructions: `AI systems look for evidence that a real person is behind a product. An About page with a founder photo, background, and the story of why you built ${bn} significantly increases trustworthiness signals. Include the founding date, your location, and a link to the founder's LinkedIn.`,
          url: `https://${domain}/about`,
          urlLabel: "Check your About page",
          generated: `About page structure:\n\n1. One-paragraph company description (same as your canonical description)\n2. Founding story: What problem you experienced, what you tried, what you built\n3. Founder section: Photo, name, background, LinkedIn link\n4. Location and founding date\n5. Contact information\n\nKeep the tone direct and personal. Write it like you'd tell a new friend about your company, not like a press release.`,
        },
        {
          id: "T08", citeCode: "T08", cite: "T", priority: "MEDIUM",
          title: "Add customer testimonials",
          time: "1 hour", impact: 6,
          instructions: `Real testimonials with names, company, and role increase trust signals. AI systems treat attributed quotes more seriously than anonymous ones. Add 3-5 testimonials to your homepage with full attribution. Include the customer's company name and role.`,
          generated: `Testimonial request message:\n\n"Hi [Name], would you be willing to share a quick quote about your experience with ${bn}? Something honest - what problem it solved for you or what you noticed after using it. I'd like to feature it on the homepage with your name and role at [Company] - happy to share a draft for you to approve first."\n\nFollow up once after 3 days if no response. A nudge converts well here.`,
        },
        {
          id: "T09", citeCode: "T09", cite: "T", priority: "HIGH",
          title: "Fix HTTPS and security headers",
          time: "30 mins", impact: 5,
          instructions: `HTTPS is baseline trust. Beyond that, security headers like Content-Security-Policy and X-Content-Type-Options signal to both Google and AI systems that your site is properly maintained. Check your current headers and fix any missing or misconfigured ones.`,
          url: "https://securityheaders.com",
          urlLabel: "Check your security headers",
          generated: `Minimum headers to add:\n\nX-Content-Type-Options: nosniff\nX-Frame-Options: SAMEORIGIN\nReferrer-Policy: strict-origin-when-cross-origin\nStrict-Transport-Security: max-age=31536000; includeSubDomains\n\nAdd these in your server config or via a middleware like helmet.js for Node.js apps.`,
        },
        {
          id: "T10", citeCode: "T10", cite: "T", priority: "HIGH",
          title: "Add privacy policy and terms of service",
          time: "1 hour", impact: 4,
          instructions: `Missing privacy and terms pages are a trust red flag for AI systems - they signal an incomplete or low-effort site. These pages also affect how Google assesses your site's legitimacy. Use a generator to create them quickly, then customize the key sections.`,
          url: "https://www.privacypolicygenerator.info",
          urlLabel: "Generate privacy policy",
          generated: `Key sections for ${bn}'s privacy policy:\n- What data you collect (email, usage data, cookies)\n- How you use it (product improvement, email communication)\n- Third parties you share with (analytics, payment processors)\n- Data retention period\n- How users can request deletion\n- Contact email for privacy questions\n\nFor terms: focus on acceptable use, what you're not liable for, and your refund/cancellation policy.`,
        },
      ],
    },
    {
      cite: "E",
      label: "Entity signals",
      shortLabel: "E - Entity",
      description: "How consistently your brand is described across the web. AI systems build an entity node from these signals.",
      tasks: [
        {
          id: "E01", citeCode: "E01", cite: "E", priority: "HIGH",
          title: "Use consistent brand name everywhere",
          time: "1 hour", impact: 6,
          instructions: `AI systems consolidate mentions of your brand into a single entity node. If you appear as "${bn}", "${bn.toLowerCase()}", "${bn.toUpperCase()}", and variations, the system fragments these into separate nodes with lower confidence. Pick one exact capitalization and use it consistently across every platform.`,
          generated: `Audit checklist - make sure the name matches on:\n[ ] Homepage title tag\n[ ] Meta description\n[ ] About page\n[ ] llms.txt header\n[ ] Organization schema "name" field\n[ ] Crunchbase profile\n[ ] G2 listing\n[ ] Product Hunt listing\n[ ] LinkedIn company page\n[ ] Twitter/X bio\n[ ] Email footer\n\nIf you have multiple variations out there, fix the ones you control and don't stress about the rest.`,
        },
        {
          id: "E02", citeCode: "E02", cite: "E", priority: "HIGH",
          title: "Write a canonical 2-sentence description",
          time: "15 mins", impact: 10,
          instructions: `The single highest-leverage entity signal is a consistent 2-sentence description used identically on your homepage, llms.txt, Organization schema, and all external profiles. AI systems use this exact phrasing when generating answers about your brand. Write it once, use it everywhere.`,
          code: canonicalDescCode,
          codeLabel: "Copy description template",
          generated: `Formula:\nSentence 1: "[Brand] is [category] that [what it does] for [who].\nSentence 2: [One sentence on the key differentiator or outcome].\n\nExample:\n"${bn} is a GEO platform that helps startup founders track and improve how their brand appears in AI systems like ChatGPT, Gemini, and Perplexity. It works like Google Search Console but for AI search - you get a daily visibility score and specific fix actions."\n\nOnce you have it: paste it word-for-word into your homepage, llms.txt, Organization schema description, Crunchbase, G2, LinkedIn, and Product Hunt.`,
        },
        {
          id: "E03", citeCode: "E03", cite: "E", priority: "HIGH",
          title: "Use the same category across all platforms",
          time: "30 mins", impact: 5,
          instructions: `Inconsistent categories fragment your entity. If you're "SEO Software" on G2, "Marketing Analytics" on Crunchbase, and "AI Tool" on Product Hunt, AI systems struggle to classify you. Pick one primary category and one secondary, and use them consistently.`,
          generated: `Recommended approach:\n1. Choose your primary category based on where your buyers search (e.g. "GEO Software" or "AI Visibility Analytics")\n2. Choose a secondary that maps to existing markets (e.g. "SEO Tools" or "Marketing Analytics")\n3. Update every platform profile to use these exact terms\n\nPlatforms to update:\n[ ] G2 category tags\n[ ] Crunchbase categories\n[ ] LinkedIn industry\n[ ] Product Hunt topics\n[ ] There's An AI For That category\n[ ] Your own homepage meta keywords`,
        },
        {
          id: "E04", citeCode: "E04", cite: "E", priority: "MEDIUM",
          title: "Use the same founding date everywhere",
          time: "30 mins", impact: 4,
          instructions: `Founding date is a basic entity fact AI systems use to verify your brand. Inconsistent dates across Crunchbase, LinkedIn, and your About page weaken entity confidence. Check all your profiles and align them to the same founding year and month.`,
          generated: `Platforms to check and align:\n[ ] Crunchbase "Founded" field\n[ ] LinkedIn Company Page "Founded" year\n[ ] About page founding date\n[ ] Organization schema "foundingDate" field\n[ ] Any press coverage that mentions when you were founded\n\nUse the ISO format (YYYY or YYYY-MM) in schema markup.`,
        },
        {
          id: "E05", citeCode: "E05", cite: "E", priority: "MEDIUM",
          title: "Create a Wikidata entry",
          time: "30 mins", impact: 6,
          instructions: `Wikidata is the structured knowledge base that feeds Google Knowledge Graph - and AI systems reference it directly for entity recognition. Creating a Wikidata entry for ${bn} signals that you are a real, verifiable entity with structured facts.`,
          url: "https://www.wikidata.org/wiki/Special:NewItem",
          urlLabel: "Create Wikidata entry",
          generated: `Properties to add in your Wikidata entry:\n- instance of: software / company\n- name: ${bn}\n- official website: https://${domain}\n- founded by: [founder name]\n- inception date: [founding date]\n- country: India\n- industry: software\n- short description: "AI visibility tracking platform for startups"\n\nWikidata requires your entity to be "notable" to be accepted. If you have press coverage or external references, link them as references for each claim.`,
        },
        {
          id: "E06", citeCode: "E06", cite: "E", priority: "LOW",
          title: "Get a Wikipedia mention",
          time: "2 hours", impact: 8,
          instructions: `Wikipedia is one of the most heavily weighted sources for AI training data. You're unlikely to get a standalone page immediately, but getting mentioned in a relevant Wikipedia article (e.g. "Generative Engine Optimization" or a list of Indian SaaS companies) adds a high-authority entity signal.`,
          url: "https://en.wikipedia.org/wiki/Special:Search?search=generative+engine+optimization",
          urlLabel: "Find relevant Wikipedia articles",
          generated: `Approach:\n1. Find existing Wikipedia articles in your space (GEO, AI tools, Indian SaaS)\n2. Check if the article has a "Tools" or "See Also" section\n3. Add a mention with a reference to a verifiable source (news article, Crunchbase, etc.)\n4. Wikipedia editors will remove self-promotional additions - frame it neutrally and include a citation\n\nNote: Do this only after you have at least 2-3 external press mentions to cite as references.`,
        },
        {
          id: "E07", citeCode: "E07", cite: "E", priority: "MEDIUM",
          title: "Claim your Google Knowledge Panel",
          time: "30 mins", impact: 7,
          instructions: `If Google has created a Knowledge Panel for ${bn}, you can claim it and correct any wrong information. Even if there's no panel yet, you can add structured data that helps Google create one. A Knowledge Panel dramatically increases how often AI Overviews include your brand.`,
          url: "https://support.google.com/knowledgepanel/answer/7534842",
          urlLabel: "Learn how to claim a Knowledge Panel",
          generated: `To claim a Knowledge Panel:\n1. Search for your brand name on Google\n2. If a panel exists on the right side, click "Claim this Knowledge Panel"\n3. Verify ownership via your official website or social profiles\n4. Once claimed, you can suggest corrections to wrong information\n\nIf no panel exists yet:\n- Make sure your Organization schema is correctly implemented\n- Ensure you have active Crunchbase, LinkedIn, and Wikidata entries\n- Panels are created algorithmically - consistent entity signals speed this up`,
        },
        {
          id: "E08", citeCode: "E08", cite: "E", priority: "HIGH",
          title: "Complete all social profiles",
          time: "1 hour", impact: 6,
          instructions: `AI systems cross-reference social profiles to validate brand legitimacy. Incomplete profiles (missing bio, logo, website URL) reduce entity confidence. Complete every social profile you have with consistent name, description, logo, and website link.`,
          generated: `Profile checklist for each platform (LinkedIn, Twitter/X, GitHub if relevant):\n[ ] Profile name matches exact brand name\n[ ] Bio uses your canonical 2-sentence description\n[ ] Logo/profile image is the same across all platforms\n[ ] Website URL is set to https://${domain}\n[ ] Location is set (city, country)\n[ ] Account is active (at least 1 post in the last 30 days)\n\nAlso add social profile URLs to your Organization schema "sameAs" array.`,
        },
        {
          id: "E09", citeCode: "E09", cite: "E", priority: "MEDIUM",
          title: "Use the same logo everywhere",
          time: "30 mins", impact: 4,
          instructions: `A consistent logo across all platforms helps AI systems visually confirm entity consistency. More importantly, AI systems that process structured data look for matching logo URLs in schema and profile data. Use the same image file, hosted on your own domain, everywhere.`,
          url: `https://${domain}/logo.png`,
          urlLabel: "Check your logo URL",
          generated: `Logo consistency checklist:\n[ ] Organization schema "logo" URL points to your domain (https://${domain}/logo.png)\n[ ] Same logo used on LinkedIn, Twitter, Crunchbase, G2, Product Hunt\n[ ] Logo file is square or follows each platform's recommended dimensions\n[ ] Favicon matches the logo\n[ ] Open Graph image (og:image) uses the logo or a branded version\n\nHost your logo at a permanent URL on your domain. Don't use third-party image hosts for the schema logo URL.`,
        },
        {
          id: "E10", citeCode: "E10", cite: "E", priority: "HIGH",
          title: "Link founder LinkedIn to company",
          time: "15 mins", impact: 5,
          instructions: `Linking your personal LinkedIn to ${bn}'s company page creates a verified founder-company relationship that AI systems recognize as an entity signal. This is especially important for Copilot and LinkedIn-trained AI systems. Make sure your LinkedIn experience section lists ${bn} as your current company with the company page linked.`,
          url: "https://www.linkedin.com/in/me/edit/experience",
          urlLabel: "Edit your LinkedIn experience",
          generated: `Steps:\n1. Go to your LinkedIn profile\n2. Edit the ${bn} entry in Experience\n3. In the Company field, search for and select the official ${bn} company page (not free text)\n4. Make sure this is marked as your current role\n5. Add the company website in your LinkedIn profile's "Contact info" section\n\nAlso verify: does the ${bn} company page show you as a team member? If not, the linking is incomplete.`,
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
  { taskId: "I01", keyword: "robot" },
  { taskId: "I05", keyword: "llm" },
  { taskId: "T01", keyword: "schema" },
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
  const [activeDim, setActiveDim] = useState(0);
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

  const dimensions = buildDimensions(brand);
  const currentDim = dimensions[activeDim]!;
  const isDone = (id: string) => completed.has(id) || autoCompleted.has(id);
  const doneCount = currentDim.tasks.filter(t => isDone(t.id)).length;
  const totalImpact = currentDim.tasks.reduce((s, t) => s + t.impact, 0);
  const progress = currentDim.tasks.length > 0 ? (doneCount / currentDim.tasks.length) * 100 : 0;
  const completedTasks = currentDim.tasks.filter(t => isDone(t.id));
  const pendingTasks = currentDim.tasks.filter(t => !isDone(t.id));

  const toggleDone = (id: string) => {
    if (autoCompleted.has(id)) return;
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cite = CITE_COLORS[currentDim.cite]!;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 2 }}>CITE framework - 40 fix actions</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Citations, Indexability, Trustworthiness, Entity signals. Work through each dimension to close your AI visibility gaps.</div>
      </div>

      {/* Dimension tabs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
        {dimensions.map((d, i) => {
          const c = CITE_COLORS[d.cite]!;
          const isActive = activeDim === i;
          const dimDone = d.tasks.filter(t => isDone(t.id)).length;
          return (
            <button
              key={d.cite}
              onClick={() => { setActiveDim(i); setExpandedTask(null); setShowDoneSection(false); }}
              style={{
                padding: "8px 6px",
                borderRadius: 8,
                border: isActive ? `1.5px solid ${c.border}` : "1px solid #E5E7EB",
                cursor: "pointer",
                background: isActive ? c.bg : "white",
                transition: "all 150ms",
                textAlign: "center" as const,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: isActive ? c.text : "#374151", lineHeight: 1 }}>{d.cite}</div>
              <div style={{ fontSize: 10, color: isActive ? c.text : "#9ca3af", marginTop: 2, fontWeight: 500 }}>{dimDone}/{d.tasks.length}</div>
            </button>
          );
        })}
      </div>

      {/* Dimension header */}
      <div style={{ background: cite.bg, border: `0.5px solid ${cite.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: cite.text, marginBottom: 3 }}>
          {currentDim.label}
        </div>
        <div style={{ fontSize: 12, color: cite.text, opacity: 0.8, lineHeight: 1.5 }}>{currentDim.description}</div>
      </div>

      {/* Progress tracker */}
      <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
            {doneCount} of {currentDim.tasks.length} complete
          </div>
          <div style={{ fontSize: 12, color: "#16A34A", fontWeight: 500 }}>+{totalImpact} pts available</div>
        </div>
        <div style={{ height: 5, background: "#F3F4F6", borderRadius: 9999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: cite.text, borderRadius: 9999, transition: "width 500ms ease" }} />
        </div>
        {doneCount === currentDim.tasks.length && currentDim.tasks.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#059669", fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
            <CheckCircle2 size={13} /> All {currentDim.label} actions done - move to the next dimension.
          </div>
        )}
      </div>

      {/* Task cards - pending only */}
      {pendingTasks.map(task => {
        const prio = PRIORITY_COLORS[task.priority]!;
        const taskCite = CITE_COLORS[task.cite]!;
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
              {/* CITE code badge */}
              <span style={{
                background: taskCite.bg,
                color: taskCite.text,
                border: `0.5px solid ${taskCite.border}`,
                borderRadius: 5,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                marginTop: 1,
                letterSpacing: "0.04em",
                fontFamily: "monospace",
              }}>
                {task.citeCode}
              </span>
              {/* Priority */}
              <span style={{ background: prio.bg, color: prio.text, borderRadius: 9999, padding: "2px 8px", fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>
                {task.priority}
              </span>
              {/* Title */}
              <div
                style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#111827", cursor: "pointer", lineHeight: 1.4 }}
                onClick={() => setExpandedTask(isExpanded ? null : task.id)}
              >
                {task.title}
              </div>
              {/* Right side */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{task.time}</span>
                <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 600 }}>+{task.impact} pts</span>
                <button
                  onClick={() => toggleDone(task.id)}
                  style={{ background: "transparent", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#6b7280", cursor: "pointer", fontWeight: 400, display: "flex", alignItems: "center", gap: 4 }}
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
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.65, marginBottom: 10 }}>
                  {task.instructions}
                </div>

                {task.code && <CodeBox code={task.code} label={task.codeLabel} />}

                {task.generated && !task.code && (
                  <div style={{ marginTop: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 5, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>Generated content</div>
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

                {task.generated && task.code && (
                  <div style={{ marginTop: 8, background: "#F9FAFB", borderRadius: 8, padding: "8px 10px", fontSize: 11.5, color: "#374151", lineHeight: 1.65 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 11, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Suggested content</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{task.generated}</div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(task.generated ?? ""); }}
                      style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, background: "transparent", border: "0.5px solid #e5e7eb", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#6b7280", cursor: "pointer" }}
                    >
                      <Copy size={9} /> Copy
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
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Check each off as you submit:</div>
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
              </div>
            )}
          </div>
        );
      })}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => setShowDoneSection(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: "4px 0", width: "100%" }}
          >
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, whiteSpace: "nowrap" }}>
              {completedTasks.length} done
            </span>
            {showDoneSection ? <ChevronDown size={13} color="#9ca3af" /> : <ChevronRight size={13} color="#9ca3af" />}
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
          </button>

          {showDoneSection && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {completedTasks.map(task => {
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
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", fontFamily: "monospace", marginRight: 2 }}>{task.citeCode}</span>
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
