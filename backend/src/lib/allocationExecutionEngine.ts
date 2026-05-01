import { getAllocatorGroundingReport } from './allocatorGroundingReport';

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
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

export async function getAllocationExecutionEngineReport(options: { lookbackDays?: number; limitBuyers?: number } = {}): Promise<any> {
  const grounding = await getAllocatorGroundingReport({
    lookbackDays: options.lookbackDays || 7,
    limitBuyers: options.limitBuyers || 8,
  });

  const queue = (grounding.buyerAllocations || []).map((buyer: any) => {
    const policyAction = String(buyer.triggerPolicy?.policyAction || 'observe_only');
    const triggerState = String(buyer.triggerPolicy?.triggerState || 'watch');
    const blockers = Array.isArray(buyer.triggerPolicy?.blockers) ? buyer.triggerPolicy.blockers : [];
    const promoteWhen = Array.isArray(buyer.triggerPolicy?.promoteWhen) ? buyer.triggerPolicy.promoteWhen : [];

    let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';
    let nextStep = 'Monitor this buyer and wait for stronger operating signal.';

    if (policyAction === 'block_incremental_spend') {
      priority = 'critical';
      nextStep = blockers[0]
        ? `Do not add spend; clear blocker: ${blockers[0]}.`
        : `Do not add spend; repair the economic, execution, or surface break before reallocation.`;
    } else if (policyAction === 'hold_current_allocation') {
      priority = 'high';
      nextStep = blockers[0]
        ? `Hold current allocation and resolve: ${blockers[0]}.`
        : `Hold current allocation until the main blocking condition is cleared.`;
    } else if (policyAction === 'allow_measured_growth') {
      priority = 'medium';
      nextStep = promoteWhen[0]
        ? `Allow measured growth while watching for: ${promoteWhen[0]}.`
        : `Allow measured growth only while current blockers remain absent.`;
    } else if (policyAction === 'allow_scale') {
      priority = 'medium';
      nextStep = `Route the cleanest available incremental budget here while preserving surface safety.`;
    }

    return {
      queueKey: `${buyer.ownerKey}:${policyAction}`,
      ownerKey: buyer.ownerKey,
      ownerLabel: buyer.ownerLabel,
      priority,
      policyAction,
      triggerState,
      posture: buyer.posture,
      band: buyer.band,
      recommendedAction: buyer.recommendedAction,
      spendGuardrail: buyer.triggerPolicy?.spendGuardrail || null,
      blockers,
      promoteWhen,
      linkedConstraintCount: Number(buyer.linkedConstraintCount || 0),
      netMargin: Number(buyer.performance?.netMargin || 0),
      executionScore: Number(buyer.execution?.executionScore || 0),
      nextStep,
    };
  }).sort((a: any, b: any) => {
    return (
      priorityRank(a.priority) - priorityRank(b.priority) ||
      String(a.ownerLabel).localeCompare(String(b.ownerLabel))
    );
  });

  const summary = {
    total: queue.length,
    critical: queue.filter((item: any) => item.priority === 'critical').length,
    high: queue.filter((item: any) => item.priority === 'high').length,
    medium: queue.filter((item: any) => item.priority === 'medium').length,
    low: queue.filter((item: any) => item.priority === 'low').length,
    blocked: queue.filter((item: any) => item.triggerState === 'blocked').length,
    fired: queue.filter((item: any) => item.triggerState === 'fired').length,
  };

  let operatorRead =
    'The allocation execution engine converts allocator policy into a concrete control queue so capital posture can become action rather than interpretation.';
  if (summary.critical > 0) {
    operatorRead =
      `${summary.critical} buyer lanes are in critical allocation-control mode, so the immediate job is repair and protection before growth.`;
  } else if (summary.high > 0) {
    operatorRead =
      `${summary.high} buyer lanes are currently held by blockers, so the next leverage is clearing those blockers rather than adding more budget.`;
  } else if (summary.fired > 0) {
    operatorRead =
      `${summary.fired} buyer lanes are eligible for measured growth or scale, so the next job is routing budget into the cleanest qualified lanes without degrading surfaces.`;
  }

  return {
    window: grounding.window,
    summary,
    queue,
    operatorRead,
  };
}
