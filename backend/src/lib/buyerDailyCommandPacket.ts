import { getAllocationExecutionEngineReport } from './allocationExecutionEngine';
import { evaluateDelegationBoundary } from './delegationReadiness';
import { getIntentPacketOwnershipReport } from './intentPacketOwnershipQueue';
import { getOpportunityOwnershipReport } from './opportunityOwnershipQueue';
import { getSurfacePreservationCommandLayerReport } from './surfacePreservationCommandLayer';
import { MeetingIntelligenceService } from '../services/meetingIntelligence';

type BuyerDailyCommandPacketOptions = {
  lookbackDays?: number;
  limitBuyers?: number;
};

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

function prettyLabel(value: string | null | undefined): string {
  return normalize(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatPercentLabel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return 'unknown';
  }
  return `${Math.round(value * 100)}%`;
}

function ownerMatches(ownerName: string | null | undefined, ownerKey: string, ownerLabel: string): boolean {
  const candidate = lower(ownerName);
  return Boolean(candidate) && (candidate === lower(ownerKey) || candidate === lower(ownerLabel));
}

function buildExploreTasks(card: any, opportunities: any[], packetQueue: any[]): string[] {
  const tasks: string[] = [];

  if (String(card.opportunityQuality?.qualityBand || '') === 'red') {
    tasks.push('Do not create more upstream inventory until weak supply is either converted, rewritten, or explicitly killed.');
  }
  if ((card.opportunityQuality?.blueprintCoverage || 0) < 0.35 && Number(card.opportunityQuality?.total || 0) > 0) {
    tasks.push('Increase blueprint-backed coverage on owned opportunities so supply becomes actionable rather than speculative.');
  }

  for (const opportunity of opportunities.slice(0, 2)) {
    if (opportunity.queueStatus === 'stalled' || opportunity.ageDays >= 7) {
      tasks.push(`Advance stale owned opportunity "${opportunity.angle}" and either blueprint it or explicitly kill it.`);
      continue;
    }
    if (opportunity.queueStatus === 'new' || opportunity.queueStatus === 'assigned') {
      tasks.push(`Move owned opportunity "${opportunity.angle}" from ${prettyLabel(opportunity.queueStatus)} into blueprinting.`);
      continue;
    }
    if (opportunity.queueStatus === 'blueprinting' || opportunity.queueStatus === 'launch_ready') {
      tasks.push(`Close the loop on "${opportunity.angle}" by getting it from ${prettyLabel(opportunity.queueStatus)} to launched.`);
    }
  }

  if (!tasks.length && packetQueue[0]) {
    tasks.push(`Review high-signal packet "${packetQueue[0].packetName || packetQueue[0].primaryKeyword}" and decide whether it graduates into exploitation or is discarded.`);
  }

  if (!tasks.length && Number(card.opportunityMix?.totalOwned || 0) === 0) {
    tasks.push('Create net-new owned opportunity supply; the current buyer-owned opportunity queue is empty.');
  }

  return uniqueStrings(tasks).slice(0, 2);
}

function buildExploitTasks(card: any, executionItem: any): string[] {
  const tasks: string[] = [];
  const recentLaunches = Number(card.activity?.recentLaunches || 0);
  const laneBias = String(card.exploreExploit?.laneBias || '');
  const policyAction = String(executionItem?.policyAction || 'observe_only');

  if (policyAction === 'allow_scale' || policyAction === 'allow_measured_growth') {
    tasks.push('Press the cleanest working lanes under current spend guardrails instead of diffusing effort across noisy tests.');
  }

  if (laneBias === 'exploit_heavy' && recentLaunches > 0) {
    tasks.push('Exploit proven patterns deliberately, but only on surfaces that are still qualified for incremental budget.');
  }

  if (!tasks.length && recentLaunches === 0) {
    tasks.push('Relaunch or extend already-qualified patterns only after today’s blockers are materially cleared.');
  }

  return uniqueStrings(tasks).slice(0, 2);
}

function buildFollowThroughTasks(card: any, executionItem: any): string[] {
  const tasks: string[] = [];

  if (Number(card.execution?.overdueActions || 0) > 0) {
    tasks.push(`Clear ${Number(card.execution?.overdueActions || 0)} overdue action items before opening more loops.`);
  }
  if (Number(card.execution?.needsOwner || 0) > 0) {
    tasks.push(`Assign owners to ${Number(card.execution?.needsOwner || 0)} ownerless tasks so work stops leaking between meetings and launches.`);
  }
  if (String(card.throughput?.throughputBand || '') === 'red') {
    tasks.push('Raise follow-through discipline: close open loops, convert approved work, and stop letting launches stall in the middle.');
  }
  if (!tasks.length && executionItem?.nextStep) {
    tasks.push(String(executionItem.nextStep));
  }

  return uniqueStrings(tasks).slice(0, 2);
}

function inferRelevantSurfaceCommands(card: any, surfaceCommands: any[]): any[] {
  const accountLabels = (card.surfaceExposure?.linkedAccountLabels || []).map((label: string) => lower(label));
  const inferredPlatforms = (card.surfaceExposure?.inferredPlatforms || []).map((value: string) => lower(value));

  const matched = surfaceCommands.filter((command: any) => {
    const surfaceLabel = lower(command.surfaceLabel);
    if (accountLabels.some((label: string) => surfaceLabel.includes(label))) {
      return true;
    }
    if (inferredPlatforms.includes('meta') && (surfaceLabel.includes('business manager') || surfaceLabel.includes('meta redirect'))) {
      return true;
    }
    return false;
  });

  return matched.sort((a: any, b: any) => priorityRank(String(a.priority)) - priorityRank(String(b.priority))).slice(0, 2);
}

function inferTopFocus(card: any, executionItem: any, opportunities: any[], surfaceCommands: any[]): { focus: string; whyNow: string; priority: string } {
  if (executionItem?.priority === 'critical') {
    return {
      focus: 'Protect the buyer lane before adding more budget',
      whyNow: String(executionItem.nextStep || 'Critical allocation blockers are active on this lane.'),
      priority: 'critical',
    };
  }

  if (surfaceCommands[0] && priorityRank(String(surfaceCommands[0].priority)) <= 1) {
    return {
      focus: 'Preserve constrained surfaces before asking for more output',
      whyNow: String(surfaceCommands[0].nextStep || 'Surface pressure is distorting safe execution.'),
      priority: String(surfaceCommands[0].priority || 'high'),
    };
  }

  if (String(card.opportunityQuality?.qualityBand || '') === 'red') {
    return {
      focus: 'Repair upstream supply quality before scaling exploration volume',
      whyNow: `Current supply quality is red with launch rate ${Math.round((Number(card.opportunityQuality?.launchRate || 0)) * 100)}% and stale pending ${Math.round((Number(card.opportunityQuality?.stalePendingRate || 0)) * 100)}%, so more raw opportunity creation would compound noise rather than edge.`,
      priority: 'high',
    };
  }

  if ((opportunities[0] && opportunities[0].ageDays >= 7) || Number(card.opportunityMix?.stalePending || 0) > 0) {
    return {
      focus: 'Convert stale opportunity inventory into launched work or explicit kills',
      whyNow: `Owned opportunity supply is aging (${Number(card.opportunityMix?.stalePending || 0)} stale pending), which means the bottleneck is conversion rather than raw discovery.`,
      priority: 'high',
    };
  }

  if (String(card.throughput?.throughputBand || '') === 'red') {
    return {
      focus: 'Close follow-through debt',
      whyNow: 'The buyer still has work in motion, but closure and conversion rates are too weak to trust more allocation.',
      priority: 'high',
    };
  }

  if (executionItem?.policyAction === 'allow_scale' || executionItem?.policyAction === 'allow_measured_growth') {
    return {
      focus: 'Exploit clean winning lanes under guardrails',
      whyNow: String(executionItem.spendGuardrail || executionItem.recommendedAction || 'This lane is currently eligible for disciplined growth.'),
      priority: String(executionItem.priority || 'medium'),
    };
  }

  return {
    focus: 'Advance the next owned work item with the highest leverage',
    whyNow: 'This lane is not in emergency mode, so the job today is disciplined progress rather than reactive firefighting.',
    priority: String(executionItem?.priority || 'medium'),
  };
}

function buildCommandOrdering(card: any, executionItem: any, surfaceCommands: any[]): { commandScore: number; orderingReasons: string[] } {
  let commandScore = 0;
  const orderingReasons: string[] = [];
  const priority = String(executionItem?.priority || '');
  const qualityBand = String(card.opportunityQuality?.qualityBand || '');
  const throughputBand = String(card.throughput?.throughputBand || '');
  const activeConstraintCount = Number(card.surfaceExposure?.activeConstraintCount || 0);
  const overdueActions = Number(card.execution?.overdueActions || 0);
  const stalePending = Number(card.opportunityMix?.stalePending || 0);
  const policyAction = String(executionItem?.policyAction || '');

  if (priority === 'critical') {
    commandScore += 120;
    orderingReasons.push('Critical allocation posture is active on this buyer lane.');
  } else if (priority === 'high') {
    commandScore += 90;
    orderingReasons.push('High-priority allocation pressure is active on this buyer lane.');
  } else if (priority === 'medium') {
    commandScore += 60;
  } else {
    commandScore += 35;
  }

  if (policyAction === 'block_incremental_spend') {
    commandScore += 20;
    orderingReasons.push('Incremental spend is blocked, so this lane needs intervention before expansion.');
  } else if (policyAction === 'hold_current_allocation') {
    commandScore += 12;
  } else if (policyAction === 'allow_measured_growth') {
    commandScore += 8;
    orderingReasons.push('This lane is close to growth-ready if the remaining blockers are cleared cleanly.');
  } else if (policyAction === 'allow_scale') {
    commandScore += 6;
    orderingReasons.push('This lane is scale-eligible, so the operator can decide whether to press it now.');
  }

  if (qualityBand === 'red') {
    commandScore += 25;
    orderingReasons.push(
      `Upstream supply quality is red with launch rate ${formatPercentLabel(card.opportunityQuality?.launchRate)} and blueprint coverage ${formatPercentLabel(card.opportunityQuality?.blueprintCoverage)}.`
    );
  } else if (qualityBand === 'yellow') {
    commandScore += 12;
  }

  if (throughputBand === 'red') {
    commandScore += 15;
    orderingReasons.push('Follow-through is weak enough that work is at risk of stalling mid-stream.');
  }

  if (activeConstraintCount > 0) {
    commandScore += Math.min(activeConstraintCount * 5, 20);
    if (priorityRank(String(card.surfaceExposure?.riskBand || 'low')) <= 1) {
      orderingReasons.push('Constrained execution surfaces are materially affecting buyer output.');
    }
  }

  if (overdueActions > 0) {
    commandScore += Math.min(overdueActions * 3, 15);
    orderingReasons.push(`${overdueActions} overdue actions are still open on this lane.`);
  }

  if (stalePending > 0) {
    commandScore += Math.min(stalePending * 2, 12);
    orderingReasons.push(`${stalePending} owned opportunities are stale pending instead of converting.`);
  }

  if (surfaceCommands.some((command: any) => priorityRank(String(command.priority || 'low')) <= 1)) {
    commandScore += 10;
  }

  return {
    commandScore,
    orderingReasons: uniqueStrings(orderingReasons).slice(0, 4),
  };
}

export async function getBuyerDailyCommandPacketReport(options: BuyerDailyCommandPacketOptions = {}): Promise<any> {
  const lookbackDays = options.lookbackDays || 7;
  const limitBuyers = options.limitBuyers || 8;
  const service = new MeetingIntelligenceService();

  const [scorecards, executionEngine, opportunityReport, intentPacketReport, surfaceLayer] = await Promise.all([
    service.listBuyerExecutionScorecards({ lookbackDays, limit: limitBuyers }),
    getAllocationExecutionEngineReport({ lookbackDays, limitBuyers }),
    getOpportunityOwnershipReport({ limit: Math.max(limitBuyers * 6, 24) }),
    getIntentPacketOwnershipReport({ lookbackDays: 14, limit: Math.max(limitBuyers * 6, 24) }),
    getSurfacePreservationCommandLayerReport(),
  ]);

  const executionByOwner = new Map<string, any>(
    (executionEngine.queue || []).map((item: any) => [lower(item.ownerKey), item])
  );

  const packets = (scorecards || []).map((card: any) => {
    const executionItem = executionByOwner.get(lower(card.ownerKey)) || null;
    const ownedOpportunities = (opportunityReport.queue || []).filter((item: any) =>
      ownerMatches(item.ownerName, card.ownerKey, card.ownerLabel)
    );
    const ownedPacketQueue = (intentPacketReport.queue || []).filter((item: any) =>
      ownerMatches(item.ownerName, card.ownerKey, card.ownerLabel)
    );
    const relevantSurfaceCommands = inferRelevantSurfaceCommands(card, surfaceLayer.commands || []);
    const focus = inferTopFocus(card, executionItem, ownedOpportunities, relevantSurfaceCommands);
    const ordering = buildCommandOrdering(card, executionItem, relevantSurfaceCommands);
    const blockers = uniqueStrings([
      ...(executionItem?.blockers || []),
      ...(String(card.opportunityQuality?.qualityBand || '') === 'red'
        ? (card.opportunityQuality?.reasons || [])
        : []),
      ...(card.surfaceExposure?.riskBand === 'critical' || card.surfaceExposure?.riskBand === 'high'
        ? (card.surfaceExposure?.reasons || [])
        : []),
      ...(String(card.throughput?.throughputBand || '') === 'red' ? (card.throughput?.reasons || []) : []),
    ]).slice(0, 4);
    const todayAsks = uniqueStrings([
      ...buildExploreTasks(card, ownedOpportunities, ownedPacketQueue),
      ...buildExploitTasks(card, executionItem),
      ...buildFollowThroughTasks(card, executionItem),
      ...relevantSurfaceCommands.map((command: any) => command.nextStep),
    ]).slice(0, 5);

    const draftPreview = [
      `${card.ownerLabel}: ${focus.focus}.`,
      todayAsks[0] ? `Today start with ${todayAsks[0].replace(/\.$/, '')}.` : null,
      blockers[0] ? `Do not ignore ${blockers[0].replace(/\.$/, '')}.` : null,
    ].filter(Boolean).join(' ');
    const delegationBoundary = evaluateDelegationBoundary({
      priority: focus.priority,
      capitalPriority: executionItem?.priority || null,
      triggerState: executionItem?.triggerState || 'watch',
      policyAction: executionItem?.policyAction || 'observe_only',
      blockers,
      blockerToClear: executionItem?.blockers?.[0] || null,
      supplyQualityBand: String(card.opportunityQuality?.qualityBand || 'unknown'),
      supplyLaunchRate: card.opportunityQuality?.launchRate ?? null,
      supplyBlueprintCoverage: card.opportunityQuality?.blueprintCoverage ?? null,
      activeConstraintCount: Number(card.surfaceExposure?.activeConstraintCount || 0),
      firstAction: todayAsks[0] || null,
      todayAskCount: todayAsks.length,
      operatorState: null,
      previewOnly: true,
    });

    return {
      packetKey: `${card.ownerKey}:daily-command`,
      ownerKey: card.ownerKey,
      ownerLabel: card.ownerLabel,
      priority: focus.priority,
      posture: executionItem?.posture || card.band || 'observe',
      policyAction: executionItem?.policyAction || 'observe_only',
      triggerState: executionItem?.triggerState || 'watch',
      commandScore: ordering.commandScore,
      previewOnly: true,
      outboundMessagingEnabled: false,
      topFocus: focus.focus,
      whyNow: focus.whyNow,
      orderingReasons: ordering.orderingReasons,
      firstAction: todayAsks[0] || null,
      draftPreview,
      delegationBoundary,
      metrics: {
        netMargin: Number(card.performance?.netMargin || 0),
        executionScore: Number(card.execution?.executionScore || 0),
        recentLaunches: Number(card.activity?.recentLaunches || 0),
        stalePendingOpportunities: Number(card.opportunityMix?.stalePending || 0),
        activeConstraintCount: Number(card.surfaceExposure?.activeConstraintCount || 0),
        supplyQualityBand: String(card.opportunityQuality?.qualityBand || 'unknown'),
        supplyLaunchRate: Number(card.opportunityQuality?.launchRate || 0),
        supplyBlueprintCoverage: Number(card.opportunityQuality?.blueprintCoverage || 0),
      },
      todayAsks,
      blockers,
      exploreTasks: buildExploreTasks(card, ownedOpportunities, ownedPacketQueue),
      exploitTasks: buildExploitTasks(card, executionItem),
      followThroughTasks: buildFollowThroughTasks(card, executionItem),
      surfaceCommands: relevantSurfaceCommands.map((command: any) => ({
        commandKey: command.commandKey,
        priority: command.priority,
        surfaceLabel: command.surfaceLabel,
        nextStep: command.nextStep,
        objective: command.objective,
      })),
      upstream: {
        quality: {
          qualityBand: String(card.opportunityQuality?.qualityBand || 'unknown'),
          launchRate: card.opportunityQuality?.launchRate ?? null,
          stalePendingRate: card.opportunityQuality?.stalePendingRate ?? null,
          blueprintCoverage: card.opportunityQuality?.blueprintCoverage ?? null,
          reasons: card.opportunityQuality?.reasons || [],
        },
        opportunities: ownedOpportunities.slice(0, 3).map((item: any) => ({
          opportunityId: item.opportunityId,
          angle: item.angle,
          queueStatus: item.queueStatus,
          priority: item.priority,
          ageDays: item.ageDays,
          predictedDeltaCm: item.predictedDeltaCm,
        })),
        intentPackets: ownedPacketQueue.slice(0, 3).map((item: any) => ({
          queueKey: item.queueKey,
          packetName: item.packetName || item.primaryKeyword,
          queueStatus: item.queueStatus,
          priority: item.priority,
          netMargin: item.netMargin,
        })),
      },
    };
  }).sort((a: any, b: any) => {
    return (
      b.commandScore - a.commandScore ||
      priorityRank(String(a.priority)) - priorityRank(String(b.priority)) ||
      lower(a.ownerLabel).localeCompare(lower(b.ownerLabel))
    );
  }).map((packet: any, index: number) => ({
    ...packet,
    sequenceIndex: index + 1,
  }));

  const summary = {
    totalBuyers: packets.length,
    critical: packets.filter((packet: any) => packet.priority === 'critical').length,
    high: packets.filter((packet: any) => packet.priority === 'high').length,
    previewOnly: true,
    outboundMessagingEnabled: false,
    readyToDelegate: packets.filter((packet: any) => packet.delegationBoundary?.status === 'ready').length,
    overrideOnly: packets.filter((packet: any) => packet.delegationBoundary?.status === 'needs_operator_work').length,
    hardBlockedForDelegation: packets.filter((packet: any) => packet.delegationBoundary?.status === 'blocked').length,
    buyersNeedingExplore: packets.filter((packet: any) => packet.exploreTasks.length > 0).length,
    buyersNeedingFollowThrough: packets.filter((packet: any) => packet.followThroughTasks.length > 0).length,
    buyersWithSurfaceWork: packets.filter((packet: any) => packet.surfaceCommands.length > 0).length,
    buyersWithWeakSupplyQuality: packets.filter((packet: any) => packet.metrics.supplyQualityBand === 'red').length,
    actFirstCount: packets.filter((packet: any) => packet.commandScore >= 100).length,
  };

  let operatorRead =
    'These buyer daily command packets are operator-only previews: they condense scorecards, allocation policy, upstream queues, and surface commands into a per-buyer plan without sending anything outbound.';
  if (summary.critical > 0) {
    operatorRead =
      `${summary.critical} buyer packets are in critical mode, so the first use of this surface should be repair and protection, not broader delegation.`;
  } else if (summary.high > 0) {
    operatorRead =
      `${summary.high} buyer packets are high priority, so the operator can now see which lanes need active steering today before deciding what is worth broadcasting outward.`;
  } else if (summary.buyersWithWeakSupplyQuality > 0) {
    operatorRead =
      `${summary.buyersWithWeakSupplyQuality} buyer packets are now explicitly marked with weak upstream supply quality, so the operator can intervene on quality before pushing for more exploration volume.`;
  } else if (packets[0]) {
    operatorRead =
      `The command packets are now rank-ordered, so the operator can start with ${packets[0].ownerLabel} instead of scanning the whole surface to decide where to intervene first.`;
  }

  return {
    window: {
      lookbackDays,
      through: new Date().toISOString(),
    },
    mode: {
      phase: 'preview_only',
      outboundMessagingEnabled: false,
      sendTargetsEnabled: false,
    },
    summary,
    packets,
    operatorRead,
  };
}
