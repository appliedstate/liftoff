/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * S1 SERP Form API Route
 * 
 * Generates C1 components (Form + Table) for the S1 SERP page.
 * This is NOT a chat interface - it generates form and table components dynamically.
 */

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_SERVICE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3001";

const THESYS_BASE = "https://api.thesys.dev/v1/embed/";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, formData } = body as {
      action: 'generate_form' | 'submit_query';
      formData?: {
        query?: string;
        runDate?: string;
        regionCodes?: string;
        limit?: number;
      };
    };

    const client = new OpenAI({
      baseURL: THESYS_BASE,
      apiKey: process.env.THESYS_API_KEY,
    });

    if (action === 'generate_form') {
      // Generate the initial form component
      const formComponent = {
        component: {
          component: "Form",
          props: {
            title: "S1 SERP Copilot – Query Form",
            description: "Ask questions about System1 SERP performance. The backend uses pgvector over serp_keyword_slug_embeddings to fetch relevant rows and an LLM to summarize opportunities.",
            fields: [
              {
                name: "query",
                label: "Question",
                type: "textarea",
                placeholder: "What are the top Juvederm slugs and which states look strongest?",
                required: true,
                defaultValue: "What are the top Juvederm slugs and which states look strongest?",
              },
              {
                name: "runDate",
                label: "Run date",
                type: "date",
                defaultValue: "2025-11-11",
              },
              {
                name: "regionCodes",
                label: "Regions (comma-separated, optional)",
                type: "text",
                placeholder: "CA, TX, FL",
              },
              {
                name: "limit",
                label: "Result limit (table)",
                type: "number",
                defaultValue: 20,
                min: 1,
                max: 200,
              },
            ],
            submitLabel: "Ask S1 SERP Copilot",
          },
        },
      };

      return NextResponse.json(formComponent);
    }

    if (action === 'submit_query' && formData) {
      // Submit the query to backend and generate table component
      const { query, runDate, regionCodes, limit } = formData;

      const backendBody: Record<string, unknown> = {
        query,
        runDate: runDate || "2025-11-11",
        limit: limit || 20,
      };

      const regions = regionCodes
        ?.split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      if (regions && regions.length) backendBody.regionCodes = regions;

      // Call backend
      const backendRes = await fetch(`${BACKEND_BASE}/api/s1/serp/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backendBody),
      });

      if (!backendRes.ok) {
        const text = await backendRes.text();
        throw new Error(`Backend error ${backendRes.status}: ${text}`);
      }

      const response = await backendRes.json() as {
        answer: string;
        context: { rows: any[] };
        runDate: string;
      };

      const rows = response.context?.rows || [];

      // Generate C1 components: Answer text + Table
      const components = [];

      // Answer component
      if (response.answer) {
        components.push({
          component: {
            component: "TextContent",
            props: {
              textMarkdown: `## Answer\n\n${response.answer}`,
            },
          },
        });
      }

      // Table component
      if (rows.length > 0) {
        const columns = [
          { key: "region_code", label: "Region", type: "string" },
          { key: "serp_keyword", label: "Keyword", type: "string" },
          { key: "content_slug", label: "Slug", type: "string" },
          { key: "est_net_revenue", label: "Revenue", type: "currency" },
          { key: "sellside_searches", label: "Searches", type: "number" },
          { key: "sellside_clicks_network", label: "Clicks", type: "number" },
          { key: "rpc", label: "RPC", type: "number" },
          { key: "rps", label: "RPS", type: "number" },
          { key: "finalScore", label: "Score", type: "number" },
        ];

        const tableRows = rows.map((row) => ({
          region_code: row.region_code || "",
          serp_keyword: row.serp_keyword || "",
          content_slug: row.content_slug || "",
          est_net_revenue: row.est_net_revenue?.toFixed(2) || "-",
          sellside_searches: row.sellside_searches ?? "-",
          sellside_clicks_network: row.sellside_clicks_network?.toFixed(1) || "-",
          rpc: row.rpc?.toFixed(3) || "-",
          rps: row.rps?.toFixed(3) || "-",
          finalScore: row.finalScore?.toFixed(3) || "-",
        }));

        components.push({
          component: {
            component: "Table",
            props: {
              title: `Context rows (runDate=${response.runDate}, rows=${rows.length})`,
              columns,
              rows: tableRows,
            },
          },
        });
      } else {
        components.push({
          component: {
            component: "TextContent",
            props: {
              textMarkdown: "No rows returned for this question and filters.",
            },
          },
        });
      }

      return NextResponse.json({
        components,
      });
    }

    throw new Error("Invalid action");
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : e ? String(e) : "Unknown error";
    console.error("[s1-serp-form] Error:", e);
    return NextResponse.json(
      {
        error: message,
        component: {
          component: "TextContent",
          props: {
            textMarkdown: `**Error:** ${message}`,
          },
        },
      },
      { status: 500 }
    );
  }
}


