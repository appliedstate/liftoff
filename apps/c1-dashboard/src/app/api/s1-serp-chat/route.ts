/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

/**
 * Base URL for the strategist backend.
 *
 * Prefer `NEXT_PUBLIC_SERVICE_URL` and fall back to localhost for local dev.
 */
const BACKEND_BASE =
  process.env.NEXT_PUBLIC_SERVICE_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    // C1Chat sends { prompt, threadId, responseId } - match the working /api/chat route
    const body = await req.json();
    console.log("[/api/s1-serp-chat] received request body:", JSON.stringify(body, null, 2));
    
    const { prompt } = body as {
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
    const queryText =
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

    if (!queryText || queryText.trim().length === 0) {
      console.error("[/api/s1-serp-chat] queryText is empty");
      throw new Error("prompt.content is empty or invalid");
    }

    console.log("[/api/s1-serp-chat] extracted queryText:", queryText);

    // Build backend copilot request from the latest user message
    const backendBody = {
      query: queryText,
      runDate: "2025-11-11",
      limit: 100,
    };
    
    console.log("[/api/s1-serp-chat] calling backend:", `${BACKEND_BASE}/api/s1/copilot`);

    let answer = "";

    try {
      const backendRes = await fetch(`${BACKEND_BASE}/api/s1/copilot`, {
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
        answer = await backendRes.text();
        console.log("[/api/s1-serp-chat] backend answer length:", answer.length);
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : e ? String(e) : "Unknown error";
      console.error("[/api/s1-serp-chat] fetch failed", e);
      answer = `Failed to reach backend: ${message}`;
    }
    
    console.log("[/api/s1-serp-chat] returning answer, length:", answer.length);

    // Create a simple text stream - C1Chat will handle SSE formatting
    // Match the pattern from the working /api/chat route
    const responseStream = new ReadableStream<string>({
      start(controller) {
        // Send the full answer as a single chunk
        controller.enqueue(answer);
        controller.close();
      },
    });

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
    
    // Return error as text stream
    const responseStream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(`Error: ${message}`);
        controller.close();
      },
    });

    return new NextResponse(responseStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }
}

