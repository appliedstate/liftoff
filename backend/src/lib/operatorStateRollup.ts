import { listOperatorCommandQueueStates } from './operatorCommandQueueState';

function hoursSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  return (Date.now() - ts) / 36e5;
}

export async function getOperatorStateRollupReport(options: { lookbackHours?: number; limit?: number } = {}): Promise<any> {
  const lookbackHours = options.lookbackHours || 24;
  const limit = options.limit || 12;
  const cutoff = Date.now() - lookbackHours * 36e5;

  const rows = await listOperatorCommandQueueStates();
  const changed = rows
    .filter((row: any) => {
      const ts = new Date(String(row.last_state_changed_at || row.updated_at || row.created_at || 0)).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    })
    .sort((a: any, b: any) => {
      return new Date(String(b.last_state_changed_at || b.updated_at || 0)).getTime() -
        new Date(String(a.last_state_changed_at || a.updated_at || 0)).getTime();
    });

  const summary = {
    lookbackHours,
    changedCount: changed.length,
    seen: changed.filter((row: any) => String(row.status) === 'seen').length,
    inProgress: changed.filter((row: any) => String(row.status) === 'in_progress').length,
    cleared: changed.filter((row: any) => String(row.status) === 'cleared').length,
    promoted: changed.filter((row: any) => String(row.status) === 'promoted').length,
    deferred: changed.filter((row: any) => String(row.status) === 'deferred').length,
  };

  const changes = changed.slice(0, limit).map((row: any) => ({
    commandKey: String(row.command_key),
    ownerKey: String(row.owner_key),
    ownerLabel: String(row.owner_label || row.owner_key),
    status: String(row.status),
    noteMd: row.note_md || null,
    changedAt: row.last_state_changed_at || null,
    hoursSinceChange: hoursSince(row.last_state_changed_at || row.updated_at || row.created_at),
  }));

  let operatorRead =
    'The state rollup automatically summarizes command movement since the last cycle so the operator can see what actually changed instead of reconstructing it manually.';
  if (summary.changedCount > 0) {
    operatorRead =
      `${summary.changedCount} command state changes landed in the last ${lookbackHours} hours, including ${summary.cleared} cleared and ${summary.promoted} promoted, so the morning packet can now start from movement rather than static queue state.`;
  }

  return {
    generatedAt: new Date().toISOString(),
    summary,
    changes,
    operatorRead,
  };
}
