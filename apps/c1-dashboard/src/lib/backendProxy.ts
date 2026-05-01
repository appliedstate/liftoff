import { NextRequest } from "next/server";
import {
  BUYER_PORTAL_SESSION_COOKIE,
  BuyerPortalSession,
  getBuyerPortalSessionFromToken,
  resolveBuyerForSession,
} from "@/lib/buyerPortalAuth";

const BACKEND_BASES = [
  process.env.NEXT_PUBLIC_SERVICE_URL,
  process.env.NEXT_PUBLIC_BACKEND_URL,
  "http://localhost:3001",
].filter(Boolean) as string[];

export function getBackendBases(): string[] {
  return BACKEND_BASES;
}

export function getBackendProxyHeaders(extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra || {});
  const adminToken =
    process.env.STRATEGIST_ADMIN_TOKEN ||
    process.env.STRATEGIST_DEV_ADMIN_TOKEN ||
    process.env.INTERNAL_BACKEND_ADMIN_TOKEN;

  if (adminToken && !headers.has("x-admin-token")) {
    headers.set("x-admin-token", adminToken);
  }

  return headers;
}

export function requireBuyerPortalSession(request: NextRequest): BuyerPortalSession {
  const token = request.cookies.get(BUYER_PORTAL_SESSION_COOKIE)?.value;
  const session = getBuyerPortalSessionFromToken(token);
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export function resolveBuyerFromRequest(request: NextRequest, requestedBuyer?: string | null): string {
  const session = requireBuyerPortalSession(request);
  return resolveBuyerForSession(session, requestedBuyer);
}

