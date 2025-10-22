import fs from 'fs';
import path from 'path';

function parseCsvLine(line: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (c === ',' && !inQ) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

function toCsvRow(fields: (string | number | undefined | null)[]): string {
  return fields
    .map((v) => {
      const s = v === undefined || v === null ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    })
    .join(',');
}

function isTruthyActive(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function resolveRunDir(arg?: string): string {
  const backendCwd = process.cwd();
  if (!arg) throw new Error('Usage: ts-node src/scripts/filterActive.ts <run_dir|run_name>');
  const p = path.isAbsolute(arg) ? arg : path.resolve(backendCwd, arg.startsWith('runs/') ? arg : path.join('runs', arg));
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
    throw new Error('Run directory not found: ' + p);
  }
  return p;
}

async function main() {
  const [, , runArg] = process.argv;
  const runDir = resolveRunDir(runArg);
  const adsFile = path.join(runDir, 'ads.csv');
  if (!fs.existsSync(adsFile)) throw new Error('ads.csv not found in ' + runDir);

  const lines = fs.readFileSync(adsFile, 'utf-8').split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('ads.csv is empty at ' + adsFile);
  const header = parseCsvLine(lines[0]);
  const idxMap = new Map<string, number>();
  header.forEach((h, i) => idxMap.set(h, i));
  const isActiveIdx = idxMap.get('is_active');
  const hookIdx = idxMap.get('hook');
  const idIdx = idxMap.get('ad_archive_id');
  if (isActiveIdx === undefined) throw new Error('is_active column not found');

  const activeRows: string[][] = [];
  const hookToAds = new Map<string, Set<string>>();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const activeVal = row[isActiveIdx];
    if (!isTruthyActive(activeVal)) continue;

    activeRows.push(row);
    if (hookIdx !== undefined && idIdx !== undefined) {
      const hook = (row[hookIdx] || '').trim();
      const adId = (row[idIdx] || '').trim();
      if (hook) {
        if (!hookToAds.has(hook)) hookToAds.set(hook, new Set());
        if (adId) hookToAds.get(hook)!.add(adId);
      }
    }
  }

  // Write active_ads.csv
  const outAds = [header.join(',')];
  for (const r of activeRows) outAds.push(toCsvRow(r));
  fs.writeFileSync(path.join(runDir, 'active_ads.csv'), outAds.join('\n'));

  // Write hooks_active.csv
  const hookRows = [['hook', 'unique_ad_count'].join(',')];
  for (const [hook, ids] of hookToAds.entries()) {
    hookRows.push(toCsvRow([hook, ids.size]));
  }
  fs.writeFileSync(path.join(runDir, 'hooks_active.csv'), hookRows.join('\n'));

  console.log('Active ads:', activeRows.length);
  console.log('Active hooks:', hookToAds.size);
  console.log('Wrote', path.join(runDir, 'active_ads.csv'));
  console.log('Wrote', path.join(runDir, 'hooks_active.csv'));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});


