import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, auditsTable, sprintSessionsTable, sprintProgressTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Sprint steps data ─────────────────────────────────────────────────────────

export const SPRINT_STEPS = [
  // PHASE 1: TECHNICAL FOUNDATION
  {
    id: "llmstxt",
    phase: 1,
    phase_name: "Technical foundation",
    title: "Add llms.txt to domain root",
    why: "Helps ChatGPT, Claude and Grok understand your brand without crawling",
    affects: ["ChatGPT", "Claude", "Grok"],
    score_impact: 8,
    time: "5 minutes",
    action_label: "Generate file",
    action_type: "generate" as const,
    action_endpoint: "/api/generate/llmstxt",
    verify_url: "https://{domain}/llms.txt",
    research: "Direct signal to LLM crawlers",
  },
  {
    id: "org_schema",
    phase: 1,
    phase_name: "Technical foundation",
    title: "Add Organization schema",
    why: "All 6 AI systems use this to identify your brand entity",
    affects: ["ChatGPT", "Gemini", "Perplexity", "Claude", "Grok", "Google AI"],
    score_impact: 10,
    time: "10 minutes",
    action_label: "Generate schema",
    action_type: "generate" as const,
    action_endpoint: "/api/generate/org-schema",
    verify_url: "https://search.google.com/test/rich-results",
    research: "Entity recognition across all platforms",
  },
  {
    id: "faq_schema",
    phase: 1,
    phase_name: "Technical foundation",
    title: "Add FAQPage schema",
    why: "Perplexity and Google AI Overview heavily cite FAQ structured content",
    affects: ["Perplexity", "Google AI Overview"],
    score_impact: 12,
    time: "15 minutes",
    action_label: "Generate FAQ",
    action_type: "generate" as const,
    action_endpoint: "/api/generate/faq-schema",
    verify_url: "https://search.google.com/test/rich-results",
    research: "Princeton GEO: structured content +30% citation",
  },
  {
    id: "robots_txt",
    phase: 1,
    phase_name: "Technical foundation",
    title: "Allow AI bots in robots.txt",
    why: "GPTBot, ClaudeBot, PerplexityBot must be explicitly allowed",
    affects: ["ChatGPT", "Claude", "Perplexity", "Grok", "Google AI"],
    score_impact: 5,
    time: "5 minutes",
    action_label: "Generate robots.txt",
    action_type: "generate" as const,
    action_endpoint: "/api/generate/robots",
    verify_url: "https://{domain}/robots.txt",
    research: "Required for AI crawler access",
  },
  {
    id: "google_biz",
    phase: 1,
    phase_name: "Technical foundation",
    title: "Set up Google Business Profile",
    why: "Gemini relies on Google Knowledge Graph. GBP is the fastest path into it.",
    affects: ["Gemini", "Google AI Overview"],
    score_impact: 8,
    time: "20 minutes",
    action_label: "Open Google Business",
    action_type: "link" as const,
    action_url: "https://business.google.com",
    research: "Gemini draws from Google ecosystem directly",
  },
  // PHASE 2: CONTENT THAT AI CITES
  {
    id: "definition_page",
    phase: 2,
    phase_name: "Content AI systems cite",
    title: "Write a brand definition page",
    why: '"What is [brand]" is the most cited page format by AI systems',
    affects: ["ChatGPT", "Claude", "Perplexity"],
    score_impact: 10,
    time: "20 minutes",
    action_label: "Write with GEO Writer",
    action_type: "internal" as const,
    action_route: "/dashboard/content-creation",
    research: "Authoritative voice +40% citation rate (Princeton)",
  },
  {
    id: "statistics_page",
    phase: 2,
    phase_name: "Content AI systems cite",
    title: "Add statistics with cited sources",
    why: "Adding verifiable stats is the single highest-impact content tactic",
    affects: ["ChatGPT", "Perplexity", "Claude"],
    score_impact: 12,
    time: "30 minutes",
    action_label: "Open Citation Optimizer",
    action_type: "internal" as const,
    action_route: "/dashboard/content-creation",
    research: "Princeton GEO: statistics addition +41% visibility",
  },
  {
    id: "faq_content",
    phase: 2,
    phase_name: "Content AI systems cite",
    title: "Create a 10-question FAQ page",
    why: "Claude is 30% more likely to cite structured, bullet-pointed content",
    affects: ["Claude", "Perplexity", "Google AI Overview"],
    score_impact: 8,
    time: "25 minutes",
    action_label: "Write with GEO Writer",
    action_type: "internal" as const,
    action_route: "/dashboard/content-creation",
    research: "Claude prefers structured content +30%",
  },
  {
    id: "comparison_content",
    phase: 2,
    phase_name: "Content AI systems cite",
    title: "Write a comparison article",
    why: "[Brand] vs [Competitor] pages rank in AI recommendation queries",
    affects: ["ChatGPT", "Perplexity"],
    score_impact: 6,
    time: "30 minutes",
    action_label: "Write with GEO Writer",
    action_type: "internal" as const,
    action_route: "/dashboard/content-creation",
    research: "Competitor comparison cited in recommendation queries",
  },
  // PHASE 3: DISTRIBUTION ON AI-CITED PLATFORMS
  {
    id: "reddit",
    phase: 3,
    phase_name: "Distribute on AI-cited platforms",
    title: "Build Reddit presence in your niche",
    why: "Reddit is #1 cited source across ALL AI platforms. Perplexity gets 46.7% citations from Reddit.",
    affects: ["Perplexity", "ChatGPT", "Google AI"],
    score_impact: 15,
    time: "30 minutes",
    action_label: "Create Reddit post",
    action_type: "internal" as const,
    action_route: "/dashboard/content-creation",
    research: "23.6M Reddit pages cited in AI. 46.7% of Perplexity citations. (Peec AI, 30M sources)",
  },
  {
    id: "g2_listing",
    phase: 3,
    phase_name: "Distribute on AI-cited platforms",
    title: "Create G2 and Capterra profile",
    why: "G2 and Capterra are top Perplexity citation sources for B2B SaaS",
    affects: ["Perplexity", "ChatGPT"],
    score_impact: 10,
    time: "30 minutes",
    action_label: "Open G2",
    action_type: "link" as const,
    action_url: "https://sell.g2.com/get-listed",
    research: "G2 appears in top Perplexity B2B citations (Peec AI)",
  },
  {
    id: "linkedin_content",
    phase: 3,
    phase_name: "Distribute on AI-cited platforms",
    title: "Publish LinkedIn article or post",
    why: "LinkedIn cited across ChatGPT, Perplexity and Google AI Overview",
    affects: ["ChatGPT", "Perplexity", "Google AI Overview"],
    score_impact: 7,
    time: "20 minutes",
    action_label: "Create LinkedIn post",
    action_type: "internal" as const,
    action_route: "/dashboard/content-creation",
    research: "LinkedIn top 5 most cited across all LLMs (SearchEngineLand)",
  },
  {
    id: "product_hunt",
    phase: 3,
    phase_name: "Distribute on AI-cited platforms",
    title: "Launch on Product Hunt",
    why: "PH pages indexed quickly and cited by ChatGPT for product recommendations",
    affects: ["ChatGPT", "Claude"],
    score_impact: 8,
    time: "45 minutes",
    action_label: "Create PH post",
    action_type: "internal" as const,
    action_route: "/dashboard/content-creation",
    research: "PH cited in product recommendation queries",
  },
  {
    id: "hacker_news",
    phase: 3,
    phase_name: "Distribute on AI-cited platforms",
    title: "Post Show HN on Hacker News",
    why: "HN indexed by all AI systems. Technical audience = high authority signal",
    affects: ["ChatGPT", "Claude", "Perplexity"],
    score_impact: 6,
    time: "20 minutes",
    action_label: "Create HN post",
    action_type: "internal" as const,
    action_route: "/dashboard/content-creation",
    research: "HN cited in technical and developer queries",
  },
  {
    id: "x_thread",
    phase: 3,
    phase_name: "Distribute on AI-cited platforms",
    title: "Post X thread about your product",
    why: "X/Twitter content indexed by Grok. Long threads cited by multiple AI systems",
    affects: ["Grok", "ChatGPT"],
    score_impact: 5,
    time: "15 minutes",
    action_label: "Create X thread",
    action_type: "internal" as const,
    action_route: "/dashboard/content-creation",
    research: "X indexed by Grok natively. ChatGPT cites X for brand info",
  },
  // PHASE 4: PR + JOURNALIST OUTREACH
  {
    id: "journalist_find",
    phase: 4,
    phase_name: "PR and media coverage",
    title: "Find 5 journalists covering your space",
    why: "One article in TechCrunch, SEL or Wired = immediate AI visibility across all platforms",
    affects: ["ChatGPT", "Perplexity", "Google AI"],
    score_impact: 5,
    time: "15 minutes",
    action_label: "Open Media Scout",
    action_type: "internal" as const,
    action_route: "/dashboard/ai-pr",
    research: "Editorial sources cited heavily by ChatGPT (Forbes, TechCrunch)",
  },
  {
    id: "journalist_pitch",
    phase: 4,
    phase_name: "PR and media coverage",
    title: "Send pitches to 3 journalists",
    why: "Perplexity indexes new articles within hours. One coverage hit = 15+ point score jump",
    affects: ["Perplexity", "ChatGPT", "Google AI Overview"],
    score_impact: 15,
    time: "30 minutes",
    action_label: "Open Pitch Studio",
    action_type: "internal" as const,
    action_route: "/dashboard/ai-pr",
    research: "Perplexity results in 2-4 weeks from new coverage (Effinity, May 2026)",
  },
  {
    id: "monitor_mentions",
    phase: 4,
    phase_name: "PR and media coverage",
    title: "Set up brand mention monitoring",
    why: "Track when AI starts citing your brand and respond to coverage opportunities",
    affects: ["All platforms"],
    score_impact: 3,
    time: "5 minutes",
    action_label: "Open Mention Radar",
    action_type: "internal" as const,
    action_route: "/dashboard/ai-pr",
    research: "Active monitoring enables faster response to citation opportunities",
  },
];

// ─── GET /api/sprint/:domain ───────────────────────────────────────────────────

router.get("/sprint/:domain", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const userId = authReq.user.id;
  const domain = String(req.params.domain);

  try {
    // Get or create sprint session
    let [session] = await db
      .select()
      .from(sprintSessionsTable)
      .where(and(eq(sprintSessionsTable.userId, userId), eq(sprintSessionsTable.domain, domain)))
      .limit(1);

    if (!session) {
      // Try to get current AI presence score from latest audit
      const [latestAudit] = await db
        .select({ scoreTotal: auditsTable.scoreTotal })
        .from(auditsTable)
        .where(eq(auditsTable.domain, domain))
        .orderBy(desc(auditsTable.createdAt))
        .limit(1);

      const currentScore = latestAudit?.scoreTotal ?? 0;

      const [newSession] = await db
        .insert(sprintSessionsTable)
        .values({
          userId,
          domain,
          targetScore: 30,
          currentScore,
          startedAt: new Date(),
          lastUpdated: new Date(),
        })
        .returning();

      session = newSession!;
    }

    // Get completed steps
    const completedRows = await db
      .select({
        stepId: sprintProgressTable.stepId,
        completedAt: sprintProgressTable.completedAt,
        scoreAfter: sprintProgressTable.scoreAfter,
      })
      .from(sprintProgressTable)
      .where(
        and(
          eq(sprintProgressTable.userId, userId),
          eq(sprintProgressTable.domain, domain),
          eq(sprintProgressTable.completed, true)
        )
      );

    const completedMap = new Map(completedRows.map((r) => [r.stepId, r]));

    // Calculate projected score
    const completedPts = SPRINT_STEPS.filter((s) => completedMap.has(s.id)).reduce(
      (sum, s) => sum + s.score_impact,
      0
    );
    const projectedScore = Math.min((session.currentScore ?? 0) + completedPts, 99);

    res.json({
      session,
      steps: SPRINT_STEPS.map((s) => ({
        ...s,
        completed: completedMap.has(s.id),
        completed_at: completedMap.get(s.id)?.completedAt ?? null,
      })),
      stats: {
        total_steps: SPRINT_STEPS.length,
        completed_count: completedMap.size,
        current_score: session.currentScore ?? 0,
        projected_score: projectedScore,
        target_score: 30,
        pts_remaining: Math.max(30 - projectedScore, 0),
      },
    });
  } catch (err) {
    logger.error({ err, domain, userId }, "sprint GET error");
    res.status(500).json({ error: "Failed to load sprint data" });
  }
});

// ─── POST /api/sprint/complete-step ───────────────────────────────────────────

router.post("/sprint/complete-step", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const userId = authReq.user.id;
  const { domain, step_id } = req.body as { domain: string; step_id: string };

  if (!domain || !step_id) {
    res.status(400).json({ error: "domain and step_id are required" });
    return;
  }

  const step = SPRINT_STEPS.find((s) => s.id === step_id);
  if (!step) {
    res.status(404).json({ error: "Step not found" });
    return;
  }

  try {
    const [session] = await db
      .select({ currentScore: sprintSessionsTable.currentScore })
      .from(sprintSessionsTable)
      .where(and(eq(sprintSessionsTable.userId, userId), eq(sprintSessionsTable.domain, domain)))
      .limit(1);

    const scoreBefore = session?.currentScore ?? 0;
    const scoreAfter = scoreBefore + step.score_impact;

    await db
      .insert(sprintProgressTable)
      .values({
        userId,
        domain,
        stepId: step_id,
        phase: step.phase,
        completed: true,
        completedAt: new Date(),
        scoreBefore,
        scoreAfter,
      })
      .onConflictDoUpdate({
        target: [sprintProgressTable.userId, sprintProgressTable.domain, sprintProgressTable.stepId],
        set: {
          completed: true,
          completedAt: new Date(),
          scoreBefore,
          scoreAfter,
        },
      });

    res.json({ success: true, score_impact: step.score_impact });
  } catch (err) {
    logger.error({ err, domain, step_id, userId }, "sprint complete-step error");
    res.status(500).json({ error: "Failed to mark step complete" });
  }
});

export default router;
