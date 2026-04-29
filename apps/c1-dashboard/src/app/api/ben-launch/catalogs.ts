const BACKEND_BASES = [
  process.env.NEXT_PUBLIC_SERVICE_URL,
  process.env.NEXT_PUBLIC_BACKEND_URL,
  "http://localhost:3001",
].filter(Boolean) as string[];

async function fetchFromBackend(path: string): Promise<unknown | null> {
  for (const base of BACKEND_BASES) {
    try {
      const response = await fetch(`${base}${path}`, { method: "GET", cache: "no-store" });
      if (response.ok) return await response.json();
    } catch {
      // try next base
    }
  }
  return null;
}

export type CompactCatalogs = {
  shell: unknown;
  articles: unknown;
  campaigns: unknown;
  errors: string[];
};

export async function loadBenCatalogs(buyer = "Ben"): Promise<CompactCatalogs> {
  const errors: string[] = [];

  const [shell, articles, campaigns] = await Promise.all([
    fetchFromBackend(`/api/campaign-factory/ben-shell-catalog?buyer=${encodeURIComponent(buyer)}`),
    fetchFromBackend(`/api/campaign-factory/ben-article-catalog?buyer=${encodeURIComponent(buyer)}`),
    fetchFromBackend(
      `/api/campaign-factory/ben-campaign-catalog?buyer=${encodeURIComponent(
        buyer
      )}&organization=Interlincx`
    ),
  ]);

  if (!shell) errors.push("Shell preset catalog unavailable");
  if (!articles) errors.push("Article catalog unavailable");
  if (!campaigns) errors.push("Campaign clone catalog unavailable");

  return {
    shell: shell ?? { profiles: [], lockedDefaults: {}, manualFields: [] },
    articles: articles ?? { items: [] },
    campaigns: campaigns ?? { items: [] },
    errors,
  };
}

export function buildSystemPrompt(catalogs: CompactCatalogs, buyer = "Ben"): string {
  const shell = catalogs.shell as {
    profiles?: Array<Record<string, unknown>>;
    lockedDefaults?: Record<string, string>;
    manualFields?: string[];
    scope?: Record<string, number>;
  };
  const articles = catalogs.articles as { items?: Array<Record<string, unknown>> };
  const campaigns = catalogs.campaigns as { items?: Array<Record<string, unknown>> };

  return [
    `You are the ${buyer} Launch Workbench — an interactive assistant that helps ${buyer} build Facebook ad campaign shells from proven templates.`,
    "",
    "WORKFLOW:",
    `1. Help ${buyer} pick a preset profile (by category) OR clone an existing campaign.`,
    `2. Help ${buyer} select an article from the catalog scoped to that category.`,
    "3. Collect: headline, up to 12 forcekeys, budget per ad set ($30 default), optional bid cap, and creative handoff notes.",
    "4. Surface advanced overrides only when asked: redirect domain, Facebook page, ad account.",
    "5. Track readiness against these 5 checks: preset selected, article entered, headline entered, ≥5 forcekeys, creative notes.",
    "6. When ready, generate two JSON shells: a Strategis shell and a Facebook shell. Include them as code blocks the user can copy.",
    "",
    "UX GUIDANCE:",
    "- Use rich generative UI components: cards, forms, selects, badges, progress indicators.",
    "- Show the readiness checklist as a prominent live indicator.",
    "- When the user picks a preset, surface its locked defaults, primary selector, and pixel/page/account hints.",
    "- When cloning a campaign, pre-fill everything from that campaign and explain what is being copied (article, headline, forcekeys, redirect, page, account) and what the user still needs to provide (creatives).",
    "- Be concise. Show data inline rather than dumping JSON unless the user asks.",
    "",
    `SCOPE: ${shell.scope?.strategistCampaigns ?? 0} Strategis campaigns and ${shell.scope?.matchedFacebookAdSets ?? 0} matched Facebook ad sets distilled into ${shell.profiles?.length ?? 0} reusable presets.`,
    "",
    "LOCKED DEFAULTS (always applied):",
    "```json",
    JSON.stringify(shell.lockedDefaults ?? {}, null, 2),
    "```",
    "",
    `MANUAL FIELDS ${buyer} must provide each launch: ${(shell.manualFields ?? []).join(", ")}`,
    "",
    `PRESET PROFILES (${shell.profiles?.length ?? 0}):`,
    "```json",
    JSON.stringify(shell.profiles ?? [], null, 2),
    "```",
    "",
    `ARTICLE CATALOG (${articles.items?.length ?? 0} articles):`,
    "```json",
    JSON.stringify(articles.items ?? [], null, 2),
    "```",
    "",
    `EXISTING ${buyer.toUpperCase()} CAMPAIGNS FOR CLONING (${campaigns.items?.length ?? 0}):`,
    "```json",
    JSON.stringify(campaigns.items ?? [], null, 2),
    "```",
    "",
    catalogs.errors.length > 0
      ? `CATALOG WARNINGS: ${catalogs.errors.join("; ")}. Proceed gracefully and tell the user when something is unavailable.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
