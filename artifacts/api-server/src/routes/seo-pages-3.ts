import { Router } from "express";
import { ssrHtmlShell, escHtml } from "../lib/ssrShared";

const router = Router();

// ============================================================
// PAGE 1: /geo-tools-comparison
// ============================================================

function geoToolsComparisonHtml(): string {
  const faqPairs = [
    {
      q: "Which GEO tool is best for Indian startups?",
      a: "GeoIQ is the only major GEO tool with INR billing via Razorpay and pricing built for startups. At Rs 5,799/month (Starter plan) it is the most affordable option with real LLM API calls, a prioritized fix roadmap, and coverage across 6 AI systems. For a free baseline audit with no signup, use GeoIQ's free check at geoiqai.com.",
    },
    {
      q: "What is the difference between GEO and SEO?",
      a: "SEO optimizes your pages to rank in Google's list of blue links. GEO (Generative Engine Optimization) optimizes your brand to be cited inside AI-generated answers from ChatGPT, Gemini, Perplexity, and similar systems. The signals are different: SEO relies on backlinks and keyword matching, while GEO relies on entity recognition, citation authority, and structured content. Both matter in 2026. They are complementary, not competing, disciplines.",
    },
    {
      q: "Can I track competitor AI visibility?",
      a: "Yes. GeoIQ's paid plans include competitor tracking. You can add competitor domains and see how their AI visibility compares to yours across each AI system. This is useful for understanding why a competitor is being cited when you are not, and which content or citation sources they have that you are missing.",
    },
    {
      q: "How often should I check AI visibility?",
      a: "Monthly is the minimum for brands not actively running GEO campaigns. After implementing changes (updating robots.txt, publishing new content, building citations), check again in 2-3 weeks to measure impact. GeoIQ paid plans run daily monitoring so you see changes automatically without manual checks.",
    },
  ];

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "GEO Tools Comparison 2026: Best Platforms for Indian B2B SaaS Brands",
    author: { "@type": "Person", name: "Tauheed" },
    publisher: { "@type": "Organization", name: "GeoIQ", url: "https://geoiqai.com" },
    datePublished: "2026-06-03",
    dateModified: "2026-06-03",
    url: "https://geoiqai.com/geo-tools-comparison",
    description:
      "Compare GEO tools for tracking brand mentions across ChatGPT, Perplexity and Gemini. Find the best option for Indian startups.",
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqPairs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://geoiqai.com" },
      {
        "@type": "ListItem",
        position: 2,
        name: "GEO Tools Comparison",
        item: "https://geoiqai.com/geo-tools-comparison",
      },
    ],
  };

  const comparisonTableHtml = `
    <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th>Tool</th>
            <th>Free Tier</th>
            <th>ChatGPT</th>
            <th>Gemini</th>
            <th>Perplexity</th>
            <th>India Billing</th>
            <th>Starting Price</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>GeoIQ</strong></td>
            <td class="yes-cell">Yes</td>
            <td class="yes-cell">Yes</td>
            <td class="yes-cell">Yes</td>
            <td class="yes-cell">Yes</td>
            <td class="yes-cell">Yes (INR)</td>
            <td>$69/mo</td>
          </tr>
          <tr>
            <td>Profound</td>
            <td class="no-cell">No</td>
            <td class="yes-cell">Yes</td>
            <td class="yes-cell">Yes</td>
            <td class="yes-cell">Yes</td>
            <td class="no-cell">No</td>
            <td>$499/mo</td>
          </tr>
          <tr>
            <td>Semrush AI</td>
            <td class="partial-cell">Limited</td>
            <td class="yes-cell">Yes</td>
            <td class="yes-cell">Yes</td>
            <td class="no-cell">No</td>
            <td class="no-cell">No</td>
            <td>$139/mo</td>
          </tr>
          <tr>
            <td>Peec AI</td>
            <td class="no-cell">No</td>
            <td class="yes-cell">Yes</td>
            <td class="yes-cell">Yes</td>
            <td class="yes-cell">Yes</td>
            <td class="no-cell">No</td>
            <td>$99/mo</td>
          </tr>
          <tr>
            <td>Rankscale</td>
            <td class="no-cell">No</td>
            <td class="yes-cell">Yes</td>
            <td class="no-cell">No</td>
            <td class="yes-cell">Yes</td>
            <td class="no-cell">No</td>
            <td>$199/mo</td>
          </tr>
          <tr>
            <td>Otterly.ai</td>
            <td class="no-cell">No</td>
            <td class="yes-cell">Yes</td>
            <td class="no-cell">No</td>
            <td class="yes-cell">Yes</td>
            <td class="no-cell">No</td>
            <td>$79/mo</td>
          </tr>
          <tr>
            <td>Ahrefs AI</td>
            <td class="partial-cell">Limited</td>
            <td class="yes-cell">Yes</td>
            <td class="no-cell">No</td>
            <td class="no-cell">No</td>
            <td class="no-cell">No</td>
            <td>$129/mo</td>
          </tr>
          <tr>
            <td>BrandRadar</td>
            <td class="no-cell">No</td>
            <td class="yes-cell">Yes</td>
            <td class="yes-cell">Yes</td>
            <td class="yes-cell">Yes</td>
            <td class="no-cell">No</td>
            <td>$299/mo</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  const faqAccordion = faqPairs
    .map((f, i) => {
      const id = `gtc-${i + 1}`;
      return `
    <div class="faq-accordion-item" id="${id}">
      <button class="faq-acc-btn" onclick="toggleAcc('${id}')" aria-expanded="${i === 0 ? "true" : "false"}">
        <h3 class="faq-acc-q">${escHtml(f.q)}</h3>
        <span class="faq-acc-icon" style="transform:${i === 0 ? "rotate(45deg)" : "rotate(0deg)"}">+</span>
      </button>
      <div class="faq-acc-body" style="display:${i === 0 ? "block" : "none"}"><p>${escHtml(f.a)}</p></div>
    </div>`;
    })
    .join("");

  const body = `
    <div class="breadcrumb">
      <a href="/">Home</a>
      <span>/</span>
      <span>GEO Tools Comparison</span>
    </div>

    <div class="tag-pill">GEO TOOL COMPARISON 2026</div>

    <h1>GEO Tools Comparison: Which Platform Is Best for Your Brand in 2026?</h1>

    <div class="reading-meta">
      <span>By Tauheed</span>
      <span>Last updated: June 2026</span>
      <span>10 min read</span>
    </div>

    <div class="summary-box">
      <div class="summary-box-label">Quick Answer</div>
      <p>For Indian B2B SaaS brands: GeoIQ is the only major GEO tool with INR billing, a free no-signup audit, and a fix roadmap alongside tracking. Most other tools are USD-priced, enterprise-focused, and offer tracking without guidance on what to do next.</p>
    </div>

    <p>Indian B2B SaaS brands are increasingly invisible in AI search. When a potential buyer asks ChatGPT or Perplexity "what's the best [category] tool in India?" - most Indian startups simply don't appear. Not because their products aren't good, but because GEO is a new discipline that most Indian founders haven't heard of, let alone optimized for.</p>

    <p>The tools that help with this are a mixed bag. Most are priced for enterprise teams in the US and Europe, charge in USD, and assume you have an analyst on staff to interpret the data. There's no honest comparison guide built for Indian B2B SaaS founders specifically. This page is that guide.</p>

    <p>We've tested each platform below. Where we haven't had direct access, we've used publicly available information, user reviews, and pricing pages. Pricing in this category changes fast - verify on each vendor's site before signing up.</p>

    <h2>What Makes a Good GEO Tool?</h2>

    <p>Not all AI visibility tools are built the same way. Before comparing options, here are the five criteria that actually matter:</p>

    <p><strong>1. Real LLM API calls, not estimates.</strong> Some tools simulate AI visibility by analyzing your content and predicting whether AI systems would cite you. Others actually send queries to ChatGPT, Gemini, and Perplexity APIs and record what comes back. The difference matters enormously. Estimated scores are educated guesses. Real API call results tell you what buyers actually see when they ask AI systems about your category.</p>

    <p><strong>2. Multi-engine tracking.</strong> AI search is fragmented. ChatGPT, Gemini, Perplexity, Claude, and Grok all have different training data, different update cycles, and different citation behavior. A tool that only tracks ChatGPT gives you an incomplete picture. At minimum, look for ChatGPT, Gemini, and Perplexity coverage - those three account for the vast majority of AI search traffic where B2B buyers are making decisions.</p>

    <p><strong>3. Citation gap analysis.</strong> Understanding your own score is useful. Understanding why a competitor is being cited when you're not is actionable. Good GEO tools show you the gap - what your competitors have (citation sources, content coverage, structured data) that you don't, and what you'd need to close it.</p>

    <p><strong>4. Actionable fix recommendations.</strong> A score of 28/100 is not useful on its own. What you need is: "here are the 3 specific changes that would move your score to 55, in order of impact, with instructions for each." Most tools on this list stop at the score. GeoIQ goes further with a prioritized fix roadmap.</p>

    <p><strong>5. India-friendly pricing.</strong> Most GEO tools price in USD, with no INR billing option and no acknowledgment that $499/month means something very different to a Bangalore startup than to a San Francisco enterprise team. This matters practically - if your team's budget is in INR and the tool charges USD, you're dealing with forex conversion, international transaction fees, and often a pricing tier that simply doesn't fit your stage.</p>

    <h2>GEO Tools Compared for Indian B2B SaaS</h2>

    <p>The table below covers the 8 major platforms in the GEO tools market as of June 2026.</p>

    ${comparisonTableHtml}

    <h2>GeoIQ vs Profound for Indian Startups</h2>

    <p>Profound is a $1 billion-valued enterprise platform that raised $58.5M in Series B funding. It tracks 10+ AI systems, has sophisticated analytics, and targets PR and brand teams at large companies. The entry price is $499/month, with enterprise tiers going significantly higher.</p>

    <p>If you are a VP of Brand at a Fortune 500 company with a dedicated analytics team and a brand monitoring budget of $5,000+ per month, Profound is probably the right tool. The data depth, breadth of AI systems covered, and enterprise integrations justify the investment if you have the capacity to act on the data.</p>

    <p>For Indian startups, the calculus is different. $499/month is Rs 41,000+/month at current exchange rates. That's a significant portion of many Indian startup's entire marketing budget. And Profound doesn't offer a free audit - you need to go through a sales process before seeing any results.</p>

    <p>GeoIQ is built for the other end of the spectrum. It starts at $69/month (Rs 5,799/month billed in INR via Razorpay), includes a completely free audit with no signup, and covers the 6 AI systems that account for the vast majority of B2B AI search traffic. The key difference is the fix layer: GeoIQ doesn't just tell you your score is 28/100, it tells you the specific 3 actions that would move it to 55/100, ranked by impact, with step-by-step instructions for each. Profound does not do this.</p>

    <p>If you need enterprise-grade analytics across 10+ AI engines and have the budget and team to match, Profound is the better tool. For every other Indian startup founder or marketing team, GeoIQ is the practical choice.</p>

    <h2>GeoIQ vs Semrush AI Visibility</h2>

    <p>Semrush added AI visibility tracking as a module inside its existing SEO platform. For agencies and teams already paying $139+/month for Semrush, it's a natural extension. But it is SEO software with AI monitoring added on - not a purpose-built GEO platform.</p>

    <p>Coverage is limited. Semrush's AI tracking covers ChatGPT and Gemini but not Perplexity, Claude, or Grok as of June 2026. Fix recommendations do not exist in the AI visibility module - Semrush tells you what your score is but does not tell you what to do about it. And pricing is in USD with no INR billing option.</p>

    <p>GeoIQ tracks 6 AI systems versus Semrush's 2, includes the fix roadmap that Semrush lacks, and is available in INR. If you use Semrush for traditional SEO and need to add AI visibility, GeoIQ is a better dedicated tool rather than relying on Semrush's module. The two tools serve different purposes and work well alongside each other.</p>

    <h2>Check Your AI Visibility Free</h2>

    <div class="cta-box">
      <h3>Free AI visibility audit - no signup needed</h3>
      <p>See how your brand appears across ChatGPT, Gemini, Perplexity, Claude, Grok, and Google AI Overview. Results in under 60 seconds.</p>
      <a href="/" class="cta-btn">Check my brand free</a>
    </div>

    <h2>FAQ: GEO Tools for Indian Startups</h2>

    <div class="faq-accordion-wrap">
      ${faqAccordion}
    </div>

    <div class="related-links">
      <div class="rel-heading">Related guides</div>
      <a href="/geoiq-vs-profound">GeoIQ vs Profound: full comparison</a>
      <a href="/geoiq-vs-semrush">GeoIQ vs Semrush: full comparison</a>
      <a href="/best-ai-visibility-tools">Best AI visibility tools 2026</a>
      <a href="/pricing">GeoIQ pricing plans</a>
      <a href="/generative-engine-optimization">What is GEO?</a>
    </div>

    <style>
      .yes-cell{color:#059669;font-weight:600}
      .no-cell{color:#DC2626;font-weight:600}
      .partial-cell{color:#D97706;font-weight:600}
      .faq-accordion-wrap{border-top:1px solid #E5E7EB}
      .faq-accordion-item{border-bottom:1px solid #E5E7EB}
      .faq-acc-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px;background:none;border:none;cursor:pointer;padding:20px 0;text-align:left}
      .faq-acc-q{margin:0;font-size:17px;font-weight:700;color:#111827;font-family:'Syne',sans-serif;line-height:1.4;flex:1}
      .faq-acc-icon{font-size:22px;font-weight:300;color:#6B7280;flex-shrink:0;transition:transform 0.18s ease;line-height:1}
      .faq-acc-body{padding-bottom:20px}
      .faq-acc-body p{margin:0;font-size:15px;color:#374151;line-height:1.85}
      .faq-acc-btn:hover .faq-acc-q{color:#4F46E5}
    </style>
    <script>
      function toggleAcc(id){
        var item=document.getElementById(id);
        var body=item.querySelector('.faq-acc-body');
        var icon=item.querySelector('.faq-acc-icon');
        var btn=item.querySelector('.faq-acc-btn');
        var isOpen=body.style.display==='block';
        body.style.display=isOpen?'none':'block';
        icon.style.transform=isOpen?'rotate(0deg)':'rotate(45deg)';
        btn.setAttribute('aria-expanded',isOpen?'false':'true');
      }
    </script>
  `;

  return ssrHtmlShell({
    title: "GEO Tools Comparison 2026: Best Platforms for Indian B2B SaaS Brands | GeoIQ",
    description:
      "Compare GEO tools for tracking brand mentions across ChatGPT, Perplexity and Gemini. Find the best option for Indian startups.",
    canonical: "https://geoiqai.com/geo-tools-comparison",
    ogTitle: "GEO Tools Comparison 2026: Best Platforms for Indian B2B SaaS Brands | GeoIQ",
    ogDescription:
      "Compare GEO tools for tracking brand mentions across ChatGPT, Perplexity and Gemini. Find the best option for Indian startups.",
    schemaJson: [articleSchema, faqSchema, breadcrumbSchema],
    body,
  });
}

router.get("/geo-tools-comparison", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(geoToolsComparisonHtml());
});

// ============================================================
// PAGE 2: /chatgpt-visibility
// ============================================================

function chatgptVisibilityHtml(): string {
  const faqPairs = [
    {
      q: "How do I check if ChatGPT knows my brand?",
      a: "Use GeoIQ's free AI visibility audit at geoiqai.com. It runs standardized prompts across ChatGPT and 5 other AI systems and shows you exactly how your brand appears - or doesn't appear - in AI-generated answers. No signup or credit card required. Results in under 60 seconds.",
    },
    {
      q: "How long does it take to improve ChatGPT visibility?",
      a: "Technical fixes (robots.txt, llms.txt, schema markup) take effect within weeks as crawlers re-index your site. Citation building (Crunchbase listings, G2 reviews, press coverage) takes 1-3 months to accumulate. ChatGPT's training data updates periodically, so the full impact may take 3-6 months to appear in ChatGPT specifically. Perplexity updates much faster - days to weeks - because it uses live web retrieval rather than training data.",
    },
    {
      q: "What is a good ChatGPT visibility score?",
      a: "On GeoIQ's 0-100 scale, scores above 60 are strong for an established brand. Most Indian startups score under 30 on their first audit. Category leaders typically score 65-80. A score of 40+ after 3-6 months of focused optimization is realistic for most brands. The absolute number matters less than the direction - consistent month-over-month improvement means your efforts are working.",
    },
    {
      q: "Does ChatGPT visibility affect sales?",
      a: "Yes, increasingly. AI-referred traffic from ChatGPT browsing mode and from Perplexity is growing as a share of B2B discovery traffic. More importantly, ChatGPT influences the consideration stage: a buyer who asks ChatGPT for recommendations and doesn't see your brand there may never visit your site at all. There's no industry-wide 'ChatGPT visibility to revenue' metric yet, but brands tracking AI referral traffic consistently report that AI-sourced leads have higher intent and shorter sales cycles.",
    },
  ];

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "ChatGPT Visibility: How to Get Your Brand Cited in ChatGPT Answers (2026)",
    author: { "@type": "Person", name: "Tauheed" },
    publisher: { "@type": "Organization", name: "GeoIQ", url: "https://geoiqai.com" },
    datePublished: "2026-06-03",
    dateModified: "2026-06-03",
    url: "https://geoiqai.com/chatgpt-visibility",
    description:
      "Learn why your brand isn't showing in ChatGPT and how to fix it. Free ChatGPT visibility checker - see your score in 60 seconds.",
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqPairs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://geoiqai.com" },
      {
        "@type": "ListItem",
        position: 2,
        name: "ChatGPT Visibility Guide",
        item: "https://geoiqai.com/chatgpt-visibility",
      },
    ],
  };

  const faqAccordion = faqPairs
    .map((f, i) => {
      const id = `cv-${i + 1}`;
      return `
    <div class="faq-accordion-item" id="${id}">
      <button class="faq-acc-btn" onclick="toggleAcc('${id}')" aria-expanded="${i === 0 ? "true" : "false"}">
        <h3 class="faq-acc-q">${escHtml(f.q)}</h3>
        <span class="faq-acc-icon" style="transform:${i === 0 ? "rotate(45deg)" : "rotate(0deg)"}">+</span>
      </button>
      <div class="faq-acc-body" style="display:${i === 0 ? "block" : "none"}"><p>${escHtml(f.a)}</p></div>
    </div>`;
    })
    .join("");

  const body = `
    <div class="breadcrumb">
      <a href="/">Home</a>
      <span>/</span>
      <span>ChatGPT Visibility Guide</span>
    </div>

    <div class="tag-pill">CHATGPT VISIBILITY 2026</div>

    <h1>ChatGPT Visibility: The Complete Guide for Brands (2026)</h1>

    <div class="reading-meta">
      <span>By Tauheed</span>
      <span>Last updated: June 2026</span>
      <span>11 min read</span>
    </div>

    <div class="summary-box">
      <div class="summary-box-label">Quick Answer</div>
      <p>To improve your ChatGPT visibility: check your current score free at GeoIQ, fix your llms.txt, add structured schema markup, get listed on Crunchbase and G2, build citations in publications ChatGPT trains on, and create original citable content. Full guide below.</p>
    </div>

    <p>ChatGPT has more than 800 million weekly users as of 2026. When someone in your target market asks "what's the best tool for [your category]" - they're increasingly asking ChatGPT first, not Google. If your brand isn't in that answer, you don't exist to that person.</p>

    <p>There's no "page 2" in a ChatGPT response. There's no "also consider." There's the answer, and then there's nothing. A competitor who gets cited becomes the default recommendation for everyone who asks that query. You don't even know it's happening unless you're actively checking.</p>

    <p>The uncomfortable reality for most founders is that ChatGPT has never heard of their brand. Not because the product isn't good, but because ChatGPT is trained on data that skews heavily toward well-documented, frequently cited sources. Most startups - especially younger ones and those from markets outside the US - simply aren't in the training data at the scale needed to appear in competitive queries.</p>

    <p>This guide explains exactly why that happens and what you can do about it. The steps below are ranked by impact.</p>

    <h2>Why Your Brand Isn't Appearing in ChatGPT</h2>

    <p>Before you can fix the problem, you need to understand which version of it you have. These are the five most common reasons brands are invisible in ChatGPT:</p>

    <h3>1. Weak entity signals - ChatGPT doesn't know you exist</h3>

    <p>ChatGPT builds its knowledge of brands from training data: Wikipedia, Crunchbase, news coverage, LinkedIn, G2, Product Hunt, and thousands of other sources. If your brand appears on very few of these, ChatGPT has low "entity salience" for your brand - meaning low confidence that you're a real, established company worth recommending. ChatGPT doesn't recommend things it's not confident about.</p>

    <p>This is the most common problem for Indian startups. Many strong products simply don't have the web footprint that ChatGPT's training data captures. A $10M ARR company with a great product but minimal English-language web presence looks invisible to ChatGPT.</p>

    <h3>2. No structured data - ChatGPT can't extract facts about you</h3>

    <p>Schema markup (JSON-LD) tells crawlers exactly what your brand does, who it serves, what category it belongs to, and what your key products are. Without it, AI systems have to infer your brand's purpose from unstructured text - and guessing introduces errors and reduces confidence. A site with proper Organization and Product schema is dramatically easier for AI systems to understand and categorize correctly.</p>

    <h3>3. Missing from authoritative sources AI trains on</h3>

    <p>ChatGPT's training data weights authoritative, frequently cited sources higher than low-authority pages. Being listed on Crunchbase, Product Hunt, G2, Capterra, and referenced in legitimate news outlets (TechCrunch, YourStory, Inc42 for Indian brands) is what builds the citation authority that drives AI mentions. A brand mentioned 200 times across high-authority sources will outrank one mentioned 2,000 times across low-authority forums.</p>

    <h3>4. Competitor content is more citable</h3>

    <p>If a competitor has written detailed, well-structured content that directly answers common category questions - and that content has been indexed, linked to, and referenced by other sources - ChatGPT will cite them instead of you. Content that gets cited by other sites becomes part of the citation network AI systems draw from. Better content, cited by better sources, wins.</p>

    <h3>5. No llms.txt file</h3>

    <p>llms.txt is a standard (similar to robots.txt but for AI systems) that tells AI crawlers exactly what your company does, what your key pages are, and how to understand your brand structure. Without it, AI systems have to infer your brand's purpose from scattered content across multiple pages. Adding llms.txt takes under an hour and is one of the fastest improvements you can make.</p>

    <h2>How ChatGPT Decides Which Brands to Mention</h2>

    <p>ChatGPT is a large language model trained on a massive snapshot of the internet, updated periodically. When a user asks about a category or product, ChatGPT generates a response based on patterns in its training data - it doesn't search the web in real time unless the user specifically enables the browsing feature.</p>

    <p>This means brand mentions in ChatGPT are a function of how present and how credible your brand was in the training data at the time of the last training cutoff. A brand that appears frequently across diverse, authoritative sources gets higher entity salience in the model - meaning it's more likely to come up unprompted when relevant queries are asked.</p>

    <p>Three signals matter most for ChatGPT visibility:</p>

    <p><strong>Citation frequency:</strong> How many times your brand is mentioned across the web, particularly in sources that appear in OpenAI's training data. Raw mention count matters, but quality outweighs volume.</p>

    <p><strong>Citation authority:</strong> Whether those mentions come from sources ChatGPT was trained on heavily - Wikipedia, major publications, established review sites, Crunchbase, LinkedIn. A single mention in TechCrunch carries more weight than 100 mentions in low-authority blogs.</p>

    <p><strong>Content relevance:</strong> Whether your content directly and clearly addresses the queries buyers are actually asking. Content that precisely answers "what is the best [category] tool for [use case]" in the first 150 words is more likely to be learned from during training and cited in responses.</p>

    <h2>How to Improve Your ChatGPT Visibility (Step by Step)</h2>

    <h3>Step 1: Check your current score (free at GeoIQ)</h3>

    <p>Before changing anything, get a baseline. GeoIQ's free audit checks your brand across 6 AI systems including ChatGPT in under 60 seconds. No signup required. You'll get a 0-100 score, a breakdown by AI system, and a list of the specific technical issues affecting your visibility. This tells you where to focus first.</p>

    <h3>Step 2: Fix your llms.txt</h3>

    <p>Create a /llms.txt file at your domain root. The format is simple: your company name, a description of what you do, who your customers are, your key products, and links to your most important pages. You can see an example at geoiqai.com/llms.txt. This is the fastest improvement you can make - it takes under an hour and immediately gives AI crawlers a clear, structured picture of your brand.</p>

    <h3>Step 3: Add structured data and schema markup</h3>

    <p>Add JSON-LD Organization schema to your homepage and key product pages. At minimum include: company name, description, URL, logo, founding date, and social profile links. Also add Product or SoftwareApplication schema to your product pages if applicable. This data feeds directly into search engine indexes and, by extension, into AI training pipelines that use those indexes as inputs.</p>

    <h3>Step 4: Get mentioned on sites ChatGPT cites</h3>

    <p>Create or claim profiles on Crunchbase, Product Hunt, G2, Capterra, and LinkedIn Company pages. Fill them out completely with accurate, consistent information. Get listed in relevant category directories. Pitch Indian tech media (Inc42, YourStory, FactorDaily) for coverage. Each legitimate mention from an authoritative source builds the entity recognition that drives ChatGPT mentions. This takes time - start now and let it compound.</p>

    <h3>Step 5: Create citable content</h3>

    <p>Content that gets cited by other sites becomes part of the citation network AI systems draw from. Original data, surveys, research, and case studies are the highest-value content types because other sites link to them. If you publish original research (for example, "AI visibility data from 500 Indian startup audits"), other sites and publications will reference it, and those references build your citation authority over time.</p>

    <h3>Step 6: Monitor and rescan monthly</h3>

    <p>ChatGPT's training data updates periodically and your citation footprint grows over time. Run a monthly GeoIQ audit to track progress. After a significant content push or PR campaign, rescan in 2-3 weeks to measure the impact. GeoIQ paid plans run daily monitoring automatically so you don't have to check manually.</p>

    <h2>Check Your ChatGPT Visibility Free</h2>

    <div class="cta-box">
      <h3>See how ChatGPT sees your brand right now</h3>
      <p>Free audit across 6 AI systems. No signup, no credit card. Results in 60 seconds.</p>
      <a href="/" class="cta-btn">Check my brand free</a>
    </div>

    <h2>FAQ: ChatGPT Visibility</h2>

    <div class="faq-accordion-wrap">
      ${faqAccordion}
    </div>

    <div class="related-links">
      <div class="rel-heading">Related guides</div>
      <a href="/how-to-rank-in-chatgpt">How to rank in ChatGPT: complete guide</a>
      <a href="/chatgpt-brand-visibility">ChatGPT brand visibility: optimization guide</a>
      <a href="/ai-visibility-score">What is an AI visibility score?</a>
      <a href="/llms-txt-guide">How to create an llms.txt file</a>
      <a href="/generative-engine-optimization">What is GEO?</a>
    </div>

    <style>
      .faq-accordion-wrap{border-top:1px solid #E5E7EB}
      .faq-accordion-item{border-bottom:1px solid #E5E7EB}
      .faq-acc-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px;background:none;border:none;cursor:pointer;padding:20px 0;text-align:left}
      .faq-acc-q{margin:0;font-size:17px;font-weight:700;color:#111827;font-family:'Syne',sans-serif;line-height:1.4;flex:1}
      .faq-acc-icon{font-size:22px;font-weight:300;color:#6B7280;flex-shrink:0;transition:transform 0.18s ease;line-height:1}
      .faq-acc-body{padding-bottom:20px}
      .faq-acc-body p{margin:0;font-size:15px;color:#374151;line-height:1.85}
      .faq-acc-btn:hover .faq-acc-q{color:#4F46E5}
    </style>
    <script>
      function toggleAcc(id){
        var item=document.getElementById(id);
        var body=item.querySelector('.faq-acc-body');
        var icon=item.querySelector('.faq-acc-icon');
        var btn=item.querySelector('.faq-acc-btn');
        var isOpen=body.style.display==='block';
        body.style.display=isOpen?'none':'block';
        icon.style.transform=isOpen?'rotate(0deg)':'rotate(45deg)';
        btn.setAttribute('aria-expanded',isOpen?'false':'true');
      }
    </script>
  `;

  return ssrHtmlShell({
    title: "ChatGPT Visibility: How to Get Your Brand Cited in ChatGPT Answers | GeoIQ",
    description:
      "Learn why your brand isn't showing in ChatGPT and how to fix it. Free ChatGPT visibility checker - see your score in 60 seconds.",
    canonical: "https://geoiqai.com/chatgpt-visibility",
    ogTitle: "ChatGPT Visibility: How to Get Your Brand Cited in ChatGPT Answers | GeoIQ",
    ogDescription:
      "Learn why your brand isn't showing in ChatGPT and how to fix it. Free ChatGPT visibility checker - see your score in 60 seconds.",
    schemaJson: [articleSchema, faqSchema, breadcrumbSchema],
    body,
  });
}

router.get("/chatgpt-visibility", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(chatgptVisibilityHtml());
});

export default router;
