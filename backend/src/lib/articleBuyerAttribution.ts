import { createStrategisApiClient } from './strategistClient';
import {
  extractArticleSlug,
  resolveSystem1RampApiKey,
  System1RampClient,
  type System1RampPrompt,
} from './system1Ramp';
import {
  cleanupRenderedUrl,
  renderIntendedDestinationUrl,
  type StrategisCampaignRecord,
} from './strategisCampaignResolver';

export type ArticleBuyerAttributionQuery = {
  organization?: string | null;
  domain?: string | null;
  articleUrl?: string | null;
  articleSlug?: string | null;
  authToken?: string | null;
  includeSystem1Failed?: boolean | null;
  maxArticlesPerDomain?: number | null;
};

export type ArticleBuyerCampaignMatch = {
  campaignId: string;
  campaignName: string | null;
  buyer: string | null;
  sourceBuyer: string | null;
  domain: string | null;
  articleTitle: string | null;
  articleSlug: string | null;
  publicationLink: string | null;
  intendedUrl: string | null;
  matchedOn: Array<'publication_link' | 'article_slug'>;
};

export type ArticleBuyerAttributionRecord = {
  domain: string;
  publicationLink: string | null;
  articleSlug: string | null;
  topic: string;
  marketingAngle: string;
  status: string;
  promptId: number;
  createdAt: string | null;
  updatedAt: string | null;
  campaignCount: number;
  buyers: string[];
  sourceBuyers: string[];
  hasMultipleBuyers: boolean;
  campaigns: ArticleBuyerCampaignMatch[];
};

function asNonEmptyString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function normalizeDomain(value: unknown): string | null {
  return asNonEmptyString(value)?.toLowerCase() || null;
}

function normalizeUrl(value: unknown): string | null {
  const raw = asNonEmptyString(value);
  if (!raw) return null;
  try {
    const cleaned = cleanupRenderedUrl(raw);
    const url = new URL(cleaned);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function normalizeSlug(value: unknown): string | null {
  const raw = asNonEmptyString(value);
  if (!raw) return null;
  const slug = extractArticleSlug(raw) || raw.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).pop() || raw;
  const normalized = slug.trim().toLowerCase();
  return normalized || null;
}

function looksLikeUrl(value: string | null): boolean {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function dedupeSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => asNonEmptyString(value))
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));
}

function discoverConfiguredRampDomains(): string[] {
  const domains = new Set<string>();

  const jsonValue = process.env.SYSTEM1_RAMP_API_KEYS_JSON;
  if (jsonValue) {
    const parsed = JSON.parse(jsonValue);
    if (parsed && typeof parsed === 'object') {
      for (const key of Object.keys(parsed)) {
        const normalized = normalizeDomain(key);
        if (normalized) domains.add(normalized);
      }
    }
  }

  for (const key of Object.keys(process.env)) {
    const match = key.match(/^SYSTEM1_RAMP_API_KEY_(.+)$/);
    if (!match) continue;
    const suffix = match[1].toLowerCase();
    const domain = suffix.replace(/_/g, '.');
    const normalized = normalizeDomain(domain);
    if (normalized) domains.add(normalized);
  }

  return Array.from(domains).sort((a, b) => a.localeCompare(b));
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

async function listSystem1ArticlesForDomain(
  domain: string,
  opts: {
    includeFailed: boolean;
    maxArticles: number;
  }
): Promise<System1RampPrompt[]> {
  const apiKey = resolveSystem1RampApiKey(domain);
  if (!apiKey) return [];

  const client = new System1RampClient({ apiKey });
  const perPage = 50;
  const pages = Math.max(1, Math.ceil(opts.maxArticles / perPage));
  const collected: System1RampPrompt[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const result = await client.listPrompts(page, perPage);
    const rows = result.prompts.filter((prompt) => {
      if (!opts.includeFailed && prompt.status !== 'success') return false;
      return true;
    });
    collected.push(...rows);
    if (result.pagination.page >= result.pagination.pages) break;
    if (collected.length >= opts.maxArticles) break;
  }

  return collected.slice(0, opts.maxArticles);
}

type NormalizedCampaignArticle = {
  campaignId: string;
  campaignName: string | null;
  buyer: string | null;
  sourceBuyer: string | null;
  domain: string | null;
  articleTitle: string | null;
  articleSlug: string | null;
  publicationLink: string | null;
  intendedUrl: string | null;
};

function normalizeCampaignArticle(campaign: StrategisCampaignRecord): NormalizedCampaignArticle | null {
  const props = campaign.properties || {};
  const intendedUrl = normalizeUrl(renderIntendedDestinationUrl(campaign));
  const publicationLink = normalizeUrl(
    props.rampArticlePublicationLink ||
      props.articleUrl ||
      (looksLikeUrl(asNonEmptyString(props.article)) ? props.article : null)
  );
  const domain =
    normalizeDomain(props.rampArticleDomain) ||
    normalizeDomain(props.domain) ||
    (() => {
      const url = publicationLink || intendedUrl;
      if (!url) return null;
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return null;
      }
    })();
  const articleSlug =
    normalizeSlug(props.articleSlug) ||
    normalizeSlug(publicationLink) ||
    normalizeSlug(intendedUrl);

  if (!publicationLink && !articleSlug) return null;

  return {
    campaignId: String(campaign.id || '').trim(),
    campaignName: asNonEmptyString(campaign.name),
    buyer: asNonEmptyString(props.buyer),
    sourceBuyer: asNonEmptyString(props.sourceBuyer),
    domain,
    articleTitle: asNonEmptyString(props.article),
    articleSlug,
    publicationLink,
    intendedUrl,
  };
}

type JoinedMatch = {
  campaign: NormalizedCampaignArticle;
  matchedOn: Array<'publication_link' | 'article_slug'>;
};

function buildJoinIndex(campaigns: StrategisCampaignRecord[]) {
  const byUrl = new Map<string, JoinedMatch[]>();
  const bySlug = new Map<string, JoinedMatch[]>();

  for (const campaign of campaigns) {
    const normalized = normalizeCampaignArticle(campaign);
    if (!normalized || !normalized.campaignId) continue;
    const base: JoinedMatch = { campaign: normalized, matchedOn: [] };

    if (normalized.publicationLink) {
      const current = byUrl.get(normalized.publicationLink) || [];
      current.push({ ...base, matchedOn: ['publication_link'] });
      byUrl.set(normalized.publicationLink, current);
    }

    if (normalized.domain && normalized.articleSlug) {
      const key = `${normalized.domain}|${normalized.articleSlug}`;
      const current = bySlug.get(key) || [];
      current.push({ ...base, matchedOn: ['article_slug'] });
      bySlug.set(key, current);
    }
  }

  return { byUrl, bySlug };
}

function mergeMatches(matches: JoinedMatch[]): ArticleBuyerCampaignMatch[] {
  const byCampaignId = new Map<string, ArticleBuyerCampaignMatch>();

  for (const match of matches) {
    const existing = byCampaignId.get(match.campaign.campaignId);
    if (existing) {
      existing.matchedOn = dedupeSorted([...existing.matchedOn, ...match.matchedOn]) as Array<'publication_link' | 'article_slug'>;
      continue;
    }
    byCampaignId.set(match.campaign.campaignId, {
      campaignId: match.campaign.campaignId,
      campaignName: match.campaign.campaignName,
      buyer: match.campaign.buyer,
      sourceBuyer: match.campaign.sourceBuyer,
      domain: match.campaign.domain,
      articleTitle: match.campaign.articleTitle,
      articleSlug: match.campaign.articleSlug,
      publicationLink: match.campaign.publicationLink,
      intendedUrl: match.campaign.intendedUrl,
      matchedOn: [...match.matchedOn],
    });
  }

  return Array.from(byCampaignId.values()).sort((a, b) => {
    const buyerOrder = (a.buyer || '').localeCompare(b.buyer || '');
    if (buyerOrder !== 0) return buyerOrder;
    return a.campaignId.localeCompare(b.campaignId);
  });
}

export async function queryArticleBuyerAttribution(
  input: ArticleBuyerAttributionQuery = {}
): Promise<{
  organization: string;
  filters: {
    domain: string | null;
    articleUrl: string | null;
    articleSlug: string | null;
    includeSystem1Failed: boolean;
    maxArticlesPerDomain: number;
  };
  records: ArticleBuyerAttributionRecord[];
}> {
  const organization = input.organization || process.env.STRATEGIS_ORGANIZATION || 'Interlincx';
  const domainFilter = normalizeDomain(input.domain);
  const articleUrlFilter = normalizeUrl(input.articleUrl);
  const articleSlugFilter = normalizeSlug(input.articleSlug);
  const includeSystem1Failed = Boolean(input.includeSystem1Failed);
  const maxArticlesPerDomain = Math.max(1, Math.min(500, Number(input.maxArticlesPerDomain || 100)));

  const configuredDomains = [
    domainFilter,
    ...discoverConfiguredRampDomains(),
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);

  const [campaigns, articleLists] = await Promise.all([
    listStrategisCampaigns(organization, input.authToken || null),
    Promise.all(
      configuredDomains.map((domain) =>
        listSystem1ArticlesForDomain(domain, {
          includeFailed: includeSystem1Failed,
          maxArticles: maxArticlesPerDomain,
        })
      )
    ),
  ]);

  const joinIndex = buildJoinIndex(campaigns);
  const records: ArticleBuyerAttributionRecord[] = [];

  for (const prompts of articleLists) {
    for (const prompt of prompts) {
      const publicationLink = normalizeUrl(prompt.publication_link);
      const articleSlug = normalizeSlug(prompt.publication_link) || normalizeSlug(prompt.topic);
      const domain = normalizeDomain(prompt.domain);
      if (!domain) continue;
      if (domainFilter && domain !== domainFilter) continue;
      if (articleUrlFilter && publicationLink !== articleUrlFilter) continue;
      if (articleSlugFilter && articleSlug !== articleSlugFilter) continue;

      const matches: JoinedMatch[] = [];
      if (publicationLink) {
        matches.push(...(joinIndex.byUrl.get(publicationLink) || []));
      }
      if (articleSlug) {
        matches.push(...(joinIndex.bySlug.get(`${domain}|${articleSlug}`) || []));
      }

      const campaignsForArticle = mergeMatches(matches);
      const buyers = dedupeSorted(campaignsForArticle.map((campaign) => campaign.buyer));
      const sourceBuyers = dedupeSorted(campaignsForArticle.map((campaign) => campaign.sourceBuyer));

      records.push({
        domain,
        publicationLink,
        articleSlug,
        topic: prompt.topic,
        marketingAngle: prompt.marketing_angle,
        status: String(prompt.status || ''),
        promptId: prompt.id,
        createdAt: prompt.created_at,
        updatedAt: prompt.updated_at,
        campaignCount: campaignsForArticle.length,
        buyers,
        sourceBuyers,
        hasMultipleBuyers: buyers.length > 1,
        campaigns: campaignsForArticle,
      });
    }
  }

  records.sort((a, b) => {
    const multiBuyerOrder = Number(b.hasMultipleBuyers) - Number(a.hasMultipleBuyers);
    if (multiBuyerOrder !== 0) return multiBuyerOrder;
    const matchedOrder = b.campaignCount - a.campaignCount;
    if (matchedOrder !== 0) return matchedOrder;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  return {
    organization,
    filters: {
      domain: domainFilter,
      articleUrl: articleUrlFilter,
      articleSlug: articleSlugFilter,
      includeSystem1Failed,
      maxArticlesPerDomain,
    },
    records,
  };
}
