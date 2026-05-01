import { randomUUID } from 'crypto';
import { getCommandOutcomeTelemetryReport } from './commandOutcomeTelemetry';
import { getPgPool } from './pg';
import { getOperatorCommandQueueReport } from './operatorCommandQueue';
import { listOperatorCommandQueueStates } from './operatorCommandQueueState';

function isMissingRelationError(error: any): boolean {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('does not exist') || text.includes('relation') || text.includes('no such table');
}

function jsonb(value: Record<string, any> | undefined): string {
  return JSON.stringify(value || {});
}

function hoursBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return (end - start) / 36e5;
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value) => typeof value === 'number' && Number.isFinite(value)) as number[];
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function round(value: number | null | undefined, decimals = 3): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

async function listSprintMetricSnapshots(sprintKey: string, limit = 14): Promise<any[]> {
  try {
    const result = await getPgPool().query(
      `
        SELECT *
        FROM overnight_sprint_metric_snapshots
        WHERE sprint_key = $1
        ORDER BY captured_at DESC
        LIMIT $2
      `,
      [sprintKey, limit]
    );
    return result.rows;
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

function buildTrend(currentValue: number, snapshots: any[]): {
  current: number;
  rolling7: number | null;
  previous: number | null;
  delta: number | null;
  direction: string;
  averageDailyDelta: number | null;
} {
  const previous = snapshots[0] ? Number(snapshots[0].metric_value || 0) : null;
  const combined = [currentValue, ...snapshots.slice(0, 6).map((row) => Number(row.metric_value || 0))];
  const rolling7 = combined.length ? average(combined) : null;
  const delta = previous == null ? null : currentValue - previous;

  let averageDailyDelta: number | null = null;
  if (snapshots.length >= 2) {
    const oldest = Number(snapshots[Math.min(6, snapshots.length - 1)].metric_value || 0);
    const periods = Math.min(6, snapshots.length - 1) + 1;
    averageDailyDelta = periods > 0 ? (currentValue - oldest) / periods : null;
  } else if (previous != null) {
    averageDailyDelta = currentValue - previous;
  }

  let direction = 'flat';
  if ((delta || 0) > 0.01) direction = 'improving';
  else if ((delta || 0) < -0.01) direction = 'worsening';
  else if (delta == null) direction = 'not_enough_history';

  return {
    current: round(currentValue, 3) || 0,
    rolling7: round(rolling7, 3),
    previous: round(previous, 3),
    delta: round(delta, 3),
    direction,
    averageDailyDelta: round(averageDailyDelta, 3),
  };
}

function buildSprint01FromQueue(queueReport: any, stateRows: any[]): any {
  const stateByKey = new Map<string, any>(
    (stateRows || []).map((row: any) => [String(row.command_key), row])
  );
  const candidates = (queueReport.queue || []).filter((item: any) =>
    Number(item.actionScore || 0) >= 100 || item.priority === 'critical' || item.capitalPriority === 'critical'
  );

  const enriched = candidates.map((item: any) => {
    const state = stateByKey.get(String(item.commandKey)) || null;
    return {
      ...item,
      firstSeenAt: state?.first_seen_at || null,
      seenAt: state?.seen_at || null,
      inProgressAt: state?.in_progress_at || null,
      clearedAt: state?.cleared_at || null,
      promotedAt: state?.promoted_at || null,
    };
  });

  const closed = enriched.filter((item: any) => item.state === 'cleared' || item.state === 'promoted');
  const closureRate = enriched.length ? closed.length / enriched.length : 0;
  const avgTimeToFirstTouch = average(
    enriched.map((item: any) => hoursBetween(item.firstSeenAt, item.seenAt || item.inProgressAt || item.clearedAt || item.promotedAt))
  );
  const avgTimeToResolution = average(
    closed.map((item: any) => hoursBetween(item.firstSeenAt, item.clearedAt || item.promotedAt))
  );
  const stuckOver24h = enriched.filter((item: any) => {
    const firstSeenAt = item.firstSeenAt ? new Date(item.firstSeenAt).getTime() : null;
    if (!firstSeenAt) return false;
    return Date.now() - firstSeenAt > 24 * 36e5 && !['cleared', 'promoted'].includes(String(item.state));
  }).length;
  const noStateChangeRate = enriched.length
    ? enriched.filter((item: any) => String(item.state) === 'queued').length / enriched.length
    : 0;

  return {
    sprintKey: 'sprint_01_operator_autopilot_readiness',
    sprintLabel: 'Sprint 01 — Operator Autopilot Readiness',
    status: 'active',
    northStar: {
      metricKey: 'command_closure_rate_24h',
      label: '24h Command Closure Rate',
      value: round(closureRate, 3) || 0,
      unit: 'ratio',
      definition: '% of top-priority operator commands that have moved to cleared or promoted.',
    },
    diagnostics: {
      candidateCommands: enriched.length,
      closedCommands: closed.length,
      avgTimeToFirstTouchHours: round(avgTimeToFirstTouch, 2),
      avgTimeToResolutionHours: round(avgTimeToResolution, 2),
      stuckOver24h,
      noStateChangeRate: round(noStateChangeRate, 3),
    },
  };
}

function buildPendingSprint(input: {
  sprintKey: string;
  sprintLabel: string;
  metricKey: string;
  metricLabel: string;
  definition: string;
  status: string;
  blocker: string;
}): any {
  return {
    sprintKey: input.sprintKey,
    sprintLabel: input.sprintLabel,
    status: input.status,
    northStar: {
      metricKey: input.metricKey,
      label: input.metricLabel,
      value: null,
      unit: 'ratio',
      definition: input.definition,
    },
    diagnostics: {
      blocker: input.blocker,
    },
    trend: {
      current: null,
      rolling7: null,
      previous: null,
      delta: null,
      direction: 'not_started',
      averageDailyDelta: null,
    },
    operatorRead: input.blocker,
  };
}

export async function getOvernightSprintScorecardReport(): Promise<any> {
  const [queueReport, stateRows] = await Promise.all([
    getOperatorCommandQueueReport({ lookbackDays: 7, limitBuyers: 8 }),
    listOperatorCommandQueueStates(),
  ]);
  const commandOutcomeTelemetry = await getCommandOutcomeTelemetryReport({ lookbackDays: 7, limit: 20 });

  const sprint01 = buildSprint01FromQueue(queueReport, stateRows);
  const [sprint01History] = await Promise.all([
    listSprintMetricSnapshots(sprint01.sprintKey, 14),
  ]);
  sprint01.trend = buildTrend(Number(sprint01.northStar.value || 0), sprint01History);
  sprint01.operatorRead =
    sprint01.trend.direction === 'not_enough_history'
      ? 'Sprint 01 now has a formal north-star metric, but it still needs daily snapshots before trend speed becomes trustworthy.'
      : `Sprint 01 closure rate is ${Math.round(Number(sprint01.northStar.value || 0) * 100)}% with trend ${sprint01.trend.direction}.`;

  const sprint02History = await listSprintMetricSnapshots('sprint_02_morning_packet_and_outcome_closure', 14);
  const sprint02 = {
    sprintKey: 'sprint_02_morning_packet_and_outcome_closure',
    sprintLabel: 'Sprint 02 — Morning Packet And Outcome Closure',
    status: commandOutcomeTelemetry.summary.resolvedCount > 0 ? 'active' : 'planned',
    northStar: {
      metricKey: 'outcome_validated_command_rate',
      label: 'Outcome-Validated Command Rate',
      value: commandOutcomeTelemetry.summary.resolvedCount > 0 ? commandOutcomeTelemetry.summary.validatedRate : null,
      unit: 'ratio',
      definition: '% of cleared or promoted commands that show a real downstream improvement signal.',
    },
    diagnostics: {
      candidateCommands: commandOutcomeTelemetry.summary.resolvedCount,
      closedCommands: commandOutcomeTelemetry.summary.validated,
      avgTimeToResolutionHours: commandOutcomeTelemetry.summary.avgHoursSinceResolution,
      blocker:
        commandOutcomeTelemetry.summary.resolvedCount > 0
          ? undefined
          : 'Sprint 02 will become measurable after the first cleared or promoted commands accumulate enough downstream history.',
    },
    trend:
      commandOutcomeTelemetry.summary.resolvedCount > 0
        ? buildTrend(Number(commandOutcomeTelemetry.summary.validatedRate || 0), sprint02History)
        : {
            current: null,
            rolling7: null,
            previous: null,
            delta: null,
            direction: 'not_started',
            averageDailyDelta: null,
          },
    operatorRead:
      commandOutcomeTelemetry.summary.resolvedCount > 0
        ? commandOutcomeTelemetry.operatorRead
        : 'Sprint 02 telemetry path now exists, but it needs resolved commands with downstream history before the score becomes trustworthy.',
  };

  const sprint03 = buildPendingSprint({
    sprintKey: 'sprint_03_buyer_readiness_and_controlled_delegation',
    sprintLabel: 'Sprint 03 — Buyer Readiness And Controlled Delegation',
    metricKey: 'delegation_readiness_rate',
    metricLabel: 'Delegation Readiness Rate',
    definition: '% of commands judged clean enough for buyer-facing delegation without operator override.',
    status: 'planned',
    blocker: 'Sprint 03 needs buyer-readiness rules and no-send preview scoring before the north-star can be measured.',
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      activeSprint: sprint01.sprintLabel,
      activeNorthStar: sprint01.northStar.label,
      activeCurrentValue: sprint01.northStar.value,
      activeTrendDirection: sprint01.trend.direction,
    },
    sprints: [sprint01, sprint02, sprint03],
  };
}

export async function snapshotOvernightSprintScorecards(input: { capturedAt?: string } = {}): Promise<any> {
  const report = await getOvernightSprintScorecardReport();
  const capturedAt = input.capturedAt || new Date().toISOString();
  let inserted = 0;

  try {
    for (const sprint of report.sprints.filter((item: any) => item.northStar?.value != null)) {
      await getPgPool().query(
        `
          INSERT INTO overnight_sprint_metric_snapshots (
            id, sprint_key, sprint_label, metric_key, metric_label,
            metric_value, window_hours, diagnostics, captured_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8::jsonb, $9
          )
        `,
        [
          randomUUID(),
          sprint.sprintKey,
          sprint.sprintLabel,
          sprint.northStar.metricKey,
          sprint.northStar.label,
          sprint.northStar.value,
          24,
          jsonb({
            diagnostics: sprint.diagnostics,
            trend: sprint.trend,
          }),
          capturedAt,
        ]
      );
      inserted += 1;
    }
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  return {
    capturedAt,
    count: inserted,
    report,
  };
}
