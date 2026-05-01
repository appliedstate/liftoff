import { NextResponse } from "next/server";
import { BUYER_PORTAL_SESSION_COOKIE } from "@/lib/buyerPortalAuth";

export async function POST() {
  const response = NextResponse.json({ ok: true, redirectTo: "/login" });
  response.cookies.set(BUYER_PORTAL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  return response;
}

