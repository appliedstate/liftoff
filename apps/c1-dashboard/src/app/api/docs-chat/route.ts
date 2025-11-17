/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_SERVICE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3001";

/**
 * Docs Chat API
 *
 * Thin wrapper around backend /api/docs/qa that returns C1-compatible content.
 * We don't stream token-by-token here; instead we send a single <content> block.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body as {
      prompt: {
        role?: string;
        content: string | Array<string | { text?: string }>;
      };
      threadId?: string;
      responseId?: string;
    };

    if (!prompt) {
      throw new Error("prompt is required");
    }

    // Extract query text (mirrors analytics-chat)
    let queryText =
      typeof prompt.content === "string"
        ? prompt.content
        : Array.isArray(prompt.content)
        ? prompt.content
            .map((c: any) => {
              if (typeof c === "string") return c;
              if (c && typeof c === "object" && "text" in c) {
                return (c as { text?: string }).text || "";
              }
              return "";
            })
            .join(" ")
        : "";

    if (queryText.startsWith("<content>") && queryText.endsWith("</content>")) {
      queryText = queryText.slice(9, -10).trim();
    }

    if (!queryText || queryText.trim().length === 0) {
      throw new Error("prompt.content is empty or invalid");
    }

    // Call backend docs QA
    const resp = await fetch(`${BACKEND_BASE}/api/docs/qa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: queryText }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(
        `Backend docs QA failed: ${resp.status} ${resp.statusText} - ${text}`
      );
    }

    const { answer, sources } = (await resp.json()) as {
      answer: string;
      sources: Array<{
        path: string;
        sectionTitle?: string | null;
        updatedAt?: string;
      }>;
    };

    const sourcesMarkdown =
      sources && sources.length
        ? [
            "",
            "---",
            "**Sources:**",
            ...sources.map((s) => {
              const labelParts = [s.path];
              if (s.sectionTitle) labelParts.push(`(${s.sectionTitle})`);
              if (s.updatedAt) labelParts.push(`updated ${s.updatedAt}`);
              return `- ${labelParts.join(" ")}`;
            }),
          ].join("\n")
        : "";

    const textMarkdown = `${answer}${sourcesMarkdown}`;

    const c1Payload = {
      component: {
        component: "TextContent",
        props: {
          textMarkdown,
        },
      },
    };

    const contentBlock = `<content thesys="true">${JSON.stringify(
      c1Payload
    )}</content>`;

    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(contentBlock);
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : e ? String(e) : "Unknown error";
    console.error("[docs-chat] Error:", e);

    const errorPayload = {
      component: {
        component: "TextContent",
        props: {
          textMarkdown: `**Docs chat error:** ${message}`,
        },
      },
    };

    const errorBlock = `<content thesys="true">${JSON.stringify(
      errorPayload
    )}</content>`;

    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(errorBlock);
        controller.close();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }
}


