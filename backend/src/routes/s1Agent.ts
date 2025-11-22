import { Router } from "express";
import { planS1Action, S1Plan } from "../agents/s1Planner";
import {
  toolKeywordTotalRevenue,
  toolTopSlugs,
  toolSerpSearch,
} from "../services/s1SerpTools";
import { generateText } from "../lib/openai";

const router = Router();

/**
 * POST /api/s1/agent
 *
 * Minimal S1 "agent" endpoint:
 * 1) Uses an LLM planner to choose which S1 tool to call.
 * 2) Executes the chosen tool (metrics/vector search).
 * 3) Uses an LLM to turn tool output into a final natural language answer.
 */
router.post("/agent", async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required (string)" });
    }

    // 1) PLAN
    const plan: S1Plan = await planS1Action(query);
    console.log("[s1.agent] plan:", plan);

    // 2) ACT
    let toolResult: any;
    if (plan.tool === "keyword_total") {
      toolResult = await toolKeywordTotalRevenue(plan.keyword);
    } else if (plan.tool === "top_slugs") {
      toolResult = await toolTopSlugs(plan.limit);
    } else if (plan.tool === "qa_search") {
      toolResult = await toolSerpSearch(plan.query, 50);
    } else {
      // For now, fall back to qa_search for keyword_state_breakdown
      toolResult = await toolSerpSearch(query, 50);
    }

    // 3) ANSWER
    const system = `
You are a System1 SERP analytics copilot.
You are given:
- a user question
- the tool plan that was chosen
- JSON results from that tool

Use ONLY the JSON values provided to answer. Be concise and concrete.
If a total revenue value is present, state the number clearly.
If a list of rows is present, summarize the top patterns instead of dumping the full table.
`;

    const answerPrompt = [
      `User question: ${query}`,
      "",
      "Tool plan JSON:",
      JSON.stringify(plan, null, 2),
      "",
      "Tool result JSON:",
      JSON.stringify(toolResult, null, 2),
      "",
      "Now answer the user's question clearly, using the numbers from the JSON.",
    ].join("\n");

    const answer = await generateText({
      system,
      prompt: answerPrompt,
      temperature: 0.2,
      maxTokens: 400,
    });

    return res.status(200).json({
      status: "ok",
      plan,
      toolResult,
      answer,
    });
  } catch (e: any) {
    console.error("[s1.agent] Error:", e?.message || e);
    return res
      .status(500)
      .json({ error: e?.message || "S1 agent failed" });
  }
});

export default router;




