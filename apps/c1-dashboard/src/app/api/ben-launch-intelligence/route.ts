import { NextRequest, NextResponse } from "next/server";
import { getBackendBases, getBackendProxyHeaders, resolveBuyerFromRequest } from "@/lib/backendProxy";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const buyer = resolveBuyerFromRequest(request, searchParams.get("buyer"));
  const organization = searchParams.get("organization") || "Interlincx";

  try {
    let lastError = "No backend base configured";

    for (const base of getBackendBases()) {
      const response = await fetch(
        `${base}/api/campaign-factory/buyer-launch-intelligence?buyer=${encodeURIComponent(
          buyer
        )}&organization=${encodeURIComponent(organization)}`,
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
        error: "Failed to load buyer launch intelligence",
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
