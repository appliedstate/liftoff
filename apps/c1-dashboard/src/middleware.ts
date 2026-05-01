import { NextRequest, NextResponse } from "next/server";
import {
  BUYER_PORTAL_SESSION_COOKIE,
  getBuyerPortalDefaultPath,
  getBuyerPortalSessionFromToken,
  isBuyerPortalAllowedApiPath,
} from "@/lib/buyerPortalAuth";

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login")
  );
}

function buildExternalUrl(request: NextRequest, pathname: string, search = ""): URL {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host;
  return new URL(`${proto}://${host}${pathname}${search}`);
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    const token = request.cookies.get(BUYER_PORTAL_SESSION_COOKIE)?.value;
    const session = getBuyerPortalSessionFromToken(token);
    if (session && pathname === "/login") {
      return NextResponse.redirect(buildExternalUrl(request, getBuyerPortalDefaultPath(session)));
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(BUYER_PORTAL_SESSION_COOKIE)?.value;
  const session = getBuyerPortalSessionFromToken(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = buildExternalUrl(request, "/login");
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "buyer") {
    if (pathname.startsWith("/api/") && !isBuyerPortalAllowedApiPath(pathname)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      !pathname.startsWith("/api/") &&
      pathname !== "/" &&
      pathname !== "/ben-launch" &&
      pathname !== "/buyer-launch"
    ) {
      return NextResponse.redirect(buildExternalUrl(request, getBuyerPortalDefaultPath(session)));
    }

    if (pathname === "/" || pathname === "/ben-launch" || pathname === "/buyer-launch") {
      const url = buildExternalUrl(request, "/buyer-launch");
      const expectedBuyer = session.allowedBuyers[0];
      if (request.nextUrl.searchParams.get("buyer") !== expectedBuyer || pathname === "/") {
        url.searchParams.set("buyer", expectedBuyer);
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"],
};
