import fs from 'fs';
import path from 'path';
import { defaultDaySnapshotsBase, defaultSnapshotsBase, listSnapshotDirs } from '../lib/snapshots';

type Options = {
  maxGb?: number; // total size cap across both bases
  retentionDays?: number; // keep at least N most recent snapshot dirs per base
  dryRun?: boolean;
};

function getArg(name: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return def;
}

function dirSizeBytes(dir: string): number {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  const stack: string[] = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      try {
        if (e.isDirectory()) stack.push(p);
        else total += fs.statSync(p).size;
      } catch {}
    }
  }
  return total;
}

function collectSnapshotDirs(): string[] {
  const dirs = [] as string[];
  for (const base of [defaultDaySnapshotsBase(), defaultSnapshotsBase()]) {
    for (const d of listSnapshotDirs(base)) dirs.push(d);
  }
  // Sort oldest first by directory name (UTC_TS)
  dirs.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  return dirs;
}

async function main() {
  const opts: Options = {
    maxGb: Number(getArg('max_gb', process.env.SNAPSHOT_MAX_GB || '50')),
    retentionDays: parseInt(getArg('retention_days', process.env.SNAPSHOT_RETENTION_DAYS || '14') || '14', 10),
    dryRun: String(getArg('dry_run', process.env.SNAPSHOT_PRUNE_DRY_RUN || 'true')).toLowerCase() === 'true',
  };

  const allDirs = collectSnapshotDirs();
  // Group by base path and keep latest N per base
  const byBase = new Map<string, string[]>();
  for (const d of allDirs) {
    const base = path.dirname(d);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base)!.push(d);
  }

  const keep = new Set<string>();
  for (const [, arr] of byBase) {
    for (let i = Math.max(0, arr.length - (opts.retentionDays || 0)); i < arr.length; i++) keep.add(arr[i]);
  }

  // Calculate sizes and plan deletions oldest-first until under maxGb
  const sizes = allDirs.map((d) => ({ d, bytes: dirSizeBytes(d), keep: keep.has(d) }));
  const totalBytes = sizes.reduce((a, s) => a + s.bytes, 0);
  const targetBytes = Math.max(0, (opts.maxGb || 0) * 1024 * 1024 * 1024);
  const deletable = sizes.filter((s) => !s.keep).sort((a, b) => path.basename(a.d).localeCompare(path.basename(b.d)));

  let bytes = totalBytes;
  const toDelete: { d: string; bytes: number }[] = [];
  for (const s of deletable) {
    if (targetBytes > 0 && bytes <= targetBytes) break;
    toDelete.push({ d: s.d, bytes: s.bytes });
    bytes -= s.bytes;
  }

  const plan = { total_gb: totalBytes / (1024 ** 3), target_gb: targetBytes / (1024 ** 3), will_delete: toDelete.map((x) => ({ dir: x.d, gb: x.bytes / (1024 ** 3) })), dry_run: !!opts.dryRun };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(plan, null, 2));

  if (!opts.dryRun) {
    for (const x of toDelete) {
      try {
        fs.rmSync(x.d, { recursive: true, force: true });
      } catch {}
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


