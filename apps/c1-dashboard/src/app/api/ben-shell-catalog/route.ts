import { NextResponse } from "next/server";

const BACKEND_BASES = [
  process.env.NEXT_PUBLIC_SERVICE_URL,
  process.env.NEXT_PUBLIC_BACKEND_URL,
  "http://localhost:3001",
].filter(Boolean) as string[];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const buyer = searchParams.get("buyer") || "Ben";

  try {
    let lastError = "No backend base configured";

    for (const base of BACKEND_BASES) {
      const response = await fetch(
        `${base}/api/campaign-factory/ben-shell-catalog?buyer=${encodeURIComponent(buyer)}`,
        {
          method: "GET",
          cache: "no-store",
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
