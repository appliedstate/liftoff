import fs from 'fs';
import path from 'path';
import { generateIntentPacket, IntentPacket, IntentPacketInput } from './intentPacket';

type CachedKeywordDay = {
  date: string;
  rows?: Array<Record<string, any>>;
};

type KeywordAggregate = {
  keyword: string;
  searches: number;
  widgetSearches: number;
  clicks: number;
  revenue: number;
  activeDates: Set<string>;
};

type GroupKind = 'root_phrase' | 'commercial_modifier' | 'audience' | 'constraint';

export type IntentPacketAxiomInput = {
  anchorKeywords: string[];
  startDate?: string | null;
  endDate?: string | null;
  market?: string | null;
  maxKeywordsPerGroup?: number | null;
  minSharedTokens?: number | null;
  minGroupSearches?: number | null;
  minGroupClicks?: number | null;
  rawCacheDir?: string | null;
};

export type IntentPacketAxiomKeyword = {
  keyword: string;
  searches: number;
  widgetSearches: number;
  clicks: number;
  revenue: number;
  rpc: number;
  rps: number;
  activeDays: number;
};

export type IntentPacketAxiomGroup = {
  kind: GroupKind;
  key: string;
  label: string;
  rationale: string;
  totalSearches: number;
  totalWidgetSearches: number;
  totalClicks: number;
  totalRevenue: number;
  blendedRpc: number;
  blendedRps: number;
  keywords: IntentPacketAxiomKeyword[];
  packetInput: IntentPacketInput | null;
  packet: IntentPacket | null;
};

export type IntentPacketAxiomPacketOption = {
  sourceKind: GroupKind;
  sourceKey: string;
  label: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  totalSearches: number;
  totalClicks: number;
  totalRevenue: number;
  blendedRpc: number;
  packetInput: IntentPacketInput;
  packet: IntentPacket;
};

export type IntentPacketAxiomResult = {
  summary: {
    anchorKeywords: string[];
    startDate: string | null;
    endDate: string | null;
    rawFilesScanned: number;
    rawRowsMatched: number;
    uniqueRelatedKeywords: number;
    packetOptions: number;
  };
  relatedKeywords: IntentPacketAxiomKeyword[];
  views: {
    roots: IntentPacketAxiomGroup[];
    modifiers: IntentPacketAxiomGroup[];
    audiences: IntentPacketAxiomGroup[];
    constraints: IntentPacketAxiomGroup[];
  };
  packetOptions: IntentPacketAxiomPacketOption[];
};

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'get', 'how', 'i', 'in', 'is', 'it', 'me',
  'my', 'near', 'of', 'on', 'or', 'the', 'to', 'with', 'you', 'your',
]);

const GENERIC_MATCH_TOKENS = new Set([
  'best', 'cheap', 'free', 'instant', 'low', 'online', 'quote', 'quotes', 'top',
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

function normalizeKeyword(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenizeKeyword(value: string): string[] {
  return normalizeKeyword(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function getNumber(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function keywordCacheDir(input: IntentPacketAxiomInput): string {
  return String(input.rawCacheDir || path.join(process.cwd(), '.local', 'strategis', 's1', 'keywords', 'raw'));
}

function listCacheFiles(dir: string, startDate: string | null, endDate: string | null): string[] {
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .filter((file) => {
      const date = file.replace('.json', '');
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    })
    .sort();
}

function matchesAnyPattern(keyword: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(keyword));
}

function firstMatchLabel(keyword: string, groups: Array<{ key: string; label: string; patterns: RegExp[] }>): { key: string; label: string } | null {
  for (const group of groups) {
    if (matchesAnyPattern(keyword, group.patterns)) {
      return { key: group.key, label: group.label };
    }
  }
  return null;
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

function buildKeywordAggregateMap(
  rows: Array<{ keyword: string; searches: number; widgetSearches: number; clicks: number; revenue: number; date: string }>
): Map<string, KeywordAggregate> {
  const map = new Map<string, KeywordAggregate>();
  for (const row of rows) {
    const key = row.keyword.trim();
    if (!map.has(key)) {
      map.set(key, {
        keyword: key,
        searches: 0,
        widgetSearches: 0,
        clicks: 0,
        revenue: 0,
        activeDates: new Set<string>(),
      });
    }
    const aggregate = map.get(key)!;
    aggregate.searches += row.searches;
    aggregate.widgetSearches += row.widgetSearches;
    aggregate.clicks += row.clicks;
    aggregate.revenue += row.revenue;
    aggregate.activeDates.add(row.date);
  }
  return map;
}

function toKeywordMetric(aggregate: KeywordAggregate): IntentPacketAxiomKeyword {
  return {
    keyword: aggregate.keyword,
    searches: aggregate.searches,
    widgetSearches: aggregate.widgetSearches,
    clicks: aggregate.clicks,
    revenue: Number(aggregate.revenue.toFixed(4)),
    rpc: aggregate.clicks > 0 ? Number((aggregate.revenue / aggregate.clicks).toFixed(4)) : 0,
    rps: aggregate.searches > 0 ? Number((aggregate.revenue / aggregate.searches).toFixed(4)) : 0,
    activeDays: aggregate.activeDates.size,
  };
}

function buildPacketForGroup(
  aggregates: KeywordAggregate[],
  market: string,
  maxKeywordsPerGroup: number
): { packetInput: IntentPacketInput; packet: IntentPacket } | null {
  const ranked = aggregates
    .slice()
    .sort((a, b) => {
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.searches - a.searches;
    });

  if (!ranked.length) return null;
  const primary = ranked[0];
  const supporting = ranked.slice(1, Math.max(2, maxKeywordsPerGroup)).map((item) => item.keyword);
  const packetInput: IntentPacketInput = {
    primaryKeyword: primary.keyword,
    supportingKeywords: supporting,
    market,
    keywordEvidence: ranked.slice(0, maxKeywordsPerGroup).map((item) => ({
      keyword: item.keyword,
      clicks: item.clicks,
      revenue: Number(item.revenue.toFixed(4)),
      rpc: item.clicks > 0 ? Number((item.revenue / item.clicks).toFixed(4)) : 0,
      sessions: item.searches,
    })),
  };
  return {
    packetInput,
    packet: generateIntentPacket(packetInput),
  };
}

function buildGroup(
  kind: GroupKind,
  key: string,
  label: string,
  rationale: string,
  aggregates: KeywordAggregate[],
  market: string,
  maxKeywordsPerGroup: number
): IntentPacketAxiomGroup {
  const sorted = aggregates
    .slice()
    .sort((a, b) => {
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.searches - a.searches;
    });
  const totals = sorted.reduce((acc, item) => {
    acc.searches += item.searches;
    acc.widgetSearches += item.widgetSearches;
    acc.clicks += item.clicks;
    acc.revenue += item.revenue;
    return acc;
  }, { searches: 0, widgetSearches: 0, clicks: 0, revenue: 0 });
  const packetBundle = buildPacketForGroup(sorted, market, maxKeywordsPerGroup);
  return {
    kind,
    key,
    label,
    rationale,
    totalSearches: totals.searches,
    totalWidgetSearches: totals.widgetSearches,
    totalClicks: totals.clicks,
    totalRevenue: Number(totals.revenue.toFixed(4)),
    blendedRpc: totals.clicks > 0 ? Number((totals.revenue / totals.clicks).toFixed(4)) : 0,
    blendedRps: totals.searches > 0 ? Number((totals.revenue / totals.searches).toFixed(4)) : 0,
    keywords: sorted.slice(0, maxKeywordsPerGroup).map(toKeywordMetric),
    packetInput: packetBundle?.packetInput || null,
    packet: packetBundle?.packet || null,
  };
}

function buildAnchorTokenProfile(anchorKeywords: string[]) {
  const tokenFrequency = new Map<string, number>();
  for (const keyword of anchorKeywords) {
    const tokens = new Set(tokenizeKeyword(keyword));
    for (const token of tokens) {
      tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1);
    }
  }

  const anchorTokens = new Set(Array.from(tokenFrequency.keys()).filter((token) => !GENERIC_MATCH_TOKENS.has(token)));
  const discriminativeTokens = new Set(
    Array.from(tokenFrequency.entries())
      .filter(([token, count]) => !GENERIC_MATCH_TOKENS.has(token) && count < anchorKeywords.length)
      .map(([token]) => token)
  );

  return { anchorTokens, discriminativeTokens };
}

function keywordMatchesAnchorProfile(
  keyword: string,
  anchorTokens: Set<string>,
  discriminativeTokens: Set<string>,
  minSharedTokens: number
): boolean {
  const tokens = new Set(tokenizeKeyword(keyword));
  let shared = 0;
  let sharedDiscriminative = 0;
  for (const token of tokens) {
    if (!anchorTokens.has(token)) continue;
    shared += 1;
    if (discriminativeTokens.has(token)) sharedDiscriminative += 1;
  }
  if (shared < minSharedTokens) return false;
  if (discriminativeTokens.size > 0 && sharedDiscriminative < 1) return false;
  return true;
}

export async function discoverIntentPacketAxioms(input: IntentPacketAxiomInput): Promise<IntentPacketAxiomResult> {
  const anchorKeywords = Array.isArray(input.anchorKeywords)
    ? input.anchorKeywords.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  if (!anchorKeywords.length) {
    throw new Error('anchorKeywords is required (non-empty array)');
  }

  const maxKeywordsPerGroup = Math.max(3, Number(input.maxKeywordsPerGroup || 6));
  const minSharedTokens = Math.max(1, Number(input.minSharedTokens || 2));
  const minGroupSearches = Math.max(1, Number(input.minGroupSearches || 1));
  const minGroupClicks = Math.max(0, Number(input.minGroupClicks || 0));
  const market = String(input.market || 'US');
  const rawDir = keywordCacheDir(input);
  const startDate = input.startDate ? String(input.startDate) : null;
  const endDate = input.endDate ? String(input.endDate) : null;
  const files = listCacheFiles(rawDir, startDate, endDate);
  const { anchorTokens, discriminativeTokens } = buildAnchorTokenProfile(anchorKeywords);

  const matchedRows: Array<{ keyword: string; searches: number; widgetSearches: number; clicks: number; revenue: number; date: string }> = [];
  let rawRowsMatched = 0;

  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8')) as CachedKeywordDay;
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    for (const row of rows) {
      const keyword = String(row.keyword || '').trim();
      if (!keyword) continue;
      if (!keywordMatchesAnchorProfile(keyword, anchorTokens, discriminativeTokens, minSharedTokens)) continue;
      matchedRows.push({
        keyword,
        searches: getNumber(row.searches),
        widgetSearches: getNumber(row.widgetSearches ?? row.widget_searches),
        clicks: getNumber(row.clicks),
        revenue: getNumber(row.estimated_revenue ?? row.revenue),
        date: String(payload.date || file.replace('.json', '')),
      });
      rawRowsMatched += 1;
    }
  }

  const keywordMap = buildKeywordAggregateMap(matchedRows);
  const aggregates = Array.from(keywordMap.values());
  const relatedKeywords = aggregates
    .slice()
    .sort((a, b) => {
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.searches - a.searches;
    })
    .map(toKeywordMetric);

  const rootGroups = new Map<string, KeywordAggregate[]>();
  const modifierGroups = new Map<string, { label: string; keywords: KeywordAggregate[] }>();
  const audienceGroups = new Map<string, { label: string; keywords: KeywordAggregate[] }>();
  const constraintGroups = new Map<string, { label: string; keywords: KeywordAggregate[] }>();

  for (const aggregate of aggregates) {
    const rootPhrase = deriveRootPhrase(aggregate.keyword);
    if (!rootGroups.has(rootPhrase)) rootGroups.set(rootPhrase, []);
    rootGroups.get(rootPhrase)!.push(aggregate);

    const modifier = firstMatchLabel(aggregate.keyword, COMMERCIAL_MODIFIERS);
    if (modifier) {
      if (!modifierGroups.has(modifier.key)) modifierGroups.set(modifier.key, { label: modifier.label, keywords: [] });
      modifierGroups.get(modifier.key)!.keywords.push(aggregate);
    }

    const audience = firstMatchLabel(aggregate.keyword, AUDIENCE_PATTERNS);
    if (audience) {
      if (!audienceGroups.has(audience.key)) audienceGroups.set(audience.key, { label: audience.label, keywords: [] });
      audienceGroups.get(audience.key)!.keywords.push(aggregate);
    }

    const constraint = firstMatchLabel(aggregate.keyword, CONSTRAINT_PATTERNS);
    if (constraint) {
      if (!constraintGroups.has(constraint.key)) constraintGroups.set(constraint.key, { label: constraint.label, keywords: [] });
      constraintGroups.get(constraint.key)!.keywords.push(aggregate);
    }
  }

  const roots = Array.from(rootGroups.entries())
    .map(([key, items]) => buildGroup(
      'root_phrase',
      key,
      key,
      `Preserve the root phrase "${key}" across ad, article, and widget so the click path stays in one commercial mindset.`,
      items,
      market,
      maxKeywordsPerGroup
    ))
    .filter((group) => group.totalSearches >= minGroupSearches && group.totalClicks >= minGroupClicks)
    .sort((a, b) => b.totalClicks - a.totalClicks || b.totalRevenue - a.totalRevenue);

  const modifiers = Array.from(modifierGroups.entries())
    .map(([key, value]) => buildGroup(
      'commercial_modifier',
      key,
      value.label,
      `Lean into the "${value.label}" modifier as a separate commercial axiom and test whether that buying language changes RPC without breaking intent continuity.`,
      value.keywords,
      market,
      maxKeywordsPerGroup
    ))
    .filter((group) => group.totalSearches >= minGroupSearches && group.totalClicks >= minGroupClicks)
    .sort((a, b) => b.totalClicks - a.totalClicks || b.totalRevenue - a.totalRevenue);

  const audiences = Array.from(audienceGroups.entries())
    .map(([key, value]) => buildGroup(
      'audience',
      key,
      value.label,
      `Break out "${value.label}" as a dedicated audience-flavored packet instead of mixing it into the generic quote flow.`,
      value.keywords,
      market,
      maxKeywordsPerGroup
    ))
    .filter((group) => group.totalSearches >= minGroupSearches && group.totalClicks >= minGroupClicks)
    .sort((a, b) => b.totalClicks - a.totalClicks || b.totalRevenue - a.totalRevenue);

  const constraints = Array.from(constraintGroups.entries())
    .map(([key, value]) => buildGroup(
      'constraint',
      key,
      value.label,
      `Treat "${value.label}" as a separate constraint packet so we can test whether the extra specificity creates more valuable downstream clicks.`,
      value.keywords,
      market,
      maxKeywordsPerGroup
    ))
    .filter((group) => group.totalSearches >= minGroupSearches && group.totalClicks >= minGroupClicks)
    .sort((a, b) => b.totalClicks - a.totalClicks || b.totalRevenue - a.totalRevenue);

  const packetOptionsMap = new Map<string, IntentPacketAxiomPacketOption>();
  for (const group of [...roots, ...modifiers, ...audiences, ...constraints]) {
    if (!group.packet || !group.packetInput) continue;
    const key = group.packetInput.primaryKeyword.toLowerCase();
    if (packetOptionsMap.has(key)) continue;
    packetOptionsMap.set(key, {
      sourceKind: group.kind,
      sourceKey: group.key,
      label: group.label,
      primaryKeyword: group.packetInput.primaryKeyword,
      supportingKeywords: group.packetInput.supportingKeywords || [],
      totalSearches: group.totalSearches,
      totalClicks: group.totalClicks,
      totalRevenue: group.totalRevenue,
      blendedRpc: group.blendedRpc,
      packetInput: group.packetInput,
      packet: group.packet,
    });
  }

  const packetOptions = Array.from(packetOptionsMap.values())
    .sort((a, b) => {
      if (b.totalClicks !== a.totalClicks) return b.totalClicks - a.totalClicks;
      if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue;
      return b.packet.scores.launchPriority - a.packet.scores.launchPriority;
    });

  return {
    summary: {
      anchorKeywords,
      startDate,
      endDate,
      rawFilesScanned: files.length,
      rawRowsMatched,
      uniqueRelatedKeywords: relatedKeywords.length,
      packetOptions: packetOptions.length,
    },
    relatedKeywords,
    views: {
      roots,
      modifiers,
      audiences,
      constraints,
    },
    packetOptions,
  };
}
