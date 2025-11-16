import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { transformStream } from "@crayonai/stream";
import { DBMessage, getMessageStore } from "../../api/chat/messageStore";

/**
 * Base URL for the strategist backend.
 *
 * Prefer `NEXT_PUBLIC_SERVICE_URL` to match the broader Liftoff convention,
 * but also support `NEXT_PUBLIC_BACKEND_URL` as a fallback. This avoids
 * subtle misconfig where the env var is set but the proxy silently falls
 * back to localhost (which will 500/ECONNREFUSED on Vercel).
 */
const BACKEND_BASE =
  process.env.NEXT_PUBLIC_SERVICE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const { prompt, threadId, responseId } = (await req.json()) as {
      prompt: DBMessage;
      threadId: string;
      responseId: string;
    };

    // C1 / OpenAI-compatible client
    const client = new OpenAI({
      baseURL: "https://api.thesys.dev/v1/embed/",
      apiKey: process.env.THESYS_API_KEY,
    });

    const messageStore = getMessageStore(threadId);
    messageStore.addMessage(prompt);

    // Extract the latest user text from the prompt
    const userText =
      typeof prompt.content === "string"
        ? prompt.content
        : Array.isArray(prompt.content)
        ? prompt.content
            .map((c: unknown) => {
              if (typeof c === "string") return c;
              if (
                c &&
                typeof c === "object" &&
                "text" in c &&
                typeof (c as { text?: string }).text === "string"
              ) {
                return (c as { text: string }).text;
              }
              return "";
            })
            .join(" ")
        : "";

    // Build backend QA request from the latest user message
    const body = {
      query: userText,
      runDate: "2025-11-11",
      limit: 100,
    };

    let qaAnswer = "";
    let qaContext: { rows?: unknown[] } | null = null;

    try {
      const backendRes = await fetch(`${BACKEND_BASE}/api/s1/serp/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!backendRes.ok) {
        const text = await backendRes.text();
        console.error(
          "[/api/s1-serp-chat] backend error",
          backendRes.status,
          text
        );
        qaAnswer = `Backend error ${backendRes.status}: ${text || "No response body"}`;
      } else {
        const json = await backendRes.json();
        if (json && typeof json.answer === "string") {
          qaAnswer = json.answer as string;
          qaContext = json.context || null;
        } else {
          qaAnswer = JSON.stringify(json, null, 2);
          qaContext = json.context || null;
        }
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : e ? String(e) : "Unknown error";
      console.error("[/api/s1-serp-chat] fetch failed", e);
      qaAnswer = `Failed to reach backend: ${message}`;
      qaContext = null;
    }

    // Call C1 to turn the System1 QA answer + rows into a C1-formatted UI response.
    const systemPrompt =
      "You are a SERP analytics copilot. You receive a marketer question, " +
      "a QA-style natural language answer based on System1 SERP data, and a small table of top rows " +
      "(with serp_keyword, content_slug, region_code, est_net_revenue, rpc, rps, cos). " +
      "Return a concise C1 UI that: (1) summarizes key opportunities, (2) calls out best slugs/regions, " +
      "and (3) can be rendered directly by C1.";

    const rows = Array.isArray(qaContext?.rows)
      ? qaContext.rows.slice(0, 20)
      : [];

    const c1UserPayload = JSON.stringify({
      user_question: userText,
      qa_answer: qaAnswer,
      top_rows: rows,
    });

    const llmStream = await client.chat.completions.create({
      model: "c1/openai/gpt-5/v-20250915",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: c1UserPayload,
        },
      ],
      stream: true,
    });

    // Transform the OpenAI stream into the SSE format that C1Chat expects
    const responseStream = transformStream(
      llmStream,
      (chunk) => {
        return chunk.choices?.[0]?.delta?.content ?? "";
      },
      {
        onEnd: ({ accumulated }) => {
          const message = accumulated.filter((m) => m).join("");
          messageStore.addMessage({
            role: "assistant",
            content: message,
            id: responseId,
          });
        },
      }
    ) as ReadableStream<string>;

    return new NextResponse(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : e ? String(e) : "Unknown error";
    console.error("[/api/s1-serp-chat] handler error", e);
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(`Error in s1-serp-chat route: ${message}`);
        controller.close();
      },
    });

    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }
}


