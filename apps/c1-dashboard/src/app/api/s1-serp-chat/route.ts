/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { transformStream } from "@crayonai/stream";
import OpenAI from "openai";

/**
 * Base URL for the strategist backend.
 *
 * Prefer `NEXT_PUBLIC_SERVICE_URL`, then `NEXT_PUBLIC_BACKEND_URL`, then localhost for local dev.
 */
const BACKEND_BASE =
  process.env.NEXT_PUBLIC_SERVICE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    // C1Chat sends { prompt, threadId, responseId } - match the working /api/chat route
    const body = await req.json();
    console.log("[/api/s1-serp-chat] received request body:", JSON.stringify(body, null, 2));
    
    const { prompt, threadId, responseId } = body as {
      prompt: {
        role?: string;
        content:
          | string
          | Array<
              | string
              | {
                  text?: string;
                }
            >;
      };
      threadId?: string;
      responseId?: string;
    };

    if (!prompt) {
      console.error("[/api/s1-serp-chat] prompt is missing from request");
      throw new Error("prompt is required");
    }
    
    console.log("[/api/s1-serp-chat] prompt:", JSON.stringify(prompt, null, 2));

    // Extract the latest user text from the prompt
    let queryText =
      typeof prompt.content === "string"
        ? prompt.content
        : Array.isArray(prompt.content)
        ? prompt.content
            .map((c: any) => {
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

    // C1Chat sometimes wraps content in <content>...</content> tags - strip them
    if (queryText.startsWith("<content>") && queryText.endsWith("</content>")) {
      queryText = queryText.slice(9, -10).trim();
    }

    if (!queryText || queryText.trim().length === 0) {
      console.error("[/api/s1-serp-chat] queryText is empty");
      throw new Error("prompt.content is empty or invalid");
    }

    console.log("[/api/s1-serp-chat] extracted queryText:", queryText);
    console.log("[/api/s1-serp-chat] BACKEND_BASE:", BACKEND_BASE);

    // Debug override is no longer needed now that we align with the working /api/chat pattern.

    // Build backend agent request from the latest user message
    const backendBody = {
      query: queryText,
      runDate: "2025-11-11",
      limit: 100,
      // Pass through threadId so the backend agent can keep per-thread context
      threadId,
    };
    
    const backendUrl = `${BACKEND_BASE}/api/s1/agent`;
    console.log("[/api/s1-serp-chat] calling backend:", backendUrl);

    let answer = "";

    try {
      const backendRes = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backendBody),
      });
      
      console.log("[/api/s1-serp-chat] backend response status:", backendRes.status);

      if (!backendRes.ok) {
        const text = await backendRes.text();
        console.error(
          "[/api/s1-serp-chat] backend error",
          backendRes.status,
          text
        );
        answer = `Backend error ${backendRes.status}: ${
          text || "No response body"
        }`;
      } else {
        const json = await backendRes.json().catch(async () => {
          const text = await backendRes.text();
          return { answer: text };
        });
        answer = typeof json?.answer === "string" ? json.answer : JSON.stringify(json);
        console.log("[/api/s1-serp-chat] backend agent answer length:", answer.length);
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : e ? String(e) : "Unknown error";
      console.error("[/api/s1-serp-chat] fetch failed", e);
      answer = `Failed to reach backend: ${message}`;
    }
    
    console.log("[/api/s1-serp-chat] returning answer, length:", answer.length);

    /**
     * IMPORTANT: Use the same pattern as the working /api/chat route.
     *
     * We send the backend copilot answer to C1 (Thesys) as system context,
     * then stream the C1 response using transformStream. From C1Chat's
     * perspective this is identical to /api/chat, so it should render
     * correctly.
     */

    const client = new OpenAI({
      baseURL: "https://api.thesys.dev/v1/embed/",
      apiKey: process.env.THESYS_API_KEY,
    });

    const systemPrompt = `You are an assistant that explains System1 SERP copilot results.

Original user question: "${queryText}"

Backend copilot analysis:
${answer}

Provide a concise answer for the user based on the backend analysis.`;

    const llmStream = await client.chat.completions.create({
      model: "c1/openai/gpt-5/v-20250915",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: queryText },
      ],
      stream: true,
    });

    const responseStream = transformStream(
      llmStream,
      (chunk) => {
        return chunk.choices?.[0]?.delta?.content ?? "";
      },
      {
        onEnd: () => {
          console.log("[/api/s1-serp-chat] stream closed successfully");
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
    
    // If something goes wrong, fall back to a simple text stream so the user
    // sees a helpful error instead of a generic message.
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`Error from /api/s1-serp-chat: ${message}`)
        );
        controller.close();
      },
    });

    return new NextResponse(errorStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }
}

