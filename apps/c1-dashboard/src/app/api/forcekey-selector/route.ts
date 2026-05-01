import { NextRequest, NextResponse } from "next/server";
import { getBackendBases, getBackendProxyHeaders, resolveBuyerFromRequest } from "@/lib/backendProxy";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const buyer = resolveBuyerFromRequest(request, searchParams.get("buyer"));
  const category = searchParams.get("category") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const limit = searchParams.get("limit") || "24";

  try {
    let lastError = "No backend base configured";

    for (const base of getBackendBases()) {
      const response = await fetch(
        `${base}/api/strategist/forcekey-selector?buyer=${encodeURIComponent(
          buyer
        )}&category=${encodeURIComponent(category)}&startDate=${encodeURIComponent(
          startDate
        )}&endDate=${encodeURIComponent(endDate)}&limit=${encodeURIComponent(limit)}`,
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
        error: "Failed to load forcekey selector data",
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
