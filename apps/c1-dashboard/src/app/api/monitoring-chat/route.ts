/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { transformStream } from "@crayonai/stream";
import OpenAI from "openai";

/**
 * Monitoring Chat API
 *
 * Pattern:
 * 1) Parse C1Chat prompt into a plain text query.
 * 2) Call backend /api/monitoring/agent for NL→SQL+DuckDB execution.
 * 3) Feed the backend answer into Thesys C1 and stream a user-facing explanation.
 */

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_SERVICE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3001";

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

    // Extract query text (same pattern as /api/s1-serp-chat and /api/docs-chat)
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

    if (queryText.startsWith("<content>") && queryText.endsWith("</content>")) {
      queryText = queryText.slice(9, -10).trim();
    }

    if (!queryText || queryText.trim().length === 0) {
      throw new Error("prompt.content is empty or invalid");
    }

    // Call backend monitoring agent
    const backendUrl = `${BACKEND_BASE}/api/monitoring/agent`;
    let backendAnswer = "";

    try {
      const resp = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText, threadId }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        backendAnswer = `Monitoring agent error ${resp.status}: ${
          text || "No response body"
        }`;
      } else {
        const json = (await resp.json()) as {
          status?: string;
          sql?: string;
          summary?: string | null;
          rowCount?: number;
          rows?: any[];
          error?: string;
        };
        if (json.error) {
          backendAnswer = `Monitoring agent reported error: ${json.error}`;
        } else {
          const metaLines: string[] = [];
          if (json.sql) metaLines.push(`SQL: \`${json.sql}\``);
          if (typeof json.rowCount === "number")
            metaLines.push(`Rows: ${json.rowCount}`);
          if (json.summary) metaLines.push(`Summary: ${json.summary}`);

          const previewRows = (json.rows || []).slice(0, 10);
          const tablePreview = previewRows.length
            ? JSON.stringify(previewRows, null, 2)
            : "(no rows returned)";

          backendAnswer = [
            metaLines.join("\n"),
            "",
            "Row preview (first 10 rows):",
            tablePreview,
          ].join("\n");
        }
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : e ? String(e) : "Unknown error";
      backendAnswer = `Failed to reach monitoring agent: ${message}`;
    }

    // Call Thesys C1 to stream a user-friendly monitoring answer
    const client = new OpenAI({
      baseURL: "https://api.thesys.dev/v1/embed/",
      apiKey: process.env.THESYS_API_KEY,
    });

    const systemPrompt = `You are an analytics copilot for multi-network ad performance.

User question:
${queryText}

Backend monitoring agent output (SQL + results preview):
${backendAnswer}

Using ONLY this information, explain the answer in clear business terms:
- Summarize the key numbers (spend, revenue, ROAS, launches, etc.).
- Call out any obvious problems or standout buyers/networks/sites.
- Keep it concise (2–5 short paragraphs or bullet lists).`;

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
    console.error("[monitoring-chat] handler error", e);

    const encoder = new TextEncoder();
    const errorStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`Error from /api/monitoring-chat: ${message}`)
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


