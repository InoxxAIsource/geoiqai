// Types and utilities for AgentVisuals - kept in a separate file so AgentVisuals.tsx
// only exports React components (required for Vite Fast Refresh compatibility).

export interface Brand {
  domain: string;
  brandName: string | null;
  category: string | null;
  latestScore: number | null;
  latestScoreChatgpt: number | null;
  latestScoreGemini: number | null;
  latestScorePerplexity: number | null;
}

export interface TrendPoint {
  date: string;
  yours: number;
  competitor: number;
}

export interface KeywordEntry {
  keyword: string;
  volume: number;
}

export interface FixAction {
  id: number;
  priority: string;
  action: string;
  effortHours: number;
  impactScore: number;
  done: boolean;
}

export interface CitationEntry {
  domain: string;
  times: number;
  type: "yours" | "competitor" | "authority" | "social";
}

export interface CitationData {
  donut: { name: string; value: number; color: string }[];
  topDomains: CitationEntry[];
}

export interface TechnicalCheck {
  name: string;
  score: number;
  status: string;
  detail: string;
}

export interface AuditToolResult {
  domain: string;
  brandName: string;
  scoreTotal: number;
  scoreChatgpt: number;
  scoreGemini: number;
  scorePerplexity: number;
  scoreTechnical: number;
  chatgptStatus: string;
  geminiStatus: string;
  perplexityStatus: string;
  topKeywords: string[];
  competitors: string[];
  recommendations: { action: string; priority: string }[];
  technicalHighlights: { name: string; score: number; status: string }[];
}

export interface VisualData {
  brand: Brand;
  lineChartData: TrendPoint[];
  keywords: KeywordEntry[];
  fixActions: FixAction[];
  citationData: CitationData;
  competitorDisplayName: string;
  weekChange: number | null;
  agentResponse: string;
  technicalChecks?: TechnicalCheck[];
  technicalOverallScore?: number;
  auditCheckedAt?: string | null;
  auditToolResult?: AuditToolResult;
}

export type VisualType =
  | "score_breakdown"
  | "competitor_chart"
  | "citation_gap"
  | "action_cards"
  | "trend_chart"
  | "blog_card"
  | "tweet_cards"
  | "content_calendar"
  | "keyword_table"
  | "technical_scorecard"
  | "audit_result";

export function detectVisualType(userMsg: string, agentResponse: string): VisualType | null {
  const msg = userMsg.toLowerCase();
  const resp = agentResponse.toLowerCase();

  if (resp.includes("tweet 1") || resp.includes("tweet 2") || msg.includes("tweet") || msg.includes("twitter") || (msg.includes("social") && !msg.includes("social media strategy"))) return "tweet_cards";
  if (resp.includes("# ") || resp.includes("## ") || msg.includes("blog") || msg.includes("article") || msg.includes("write post") || msg.includes("blog post")) return "blog_card";
  if (msg.includes("score") || msg.includes("low") || msg.includes("why") || msg.includes("visibility") || msg.includes("performance") || msg.includes("how am i doing")) return "score_breakdown";
  if (msg.includes("competitor") || msg.includes("compare") || msg.includes(" vs ") || msg.includes("beating") || msg.includes("who is winning") || msg.includes("competition")) return "competitor_chart";
  if (msg.includes("citation") || msg.includes("listed") || msg.includes("sources") || msg.includes("cited") || msg.includes("get mentioned")) return "citation_gap";
  if (msg.includes("do first") || msg.includes("priority") || msg.includes("fix") || msg.includes("next step") || msg.includes("what should") || msg.includes("action") || msg.includes("todo") || msg.includes("improve")) return "action_cards";
  if (msg.includes("progress") || msg.includes("trend") || msg.includes("history") || msg.includes("over time") || msg.includes("last month") || msg.includes("getting better") || msg.includes("changed")) return "trend_chart";
  if (msg.includes("calendar") || msg.includes("content plan") || msg.includes("schedule") || msg.includes("what to post") || msg.includes("this week") || msg.includes("content this")) return "content_calendar";
  if (msg.includes("keyword") || msg.includes("rank for") || msg.includes("search") || msg.includes("what to target")) return "keyword_table";
  if (msg.includes("technical") || msg.includes("robots") || msg.includes("schema") || msg.includes("crawler") || msg.includes("llms.txt") || msg.includes("structured data")) return "technical_scorecard";
  return null;
}
