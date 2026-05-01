import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASES = [
  process.env.NEXT_PUBLIC_SERVICE_URL,
  process.env.NEXT_PUBLIC_BACKEND_URL,
  "http://localhost:3001",
].filter(Boolean) as string[];

async function proxyRequest(request: NextRequest, params: { path?: string[] }, method: string) {
  const suffix = (params.path || []).join("/");
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  let lastError = "No backend base configured";

  for (const base of BACKEND_BASES) {
    const target = `${base}/api/meeting-intelligence/${suffix}${query ? `?${query}` : ""}`;
    try {
      const init: RequestInit = {
        method,
        headers: {
          "Content-Type": request.headers.get("content-type") || "application/json",
        },
        cache: "no-store",
      };

      if (!["GET", "HEAD"].includes(method)) {
        init.body = await request.text();
      }

      const response = await fetch(target, init);
      const text = await response.text();
      const contentType = response.headers.get("content-type") || "application/json";

      if (response.ok) {
        return new NextResponse(text, {
          status: response.status,
          headers: {
            "Content-Type": contentType,
          },
        });
      }

      lastError = text;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json(
    {
      error: "Failed to reach backend",
      message: lastError,
    },
    { status: 500 }
  );
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxyRequest(request, await context.params, "GET");
}

export async function POST(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxyRequest(request, await context.params, "POST");
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxyRequest(request, await context.params, "PATCH");
}
