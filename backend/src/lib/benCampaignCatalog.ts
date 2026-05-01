import fs from 'fs';
import path from 'path';
import { CampaignShellExportRow } from './campaignShellProfiles';
import { findCampaignDetailsSnapshot } from './benArticleCatalog';
import { createStrategisApiClient } from './strategistClient';
import { StrategisCampaignRecord } from './strategisCampaignResolver';

const FORCEKEY_SLOTS = [
  'forcekeyA',
  'forcekeyB',
  'forcekeyC',
  'forcekeyD',
  'forcekeyE',
  'forcekeyF',
  'forcekeyG',
  'forcekeyH',
  'forcekeyI',
  'forcekeyJ',
  'forcekeyK',
  'forcekeyL',
] as const;

type CloneSelectorTargeting = {
  ageMin: number | null;
  ageMax: number | null;
  countries: string[];
  locationTypes: string[];
  publisherPlatforms: string[];
  facebookPositions: string[];
  instagramPositions: string[];
  advantageAudience: number | null;
};

type CloneSelector = {
  optimizationGoal: string;
  billingEvent: string;
  bidStrategy: string;
  bidAmount: string | number;
  promotedObject: {
    pixelId: string;
    event: string;
  };
  targeting: CloneSelectorTargeting;
};

export type BenCampaignCatalogItem = {
  campaignId: string;
  campaignName: string;
  category: string;
  buyer: string | null;
  label: string;
  article: string | null;
  articleSlug: string | null;
  articleUrl: string | null;
  articlePath: string | null;
  headline: string | null;
  forcekeys: string[];
  forcekeyMap: Record<string, string>;
  rsocSite: string | null;
  subdirectory: string | null;
  templateId: string | null;
  redirectDomain: string | null;
  fbAdAccount: string | null;
  networkAccountId: string | null;
  fbPage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  facebook: {
    adAccountId: string | null;
    pageId: string | null;
    facebookCampaignId: string | null;
    cloneSelector: CloneSelector | null;
    budgetAmount: string | null;
    bidCap: string | null;
  };
  source: 'live_strategis' | 'snapshot';
  cloneReadyState: 'exact_shell' | 'partial_shell';
  notes: string[];
};

export type BenCampaignCatalog = {
  scope: {
    buyer: string;
    organization: string;
    campaigns: number;
  };
  generatedAt: string;
  items: BenCampaignCatalogItem[];
  notes: string[];
};

type CampaignGraphDetail = {
  strategisCampaignId: string;
  facebookCampaignId?: string | null;
  adAccountId?: string | null;
  pageIds?: string[] | null;
};

function asNonEmptyString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function asString(value: unknown): string {
  return String(value || '').trim();
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

function slugifyPath(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function normalizeSlug(value: string | null): string | null {
  if (!value) return null;
  const slug = slugifyPath(value).split('/').filter(Boolean).pop() || value;
  return slug.toLowerCase() || null;
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

function parseJsonObject(value: unknown): Record<string, any> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  const raw = asNonEmptyString(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
  } catch {
    return null;
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => asString(entry)).filter(Boolean);
  }
  return [];
}

function buildCloneSelector(props: Record<string, any>): CloneSelector | null {
  const targeting = parseJsonObject(props.targeting);
  const promotedObject =
    parseJsonObject(props.promotedObject) ||
    parseJsonObject(props['promotedObject']) ||
    {
      pixelId:
        asNonEmptyString(props['promotedObject.pixelId']) ||
        asNonEmptyString(props.pixelId) ||
        asNonEmptyString(props.facebookPixelId) ||
        '',
      event:
        asNonEmptyString(props['promotedObject.customEventType']) ||
        asNonEmptyString(props.customEventType) ||
        'LEAD',
    };

  const optimizationGoal = asNonEmptyString(props.optimizationGoal);
  const billingEvent = asNonEmptyString(props.billingEvent);
  const bidStrategy = asNonEmptyString(props.bidStrategy);
  const bidAmount = asNonEmptyString(props.bidAmount) || asNonEmptyString(props.dailyBidCap) || '';
  const pixelId = asNonEmptyString(promotedObject?.pixelId);
  const event = asNonEmptyString(promotedObject?.event || promotedObject?.customEventType) || 'LEAD';

  const hasSignal = Boolean(targeting || optimizationGoal || billingEvent || bidStrategy || pixelId);
  if (!hasSignal) return null;

  return {
    optimizationGoal: optimizationGoal || 'OFFSITE_CONVERSIONS',
    billingEvent: billingEvent || 'IMPRESSIONS',
    bidStrategy: bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
    bidAmount,
    promotedObject: {
      pixelId: pixelId || '',
      event,
    },
    targeting: {
      ageMin: Number.isFinite(Number(targeting?.ageMin)) ? Number(targeting?.ageMin) : null,
      ageMax: Number.isFinite(Number(targeting?.ageMax)) ? Number(targeting?.ageMax) : null,
      countries: toStringArray(targeting?.countries),
      locationTypes: toStringArray(targeting?.locationTypes),
      publisherPlatforms: toStringArray(targeting?.publisherPlatforms),
      facebookPositions: toStringArray(targeting?.facebookPositions),
      instagramPositions: toStringArray(targeting?.instagramPositions),
      advantageAudience:
        targeting?.advantageAudience === 0 || targeting?.advantageAudience === 1
          ? Number(targeting.advantageAudience)
          : null,
    },
  };
}

function loadCampaignGraphIndex(): Map<string, CampaignGraphDetail> {
  const graphPath = path.join(
    process.cwd(),
    '.local',
    'strategis',
    'facebook',
    'campaign-graph',
    'campaign-details.json'
  );
  const index = new Map<string, CampaignGraphDetail>();
  if (!fs.existsSync(graphPath)) return index;
  const rows = JSON.parse(fs.readFileSync(graphPath, 'utf8')) as CampaignGraphDetail[];
  for (const row of rows) {
    if (!row?.strategisCampaignId) continue;
    index.set(String(row.strategisCampaignId), row);
  }
  return index;
}

function toCampaignRecordArray(payload: any): StrategisCampaignRecord[] {
  if (Array.isArray(payload)) return payload as StrategisCampaignRecord[];
  if (Array.isArray(payload?.data)) return payload.data as StrategisCampaignRecord[];
  if (Array.isArray(payload?.items)) return payload.items as StrategisCampaignRecord[];
  return [];
}

async function listStrategisCampaigns(
  organization: string,
  authToken?: string | null
): Promise<StrategisCampaignRecord[]> {
  const client = createStrategisApiClient({ authToken: authToken || undefined });
  const payload = await client.get('/api/campaigns', { organization });
  return toCampaignRecordArray(payload);
}

function loadCampaignsFromSnapshot(): StrategisCampaignRecord[] {
  const snapshotPath = findCampaignDetailsSnapshot('Ben');
  if (!snapshotPath) {
    throw new Error('Ben campaign details snapshot is not available');
  }
  const rows = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as CampaignShellExportRow[];
  return rows
    .filter((row) => row.status === 200 && row.body?.raw)
    .map((row) => row.body!.raw as StrategisCampaignRecord);
}

export function buildBenCampaignCatalog(args: {
  campaigns: StrategisCampaignRecord[];
  buyer?: string;
  organization?: string;
  source: 'live_strategis' | 'snapshot';
}): BenCampaignCatalog {
  const buyer = (args.buyer || 'Ben').trim();
  const normalizedBuyer = buyer.toLowerCase();
  const graphIndex = loadCampaignGraphIndex();

  const items = args.campaigns
    .filter((campaign) => String(campaign?.properties?.buyer || '').trim().toLowerCase() === normalizedBuyer)
    .map((campaign) => {
      const props = campaign.properties || {};
      const graph = graphIndex.get(String(campaign.id)) || null;
      const article = asNonEmptyString(props.article);
      const articleUrl = deriveArticleUrl(props);
      const articlePath = deriveArticlePath(props);
      const articleSlug = normalizeSlug(article || articlePath);
      const forcekeys = FORCEKEY_SLOTS.map((slot) => asNonEmptyString(props[slot])).filter(
        (value): value is string => Boolean(value)
      );
      const forcekeyMap = Object.fromEntries(
        FORCEKEY_SLOTS.map((slot) => [slot, asNonEmptyString(props[slot]) || '']).filter(([, value]) => Boolean(value))
      );
      const category = normalizeCategory(campaign.category);
      const headline = asNonEmptyString(props.headline);
      const campaignName = asNonEmptyString(campaign.name) || String(campaign.id);
      const pageId =
        asNonEmptyString(props.fbPage) ||
        asNonEmptyString(props.facebookPage) ||
        graph?.pageIds?.[0] ||
        null;
      const adAccountId =
        asNonEmptyString(props.networkAccountId) ||
        asNonEmptyString(props.fbAdAccount) ||
        asNonEmptyString(graph?.adAccountId) ||
        null;
      const cloneSelector = buildCloneSelector(props);
      const notes: string[] = [];
      if (!cloneSelector) {
        notes.push('Facebook targeting was not available on the Strategis campaign record, so selector defaults may still come from the category preset.');
      }
      if (!pageId && graph?.pageIds?.length) {
        notes.push('Page ID was inferred from the campaign graph because the Strategis shell did not persist fbPage.');
      }
      if (!forcekeys.length) {
        notes.push('No forcekeys were present on this Strategis campaign record.');
      }

      return {
        campaignId: String(campaign.id),
        campaignName,
        category,
        buyer: asNonEmptyString(props.buyer),
        label: `${campaignName} · ${category.split(' > ').slice(-1)[0] || category}`,
        article,
        articleSlug,
        articleUrl,
        articlePath,
        headline,
        forcekeys,
        forcekeyMap,
        rsocSite: asNonEmptyString(props.rsocSite),
        subdirectory: asNonEmptyString(props.subdirectory),
        templateId: asNonEmptyString(campaign.template?.id),
        redirectDomain: asNonEmptyString(campaign.redirectDomain),
        fbAdAccount: asNonEmptyString(props.fbAdAccount),
        networkAccountId: asNonEmptyString(props.networkAccountId),
        fbPage: asNonEmptyString(props.fbPage) || asNonEmptyString(props.facebookPage),
        createdAt: asNonEmptyString((campaign as any).created_at),
        updatedAt: asNonEmptyString((campaign as any).updated_at),
        facebook: {
          adAccountId,
          pageId,
          facebookCampaignId: asNonEmptyString(props.fbCampaignId) || asNonEmptyString(graph?.facebookCampaignId),
          cloneSelector,
          budgetAmount: asNonEmptyString(props.dailyBudget),
          bidCap:
            asNonEmptyString(props.bidAmount) ||
            asNonEmptyString(props.dailyBidCap) ||
            null,
        },
        source: args.source,
        cloneReadyState: cloneSelector ? 'exact_shell' : 'partial_shell',
        notes,
      } satisfies BenCampaignCatalogItem;
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.campaignName.localeCompare(b.campaignName));

  return {
    scope: {
      buyer,
      organization: args.organization || 'Interlincx',
      campaigns: items.length,
    },
    generatedAt: new Date().toISOString(),
    items,
    notes: [
      `Campaign clone is sourced from ${buyer}-owned Strategis campaign records and mapped to Facebook campaign graph metadata when available.`,
      'Cloning duplicates shell fields and leaves ads / creatives out of scope by design.',
    ],
  };
}

export function generatedBenCampaignCatalogPath(buyer = 'Ben'): string {
  return path.join(
    process.cwd(),
    '.local',
    'strategis',
    'ben-campaign-catalog',
    `${buyer.toLowerCase()}-live`,
    'catalog.json'
  );
}

export function loadGeneratedBenCampaignCatalog(buyer = 'Ben'): BenCampaignCatalog | null {
  const filePath = generatedBenCampaignCatalogPath(buyer);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as BenCampaignCatalog;
}

export async function loadBenCampaignCatalog(args: {
  buyer?: string;
  organization?: string;
  authToken?: string | null;
} = {}): Promise<BenCampaignCatalog> {
  const buyer = args.buyer || 'Ben';
  const organization = args.organization || 'Interlincx';

  try {
    const campaigns = await listStrategisCampaigns(organization, args.authToken);
    return buildBenCampaignCatalog({
      campaigns,
      buyer,
      organization,
      source: 'live_strategis',
    });
  } catch (liveError) {
    const generated = loadGeneratedBenCampaignCatalog(buyer);
    if (generated) return generated;
    try {
      const snapshotPath = findCampaignDetailsSnapshot(buyer);
      if (!snapshotPath) {
        throw new Error(`${buyer} campaign details snapshot is not available`);
      }
      const rows = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as CampaignShellExportRow[];
      const campaigns = rows
        .filter((row) => row.status === 200 && row.body?.raw)
        .map((row) => row.body!.raw as StrategisCampaignRecord);
      return buildBenCampaignCatalog({
        campaigns,
        buyer,
        organization,
        source: 'snapshot',
      });
    } catch (snapshotError) {
      throw new Error(
        `Unable to load ${buyer} campaign catalog from live Strategis or local snapshot. ` +
          `Live error: ${liveError instanceof Error ? liveError.message : String(liveError)}. ` +
          `Snapshot error: ${snapshotError instanceof Error ? snapshotError.message : String(snapshotError)}.`
      );
    }
  }
}

export function writeBenCampaignCatalog(outputDir: string, catalog: BenCampaignCatalog) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'catalog.json'), JSON.stringify(catalog, null, 2));
}
