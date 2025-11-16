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
    const { prompt } = (await req.json()) as {
      prompt: {
        content:
          | string
          | Array<
              | string
              | {
                  text?: string;
                }
            >;
      };
    };

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

    // Build backend copilot request from the latest user message
    const body = {
      query: queryText,
      runDate: "2025-11-11",
      limit: 100,
    };

    let answer = "";

    try {
      const backendRes = await fetch(`${BACKEND_BASE}/api/s1/copilot`, {
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
        answer = `Backend error ${backendRes.status}: ${
          text || "No response body"
        }`;
      } else {
        answer = await backendRes.text();
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : e ? String(e) : "Unknown error";
      console.error("[/api/s1-serp-chat] fetch failed", e);
      answer = `Failed to reach backend: ${message}`;
    }

    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(answer);
        controller.close();
      },
    });

    return new NextResponse(stream as any, {
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

