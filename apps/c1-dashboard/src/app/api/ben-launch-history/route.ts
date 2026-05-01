import { NextRequest, NextResponse } from "next/server";
import { getBackendBases, getBackendProxyHeaders, resolveBuyerFromRequest } from "@/lib/backendProxy";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buyer = resolveBuyerFromRequest(request, searchParams.get("buyer"));
    const limit = searchParams.get("limit") || "12";
    let lastError = "No backend base configured";

    for (const base of getBackendBases()) {
      const response = await fetch(
        `${base}/api/campaign-factory/launch-history?buyer=${encodeURIComponent(buyer)}&limit=${encodeURIComponent(limit)}`,
        { cache: "no-store", headers: getBackendProxyHeaders() }
      );

      const text = await response.text();
      if (response.ok) {
        return new NextResponse(text, {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }

      lastError = text;
    }

    return NextResponse.json(
      {
        error: "Failed to load launch history",
        message: lastError,
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
