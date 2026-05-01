import { getPgPool } from './pg';
import { listOperatorCommandQueueStates } from './operatorCommandQueueState';
import { MeetingIntelligenceService } from '../services/meetingIntelligence';

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
}

function lower(value: string | null | undefined): string {
  return normalize(value).toLowerCase();
}

function toNumber(value: any): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function round(value: number | null | undefined, decimals = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function safeJson(value: any): Record<string, any> {
  return value && typeof value === 'object' ? value : {};
}

function bandRank(value: string | null | undefined): number {
  switch (String(value || '').toLowerCase()) {
    case 'green':
      return 3;
    case 'yellow':
      return 2;
    case 'red':
      return 1;
    default:
      return 0;
  }
}

function surfaceRiskRank(value: string | null | undefined): number {
  switch (String(value || '').toLowerCase()) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    case 'critical':
      return 4;
    default:
      return 0;
  }
}

function hoursSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  return (Date.now() - ts) / 36e5;
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value) => typeof value === 'number' && Number.isFinite(value)) as number[];
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function latestMovementState(
  row: any,
  cutoffMs: number
): { state: 'seen' | 'in_progress' | 'cleared' | 'promoted' | 'deferred'; changedAt: string } | null {
  const candidates = [
    { state: 'seen' as const, changedAt: row.seen_at || null },
    { state: 'in_progress' as const, changedAt: row.in_progress_at || null },
    { state: 'cleared' as const, changedAt: row.cleared_at || null },
    { state: 'promoted' as const, changedAt: row.promoted_at || null },
    { state: 'deferred' as const, changedAt: row.deferred_at || null },
  ]
    .filter((item) => item.changedAt)
    .filter((item) => {
      const ts = new Date(String(item.changedAt)).getTime();
      return Number.isFinite(ts) && ts >= cutoffMs;
    })
    .sort((a, b) => {
      return new Date(String(b.changedAt)).getTime() - new Date(String(a.changedAt)).getTime();
    });

  return candidates[0] || null;
}

async function getBaselineSnapshot(ownerKey: string, atOrBefore: string | null | undefined): Promise<any | null> {
  if (!ownerKey || !atOrBefore) return null;
  const baselineResult = await getPgPool().query(
    `
      SELECT *
      FROM buyer_execution_scorecard_snapshots
      WHERE owner_key = $1
        AND captured_at <= $2::timestamptz
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    [ownerKey, atOrBefore]
  ).catch(() => ({ rows: [] as any[] }));
  return baselineResult.rows[0] || null;
}

function classifyMovement(input: {
  movementState: 'seen' | 'in_progress' | 'cleared' | 'promoted' | 'deferred';
  positiveSignals: string[];
  negativeSignals: string[];
}): { movementStatus: string; meaningfulMovement: boolean; headline: string } {
  const { movementState, positiveSignals, negativeSignals } = input;

  if (positiveSignals.length > negativeSignals.length && positiveSignals.length > 0) {
    return {
      movementStatus: 'validated',
      meaningfulMovement: true,
      headline: 'Yesterday’s handling is showing measured improvement by this morning.',
    };
  }

  if (negativeSignals.length > positiveSignals.length && negativeSignals.length > 0) {
    return {
      movementStatus: 'worsened',
      meaningfulMovement: true,
      headline: 'The lane moved, but this morning the downstream posture is worse.',
    };
  }

  if (movementState === 'promoted') {
    return {
      movementStatus: 'advanced',
      meaningfulMovement: true,
      headline: 'The lane was promoted, but downstream improvement is not validated yet.',
    };
  }

  if (movementState === 'cleared') {
    return {
      movementStatus: 'advanced',
      meaningfulMovement: true,
      headline: 'The lane was cleared, but this morning’s scorecard has not validated impact yet.',
    };
  }

  if (movementState === 'in_progress') {
    return {
      movementStatus: 'advanced',
      meaningfulMovement: true,
      headline: 'The lane moved into active work, but it is still too early to call it validated.',
    };
  }

  if (movementState === 'deferred') {
    return {
      movementStatus: 'deferred',
      meaningfulMovement: false,
      headline: 'The lane was explicitly deferred and still needs a future revisit point.',
    };
  }

  return {
    movementStatus: 'acknowledged',
    meaningfulMovement: false,
    headline: 'The lane was acknowledged, but the movement is still mostly administrative.',
  };
}

export async function getCommandOutcomeTelemetryReport(options: { lookbackDays?: number; limit?: number } = {}): Promise<any> {
  const service = new MeetingIntelligenceService();
  const stateRows = await listOperatorCommandQueueStates();
  const resolvedStates = stateRows
    .filter((row: any) => ['cleared', 'promoted'].includes(String(row.status)))
    .sort((a: any, b: any) => {
      return new Date(String(b.last_state_changed_at || b.updated_at || 0)).getTime() -
        new Date(String(a.last_state_changed_at || a.updated_at || 0)).getTime();
    });
  const movementWindowHours = 24;
  const movementCutoff = Date.now() - movementWindowHours * 36e5;

  const currentScorecards = await service.listBuyerExecutionScorecards({
    lookbackDays: options.lookbackDays || 7,
    limit: 50,
  });
  const currentByOwner = new Map<string, any>(
    currentScorecards.map((card: any) => [lower(card.ownerKey), card])
  );

  const items = [];
  for (const row of resolvedStates.slice(0, options.limit || 20)) {
    const ownerKey = lower(row.owner_key);
    const current = currentByOwner.get(ownerKey) || null;
    const baseline = await getBaselineSnapshot(
      String(row.owner_key),
      row.last_state_changed_at || row.updated_at || row.created_at
    );
    const baselineMetadata = safeJson(baseline?.metadata);

    const currentBand = String(current?.band || '');
    const baselineBand = String(baseline?.band || '');
    const currentSurfaceRisk = String(current?.surfaceExposure?.riskBand || '');
    const baselineSurfaceRisk = String(baselineMetadata.surface_risk_band || '');

    const netMarginDelta = current ? toNumber(current.performance?.netMargin) - toNumber(baseline?.net_margin) : null;
    const executionScoreDelta = current ? toNumber(current.execution?.executionScore) - toNumber(baseline?.execution_score) : null;
    const queuePressureImprovement = current ? toNumber(baseline?.queue_pressure) - toNumber(current.execution?.queuePressure) : null;
    const overdueActionImprovement = current ? toNumber(baseline?.overdue_actions) - toNumber(current.execution?.overdueActions) : null;
    const bandDelta = bandRank(currentBand) - bandRank(baselineBand);
    const surfaceRiskImprovement = surfaceRiskRank(baselineSurfaceRisk) - surfaceRiskRank(currentSurfaceRisk);

    const positiveSignals: string[] = [];
    const negativeSignals: string[] = [];
    if ((executionScoreDelta || 0) >= 5) positiveSignals.push('execution score improved');
    if ((queuePressureImprovement || 0) >= 5) positiveSignals.push('queue pressure decreased');
    if ((overdueActionImprovement || 0) >= 1) positiveSignals.push('overdue action debt decreased');
    if (bandDelta > 0) positiveSignals.push(`buyer band improved from ${baselineBand || 'unknown'} to ${currentBand || 'unknown'}`);
    if (surfaceRiskImprovement > 0) positiveSignals.push('surface risk improved');

    if ((executionScoreDelta || 0) <= -5) negativeSignals.push('execution score worsened');
    if ((queuePressureImprovement || 0) <= -5) negativeSignals.push('queue pressure increased');
    if ((overdueActionImprovement || 0) <= -1) negativeSignals.push('overdue action debt increased');
    if (bandDelta < 0) negativeSignals.push(`buyer band worsened from ${baselineBand || 'unknown'} to ${currentBand || 'unknown'}`);
    if (surfaceRiskImprovement < 0) negativeSignals.push('surface risk worsened');

    let outcomeStatus: 'validated' | 'mixed' | 'no_signal' | 'worsened' | 'not_enough_history' = 'not_enough_history';
    if (baseline && current) {
      if (positiveSignals.length > negativeSignals.length && positiveSignals.length > 0) outcomeStatus = 'validated';
      else if (negativeSignals.length > positiveSignals.length && negativeSignals.length > 0) outcomeStatus = 'worsened';
      else if (positiveSignals.length || negativeSignals.length) outcomeStatus = 'mixed';
      else outcomeStatus = 'no_signal';
    }

    items.push({
      commandKey: String(row.command_key),
      ownerKey: String(row.owner_key),
      ownerLabel: String(row.owner_label || row.owner_key),
      state: String(row.status),
      stateChangedAt: row.last_state_changed_at || null,
      hoursSinceResolution: round(hoursSince(row.last_state_changed_at || row.updated_at || row.created_at), 2),
      outcomeStatus,
      positiveSignals,
      negativeSignals,
      metrics: {
        netMarginDelta: round(netMarginDelta, 2),
        executionScoreDelta: round(executionScoreDelta, 2),
        queuePressureImprovement: round(queuePressureImprovement, 2),
        overdueActionImprovement: round(overdueActionImprovement, 2),
        bandBefore: baselineBand || null,
        bandAfter: currentBand || null,
        surfaceRiskBefore: baselineSurfaceRisk || null,
        surfaceRiskAfter: currentSurfaceRisk || null,
      },
    });
  }

  const recentMovement = [];
  for (const row of stateRows) {
    const ownerKey = lower(row.owner_key);
    const current = currentByOwner.get(ownerKey) || null;
    const movement = latestMovementState(row, movementCutoff);
    if (!movement) continue;

    const baseline = await getBaselineSnapshot(String(row.owner_key), movement.changedAt);
    const baselineMetadata = safeJson(baseline?.metadata);

    const currentBand = String(current?.band || '');
    const baselineBand = String(baseline?.band || '');
    const currentSurfaceRisk = String(current?.surfaceExposure?.riskBand || '');
    const baselineSurfaceRisk = String(baselineMetadata.surface_risk_band || '');

    const executionScoreDelta = current ? toNumber(current.execution?.executionScore) - toNumber(baseline?.execution_score) : null;
    const queuePressureImprovement = current ? toNumber(baseline?.queue_pressure) - toNumber(current.execution?.queuePressure) : null;
    const overdueActionImprovement = current ? toNumber(baseline?.overdue_actions) - toNumber(current.execution?.overdueActions) : null;
    const bandDelta = bandRank(currentBand) - bandRank(baselineBand);
    const surfaceRiskImprovement = surfaceRiskRank(baselineSurfaceRisk) - surfaceRiskRank(currentSurfaceRisk);

    const positiveSignals: string[] = [];
    const negativeSignals: string[] = [];
    if ((executionScoreDelta || 0) >= 5) positiveSignals.push('execution score improved');
    if ((queuePressureImprovement || 0) >= 5) positiveSignals.push('queue pressure decreased');
    if ((overdueActionImprovement || 0) >= 1) positiveSignals.push('overdue action debt decreased');
    if (bandDelta > 0) positiveSignals.push(`buyer band improved from ${baselineBand || 'unknown'} to ${currentBand || 'unknown'}`);
    if (surfaceRiskImprovement > 0) positiveSignals.push('surface risk improved');

    if ((executionScoreDelta || 0) <= -5) negativeSignals.push('execution score worsened');
    if ((queuePressureImprovement || 0) <= -5) negativeSignals.push('queue pressure increased');
    if ((overdueActionImprovement || 0) <= -1) negativeSignals.push('overdue action debt increased');
    if (bandDelta < 0) negativeSignals.push(`buyer band worsened from ${baselineBand || 'unknown'} to ${currentBand || 'unknown'}`);
    if (surfaceRiskImprovement < 0) negativeSignals.push('surface risk worsened');

    const outcomeStatus: 'validated' | 'mixed' | 'no_signal' | 'worsened' | 'not_enough_history' =
      !baseline || !current
        ? 'not_enough_history'
        : positiveSignals.length > negativeSignals.length && positiveSignals.length > 0
          ? 'validated'
          : negativeSignals.length > positiveSignals.length && negativeSignals.length > 0
            ? 'worsened'
            : positiveSignals.length || negativeSignals.length
              ? 'mixed'
              : 'no_signal';

    const movementClassification = classifyMovement({
      movementState: movement.state,
      positiveSignals,
      negativeSignals,
    });

    recentMovement.push({
      commandKey: String(row.command_key),
      ownerKey: String(row.owner_key),
      ownerLabel: String(row.owner_label || row.owner_key),
      state: String(row.status),
      movementState: movement.state,
      movementChangedAt: movement.changedAt,
      hoursSinceMovement: round(hoursSince(movement.changedAt), 2),
      outcomeStatus,
      movementStatus: movementClassification.movementStatus,
      meaningfulMovement: movementClassification.meaningfulMovement,
      headline: movementClassification.headline,
      positiveSignals,
      negativeSignals,
      metrics: {
        executionScoreDelta: round(executionScoreDelta, 2),
        queuePressureImprovement: round(queuePressureImprovement, 2),
        overdueActionImprovement: round(overdueActionImprovement, 2),
        bandBefore: baselineBand || null,
        bandAfter: currentBand || null,
        surfaceRiskBefore: baselineSurfaceRisk || null,
        surfaceRiskAfter: currentSurfaceRisk || null,
      },
    });
  }

  recentMovement.sort((a, b) => {
    return new Date(String(b.movementChangedAt || 0)).getTime() - new Date(String(a.movementChangedAt || 0)).getTime();
  });

  const validated = items.filter((item) => item.outcomeStatus === 'validated').length;
  const worsened = items.filter((item) => item.outcomeStatus === 'worsened').length;
  const mixed = items.filter((item) => item.outcomeStatus === 'mixed').length;
  const noSignal = items.filter((item) => item.outcomeStatus === 'no_signal').length;
  const notEnoughHistory = items.filter((item) => item.outcomeStatus === 'not_enough_history').length;
  const resolvedCount = items.length;

  const validatedRate = resolvedCount ? validated / resolvedCount : 0;
  const avgHoursSinceResolution = average(items.map((item) => item.hoursSinceResolution));
  const meaningfulMovementCount = recentMovement.filter((item) => item.meaningfulMovement).length;
  const advancedButUnvalidatedCount = recentMovement.filter((item) => item.movementStatus === 'advanced').length;
  const cosmeticTouchCount = recentMovement.filter((item) => item.movementStatus === 'acknowledged').length;
  const deferredCount = recentMovement.filter((item) => item.movementStatus === 'deferred').length;
  const recentWorsenedCount = recentMovement.filter((item) => item.movementStatus === 'worsened').length;
  const recentValidatedCount = recentMovement.filter((item) => item.movementStatus === 'validated').length;

  let operatorRead =
    'Command outcome telemetry now tests whether resolved operator commands are actually improving buyer posture, queue pressure, or surface conditions.';
  if (validated > 0) {
    operatorRead =
      `${validated} resolved commands show validated downstream improvement signals, so the system can start distinguishing useful operator action from cosmetic queue movement.`;
  } else if (resolvedCount > 0) {
    operatorRead =
      'Resolved commands exist, but there is not enough validated downstream improvement yet to trust Sprint 02 as outcome-closed.';
  }

  let nextMorningRead =
    `The next-morning movement layer now distinguishes meaningful movement from simple state changes across the last ${movementWindowHours} hours.`;
  if (meaningfulMovementCount > 0 || cosmeticTouchCount > 0) {
    nextMorningRead =
      `${meaningfulMovementCount} lanes moved meaningfully in the last ${movementWindowHours} hours, ${recentValidatedCount} are already showing validated improvement, and ${cosmeticTouchCount} are still mostly acknowledgement without morning proof.`;
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      resolvedCount,
      validated,
      worsened,
      mixed,
      noSignal,
      notEnoughHistory,
      validatedRate: round(validatedRate, 3) || 0,
      avgHoursSinceResolution: round(avgHoursSinceResolution, 2),
    },
    nextMorning: {
      lookbackHours: movementWindowHours,
      changedCount: recentMovement.length,
      meaningfulMovementCount,
      validatedImprovementCount: recentValidatedCount,
      advancedButUnvalidatedCount,
      cosmeticTouchCount,
      worsenedCount: recentWorsenedCount,
      deferredCount,
      operatorRead: nextMorningRead,
    },
    items,
    recentMovement: recentMovement.slice(0, options.limit || 20),
    operatorRead,
  };
}
