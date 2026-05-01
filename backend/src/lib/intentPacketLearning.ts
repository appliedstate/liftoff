import { randomUUID } from 'crypto';
import { allRows, runSql, sqlNumber, sqlString } from './monitoringDb';

export type IntentAxiomNamespace = 'root' | 'modifier' | 'audience' | 'constraint' | 'token';

export type IntentAxiomFeature = {
  namespace: IntentAxiomNamespace;
  key: string;
  label: string;
};

export type IntentPacketObservationInput = {
  observationId?: string | null;
  observedAt?: string | null;
  source: string;
  market?: string | null;
  packetId?: string | null;
  packetName?: string | null;
  campaignId?: string | null;
  primaryKeyword: string;
  supportingKeywords?: string[];
  searches?: number | null;
  monetizedClicks?: number | null;
  revenue?: number | null;
  paidImpressions?: number | null;
  paidClicks?: number | null;
  paidSpend?: number | null;
  approved?: boolean | null;
  rejected?: boolean | null;
  reviewFlag?: boolean | null;
  metadata?: Record<string, any> | null;
};

type StoredObservation = {
  observation_id: string;
  observed_at: string;
  source: string;
  market: string | null;
  packet_id: string | null;
  packet_name: string | null;
  campaign_id: string | null;
  primary_keyword: string;
  supporting_keywords_json: string | null;
  searches: number | null;
  monetized_clicks: number | null;
  revenue: number | null;
  paid_impressions: number | null;
  paid_clicks: number | null;
  paid_spend: number | null;
  approved: boolean | null;
  rejected: boolean | null;
  review_flag: boolean | null;
  metadata_json: string | null;
};

export type IntentPacketLearningPrior = {
  feature: IntentAxiomFeature;
  observations: number;
  searches: number;
  monetizedClicks: number;
  revenue: number;
  paidImpressions: number;
  paidClicks: number;
  paidSpend: number;
  decisions: number;
  approvals: number;
  rejections: number;
  reviewFlags: number;
  searchToClickRate: number | null;
  revenuePerClick: number | null;
  revenuePerSearch: number | null;
  paidCtr: number | null;
  cpc: number | null;
  approvalRate: number | null;
  shrunk: {
    searchToClickRate: number | null;
    revenuePerClick: number | null;
    revenuePerSearch: number | null;
    paidCtr: number | null;
    cpc: number | null;
    approvalRate: number | null;
  };
  deltas: {
    searchToClickRate: number | null;
    revenuePerClick: number | null;
    revenuePerSearch: number | null;
    paidCtr: number | null;
    cpc: number | null;
    approvalRate: number | null;
  };
};

export type IntentPacketLearningReport = {
  summary: {
    observations: number;
    searchedObservations: number;
    monetizedObservations: number;
    paidObservations: number;
    features: number;
    keywords?: string[];
  };
  globalBaseline: {
    searchToClickRate: number | null;
    revenuePerClick: number | null;
    revenuePerSearch: number | null;
    paidCtr: number | null;
    cpc: number | null;
    approvalRate: number | null;
  };
  priors: IntentPacketLearningPrior[];
  packetSummary?: {
    features: IntentAxiomFeature[];
    averages: {
      searchToClickRateDelta: number | null;
      revenuePerClickDelta: number | null;
      revenuePerSearchDelta: number | null;
      paidCtrDelta: number | null;
      cpcDelta: number | null;
      approvalRateDelta: number | null;
    };
    notes: string[];
  };
};

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'get', 'how', 'i', 'in', 'is', 'it', 'me',
  'my', 'near', 'of', 'on', 'or', 'the', 'to', 'with', 'you', 'your',
]);

const COMMERCIAL_MODIFIERS: Array<{ key: string; label: string; patterns: RegExp[] }> = [
  { key: 'free', label: 'Free', patterns: [/\bfree\b/i] },
  { key: 'cheap', label: 'Cheap / Low Cost', patterns: [/\bcheap\b/i, /\bcheapest\b/i, /\blow cost\b/i, /\blow rate\b/i] },
  { key: 'best', label: 'Best / Top', patterns: [/\bbest\b/i, /\btop\b/i] },
  { key: 'online', label: 'Online / Instant', patterns: [/\bonline\b/i, /\binstant\b/i] },
];

const AUDIENCE_PATTERNS: Array<{ key: string; label: string; patterns: RegExp[] }> = [
  { key: 'seniors', label: 'Seniors', patterns: [/\bsenior\b/i, /\bseniors\b/i, /\bover\s+\d{2}s?\b/i] },
  { key: 'low_income', label: 'Low Income / Assistance', patterns: [/\blow income\b/i, /\bgovernment\b/i, /\bsnap\b/i, /\bebt\b/i] },
];

const CONSTRAINT_PATTERNS: Array<{ key: string; label: string; patterns: RegExp[] }> = [
  { key: 'full_coverage', label: 'Full Coverage', patterns: [/\bfull coverage\b/i] },
  { key: 'down_payment', label: 'Down Payment', patterns: [/\bdown payment\b/i, /\bzero down\b/i] },
  { key: 'geo', label: 'Geo', patterns: [/\bnear me\b/i, /\bhouston\b/i, /\blewisville\b/i, /\bflorida\b/i, /\bcolorado springs\b/i, /\btx\b/i] },
  { key: 'qualification', label: 'Qualification', patterns: [/\bdelivery driver\b/i, /\bfinanced car\b/i, /\btype 2 diabetes\b/i, /\brecipients\b/i] },
];

const TOKEN_PATTERNS: Array<{ key: string; label: string; patterns: RegExp[] }> = [
  { key: 'quote', label: 'Contains Quote', patterns: [/\bquote\b/i, /\bquotes\b/i] },
  { key: 'free', label: 'Contains Free', patterns: [/\bfree\b/i] },
  { key: 'senior', label: 'Contains Senior', patterns: [/\bsenior\b/i, /\bseniors\b/i, /\bover\s+\d{2}s?\b/i] },
  { key: 'cheap', label: 'Contains Cheap', patterns: [/\bcheap\b/i, /\bcheapest\b/i, /\blow cost\b/i] },
  { key: 'online', label: 'Contains Online', patterns: [/\bonline\b/i, /\binstant\b/i] },
];

function sqlBoolean(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return value ? 'TRUE' : 'FALSE';
}

function normalizeKeyword(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenizeKeyword(value: string): string[] {
  return normalizeKeyword(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function matchesAnyPattern(keyword: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(keyword));
}

function stripPatterns(keyword: string, patternGroups: Array<{ patterns: RegExp[] }>): string {
  let out = ` ${normalizeKeyword(keyword)} `;
  for (const group of patternGroups) {
    for (const pattern of group.patterns) {
      out = out.replace(new RegExp(pattern.source, 'ig'), ' ');
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

function deriveRootPhrase(keyword: string): string {
  const stripped = stripPatterns(keyword, [...COMMERCIAL_MODIFIERS, ...AUDIENCE_PATTERNS, ...CONSTRAINT_PATTERNS]);
  return stripped || normalizeKeyword(keyword);
}

function getNumber(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function averageNullable(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function addFeature(out: Map<string, IntentAxiomFeature>, feature: IntentAxiomFeature) {
  out.set(`${feature.namespace}:${feature.key}`, feature);
}

export function extractIntentAxiomFeaturesFromKeywords(keywords: string[]): IntentAxiomFeature[] {
  const out = new Map<string, IntentAxiomFeature>();
  for (const keyword of keywords.map((value) => String(value || '').trim()).filter(Boolean)) {
    const root = deriveRootPhrase(keyword);
    if (root) {
      addFeature(out, { namespace: 'root', key: root, label: root });
    }

    for (const group of COMMERCIAL_MODIFIERS) {
      if (matchesAnyPattern(keyword, group.patterns)) {
        addFeature(out, { namespace: 'modifier', key: group.key, label: group.label });
      }
    }
    for (const group of AUDIENCE_PATTERNS) {
      if (matchesAnyPattern(keyword, group.patterns)) {
        addFeature(out, { namespace: 'audience', key: group.key, label: group.label });
      }
    }
    for (const group of CONSTRAINT_PATTERNS) {
      if (matchesAnyPattern(keyword, group.patterns)) {
        addFeature(out, { namespace: 'constraint', key: group.key, label: group.label });
      }
    }
    for (const group of TOKEN_PATTERNS) {
      if (matchesAnyPattern(keyword, group.patterns)) {
        addFeature(out, { namespace: 'token', key: group.key, label: group.label });
      }
    }
  }
  return Array.from(out.values());
}

function observationKeywords(input: IntentPacketObservationInput): string[] {
  return [input.primaryKeyword, ...(input.supportingKeywords || [])].filter(Boolean);
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function recordIntentPacketObservations(conn: any, inputs: IntentPacketObservationInput[]): Promise<{ inserted: number }> {
  const items = inputs.filter((input) => String(input.primaryKeyword || '').trim()).map((input) => {
    const observationId = String(input.observationId || randomUUID());
    const observedAt = String(input.observedAt || new Date().toISOString());
    const supportingKeywords = Array.isArray(input.supportingKeywords) ? input.supportingKeywords.map((value) => String(value || '').trim()).filter(Boolean) : [];
    const features = extractIntentAxiomFeaturesFromKeywords([input.primaryKeyword, ...supportingKeywords]);
    return {
      observationId,
      observedAt,
      source: String(input.source || 'manual'),
      market: input.market ? String(input.market) : null,
      packetId: input.packetId ? String(input.packetId) : null,
      packetName: input.packetName ? String(input.packetName) : null,
      campaignId: input.campaignId ? String(input.campaignId) : null,
      primaryKeyword: String(input.primaryKeyword || '').trim(),
      supportingKeywords,
      searches: input.searches ?? null,
      monetizedClicks: input.monetizedClicks ?? null,
      revenue: input.revenue ?? null,
      paidImpressions: input.paidImpressions ?? null,
      paidClicks: input.paidClicks ?? null,
      paidSpend: input.paidSpend ?? null,
      approved: input.approved ?? null,
      rejected: input.rejected ?? null,
      reviewFlag: input.reviewFlag ?? null,
      metadata: input.metadata || null,
      features,
    };
  });

  if (!items.length) return { inserted: 0 };

  const observationValues = items.map((item) => `(
    ${sqlString(item.observationId)},
    ${sqlString(item.observedAt)},
    ${sqlString(item.source)},
    ${sqlString(item.market)},
    ${sqlString(item.packetId)},
    ${sqlString(item.packetName)},
    ${sqlString(item.campaignId)},
    ${sqlString(item.primaryKeyword)},
    ${sqlString(JSON.stringify(item.supportingKeywords))},
    ${sqlNumber(item.searches == null ? null : Number(item.searches))},
    ${sqlNumber(item.monetizedClicks == null ? null : Number(item.monetizedClicks))},
    ${sqlNumber(item.revenue == null ? null : Number(item.revenue))},
    ${sqlNumber(item.paidImpressions == null ? null : Number(item.paidImpressions))},
    ${sqlNumber(item.paidClicks == null ? null : Number(item.paidClicks))},
    ${sqlNumber(item.paidSpend == null ? null : Number(item.paidSpend))},
    ${sqlBoolean(item.approved)},
    ${sqlBoolean(item.rejected)},
    ${sqlBoolean(item.reviewFlag)},
    ${sqlString(item.metadata ? JSON.stringify(item.metadata) : null)}
  )`);

  await runSql(conn, `
    INSERT INTO intent_packet_observations (
      observation_id,
      observed_at,
      source,
      market,
      packet_id,
      packet_name,
      campaign_id,
      primary_keyword,
      supporting_keywords_json,
      searches,
      monetized_clicks,
      revenue,
      paid_impressions,
      paid_clicks,
      paid_spend,
      approved,
      rejected,
      review_flag,
      metadata_json
    )
    VALUES ${observationValues.join(',\n')}
  `);

  const featureValues = items.flatMap((item) => item.features.map((feature) => `(
    ${sqlString(item.observationId)},
    ${sqlString(feature.namespace)},
    ${sqlString(feature.key)},
    ${sqlString(feature.label)}
  )`));

  if (featureValues.length) {
    await runSql(conn, `
      INSERT INTO intent_packet_observation_axioms (
        observation_id,
        namespace,
        axiom_key,
        axiom_label
      )
      VALUES ${featureValues.join(',\n')}
    `);
  }

  return { inserted: items.length };
}

export async function clearIntentPacketObservationsBySource(conn: any, source: string, startDate?: string | null, endDate?: string | null): Promise<void> {
  const clauses = [`source = ${sqlString(source)}`];
  if (startDate) clauses.push(`CAST(observed_at AS DATE) >= DATE ${sqlString(startDate)}`);
  if (endDate) clauses.push(`CAST(observed_at AS DATE) <= DATE ${sqlString(endDate)}`);
  const matchingRows = await allRows<{ observation_id: string }>(conn, `
    SELECT observation_id
    FROM intent_packet_observations
    WHERE ${clauses.join(' AND ')}
  `);
  if (!matchingRows.length) return;
  const ids = matchingRows.map((row) => sqlString(row.observation_id)).join(', ');
  await runSql(conn, `DELETE FROM intent_packet_observation_axioms WHERE observation_id IN (${ids})`);
  await runSql(conn, `DELETE FROM intent_packet_observations WHERE observation_id IN (${ids})`);
}

export async function loadIntentPacketObservations(
  conn: any,
  filters: {
    keywords?: string[] | null;
    featureKeys?: string[] | null;
    namespaces?: IntentAxiomNamespace[] | null;
    sources?: string[] | null;
    startDate?: string | null;
    endDate?: string | null;
    market?: string | null;
  } = {}
): Promise<Array<StoredObservation & { features: IntentAxiomFeature[] }>> {
  const clauses: string[] = [];
  if (filters.sources?.length) {
    clauses.push(`source IN (${filters.sources.map((value) => sqlString(value)).join(', ')})`);
  }
  if (filters.startDate) clauses.push(`CAST(observed_at AS DATE) >= DATE ${sqlString(filters.startDate)}`);
  if (filters.endDate) clauses.push(`CAST(observed_at AS DATE) <= DATE ${sqlString(filters.endDate)}`);
  if (filters.market) clauses.push(`market = ${sqlString(filters.market)}`);

  if (filters.keywords?.length) {
    const tokenSets = filters.keywords.map((keyword) => new Set(tokenizeKeyword(keyword)));
    const rows = await allRows<StoredObservation>(conn, `
      SELECT *
      FROM intent_packet_observations
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY observed_at DESC
    `);
    const filtered = rows.filter((row) => {
      const rowTokens = new Set(tokenizeKeyword([row.primary_keyword, ...parseJsonArray(row.supporting_keywords_json)].join(' ')));
      return tokenSets.some((tokens) => {
        let matches = 0;
        for (const token of tokens) {
          if (rowTokens.has(token)) matches += 1;
        }
        return matches >= Math.min(2, Math.max(1, tokens.size));
      });
    });
    return attachFeatures(conn, filtered, filters);
  }

  const rows = await allRows<StoredObservation>(conn, `
    SELECT *
    FROM intent_packet_observations
    ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY observed_at DESC
  `);
  return attachFeatures(conn, rows, filters);
}

async function attachFeatures(
  conn: any,
  rows: StoredObservation[],
  filters: {
    featureKeys?: string[] | null;
    namespaces?: IntentAxiomNamespace[] | null;
  }
): Promise<Array<StoredObservation & { features: IntentAxiomFeature[] }>> {
  if (!rows.length) return [];
  const ids = rows.map((row) => sqlString(row.observation_id)).join(', ');
  const featureClauses = [`observation_id IN (${ids})`];
  if (filters.featureKeys?.length) {
    featureClauses.push(`axiom_key IN (${filters.featureKeys.map((value) => sqlString(value)).join(', ')})`);
  }
  if (filters.namespaces?.length) {
    featureClauses.push(`namespace IN (${filters.namespaces.map((value) => sqlString(value)).join(', ')})`);
  }
  const featureRows = await allRows<{
    observation_id: string;
    namespace: IntentAxiomNamespace;
    axiom_key: string;
    axiom_label: string;
  }>(conn, `
    SELECT observation_id, namespace, axiom_key, axiom_label
    FROM intent_packet_observation_axioms
    WHERE ${featureClauses.join(' AND ')}
  `);
  const featureMap = new Map<string, IntentAxiomFeature[]>();
  for (const row of featureRows) {
    const features = featureMap.get(row.observation_id) || [];
    features.push({ namespace: row.namespace, key: row.axiom_key, label: row.axiom_label });
    featureMap.set(row.observation_id, features);
  }
  return rows
    .map((row) => ({
      ...row,
      features: featureMap.get(row.observation_id) || [],
    }))
    .filter((row) => row.features.length > 0 || (!filters.featureKeys?.length && !filters.namespaces?.length));
}

function shrunkRate(value: number | null, sampleSize: number, globalValue: number | null, priorWeight: number): number | null {
  if (value == null || globalValue == null) return value ?? globalValue;
  const weight = Math.max(0, sampleSize);
  return ((value * weight) + (globalValue * priorWeight)) / (weight + priorWeight);
}

function buildBaseline(rows: Array<StoredObservation & { features: IntentAxiomFeature[] }>) {
  const totals = rows.reduce((acc, row) => {
    acc.searches += getNumber(row.searches);
    acc.monetizedClicks += getNumber(row.monetized_clicks);
    acc.revenue += getNumber(row.revenue);
    acc.paidImpressions += getNumber(row.paid_impressions);
    acc.paidClicks += getNumber(row.paid_clicks);
    acc.paidSpend += getNumber(row.paid_spend);
    if (row.approved !== null || row.rejected !== null) acc.decisions += 1;
    if (row.approved === true) acc.approvals += 1;
    if (row.rejected === true) acc.rejections += 1;
    return acc;
  }, {
    searches: 0,
    monetizedClicks: 0,
    revenue: 0,
    paidImpressions: 0,
    paidClicks: 0,
    paidSpend: 0,
    decisions: 0,
    approvals: 0,
    rejections: 0,
  });

  return {
    searchToClickRate: totals.searches > 0 ? totals.monetizedClicks / totals.searches : null,
    revenuePerClick: totals.monetizedClicks > 0 ? totals.revenue / totals.monetizedClicks : null,
    revenuePerSearch: totals.searches > 0 ? totals.revenue / totals.searches : null,
    paidCtr: totals.paidImpressions > 0 ? totals.paidClicks / totals.paidImpressions : null,
    cpc: totals.paidClicks > 0 ? totals.paidSpend / totals.paidClicks : null,
    approvalRate: totals.decisions > 0 ? totals.approvals / totals.decisions : null,
  };
}

export function computeIntentAxiomPriors(
  rows: Array<StoredObservation & { features: IntentAxiomFeature[] }>,
  focusKeywords?: string[] | null
): IntentPacketLearningReport {
  const baseline = buildBaseline(rows);
  const featureBuckets = new Map<string, {
    feature: IntentAxiomFeature;
    observations: number;
    searches: number;
    monetizedClicks: number;
    revenue: number;
    paidImpressions: number;
    paidClicks: number;
    paidSpend: number;
    decisions: number;
    approvals: number;
    rejections: number;
    reviewFlags: number;
  }>();

  for (const row of rows) {
    for (const feature of row.features) {
      const key = `${feature.namespace}:${feature.key}`;
      if (!featureBuckets.has(key)) {
        featureBuckets.set(key, {
          feature,
          observations: 0,
          searches: 0,
          monetizedClicks: 0,
          revenue: 0,
          paidImpressions: 0,
          paidClicks: 0,
          paidSpend: 0,
          decisions: 0,
          approvals: 0,
          rejections: 0,
          reviewFlags: 0,
        });
      }
      const bucket = featureBuckets.get(key)!;
      bucket.observations += 1;
      bucket.searches += getNumber(row.searches);
      bucket.monetizedClicks += getNumber(row.monetized_clicks);
      bucket.revenue += getNumber(row.revenue);
      bucket.paidImpressions += getNumber(row.paid_impressions);
      bucket.paidClicks += getNumber(row.paid_clicks);
      bucket.paidSpend += getNumber(row.paid_spend);
      if (row.approved !== null || row.rejected !== null) bucket.decisions += 1;
      if (row.approved === true) bucket.approvals += 1;
      if (row.rejected === true) bucket.rejections += 1;
      if (row.review_flag === true) bucket.reviewFlags += 1;
    }
  }

  const priors = Array.from(featureBuckets.values())
    .map((bucket): IntentPacketLearningPrior => {
      const searchToClickRate = bucket.searches > 0 ? bucket.monetizedClicks / bucket.searches : null;
      const revenuePerClick = bucket.monetizedClicks > 0 ? bucket.revenue / bucket.monetizedClicks : null;
      const revenuePerSearch = bucket.searches > 0 ? bucket.revenue / bucket.searches : null;
      const paidCtr = bucket.paidImpressions > 0 ? bucket.paidClicks / bucket.paidImpressions : null;
      const cpc = bucket.paidClicks > 0 ? bucket.paidSpend / bucket.paidClicks : null;
      const approvalRate = bucket.decisions > 0 ? bucket.approvals / bucket.decisions : null;
      const shrunk = {
        searchToClickRate: shrunkRate(searchToClickRate, bucket.searches, baseline.searchToClickRate, 50),
        revenuePerClick: shrunkRate(revenuePerClick, bucket.monetizedClicks, baseline.revenuePerClick, 25),
        revenuePerSearch: shrunkRate(revenuePerSearch, bucket.searches, baseline.revenuePerSearch, 50),
        paidCtr: shrunkRate(paidCtr, bucket.paidImpressions, baseline.paidCtr, 1000),
        cpc: shrunkRate(cpc, bucket.paidClicks, baseline.cpc, 200),
        approvalRate: shrunkRate(approvalRate, bucket.decisions, baseline.approvalRate, 25),
      };
      return {
        feature: bucket.feature,
        observations: bucket.observations,
        searches: bucket.searches,
        monetizedClicks: bucket.monetizedClicks,
        revenue: Number(bucket.revenue.toFixed(4)),
        paidImpressions: bucket.paidImpressions,
        paidClicks: bucket.paidClicks,
        paidSpend: Number(bucket.paidSpend.toFixed(4)),
        decisions: bucket.decisions,
        approvals: bucket.approvals,
        rejections: bucket.rejections,
        reviewFlags: bucket.reviewFlags,
        searchToClickRate,
        revenuePerClick,
        revenuePerSearch,
        paidCtr,
        cpc,
        approvalRate,
        shrunk,
        deltas: {
          searchToClickRate: shrunk.searchToClickRate != null && baseline.searchToClickRate != null ? shrunk.searchToClickRate - baseline.searchToClickRate : null,
          revenuePerClick: shrunk.revenuePerClick != null && baseline.revenuePerClick != null ? shrunk.revenuePerClick - baseline.revenuePerClick : null,
          revenuePerSearch: shrunk.revenuePerSearch != null && baseline.revenuePerSearch != null ? shrunk.revenuePerSearch - baseline.revenuePerSearch : null,
          paidCtr: shrunk.paidCtr != null && baseline.paidCtr != null ? shrunk.paidCtr - baseline.paidCtr : null,
          cpc: shrunk.cpc != null && baseline.cpc != null ? shrunk.cpc - baseline.cpc : null,
          approvalRate: shrunk.approvalRate != null && baseline.approvalRate != null ? shrunk.approvalRate - baseline.approvalRate : null,
        },
      };
    })
    .sort((a, b) => b.observations - a.observations || b.revenue - a.revenue);

  let packetSummary: IntentPacketLearningReport['packetSummary'];
  if (focusKeywords?.length) {
    const features = extractIntentAxiomFeaturesFromKeywords(focusKeywords);
    const featureMap = new Map(priors.map((prior) => [`${prior.feature.namespace}:${prior.feature.key}`, prior] as const));
    const matched = features
      .map((feature) => featureMap.get(`${feature.namespace}:${feature.key}`))
      .filter((value): value is IntentPacketLearningPrior => Boolean(value));
    const averages = {
      searchToClickRateDelta: averageNullable(matched.map((item) => item.deltas.searchToClickRate)),
      revenuePerClickDelta: averageNullable(matched.map((item) => item.deltas.revenuePerClick)),
      revenuePerSearchDelta: averageNullable(matched.map((item) => item.deltas.revenuePerSearch)),
      paidCtrDelta: averageNullable(matched.map((item) => item.deltas.paidCtr)),
      cpcDelta: averageNullable(matched.map((item) => item.deltas.cpc)),
      approvalRateDelta: averageNullable(matched.map((item) => item.deltas.approvalRate)),
    };
    const notes: string[] = [];
    if ((averages.revenuePerClickDelta || 0) < 0) notes.push('Historical axioms around this packet skew below baseline on revenue per click.');
    if ((averages.searchToClickRateDelta || 0) < 0) notes.push('Historical axioms around this packet skew below baseline on search-to-click rate.');
    if ((averages.paidCtrDelta || 0) < 0) notes.push('Paid CTR prior is negative where paid impression data exists.');
    if ((averages.approvalRateDelta || 0) < 0) notes.push('Approval prior is negative where moderation outcomes exist.');
    packetSummary = {
      features,
      averages,
      notes,
    };
  }

  return {
    summary: {
      observations: rows.length,
      searchedObservations: rows.filter((row) => getNumber(row.searches) > 0).length,
      monetizedObservations: rows.filter((row) => getNumber(row.monetized_clicks) > 0).length,
      paidObservations: rows.filter((row) => getNumber(row.paid_impressions) > 0 || getNumber(row.paid_clicks) > 0).length,
      features: priors.length,
      keywords: focusKeywords || undefined,
    },
    globalBaseline: baseline,
    priors,
    packetSummary,
  };
}

export async function queryIntentPacketLearningReport(
  conn: any,
  filters: {
    keywords?: string[] | null;
    featureKeys?: string[] | null;
    namespaces?: IntentAxiomNamespace[] | null;
    sources?: string[] | null;
    startDate?: string | null;
    endDate?: string | null;
    market?: string | null;
  } = {}
): Promise<IntentPacketLearningReport> {
  const rows = await loadIntentPacketObservations(conn, filters);
  return computeIntentAxiomPriors(rows, filters.keywords || null);
}
