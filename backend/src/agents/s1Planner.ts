import { generateText } from "../lib/openai";

export type S1ToolName =
  | "keyword_total"
  | "top_slugs"
  | "keywords_for_slug"
  | "keyword_state_breakdown"
  | "qa_search";

export type S1Plan =
  | { tool: "keyword_total"; keyword: string }
  | { tool: "top_slugs"; limit: number }
  | { tool: "keywords_for_slug"; slug: string; limit?: number }
  | { tool: "qa_search"; query: string }
  | { tool: "keyword_state_breakdown"; keyword: string; states?: string[] };

/**
 * Cheap heuristic routing for the most common intents.
 * This gives us deterministic behavior for things like
 * "top slugs by revenue with RPC/RPS" without relying
 * solely on the LLM planner.
 */
function heuristicPlan(userQuestion: string): S1Plan | null {
  const qLower = userQuestion.toLowerCase();

  const hasTotalRevenue = qLower.includes("total revenue");
  const hasTopWord =
    qLower.includes("top ") ||
    qLower.includes("top-") ||
    qLower.includes("top_") ||
    qLower.includes("highest") ||
    qLower.includes("biggest") ||
    qLower.includes("best");
  const hasSlugLikeWord =
    qLower.includes("slugs") ||
    qLower.includes("slug ") ||
    qLower.includes("articles") ||
    qLower.includes("article ") ||
    qLower.includes("pages") ||
    qLower.includes("page ") ||
    qLower.includes("content");
  const mentionsRevenue = qLower.includes("revenue");
  const mentionsRpcOrRps =
    qLower.includes("rpc") ||
    qLower.includes("rps") ||
    qLower.includes("rev / click");

  const wantsKeywordState =
    qLower.includes("by state") ||
    qLower.includes("for state") ||
    qLower.includes("for keyword");

  const wantsTopSlugs =
    (hasTopWord && hasSlugLikeWord && mentionsRevenue) || mentionsRpcOrRps;

  if (wantsKeywordState) {
    // We don't yet expose a dedicated keyword_state_breakdown tool,
    // so let the LLM planner handle this case for now.
    return null;
  }

  // Top keywords for a specific slug, e.g.
  // "top revenue producing keywords for careers/exploring-careers-in-home-repair-and-contracting-en-us/"
  const mentionsKeywords = qLower.includes("keyword");
  const hasForClause = qLower.includes(" for ");
  if (mentionsKeywords && hasForClause) {
    const slugMatch = userQuestion.match(/for\s+([^\s]+\/?)/i);
    const slug = slugMatch ? slugMatch[1].trim() : "";
    if (slug) {
      const limitMatch = qLower.match(/top\s+(\d+)/);
      const limit = limitMatch
        ? Math.min(1000, Math.max(1, parseInt(limitMatch[1], 10)))
        : 50;
      return { tool: "keywords_for_slug", slug, limit };
    }
  }

  if (wantsTopSlugs) {
    // Default to top 100 when user doesn't specify a number.
    const match = qLower.match(/top\s+(\d+)/);
    const limit = match ? Math.min(1000, Math.max(1, parseInt(match[1], 10))) : 100;
    return { tool: "top_slugs", limit };
  }

  if (hasTotalRevenue) {
    // Let the planner decide which keyword, since that usually requires
    // extracting an entity from the question.
    return null;
  }

  return null;
}

/**
 * Use a small LLM call to decide which S1 tool to call based on
 * a natural language user question.
 */
export async function planS1Action(userQuestion: string): Promise<S1Plan> {
  // First try cheap heuristics for high-signal patterns.
  const heuristic = heuristicPlan(userQuestion);
  if (heuristic) {
    return heuristic;
  }

  const system = `
You are a routing agent for System1 SERP analytics tools.

Available tools:
- keyword_total(keyword): get total est_net_revenue for a keyword across all rows.
- top_slugs(limit): top slugs/articles/pages by total revenue (with RPC/RPS).
 - keywords_for_slug(slug, limit?): for a given content slug, list top keywords by total revenue (with RPC/RPS).
- keyword_state_breakdown(keyword, states?): revenue by state for a keyword.
- qa_search(query): generic SERP vector search + narrative explanation.

Rules:
- If the user asks for "total revenue for keyword X" or clearly wants the revenue summed across all rows for a keyword, use keyword_total.
- If the user asks for "top slugs/articles/pages by revenue" or mentions RPC/RPS and a top list, use top_slugs.
- If the user asks for "top keywords for slug X by revenue/RPC/RPS", use keywords_for_slug.
- If the user explicitly cares about states/regions for a keyword (e.g. "by state"), use keyword_state_breakdown.
- Otherwise use qa_search.

Return ONLY strict JSON with double quotes. Do NOT include comments or extra text.
`;

  const prompt = `
User question: "${userQuestion}"

Decide which tool to call and parameters.
Return JSON only.
`;

  const raw = await generateText({ system, prompt, temperature: 0 });

  // Best-effort parse; if parsing fails, fall back to qa_search.
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.tool === "string") {
      return parsed as S1Plan;
    }
  } catch {
    // ignore
  }

  return {
    tool: "qa_search",
    query: userQuestion,
  };
}


