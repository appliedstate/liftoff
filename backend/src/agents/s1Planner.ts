import { generateText } from "../lib/openai";

export type S1ToolName =
  | "keyword_total"
  | "top_slugs"
  | "keyword_state_breakdown"
  | "qa_search";

export type S1Plan =
  | { tool: "keyword_total"; keyword: string }
  | { tool: "top_slugs"; limit: number }
  | { tool: "qa_search"; query: string }
  | { tool: "keyword_state_breakdown"; keyword: string; states?: string[] };

/**
 * Use a small LLM call to decide which S1 tool to call based on
 * a natural language user question.
 */
export async function planS1Action(userQuestion: string): Promise<S1Plan> {
  const system = `
You are a routing agent for System1 SERP analytics tools.

Available tools:
- keyword_total(keyword): get total est_net_revenue for a keyword across all rows.
- top_slugs(limit): top slugs/articles/pages by total revenue (with RPC/RPS).
- keyword_state_breakdown(keyword, states?): revenue by state for a keyword.
- qa_search(query): generic SERP vector search + narrative explanation.

Rules:
- If the user asks for "total revenue for keyword X" or clearly wants the revenue summed across all rows for a keyword, use keyword_total.
- If the user asks for "top slugs/articles/pages by revenue" or mentions RPC/RPS and a top list, use top_slugs.
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


