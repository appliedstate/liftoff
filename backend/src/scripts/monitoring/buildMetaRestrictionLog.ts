import fs from 'fs';
import path from 'path';

type CsvRow = Record<string, string>;

type RestrictionEntityType =
  | 'person'
  | 'ad_account'
  | 'page'
  | 'business_manager'
  | 'business_portfolio'
  | 'unknown';

type RestrictionStatus =
  | 'banned'
  | 'restricted'
  | 'disabled'
  | 'suspended'
  | 'page_management_limited'
  | 'account_integrity_flag'
  | 'restriction_count_reported'
  | 'unknown';

type EvidenceConfidence = 'high' | 'medium' | 'low';

type ManualEvidenceSeed = {
  id: string;
  entityType: RestrictionEntityType;
  entityName: string;
  entityId?: string | null;
  status: RestrictionStatus;
  eventDate: string | null;
  endDate?: string | null;
  permanent?: boolean | null;
  confidence: EvidenceConfidence;
  scope?: string | null;
  sourcePath: string;
  pattern: string;
  detail: string;
  relatedEntities?: string[];
};

type RestrictionEvent = {
  id: string;
  entityType: RestrictionEntityType;
  entityName: string;
  entityId: string | null;
  status: RestrictionStatus;
  eventDate: string | null;
  endDate: string | null;
  permanent: boolean | null;
  confidence: EvidenceConfidence;
  scope: string | null;
  detail: string;
  sourcePath: string;
  sourceLine: number | null;
  sourceSnippet: string;
  relatedEntities: string[];
};

type AdAccountEmailSummary = {
  adAccountId: string;
  adAccountName: string | null;
  businessManagerName: string | null;
  totalRejections: number;
  firstSeen: string | null;
  lastSeen: string | null;
  reasonCounts: Record<string, number>;
  restrictionLikeReasonCounts: Record<string, number>;
};

type Args = {
  rejectionCsvPath: string;
  classificationCsvPath: string;
  outputDir: string;
};

const RESTRICTION_LIKE_REASON_PATTERNS = [
  /account integrity/i,
  /find a way around our rules/i,
  /circumvention/i,
  /admin roles or pages/i,
  /pages?\./i,
];

const MANUAL_EVIDENCE_SEEDS: ManualEvidenceSeed[] = [
  {
    id: 'ben-access-banned-2026-02-25',
    entityType: 'person',
    entityName: 'Ben',
    status: 'banned',
    eventDate: '2026-02-25',
    permanent: null,
    confidence: 'high',
    scope: 'facebook_access',
    sourcePath: '../docs/facebook-notes-team-working-document-2026-02-25.md',
    pattern: "Ben's Facebook access was reported as banned, including loss of buying access.",
    detail: "Working notes state that Ben's Facebook access was banned and buying access was lost.",
    relatedEntities: ['Nautilus'],
  },
  {
    id: 'andrew-cook-run-ads-suspension-2026-04-22',
    entityType: 'person',
    entityName: 'Andrew Cook',
    status: 'suspended',
    eventDate: '2026-04-22',
    endDate: '2026-04-29',
    permanent: false,
    confidence: 'high',
    scope: 'ad_delivery_access',
    sourcePath: '../docs/operations/meetings/2026/2026-04-22-team-media-buying-facebook-restrictions/transcript.md',
    pattern:
      "When I click my restriction now, the old one says I can't run ads until April 29. The new one says I can't create or manage pages, groups or events, ending May 20.",
    detail:
      "Cook reported a time-bound inability to run ads through April 29, 2026, alongside a separate page-management restriction.",
    relatedEntities: ['Andrew Cook', 'Nautilus'],
  },
  {
    id: 'andrew-cook-page-management-restriction-2026-04-22',
    entityType: 'person',
    entityName: 'Andrew Cook',
    status: 'page_management_limited',
    eventDate: '2026-04-22',
    endDate: '2026-05-20',
    permanent: false,
    confidence: 'high',
    scope: 'page_group_event_management',
    sourcePath: '../docs/operations/meetings/2026/2026-04-22-team-media-buying-facebook-restrictions/transcript.md',
    pattern:
      "When I click my restriction now, the old one says I can't run ads until April 29. The new one says I can't create or manage pages, groups or events, ending May 20.",
    detail:
      "Cook reported a time-bound inability to create or manage pages, groups, or events through May 20, 2026.",
    relatedEntities: ['Andrew Cook', 'Nautilus'],
  },
  {
    id: 'anastasia-personal-ban-2026-04-22',
    entityType: 'person',
    entityName: 'Anastasia Uldanova',
    status: 'banned',
    eventDate: '2026-04-22',
    permanent: true,
    confidence: 'high',
    scope: 'personal_account_access',
    sourcePath: '../docs/operations/meetings/2026/2026-04-22-team-media-buying-facebook-restrictions/transcript.md',
    pattern: "I don't have any time restrictions. It's just banned.",
    detail:
      "Anastasia described her personal restriction as having no end date, which the team treated as effectively permanent.",
    relatedEntities: ['Anastasia Uldanova', 'Nautilus'],
  },
  {
    id: 'knowledge-warehouse-au-account-integrity-2026-04-20',
    entityType: 'ad_account',
    entityName: 'Knowledge Warehouse AU',
    status: 'account_integrity_flag',
    eventDate: '2026-04-20',
    permanent: null,
    confidence: 'high',
    scope: 'ad_account',
    sourcePath: '../docs/operations/meetings/2026/2026-04-22-team-media-buying-facebook-restrictions/transcript.md',
    pattern:
      'On April 20 at 6:58 a.m. there was an email from Knowledge Warehouse AU saying Meta says the account was trying to find a way around our rules, which violates advertising standards on account integrity.',
    detail:
      'Meeting notes cite an email saying Knowledge Warehouse AU triggered account-integrity / rule-evasion language from Meta.',
    relatedEntities: ['Knowledge Warehouse AU', 'Nautilus'],
  },
  {
    id: 'spotted-by-us-account-integrity-2026-04-20',
    entityType: 'ad_account',
    entityName: 'Spotted By Us',
    status: 'account_integrity_flag',
    eventDate: '2026-04-20',
    permanent: null,
    confidence: 'high',
    scope: 'ad_account',
    sourcePath: '../docs/operations/meetings/2026/2026-04-22-team-media-buying-facebook-restrictions/transcript.md',
    pattern:
      'Another email at the same time said the same on Spotted By Us. So same category, same ad as another business manager, two ad accounts, both health, both likely get-paid health.',
    detail:
      'Meeting notes cite a second ad account, Spotted By Us, receiving the same account-integrity / rule-evasion language.',
    relatedEntities: ['Spotted By Us', 'Nautilus'],
  },
  {
    id: 'ben-page-management-restriction-2026-04-22',
    entityType: 'person',
    entityName: 'Ben',
    status: 'page_management_limited',
    eventDate: '2026-04-22',
    permanent: null,
    confidence: 'high',
    scope: 'page_management',
    sourcePath: '../docs/operations/meetings/2026/2026-04-22-team-media-buying-facebook-restrictions/transcript.md',
    pattern: "I also have the same restriction where I can't add Facebook pages anymore.",
    detail:
      "Ben reported a restriction that prevents him from adding Facebook Pages.",
    relatedEntities: ['Ben', 'Adnet', 'Nautilus'],
  },
  {
    id: 'nautilus-three-ad-accounts-restricted-2026-04-29',
    entityType: 'business_manager',
    entityName: 'Nautilus',
    status: 'restriction_count_reported',
    eventDate: '2026-04-29',
    permanent: null,
    confidence: 'high',
    scope: 'ad_accounts',
    sourcePath: '../docs/operations/meetings/2026/2026-04-29-team-media-buying-facebook-ops-sync/transcript.md',
    pattern:
      'We currently have three ad accounts restricted in the business manager. The first one, the group one, is probably worth getting fixed.',
    detail:
      'The April 29 operating sync recorded that three ad accounts were restricted inside the Nautilus business manager.',
    relatedEntities: ['Nautilus'],
  },
];

function parseArgs(): Args {
  return {
    rejectionCsvPath: path.resolve(
      process.cwd(),
      '../meta_rejections_2026-01-01_to_2026-04-20_with_received_at.csv'
    ),
    classificationCsvPath: path.resolve(
      process.cwd(),
      '../docs/analysis/facebook-ad-rejections/working/rejection-classification-table.csv'
    ),
    outputDir: path.resolve(process.cwd(), '.local/strategis/facebook/restriction-log'),
  };
}

function readText(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function readLines(filePath: string): string[] {
  return readText(filePath).split('\n');
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function parseCsv(filePath: string): CsvRow[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split('\n');
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] || '').trim();
    });
    return row;
  });
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] || 0) + 1;
}

function normalizeCsvValue(value: string | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('="') && raw.endsWith('"')) return raw.slice(2, -1);
  return raw;
}

function findPatternLocation(filePath: string, pattern: string): { line: number | null; snippet: string } {
  const lines = readLines(filePath);
  const index = lines.findIndex((line) => line.includes(pattern));
  if (index < 0) {
    return { line: null, snippet: '' };
  }
  return { line: index + 1, snippet: lines[index].trim() };
}

function buildManualEvidence(): RestrictionEvent[] {
  const events: RestrictionEvent[] = [];
  for (const seed of MANUAL_EVIDENCE_SEEDS) {
    const sourcePath = path.resolve(process.cwd(), seed.sourcePath);
    const location = findPatternLocation(sourcePath, seed.pattern);
    if (!location.snippet) continue;
    events.push({
      id: seed.id,
      entityType: seed.entityType,
      entityName: seed.entityName,
      entityId: seed.entityId || null,
      status: seed.status,
      eventDate: seed.eventDate,
      endDate: seed.endDate || null,
      permanent: typeof seed.permanent === 'boolean' ? seed.permanent : null,
      confidence: seed.confidence,
      scope: seed.scope || null,
      detail: seed.detail,
      sourcePath,
      sourceLine: location.line,
      sourceSnippet: location.snippet,
      relatedEntities: seed.relatedEntities || [],
    });
  }
  return events;
}

function buildAccountNameMap(
  classificationRows: CsvRow[]
): Map<string, { adAccountName: string | null; businessManagerName: string | null }> {
  const map = new Map<string, { adAccountName: string | null; businessManagerName: string | null }>();
  for (const row of classificationRows) {
    const adAccountId = normalizeCsvValue(row.ad_account_id);
    if (!adAccountId) continue;
    const adAccountName = normalizeCsvValue(row.ad_account_name) || null;
    const businessManagerName = normalizeCsvValue(row.business_manager_name) || null;
    if (!map.has(adAccountId)) {
      map.set(adAccountId, { adAccountName, businessManagerName });
    }
  }
  return map;
}

function parseReceivedAtTimestamp(value: string): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildEmailSummaries(rejectionRows: CsvRow[], classificationRows: CsvRow[]): AdAccountEmailSummary[] {
  const names = buildAccountNameMap(classificationRows);
  const summaries = new Map<string, AdAccountEmailSummary>();

  for (const row of rejectionRows) {
    const adAccountId = normalizeCsvValue(row.account_id);
    if (!adAccountId) continue;
    const reason = normalizeCsvValue(row.reason) || '(unknown)';
    const receivedAt = normalizeCsvValue(row.received_at);
    let summary = summaries.get(adAccountId);
    if (!summary) {
      const mapped = names.get(adAccountId);
      summary = {
        adAccountId,
        adAccountName: mapped?.adAccountName || null,
        businessManagerName: mapped?.businessManagerName || null,
        totalRejections: 0,
        firstSeen: null,
        lastSeen: null,
        reasonCounts: {},
        restrictionLikeReasonCounts: {},
      };
      summaries.set(adAccountId, summary);
    }

    summary.totalRejections += 1;
    increment(summary.reasonCounts, reason);

    if (RESTRICTION_LIKE_REASON_PATTERNS.some((pattern) => pattern.test(reason))) {
      increment(summary.restrictionLikeReasonCounts, reason);
    }

    const receivedAtTs = parseReceivedAtTimestamp(receivedAt);
    if (receivedAtTs !== null) {
      const firstTs = parseReceivedAtTimestamp(summary.firstSeen || '');
      const lastTs = parseReceivedAtTimestamp(summary.lastSeen || '');
      if (firstTs === null || receivedAtTs < firstTs) summary.firstSeen = receivedAt;
      if (lastTs === null || receivedAtTs > lastTs) summary.lastSeen = receivedAt;
    } else {
      if (!summary.firstSeen) summary.firstSeen = receivedAt || null;
      summary.lastSeen = receivedAt || summary.lastSeen;
    }
  }

  return Array.from(summaries.values()).sort(
    (a, b) =>
      b.totalRejections - a.totalRejections ||
      Object.keys(b.restrictionLikeReasonCounts).length -
        Object.keys(a.restrictionLikeReasonCounts).length ||
      a.adAccountId.localeCompare(b.adAccountId)
  );
}

function buildSummary(evidence: RestrictionEvent[], emailSummaries: AdAccountEmailSummary[]) {
  const people = evidence.filter((event) => event.entityType === 'person');
  const adAccounts = evidence.filter((event) => event.entityType === 'ad_account');
  const businessManagers = evidence.filter(
    (event) => event.entityType === 'business_manager' || event.entityType === 'business_portfolio'
  );

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      evidenceEvents: evidence.length,
      personEvents: people.length,
      adAccountEvents: adAccounts.length,
      businessManagerEvents: businessManagers.length,
      emailAdAccountsTracked: emailSummaries.length,
    },
    apiVisibility: {
      availableRepoFeeds: [
        '/api/facebook/campaigns',
        '/api/facebook/ads',
        '/api/facebook/adsets/day',
        '/api/facebook/campaigns/export',
      ],
      observedLiveProbe: {
        campaignsEndpointSampleKeys: ['name', 'id', 'account_id', 'status', 'daily_budget', 'bid_strategy'],
        rawGraphProxyAttempt:
          'Attempted raw ad-account object fetch for act_1516449125656850 via /api/lincx-proxy on 2026-04-30; relay returned OAuthException (#200) "Provide valid app ID".',
      },
      gaps: [
        'No attached account-quality export is present in the repo.',
        'No attached business-settings export is present in the repo.',
        'No attached personal-account restriction feed is present in the repo.',
        'No attached page-status export is present in the repo.',
      ],
    },
    topEmailAccountsByRejections: emailSummaries.slice(0, 10).map((summary) => ({
      adAccountId: summary.adAccountId,
      adAccountName: summary.adAccountName,
      businessManagerName: summary.businessManagerName,
      totalRejections: summary.totalRejections,
      restrictionLikeReasons: summary.restrictionLikeReasonCounts,
    })),
  };
}

function buildSummaryMarkdown(
  evidence: RestrictionEvent[],
  emailSummaries: AdAccountEmailSummary[],
  summary: ReturnType<typeof buildSummary>
): string {
  const lines: string[] = [];
  lines.push('# Meta Restriction Log');
  lines.push('');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push('');
  lines.push('## What we have');
  lines.push('');
  lines.push(`- Structured restriction evidence events: ${summary.counts.evidenceEvents}`);
  lines.push(`- People with explicit restriction evidence: ${summary.counts.personEvents}`);
  lines.push(`- Ad-account restriction/integrity events: ${summary.counts.adAccountEvents}`);
  lines.push(`- Business-manager level events: ${summary.counts.businessManagerEvents}`);
  lines.push(`- Ad accounts with Gmail rejection history: ${summary.counts.emailAdAccountsTracked}`);
  lines.push('');
  lines.push('## API visibility');
  lines.push('');
  lines.push('- Available repo feeds:');
  for (const feed of summary.apiVisibility.availableRepoFeeds) {
    lines.push(`  - ${feed}`);
  }
  lines.push('- Current gaps:');
  for (const gap of summary.apiVisibility.gaps) {
    lines.push(`  - ${gap}`);
  }
  lines.push('- Observed live probe:');
  lines.push(
    `  - /api/facebook/campaigns sample keys: ${summary.apiVisibility.observedLiveProbe.campaignsEndpointSampleKeys.join(
      ', '
    )}`
  );
  lines.push(`  - ${summary.apiVisibility.observedLiveProbe.rawGraphProxyAttempt}`);
  lines.push('');
  lines.push('## Explicit restriction evidence');
  lines.push('');
  for (const event of evidence) {
    const lineSuffix = event.sourceLine ? `:${event.sourceLine}` : '';
    lines.push(
      `- ${event.entityName} [${event.entityType}] -> ${event.status}` +
        `${event.eventDate ? ` on ${event.eventDate}` : ''}` +
        `${event.endDate ? ` through ${event.endDate}` : ''}` +
        `${event.permanent === true ? ' (effectively permanent)' : ''}` +
        ` | source: ${event.sourcePath}${lineSuffix}`
    );
  }
  lines.push('');
  lines.push('## Top email rejection accounts');
  lines.push('');
  for (const summaryRow of emailSummaries.slice(0, 10)) {
    lines.push(
      `- ${summaryRow.adAccountId}` +
        `${summaryRow.adAccountName ? ` (${summaryRow.adAccountName})` : ''}` +
        ` -> ${summaryRow.totalRejections} rejection emails`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const args = parseArgs();
  const rejectionRows = parseCsv(args.rejectionCsvPath);
  const classificationRows = parseCsv(args.classificationCsvPath);
  const evidence = buildManualEvidence();
  const emailSummaries = buildEmailSummaries(rejectionRows, classificationRows);
  const summary = buildSummary(evidence, emailSummaries);
  const markdown = buildSummaryMarkdown(evidence, emailSummaries, summary);

  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(args.outputDir, 'restriction-events.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(args.outputDir, 'email-account-summaries.json'),
    `${JSON.stringify(emailSummaries, null, 2)}\n`
  );
  fs.writeFileSync(path.join(args.outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(args.outputDir, 'summary.md'), `${markdown}\n`);

  console.log(`[meta-restriction-log] Wrote ${path.join(args.outputDir, 'restriction-events.json')}`);
  console.log(
    `[meta-restriction-log] Wrote ${path.join(args.outputDir, 'email-account-summaries.json')}`
  );
  console.log(`[meta-restriction-log] Wrote ${path.join(args.outputDir, 'summary.json')}`);
  console.log(`[meta-restriction-log] Wrote ${path.join(args.outputDir, 'summary.md')}`);
}

main();
