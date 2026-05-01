import { NextRequest, NextResponse } from "next/server";
import {
  BUYER_PORTAL_SESSION_COOKIE,
  getBuyerPortalSessionFromToken,
  getBuyerPortalSessionSummary,
} from "@/lib/buyerPortalAuth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(BUYER_PORTAL_SESSION_COOKIE)?.value;
  const session = getBuyerPortalSessionFromToken(token);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    session: getBuyerPortalSessionSummary(session),
  });
}

