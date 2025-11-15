import { latestSnapshotDir, defaultDaySnapshotsBase, defaultSnapshotsBase } from './snapshots';

// Process-wide in-memory health/metrics state
const MAX_LAT_SAMPLES = 500;

type ReadPathTag = 'parquet_only' | 'csv_only' | 'union' | 'node_csv' | 'parquet_then_csv';

type AdminCounts = {
	reingest: number;
	revalidate: number;
	adjust_epsilon: number;
	toggle_overlay: number;
	failures: number;
};

const state = {
	lastValidateSummary: null as any,
	queryLatenciesMs: [] as number[],
	readCounts: new Map<ReadPathTag, number>(),
	adminCounts: { reingest: 0, revalidate: 0, adjust_epsilon: 0, toggle_overlay: 0, failures: 0 } as AdminCounts,
	lastAdminActionAt: null as string | null,
	overrides: {
		epsilon: undefined as number | undefined,
		overlayDisabled: undefined as boolean | undefined,
	},
};

function bump(map: Map<string, number>, key: string) {
	map.set(key as any, (map.get(key as any) || 0) + 1);
}

export function setLastValidateSummary(summary: any) {
	state.lastValidateSummary = summary;
}

export function getLastValidateSummary(): any {
	return state.lastValidateSummary;
}

export function recordQueryMetrics(durationMs: number, path: ReadPathTag) {
	if (Number.isFinite(durationMs) && durationMs >= 0) {
		state.queryLatenciesMs.push(durationMs);
		if (state.queryLatenciesMs.length > MAX_LAT_SAMPLES) state.queryLatenciesMs.splice(0, state.queryLatenciesMs.length - MAX_LAT_SAMPLES);
	}
	bump(state.readCounts as any, path);
}

function percentile(values: number[], p: number): number | null {
	if (!values.length) return null;
	const arr = values.slice().sort((a, b) => a - b);
	const idx = Math.min(arr.length - 1, Math.max(0, Math.floor((p / 100) * arr.length)));
	return arr[idx];
}

export function getQueryMetrics() {
	const p95 = percentile(state.queryLatenciesMs, 95);
	const countsObj: Record<string, number> = {};
	for (const [k, v] of state.readCounts.entries()) countsObj[k] = v;
	const parquetReads = (countsObj['parquet_only'] || 0) + (countsObj['union'] || 0);
	const csvReads = (countsObj['csv_only'] || 0) + (countsObj['union'] || 0) + (countsObj['node_csv'] || 0) + (countsObj['parquet_then_csv'] || 0);
	const totalReads = parquetReads + csvReads;
	return {
		p95_ms: p95,
		sample_size: state.queryLatenciesMs.length,
		counts: countsObj,
		parquet_read_ratio: totalReads > 0 ? parquetReads / totalReads : null,
		csv_read_ratio: totalReads > 0 ? csvReads / totalReads : null,
	};
}

export function getLastIngestTimestamps() {
	function parseSnapshotDirToIso(dir: string | null): string | null {
		if (!dir) return null;
		const match = /\/(\d{8}T\d{6}Z)$/.exec(dir);
		const ts = match ? match[1] : null;
		if (!ts) return null;
		// Convert YYYYMMDDTHHMMSSZ -> YYYY-MM-DDTHH:MM:SSZ
		return `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}T${ts.slice(9,11)}:${ts.slice(11,13)}:${ts.slice(13,15)}Z`;
	}
	const dayDir = latestSnapshotDir(defaultDaySnapshotsBase());
	const recDir = latestSnapshotDir(defaultSnapshotsBase());
	return {
		last_day_snapshot_dir: dayDir,
		last_day_snapshot_ts: parseSnapshotDirToIso(dayDir),
		last_reconciled_snapshot_dir: recDir,
		last_reconciled_snapshot_ts: parseSnapshotDirToIso(recDir),
	};
}

// Admin action metrics
export function recordAdminAction(name: keyof AdminCounts, success: boolean) {
	if (name in state.adminCounts) (state.adminCounts as any)[name] += 1;
	if (!success) state.adminCounts.failures += 1;
	state.lastAdminActionAt = new Date().toISOString();
}

export function getAdminMetrics() {
	return {
		counts: state.adminCounts,
		last_action_at: state.lastAdminActionAt,
		overrides: {
			epsilon: state.overrides.epsilon ?? null,
			overlay_disabled: state.overrides.overlayDisabled ?? null,
		},
	};
}

// In-memory overrides for ops
export function setEpsilonOverride(epsilon: number | undefined) {
	state.overrides.epsilon = (typeof epsilon === 'number' && Number.isFinite(epsilon)) ? epsilon : undefined;
}
export function getEpsilonOverride(): number | undefined { return state.overrides.epsilon; }

export function setOverlayDisabledOverride(disabled: boolean | undefined) {
	state.overrides.overlayDisabled = (typeof disabled === 'boolean') ? disabled : undefined;
}
export function getOverlayDisabledOverride(): boolean | undefined { return state.overrides.overlayDisabled; }
