import { getCommandOutcomeTelemetryReport } from './commandOutcomeTelemetry';
import { getOperatorEscalationReport } from './operatorEscalationEngine';
import { getOperatorCommandQueueReport } from './operatorCommandQueue';
import { getOvernightSprintScorecardReport } from './overnightSprintScorecard';
import { getOperatorStateRollupReport } from './operatorStateRollup';
import { MeetingIntelligenceService } from '../services/meetingIntelligence';

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function buildDayType(input: {
  escalationCount: number;
  criticalCount: number;
  meaningfulMovementCount: number;
  cosmeticTouchCount: number;
  validatedOutcomeRate: number;
}): 'exception_heavy' | 'movement_positive' | 'movement_uncertain' | 'steady_state' {
  if (input.criticalCount > 0 || input.escalationCount >= 3) return 'exception_heavy';
  if (input.meaningfulMovementCount > 0 && input.validatedOutcomeRate >= 0.4) return 'movement_positive';
  if (input.meaningfulMovementCount > 0 || input.cosmeticTouchCount > 0) return 'movement_uncertain';
  return 'steady_state';
}

export async function getMorningOperatorPacketReport(): Promise<any> {
  const service = new MeetingIntelligenceService();
  const [queueReport, sprintReport, outcomeReport, stateRollup, escalationReport, exceptionLoop] = await Promise.all([
    getOperatorCommandQueueReport({ lookbackDays: 7, limitBuyers: 8 }),
    getOvernightSprintScorecardReport(),
    getCommandOutcomeTelemetryReport({ lookbackDays: 7, limit: 8 }),
    getOperatorStateRollupReport({ lookbackHours: 24, limit: 8 }),
    getOperatorEscalationReport({ lookbackDays: 7, limitBuyers: 8, limit: 8 }),
    service.getOwnerAlertNotificationControlLoopSummary({ lookbackHours: 48, limit: 24, operatorEscalationsOnly: true }),
  ]);

  const topCommand = queueReport.queue?.[0] || null;
  const activeSprint = sprintReport.sprints?.[0] || null;
  const validatedOutcomes = (outcomeReport.items || []).filter((item: any) => item.outcomeStatus === 'validated').slice(0, 3);
  const nextMorning = outcomeReport.nextMorning || {
    lookbackHours: 24,
    changedCount: 0,
    meaningfulMovementCount: 0,
    validatedImprovementCount: 0,
    advancedButUnvalidatedCount: 0,
    cosmeticTouchCount: 0,
    worsenedCount: 0,
    deferredCount: 0,
    operatorRead: 'No next-morning movement telemetry is available yet.',
  };
  const nextMorningMovement = (outcomeReport.recentMovement || [])
    .filter((item: any) => item.meaningfulMovement || ['acknowledged', 'validated', 'worsened'].includes(String(item.movementStatus || '')))
    .slice(0, 4);
  const escalations = escalationReport.escalations || [];
  const exceptionLoopSummary = exceptionLoop?.summary || {};
  const exceptionLoopByCommandKey = new Map(
    (exceptionLoop?.items || [])
      .map((item: any) => [String(item.commandKey || '').trim(), item] as const)
      .filter(([commandKey]: readonly [string, any]) => commandKey)
  );

  const summary = {
    topOwner: topCommand?.ownerLabel || null,
    actNowCount: Number(queueReport.summary?.actNow || 0),
    criticalCount: Number(queueReport.summary?.critical || 0),
    blockedCount: Number(queueReport.summary?.blocked || 0),
    escalationCount: Number(escalationReport.summary?.total || 0),
    validatedOutcomeRate: Number(outcomeReport.summary?.validatedRate || 0),
    meaningfulMovementCount: Number(nextMorning.meaningfulMovementCount || 0),
    cosmeticTouchCount: Number(nextMorning.cosmeticTouchCount || 0),
    liveExceptionCount: Number(exceptionLoopSummary.liveExceptions || 0),
    untouchedExceptionCount: Number(exceptionLoopSummary.unresolved || 0),
    touchedLiveExceptionCount: Number(exceptionLoopSummary.touchedLive || 0),
    resolvedExceptionCount: Number(exceptionLoopSummary.resolvedTotal || 0),
    activeSprint: sprintReport.summary?.activeSprint || null,
    activeSprintMetric: sprintReport.summary?.activeNorthStar || null,
  };

  const dayType = buildDayType({
    escalationCount: summary.escalationCount,
    criticalCount: summary.criticalCount,
    meaningfulMovementCount: summary.meaningfulMovementCount,
    cosmeticTouchCount: summary.cosmeticTouchCount,
    validatedOutcomeRate: summary.validatedOutcomeRate,
  });

  const opening = topCommand
    ? `Start with ${topCommand.ownerLabel}: ${topCommand.firstAction || topCommand.topFocus}.`
    : 'No operator commands are ranked yet.';

  const operatorRead = topCommand
    ? `The morning packet is now one control brief: start with ${topCommand.ownerLabel}, clear ${topCommand.blockerToClear || 'the main active blocker'}, and judge the day by whether that action changes the sprint metric.`
    : 'The morning packet has no ranked command yet, so the system still lacks an active control starting point.';

  const morningExceptions = escalations.slice(0, 5).map((item: any) => {
    const controlLoopItem: any = exceptionLoopByCommandKey.get(String(item.commandKey || '').trim()) || null;
    return {
      exceptionKey: `${item.commandKey}:exception`,
      ownerLabel: item.ownerLabel,
      severity: item.severity,
      title: `${item.ownerLabel} ${item.severity} morning exception`,
      message: (item.reasons || []).join(' ') || `${item.ownerLabel} has an active escalation that needs operator attention.`,
      recommendedAction: item.recommendedTouch || item.firstAction || item.blockerToClear || null,
      blockerToClear: item.blockerToClear || null,
      triggerState: item.triggerState || null,
      state: item.state || null,
      hoursStale: item.hoursStale ?? null,
      controlState: controlLoopItem?.controlState || 'unresolved',
      touched: ['acknowledged_but_live', 'dismissed_but_live'].includes(String(controlLoopItem?.controlState || '')),
      alertStatus: controlLoopItem?.status || null,
    };
  });

  const focusFingerprint = uniqueStrings([
    topCommand?.commandKey || null,
    topCommand?.ownerLabel || null,
    ...escalations.slice(0, 3).map((item: any) => item.commandKey || null),
    activeSprint?.sprintLabel || null,
  ]).join('|');

  const controlHeadline =
    dayType === 'exception_heavy'
      ? `Exception-heavy morning: ${summary.untouchedExceptionCount} untouched live exceptions and ${summary.touchedLiveExceptionCount} touched-but-still-live exceptions are active before normal queue work.`
      : dayType === 'movement_positive'
        ? `Movement is compounding: ${summary.meaningfulMovementCount} lanes moved meaningfully and validated outcome rate is ${Math.round(summary.validatedOutcomeRate * 100)}%.`
        : dayType === 'movement_uncertain'
          ? `Movement is present but not fully proven: ${summary.meaningfulMovementCount} meaningful shifts and ${summary.cosmeticTouchCount} cosmetic touches still need morning judgment.`
          : topCommand
            ? `Steady-state morning: begin with ${topCommand.ownerLabel} and use the queue to turn today’s first action into measurable movement.`
            : 'Steady-state morning with no ranked starting lane yet.';

  const delivery = {
    dayType,
    controlHeadline,
    focusFingerprint,
    packetDiscipline: {
      focusOwner: topCommand?.ownerLabel || null,
      activeSprint: activeSprint?.sprintLabel || null,
      activeMetric: activeSprint?.northStar?.label || null,
      exceptionCount: summary.escalationCount,
      liveExceptionCount: summary.liveExceptionCount,
      untouchedExceptionCount: summary.untouchedExceptionCount,
      touchedLiveExceptionCount: summary.touchedLiveExceptionCount,
      resolvedExceptionCount: summary.resolvedExceptionCount,
      meaningfulMovementCount: summary.meaningfulMovementCount,
      validatedOutcomeRate: summary.validatedOutcomeRate,
    },
    digest: {
      actFirst: topCommand
        ? `${topCommand.ownerLabel}: ${topCommand.firstAction || topCommand.topFocus}`
        : 'No ranked act-first lane.',
      exceptions:
        summary.liveExceptionCount > 0
          ? `${summary.untouchedExceptionCount} unresolved / ${summary.touchedLiveExceptionCount} touched-live / ${summary.resolvedExceptionCount} resolved`
          : 'No active morning exceptions.',
      movement:
        `${nextMorning.meaningfulMovementCount || 0} meaningful / ${nextMorning.validatedImprovementCount || 0} validated / ${nextMorning.cosmeticTouchCount || 0} cosmetic`,
      sprint:
        activeSprint
          ? `${activeSprint.sprintLabel} — ${activeSprint.northStar?.label || 'metric'}`
          : 'No active sprint scorecard.',
    },
    checklist: uniqueStrings([
      topCommand?.firstAction || null,
      topCommand?.capitalAction || null,
      topCommand?.blockerToClear || null,
      morningExceptions[0]?.recommendedAction || null,
    ]).slice(0, 4),
    generatedFor: {
      timezone: 'America/Los_Angeles',
      packetDate: new Date().toISOString().slice(0, 10),
      operatorCadence: 'daily_morning_control_loop',
    },
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    delivery,
    opening,
    actFirst: topCommand
      ? {
          ownerLabel: topCommand.ownerLabel,
          firstAction: topCommand.firstAction,
          capitalAction: topCommand.capitalAction,
          blockerToClear: topCommand.blockerToClear,
          promotionCondition: topCommand.promotionCondition,
          orderingReasons: topCommand.orderingReasons || [],
        }
      : null,
    sprint: activeSprint
      ? {
          label: activeSprint.sprintLabel,
          metricLabel: activeSprint.northStar?.label || null,
          metricValue: activeSprint.northStar?.value ?? null,
          trendDirection: activeSprint.trend?.direction || null,
          operatorRead: activeSprint.operatorRead || null,
        }
      : null,
    validatedOutcomes: validatedOutcomes.map((item: any) => ({
      ownerLabel: item.ownerLabel,
      outcomeStatus: item.outcomeStatus,
      positiveSignals: item.positiveSignals || [],
      negativeSignals: item.negativeSignals || [],
    })),
    nextMorningMovement: {
      summary: nextMorning,
      items: nextMorningMovement.map((item: any) => ({
        commandKey: item.commandKey,
        ownerLabel: item.ownerLabel,
        movementState: item.movementState,
        movementStatus: item.movementStatus,
        movementChangedAt: item.movementChangedAt,
        hoursSinceMovement: item.hoursSinceMovement,
        headline: item.headline,
        positiveSignals: item.positiveSignals || [],
        negativeSignals: item.negativeSignals || [],
      })),
    },
    stateRollup,
    exceptionLoop: {
      summary: exceptionLoopSummary,
      operatorRead: exceptionLoop?.operatorRead || null,
    },
    morningExceptions,
    escalations: escalations.map((item: any) => ({
      commandKey: item.commandKey,
      ownerLabel: item.ownerLabel,
      state: item.state,
      severity: item.severity,
      triggerState: item.triggerState,
      hoursStale: item.hoursStale,
      blockerToClear: item.blockerToClear,
      priority: item.priority,
      recommendedTouch: item.recommendedTouch,
      reasons: item.reasons || [],
    })),
    followThroughToday: uniqueStrings([
      topCommand?.firstAction || null,
      topCommand?.capitalAction || null,
      escalations[0]?.blockerToClear || null,
    ]).slice(0, 4),
    escalationRead: escalationReport.operatorRead,
    operatorRead,
  };
}
