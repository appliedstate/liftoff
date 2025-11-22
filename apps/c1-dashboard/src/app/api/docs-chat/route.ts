/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { transformStream } from "@crayonai/stream";
import OpenAI from "openai";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_SERVICE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3001";

/**
 * Docs Chat API
 *
 * Mirrors the working /api/s1-serp-chat pattern:
 * 1) Parse C1Chat prompt into a plain text query.
 * 2) Call backend /api/docs/qa for RAG over repo docs.
 * 3) Send the backend answer + sources into the Thesys C1 model as context.
 * 4) Stream the C1 response token-by-token so the UX matches /api/chat and /api/s1-serp-chat.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
      throw new Error("prompt is required");
    }

    // Extract query text (same pattern as /api/s1-serp-chat)
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
      throw new Error("prompt.content is empty or invalid");
    }

    // Call backend docs QA
    const backendUrl = `${BACKEND_BASE}/api/docs/qa`;
    let backendAnswer = "";
    let backendSources:
      | Array<{
          path: string;
          sectionTitle?: string | null;
          updatedAt?: string;
        }>
      | null = null;

    try {
      const resp = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        backendAnswer = `Backend docs QA error ${resp.status}: ${
          text || "No response body"
        }`;
      } else {
        const json = (await resp.json()) as {
          answer?: string;
          sources?: Array<{
            path: string;
            sectionTitle?: string | null;
            updatedAt?: string;
          }>;
        };
        backendAnswer =
          typeof json?.answer === "string"
            ? json.answer
            : JSON.stringify(json, null, 2);
        backendSources = json.sources ?? null;
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : e ? String(e) : "Unknown error";
      backendAnswer = `Failed to reach backend docs QA: ${message}`;
    }

    // Prepare a compact sources summary for the system prompt
    let sourcesSummary = "";
    if (backendSources && backendSources.length > 0) {
      const lines = backendSources.slice(0, 8).map((s) => {
        const parts = [s.path];
        if (s.sectionTitle) parts.push(`(${s.sectionTitle})`);
        if (s.updatedAt) parts.push(`updated ${s.updatedAt}`);
        return `- ${parts.join(" ")}`;
      });
      sourcesSummary = ["Sources:", ...lines].join("\n");
    }

    // Call Thesys C1 to stream a user-friendly docs answer
    const client = new OpenAI({
      baseURL: "https://api.thesys.dev/v1/embed/",
      apiKey: process.env.THESYS_API_KEY,
    });

    const systemPrompt = `You are a documentation copilot for the Liftoff repo.

User question:
${queryText}

Backend RAG answer (from /api/docs/qa):
${backendAnswer}

${sourcesSummary || "Sources: (none provided)"}

Rewrite this into a clear, concise answer for the user, grounded in the backend answer and sources.
Prefer bullet lists and short sections. If the backend answer indicates missing or incomplete docs, call that out.`;

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
          // Optional: add logging here if needed
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
    console.error("[docs-chat] handler error", e);

    const encoder = new TextEncoder();
    const errorStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`Error from /api/docs-chat: ${message}`)
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


