import { generateIntentPacket, IntentPacket, IntentPacketInput } from './intentPacket';
import { StrategisApi } from './strategisApi';
import { fetchRolledKeywords } from './s1Keywords';
import fs from 'fs';
import path from 'path';
import DuckDB from 'duckdb';

type SourceHealth = {
  keywordSource: 'rolled_keyword_report' | 'session' | 'widget_csv_fallback';
  latestClosedDateRequested: string;
  latestValidSessionDate: string | null;
  successfulSessionDates: string[];
  failedSessionDates: Array<{ date: string; error: string }>;
};

type KeywordAggregate = {
  keyword: string;
  keywordNorm: string;
  familyKey: string;
  sessions: number;
  monetizedSessions: number;
  revenue: number;
  activeDates: Set<string>;
  categoryRevenue: Map<string, number>;
  categorySessions: Map<string, number>;
};

type CategoryRecencyStats = {
  category: string;
  searches7d: number;
  revenue7d: number;
  fbClicks7d: number;
  spend7d: number;
  revenuePerSearch7d: number;
  searchesPerPaidClick7d: number;
  revenuePerPaidClick7d: number;
  cpc7d: number;
  rpc3d: number;
  dominantRsocSite: string | null;
  dominantBuyer: string | null;
};

export type IntentPacketDiscoveryInput = {
  asOfDate?: string | null;
  baselineDays?: number | null;
  recencyDays?: number | null;
  maxProbeDays?: number | null;
  minSessions?: number | null;
  minRevenue?: number | null;
  maxCandidates?: number | null;
  sessionTimeoutMs?: number | null;
};

export type IntentPacketDiscoveryCandidate = {
  rank: number;
  keyword: string;
  familyKey: string;
  dominantCategory: string | null;
  supportingKeywords: string[];
  baseline: {
    dateStart: string | null;
    dateEnd: string | null;
    sessions: number;
    monetizedSessions: number;
    revenue: number;
    rps: number;
    rpcPerMonetizedSession: number;
    activeDays: number;
  };
  recency: {
    revenuePerSearch7d: number | null;
    searchesPerPaidClick7d: number | null;
    revenuePerPaidClick7d: number | null;
    cpc7d: number | null;
    rpc3d: number | null;
  };
  economics: {
    expectedRevenuePerPaidClick: number;
    expectedContributionMarginPerPaidClick: number | null;
    confidence: number;
  };
  packetInput: IntentPacketInput;
  packet: IntentPacket;
};

export type IntentPacketDiscoveryResult = {
  summary: {
    asOfDate: string;
    latestValidSessionDate: string | null;
    baselineDateStart: string | null;
    baselineDateEnd: string | null;
    baselineDaysRequested: number;
    recencyDaysRequested: number;
    sessionRowsProcessed: number;
    uniqueKeywords: number;
    totalCandidates: number;
    recommendedFirstPacketId: string | null;
  };
  sourceHealth: SourceHealth;
  candidates: IntentPacketDiscoveryCandidate[];
};

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'best', 'by', 'compare', 'for', 'free', 'from', 'get', 'how',
  'in', 'is', 'it', 'kits', 'me', 'near', 'of', 'on', 'options', 'or', 'plan', 'plans', 'quotes', 'rate',
  'rates', 'the', 'to', 'top', 'with', 'you', 'your',
]);

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeKeyword(input: string): string {
  return String(input || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenizeKeyword(input: string): string[] {
  return normalizeKeyword(input)
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function buildFamilyKey(keyword: string): string {
  const tokens = tokenizeKeyword(keyword);
  if (!tokens.length) return normalizeKeyword(keyword);
  return tokens.slice(0, 2).join(' ');
}

function getNumber(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function sumRevenueFromSession(session: any): number {
  if (Array.isArray(session?.revenue_updates) && session.revenue_updates.length > 0) {
    const summed = session.revenue_updates.reduce((total: number, update: any) => total + getNumber(update?.revenue), 0);
    if (summed !== 0) return summed;
  }
  if (session?.total_revenue != null) return getNumber(session.total_revenue);
  if (session?.revenue != null) return getNumber(session.revenue);
  if (session?.estimated_revenue != null) return getNumber(session.estimated_revenue);
  if (session?.revenue_usd != null) return getNumber(session.revenue_usd);
  return 0;
}

function dominantKey(map: Map<string, number>): string | null {
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

function weightedAverage(parts: Array<{ value: number | null; weight: number }>): number {
  let numerator = 0;
  let denominator = 0;
  for (const part of parts) {
    if (part.value == null || !Number.isFinite(part.value)) continue;
    numerator += part.value * part.weight;
    denominator += part.weight;
  }
  return denominator > 0 ? numerator / denominator : 0;
}

async function findLatestValidSessionDate(api: StrategisApi, asOfDate: string, maxProbeDays: number) {
  const latestClosedDateRequested = shiftDate(asOfDate, -1);
  const sourceHealth: SourceHealth = {
    keywordSource: 'session',
    latestClosedDateRequested,
    latestValidSessionDate: null,
    successfulSessionDates: [],
    failedSessionDates: [],
  };

  for (let offset = 1; offset <= maxProbeDays; offset += 1) {
    const candidateDate = shiftDate(asOfDate, -offset);
    try {
      const rows = await api.fetchS1SessionRevenue(candidateDate, false);
      if (rows.length > 0) {
        sourceHealth.latestValidSessionDate = candidateDate;
        sourceHealth.successfulSessionDates.push(candidateDate);
        return sourceHealth;
      }
      sourceHealth.failedSessionDates.push({ date: candidateDate, error: 'No session rows returned' });
    } catch (err: any) {
      sourceHealth.failedSessionDates.push({ date: candidateDate, error: err?.message || 'Unknown error' });
    }
  }

  return sourceHealth;
}

async function collectSessionKeywordAggregates(
  api: StrategisApi,
  latestValidSessionDate: string,
  baselineDays: number,
  sourceHealth: SourceHealth,
  sessionTimeoutMs: number
) {
  const keywordMap = new Map<string, KeywordAggregate>();
  let totalRows = 0;

  for (let offset = 0; offset < baselineDays; offset += 1) {
    const date = shiftDate(latestValidSessionDate, -offset);
    try {
      const rows = await Promise.race<any[]>([
        api.fetchS1SessionRevenue(date, false),
        new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error(`Session endpoint timeout after ${sessionTimeoutMs}ms`)), sessionTimeoutMs)),
      ]);
      sourceHealth.successfulSessionDates.push(date);
      totalRows += rows.length;

      for (const row of rows) {
        const keyword = String(row?.keyword || '').trim();
        if (!keyword) continue;

        const keywordNorm = normalizeKeyword(keyword);
        const familyKey = buildFamilyKey(keywordNorm);
        const revenue = sumRevenueFromSession(row);
        const category = String(row?.category || '').trim() || 'Unknown';

        if (!keywordMap.has(keywordNorm)) {
          keywordMap.set(keywordNorm, {
            keyword,
            keywordNorm,
            familyKey,
            sessions: 0,
            monetizedSessions: 0,
            revenue: 0,
            activeDates: new Set<string>(),
            categoryRevenue: new Map<string, number>(),
            categorySessions: new Map<string, number>(),
          });
        }

        const aggregate = keywordMap.get(keywordNorm)!;
        aggregate.sessions += 1;
        aggregate.revenue += revenue;
        aggregate.activeDates.add(date);
        if (revenue > 0) aggregate.monetizedSessions += 1;
        aggregate.categoryRevenue.set(category, getNumber(aggregate.categoryRevenue.get(category)) + revenue);
        aggregate.categorySessions.set(category, getNumber(aggregate.categorySessions.get(category)) + 1);
      }
    } catch (err: any) {
      sourceHealth.failedSessionDates.push({ date, error: err?.message || 'Unknown error' });
    }
  }

  return { keywordMap, totalRows };
}

async function collectRolledKeywordAggregates(
  api: StrategisApi,
  startDate: string,
  endDate: string,
  sourceHealth: SourceHealth
) {
  const rows = await fetchRolledKeywords({
    start: startDate,
    end: endDate,
    minClicks: 1,
    rolled: true,
    useTemplate: true,
  }, api);

  const keywordMap = new Map<string, KeywordAggregate>();
  for (const row of rows) {
    const keyword = String(row.keyword || '').trim();
    if (!keyword) continue;
    const keywordNorm = normalizeKeyword(keyword);
    const familyKey = buildFamilyKey(keywordNorm);
    const revenue = getNumber(row.estimated_revenue);
    const searches = Math.round(getNumber(row.searches));
    const monetizedSessions = Math.round(getNumber(row.clicks));
    const category = String(row.normalized_category || '').trim() || 'Unknown';

    keywordMap.set(keywordNorm, {
      keyword,
      keywordNorm,
      familyKey,
      sessions: searches,
      monetizedSessions,
      revenue,
      activeDates: new Set<string>([endDate]),
      categoryRevenue: new Map<string, number>([[category, revenue]]),
      categorySessions: new Map<string, number>([[category, searches]]),
    });
  }

  sourceHealth.keywordSource = 'rolled_keyword_report';
  sourceHealth.latestValidSessionDate = endDate;
  sourceHealth.successfulSessionDates = [endDate];
  return { keywordMap, totalRows: rows.length };
}

async function queryCsv(csvPath: string, sql: string): Promise<any[]> {
  const db = new DuckDB.Database(':memory:');
  const conn = db.connect();
  const escapedPath = csvPath.replace(/'/g, "''");

  return new Promise((resolve, reject) => {
    conn.all(
      `
      CREATE TABLE t AS
      SELECT * FROM read_csv_auto('${escapedPath}', header=true, all_varchar=true, ignore_errors=true);
    `,
      (createErr: any) => {
        if (createErr) {
          conn.close();
          db.close();
          reject(createErr);
          return;
        }

        conn.all(sql, (queryErr: any, rows: any[]) => {
          conn.close();
          db.close();
          if (queryErr) {
            reject(queryErr);
          } else {
            resolve(rows || []);
          }
        });
      }
    );
  });
}

async function loadWidgetCsvFallback() {
  const csvPath = path.resolve(__dirname, '../../../data/incoming/syndication_rsoc_online_keyword_widget_daily.csv');
  if (!fs.existsSync(csvPath)) {
    return null;
  }

  const dateRows = await queryCsv(csvPath, `
    SELECT MIN("DATA DATE") AS min_date, MAX("DATA DATE") AS max_date, COUNT(*) AS row_count
    FROM t
  `);
  const dates = dateRows[0];
  const rows = await queryCsv(csvPath, `
    SELECT
      TRIM("KEYWORD") AS keyword,
      SUM(TRY_CAST(COALESCE("TOTAL SELLSIDE SEARCHES", '0') AS DOUBLE)) AS searches,
      SUM(TRY_CAST(COALESCE("SELLSIDE CLICKS", '0') AS DOUBLE)) AS clicks,
      SUM(TRY_CAST(COALESCE("PARTNER NET REVENUE", '0') AS DOUBLE)) AS revenue
    FROM t
    WHERE TRIM("KEYWORD") IS NOT NULL AND TRIM("KEYWORD") != ''
    GROUP BY TRIM("KEYWORD")
    ORDER BY revenue DESC
  `);

  const keywordMap = new Map<string, KeywordAggregate>();
  for (const row of rows) {
    const keyword = String(row.keyword || '').trim();
    if (!keyword) continue;
    const keywordNorm = normalizeKeyword(keyword);
    keywordMap.set(keywordNorm, {
      keyword,
      keywordNorm,
      familyKey: buildFamilyKey(keywordNorm),
      sessions: Math.round(getNumber(row.searches)),
      monetizedSessions: Math.round(getNumber(row.clicks)),
      revenue: getNumber(row.revenue),
      activeDates: new Set<string>(dates?.max_date ? [String(dates.max_date)] : []),
      categoryRevenue: new Map<string, number>(),
      categorySessions: new Map<string, number>(),
    });
  }

  return {
    keywordMap,
    totalRows: getNumber(dates?.row_count),
    minDate: dates?.min_date ? String(dates.min_date) : null,
    maxDate: dates?.max_date ? String(dates.max_date) : null,
  };
}

async function buildCategoryRecencyStats(api: StrategisApi, asOfDate: string, recencyDays: number) {
  const dailyByCampaign = new Map<string, { category: string; rsocSite: string | null; buyer: string | null; searches: number; revenue: number }>();
  const categorySearchRevenue = new Map<string, { searches: number; revenue: number; siteRevenue: Map<string, number>; buyerRevenue: Map<string, number> }>();
  const categorySpend = new Map<string, { spend: number; fbClicks: number }>();
  const categoryRpc = new Map<string, { revenue: number; clicks: number }>();

  for (let offset = 1; offset <= recencyDays; offset += 1) {
    const date = shiftDate(asOfDate, -offset);
    const [dailyRows, fbRows, rpcRows] = await Promise.all([
      api.fetchS1Daily(date, false),
      api.fetchFacebookReport(date),
      api.fetchS1RpcAverage(date),
    ]);

    for (const row of dailyRows) {
      const strategisCampaignId = String(row?.strategisCampaignId || row?.campaignId || '').trim();
      if (!strategisCampaignId) continue;
      const category = String(row?.category || '').trim() || 'Unknown';
      const rsocSite = row?.rsocSite ? String(row.rsocSite).trim() : null;
      const buyer = row?.buyer ? String(row.buyer).trim() : null;
      const searches = getNumber(row?.searches);
      const revenue = getNumber(row?.estimated_revenue || row?.revenue || row?.avgS1Revenue);

      dailyByCampaign.set(`${date}|${strategisCampaignId}`, { category, rsocSite, buyer, searches, revenue });

      if (!categorySearchRevenue.has(category)) {
        categorySearchRevenue.set(category, {
          searches: 0,
          revenue: 0,
          siteRevenue: new Map<string, number>(),
          buyerRevenue: new Map<string, number>(),
        });
      }

      const categoryEntry = categorySearchRevenue.get(category)!;
      categoryEntry.searches += searches;
      categoryEntry.revenue += revenue;
      if (rsocSite) categoryEntry.siteRevenue.set(rsocSite, getNumber(categoryEntry.siteRevenue.get(rsocSite)) + revenue);
      if (buyer) categoryEntry.buyerRevenue.set(buyer, getNumber(categoryEntry.buyerRevenue.get(buyer)) + revenue);
    }

    for (const row of fbRows) {
      const strategyCampaignId = String(row?.strategisCampaignId || row?.campaignId || '').trim();
      const campaignMetrics = dailyByCampaign.get(`${date}|${strategyCampaignId}`);
      const category = campaignMetrics?.category || String(row?.category || '').trim() || 'Unknown';
      if (!categorySpend.has(category)) {
        categorySpend.set(category, { spend: 0, fbClicks: 0 });
      }
      const spendEntry = categorySpend.get(category)!;
      spendEntry.spend += getNumber(row?.spend);
      spendEntry.fbClicks += getNumber(row?.clicks);
    }

    for (const row of rpcRows) {
      const category = String(row?.category || '').trim() || 'Unknown';
      if (!categoryRpc.has(category)) {
        categoryRpc.set(category, { revenue: 0, clicks: 0 });
      }
      const rpcEntry = categoryRpc.get(category)!;
      rpcEntry.revenue += getNumber(row?.avgS1Revenue);
      rpcEntry.clicks += getNumber(row?.avgS1Clicks);
    }
  }

  const out = new Map<string, CategoryRecencyStats>();
  for (const [category, searchRevenue] of categorySearchRevenue.entries()) {
    const spendStats = categorySpend.get(category) || { spend: 0, fbClicks: 0 };
    const rpcStats = categoryRpc.get(category) || { revenue: 0, clicks: 0 };
    const revenuePerSearch7d = searchRevenue.searches > 0 ? searchRevenue.revenue / searchRevenue.searches : 0;
    const searchesPerPaidClick7d = spendStats.fbClicks > 0 ? searchRevenue.searches / spendStats.fbClicks : 0;
    const revenuePerPaidClick7d = spendStats.fbClicks > 0 ? searchRevenue.revenue / spendStats.fbClicks : 0;
    const cpc7d = spendStats.fbClicks > 0 ? spendStats.spend / spendStats.fbClicks : 0;
    const rpc3d = rpcStats.clicks > 0 ? rpcStats.revenue / rpcStats.clicks : 0;

    out.set(category, {
      category,
      searches7d: searchRevenue.searches,
      revenue7d: searchRevenue.revenue,
      fbClicks7d: spendStats.fbClicks,
      spend7d: spendStats.spend,
      revenuePerSearch7d,
      searchesPerPaidClick7d,
      revenuePerPaidClick7d,
      cpc7d,
      rpc3d,
      dominantRsocSite: dominantKey(searchRevenue.siteRevenue),
      dominantBuyer: dominantKey(searchRevenue.buyerRevenue),
    });
  }

  return out;
}

function buildSupportingKeywords(keywordMap: Map<string, KeywordAggregate>, familyKey: string, primaryKeywordNorm: string) {
  return Array.from(keywordMap.values())
    .filter((aggregate) => aggregate.familyKey === familyKey && aggregate.keywordNorm !== primaryKeywordNorm)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4)
    .map((aggregate) => aggregate.keyword);
}

function computeConfidence(keyword: KeywordAggregate, categoryStats: CategoryRecencyStats | null, sourceHealth: SourceHealth) {
  const activeDayRatio = keyword.activeDates.size / Math.max(1, sourceHealth.successfulSessionDates.length);
  const sampleScore = Math.min(45, keyword.sessions * 1.2);
  const monetizationScore = Math.min(25, keyword.monetizedSessions * 2.5);
  const stabilityScore = Math.min(15, Math.round(activeDayRatio * 15));
  const categoryScore = categoryStats ? Math.min(15, Math.round(Math.min(categoryStats.searches7d, 5000) / 333)) : 0;
  return Math.max(1, Math.min(100, Math.round(sampleScore + monetizationScore + stabilityScore + categoryScore)));
}

export async function discoverIntentPackets(input: IntentPacketDiscoveryInput = {}): Promise<IntentPacketDiscoveryResult> {
  const asOfDate = String(input.asOfDate || new Date().toISOString().slice(0, 10));
  const baselineDays = Math.max(7, Number(input.baselineDays || 28));
  const recencyDays = Math.max(3, Number(input.recencyDays || 7));
  const maxProbeDays = Math.max(3, Number(input.maxProbeDays || 7));
  const minSessions = Math.max(3, Number(input.minSessions || 10));
  const minRevenue = Math.max(0, Number(input.minRevenue || 10));
  const maxCandidates = Math.max(1, Number(input.maxCandidates || 10));
  const sessionTimeoutMs = Math.max(1000, Number(input.sessionTimeoutMs || 8000));

  const api = new StrategisApi();
  const sourceHealth = await findLatestValidSessionDate(api, asOfDate, maxProbeDays);
  let keywordMap = new Map<string, KeywordAggregate>();
  let totalRows = 0;
  let baselineDateStart: string | null = null;
  let baselineDateEnd: string | null = null;

  const preferredBaselineEnd = shiftDate(asOfDate, -1);
  const preferredBaselineStart = shiftDate(preferredBaselineEnd, -(baselineDays - 1));
  try {
    const rolled = await collectRolledKeywordAggregates(api, preferredBaselineStart, preferredBaselineEnd, sourceHealth);
    keywordMap = rolled.keywordMap;
    totalRows = rolled.totalRows;
    baselineDateStart = preferredBaselineStart;
    baselineDateEnd = preferredBaselineEnd;
  } catch (err: any) {
    sourceHealth.failedSessionDates.push({
      date: `${preferredBaselineStart}..${preferredBaselineEnd}`,
      error: `Rolled keyword report failed: ${err?.message || 'Unknown error'}`,
    });
  }

  if (!keywordMap.size && sourceHealth.latestValidSessionDate) {
    const collected = await collectSessionKeywordAggregates(api, sourceHealth.latestValidSessionDate, baselineDays, sourceHealth, sessionTimeoutMs);
    keywordMap = collected.keywordMap;
    totalRows = collected.totalRows;
    baselineDateEnd = sourceHealth.latestValidSessionDate;
    baselineDateStart = shiftDate(baselineDateEnd, -(baselineDays - 1));
  }

  const shouldUseCsvFallback =
    !keywordMap.size &&
    (!sourceHealth.latestValidSessionDate || sourceHealth.successfulSessionDates.length < Math.max(3, Math.floor(baselineDays / 4)));
  if (shouldUseCsvFallback) {
    const fallback = await loadWidgetCsvFallback();
    if (fallback) {
      sourceHealth.keywordSource = 'widget_csv_fallback';
      sourceHealth.latestValidSessionDate = fallback.maxDate;
      sourceHealth.successfulSessionDates = fallback.maxDate ? [fallback.maxDate] : [];
      keywordMap = fallback.keywordMap;
      totalRows = fallback.totalRows;
      baselineDateStart = fallback.minDate;
      baselineDateEnd = fallback.maxDate;
    }
  }

  if (!keywordMap.size) {
    return {
      summary: {
        asOfDate,
        latestValidSessionDate: sourceHealth.latestValidSessionDate,
        baselineDateStart,
        baselineDateEnd,
        baselineDaysRequested: baselineDays,
        recencyDaysRequested: recencyDays,
        sessionRowsProcessed: 0,
        uniqueKeywords: 0,
        totalCandidates: 0,
        recommendedFirstPacketId: null,
      },
      sourceHealth,
      candidates: [],
    };
  }
  const categoryRecency = await buildCategoryRecencyStats(api, asOfDate, recencyDays);

  const candidates = Array.from(keywordMap.values())
    .filter((keyword) => keyword.sessions >= minSessions && keyword.revenue >= minRevenue)
    .map((keyword) => {
      const dominantCategory = dominantKey(keyword.categoryRevenue);
      const categoryStats = dominantCategory ? categoryRecency.get(dominantCategory) || null : null;
      const supportingKeywords = buildSupportingKeywords(keywordMap, keyword.familyKey, keyword.keywordNorm);
      const baselineRps = keyword.sessions > 0 ? keyword.revenue / keyword.sessions : 0;
      const rpcPerMonetizedSession = keyword.monetizedSessions > 0 ? keyword.revenue / keyword.monetizedSessions : 0;
      const searchesPerPaidClick7d = categoryStats?.searchesPerPaidClick7d ?? null;
      const categoryRevenuePerPaidClick7d = categoryStats?.revenuePerPaidClick7d ?? null;
      const categoryRpc3d = categoryStats?.rpc3d ?? null;
      const categoryCpc7d = categoryStats?.cpc7d ?? null;
      const exactValuePerPaidClick = searchesPerPaidClick7d != null ? baselineRps * searchesPerPaidClick7d : null;
      const expectedRevenuePerPaidClick = weightedAverage([
        { value: exactValuePerPaidClick, weight: 0.6 },
        { value: categoryRevenuePerPaidClick7d, weight: 0.25 },
        { value: categoryRpc3d, weight: 0.15 },
      ]);
      const expectedContributionMarginPerPaidClick =
        categoryCpc7d != null && categoryCpc7d > 0 ? expectedRevenuePerPaidClick - categoryCpc7d : null;
      const confidence = computeConfidence(keyword, categoryStats, sourceHealth);

      const packetInput: IntentPacketInput = {
        primaryKeyword: keyword.keyword,
        supportingKeywords,
        rsocSite: categoryStats?.dominantRsocSite || null,
        buyer: categoryStats?.dominantBuyer || null,
        market: 'US',
        keywordEvidence: [
          {
            keyword: keyword.keyword,
            revenue: Number(keyword.revenue.toFixed(4)),
            clicks: keyword.monetizedSessions,
            rpc: Number(baselineRps.toFixed(4)),
            sessions: keyword.sessions,
          },
          ...supportingKeywords.slice(0, 3).map((supportingKeyword) => {
            const supporting = keywordMap.get(normalizeKeyword(supportingKeyword));
            return {
              keyword: supportingKeyword,
              revenue: Number((supporting?.revenue || 0).toFixed(4)),
              clicks: supporting?.monetizedSessions || 0,
              rpc: supporting && supporting.sessions > 0 ? Number((supporting.revenue / supporting.sessions).toFixed(4)) : 0,
              sessions: supporting?.sessions || 0,
            };
          }),
        ],
      };

      const packet = generateIntentPacket(packetInput);
      return {
        keyword: keyword.keyword,
        familyKey: keyword.familyKey,
        dominantCategory,
        supportingKeywords,
        baseline: {
          dateStart: baselineDateStart,
          dateEnd: baselineDateEnd,
          sessions: keyword.sessions,
          monetizedSessions: keyword.monetizedSessions,
          revenue: Number(keyword.revenue.toFixed(4)),
          rps: Number(baselineRps.toFixed(4)),
          rpcPerMonetizedSession: Number(rpcPerMonetizedSession.toFixed(4)),
          activeDays: keyword.activeDates.size,
        },
        recency: {
          revenuePerSearch7d: categoryStats ? Number(categoryStats.revenuePerSearch7d.toFixed(4)) : null,
          searchesPerPaidClick7d: categoryStats ? Number(categoryStats.searchesPerPaidClick7d.toFixed(4)) : null,
          revenuePerPaidClick7d: categoryStats ? Number(categoryStats.revenuePerPaidClick7d.toFixed(4)) : null,
          cpc7d: categoryStats ? Number(categoryStats.cpc7d.toFixed(4)) : null,
          rpc3d: categoryStats ? Number(categoryStats.rpc3d.toFixed(4)) : null,
        },
        economics: {
          expectedRevenuePerPaidClick: Number(expectedRevenuePerPaidClick.toFixed(4)),
          expectedContributionMarginPerPaidClick:
            expectedContributionMarginPerPaidClick != null ? Number(expectedContributionMarginPerPaidClick.toFixed(4)) : null,
          confidence,
        },
        packetInput,
        packet,
      };
    })
    .sort((a, b) => {
      const marginDiff = (b.economics.expectedContributionMarginPerPaidClick ?? -Infinity) - (a.economics.expectedContributionMarginPerPaidClick ?? -Infinity);
      if (marginDiff !== 0) return marginDiff;
      const valueDiff = b.economics.expectedRevenuePerPaidClick - a.economics.expectedRevenuePerPaidClick;
      if (valueDiff !== 0) return valueDiff;
      return b.packet.scores.launchPriority - a.packet.scores.launchPriority;
    })
    .slice(0, maxCandidates)
    .map((candidate, index) => ({
      rank: index + 1,
      ...candidate,
    }));

  return {
    summary: {
      asOfDate,
      latestValidSessionDate: sourceHealth.latestValidSessionDate,
      baselineDateStart,
      baselineDateEnd,
      baselineDaysRequested: baselineDays,
      recencyDaysRequested: recencyDays,
      sessionRowsProcessed: totalRows,
      uniqueKeywords: keywordMap.size,
      totalCandidates: candidates.length,
      recommendedFirstPacketId: candidates[0]?.packet.id || null,
    },
    sourceHealth,
    candidates,
  };
}
