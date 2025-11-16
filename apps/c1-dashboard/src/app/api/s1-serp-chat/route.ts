import { NextRequest, NextResponse } from "next/server";
import { DBMessage, getMessageStore } from "../../api/chat/messageStore";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const { prompt, threadId, responseId } = (await req.json()) as {
      prompt: DBMessage;
      threadId: string;
      responseId: string;
    };

    const messageStore = getMessageStore(threadId);
    messageStore.addMessage(prompt);

    // Build backend QA request from the latest user message
    const body = {
      query: typeof prompt.content === "string" ? prompt.content : "",
      runDate: "2025-11-11",
      limit: 100,
    };

    let answer = "";
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
        answer = `Backend error ${backendRes.status}: ${text || "No response body"}`;
      } else {
        const json = await backendRes.json();
        if (json && typeof json.answer === "string") {
          answer = json.answer as string;
        } else {
          answer = JSON.stringify(json, null, 2);
        }
      }
    } catch (e: any) {
      console.error("[/api/s1-serp-chat] fetch failed", e);
      answer = `Failed to reach backend: ${e?.message || String(e)}`;
    }

    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(answer);
        controller.close();
      },
    });

    // Store assistant reply in message history
    messageStore.addMessage({
      role: "assistant",
      content: answer,
      id: responseId,
    });

    return new Response(stream as any, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e: any) {
    console.error("[/api/s1-serp-chat] handler error", e);
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(
          `Error in s1-serp-chat route: ${e?.message || String(e)}`
        );
        controller.close();
      },
    });

    return new Response(stream as any, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }
}


