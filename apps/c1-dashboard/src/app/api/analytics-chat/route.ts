/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { transformStream } from "@crayonai/stream";
import OpenAI from "openai";
import { generateC1Component } from "./dataFormatter";

/**
 * Enhanced Analytics Chat API Route
 * 
 * Uses C1 by Thesys to generate dynamic UI components (charts, tables) based on
 * analytical queries. Integrates with MCP tools for data access.
 */

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_SERVICE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3001";

const THESYS_BASE = "https://api.thesys.dev/v1/embed/";

// In-memory message store (in production, use database)
const messageStores = new Map<string, any[]>();

function getMessageStore(threadId: string) {
  if (!messageStores.has(threadId)) {
    messageStores.set(threadId, []);
  }
  return messageStores.get(threadId)!;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, threadId = "default", responseId } = body as {
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

    // Extract query text
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

    // Strip content tags if present
    if (queryText.startsWith("<content>") && queryText.endsWith("</content>")) {
      queryText = queryText.slice(9, -10).trim();
    }

    if (!queryText || queryText.trim().length === 0) {
      throw new Error("prompt.content is empty or invalid");
    }

    console.log("[analytics-chat] Query:", queryText);
    console.log("[analytics-chat] Thread ID:", threadId);

    // Step 1: Detect intent and get data via MCP tools
    const intentResponse = await fetch(`${BACKEND_BASE}/api/analytics/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: queryText, threadId }),
    });

    if (!intentResponse.ok) {
      throw new Error(`Intent detection failed: ${intentResponse.statusText}`);
    }

    const { intent, data, toolCalls } = await intentResponse.json();
    console.log("[analytics-chat] Intent:", intent.type, intent.visualization);

    // Step 2: Generate C1 component based on intent and data
    const messageStore = getMessageStore(threadId);
    
    // Add user message
    messageStore.push({
      role: "user",
      content: queryText,
    });

    // Generate C1 component directly from data (more reliable than LLM generation)
    let c1Component: any;
    try {
      c1Component = generateC1Component(intent, data);
    } catch (error: any) {
      console.error("[analytics-chat] Component generation error:", error);
      // Fallback to text
      c1Component = {
        component: {
          component: "TextContent",
          props: {
            textMarkdown: `**Error generating visualization:** ${error.message}\n\nData: ${JSON.stringify(data, null, 2)}`,
          },
        },
      };
    }

    // Format as C1 DSL
    const c1Response = `<content thesys="true">${JSON.stringify(c1Component)}</content>`;

    // Create streaming response
    const client = new OpenAI({
      baseURL: THESYS_BASE,
      apiKey: process.env.THESYS_API_KEY,
    });

    // Get conversation history for context
    const conversationHistory = messageStore.slice(-10).map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Use C1 API to enhance the response with natural language explanation
    const systemPrompt = `You are an analytical assistant. The user asked: "${queryText}"

A C1 component has been generated to visualize the data. Provide a brief natural language explanation (1-2 sentences) that introduces the visualization and highlights key insights.

Keep it concise and focused.`;

    // Call C1 API for natural language enhancement
    const llmStream = await client.chat.completions.create({
      model: "c1/openai/gpt-5/v-20250915",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: queryText },
      ],
      stream: true,
    });

    // Stream: first send text explanation, then the C1 component
    const responseStream = new ReadableStream<string>({
      async start(controller) {
        try {
          // Stream LLM explanation first
          let explanation = "";
          for await (const chunk of llmStream) {
            const content = chunk.choices?.[0]?.delta?.content ?? "";
            if (content) {
              explanation += content;
              // Send explanation as text content first
              const textComponent = `<content thesys="true">${JSON.stringify({
                component: {
                  component: "TextContent",
                  props: {
                    textMarkdown: explanation,
                  },
                },
              })}</content>`;
              controller.enqueue(textComponent);
            }
          }

          // Then send the main visualization component
          controller.enqueue(c1Response);

          // Store assistant message
          const fullMessage = explanation + "\n\n" + JSON.stringify(c1Component);
          messageStore.push({
            role: "assistant",
            content: fullMessage,
            id: responseId,
          });

          // Update context on backend
          fetch(`${BACKEND_BASE}/api/analytics/context`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threadId,
              message: {
                role: "assistant",
                content: fullMessage,
                timestamp: new Date().toISOString(),
                metadata: {
                  queryType: intent.type,
                  visualizationType: intent.visualization,
                  dataSource: intent.dataSource,
                },
              },
            }),
          }).catch(console.error);

          controller.close();
        } catch (error: any) {
          console.error("[analytics-chat] Stream error:", error);
          controller.error(error);
        }
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
    console.error("[analytics-chat] Error:", e);

    const errorResponse = `<content thesys="true">${JSON.stringify({
      component: {
        component: "TextContent",
        props: {
          textMarkdown: `**Error:** ${message}`,
        },
      },
    })}</content>`;

    const responseStream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(errorResponse);
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

