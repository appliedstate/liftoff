import fs from 'fs';
import path from 'path';
import { CampaignShellExportRow } from './campaignShellProfiles';

export type BenArticleCatalogItem = {
  articleKey: string;
  articleSlug: string | null;
  articleUrl: string | null;
  articlePath: string | null;
  category: string;
  label: string;
  domain: string | null;
  rsocSite: string | null;
  subdirectory: string | null;
  campaignCount: number;
  campaignIds: string[];
  campaignNames: string[];
  headlineHints: string[];
  buyers: string[];
  source: 'strategist_campaigns';
  readyState: 'configured';
};

export type BenArticleCatalog = {
  scope: {
    buyer: string;
    campaignsAnalyzed: number;
    articles: number;
  };
  generatedAt: string;
  items: BenArticleCatalogItem[];
  notes: string[];
};

function normalizedBuyerSlug(buyer: string): string {
  return buyer.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function asNonEmptyString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function slugifyPath(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function normalizeSlug(value: string | null): string | null {
  if (!value) return null;
  const slug = slugifyPath(value).split('/').filter(Boolean).pop() || value;
  return slug.toLowerCase() || null;
}

function titleizeSlug(slug: string | null): string {
  if (!slug) return 'Untitled article';
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function deriveArticleUrl(props: Record<string, any>): string | null {
  const direct =
    asNonEmptyString(props.rampArticlePublicationLink) ||
    asNonEmptyString(props.articleUrl) ||
    (() => {
      const article = asNonEmptyString(props.article);
      return article && /^https?:\/\//i.test(article) ? article : null;
    })();
  if (direct) return normalizeUrl(direct);

  const rsocSite = asNonEmptyString(props.rsocSite);
  const article = asNonEmptyString(props.article);
  if (!rsocSite || !article) return null;

  const subdirectory = asNonEmptyString(props.subdirectory);
  const site = rsocSite.replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
  const articlePath = slugifyPath(article);
  const rendered = subdirectory
    ? `https://${site}/${slugifyPath(subdirectory)}/${articlePath}`
    : `https://${site}/${articlePath}`;
  return normalizeUrl(rendered);
}

function deriveArticlePath(props: Record<string, any>): string | null {
  const articleUrl = deriveArticleUrl(props);
  if (articleUrl) {
    try {
      const url = new URL(articleUrl);
      return url.pathname.replace(/^\/+|\/+$/g, '') || null;
    } catch {
      return null;
    }
  }
  const article = asNonEmptyString(props.article);
  return article ? slugifyPath(article) : null;
}

function normalizeCategory(value: unknown): string {
  return asNonEmptyString(value) || 'Uncategorized';
}

function dedupe(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => asNonEmptyString(value))
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function buildBenArticleCatalog(rows: CampaignShellExportRow[], buyer = 'Ben'): BenArticleCatalog {
  const normalizedBuyer = buyer.trim().toLowerCase();
  const validRows = rows
    .filter((row) => row.status === 200 && row.body?.raw)
    .map((row) => row.body!.raw)
    .filter((raw) => String(raw?.properties?.buyer || '').trim().toLowerCase() === normalizedBuyer);

  const grouped = new Map<string, BenArticleCatalogItem>();

  for (const raw of validRows) {
    const props = raw.properties || {};
    const articleUrl = deriveArticleUrl(props);
    const articlePath = deriveArticlePath(props);
    const articleSlug = normalizeSlug(asNonEmptyString(props.article) || articlePath);
    const articleKey = articleUrl || `${asNonEmptyString(props.rsocSite) || 'unknown-site'}|${articleSlug || articlePath || raw.id}`;
    const headline = asNonEmptyString(props.headline);
    const category = normalizeCategory(raw.category);
    const rsocSite = asNonEmptyString(props.rsocSite);
    const subdirectory = asNonEmptyString(props.subdirectory);
    const label = headline || titleizeSlug(articleSlug) || raw.name || raw.id;
    const domain = rsocSite?.replace(/^https?:\/\//i, '').replace(/\/+$/g, '') || null;

    const existing = grouped.get(articleKey);
    if (existing) {
      existing.campaignCount += 1;
      existing.campaignIds = dedupe([...existing.campaignIds, raw.id]);
      existing.campaignNames = dedupe([...existing.campaignNames, raw.name]);
      existing.headlineHints = dedupe([...existing.headlineHints, headline]);
      existing.buyers = dedupe([...existing.buyers, props.buyer]);
      continue;
    }

    grouped.set(articleKey, {
      articleKey,
      articleSlug,
      articleUrl,
      articlePath,
      category,
      label,
      domain,
      rsocSite,
      subdirectory,
      campaignCount: 1,
      campaignIds: dedupe([raw.id]),
      campaignNames: dedupe([raw.name]),
      headlineHints: dedupe([headline]),
      buyers: dedupe([props.buyer]),
      source: 'strategist_campaigns',
      readyState: 'configured',
    });
  }

  const items = Array.from(grouped.values()).sort((a, b) => {
    const categoryOrder = a.category.localeCompare(b.category);
    if (categoryOrder !== 0) return categoryOrder;
    const volumeOrder = b.campaignCount - a.campaignCount;
    if (volumeOrder !== 0) return volumeOrder;
    return a.label.localeCompare(b.label);
  });

  return {
    scope: {
      buyer,
      campaignsAnalyzed: validRows.length,
      articles: items.length,
    },
    generatedAt: new Date().toISOString(),
    items,
    notes: [
      `This catalog is currently built from ${buyer}-owned Strategis campaign records.`,
      'When RAMP attribution is available, publication status and direct publication links can be merged into the same article keys.',
    ],
  };
}

export function findCampaignDetailsSnapshot(buyer = 'Ben'): string | null {
  const buyerSlug = normalizedBuyerSlug(buyer);
  const candidates = [
    `/tmp/strategis/${buyerSlug}_campaign_details_full_live.json`,
    path.join(process.cwd(), '.local', 'strategis', `${buyerSlug}_campaign_details_full_live.json`),
    '/tmp/strategis/ben_campaign_details_full_live.json',
    path.join(process.cwd(), '.local', 'strategis', 'ben_campaign_details_full_live.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function findBenCampaignDetailsSnapshot(): string | null {
  return findCampaignDetailsSnapshot('Ben');
}

export function loadBenArticleCatalogFromSnapshot(buyer = 'Ben'): BenArticleCatalog {
  const snapshotPath = findCampaignDetailsSnapshot(buyer);
  if (!snapshotPath) {
    throw new Error(`${buyer} campaign details snapshot is not available`);
  }
  const rows = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as CampaignShellExportRow[];
  return buildBenArticleCatalog(rows, buyer);
}

export function writeBenArticleCatalog(outputDir: string, catalog: BenArticleCatalog) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'catalog.json'), JSON.stringify(catalog, null, 2));
}
