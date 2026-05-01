import { getOperatorCommandQueueReport } from './operatorCommandQueue';

function hoursSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  return (Date.now() - ts) / 36e5;
}

function round(value: number | null | undefined, digits: number = 1): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function severityRank(value: string): number {
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

function queueStaleThresholdHours(priority: string): number {
  if (priority === 'critical') return 12;
  if (priority === 'high') return 24;
  return 36;
}

function inProgressThresholdHours(priority: string): number {
  if (priority === 'critical') return 24;
  if (priority === 'high') return 36;
  return 48;
}

export async function getOperatorEscalationReport(options: { lookbackDays?: number; limitBuyers?: number; limit?: number } = {}): Promise<any> {
  const queueReport = await getOperatorCommandQueueReport({
    lookbackDays: options.lookbackDays,
    limitBuyers: options.limitBuyers,
  });

  const escalations = (queueReport.queue || [])
    .map((item: any) => {
      const state = String(item.state || 'queued');
      const priority = String(item.priority || 'medium');
      const triggerState = String(item.triggerState || 'ready');
      const hoursStale = hoursSince(item.stateChangedAt);
      const reasons: string[] = [];
      let severity: 'critical' | 'high' | 'medium' | null = null;

      if (triggerState === 'blocked') {
        reasons.push(`Trigger state is blocked${item.blockerToClear ? `: ${item.blockerToClear}` : ''}.`);
        severity = priority === 'critical' ? 'critical' : 'high';
      }

      if (state === 'queued') {
        if (item.stateChangedAt == null) {
          if (priority === 'critical') {
            reasons.push('Critical lane has not been acknowledged yet.');
            severity = severity || 'high';
          } else if (triggerState === 'blocked') {
            reasons.push('Blocked lane has never been touched by the operator.');
            severity = severity || 'high';
          }
        } else if (hoursStale != null && hoursStale >= queueStaleThresholdHours(priority)) {
          reasons.push(`Queued lane has been untouched for ${round(hoursStale)} hours.`);
          severity = severity || (priority === 'critical' ? 'critical' : 'high');
        }
      }

      if (state === 'in_progress' && hoursStale != null && hoursStale >= inProgressThresholdHours(priority)) {
        reasons.push(`In-progress lane has not moved for ${round(hoursStale)} hours.`);
        severity = severity || (priority === 'critical' ? 'critical' : 'high');
      }

      if (state === 'deferred') {
        if (hoursStale == null) {
          reasons.push('Deferred lane is missing a clear revisit point.');
          severity = severity || 'medium';
        } else if (hoursStale >= 24) {
          reasons.push(`Deferred lane has sat for ${round(hoursStale)} hours without returning to active work.`);
          severity = severity || 'medium';
        }
      }

      if (!severity) return null;

      const recommendedTouch =
        item.firstAction ||
        item.blockerToClear ||
        item.capitalAction ||
        item.topFocus ||
        'Review this lane and set the next concrete action.';

      return {
        commandKey: item.commandKey,
        ownerKey: item.ownerKey,
        ownerLabel: item.ownerLabel,
        sequenceIndex: Number(item.sequenceIndex || 0),
        priority,
        triggerState,
        state,
        severity,
        hoursStale: round(hoursStale),
        blockerToClear: item.blockerToClear || null,
        firstAction: item.firstAction || null,
        capitalAction: item.capitalAction || null,
        recommendedTouch,
        reasons,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      return (
        severityRank(String(a.severity)) - severityRank(String(b.severity)) ||
        (b.hoursStale || 0) - (a.hoursStale || 0) ||
        a.sequenceIndex - b.sequenceIndex
      );
    });

  const limited = escalations.slice(0, options.limit || 8);
  const summary = {
    total: escalations.length,
    critical: escalations.filter((item: any) => item.severity === 'critical').length,
    high: escalations.filter((item: any) => item.severity === 'high').length,
    medium: escalations.filter((item: any) => item.severity === 'medium').length,
    blocked: escalations.filter((item: any) => item.triggerState === 'blocked').length,
    untouchedCritical: escalations.filter((item: any) => item.state === 'queued' && item.priority === 'critical').length,
    staleInProgress: escalations.filter((item: any) => item.state === 'in_progress').length,
    staleDeferred: escalations.filter((item: any) => item.state === 'deferred').length,
  };

  let operatorRead =
    'The escalation engine turns the operator queue into an exception surface so blocked or stale lanes stop waiting to be rediscovered manually.';
  if (summary.total > 0) {
    operatorRead =
      `${summary.total} lanes are actively escalating, including ${summary.critical} critical and ${summary.blocked} blocked, so the morning packet can now call out control failures instead of just listing priority lanes.`;
  }

  return {
    generatedAt: new Date().toISOString(),
    summary,
    escalations: limited,
    operatorRead,
  };
}
