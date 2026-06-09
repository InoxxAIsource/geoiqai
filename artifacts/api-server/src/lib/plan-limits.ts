export const PLAN_LIMITS = {
  free: {
    llm_mention_domains: 0,
    audit_domains: 1,
    brand_performance_domains: 0,
    geo_optimizer_domains: 1,
    competitor_slots: 0,
    rescan_hours: 999,
    content_studio: false,
    tracked_prompts: 5,
  },
  starter: {
    llm_mention_domains: 1,
    audit_domains: 2,
    brand_performance_domains: 1,
    geo_optimizer_domains: 1,
    competitor_slots: 3,
    rescan_hours: 48,
    content_studio: true,
    tracked_prompts: 50,
  },
  agency: {
    llm_mention_domains: 3,
    audit_domains: 5,
    brand_performance_domains: 3,
    geo_optimizer_domains: 3,
    competitor_slots: 10,
    rescan_hours: 24,
    content_studio: true,
    tracked_prompts: 150,
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;
export type PlanLimits = (typeof PLAN_LIMITS)[Plan];

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[(plan as Plan)] ?? PLAN_LIMITS.free;
}

export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  agency: "Agency",
};
