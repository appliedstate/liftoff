import fs from 'fs';
import path from 'path';
import { createStrategisApiClient } from './strategistClient';
import { StrategisCampaignRecord } from './strategisCampaignResolver';
import { warmS1KeywordCache } from './s1Keywords';
import { StrategisApi } from './strategisApi';

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

type ForcekeySlot = (typeof FORCEKEY_SLOTS)[number];

type RawKeywordRow = Record<string, any>;

type ConfiguredForcekey = {
  slot: ForcekeySlot;
  keyword: string;
  normalizedKeyword: string;
  matcher: RegExp | null;
  placeholderTokens: string[];
};

type KeywordAggregate = {
  keyword: string;
  normalizedKeyword: string;
  searches: number;
  clicks: number;
  revenue: number;
};

type ForcekeyConceptAggregate = {
  forcekey: string;
  normalizedForcekey: string;
  type: 'exact' | 'templated';
  searches: number;
  clicks: number;
  revenue: number;
  matchedKeywordVariants: Set<string>;
  geoValues: Map<string, { token: 'state' | 'city' | 'region'; value: string; searches: number; clicks: number; revenue: number }>;
};

type SessionKeywordAggregate = {
  keyword: string;
  normalizedKeyword: string;
  category: string | null;
  searches: number;
  clicks: number;
  revenue: number;
};

export type ForcekeySelectorThresholds = {
  minSearchesPerKeyword: number;
  minClicksPerKeyword: number;
  rpcPriorClicks: number;
  ctrConfidenceZ: number;
  minGeoSearchesPerValue: number;
  geoLaunchUpliftPct: number;
};

export type ForcekeySelectorGeoValue = {
  token: 'state' | 'city' | 'region';
  value: string;
  searches: number;
  clicks: number;
  revenue: number;
  rps: number;
  rpc: number;
  upliftPct: number;
  band: 'premium' | 'baseline' | 'weak';
};

export type ForcekeySelectorOption = {
  forcekey: string;
  normalizedForcekey: string;
  type: 'exact' | 'templated';
  category: string;
  intentPacketId?: string | null;
  dateWindow: {
    start: string;
    end: string;
    label: string;
  };
  metrics: {
    searches: number;
    clicks: number;
    revenue: number;
    rpc: number;
    rps: number;
    ctr: number;
  };
  score: {
    rankingScore: number;
    conservativeCtr: number;
    shrunkRpc: number;
    shrunkRps: number;
    confidence: 'high' | 'medium' | 'low' | 'insufficient_data';
  };
  comparison: {
    categoryRank: number;
    categoryCount: number;
    categoryRpsLiftPct: number;
    networkRpsLiftPct: number;
    networkRpcLiftPct: number;
  };
  geo: {
    token: 'state' | 'city' | 'region';
    topValues: ForcekeySelectorGeoValue[];
    geoOpportunity: boolean;
    rationale: string;
  } | null;
  observedKeywordVariants: string[];
};

export type ForcekeySelectorResponse = {
  generatedAt: string;
  buyer: string | null;
  category: string;
  intentPacketId?: string | null;
  dateWindow: {
    start: string;
    end: string;
    label: string;
    type: 'trailing_complete_days';
  };
  baselines: {
    category: {
      searches: number;
      clicks: number;
      revenue: number;
      rpc: number;
      rps: number;
    };
    network: {
      searches: number;
      clicks: number;
      revenue: number;
      rpc: number;
      rps: number;
    };
  };
  options: ForcekeySelectorOption[];
  notes: string[];
  cache: {
    fetchedDates: string[];
    cachedDates: string[];
    failedDates: Array<{ date: string; error: string }>;
  };
};

export type ForcekeySelectorOptions = {
  organization?: string;
  buyer?: string | null;
  category: string;
  intentPacketId?: string | null;
  startDate: string;
  endDate: string;
  authToken?: string;
  hydrateMissing?: boolean;
  forceRefresh?: boolean;
  limit?: number;
  thresholds?: Partial<ForcekeySelectorThresholds>;
};

const DEFAULT_THRESHOLDS: ForcekeySelectorThresholds = {
  minSearchesPerKeyword: 25,
  minClicksPerKeyword: 5,
  rpcPriorClicks: 10,
  ctrConfidenceZ: 1.64,
  minGeoSearchesPerValue: 40,
  geoLaunchUpliftPct: 0.25,
};

function asString(value: unknown): string {
  return String(value ?? '').trim();
}

function asNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizePhrase(input: string): string {
  if (!input) return '';
  let out = input.trim();
  try {
    out = decodeURIComponent(out);
  } catch {
    // keep original
  }
  out = out.replace(/\+/g, ' ');
  out = out.replace(/\s+/g, ' ');
  return out.trim().toLowerCase();
}

function normalizedBuyerMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  return normalizePhrase(asString(left)) === normalizePhrase(asString(right));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTemplateMatcher(keyword: string): { regex: RegExp | null; placeholderTokens: string[] } {
  const normalized = normalizePhrase(keyword);
  if (!normalized.includes('{')) return { regex: null, placeholderTokens: [] };

  const placeholderTokens: string[] = [];
  const placeholderPattern = /\{([^}]+)\}/gi;
  let lastIndex = 0;
  let pattern = '';
  let match: RegExpExecArray | null = null;

  while ((match = placeholderPattern.exec(normalized))) {
    pattern += escapeRegex(normalized.slice(lastIndex, match.index));
    const token = normalizePhrase(match[1]);
    placeholderTokens.push(token === 'region' ? 'state' : token);
    pattern += `(?<p${placeholderTokens.length - 1}>[a-z0-9][a-z0-9 .,&()/-]*)`;
    lastIndex = match.index + match[0].length;
  }

  pattern += escapeRegex(normalized.slice(lastIndex));
  return {
    regex: new RegExp(`^${pattern}$`, 'i'),
    placeholderTokens,
  };
}

function extractConfiguredForcekeys(campaign: StrategisCampaignRecord): ConfiguredForcekey[] {
  const properties = campaign.properties || {};
  const configured: ConfiguredForcekey[] = [];
  for (const slot of FORCEKEY_SLOTS) {
    const keyword = asString(properties[slot]);
    if (!keyword) continue;
    const matcher = buildTemplateMatcher(keyword);
    configured.push({
      slot,
      keyword,
      normalizedKeyword: normalizePhrase(keyword),
      matcher: matcher.regex,
      placeholderTokens: matcher.placeholderTokens,
    });
  }
  return configured;
}

function matchesConfiguredForcekey(configured: ConfiguredForcekey, observed: KeywordAggregate): boolean {
  if (configured.normalizedKeyword === observed.normalizedKeyword) return true;
  return configured.matcher ? configured.matcher.test(observed.normalizedKeyword) : false;
}

function extractPlaceholderValues(
  configured: ConfiguredForcekey,
  observed: KeywordAggregate
): Array<{ token: 'state' | 'city' | 'region'; value: string }> {
  if (!configured.matcher || configured.placeholderTokens.length === 0) return [];
  const match = configured.matcher.exec(observed.normalizedKeyword);
  if (!match?.groups) return [];

  const out: Array<{ token: 'state' | 'city' | 'region'; value: string }> = [];
  configured.placeholderTokens.forEach((rawToken, index) => {
    const normalizedToken = (rawToken === 'region' ? 'state' : rawToken) as 'state' | 'city' | 'region';
    if (normalizedToken !== 'state' && normalizedToken !== 'city') return;
    const value = normalizePhrase(match.groups?.[`p${index}`] || '');
    if (!value) return;
    out.push({ token: rawToken === 'region' ? 'region' : normalizedToken, value });
  });
  return out;
}

function wilsonLowerBound(successes: number, trials: number, z: number): number {
  if (trials <= 0) return 0;
  const phat = successes / trials;
  const z2 = z * z;
  const denom = 1 + z2 / trials;
  const center = phat + z2 / (2 * trials);
  const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * trials)) / trials);
  return Math.max(0, (center - margin) / denom);
}

function pctDelta(next: number, current: number): number {
  if (current <= 0 && next <= 0) return 0;
  if (current <= 0) return 1;
  return (next - current) / current;
}

function bandGeoUplift(upliftPct: number): 'premium' | 'baseline' | 'weak' {
  if (upliftPct >= 0.25) return 'premium';
  if (upliftPct <= -0.15) return 'weak';
  return 'baseline';
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

function keywordCacheBase(): string {
  return path.join(process.cwd(), '.local', 'strategis', 's1', 'keywords', 'raw');
}

function readRawKeywordRows(startDate: string, endDate: string): RawKeywordRow[] {
  const rows: RawKeywordRow[] = [];
  for (const date of dayRange(startDate, endDate)) {
    const filePath = path.join(keywordCacheBase(), `${date}.json`);
    if (!fs.existsSync(filePath)) continue;
    try {
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(payload?.rows)) rows.push(...payload.rows);
    } catch {
      // ignore malformed file
    }
  }
  return rows;
}

function sessionSnapshotBase(): string {
  return path.join(process.cwd(), 'runs', 'system1');
}

function readLocalSessionSnapshotRows(startDate: string, endDate: string): RawKeywordRow[] {
  const rows: RawKeywordRow[] = [];
  for (const date of dayRange(startDate, endDate)) {
    const dateDir = path.join(sessionSnapshotBase(), date);
    if (!fs.existsSync(dateDir)) continue;
    const candidates = fs
      .readdirSync(dateDir)
      .filter((name) => name.startsWith('session_revenue_') && name.endsWith('.json'))
      .sort();
    if (!candidates.length) continue;
    const latest = path.join(dateDir, candidates[candidates.length - 1]);
    try {
      const payload = JSON.parse(fs.readFileSync(latest, 'utf8'));
      if (Array.isArray(payload)) {
        rows.push(...payload);
      } else if (Array.isArray(payload?.data)) {
        rows.push(...payload.data);
      }
    } catch {
      // Ignore malformed local session snapshot.
    }
  }
  return rows;
}

function extractStrategisCampaignIdFromName(value: string | null | undefined): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const candidate = raw.split('_')[0]?.trim() || '';
  return /^si[a-z0-9]+$/i.test(candidate) ? candidate : null;
}

function sumSessionRevenue(session: RawKeywordRow): number {
  const updates = Array.isArray(session?.revenue_updates) ? session.revenue_updates : [];
  if (updates.length > 0) {
    return updates.reduce((sum: number, update: any) => {
      const revenue = Number(update?.revenue || 0);
      return Number.isFinite(revenue) && revenue > 0 ? sum + revenue : sum;
    }, 0);
  }
  const totalRevenue = Number(session?.total_revenue);
  if (Number.isFinite(totalRevenue) && totalRevenue > 0) return totalRevenue;
  const fallback = Number(session?.revenue ?? session?.estimated_revenue ?? session?.revenue_usd ?? 0);
  return Number.isFinite(fallback) ? fallback : 0;
}

function deriveSessionSearches(session: RawKeywordRow): number {
  const direct = Number(
    session.searches ?? session.widget_searches ?? session.widgetSearches ?? session.search_count
  );
  if (Number.isFinite(direct) && direct > 0) return direct;
  const updates = Array.isArray(session?.revenue_updates) ? session.revenue_updates : [];
  let best = 0;
  for (const update of updates) {
    const value = Number(update?.searches ?? update?.widget_searches ?? 0);
    if (Number.isFinite(value) && value > best) best = value;
  }
  return best;
}

function deriveSessionClicks(session: RawKeywordRow): number {
  const direct = Number(session.clicks ?? session.click_count ?? session.clickCount);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const updates = Array.isArray(session?.revenue_updates) ? session.revenue_updates : [];
  let best = 0;
  for (const update of updates) {
    const value = Number(update?.clicks ?? 0);
    if (Number.isFinite(value) && value > best) best = value;
  }
  return best;
}

async function fetchSessionKeywordRows(
  api: StrategisApi,
  startDate: string,
  endDate: string
): Promise<RawKeywordRow[]> {
  const rows = await Promise.all(
    dayRange(startDate, endDate).map(async (date) => {
      try {
        return await api.fetchS1SessionRevenue(date, false);
      } catch {
        return [];
      }
    })
  );

  const normalizedRows: RawKeywordRow[] = [];
  for (const dayRows of rows) {
    for (const session of dayRows) {
      const keyword = asString(
        session.keyword ||
          session.keyword_text ||
          session.keywordText ||
          session.keyword_name ||
          session.keyword_strategis
      );
      if (!keyword) continue;

      const strategisCampaignId =
        asString(
          session.strategisCampaignId ||
            session.strategis_campaign_id ||
            session.strategiscampaignid
        ) ||
        extractStrategisCampaignIdFromName(
          session.campaign_name || session.campaignName || session.networkCampaignName
        ) ||
        '';

      if (!strategisCampaignId) continue;

      normalizedRows.push({
        strategisCampaignId,
        keyword,
        searches: 1,
        clicks: 1,
        estimated_revenue: sumSessionRevenue(session),
      });
    }
  }

  return normalizedRows;
}

function aggregateSessionKeywordRows(rows: RawKeywordRow[]): {
  categoryKeywords: Map<string, Map<string, SessionKeywordAggregate>>;
  networkKeywords: Map<string, SessionKeywordAggregate>;
  approximatedRows: number;
} {
  const categoryKeywords = new Map<string, Map<string, SessionKeywordAggregate>>();
  const networkKeywords = new Map<string, SessionKeywordAggregate>();
  let approximatedRows = 0;

  for (const row of rows) {
    const keyword = asString(
      row.keyword || row.keyword_text || row.keywordText || row.keyword_name || row.keyword_strategis
    );
    if (!keyword) continue;
    const normalizedKeyword = normalizePhrase(keyword);
    if (!normalizedKeyword) continue;
    const category = asString(row.category || row.normalized_category || row.normalizedCategory) || null;
    const revenue = sumSessionRevenue(row);
    let searches = deriveSessionSearches(row);
    let clicks = deriveSessionClicks(row);
    if (searches <= 0 && clicks <= 0) {
      searches = 1;
      clicks = 1;
      approximatedRows += 1;
    } else {
      if (clicks <= 0) clicks = 1;
      if (searches <= 0) searches = clicks;
    }

    const add = (target: Map<string, SessionKeywordAggregate>) => {
      const current = target.get(normalizedKeyword) || {
        keyword,
        normalizedKeyword,
        category,
        searches: 0,
        clicks: 0,
        revenue: 0,
      };
      current.searches += searches;
      current.clicks += clicks;
      current.revenue += revenue;
      target.set(normalizedKeyword, current);
    };

    if (category) {
      let perCategory = categoryKeywords.get(normalizePhrase(category));
      if (!perCategory) {
        perCategory = new Map<string, SessionKeywordAggregate>();
        categoryKeywords.set(normalizePhrase(category), perCategory);
      }
      add(perCategory);
    }
    add(networkKeywords);
  }

  return { categoryKeywords, networkKeywords, approximatedRows };
}

function sessionConceptsFromAggregates(aggregates: Iterable<SessionKeywordAggregate>): ForcekeyConceptAggregate[] {
  const concepts: ForcekeyConceptAggregate[] = [];
  for (const aggregate of aggregates) {
    concepts.push({
      forcekey: aggregate.keyword,
      normalizedForcekey: aggregate.normalizedKeyword,
      type: 'exact',
      searches: aggregate.searches,
      clicks: aggregate.clicks,
      revenue: aggregate.revenue,
      matchedKeywordVariants: new Set([aggregate.keyword]),
      geoValues: new Map(),
    });
  }
  return concepts;
}

async function listCampaigns(organization: string, authToken?: string): Promise<StrategisCampaignRecord[]> {
  try {
    const client = createStrategisApiClient({ authToken });
    const payload = await client.get('/api/campaigns', { organization });
    if (Array.isArray(payload)) return payload as StrategisCampaignRecord[];
    if (payload && typeof payload === 'object' && Array.isArray((payload as any).data)) {
      return (payload as any).data as StrategisCampaignRecord[];
    }
  } catch {
    // Fall back to local campaign catalogs if live Strategis auth is unavailable.
  }
  return loadLocalCampaignCatalogs();
}

function loadLocalCampaignCatalogs(): StrategisCampaignRecord[] {
  const baseDir = path.join(process.cwd(), '.local', 'strategis', 'ben-campaign-catalog');
  if (!fs.existsSync(baseDir)) return [];
  const campaigns: StrategisCampaignRecord[] = [];
  const dirs = fs.readdirSync(baseDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const dir of dirs) {
    const catalogPath = path.join(baseDir, dir.name, 'catalog.json');
    if (!fs.existsSync(catalogPath)) continue;
    try {
      const payload = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      const items = Array.isArray(payload?.items) ? payload.items : [];
      for (const item of items) {
        const properties: Record<string, string> = {
          buyer: asString(item.buyer),
          article: asString(item.articlePath || item.articleUrl || item.article),
          rsocSite: asString(item.rsocSite),
          fbAdAccount: asString(item.fbAdAccount),
          networkAccountId: asString(item.networkAccountId),
        };
        const forcekeyMap = item.forcekeyMap && typeof item.forcekeyMap === 'object' ? item.forcekeyMap : {};
        for (const slot of FORCEKEY_SLOTS) {
          const value = asString(forcekeyMap[slot]);
          if (value) properties[slot] = value;
        }
        campaigns.push({
          id: asString(item.campaignId),
          name: asString(item.campaignName),
          category: asString(item.category),
          properties,
        } as StrategisCampaignRecord);
      }
    } catch {
      // Ignore malformed local catalog.
    }
  }
  return campaigns;
}

function aggregateKeywordRows(
  rows: RawKeywordRow[],
  campaignFilter: Set<string>
): Map<string, Map<string, KeywordAggregate>> {
  const byCampaign = new Map<string, Map<string, KeywordAggregate>>();

  for (const row of rows) {
    const campaignId = asString(row.strategisCampaignId || row.campaignId || row.subId);
    if (!campaignId || !campaignFilter.has(campaignId)) continue;
    const keyword = asString(row.keyword || row.serp_keyword || row.searchTerm);
    if (!keyword) continue;
    const normalizedKeyword = normalizePhrase(keyword);
    if (!normalizedKeyword) continue;

    let campaignMap = byCampaign.get(campaignId);
    if (!campaignMap) {
      campaignMap = new Map<string, KeywordAggregate>();
      byCampaign.set(campaignId, campaignMap);
    }

    let aggregate = campaignMap.get(normalizedKeyword);
    if (!aggregate) {
      aggregate = {
        keyword,
        normalizedKeyword,
        searches: 0,
        clicks: 0,
        revenue: 0,
      };
      campaignMap.set(normalizedKeyword, aggregate);
    }

    aggregate.searches += asNumber(row.searches);
    aggregate.clicks += asNumber(row.clicks);
    aggregate.revenue += asNumber(row.estimated_revenue ?? row.revenue);
  }

  return byCampaign;
}

function aggregateForcekeyConcepts(
  campaigns: StrategisCampaignRecord[],
  byCampaignKeywords: Map<string, Map<string, KeywordAggregate>>
): Map<string, ForcekeyConceptAggregate> {
  const concepts = new Map<string, ForcekeyConceptAggregate>();

  for (const campaign of campaigns) {
    const observedKeywords = Array.from(byCampaignKeywords.get(campaign.id)?.values() || []);
    const configuredForcekeys = extractConfiguredForcekeys(campaign);
    for (const configured of configuredForcekeys) {
      const matchedObserved = observedKeywords.filter((observed) => matchesConfiguredForcekey(configured, observed));
      if (matchedObserved.length === 0) continue;

      let concept = concepts.get(configured.normalizedKeyword);
      if (!concept) {
        concept = {
          forcekey: configured.keyword,
          normalizedForcekey: configured.normalizedKeyword,
          type: configured.matcher ? 'templated' : 'exact',
          searches: 0,
          clicks: 0,
          revenue: 0,
          matchedKeywordVariants: new Set<string>(),
          geoValues: new Map(),
        };
        concepts.set(configured.normalizedKeyword, concept);
      }

      for (const observed of matchedObserved) {
        concept.searches += observed.searches;
        concept.clicks += observed.clicks;
        concept.revenue += observed.revenue;
        concept.matchedKeywordVariants.add(observed.keyword);

        for (const geo of extractPlaceholderValues(configured, observed)) {
          const key = `${geo.token}:${geo.value}`;
          const current = concept.geoValues.get(key) || {
            token: geo.token,
            value: geo.value,
            searches: 0,
            clicks: 0,
            revenue: 0,
          };
          current.searches += observed.searches;
          current.clicks += observed.clicks;
          current.revenue += observed.revenue;
          concept.geoValues.set(key, current);
        }
      }
    }
  }

  return concepts;
}

function buildBaseline(concepts: ForcekeyConceptAggregate[]) {
  const searches = concepts.reduce((sum, concept) => sum + concept.searches, 0);
  const clicks = concepts.reduce((sum, concept) => sum + concept.clicks, 0);
  const revenue = concepts.reduce((sum, concept) => sum + concept.revenue, 0);
  return {
    searches,
    clicks,
    revenue,
    rpc: clicks > 0 ? revenue / clicks : 0,
    rps: searches > 0 ? revenue / searches : 0,
  };
}

function confidenceFrom(searches: number, clicks: number, scoreDelta: number, thresholds: ForcekeySelectorThresholds): 'high' | 'medium' | 'low' | 'insufficient_data' {
  if (searches < thresholds.minSearchesPerKeyword || clicks < thresholds.minClicksPerKeyword) return 'insufficient_data';
  if (searches >= 150 && clicks >= 25 && scoreDelta >= 0.2) return 'high';
  if (searches >= 75 && clicks >= 12 && scoreDelta >= 0.1) return 'medium';
  return 'low';
}

export async function buildForcekeySelector(options: ForcekeySelectorOptions): Promise<ForcekeySelectorResponse> {
  const organization = options.organization || process.env.STRATEGIS_ORGANIZATION || 'Interlincx';
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) };
  const limit = Math.max(1, Math.min(100, options.limit || 50));
  const api = new StrategisApi({
    organization,
    authToken: options.authToken,
  });

  const cache = options.hydrateMissing === false
    ? { fetched: [] as string[], cached: [] as string[], failed: [] as Array<{ date: string; error: string }> }
    : await warmS1KeywordCache(options.startDate, options.endDate, {
        forceRefresh: Boolean(options.forceRefresh),
        includeDesktop: false,
        api,
      });

  const allCampaigns = await listCampaigns(organization, options.authToken);
  const allForcekeyCampaigns = allCampaigns.filter((campaign) => extractConfiguredForcekeys(campaign).length > 0);
  const categoryCampaigns = allForcekeyCampaigns.filter((campaign) => {
    if (normalizePhrase(asString(campaign.category)) !== normalizePhrase(options.category)) return false;
    if (options.buyer && !normalizedBuyerMatch(campaign.properties?.buyer, options.buyer)) return false;
    return true;
  });

  let keywordRows = readRawKeywordRows(options.startDate, options.endDate);
  let usedSessionFallback = false;
  let usedSessionCategoryFallback = false;
  let approximatedSessionRows = 0;
  let availableSessionCategories: string[] = [];
  if (keywordRows.length === 0) {
    keywordRows = await fetchSessionKeywordRows(api, options.startDate, options.endDate);
    usedSessionFallback = keywordRows.length > 0;
  }
  const campaignKeywordMap = aggregateKeywordRows(
    keywordRows,
    new Set(allForcekeyCampaigns.map((campaign) => campaign.id))
  );

  let categoryConcepts = Array.from(
    aggregateForcekeyConcepts(categoryCampaigns, campaignKeywordMap).values()
  );
  let networkConcepts = Array.from(
    aggregateForcekeyConcepts(allForcekeyCampaigns, campaignKeywordMap).values()
  );

  if (categoryConcepts.length === 0) {
    const localSessionRows = readLocalSessionSnapshotRows(options.startDate, options.endDate);
    if (localSessionRows.length > 0) {
    const sessionAggregates = aggregateSessionKeywordRows(localSessionRows);
    availableSessionCategories = Array.from(sessionAggregates.categoryKeywords.keys()).sort();
    const categoryKey = normalizePhrase(options.category);
    categoryConcepts = sessionConceptsFromAggregates(
      sessionAggregates.categoryKeywords.get(categoryKey)?.values() || []
    );
      networkConcepts = sessionConceptsFromAggregates(sessionAggregates.networkKeywords.values());
      usedSessionCategoryFallback = categoryConcepts.length > 0;
      approximatedSessionRows = sessionAggregates.approximatedRows;
    }
  }

  const categoryBaseline = buildBaseline(categoryConcepts);
  const networkBaseline = buildBaseline(networkConcepts);
  const categoryAvgRpc = categoryBaseline.rpc;

  const optionsList = categoryConcepts
    .map((concept) => {
      const rpc = concept.clicks > 0 ? concept.revenue / concept.clicks : 0;
      const rps = concept.searches > 0 ? concept.revenue / concept.searches : 0;
      const ctr = concept.searches > 0 ? concept.clicks / concept.searches : 0;
      const conservativeCtr = wilsonLowerBound(concept.clicks, concept.searches, thresholds.ctrConfidenceZ);
      const shrunkRpc =
        concept.clicks + thresholds.rpcPriorClicks > 0
          ? (concept.revenue + categoryAvgRpc * thresholds.rpcPriorClicks) / (concept.clicks + thresholds.rpcPriorClicks)
          : categoryAvgRpc;
      const shrunkRps = conservativeCtr * shrunkRpc;
      const categoryRpsLiftPct = pctDelta(rps, categoryBaseline.rps);
      const networkRpsLiftPct = pctDelta(rps, networkBaseline.rps);
      const networkRpcLiftPct = pctDelta(rpc, networkBaseline.rpc);
      const confidence = confidenceFrom(concept.searches, concept.clicks, categoryRpsLiftPct, thresholds);
      const geoValues = Array.from(concept.geoValues.values())
        .filter((geo) => geo.searches >= thresholds.minGeoSearchesPerValue)
        .map((geo) => {
          const geoRps = geo.searches > 0 ? geo.revenue / geo.searches : 0;
          const geoRpc = geo.clicks > 0 ? geo.revenue / geo.clicks : 0;
          const upliftPct = pctDelta(geoRps, rps);
          return {
            token: geo.token,
            value: geo.value,
            searches: geo.searches,
            clicks: geo.clicks,
            revenue: geo.revenue,
            rps: geoRps,
            rpc: geoRpc,
            upliftPct,
            band: bandGeoUplift(upliftPct),
          } satisfies ForcekeySelectorGeoValue;
        })
        .sort((a, b) => b.rps - a.rps || b.revenue - a.revenue || b.searches - a.searches);

      const topGeoToken = geoValues[0]?.token || null;
      const geo = topGeoToken
        ? {
            token: topGeoToken,
            topValues: geoValues.slice(0, 5),
            geoOpportunity: geoValues.some(
              (value) => value.band === 'premium' && value.upliftPct >= thresholds.geoLaunchUpliftPct
            ),
            rationale: geoValues.some(
              (value) => value.band === 'premium' && value.upliftPct >= thresholds.geoLaunchUpliftPct
            )
              ? `top ${topGeoToken} values show >= ${(thresholds.geoLaunchUpliftPct * 100).toFixed(0)}% RPS uplift vs this forcekey average`
              : 'geo expansion is informative, but not yet strong enough for a separate geo-targeted launch',
          }
        : null;

      return {
        forcekey: concept.forcekey,
        normalizedForcekey: concept.normalizedForcekey,
        type: concept.type,
        category: options.category,
        intentPacketId: options.intentPacketId || null,
        dateWindow: {
          start: options.startDate,
          end: options.endDate,
          label: `${options.startDate} to ${options.endDate}`,
        },
        metrics: {
          searches: concept.searches,
          clicks: concept.clicks,
          revenue: concept.revenue,
          rpc,
          rps,
          ctr,
        },
        score: {
          rankingScore: shrunkRps,
          conservativeCtr,
          shrunkRpc,
          shrunkRps,
          confidence,
        },
        comparison: {
          categoryRank: 0,
          categoryCount: categoryConcepts.length,
          categoryRpsLiftPct,
          networkRpsLiftPct,
          networkRpcLiftPct,
        },
        geo,
        observedKeywordVariants: Array.from(concept.matchedKeywordVariants).sort(),
      } satisfies ForcekeySelectorOption;
    })
    .sort((left, right) => {
      if (right.score.rankingScore !== left.score.rankingScore) {
        return right.score.rankingScore - left.score.rankingScore;
      }
      return right.metrics.revenue - left.metrics.revenue || right.metrics.searches - left.metrics.searches;
    })
    .map((option, index) => ({
      ...option,
      comparison: {
        ...option.comparison,
        categoryRank: index + 1,
      },
    }))
    .slice(0, limit);

  const notes: string[] = [];
  if (categoryCampaigns.length === 0) {
    notes.push('No campaigns with configured forcekeys matched this category and buyer filter.');
  }
  if (options.buyer) {
    notes.push(`Filtered to buyer ${options.buyer}.`);
  }
  notes.push(`Trailing window covers ${dayRange(options.startDate, options.endDate).length} complete days.`);
  notes.push('Templated forcekeys stay parameterized; geo expansion appears in the analysis metadata.');
  if (usedSessionFallback) {
    notes.push('Used session-level keyword revenue because the daily keyword cache was missing for this window.');
  }
  if (usedSessionCategoryFallback) {
    notes.push('Used category-level session keyword data because campaign-mapped keyword rows were unavailable for this window.');
    if (options.buyer) {
      notes.push(`Buyer filter ${options.buyer} could not be enforced in the category-level session fallback because the session snapshots do not include buyer.`);
    }
  }
  if (approximatedSessionRows > 0) {
    notes.push(`Approximated searches/clicks from session counts for ${approximatedSessionRows} session rows where the session endpoint did not expose explicit search/click totals.`);
  }
  if (categoryConcepts.length === 0 && availableSessionCategories.length > 0) {
    notes.push(
      `Available session snapshot categories for this window: ${availableSessionCategories
        .slice(0, 8)
        .join(', ')}${availableSessionCategories.length > 8 ? ', ...' : ''}.`
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    buyer: options.buyer || null,
    category: options.category,
    intentPacketId: options.intentPacketId || null,
    dateWindow: {
      start: options.startDate,
      end: options.endDate,
      label: `Trailing 14 complete days: ${options.startDate} - ${options.endDate}`,
      type: 'trailing_complete_days',
    },
    baselines: {
      category: categoryBaseline,
      network: networkBaseline,
    },
    options: optionsList,
    notes,
    cache: {
      fetchedDates: cache.fetched,
      cachedDates: cache.cached,
      failedDates: cache.failed,
    },
  };
}
