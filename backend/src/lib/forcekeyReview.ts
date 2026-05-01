import fs from 'fs';
import path from 'path';
import { StrategisCampaignRecord } from './strategisCampaignResolver';
import { StrategisApi } from './strategisApi';
import { warmS1KeywordCache } from './s1Keywords';
import { createStrategisApiClient } from './strategistClient';

export const FORCEKEY_SLOTS = [
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

export type ForcekeySlot = (typeof FORCEKEY_SLOTS)[number];

type RawKeywordRow = Record<string, any>;

type ForcekeyKeywordAggregate = {
  keyword: string;
  normalizedKeyword: string;
  searches: number;
  widgetSearches: number;
  clicks: number;
  revenue: number;
};

type ConfiguredForcekey = {
  slot: ForcekeySlot;
  keyword: string;
  normalizedKeyword: string;
  matcher: RegExp | null;
  placeholderTokens: string[];
};

export type ForcekeyReviewThresholds = {
  minSearchesPerKeyword: number;
  minClicksPerKeyword: number;
  minCampaignForcekeySearches: number;
  minImprovementPct: number;
  rpcPriorClicks: number;
  ctrConfidenceZ: number;
  topNonConfiguredKeywords: number;
  minGeoSearchesPerValue: number;
  geoLaunchUpliftPct: number;
};

export type ForcekeyGeoValueReview = {
  token: string;
  value: string;
  searches: number;
  clicks: number;
  revenue: number;
  rps: number;
  rpc: number;
  upliftPct: number;
  band: 'premium' | 'baseline' | 'weak';
};

export type ForcekeyGeoOpportunity = {
  slot: ForcekeySlot;
  keyword: string;
  token: string;
  launchGeoCampaign: boolean;
  rationale: string;
  topValues: ForcekeyGeoValueReview[];
};

export type ForcekeySlotReview = {
  slot: ForcekeySlot;
  keyword: string;
  normalizedKeyword: string;
  currentPosition: number;
  recommendedPosition: number;
  searches: number;
  widgetSearches: number;
  clicks: number;
  revenue: number;
  rpc: number;
  rps: number;
  ctr: number;
  conservativeCtr: number;
  shrunkRpc: number;
  conservativeRps: number;
  eligible: boolean;
  reasons: string[];
  matchedKeywordVariants: number;
  geoValues: ForcekeyGeoValueReview[];
};

export type ForcekeyKeywordOpportunity = {
  keyword: string;
  searches: number;
  clicks: number;
  revenue: number;
  rps: number;
  rpc: number;
};

export type CampaignForcekeyReview = {
  campaignId: string;
  campaignName: string;
  buyer: string | null;
  category: string | null;
  article: string | null;
  rsocSite: string | null;
  totalConfiguredForcekeys: number;
  totalForcekeySearches: number;
  totalForcekeyClicks: number;
  totalForcekeyRevenue: number;
  avgForcekeyRps: number;
  avgForcekeyRpc: number;
  currentOrder: string[];
  recommendedOrder: string[];
  reorderSuggested: boolean;
  confidence: 'high' | 'medium' | 'low' | 'insufficient_data';
  reviewStatus: 'ready' | 'watch' | 'insufficient_data';
  heartbeatDays: number;
  heartbeatReason: string;
  deltaTopVsCurrentPct: number;
  slots: ForcekeySlotReview[];
  topObservedNonConfiguredKeywords: ForcekeyKeywordOpportunity[];
  geoOpportunities: ForcekeyGeoOpportunity[];
};

export type ForcekeyReviewReport = {
  generatedAt: string;
  dateWindow: {
    start: string;
    end: string;
    days: number;
  };
  filters: {
    organization: string;
    buyer: string | null;
    campaignIds: string[];
  };
  thresholds: ForcekeyReviewThresholds;
  cache: {
    fetchedDates: string[];
    cachedDates: string[];
    failedDates: Array<{ date: string; error: string }>;
  };
  totals: {
    campaignsReviewed: number;
    campaignsWithForcekeys: number;
    campaignsReady: number;
    campaignsSuggestingReorder: number;
  };
  campaigns: CampaignForcekeyReview[];
};

export type ForcekeyReviewOptions = {
  organization?: string;
  buyer?: string | null;
  campaignIds?: string[];
  startDate: string;
  endDate: string;
  authToken?: string;
  hydrateMissing?: boolean;
  forceRefresh?: boolean;
  thresholds?: Partial<ForcekeyReviewThresholds>;
};

const DEFAULT_THRESHOLDS: ForcekeyReviewThresholds = {
  minSearchesPerKeyword: 25,
  minClicksPerKeyword: 5,
  minCampaignForcekeySearches: 100,
  minImprovementPct: 0.1,
  rpcPriorClicks: 10,
  ctrConfidenceZ: 1.64,
  topNonConfiguredKeywords: 5,
  minGeoSearchesPerValue: 40,
  geoLaunchUpliftPct: 0.25,
};

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return String(value ?? '').trim();
}

function asNullableString(value: unknown): string | null {
  const out = asString(value);
  return out || null;
}

function asNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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
      // Ignore malformed cache file and continue with the rest.
    }
  }
  return rows;
}

function normalizePhrase(input: string): string {
  if (!input) return '';
  let out = input.trim();
  try {
    out = decodeURIComponent(out);
  } catch {
    // Keep original if decoding fails.
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
    placeholderTokens.push(normalizePhrase(match[1]));
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

function matchesConfiguredForcekey(configured: ConfiguredForcekey, observed: ForcekeyKeywordAggregate): boolean {
  if (configured.normalizedKeyword === observed.normalizedKeyword) return true;
  return configured.matcher ? configured.matcher.test(observed.normalizedKeyword) : false;
}

function extractPlaceholderValues(configured: ConfiguredForcekey, observed: ForcekeyKeywordAggregate): Array<{ token: string; value: string }> {
  if (!configured.matcher || configured.placeholderTokens.length === 0) return [];
  const match = configured.matcher.exec(observed.normalizedKeyword);
  if (!match?.groups) return [];

  const values: Array<{ token: string; value: string }> = [];
  configured.placeholderTokens.forEach((token, index) => {
    const value = normalizePhrase(match.groups?.[`p${index}`] || '');
    if (!value) return;
    values.push({ token, value });
  });
  return values;
}

function bandGeoUplift(upliftPct: number): 'premium' | 'baseline' | 'weak' {
  if (upliftPct >= 0.25) return 'premium';
  if (upliftPct <= -0.15) return 'weak';
  return 'baseline';
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

function dedupeOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

async function listCampaigns(organization: string, authToken?: string): Promise<StrategisCampaignRecord[]> {
  const client = createStrategisApiClient({ authToken });
  const payload = await client.get('/api/campaigns', { organization });
  if (Array.isArray(payload)) return payload as StrategisCampaignRecord[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as any).data)) {
    return (payload as any).data as StrategisCampaignRecord[];
  }
  return [];
}

function aggregateKeywordRows(
  rows: RawKeywordRow[],
  campaignFilter: Set<string>
): Map<string, Map<string, ForcekeyKeywordAggregate>> {
  const byCampaign = new Map<string, Map<string, ForcekeyKeywordAggregate>>();

  for (const row of rows) {
    const campaignId = asString(row.strategisCampaignId || row.campaignId || row.subId);
    if (!campaignId || !campaignFilter.has(campaignId)) continue;
    const keyword = asString(row.keyword || row.serp_keyword || row.searchTerm);
    if (!keyword) continue;
    const normalizedKeyword = normalizePhrase(keyword);
    if (!normalizedKeyword) continue;

    let campaignMap = byCampaign.get(campaignId);
    if (!campaignMap) {
      campaignMap = new Map<string, ForcekeyKeywordAggregate>();
      byCampaign.set(campaignId, campaignMap);
    }

    let aggregate = campaignMap.get(normalizedKeyword);
    if (!aggregate) {
      aggregate = {
        keyword,
        normalizedKeyword,
        searches: 0,
        widgetSearches: 0,
        clicks: 0,
        revenue: 0,
      };
      campaignMap.set(normalizedKeyword, aggregate);
    }

    aggregate.searches += asNumber(row.searches);
    aggregate.widgetSearches += asNumber(row.widgetSearches ?? row.widget_searches);
    aggregate.clicks += asNumber(row.clicks);
    aggregate.revenue += asNumber(row.estimated_revenue ?? row.revenue);
  }

  return byCampaign;
}

function chooseHeartbeatDays(totalSearches: number, dayCount: number, thresholds: ForcekeyReviewThresholds) {
  const dailySearchRate = dayCount > 0 ? totalSearches / dayCount : 0;
  if (totalSearches < thresholds.minCampaignForcekeySearches) {
    const remaining = Math.max(0, thresholds.minCampaignForcekeySearches - totalSearches);
    const daysToThreshold = Math.max(3, Math.ceil(remaining / Math.max(dailySearchRate, 1)));
    return {
      days: Math.min(14, daysToThreshold),
      reason: `wait for more volume; ${totalSearches} configured searches so far vs ${thresholds.minCampaignForcekeySearches} minimum`,
    };
  }
  if (dailySearchRate >= 50) {
    return { days: 3, reason: `high data density at ${dailySearchRate.toFixed(1)} configured searches/day` };
  }
  if (dailySearchRate >= 20) {
    return { days: 7, reason: `medium data density at ${dailySearchRate.toFixed(1)} configured searches/day` };
  }
  return { days: 14, reason: `lower data density at ${dailySearchRate.toFixed(1)} configured searches/day` };
}

function reviewCampaign(
  campaign: StrategisCampaignRecord,
  configuredForcekeys: ConfiguredForcekey[],
  observedKeywordMap: Map<string, ForcekeyKeywordAggregate> | undefined,
  thresholds: ForcekeyReviewThresholds,
  dayCount: number
): CampaignForcekeyReview {
  const observedKeywords = observedKeywordMap ? Array.from(observedKeywordMap.values()) : [];
  const totalForcekeySearches = configuredForcekeys.reduce(
    (sum, configured) =>
      sum +
      observedKeywords
        .filter((observed) => matchesConfiguredForcekey(configured, observed))
        .reduce((inner, observed) => inner + observed.searches, 0),
    0
  );
  const totalForcekeyClicks = configuredForcekeys.reduce(
    (sum, configured) =>
      sum +
      observedKeywords
        .filter((observed) => matchesConfiguredForcekey(configured, observed))
        .reduce((inner, observed) => inner + observed.clicks, 0),
    0
  );
  const totalForcekeyRevenue = configuredForcekeys.reduce(
    (sum, configured) =>
      sum +
      observedKeywords
        .filter((observed) => matchesConfiguredForcekey(configured, observed))
        .reduce((inner, observed) => inner + observed.revenue, 0),
    0
  );

  const avgForcekeyRpc = totalForcekeyClicks > 0 ? totalForcekeyRevenue / totalForcekeyClicks : 0;
  const avgForcekeyRps = totalForcekeySearches > 0 ? totalForcekeyRevenue / totalForcekeySearches : 0;

  const slotReviews: ForcekeySlotReview[] = configuredForcekeys.map((configured, idx) => {
    const matchedObserved = observedKeywords.filter((observed) => matchesConfiguredForcekey(configured, observed));
    const searches = matchedObserved.reduce((sum, observed) => sum + observed.searches, 0);
    const widgetSearches = matchedObserved.reduce((sum, observed) => sum + observed.widgetSearches, 0);
    const clicks = matchedObserved.reduce((sum, observed) => sum + observed.clicks, 0);
    const revenue = matchedObserved.reduce((sum, observed) => sum + observed.revenue, 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    const ctr = searches > 0 ? clicks / searches : 0;
    const conservativeCtr = wilsonLowerBound(clicks, searches, thresholds.ctrConfidenceZ);
    const shrunkRpc =
      clicks + thresholds.rpcPriorClicks > 0
        ? (revenue + avgForcekeyRpc * thresholds.rpcPriorClicks) / (clicks + thresholds.rpcPriorClicks)
        : avgForcekeyRpc;
    const geoMap = new Map<string, { token: string; value: string; searches: number; clicks: number; revenue: number }>();

    for (const observed of matchedObserved) {
      for (const placeholder of extractPlaceholderValues(configured, observed)) {
        if (placeholder.token !== 'state' && placeholder.token !== 'city') continue;
        const key = `${placeholder.token}:${placeholder.value}`;
        const current = geoMap.get(key) || {
          token: placeholder.token,
          value: placeholder.value,
          searches: 0,
          clicks: 0,
          revenue: 0,
        };
        current.searches += observed.searches;
        current.clicks += observed.clicks;
        current.revenue += observed.revenue;
        geoMap.set(key, current);
      }
    }

    const geoValues = Array.from(geoMap.values())
      .filter((geo) => geo.searches >= thresholds.minGeoSearchesPerValue)
      .map((geo) => {
        const rps = geo.searches > 0 ? geo.revenue / geo.searches : 0;
        const rpc = geo.clicks > 0 ? geo.revenue / geo.clicks : 0;
        const upliftPct = avgForcekeyRps > 0 ? pctDelta(rps, avgForcekeyRps) : 0;
        return {
          token: geo.token,
          value: geo.value,
          searches: geo.searches,
          clicks: geo.clicks,
          revenue: geo.revenue,
          rps,
          rpc,
          upliftPct,
          band: bandGeoUplift(upliftPct),
        } satisfies ForcekeyGeoValueReview;
      })
      .sort((left, right) => right.rps - left.rps || right.revenue - left.revenue || right.searches - left.searches);

    const reasons: string[] = [];
    if (searches < thresholds.minSearchesPerKeyword) {
      reasons.push(`searches ${searches} < ${thresholds.minSearchesPerKeyword}`);
    }
    if (clicks < thresholds.minClicksPerKeyword) {
      reasons.push(`clicks ${clicks} < ${thresholds.minClicksPerKeyword}`);
    }

    return {
      slot: configured.slot,
      keyword: configured.keyword,
      normalizedKeyword: configured.normalizedKeyword,
      currentPosition: idx + 1,
      recommendedPosition: idx + 1,
      searches,
      widgetSearches,
      clicks,
      revenue,
      rpc,
      rps,
      ctr,
      conservativeCtr,
      shrunkRpc,
      conservativeRps: conservativeCtr * shrunkRpc,
      eligible: reasons.length === 0,
      reasons,
      matchedKeywordVariants: matchedObserved.length,
      geoValues,
    };
  });

  const eligibleSlots = slotReviews.filter((slot) => slot.eligible);
  const originalIndex = new Map(slotReviews.map((slot, idx) => [slot.slot, idx]));
  const sortedEligible = [...eligibleSlots].sort((left, right) => {
    const maxScore = Math.max(left.conservativeRps, right.conservativeRps, Number.EPSILON);
    const relativeGap = Math.abs(left.conservativeRps - right.conservativeRps) / maxScore;
    if (relativeGap <= thresholds.minImprovementPct) {
      return (originalIndex.get(left.slot) || 0) - (originalIndex.get(right.slot) || 0);
    }
    return right.conservativeRps - left.conservativeRps;
  });

  const recommendedSlots =
    totalForcekeySearches >= thresholds.minCampaignForcekeySearches && sortedEligible.length >= 2
      ? [...sortedEligible, ...slotReviews.filter((slot) => !slot.eligible)]
      : [...slotReviews];

  recommendedSlots.forEach((slot, idx) => {
    slot.recommendedPosition = idx + 1;
  });

  const currentOrder = slotReviews.map((slot) => slot.keyword);
  const recommendedOrder = recommendedSlots.map((slot) => slot.keyword);
  const reorderSuggested = currentOrder.join('||') !== recommendedOrder.join('||');
  const topCurrent = slotReviews[0];
  const topRecommended = recommendedSlots[0];
  const topDeltaPct = topCurrent && topRecommended
    ? pctDelta(topRecommended.conservativeRps, topCurrent.conservativeRps)
    : 0;

  let confidence: CampaignForcekeyReview['confidence'] = 'insufficient_data';
  let reviewStatus: CampaignForcekeyReview['reviewStatus'] = 'insufficient_data';
  if (totalForcekeySearches >= thresholds.minCampaignForcekeySearches && eligibleSlots.length >= 2) {
    reviewStatus = reorderSuggested ? 'ready' : 'watch';
    if (Math.abs(topDeltaPct) >= 0.25) confidence = 'high';
    else if (Math.abs(topDeltaPct) >= 0.15) confidence = 'medium';
    else confidence = 'low';
  }

  const topObservedNonConfiguredKeywords = observedKeywordMap
    ? Array.from(observedKeywordMap.values())
        .filter((keyword) => !configuredForcekeys.some((configured) => matchesConfiguredForcekey(configured, keyword)))
        .filter((keyword) => keyword.searches > 0 || keyword.revenue > 0)
        .sort((left, right) => {
          const leftRps = left.searches > 0 ? left.revenue / left.searches : 0;
          const rightRps = right.searches > 0 ? right.revenue / right.searches : 0;
          return rightRps - leftRps || right.revenue - left.revenue || right.searches - left.searches;
        })
        .slice(0, thresholds.topNonConfiguredKeywords)
        .map((keyword) => ({
          keyword: keyword.keyword,
          searches: keyword.searches,
          clicks: keyword.clicks,
          revenue: keyword.revenue,
          rps: keyword.searches > 0 ? keyword.revenue / keyword.searches : 0,
          rpc: keyword.clicks > 0 ? keyword.revenue / keyword.clicks : 0,
        }))
    : [];

  const heartbeat = chooseHeartbeatDays(totalForcekeySearches, dayCount, thresholds);
  const geoOpportunities = slotReviews
    .filter((slot) => slot.geoValues.length > 0)
    .map((slot) => {
      const topValues = slot.geoValues.slice(0, 5);
      const launchGeoCampaign = topValues.some(
        (geo) => geo.band === 'premium' && geo.searches >= thresholds.minGeoSearchesPerValue && geo.upliftPct >= thresholds.geoLaunchUpliftPct
      );
      return {
        slot: slot.slot,
        keyword: slot.keyword,
        token: topValues[0]?.token || 'geo',
        launchGeoCampaign,
        rationale: launchGeoCampaign
          ? `top ${topValues[0]?.token || 'geo'} values show >= ${(thresholds.geoLaunchUpliftPct * 100).toFixed(0)}% RPS uplift vs campaign forcekey average`
          : `geo values are informative, but not yet strong enough for a separate geo-targeted launch`,
        topValues,
      } satisfies ForcekeyGeoOpportunity;
    });

  return {
    campaignId: campaign.id,
    campaignName: asString(campaign.name) || campaign.id,
    buyer: asNullableString(campaign.properties?.buyer),
    category: asNullableString(campaign.category),
    article: asNullableString(campaign.properties?.article),
    rsocSite: asNullableString(campaign.properties?.rsocSite || campaign.properties?.domain),
    totalConfiguredForcekeys: configuredForcekeys.length,
    totalForcekeySearches,
    totalForcekeyClicks,
    totalForcekeyRevenue,
    avgForcekeyRps,
    avgForcekeyRpc,
    currentOrder,
    recommendedOrder,
    reorderSuggested,
    confidence,
    reviewStatus,
    heartbeatDays: heartbeat.days,
    heartbeatReason: heartbeat.reason,
    deltaTopVsCurrentPct: topDeltaPct,
    slots: recommendedSlots,
    topObservedNonConfiguredKeywords,
    geoOpportunities,
  };
}

export async function reviewForcekeyRankings(options: ForcekeyReviewOptions): Promise<ForcekeyReviewReport> {
  const organization = options.organization || process.env.STRATEGIS_ORGANIZATION || 'Interlincx';
  const thresholds: ForcekeyReviewThresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) };
  const days = dayRange(options.startDate, options.endDate);
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

  const campaigns = await listCampaigns(organization, options.authToken);
  const filteredCampaigns = campaigns.filter((campaign) => {
    const configuredForcekeys = extractConfiguredForcekeys(campaign);
    if (configuredForcekeys.length === 0) return false;
    if (options.buyer && !normalizedBuyerMatch(campaign.properties?.buyer, options.buyer)) return false;
    if (options.campaignIds && options.campaignIds.length > 0 && !options.campaignIds.includes(campaign.id)) return false;
    return true;
  });

  const keywordRows = readRawKeywordRows(options.startDate, options.endDate);
  const campaignKeywordMap = aggregateKeywordRows(
    keywordRows,
    new Set(filteredCampaigns.map((campaign) => campaign.id))
  );

  const reviews = filteredCampaigns
    .map((campaign) =>
      reviewCampaign(
        campaign,
        extractConfiguredForcekeys(campaign),
        campaignKeywordMap.get(campaign.id),
        thresholds,
        days.length
      )
    )
    .sort((left, right) => {
      if (left.reviewStatus !== right.reviewStatus) {
        const priority = { ready: 0, watch: 1, insufficient_data: 2 } as const;
        return priority[left.reviewStatus] - priority[right.reviewStatus];
      }
      return right.totalForcekeyRevenue - left.totalForcekeyRevenue || right.totalForcekeySearches - left.totalForcekeySearches;
    });

  return {
    generatedAt: new Date().toISOString(),
    dateWindow: {
      start: options.startDate,
      end: options.endDate,
      days: days.length,
    },
    filters: {
      organization,
      buyer: options.buyer || null,
      campaignIds: dedupeOrdered(asArray(options.campaignIds).map((campaignId) => campaignId.trim()).filter(Boolean)),
    },
    thresholds,
    cache: {
      fetchedDates: cache.fetched,
      cachedDates: cache.cached,
      failedDates: cache.failed,
    },
    totals: {
      campaignsReviewed: reviews.length,
      campaignsWithForcekeys: filteredCampaigns.length,
      campaignsReady: reviews.filter((review) => review.reviewStatus === 'ready').length,
      campaignsSuggestingReorder: reviews.filter((review) => review.reorderSuggested).length,
    },
    campaigns: reviews,
  };
}
