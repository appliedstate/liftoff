export const BUYER_PORTAL_SESSION_COOKIE = "liftoff_buyer_portal_session";

export type BuyerSlug = "Ben" | "Cook";
export type BuyerPortalRole = "buyer" | "admin";

export type BuyerPortalSession = {
  loginKey: "ben" | "cook" | "admin";
  role: BuyerPortalRole;
  buyer: BuyerSlug | null;
  allowedBuyers: BuyerSlug[];
  displayName: string;
};

type BuyerAccountConfig = {
  loginKey: BuyerPortalSession["loginKey"];
  username: string;
  password?: string;
  sessionToken?: string;
  role: BuyerPortalRole;
  buyer: BuyerSlug | null;
  allowedBuyers: BuyerSlug[];
  displayName: string;
};

const BUYER_ORDER: BuyerSlug[] = ["Ben", "Cook"];

function normalizeBuyer(value?: string | null): BuyerSlug | null {
  if (!value) return null;
  const lowered = value.trim().toLowerCase();
  if (lowered === "ben") return "Ben";
  if (lowered === "cook" || lowered === "andrew" || lowered === "andrew cook") return "Cook";
  return null;
}

function configuredAccounts(): BuyerAccountConfig[] {
  return [
    {
      loginKey: "ben",
      username: "ben",
      password: process.env.BUYER_PORTAL_BEN_PASSWORD,
      sessionToken: process.env.BUYER_PORTAL_BEN_SESSION_TOKEN,
      role: "buyer",
      buyer: "Ben",
      allowedBuyers: ["Ben"],
      displayName: "Ben Holley",
    },
    {
      loginKey: "cook",
      username: "cook",
      password: process.env.BUYER_PORTAL_COOK_PASSWORD,
      sessionToken: process.env.BUYER_PORTAL_COOK_SESSION_TOKEN,
      role: "buyer",
      buyer: "Cook",
      allowedBuyers: ["Cook"],
      displayName: "Andrew Cook",
    },
    {
      loginKey: "admin",
      username: "admin",
      password: process.env.BUYER_PORTAL_ADMIN_PASSWORD,
      sessionToken: process.env.BUYER_PORTAL_ADMIN_SESSION_TOKEN,
      role: "admin",
      buyer: null,
      allowedBuyers: BUYER_ORDER,
      displayName: "Operator",
    },
  ];
}

function toSession(account: BuyerAccountConfig): BuyerPortalSession {
  return {
    loginKey: account.loginKey,
    role: account.role,
    buyer: account.buyer,
    allowedBuyers: account.allowedBuyers,
    displayName: account.displayName,
  };
}

export function authenticateBuyerPortalCredentials(
  username: string,
  password: string
): { session: BuyerPortalSession; sessionToken: string } | null {
  const normalizedUsername = username.trim().toLowerCase();
  const account = configuredAccounts().find(
    (entry) =>
      entry.username === normalizedUsername &&
      entry.password &&
      entry.sessionToken &&
      entry.password === password
  );

  if (!account || !account.sessionToken) return null;
  return {
    session: toSession(account),
    sessionToken: account.sessionToken,
  };
}

export function getBuyerPortalSessionFromToken(token?: string | null): BuyerPortalSession | null {
  if (!token) return null;
  const account = configuredAccounts().find(
    (entry) => entry.sessionToken && entry.sessionToken === token
  );
  return account ? toSession(account) : null;
}

export function resolveBuyerForSession(
  session: BuyerPortalSession,
  requestedBuyer?: string | null
): BuyerSlug {
  if (session.role !== "admin") {
    return session.allowedBuyers[0];
  }

  return normalizeBuyer(requestedBuyer) || session.allowedBuyers[0];
}

export function getBuyerPortalDefaultPath(session: BuyerPortalSession): string {
  return `/buyer-launch?buyer=${encodeURIComponent(resolveBuyerForSession(session, session.buyer))}`;
}

export function isBuyerPortalAllowedApiPath(pathname: string): boolean {
  return [
    "/api/ben-shell-catalog",
    "/api/ben-article-catalog",
    "/api/ben-campaign-catalog",
    "/api/ben-launch-history",
    "/api/forcekey-selector",
    "/api/ben-setup",
    "/api/ben-launch",
    "/api/auth/session",
    "/api/auth/logout",
  ].some((prefix) => pathname.startsWith(prefix));
}

export function getBuyerPortalSessionSummary(session: BuyerPortalSession) {
  return {
    role: session.role,
    buyer: session.buyer,
    allowedBuyers: session.allowedBuyers,
    displayName: session.displayName,
  };
}

