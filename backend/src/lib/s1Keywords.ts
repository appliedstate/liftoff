import fs from 'fs';
import path from 'path';
import { StrategisApi } from './strategisApi';
import { ensureDir, readJson, writeJson } from './state';
import { getPlatformFromNetworkId } from './networkIds';

export type S1KeywordQuery = {
  start: string;
  end: string;
  minClicks?: number;
  rolled?: boolean;
  useTemplate?: boolean;
  hydrateMissing?: boolean;
  forceRefresh?: boolean;
  network?: string | null;
  category?: string | null;
  state?: string | null;
  limit?: number | null;
};

export type RolledKeywordRow = {
  network_name: string | null;
  normalized_category: string | null;
  state: string | null;
  keyword: string;
  clicks: number;
  widget_searches: number;
  searches: number;
  estimated_revenue: number;
  rpc: number;
  rps: number;
  ctr: number;
  campaigns_tracked: number;
  campaigns_in_settings: number | null;
  s1_rpc: number | null;
  s1_g_rank: number | null;
  s1_n_rank: number | null;
  s1_c_rank: number | null;
  buyers: string[];
  rsoc_sites: string[];
};

type UpstreamKeywordRow = Record<string, any>;

type CachedKeywordDay = {
  date: string;
  fetchedAt: string;
  params: {
    organization: string;
    networkId: string;
    adSource: string;
  };
  rows: UpstreamKeywordRow[];
};

type CachedCampaignMetadataDay = {
  date: string;
  fetchedAt: string;
  rows: Array<{
    strategisCampaignId: string;
    buyer: string | null;
    category: string | null;
    rsocSite: string | null;
    networkId: string | null;
  }>;
};

function asString(value: any): string {
  return String(value ?? '').trim();
}

function keywordCacheBase(): string {
  return path.join(process.cwd(), '.local', 'strategis', 's1', 'keywords');
}

function dayRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (cursor <= stop) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function rawKeywordPath(date: string): string {
  return path.join(keywordCacheBase(), 'raw', `${date}.json`);
}

function rawDesktopKeywordPath(date: string): string {
  return path.join(keywordCacheBase(), 'desktop', `${date}.json`);
}

function campaignMetadataPath(date: string): string {
  return path.join(keywordCacheBase(), 'campaign-meta', `${date}.json`);
}

function asNullableString(value: any): string | null {
  const out = asString(value);
  return out ? out : null;
}

function asNumber(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function asNullableNumber(value: any): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeKey(value: string | null): string {
  return asString(value).toLowerCase();
}

function detectKeyword(row: UpstreamKeywordRow): string {
  return (
    asString(row.keyword) ||
    asString(row.serp_keyword) ||
    asString(row.serpKeyword) ||
    asString(row.searchTerm)
  );
}

function detectCategory(row: UpstreamKeywordRow): string | null {
  return (
    asNullableString(row.normalized_category) ||
    asNullableString(row.category) ||
    asNullableString(row.normalizedCategory) ||
    asNullableString(row.catGroup)
  );
}

function detectNetworkName(row: UpstreamKeywordRow): string | null {
  return (
    asNullableString(row.network_name) ||
    asNullableString(row.networkName) ||
    asNullableString(row.network) ||
    asNullableString(row.platform)
  );
}

function toDisplayNetworkName(value: string | null): string | null {
  const key = normalizeKey(value);
  if (!key) return null;
  if (key === 'facebook') return 'Facebook';
  if (key === 'googleads') return 'Google Ads';
  if (key === 'newsbreak') return 'NewsBreak';
  return value;
}

function detectState(row: UpstreamKeywordRow): string | null {
  return (
    asNullableString(row.state) ||
    asNullableString(row.region_code) ||
    asNullableString(row.regionCode) ||
    asNullableString(row.us_state) ||
    asNullableString(row.state_code)
  );
}

function detectBuyer(row: UpstreamKeywordRow): string | null {
  return asNullableString(row.buyer);
}

function detectRsocSite(row: UpstreamKeywordRow): string | null {
  return (
    asNullableString(row.rsocSite) ||
    asNullableString(row.rsoc_site) ||
    asNullableString(row.domain)
  );
}

function detectCampaignId(row: UpstreamKeywordRow): string | null {
  return (
    asNullableString(row.strategisCampaignId) ||
    asNullableString(row.campaignId) ||
    asNullableString(row.subId)
  );
}

function normalizeTemplateKeyword(keyword: string): string {
  let out = keyword.trim();
  out = out.replace(/\{[^}]+\}/g, (match) => match.toLowerCase());
  out = out.replace(/\s+/g, ' ');
  return out;
}

function chooseDominant(map: Map<string, number>): string | null {
  let best: string | null = null;
  let bestValue = -Infinity;
  for (const [key, value] of map.entries()) {
    if (value > bestValue) {
      best = key;
      bestValue = value;
    }
  }
  return best;
}

function mergeWeightedAverage(current: { numerator: number; denominator: number }, value: number | null, weight: number) {
  if (value == null || !Number.isFinite(value) || weight <= 0) return;
  current.numerator += value * weight;
  current.denominator += weight;
}

async function hydrateKeywordDay(api: StrategisApi, date: string, forceRefresh: boolean) {
  const filePath = rawKeywordPath(date);
  if (!forceRefresh && fs.existsSync(filePath)) {
    return readJson<CachedKeywordDay>(filePath, { date, fetchedAt: '', params: { organization: '', networkId: '', adSource: '' }, rows: [] });
  }
  const rows = await api.fetchS1KeywordReport(date, date);
  const payload: CachedKeywordDay = {
    date,
    fetchedAt: new Date().toISOString(),
    params: {
      organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
      networkId: process.env.STRATEGIS_NETWORK_ID || '112',
      adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
    },
    rows,
  };
  writeJson(filePath, payload);
  return payload;
}

async function hydrateDesktopKeywordDay(api: StrategisApi, date: string, forceRefresh: boolean) {
  const filePath = rawDesktopKeywordPath(date);
  if (!forceRefresh && fs.existsSync(filePath)) {
    return readJson<CachedKeywordDay>(filePath, { date, fetchedAt: '', params: { organization: '', networkId: '', adSource: '' }, rows: [] });
  }
  const rows = await api.fetchS1DesktopKeywordReport(date, date);
  const payload: CachedKeywordDay = {
    date,
    fetchedAt: new Date().toISOString(),
    params: {
      organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
      networkId: process.env.STRATEGIS_NETWORK_ID || '112',
      adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
    },
    rows,
  };
  writeJson(filePath, payload);
  return payload;
}

async function hydrateCampaignMetadataDay(api: StrategisApi, date: string, forceRefresh: boolean) {
  const filePath = campaignMetadataPath(date);
  if (!forceRefresh && fs.existsSync(filePath)) {
    return readJson<CachedCampaignMetadataDay>(filePath, { date, fetchedAt: '', rows: [] });
  }
  const rows = await api.fetchS1Daily(date, false);
  const payload: CachedCampaignMetadataDay = {
    date,
    fetchedAt: new Date().toISOString(),
    rows: rows.map((row) => ({
      strategisCampaignId: asString(row.strategisCampaignId || row.campaignId),
      buyer: asNullableString(row.buyer),
      category: asNullableString(row.category),
      rsocSite: asNullableString(row.rsocSite),
      networkId: asNullableString(row.networkId),
    })).filter((row) => row.strategisCampaignId),
  };
  writeJson(filePath, payload);
  return payload;
}

export async function warmS1KeywordCache(
  start: string,
  end: string,
  opts: { forceRefresh?: boolean; includeDesktop?: boolean; api?: StrategisApi } = {}
) {
  ensureDir(path.join(keywordCacheBase(), 'raw'));
  ensureDir(path.join(keywordCacheBase(), 'desktop'));
  ensureDir(path.join(keywordCacheBase(), 'campaign-meta'));
  const api = opts.api || new StrategisApi();
  const dates = dayRange(start, end);
  const result = {
    dates,
    fetched: [] as string[],
    cached: [] as string[],
    failed: [] as Array<{ date: string; error: string }>,
  };

  for (const date of dates) {
    try {
      const alreadyCached = fs.existsSync(rawKeywordPath(date));
      await hydrateKeywordDay(api, date, Boolean(opts.forceRefresh));
      if (opts.includeDesktop !== false) {
        await hydrateDesktopKeywordDay(api, date, Boolean(opts.forceRefresh));
      }
      await hydrateCampaignMetadataDay(api, date, Boolean(opts.forceRefresh));
      if (alreadyCached && !opts.forceRefresh) result.cached.push(date);
      else result.fetched.push(date);
    } catch (err: any) {
      result.failed.push({ date, error: err?.message || 'Unknown error' });
    }
  }

  return result;
}

export async function fetchRolledKeywords(query: S1KeywordQuery, api: StrategisApi = new StrategisApi()) {
  const minClicks = Math.max(0, Number(query.minClicks ?? 1));
  const rolled = query.rolled !== false;
  const useTemplate = query.useTemplate !== false;
  const hydrateMissing = query.hydrateMissing !== false;
  const forceRefresh = Boolean(query.forceRefresh);
  const networkFilter = normalizeKey(query.network || null);
  const categoryFilter = normalizeKey(query.category || null);
  const stateFilter = normalizeKey(query.state || null);
  const limit = query.limit != null ? Math.max(1, Number(query.limit)) : null;

  const dates = dayRange(query.start, query.end);
  if (hydrateMissing) {
    await warmS1KeywordCache(query.start, query.end, {
      forceRefresh,
      includeDesktop: true,
      api,
    });
  }

  const keywordRows: UpstreamKeywordRow[] = [];
  const desktopRows: UpstreamKeywordRow[] = [];
  const campaignMetaByDate = new Map<string, Map<string, { buyer: string | null; category: string | null; rsocSite: string | null; networkId: string | null }>>();
  for (const date of dates) {
    const rawPath = rawKeywordPath(date);
    if (fs.existsSync(rawPath)) {
      const payload = readJson<CachedKeywordDay>(rawPath, { date, fetchedAt: '', params: { organization: '', networkId: '', adSource: '' }, rows: [] });
      keywordRows.push(...(Array.isArray(payload.rows) ? payload.rows : []));
    }
    const desktopPath = rawDesktopKeywordPath(date);
    if (fs.existsSync(desktopPath)) {
      const payload = readJson<CachedKeywordDay>(desktopPath, { date, fetchedAt: '', params: { organization: '', networkId: '', adSource: '' }, rows: [] });
      desktopRows.push(...(Array.isArray(payload.rows) ? payload.rows : []));
    }
    const metaPath = campaignMetadataPath(date);
    if (fs.existsSync(metaPath)) {
      const payload = readJson<CachedCampaignMetadataDay>(metaPath, { date, fetchedAt: '', rows: [] });
      const perCampaign = new Map<string, { buyer: string | null; category: string | null; rsocSite: string | null; networkId: string | null }>();
      for (const row of payload.rows || []) {
        perCampaign.set(row.strategisCampaignId, {
          buyer: row.buyer,
          category: row.category,
          rsocSite: row.rsocSite,
          networkId: row.networkId,
        });
      }
      campaignMetaByDate.set(date, perCampaign);
    }
  }

  const desktopRpcByKeyword = new Map<string, { numerator: number; denominator: number }>();
  for (const row of desktopRows) {
    const keyword = detectKeyword(row);
    if (!keyword) continue;
    const key = normalizeKey(useTemplate ? normalizeTemplateKeyword(keyword) : keyword);
    if (!desktopRpcByKeyword.has(key)) {
      desktopRpcByKeyword.set(key, { numerator: 0, denominator: 0 });
    }
    const acc = desktopRpcByKeyword.get(key)!;
    mergeWeightedAverage(acc, asNullableNumber(row.rpc), Math.max(1, asNumber(row.clicks)));
  }

  if (!rolled) {
    const rows = keywordRows
      .map((row): RolledKeywordRow | null => {
        const keyword = detectKeyword(row);
        if (!keyword) return null;
        const clicks = asNumber(row.clicks);
        const widgetSearches = asNumber(row.widgetSearches ?? row.widget_searches);
        const searches = asNumber(row.searches);
        const estimatedRevenue = asNumber(row.estimated_revenue ?? row.revenue);
        const key = normalizeKey(useTemplate ? normalizeTemplateKeyword(keyword) : keyword);
        const desktopAcc = desktopRpcByKeyword.get(key);
        const date = asString(row.date);
        const campaignId = detectCampaignId(row);
        const campaignMeta = date && campaignId ? campaignMetaByDate.get(date)?.get(campaignId) : null;
        return {
          network_name: toDisplayNetworkName(detectNetworkName(row) || getPlatformFromNetworkId(campaignMeta?.networkId || row.networkId)),
          normalized_category: detectCategory(row) || campaignMeta?.category || null,
          state: detectState(row),
          keyword: useTemplate ? normalizeTemplateKeyword(keyword) : keyword,
          clicks,
          widget_searches: widgetSearches,
          searches,
          estimated_revenue: estimatedRevenue,
          rpc: clicks > 0 ? estimatedRevenue / clicks : 0,
          rps: searches > 0 ? estimatedRevenue / searches : 0,
          ctr: widgetSearches > 0 ? clicks / widgetSearches : searches > 0 ? clicks / searches : 0,
          campaigns_tracked: detectCampaignId(row) ? 1 : 0,
          campaigns_in_settings: null,
          s1_rpc: desktopAcc && desktopAcc.denominator > 0 ? desktopAcc.numerator / desktopAcc.denominator : null,
          s1_g_rank: null,
          s1_n_rank: null,
          s1_c_rank: null,
          buyers: detectBuyer(row) ? [detectBuyer(row)!] : campaignMeta?.buyer ? [campaignMeta.buyer] : [],
          rsoc_sites: detectRsocSite(row) ? [detectRsocSite(row)!] : campaignMeta?.rsocSite ? [campaignMeta.rsocSite] : [],
        } satisfies RolledKeywordRow;
      })
      .filter((row): row is RolledKeywordRow => row !== null)
      .filter((row) => row.clicks >= minClicks)
      .filter((row) => !networkFilter || normalizeKey(row.network_name) === networkFilter)
      .filter((row) => !categoryFilter || normalizeKey(row.normalized_category).includes(categoryFilter))
      .filter((row) => !stateFilter || normalizeKey(row.state) === stateFilter)
      .sort((a, b) => b.estimated_revenue - a.estimated_revenue);

    return limit ? rows.slice(0, limit) : rows;
  }

  const grouped = new Map<
    string,
    {
      keyword: string;
      clicks: number;
      widgetSearches: number;
      searches: number;
      estimatedRevenue: number;
      networkRevenue: Map<string, number>;
      categoryRevenue: Map<string, number>;
      stateRevenue: Map<string, number>;
      buyers: Set<string>;
      rsocSites: Set<string>;
      campaignIds: Set<string>;
      s1Rpc: { numerator: number; denominator: number };
    }
  >();

  for (const row of keywordRows) {
    const rawKeyword = detectKeyword(row);
    if (!rawKeyword) continue;
    const keyword = useTemplate ? normalizeTemplateKeyword(rawKeyword) : rawKeyword.trim();
    const key = normalizeKey(keyword);
    if (!grouped.has(key)) {
      grouped.set(key, {
        keyword,
        clicks: 0,
        widgetSearches: 0,
        searches: 0,
        estimatedRevenue: 0,
        networkRevenue: new Map<string, number>(),
        categoryRevenue: new Map<string, number>(),
        stateRevenue: new Map<string, number>(),
        buyers: new Set<string>(),
        rsocSites: new Set<string>(),
        campaignIds: new Set<string>(),
        s1Rpc: { numerator: 0, denominator: 0 },
      });
    }

    const aggregate = grouped.get(key)!;
    const clicks = asNumber(row.clicks);
    const widgetSearches = asNumber(row.widgetSearches ?? row.widget_searches);
    const searches = asNumber(row.searches);
    const estimatedRevenue = asNumber(row.estimated_revenue ?? row.revenue);
    const date = asString(row.date);
    const campaignId = detectCampaignId(row);
    const campaignMeta = date && campaignId ? campaignMetaByDate.get(date)?.get(campaignId) : null;
    const networkName = toDisplayNetworkName(detectNetworkName(row) || getPlatformFromNetworkId(campaignMeta?.networkId || row.networkId));
    const category = detectCategory(row) || campaignMeta?.category || null;
    const state = detectState(row);
    const buyer = detectBuyer(row) || campaignMeta?.buyer || null;
    const rsocSite = detectRsocSite(row) || campaignMeta?.rsocSite || null;

    aggregate.clicks += clicks;
    aggregate.widgetSearches += widgetSearches;
    aggregate.searches += searches;
    aggregate.estimatedRevenue += estimatedRevenue;
    if (networkName) aggregate.networkRevenue.set(networkName, asNumber(aggregate.networkRevenue.get(networkName)) + estimatedRevenue);
    if (category) aggregate.categoryRevenue.set(category, asNumber(aggregate.categoryRevenue.get(category)) + estimatedRevenue);
    if (state) aggregate.stateRevenue.set(state, asNumber(aggregate.stateRevenue.get(state)) + estimatedRevenue);
    if (buyer) aggregate.buyers.add(buyer);
    if (rsocSite) aggregate.rsocSites.add(rsocSite);
    if (campaignId) aggregate.campaignIds.add(campaignId);

    const desktopAcc = desktopRpcByKeyword.get(key);
    if (desktopAcc) {
      aggregate.s1Rpc.numerator = desktopAcc.numerator;
      aggregate.s1Rpc.denominator = desktopAcc.denominator;
    }
  }

  const rows: RolledKeywordRow[] = Array.from(grouped.values())
    .map((aggregate) => {
      const networkName = chooseDominant(aggregate.networkRevenue);
      const normalizedCategory = chooseDominant(aggregate.categoryRevenue);
      const state = chooseDominant(aggregate.stateRevenue);
      const rpc = aggregate.clicks > 0 ? aggregate.estimatedRevenue / aggregate.clicks : 0;
      const rps = aggregate.searches > 0 ? aggregate.estimatedRevenue / aggregate.searches : 0;
      const ctr = aggregate.widgetSearches > 0
        ? aggregate.clicks / aggregate.widgetSearches
        : aggregate.searches > 0
          ? aggregate.clicks / aggregate.searches
          : 0;

      return {
        network_name: networkName,
        normalized_category: normalizedCategory,
        state,
        keyword: aggregate.keyword,
        clicks: aggregate.clicks,
        widget_searches: aggregate.widgetSearches,
        searches: aggregate.searches,
        estimated_revenue: aggregate.estimatedRevenue,
        rpc,
        rps,
        ctr,
        campaigns_tracked: aggregate.campaignIds.size,
        campaigns_in_settings: null,
        s1_rpc: aggregate.s1Rpc.denominator > 0 ? aggregate.s1Rpc.numerator / aggregate.s1Rpc.denominator : null,
        s1_g_rank: null,
        s1_n_rank: null,
        s1_c_rank: null,
        buyers: Array.from(aggregate.buyers).sort(),
        rsoc_sites: Array.from(aggregate.rsocSites).sort(),
      };
    })
    .filter((row) => row.clicks >= minClicks)
    .filter((row) => !networkFilter || normalizeKey(row.network_name) === networkFilter)
    .filter((row) => !categoryFilter || normalizeKey(row.normalized_category).includes(categoryFilter))
    .filter((row) => !stateFilter || normalizeKey(row.state) === stateFilter)
    .sort((a, b) => b.estimated_revenue - a.estimated_revenue);

  return limit ? rows.slice(0, limit) : rows;
}
