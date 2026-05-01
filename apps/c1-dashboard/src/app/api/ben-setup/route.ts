import { NextRequest, NextResponse } from "next/server";
import { getBackendBases, getBackendProxyHeaders, resolveBuyerFromRequest } from "@/lib/backendProxy";

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const authToken = request.headers.get("x-strategis-auth-token");
    const buyer = resolveBuyerFromRequest(request, payload?.buyer);
    let lastError: unknown = "No backend base configured";

    for (const base of getBackendBases()) {
      const response = await fetch(`${base}/api/campaign-factory/ben-setup`, {
        method: "POST",
        headers: getBackendProxyHeaders({
          "Content-Type": "application/json",
          ...(authToken ? { "x-strategis-auth-token": authToken } : {}),
        }),
        body: JSON.stringify({
          ...payload,
          buyer,
        }),
      });

      const text = await response.text();
      const parsed = tryParseJson(text);
      if (response.ok) {
        return new NextResponse(text, {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }

      if (parsed && typeof parsed === "object") {
        return NextResponse.json(parsed, { status: response.status });
      }

      lastError = text;
    }

    return NextResponse.json(
      {
        error: "Failed to run buyer setup",
        message: typeof lastError === "string" ? lastError : JSON.stringify(lastError),
      },
      { status: 500 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to reach backend",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
