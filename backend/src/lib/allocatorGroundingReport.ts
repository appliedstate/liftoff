import { getExecutionGapReport } from './executionGapTracker';
import { getMeetingEntityLinkReport } from './meetingEntityLinks';
import { getPlatformCapacityReport } from './platformCapacityReport';
import { MeetingIntelligenceService } from '../services/meetingIntelligence';
import { getOpportunityIntentWorkstreamScoreboard } from './workstreamScoreboards';

type AllocatorGroundingOptions = {
  lookbackDays?: number;
  limitBuyers?: number;
};

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
}

function prettyLabel(value: string | null | undefined): string {
  return normalize(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function toNumber(value: any): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function postureRank(value: string): number {
  switch (value) {
    case 'protect':
      return 0;
    case 'hold':
      return 1;
    case 'cautious_grow':
      return 2;
    case 'scale':
      return 3;
    default:
      return 4;
  }
}

function safeError(error: any): string {
  return error instanceof Error ? error.message : String(error);
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => normalize(value)).filter(Boolean)));
}

async function settle<T>(promise: Promise<T>, fallback: T): Promise<{ value: T; error: string | null }> {
  try {
    return {
      value: await promise,
      error: null,
    };
  } catch (error) {
    return {
      value: fallback,
      error: safeError(error),
    };
  }
}

export async function getAllocatorGroundingReport(options: AllocatorGroundingOptions = {}): Promise<any> {
  const lookbackDays = options.lookbackDays || 7;
  const limitBuyers = options.limitBuyers || 8;
  const service = new MeetingIntelligenceService();

  const [
    scorecardsResult,
    alertsResult,
    platformResult,
    workstreamResult,
    gapResult,
    entityResult,
  ] = await Promise.all([
    settle(service.listBuyerExecutionScorecards({ lookbackDays, limit: limitBuyers }), [] as any[]),
    settle(service.listOwnerExecutionAlerts(limitBuyers), [] as any[]),
    settle(getPlatformCapacityReport(), {
      summary: {
        platformAccountCount: 0,
        operatingContractCount: 0,
        activeConstraintCount: 0,
        criticalConstraintCount: 0,
        highSeverityConstraintCount: 0,
        mostConstrainedAccount: null,
      },
      platformAccounts: [],
      operatingContracts: [],
      activeConstraints: [],
      operatorRead: 'Platform capacity report unavailable.',
    }),
    settle(getOpportunityIntentWorkstreamScoreboard({ lookbackDays: 14, limit: 5 }), {
      window: { lookbackDays: 14, startDate: '', through: '' },
      opportunity: {
        schemaAvailable: false,
        lookbackDays: 14,
        summary: {
          total: 0,
          pending: 0,
          approved: 0,
          launched: 0,
          rejected: 0,
          highConfidencePending: 0,
          stalePending: 0,
          pendingPredictedDeltaCm: 0,
          blueprintDraft: 0,
          blueprintApproved: 0,
          blueprintLaunched: 0,
        },
        sources: [],
        categories: [],
        topPending: [],
        gaps: [],
        operatorRead: 'Opportunity scoreboard unavailable.',
      },
      intentPacket: {
        schemaAvailable: false,
        lookbackDays: 14,
        summary: {
          observationCount: 0,
          uniquePackets: 0,
          uniqueKeywords: 0,
          approvedCount: 0,
          rejectedCount: 0,
          reviewFlagCount: 0,
          revenue: 0,
          spend: 0,
          netMargin: 0,
          approvalRate: null,
          reviewFlagRate: null,
        },
        sources: [],
        topKeywords: [],
        topNamespaces: [],
        gaps: [],
        operatorRead: 'Intent-packet scoreboard unavailable.',
      },
      operatorRead: 'Exploration scoreboard unavailable.',
    }),
    settle(getExecutionGapReport({ lookbackDays: 30, limitThemes: 8, limitMeetings: 8, limitActions: 10 }), {
      window: { lookbackDays: 30, since: '', through: '' },
      summary: {
        trackedGapThemes: 0,
        repeatedConcernThemes: 0,
        ownerlessConcernThemes: 0,
        ownerlessActionItems: 0,
        unresolvedOpenQuestions: 0,
        meetingsWithGaps: 0,
      },
      recurringThemes: [],
      ownerlessActionItems: [],
      meetingGaps: [],
      operatorRead: 'Execution gap report unavailable.',
    }),
    settle(getMeetingEntityLinkReport({ lookbackDays: 30, limitMeetings: 12 }), {
      window: { lookbackDays: 30, since: '', through: '' },
      summary: {
        meetingCount: 0,
        linkedMeetingCount: 0,
        unlinkedMeetingCount: 0,
        distinctBuyers: 0,
        distinctWorkstreams: 0,
        distinctAccounts: 0,
        distinctContracts: 0,
        weakCoverageMeetings: 0,
      },
      meetings: [],
      topBuyers: [],
      topWorkstreams: [],
      topAccounts: [],
      topContracts: [],
      operatorRead: 'Meeting entity links unavailable.',
    }),
  ]);

  const scorecards = scorecardsResult.value;
  const alertsByOwner = new Map<string, any>();
  for (const alert of alertsResult.value) {
    alertsByOwner.set(normalize(alert.ownerKey).toLowerCase(), alert);
  }

  const platformConstraints = platformResult.value.activeConstraints || [];
  const buyerAllocations = scorecards.map((card: any) => {
    const ownerKey = normalize(card.ownerKey).toLowerCase();
    const alert = alertsByOwner.get(ownerKey) || null;
    const linkedMeetings = (entityResult.value.meetings || []).filter((meeting: any) =>
      (meeting.buyerLinks || []).some((buyer: any) => normalize(buyer.buyerName).toLowerCase() === ownerKey)
    );
    const linkedAccountKeys = Array.from(new Set(
      linkedMeetings.flatMap((meeting: any) => (meeting.accountLinks || []).map((account: any) => String(account.accountKey)))
    ));
    const linkedContractKeys = Array.from(new Set(
      linkedMeetings.flatMap((meeting: any) => (meeting.contractLinks || []).map((contract: any) => String(contract.contractKey)))
    ));
    const linkedConstraints = platformConstraints.filter((constraint: any) => {
      return (
        (constraint.affectedEntityType === 'platform_account' && linkedAccountKeys.includes(String(constraint.affectedEntityKey))) ||
        (constraint.affectedEntityType === 'contract' && linkedContractKeys.includes(String(constraint.affectedEntityKey)))
      );
    });

    const reasons: string[] = [];
    let posture: 'protect' | 'hold' | 'cautious_grow' | 'scale' | 'observe' = 'observe';
    const blockers: string[] = [];
    const promoteWhen: string[] = [];

    if (card.performance.netMargin < 0 && card.performance.spend > 0) {
      posture = 'protect';
      reasons.push('negative recent net margin');
      blockers.push('restore positive net margin before adding spend');
    }
    if (card.execution.overdueActions > 0 || card.execution.needsOwner > 0) {
      posture = 'protect';
      reasons.push('open execution failures are still unresolved');
      blockers.push('clear overdue or ownerless action debt first');
    }
    if (linkedConstraints.some((constraint: any) => String(constraint.severity) === 'critical')) {
      posture = posture === 'protect' ? 'protect' : 'hold';
      reasons.push('linked account or contract surface is under critical constraint');
      blockers.push('linked critical platform or contract constraint is still active');
    }
    if (card.surfaceExposure?.riskBand === 'critical') {
      posture = posture === 'protect' ? 'protect' : 'hold';
      reasons.push('buyer is operating on a critically constrained surface');
      blockers.push('surface risk must fall below critical before growth is allowed');
    }
    if (card.surfaceExposure?.riskBand === 'high' && posture !== 'protect') {
      posture = 'hold';
      reasons.push('buyer is operating on a high-risk constrained surface');
      blockers.push('high surface-risk exposure is still distorting safe scale');
    }
    if (posture === 'observe' && (card.band === 'red' || card.health?.executionBand === 'red')) {
      posture = 'hold';
      reasons.push('buyer scorecard is in a red or degraded state');
      blockers.push('scorecard band must recover before incremental allocation');
    }
    if (card.throughput?.throughputBand === 'red' && posture !== 'protect') {
      posture = 'hold';
      reasons.push('recent throughput and follow-through are weak');
      blockers.push('recent work is not converting into enough visible closure');
    }
    if ((card.opportunityMix?.stalePending || 0) > 0 && posture !== 'protect') {
      posture = posture === 'observe' ? 'hold' : posture;
      reasons.push('owned opportunity backlog is aging without enough follow-through');
      blockers.push('stale pending opportunities should be reviewed before more allocation');
    }
    if (card.opportunityQuality?.qualityBand === 'red' && posture !== 'protect') {
      posture = posture === 'observe' ? 'hold' : posture;
      reasons.push('upstream opportunity supply quality is weak');
      blockers.push('improve opportunity conversion quality before treating supply volume as growth-ready');
    }
    if ((card.opportunityQuality?.stalePendingRate || 0) >= 0.5 && posture !== 'protect') {
      posture = posture === 'observe' ? 'hold' : posture;
      reasons.push('too much owned supply is stalling before closure');
      blockers.push('reduce stale pending supply and raise closed-loop conversion first');
    }
    if (
      posture === 'observe' &&
      card.band === 'green' &&
      card.performance.netMargin > 0 &&
      card.execution.executionScore >= 85 &&
      card.throughput?.throughputBand === 'green' &&
      card.opportunityQuality?.qualityBand === 'green' &&
      !['critical', 'high'].includes(String(card.surfaceExposure?.riskBand || 'low'))
    ) {
      posture = 'scale';
      reasons.push('economics and execution are both currently strong');
      promoteWhen.push('keep economics positive and execution score above 85');
      promoteWhen.push('maintain green opportunity-supply quality while scaling');
      promoteWhen.push('maintain green throughput and avoid new high-risk surface constraints');
    }
    if (
      posture === 'observe' &&
      card.performance.netMargin > 0 &&
      card.health?.executionBand !== 'red'
    ) {
      posture = 'cautious_grow';
      reasons.push('economics are positive, but the system still sees non-zero operating friction');
      promoteWhen.push('close action debt and keep throughput out of the red');
      promoteWhen.push('convert more owned opportunities into approvals or launches');
    }
    if (!reasons.length) {
      reasons.push('insufficient grounded signal to recommend an aggressive allocation change');
      blockers.push('not enough clean evidence exists to move the allocation posture confidently');
    }

    if (!promoteWhen.length && posture === 'hold') {
      promoteWhen.push('clear the named blockers, then re-evaluate for cautious growth');
    }
    if (!promoteWhen.length && posture === 'protect') {
      promoteWhen.push('repair economics, execution debt, and surface safety before reopening growth');
    }
    if (!promoteWhen.length && posture === 'observe') {
      promoteWhen.push('gather more performance, throughput, and attribution signal before changing capital posture');
    }

    const recommendedAction =
      posture === 'protect'
        ? `Protect ${card.ownerLabel} from incremental allocation until the economic or execution break is corrected.`
        : posture === 'hold'
          ? `Hold allocation for ${card.ownerLabel} while linked platform or execution constraints are cleared.`
          : posture === 'cautious_grow'
            ? `Allow only measured incremental allocation for ${card.ownerLabel}, with attention on linked constraints and queue pressure.`
            : posture === 'scale'
              ? `This buyer is the cleanest current candidate for additional allocation, provided the linked surfaces remain stable.`
              : `Keep ${card.ownerLabel} observable, but do not force a posture change from weak evidence alone.`;

    const policyAction =
      posture === 'protect'
        ? 'block_incremental_spend'
        : posture === 'hold'
          ? 'hold_current_allocation'
          : posture === 'cautious_grow'
            ? 'allow_measured_growth'
            : posture === 'scale'
              ? 'allow_scale'
              : 'observe_only';
    const triggerState =
      posture === 'protect' || posture === 'hold'
        ? 'blocked'
        : posture === 'cautious_grow' || posture === 'scale'
          ? 'fired'
          : 'watch';
    const spendGuardrail =
      posture === 'protect'
        ? 'Do not add spend; prioritize repair work only.'
        : posture === 'hold'
          ? 'Maintain current allocation only if already running; no new incremental scale.'
          : posture === 'cautious_grow'
            ? 'Allow only measured test increments while blockers remain absent.'
            : posture === 'scale'
              ? 'Eligible for the cleanest available incremental budget, subject to surface stability.'
              : 'No posture change from weak evidence alone.';

    return {
      ownerKey: card.ownerKey,
      ownerLabel: card.ownerLabel,
      posture,
      band: card.band,
      performance: card.performance,
      execution: card.execution,
      linkedMeetingCount: linkedMeetings.length,
      linkedAccountKeys,
      linkedContractKeys,
      linkedConstraintCount: linkedConstraints.length,
      linkedConstraintSummaries: linkedConstraints.slice(0, 3).map((constraint: any) => constraint.summary),
      alertSeverity: alert?.severity || null,
      reasons,
      recommendedAction,
      triggerPolicy: {
        version: 'allocation_trigger_policy_v1',
        policyAction,
        triggerState,
        blockers: dedupeStrings(blockers),
        promoteWhen: dedupeStrings(promoteWhen),
        spendGuardrail,
      },
    };
  }).sort((a: any, b: any) => {
    return postureRank(a.posture) - postureRank(b.posture) || a.performance.netMargin - b.performance.netMargin;
  });

  const postureCounts = {
    protect: buyerAllocations.filter((item: any) => item.posture === 'protect').length,
    hold: buyerAllocations.filter((item: any) => item.posture === 'hold').length,
    cautiousGrow: buyerAllocations.filter((item: any) => item.posture === 'cautious_grow').length,
    scale: buyerAllocations.filter((item: any) => item.posture === 'scale').length,
    observe: buyerAllocations.filter((item: any) => item.posture === 'observe').length,
  };
  const policyActionCounts = {
    blockIncrementalSpend: buyerAllocations.filter((item: any) => item.triggerPolicy?.policyAction === 'block_incremental_spend').length,
    holdCurrentAllocation: buyerAllocations.filter((item: any) => item.triggerPolicy?.policyAction === 'hold_current_allocation').length,
    allowMeasuredGrowth: buyerAllocations.filter((item: any) => item.triggerPolicy?.policyAction === 'allow_measured_growth').length,
    allowScale: buyerAllocations.filter((item: any) => item.triggerPolicy?.policyAction === 'allow_scale').length,
    observeOnly: buyerAllocations.filter((item: any) => item.triggerPolicy?.policyAction === 'observe_only').length,
  };

  let systemMode: 'protect_surfaces' | 'selective_growth' | 'measured_growth' = 'measured_growth';
  let dominantConstraint = 'buyer-level economics and execution';
  if (toNumber(platformResult.value.summary.criticalConstraintCount) > 0) {
    systemMode = 'protect_surfaces';
    dominantConstraint = `${platformResult.value.summary.mostConstrainedAccount || 'platform account risk'} is still the binding constraint`;
  } else if (
    toNumber(gapResult.value.summary.ownerlessActionItems) > 0 ||
    toNumber(workstreamResult.value.opportunity.summary.stalePending) > 0
  ) {
    systemMode = 'selective_growth';
    dominantConstraint = 'follow-through leakage is still degrading safe scaling quality';
  }

  let operatorRead =
    'The allocator is now grounded in buyer economics, execution pressure, platform constraints, and meeting-linked operating context rather than scorecards alone.';
  if (systemMode === 'protect_surfaces') {
    operatorRead =
      'The allocator should currently optimize for preserving usable account surfaces and avoiding avoidable policy damage, even before it optimizes for raw buyer appetite.';
  } else if (systemMode === 'selective_growth') {
    operatorRead =
      'The allocator can still deploy, but it should do so selectively because execution follow-through and upstream conversion quality are still constraining trustworthy scale.';
  }

  return {
    window: {
      lookbackDays,
      through: new Date().toISOString().slice(0, 10),
    },
    summary: {
      buyerCount: buyerAllocations.length,
      postureCounts,
      policyActionCounts,
      systemMode,
      dominantConstraint,
      criticalPlatformConstraints: toNumber(platformResult.value.summary.criticalConstraintCount),
      ownerlessActionItems: toNumber(gapResult.value.summary.ownerlessActionItems),
      staleOpportunities: toNumber(workstreamResult.value.opportunity.summary.stalePending),
    },
    buyerAllocations,
    groundingSignals: {
      scorecardsAvailable: !scorecardsResult.error,
      alertsAvailable: !alertsResult.error,
      platformAvailable: !platformResult.error,
      workstreamsAvailable: !workstreamResult.error,
      gapsAvailable: !gapResult.error,
      entityLinksAvailable: !entityResult.error,
      errors: dedupeStrings([
        scorecardsResult.error,
        alertsResult.error,
        platformResult.error,
        workstreamResult.error,
        gapResult.error,
        entityResult.error,
      ]),
    },
    operatorRead,
  };
}
