import { getAllocationExecutionEngineReport } from './allocationExecutionEngine';
import { getBuyerDailyCommandPacketReport } from './buyerDailyCommandPacket';
import { getCommandOutcomeTelemetryReport } from './commandOutcomeTelemetry';
import { evaluateDelegationBoundary } from './delegationReadiness';
import { listOperatorCommandQueueStates } from './operatorCommandQueueState';

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
}

function lower(value: string | null | undefined): string {
  return normalize(value).toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => normalize(value)).filter(Boolean)));
}

function priorityRank(value: string): number {
  switch (value) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    default:
      return 3;
  }
}

export async function getOperatorCommandQueueReport(options: { lookbackDays?: number; limitBuyers?: number } = {}): Promise<any> {
  const [packets, execution, stateRows, outcomeTelemetry] = await Promise.all([
    getBuyerDailyCommandPacketReport(options),
    getAllocationExecutionEngineReport(options),
    listOperatorCommandQueueStates(),
    getCommandOutcomeTelemetryReport({ lookbackDays: options.lookbackDays || 7, limit: 50 }),
  ]);

  const executionByOwner = new Map<string, any>(
    (execution.queue || []).map((item: any) => [lower(item.ownerKey), item])
  );
  const stateByCommandKey = new Map<string, any>(
    (stateRows || []).map((item: any) => [String(item.command_key), item])
  );
  const movementByCommandKey = new Map<string, any>(
    (outcomeTelemetry.recentMovement || []).map((item: any) => [String(item.commandKey), item])
  );

  const queue = (packets.packets || []).map((packet: any) => {
    const capital = executionByOwner.get(lower(packet.ownerKey)) || null;
    const capitalPriority = String(capital?.priority || 'low');
    const capitalBlocker = capital?.blockers?.[0] || null;
    const promotionCondition = capital?.promoteWhen?.[0] || null;
    const blockerToClear = capitalBlocker || packet.blockers[0] || null;
    const actionScore = Number(packet.commandScore || 0) + (capitalPriority === 'critical' ? 20 : capitalPriority === 'high' ? 10 : 0);
    const commandKey = `${packet.ownerKey}:operator-command`;
    const state = stateByCommandKey.get(commandKey) || null;
    const movement = movementByCommandKey.get(commandKey) || null;

    const delegationBoundary = evaluateDelegationBoundary({
      priority: packet.priority,
      capitalPriority: capital?.priority || 'low',
      triggerState: capital?.triggerState || packet.triggerState,
      blockers: packet.blockers || [],
      blockerToClear,
      supplyQualityBand: packet.metrics?.supplyQualityBand || 'unknown',
      supplyLaunchRate: packet.metrics?.supplyLaunchRate ?? null,
      supplyBlueprintCoverage: packet.metrics?.supplyBlueprintCoverage ?? null,
      activeConstraintCount: packet.metrics?.activeConstraintCount || 0,
      firstAction: packet.firstAction,
      policyAction: capital?.policyAction || packet.policyAction,
      operatorState: state?.status || 'queued',
      movementStatus: movement?.movementStatus || null,
      todayAskCount: packet.todayAsks?.length || 0,
      previewOnly: true,
    });

    return {
      commandKey,
      sequenceIndex: 0,
      ownerKey: packet.ownerKey,
      ownerLabel: packet.ownerLabel,
      priority: packet.priority,
      capitalPriority,
      actionScore,
      topFocus: packet.topFocus,
      whyNow: packet.whyNow,
      firstAction: packet.firstAction,
      capitalAction: capital?.nextStep || capital?.recommendedAction || 'Observe only; no active capital move yet.',
      policyAction: capital?.policyAction || packet.policyAction,
      triggerState: capital?.triggerState || packet.triggerState,
      blockerToClear,
      promotionCondition,
      supplyQualityBand: packet.metrics?.supplyQualityBand || 'unknown',
      posture: packet.posture,
      state: state?.status || 'queued',
      stateChangedAt: state?.last_state_changed_at || null,
      stateNote: state?.note_md || null,
      delegationReadiness: delegationBoundary.status,
      delegationReadinessReasons: delegationBoundary.reasons,
      delegationBoundary,
      movementStatus: movement?.movementStatus || null,
      movementMeaningful: Boolean(movement?.meaningfulMovement),
      movementState: movement?.movementState || null,
      movementHeadline: movement?.headline || null,
      movementChangedAt: movement?.movementChangedAt || null,
      movementPositiveSignals: movement?.positiveSignals || [],
      movementNegativeSignals: movement?.negativeSignals || [],
      orderingReasons: uniqueStrings([
        ...(packet.orderingReasons || []),
        capitalBlocker ? `Capital blocker: ${capitalBlocker}` : null,
        promotionCondition ? `Promotion condition: ${promotionCondition}` : null,
      ]).slice(0, 5),
      spendGuardrail: capital?.spendGuardrail || null,
      draftPreview: packet.draftPreview,
      explainability: {
        buyerDriver: packet.topFocus,
        capitalDriver: capital?.nextStep || capital?.recommendedAction || 'No active capital move yet.',
        blockerDriver: blockerToClear,
        promotionDriver: promotionCondition,
      },
    };
  }).sort((a: any, b: any) => {
    return (
      b.actionScore - a.actionScore ||
      priorityRank(a.priority) - priorityRank(b.priority) ||
      lower(a.ownerLabel).localeCompare(lower(b.ownerLabel))
    );
  }).map((item: any, index: number) => ({
    ...item,
    sequenceIndex: index + 1,
  }));

  const summary = {
    total: queue.length,
    actNow: queue.filter((item: any) => item.actionScore >= 100).length,
    critical: queue.filter((item: any) => item.priority === 'critical' || item.capitalPriority === 'critical').length,
    blocked: queue.filter((item: any) => item.triggerState === 'blocked').length,
    weakSupply: queue.filter((item: any) => item.supplyQualityBand === 'red').length,
    readyToDelegate: queue.filter((item: any) => item.delegationReadiness === 'ready').length,
    overrideOnly: queue.filter((item: any) => item.delegationBoundary?.override?.allowed).length,
    blockedForDelegation: queue.filter((item: any) => item.delegationReadiness === 'blocked').length,
    meaningfulSinceYesterday: queue.filter((item: any) => item.movementMeaningful).length,
    validatedSinceYesterday: queue.filter((item: any) => item.movementStatus === 'validated').length,
    cosmeticTouchesSinceYesterday: queue.filter((item: any) => item.movementStatus === 'acknowledged').length,
    queued: queue.filter((item: any) => item.state === 'queued').length,
    seen: queue.filter((item: any) => item.state === 'seen').length,
    inProgress: queue.filter((item: any) => item.state === 'in_progress').length,
    cleared: queue.filter((item: any) => item.state === 'cleared').length,
    promoted: queue.filter((item: any) => item.state === 'promoted').length,
  };

  let operatorRead =
    'The unified operator command queue merges buyer steering and capital-control actions into one ranked surface so the operator can act without stitching adjacent views together.';
  if (queue[0]) {
    operatorRead =
      `${queue[0].ownerLabel} is first in the operator queue because buyer-level action and capital-control pressure now collapse into one ranked command surface.`;
  }
  if (summary.critical > 0) {
    operatorRead =
      `${summary.critical} lanes are in critical mode across buyer work or capital control, so the unified queue should be used as the day’s starting order rather than a secondary reference.`;
  }
  if (summary.meaningfulSinceYesterday > 0) {
    operatorRead =
      `${summary.meaningfulSinceYesterday} lanes show meaningful next-morning movement, including ${summary.validatedSinceYesterday} already validated by buyer posture or queue improvement.`;
  }

  return {
    window: packets.window,
    summary,
    queue,
    operatorRead,
  };
}
