import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const PRIMARY = "#4F46E5";

interface FaqItem {
  q: string;
  a: string | React.ReactNode;
}

const FAQ_SECTIONS: { title: string; items: FaqItem[] }[] = [
  {
    title: "What GeoIQ does",
    items: [
      {
        q: "What is GeoIQ?",
        a: "GeoIQ is an AI visibility platform that shows you how your brand appears in ChatGPT, Gemini, Perplexity, Claude and Grok. Think of it like Google Search Console, but for AI search engines. You enter your domain, and within 60 seconds you get a score from 0-100, a breakdown by engine, and a list of fixes ranked by impact.",
      },
      {
        q: "What is an AI visibility score?",
        a: "Your AI visibility score (GEO IQ Score) is a number from 0 to 100 that measures how well AI systems know, understand, and recommend your brand. It combines two things: how often and accurately AI engines mention you (AI Memory, worth 50 points), and how well your site is technically set up for AI crawlers (Technical GEO, worth 50 points). A score above 70 is strong; below 40 means you have real gaps to fix.",
      },
      {
        q: "Which AI engines does GeoIQ check?",
        a: "GeoIQ checks five AI systems: ChatGPT (OpenAI), Gemini (Google), Perplexity, Claude (Anthropic), and Grok (xAI). Your overall GEO IQ Score is primarily based on the three main engines - ChatGPT, Gemini, and Perplexity - since those drive the most traffic and referrals today.",
      },
      {
        q: "What is GEO (Generative Engine Optimization)?",
        a: "GEO stands for Generative Engine Optimization. It is the practice of optimizing your brand, content, and website so that AI systems like ChatGPT and Gemini understand who you are, what you do, and when to recommend you. It is similar to SEO, but instead of optimizing for Google's ranking algorithm, you are optimizing for how large language models represent your brand in their responses.",
      },
    ],
  },
  {
    title: "Running an audit",
    items: [
      {
        q: "How do I run a free audit?",
        a: "Go to the home page, type your domain name (e.g. yourstartup.com) into the input box, and click Check my AI visibility. The audit runs in about 60 seconds and you get a full report - no signup required.",
      },
      {
        q: "What does the audit actually do?",
        a: "The audit sends real queries about your brand to multiple AI engines and checks the responses. It looks at whether each engine recognizes your brand, how accurately it describes you, whether it recommends you in relevant comparisons, and whether it knows your key products and use cases. It also crawls your website directly to check technical factors like structured data, llms.txt, robots.txt settings, HTTPS, page metadata, and more.",
      },
      {
        q: "How long does the audit take?",
        a: "Usually 30-60 seconds for the first audit. If your domain was audited recently by someone else, cached results may load instantly. Running a fresh scan from your dashboard takes about 30 seconds.",
      },
      {
        q: "Can I audit a competitor's domain?",
        a: "Yes. You can enter any publicly accessible domain into the free audit tool. This is useful for benchmarking - you can see your score vs a competitor's and identify where they have stronger AI visibility than you.",
      },
    ],
  },
  {
    title: "Scores and results",
    items: [
      {
        q: "My score seems low. Is that normal?",
        a: "Most brands score between 30 and 60 on their first audit. A score under 40 is common for early-stage startups because AI models primarily learn from large datasets of web content, and smaller brands have less representation in that training data. The good news is that technical fixes (llms.txt, structured data, schema markup) can improve your score fairly quickly.",
      },
      {
        q: "What is a good GEO IQ Score?",
        a: "As a rough guide: 70 and above is strong, 50-70 is moderate and improving, 30-50 is weak and needs work, and below 30 means AI engines barely know you exist. Top SaaS tools typically score 80+. If you are a well-funded startup with solid press coverage, aim for 60+ as a baseline.",
      },
      {
        q: "What is the difference between AI Memory and Live Web?",
        a: "AI Memory covers ChatGPT and Gemini - these models answer from their training data (what they learned during training). Live Web covers Perplexity, which searches the web in real time before answering. Strong AI Memory means models already know you from their training data. Strong Live Web means your content ranks and surfaces well when Perplexity searches for your category. You can have one without the other.",
      },
      {
        q: "What does 'blind spots found' mean?",
        a: "A blind spot means an AI engine completely failed to recognize or mention your brand when asked a direct question about it. This is the worst possible result - the engine either does not know you exist or actively confuses you with another brand. Eliminating blind spots is the highest priority fix.",
      },
    ],
  },
  {
    title: "Improving your score",
    items: [
      {
        q: "How do I improve my AI visibility score?",
        a: "The most impactful fixes are: (1) create an llms.txt file that describes your brand, products, use cases, and competitors clearly; (2) add structured data (JSON-LD schema) to your key pages; (3) get your brand mentioned on high-authority sites that AI models use as training sources; (4) make sure robots.txt is not blocking AI crawlers like GPTBot and ClaudeBot; (5) write clear, factual content about what your product does and who it is for. GeoIQ's dashboard gives you a ranked fix list specific to your domain.",
      },
      {
        q: "What is an llms.txt file and do I need one?",
        a: "llms.txt is a plain text file you place at yourdomain.com/llms.txt that tells AI crawlers exactly what your brand is, what it does, and how it should be described. Think of it as a README for AI systems. It is not an official standard yet, but major crawlers like GPTBot and ClaudeBot are starting to read it. It is one of the fastest things you can do to improve your AI visibility.",
      },
      {
        q: "How long does it take to see improvement?",
        a: "Technical fixes like adding llms.txt or structured data can show results in 2-4 weeks as AI crawlers re-index your site. Improvements based on content and backlinks take longer - typically 1-3 months - because AI model training data updates on a slower cycle. Perplexity (Live Web) tends to update fastest since it searches in real time.",
      },
      {
        q: "My robots.txt blocks GPTBot. Is that bad?",
        a: "For most businesses, yes. If you block GPTBot or ClaudeBot in robots.txt, those AI crawlers cannot read your site to include it in their training or responses. There are legitimate reasons to block AI crawlers (e.g. if you publish original research and do not want it scraped without credit). But for a startup that wants AI visibility, blocking AI bots hurts your score significantly.",
      },
    ],
  },
  {
    title: "Plans and pricing",
    items: [
      {
        q: "Is the audit really free?",
        a: "Yes. The public audit tool at geoiqai.com/audit is completely free, no signup required. You get a full score breakdown, per-engine results, technical audit, and top fix recommendations. The free audit does not require a credit card.",
      },
      {
        q: "What does the paid plan include?",
        a: "Paid plans (Starter and Agency) add: continuous monitoring of multiple brands with daily score tracking, score history charts, a full fix action list with step-by-step instructions, competitor comparison, keyword-level AI visibility, prompt templates, and access to the GEO Agent for automated analysis. See the pricing page for the full breakdown.",
      },
      {
        q: "Do you support INR pricing?",
        a: "Yes. All prices are in Indian Rupees (INR). Payments are processed securely through Razorpay. Starter plan is Rs 3,999/month and Agency plan is Rs 11,999/month.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. There are no contracts or lock-in periods. You can cancel your subscription from your dashboard at any time. You keep access until the end of your current billing period.",
      },
      {
        q: "Do you offer refunds?",
        a: "We offer refunds within 7 days of purchase if you are not satisfied. Reach out to hello@geoiqai.com with your registered email and we will process the refund.",
      },
    ],
  },
  {
    title: "Technical questions",
    items: [
      {
        q: "Does GeoIQ store my website data?",
        a: "GeoIQ stores the audit results (AI responses, scores, technical checks) for the domain you audit. We do not store full crawls of your website or any user data from your site. Audit results are cached for a short period to avoid redundant API calls. See our privacy policy for full details.",
      },
      {
        q: "How does GeoIQ check AI engines?",
        a: "For each audit, GeoIQ sends standardized queries about your brand to each AI engine and evaluates the responses. We check whether the engine recognizes your brand, how accurately it describes your product, whether it mentions you in category comparisons, and whether it recommends you when asked for tool suggestions.",
      },
      {
        q: "Is GeoIQ affiliated with OpenAI, Google or Anthropic?",
        a: "No. GeoIQ is an independent product. We are not affiliated with, endorsed by, or sponsored by OpenAI, Google, Anthropic, or any of the AI companies whose engines we track.",
      },
      {
        q: "I found a bug. How do I report it?",
        a: "Email us at hello@geoiqai.com or use the contact form at geoiqai.com/contact. Please include your domain name and a description of what you expected vs what you saw.",
      },
    ],
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  useEffect(() => {
    document.title = "FAQ - Frequently Asked Questions | GeoIQ";
    const cl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (cl) cl.href = "https://geoiqai.com/faq";
    const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (desc) desc.content = "Answers to common questions about GeoIQ - how AI visibility scores work, how to improve them, what the audit checks, and pricing details.";
  }, []);

  const toggle = (key: string) => setOpenIndex(prev => prev === key ? null : key);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQ_SECTIONS.flatMap(s =>
      s.items.map(item => ({
        "@type": "Question",
        "name": item.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": typeof item.a === "string" ? item.a : "",
        },
      }))
    ),
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F2F0EB", display: "flex", flexDirection: "column" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Navbar />

      {/* Hero */}
      <div style={{ padding: "64px 24px 48px", textAlign: "center", maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#e8e5ff", border: "0.5px solid #c4b9ff", borderRadius: 20, padding: "4px 14px", marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 600, letterSpacing: "0.04em" }}>FREQUENTLY ASKED QUESTIONS</span>
        </div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 5vw, 44px)", color: "#0A0A0A", marginBottom: 14, lineHeight: 1.15 }}>
          Questions about GeoIQ
        </h1>
        <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 0" }}>
          Everything you need to know about AI visibility, how the audit works, and what to do with your results.
        </p>
      </div>

      {/* FAQ sections */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 80px", width: "100%" }}>
        {FAQ_SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
              {section.title}
            </h2>
            <div style={{ borderRadius: 12, overflow: "hidden", border: "0.5px solid #D4D0C8" }}>
              {section.items.map((item, idx) => {
                const key = `${section.title}-${idx}`;
                const isOpen = openIndex === key;
                return (
                  <div key={key} style={{ background: "white", borderBottom: idx < section.items.length - 1 ? "0.5px solid #f3f4f6" : "none" }}>
                    <button
                      onClick={() => toggle(key)}
                      style={{ width: "100%", textAlign: "left", padding: "18px 20px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#0A0A0A", lineHeight: 1.4, flex: 1 }}>{item.q}</span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0, marginTop: 2, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div style={{ padding: "0 20px 18px", fontSize: 14, color: "#4b5563", lineHeight: 1.75 }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* CTA */}
        <div style={{ background: "#111827", borderRadius: 14, padding: "40px 32px", textAlign: "center", marginTop: 16 }}>
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "white", marginBottom: 10 }}>
            Still have questions?
          </h3>
          <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 24, lineHeight: 1.6 }}>
            Run a free audit and see exactly where your brand stands across ChatGPT, Gemini and Perplexity. No signup needed.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/audit" style={{ display: "inline-block", background: PRIMARY, color: "white", padding: "11px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              Run free audit
            </Link>
            <Link href="/contact" style={{ display: "inline-block", background: "rgba(255,255,255,0.08)", color: "white", padding: "11px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none", border: "0.5px solid rgba(255,255,255,0.15)" }}>
              Contact us
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
