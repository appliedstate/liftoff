import { NextResponse } from "next/server";
import {
  BUYER_PORTAL_SESSION_COOKIE,
  authenticateBuyerPortalCredentials,
  getBuyerPortalDefaultPath,
} from "@/lib/buyerPortalAuth";

export async function POST(request: Request) {
  try {
    const { username, password, next } = (await request.json()) as {
      username?: string;
      password?: string;
      next?: string;
    };

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const authenticated = authenticateBuyerPortalCredentials(username, password);
    if (!authenticated) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const response = NextResponse.json({
      ok: true,
      redirectTo:
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : getBuyerPortalDefaultPath(authenticated.session),
      session: {
        role: authenticated.session.role,
        buyer: authenticated.session.buyer,
        allowedBuyers: authenticated.session.allowedBuyers,
        displayName: authenticated.session.displayName,
      },
    });

    response.cookies.set(BUYER_PORTAL_SESSION_COOKIE, authenticated.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Login failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

