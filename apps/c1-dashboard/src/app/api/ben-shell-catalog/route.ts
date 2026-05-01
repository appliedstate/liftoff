import { NextRequest, NextResponse } from "next/server";
import { getBackendBases, getBackendProxyHeaders, resolveBuyerFromRequest } from "@/lib/backendProxy";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const buyer = resolveBuyerFromRequest(request, searchParams.get("buyer"));

  try {
    let lastError = "No backend base configured";

    for (const base of getBackendBases()) {
      const response = await fetch(
        `${base}/api/campaign-factory/ben-shell-catalog?buyer=${encodeURIComponent(buyer)}`,
        {
          method: "GET",
          cache: "no-store",
          headers: getBackendProxyHeaders(),
        }
      );

      if (response.ok) {
        const json = await response.json();
        return NextResponse.json(json, { status: 200 });
      }

      lastError = await response.text();
    }

    return NextResponse.json(
      {
        error: "Failed to load buyer shell catalog",
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
