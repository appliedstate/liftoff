import fs from 'fs';
import path from 'path';

type JsonRecord = Record<string, any>;

type Args = {
  rejectionCsv: string;
  rejectionJsonl: string;
  liveByAccountJson: string;
  reviewPressureByAccountJson: string;
  notesPath: string;
  outputDir: string;
};

type RestrictionEvidence = {
  status: 'confirmed' | 'possible' | 'unknown';
  scope: 'user_access' | 'ad_account' | 'business_manager' | 'unknown';
  source: string;
  detail: string;
};

type AccountHistoryRow = {
  accountId: string;
  historicalRejections: {
    total: number;
    policyCounts: Record<string, number>;
    reasonCounts: Record<string, number>;
    rowsWithObservedCopy: number;
    rowsWithAdId: number;
    sampleObservedCopy: string[];
  };
  liveExposure: {
    totalAdsToday: number;
    hotZoneAdsToday: number;
    hotZonePctToday: number;
    atRiskAdsToday: number;
    atRiskPctToday: number;
    blackAdsToday: number;
    greyAdsToday: number;
    whiteAdsToday: number;
    buyers: string[];
    rsocSites: string[];
    strategisCampaignIds: string[];
    facebookCampaignIds: string[];
  };
  prototypeReviewPressure: {
    testedAds: number;
    acuteAds: number;
    highAds: number;
    watchAds: number;
    lowAds: number;
    totalSpend: number;
  } | null;
  restrictionEvidence: RestrictionEvidence[];
  restrictionEvidenceAvailable: boolean;
  restrictionStatus: 'confirmed' | 'possible' | 'unknown';
  notes: string[];
};

function parseArgs(argv: string[]): Args {
  return {
    rejectionCsv: path.resolve(
      process.cwd(),
      '../meta_rejections_2026-01-01_to_2026-04-20_with_received_at.csv'
    ),
    rejectionJsonl: path.resolve(
      process.cwd(),
      '../meta_rejected_ads_with_copy_2026-01-01_to_2026-04-20.jsonl'
    ),
    liveByAccountJson: path.resolve(
      process.cwd(),
      '.local/strategis/facebook/meta-risk-analysis/by-ad-account.json'
    ),
    reviewPressureByAccountJson: path.resolve(
      process.cwd(),
      '.local/strategis/facebook/review-pressure-prototype/by-account.json'
    ),
    notesPath: path.resolve(
      process.cwd(),
      '../docs/facebook-notes-team-working-document-2026-02-25.md'
    ),
    outputDir: path.resolve(process.cwd(), '.local/strategis/facebook/account-history'),
  };
}

function readJsonArray(filePath: string): JsonRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function readJsonl(filePath: string): JsonRecord[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function parseCsv(filePath: string): JsonRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split('\n');
  const headers = lines[0].split(',').map((value) => value.trim());
  return lines.slice(1).map((line) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);

    const row: JsonRecord = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] || '').trim();
    });
    return row;
  });
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] || 0) + 1;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function compareRows(a: AccountHistoryRow, b: AccountHistoryRow): number {
  return (
    b.historicalRejections.total - a.historicalRejections.total ||
    b.liveExposure.hotZoneAdsToday - a.liveExposure.hotZoneAdsToday ||
    b.liveExposure.atRiskAdsToday - a.liveExposure.atRiskAdsToday ||
    a.accountId.localeCompare(b.accountId)
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rejectionCsvRows = parseCsv(args.rejectionCsv);
  const rejectionCopyRows = readJsonl(args.rejectionJsonl);
  const liveByAccountRows = readJsonArray(args.liveByAccountJson);
  const reviewPressureByAccountRows = readJsonArray(args.reviewPressureByAccountJson);
  const notes = fs.existsSync(args.notesPath) ? fs.readFileSync(args.notesPath, 'utf8') : '';

  const historyMap = new Map<string, AccountHistoryRow>();

  for (const row of rejectionCsvRows) {
    const accountId = String(row.account_id || '').trim();
    if (!accountId) continue;
    let entry = historyMap.get(accountId);
    if (!entry) {
      entry = {
        accountId,
        historicalRejections: {
          total: 0,
          policyCounts: {},
          reasonCounts: {},
          rowsWithObservedCopy: 0,
          rowsWithAdId: 0,
          sampleObservedCopy: [],
        },
        liveExposure: {
          totalAdsToday: 0,
          hotZoneAdsToday: 0,
          hotZonePctToday: 0,
          atRiskAdsToday: 0,
          atRiskPctToday: 0,
          blackAdsToday: 0,
          greyAdsToday: 0,
          whiteAdsToday: 0,
          buyers: [],
          rsocSites: [],
          strategisCampaignIds: [],
          facebookCampaignIds: [],
        },
        prototypeReviewPressure: null,
        restrictionEvidence: [],
        restrictionEvidenceAvailable: false,
        restrictionStatus: 'unknown',
        notes: [],
      };
      historyMap.set(accountId, entry);
    }

    entry.historicalRejections.total += 1;
    increment(entry.historicalRejections.reasonCounts, String(row.reason || '').trim() || '(unknown)');
    if (String(row.ad_id || '').trim()) entry.historicalRejections.rowsWithAdId += 1;
  }

  for (const row of rejectionCopyRows) {
    const accountId = String(row.account_id || '').trim();
    if (!accountId) continue;
    let entry = historyMap.get(accountId);
    if (!entry) continue;
    const policy = String(row.policy || '').trim() || '(none)';
    increment(entry.historicalRejections.policyCounts, policy);
    const observedCopy = String(row.observed_copy || '').trim();
    if (observedCopy) {
      entry.historicalRejections.rowsWithObservedCopy += 1;
      if (entry.historicalRejections.sampleObservedCopy.length < 5) {
        entry.historicalRejections.sampleObservedCopy.push(observedCopy);
      }
    }
  }

  for (const row of liveByAccountRows) {
    const accountId = String(row.id || row.adAccountId || '').trim();
    if (!accountId) continue;
    let entry = historyMap.get(accountId);
    if (!entry) {
      entry = {
        accountId,
        historicalRejections: {
          total: 0,
          policyCounts: {},
          reasonCounts: {},
          rowsWithObservedCopy: 0,
          rowsWithAdId: 0,
          sampleObservedCopy: [],
        },
        liveExposure: {
          totalAdsToday: 0,
          hotZoneAdsToday: 0,
          hotZonePctToday: 0,
          atRiskAdsToday: 0,
          atRiskPctToday: 0,
          blackAdsToday: 0,
          greyAdsToday: 0,
          whiteAdsToday: 0,
          buyers: [],
          rsocSites: [],
          strategisCampaignIds: [],
          facebookCampaignIds: [],
        },
        prototypeReviewPressure: null,
        restrictionEvidence: [],
        restrictionEvidenceAvailable: false,
        restrictionStatus: 'unknown',
        notes: [],
      };
      historyMap.set(accountId, entry);
    }

    entry.liveExposure = {
      totalAdsToday: Number(row.totalAds || 0),
      hotZoneAdsToday: Number(row.hotZoneAds || 0),
      hotZonePctToday: Number(row.hotZonePct || 0),
      atRiskAdsToday: Number(row.atRiskAds || 0),
      atRiskPctToday: Number(row.atRiskPct || 0),
      blackAdsToday: Number(row.blackAds || 0),
      greyAdsToday: Number(row.greyAds || 0),
      whiteAdsToday: Number(row.whiteAds || 0),
      buyers: Array.isArray(row.buyers) ? row.buyers : [],
      rsocSites: Array.isArray(row.rsocSites) ? row.rsocSites : [],
      strategisCampaignIds: Array.isArray(row.strategisCampaignIds) ? row.strategisCampaignIds : [],
      facebookCampaignIds: Array.isArray(row.facebookCampaignIds) ? row.facebookCampaignIds : [],
    };
  }

  for (const row of reviewPressureByAccountRows) {
    const accountId = String(row.accountId || '').trim();
    if (!accountId) continue;
    const entry = historyMap.get(accountId);
    if (!entry) continue;
    entry.prototypeReviewPressure = {
      testedAds: Number(row.testedAds || 0),
      acuteAds: Number(row.acuteAds || 0),
      highAds: Number(row.highAds || 0),
      watchAds: Number(row.watchAds || 0),
      lowAds: Number(row.lowAds || 0),
      totalSpend: Number(row.totalSpend || 0),
    };
  }

  const accounts = Array.from(historyMap.values())
    .map((entry) => {
      const evidences: RestrictionEvidence[] = [];
      entry.restrictionEvidence = evidences;
      entry.restrictionEvidenceAvailable = evidences.length > 0;
      entry.restrictionStatus = evidences.some((evidence) => evidence.status === 'confirmed')
        ? 'confirmed'
        : evidences.some((evidence) => evidence.status === 'possible')
          ? 'possible'
          : 'unknown';

      if (!entry.restrictionEvidenceAvailable) {
        entry.notes.push(
          'No account-quality export or restriction-status feed is attached here, so restriction status remains unknown.'
        );
      }
      if (entry.restrictionStatus === 'possible') {
        entry.notes.push(
          'Restriction evidence is indirect and user-level, not a verified ad-account restriction state.'
        );
      }
      if (entry.historicalRejections.total > 0 && entry.liveExposure.totalAdsToday > 0) {
        entry.notes.push('This account has both historical rejections and live ads in today’s graph.');
      }
      if (entry.historicalRejections.rowsWithObservedCopy === 0 && entry.historicalRejections.total > 0) {
        entry.notes.push('Rejected-ad creative payload is mostly unavailable here; comparison relies on metadata and partial observed copy.');
      }

      entry.historicalRejections.sampleObservedCopy = unique(entry.historicalRejections.sampleObservedCopy);
      entry.notes = unique(entry.notes);
      return entry;
    })
    .sort(compareRows);

  const accountsWithHistoricalRejections = accounts.filter((entry) => entry.historicalRejections.total > 0);
  const accountsWithLiveAds = accounts.filter((entry) => entry.liveExposure.totalAdsToday > 0);
  const overlapAccounts = accounts.filter(
    (entry) => entry.historicalRejections.total > 0 && entry.liveExposure.totalAdsToday > 0
  );

  const summary = {
    accountsTracked: accounts.length,
    accountsWithHistoricalRejections: accountsWithHistoricalRejections.length,
    accountsWithLiveAdsToday: accountsWithLiveAds.length,
    overlappingHistoricalAndLiveAccounts: overlapAccounts.length,
    historicalRejectionRows: accounts.reduce((sum, entry) => sum + entry.historicalRejections.total, 0),
    overlapHistoricalRejectionRows: overlapAccounts.reduce(
      (sum, entry) => sum + entry.historicalRejections.total,
      0
    ),
    globalRestrictionContext: notes.toLowerCase().includes("ben's facebook access was reported as banned")
      ? [
          {
            source: 'docs/facebook-notes-team-working-document-2026-02-25.md',
            detail:
              "The notes confirm a user-level ban on Ben's Facebook access, but they do not identify which ad accounts were restricted.",
          },
        ]
      : [],
    restrictionEvidenceCounts: {
      confirmed: accounts.filter((entry) => entry.restrictionStatus === 'confirmed').length,
      possible: accounts.filter((entry) => entry.restrictionStatus === 'possible').length,
      unknown: accounts.filter((entry) => entry.restrictionStatus === 'unknown').length,
    },
    topAccountsByRejections: accountsWithHistoricalRejections.slice(0, 10).map((entry) => ({
      accountId: entry.accountId,
      historicalRejections: entry.historicalRejections.total,
      hotZoneAdsToday: entry.liveExposure.hotZoneAdsToday,
      atRiskAdsToday: entry.liveExposure.atRiskAdsToday,
      buyers: entry.liveExposure.buyers,
      rsocSites: entry.liveExposure.rsocSites,
      restrictionStatus: entry.restrictionStatus,
    })),
  };

  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.writeFileSync(path.join(args.outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(args.outputDir, 'accounts.json'), `${JSON.stringify(accounts, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
