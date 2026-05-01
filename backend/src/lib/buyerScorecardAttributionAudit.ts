import { allRows, closeConnection, createMonitoringConnection, initMonitoringSchema, sqlString } from './monitoringDb';

type BuyerScorecardAttributionAuditOptions = {
  lookbackDays?: number;
  limitAmbiguousCampaigns?: number;
};

type CampaignAuditRow = {
  campaign_id: string;
  campaign_name: string | null;
  spend: number | null;
  revenue: number | null;
  active_days: number | null;
  monitoring_owner_count: number | null;
  monitoring_owner_label: string | null;
  monitoring_owner_key: string | null;
  launch_owner_label: string | null;
  launch_owner_key: string | null;
  queue_owner_label: string | null;
  queue_owner_key: string | null;
};

type OwnerAggregate = {
  ownerKey: string;
  ownerLabel: string;
  spend: number;
  revenue: number;
  netMargin: number;
  activeCampaigns: number;
  campaignsWithKnownMonitoringOwner: number;
  highConfidenceCampaigns: number;
  highConfidenceSpend: number;
  launchCount: number;
  queueCount: number;
  mixedOwnerCampaigns: number;
  launchOwnerMismatchCampaigns: number;
  queueOwnerMismatchCampaigns: number;
  launchQueueDisagreementCampaigns: number;
  missingLaunchOwnerCampaigns: number;
  missingQueueOwnerCampaigns: number;
};

function startDateStringForLookback(lookbackDays: number): string {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - (lookbackDays - 1));
  return startDate.toISOString().slice(0, 10);
}

function normalizeOwnerLabel(value: string | null | undefined): string {
  const normalized = String(value || '').trim();
  return normalized || 'UNKNOWN';
}

function normalizeOwnerKey(value: string | null | undefined): string {
  const normalized = normalizeOwnerLabel(value).toLowerCase();
  return ['unknown', 'unassigned', 'n/a', 'na', 'null'].includes(normalized) ? 'unassigned' : normalized;
}

function displayOwnerLabel(ownerKey: string, ownerLabel?: string | null): string {
  if (ownerKey === 'unassigned') return 'Unassigned';
  return normalizeOwnerLabel(ownerLabel);
}

function toNumber(value: any): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function safeRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

function ownerConfidence(aggregate: OwnerAggregate): 'high' | 'medium' | 'low' {
  if (!aggregate.activeCampaigns) return 'low';
  if (
    aggregate.mixedOwnerCampaigns === 0 &&
    aggregate.launchOwnerMismatchCampaigns === 0 &&
    aggregate.queueOwnerMismatchCampaigns === 0 &&
    aggregate.launchQueueDisagreementCampaigns === 0 &&
    aggregate.missingLaunchOwnerCampaigns <= 1 &&
    aggregate.missingQueueOwnerCampaigns <= 1
  ) {
    return 'high';
  }

  const mismatchPressure =
    aggregate.mixedOwnerCampaigns +
    aggregate.launchOwnerMismatchCampaigns +
    aggregate.queueOwnerMismatchCampaigns +
    aggregate.launchQueueDisagreementCampaigns;
  const coverage = safeRate(aggregate.highConfidenceCampaigns, aggregate.activeCampaigns);
  if (coverage >= 0.6 && mismatchPressure <= Math.max(1, Math.ceil(aggregate.activeCampaigns * 0.35))) {
    return 'medium';
  }
  return 'low';
}

function buildOwnerReasons(aggregate: OwnerAggregate, confidence: 'high' | 'medium' | 'low'): string[] {
  const reasons: string[] = [];
  if (aggregate.mixedOwnerCampaigns > 0) {
    reasons.push(`${aggregate.mixedOwnerCampaigns} campaign${aggregate.mixedOwnerCampaigns === 1 ? '' : 's'} show multiple monitoring owners in-window`);
  }
  if (aggregate.launchOwnerMismatchCampaigns > 0) {
    reasons.push(`${aggregate.launchOwnerMismatchCampaigns} campaign${aggregate.launchOwnerMismatchCampaigns === 1 ? '' : 's'} disagree with launch ownership`);
  }
  if (aggregate.queueOwnerMismatchCampaigns > 0) {
    reasons.push(`${aggregate.queueOwnerMismatchCampaigns} campaign${aggregate.queueOwnerMismatchCampaigns === 1 ? '' : 's'} disagree with assignment queue ownership`);
  }
  if (aggregate.launchQueueDisagreementCampaigns > 0) {
    reasons.push(`${aggregate.launchQueueDisagreementCampaigns} campaign${aggregate.launchQueueDisagreementCampaigns === 1 ? '' : 's'} have launch and queue owners that disagree`);
  }
  if (aggregate.missingLaunchOwnerCampaigns > 0) {
    reasons.push(`${aggregate.missingLaunchOwnerCampaigns} campaign${aggregate.missingLaunchOwnerCampaigns === 1 ? '' : 's'} are missing launch ownership`);
  }
  if (aggregate.missingQueueOwnerCampaigns > 0) {
    reasons.push(`${aggregate.missingQueueOwnerCampaigns} campaign${aggregate.missingQueueOwnerCampaigns === 1 ? '' : 's'} are missing queue ownership`);
  }
  if (!reasons.length && confidence === 'high') {
    reasons.push('monitoring, launch, and queue ownership are aligned in the current window');
  }
  if (!reasons.length) {
    reasons.push('attribution confidence is limited by sparse corroborating ownership data');
  }
  return reasons;
}

export async function getBuyerScorecardAttributionAudit(
  options: BuyerScorecardAttributionAuditOptions = {}
): Promise<any> {
  const lookbackDays = options.lookbackDays || 7;
  const limitAmbiguousCampaigns = options.limitAmbiguousCampaigns || 12;
  const startDateString = startDateStringForLookback(lookbackDays);
  const conn = createMonitoringConnection();

  try {
    await initMonitoringSchema(conn);
    const rows = await allRows<CampaignAuditRow>(
      conn,
      `
        WITH monitoring_campaigns AS (
          SELECT
            campaign_id,
            COALESCE(MAX(NULLIF(campaign_name, '')), '') AS campaign_name,
            SUM(COALESCE(spend_usd, 0)) AS spend,
            SUM(COALESCE(revenue_usd, 0)) AS revenue,
            COUNT(DISTINCT date) AS active_days,
            COUNT(DISTINCT CASE WHEN NULLIF(TRIM(owner), '') IS NOT NULL THEN LOWER(TRIM(owner)) END) AS monitoring_owner_count,
            COALESCE(MAX(CASE WHEN NULLIF(TRIM(owner), '') IS NOT NULL THEN TRIM(owner) END), 'UNKNOWN') AS monitoring_owner_label,
            COALESCE(MAX(CASE WHEN NULLIF(TRIM(owner), '') IS NOT NULL THEN LOWER(TRIM(owner)) END), 'unknown') AS monitoring_owner_key
          FROM campaign_index
          WHERE date >= ${sqlString(startDateString)}
            AND level = 'campaign'
          GROUP BY 1
        ),
        latest_queue AS (
          SELECT
            launch_campaign_id AS campaign_id,
            COALESCE(NULLIF(TRIM(launch_owner), ''), NULLIF(TRIM(assigned_buyer), ''), NULLIF(TRIM(requested_buyer), ''), 'UNKNOWN') AS queue_owner_label,
            COALESCE(NULLIF(LOWER(TRIM(launch_owner)), ''), NULLIF(LOWER(TRIM(assigned_buyer)), ''), NULLIF(LOWER(TRIM(requested_buyer)), ''), 'unknown') AS queue_owner_key,
            ROW_NUMBER() OVER (
              PARTITION BY launch_campaign_id
              ORDER BY COALESCE(updated_at, last_seen_at, created_at) DESC, created_at DESC
            ) AS rn
          FROM campaign_assignment_queue
          WHERE launch_campaign_id IS NOT NULL
            AND TRIM(launch_campaign_id) <> ''
        ),
        queue_owners AS (
          SELECT campaign_id, queue_owner_label, queue_owner_key
          FROM latest_queue
          WHERE rn = 1
        )
        SELECT
          mc.campaign_id,
          mc.campaign_name,
          mc.spend,
          mc.revenue,
          mc.active_days,
          mc.monitoring_owner_count,
          mc.monitoring_owner_label,
          mc.monitoring_owner_key,
          COALESCE(NULLIF(TRIM(cl.owner), ''), NULL) AS launch_owner_label,
          COALESCE(NULLIF(LOWER(TRIM(cl.owner)), ''), NULL) AS launch_owner_key,
          qo.queue_owner_label,
          qo.queue_owner_key
        FROM monitoring_campaigns mc
        LEFT JOIN campaign_launches cl
          ON cl.campaign_id = mc.campaign_id
        LEFT JOIN queue_owners qo
          ON qo.campaign_id = mc.campaign_id
      `
    );

    const ownerMap = new Map<string, OwnerAggregate>();
    const ambiguousCampaigns: any[] = [];

    let knownMonitoringOwnerCampaigns = 0;
    let campaignsWithLaunchOwner = 0;
    let campaignsWithQueueOwner = 0;
    let mixedMonitoringOwnerCampaigns = 0;
    let launchOwnerMismatchCampaigns = 0;
    let queueOwnerMismatchCampaigns = 0;
    let launchQueueDisagreementCampaigns = 0;
    let lowConfidenceCampaigns = 0;
    let unassignedSpend = 0;

    for (const row of rows) {
      const monitoringOwnerCount = toNumber(row.monitoring_owner_count);
      const spend = toNumber(row.spend);
      const revenue = toNumber(row.revenue);
      const monitoringOwnerKey = normalizeOwnerKey(row.monitoring_owner_key || row.monitoring_owner_label);
      const monitoringOwnerLabel = displayOwnerLabel(monitoringOwnerKey, row.monitoring_owner_label);
      const launchOwnerKey = normalizeOwnerKey(row.launch_owner_key || row.launch_owner_label);
      const queueOwnerKey = normalizeOwnerKey(row.queue_owner_key || row.queue_owner_label);
      const hasLaunchOwner = normalizeOwnerLabel(row.launch_owner_label) !== 'UNKNOWN';
      const hasQueueOwner = normalizeOwnerLabel(row.queue_owner_label) !== 'UNKNOWN';
      const mixedMonitoringOwners = monitoringOwnerCount > 1;
      const launchMismatch = hasLaunchOwner && monitoringOwnerKey !== 'unassigned' && launchOwnerKey !== monitoringOwnerKey;
      const queueMismatch = hasQueueOwner && monitoringOwnerKey !== 'unassigned' && queueOwnerKey !== monitoringOwnerKey;
      const launchQueueDisagreement = hasLaunchOwner && hasQueueOwner && launchOwnerKey !== queueOwnerKey;

      const issues: string[] = [];
      if (monitoringOwnerKey === 'unassigned') issues.push('missing monitoring owner');
      if (mixedMonitoringOwners) issues.push('mixed monitoring owners');
      if (!hasLaunchOwner) issues.push('missing launch owner');
      if (!hasQueueOwner) issues.push('missing queue owner');
      if (launchMismatch) issues.push('launch owner mismatch');
      if (queueMismatch) issues.push('queue owner mismatch');
      if (launchQueueDisagreement) issues.push('launch and queue owners disagree');

      const campaignConfidence: 'high' | 'medium' | 'low' =
        monitoringOwnerKey === 'unassigned' || mixedMonitoringOwners || (launchMismatch && queueMismatch)
          ? 'low'
          : launchMismatch || queueMismatch || !hasLaunchOwner || !hasQueueOwner || launchQueueDisagreement
            ? 'medium'
            : 'high';

      if (monitoringOwnerKey !== 'unassigned') knownMonitoringOwnerCampaigns += 1;
      if (hasLaunchOwner) campaignsWithLaunchOwner += 1;
      if (hasQueueOwner) campaignsWithQueueOwner += 1;
      if (mixedMonitoringOwners) mixedMonitoringOwnerCampaigns += 1;
      if (launchMismatch) launchOwnerMismatchCampaigns += 1;
      if (queueMismatch) queueOwnerMismatchCampaigns += 1;
      if (launchQueueDisagreement) launchQueueDisagreementCampaigns += 1;
      if (campaignConfidence === 'low') lowConfidenceCampaigns += 1;
      if (monitoringOwnerKey === 'unassigned') unassignedSpend += spend;

      const aggregate = ownerMap.get(monitoringOwnerKey) || {
        ownerKey: monitoringOwnerKey,
        ownerLabel: monitoringOwnerLabel,
        spend: 0,
        revenue: 0,
        netMargin: 0,
        activeCampaigns: 0,
        campaignsWithKnownMonitoringOwner: 0,
        highConfidenceCampaigns: 0,
        highConfidenceSpend: 0,
        launchCount: 0,
        queueCount: 0,
        mixedOwnerCampaigns: 0,
        launchOwnerMismatchCampaigns: 0,
        queueOwnerMismatchCampaigns: 0,
        launchQueueDisagreementCampaigns: 0,
        missingLaunchOwnerCampaigns: 0,
        missingQueueOwnerCampaigns: 0,
      };

      aggregate.spend += spend;
      aggregate.revenue += revenue;
      aggregate.netMargin += revenue - spend;
      aggregate.activeCampaigns += 1;
      if (monitoringOwnerKey !== 'unassigned') aggregate.campaignsWithKnownMonitoringOwner += 1;
      if (campaignConfidence === 'high') {
        aggregate.highConfidenceCampaigns += 1;
        aggregate.highConfidenceSpend += spend;
      }
      if (hasLaunchOwner) aggregate.launchCount += 1;
      if (hasQueueOwner) aggregate.queueCount += 1;
      if (mixedMonitoringOwners) aggregate.mixedOwnerCampaigns += 1;
      if (launchMismatch) aggregate.launchOwnerMismatchCampaigns += 1;
      if (queueMismatch) aggregate.queueOwnerMismatchCampaigns += 1;
      if (launchQueueDisagreement) aggregate.launchQueueDisagreementCampaigns += 1;
      if (!hasLaunchOwner) aggregate.missingLaunchOwnerCampaigns += 1;
      if (!hasQueueOwner) aggregate.missingQueueOwnerCampaigns += 1;
      ownerMap.set(monitoringOwnerKey, aggregate);

      if (issues.length) {
        ambiguousCampaigns.push({
          campaignId: String(row.campaign_id),
          campaignName: String(row.campaign_name || '').trim() || `Campaign ${row.campaign_id}`,
          monitoringOwnerLabel,
          launchOwnerLabel: hasLaunchOwner ? normalizeOwnerLabel(row.launch_owner_label) : null,
          queueOwnerLabel: hasQueueOwner ? normalizeOwnerLabel(row.queue_owner_label) : null,
          spend,
          revenue,
          activeDays: toNumber(row.active_days),
          attributionConfidence: campaignConfidence,
          issues,
        });
      }
    }

    const owners = Array.from(ownerMap.values())
      .map((aggregate) => {
        const confidence = ownerConfidence(aggregate);
        return {
          ownerKey: aggregate.ownerKey,
          ownerLabel: aggregate.ownerLabel,
          spend: aggregate.spend,
          revenue: aggregate.revenue,
          netMargin: aggregate.netMargin,
          activeCampaigns: aggregate.activeCampaigns,
          campaignsWithKnownMonitoringOwner: aggregate.campaignsWithKnownMonitoringOwner,
          launchCount: aggregate.launchCount,
          queueCount: aggregate.queueCount,
          highConfidenceCampaigns: aggregate.highConfidenceCampaigns,
          attributionCoverage: safeRate(aggregate.highConfidenceCampaigns, aggregate.activeCampaigns),
          spendCoverage: safeRate(aggregate.highConfidenceSpend, aggregate.spend),
          mixedOwnerCampaigns: aggregate.mixedOwnerCampaigns,
          launchOwnerMismatchCampaigns: aggregate.launchOwnerMismatchCampaigns,
          queueOwnerMismatchCampaigns: aggregate.queueOwnerMismatchCampaigns,
          launchQueueDisagreementCampaigns: aggregate.launchQueueDisagreementCampaigns,
          missingLaunchOwnerCampaigns: aggregate.missingLaunchOwnerCampaigns,
          missingQueueOwnerCampaigns: aggregate.missingQueueOwnerCampaigns,
          attributionConfidence: confidence,
          reasons: buildOwnerReasons(aggregate, confidence),
        };
      })
      .sort((a, b) => {
        const rank = { low: 0, medium: 1, high: 2 };
        return (
          rank[a.attributionConfidence] - rank[b.attributionConfidence] ||
          b.spend - a.spend ||
          b.activeCampaigns - a.activeCampaigns
        );
      });

    const ambiguous = ambiguousCampaigns
      .sort((a, b) => {
        const rank: Record<'low' | 'medium' | 'high', number> = { low: 0, medium: 1, high: 2 };
        return (
          rank[a.attributionConfidence as 'low' | 'medium' | 'high'] -
            rank[b.attributionConfidence as 'low' | 'medium' | 'high'] ||
          b.issues.length - a.issues.length ||
          b.spend - a.spend
        );
      })
      .slice(0, limitAmbiguousCampaigns);

    let operatorRead = 'Buyer scorecards are now being audited against launch and assignment ownership, so attribution quality is measurable instead of implied.';
    if (!rows.length) {
      operatorRead = 'No campaign-level monitoring rows were available in the current window, so buyer attribution cannot be audited yet.';
    } else if (lowConfidenceCampaigns > 0) {
      operatorRead = `${lowConfidenceCampaigns} campaign${lowConfidenceCampaigns === 1 ? '' : 's'} are low-confidence for buyer attribution, so scorecard economics still need human caution before they drive allocation or coaching.`;
    } else if (launchOwnerMismatchCampaigns > 0 || queueOwnerMismatchCampaigns > 0) {
      operatorRead = 'Monitoring performance exists, but ownership disagreement between monitoring, launches, and assignment queue means buyer scorecards are not yet fully grounded.';
    }

    return {
      window: {
        lookbackDays,
        startDate: startDateString,
        through: new Date().toISOString().slice(0, 10),
      },
      summary: {
        totalCampaigns: rows.length,
        knownMonitoringOwnerCampaigns,
        campaignsWithLaunchOwner,
        campaignsWithQueueOwner,
        mixedMonitoringOwnerCampaigns,
        launchOwnerMismatchCampaigns,
        queueOwnerMismatchCampaigns,
        launchQueueDisagreementCampaigns,
        lowConfidenceCampaigns,
        unattributedSpend: unassignedSpend,
      },
      owners,
      ambiguousCampaigns: ambiguous,
      operatorRead,
    };
  } finally {
    closeConnection(conn);
  }
}
