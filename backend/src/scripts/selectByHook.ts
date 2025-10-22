import fs from 'fs';
import path from 'path';

function parseCsvLine(line: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
      continue;
    }
    if (c === ',' && !inQ) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

function splitCsvRecords(content: string): string[] {
  const records: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') {
      if (inQ && content[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; cur += '"'; }
      continue;
    }
    if (c === '\n' && !inQ) { if (cur.length > 0) { records.push(cur); cur = ''; } continue; }
    cur += c;
  }
  if (cur.length > 0) records.push(cur);
  return records.filter(Boolean);
}

function toCsvRow(fields: (string | number | undefined | null)[]): string {
  return fields.map((v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',');
}

async function main() {
  // Args: runDir hookSubstring outCsv [activeOnly=1]
  const [, , runArg, hookArg, outCsvArg, activeOnlyArg] = process.argv;
  if (!runArg || !hookArg) {
    console.error('Usage: ts-node src/scripts/selectByHook.ts <run_dir|run_name> <hook_substring> [outCsv=winners.csv] [activeOnly=1]');
    process.exit(1);
  }
  const runDir = path.isAbsolute(runArg) ? runArg : path.resolve(path.join('runs', runArg));
  const adsPath = path.join(runDir, 'ads.csv');
  if (!fs.existsSync(adsPath)) {
    console.error('ads.csv not found in', runDir);
    process.exit(1);
  }
  const hookSub = hookArg.toLowerCase();
  const outCsv = outCsvArg ? path.resolve(outCsvArg) : path.resolve(runDir, 'winners.csv');
  const activeOnly = activeOnlyArg === undefined ? true : ['1','true','yes'].includes(activeOnlyArg.toLowerCase());

  const content = fs.readFileSync(adsPath, 'utf-8');
  const lines = splitCsvRecords(content);
  const header = parseCsvLine(lines[0]);
  const idx = new Map<string, number>();
  header.forEach((h, i) => idx.set(h, i));
  const idxHook = idx.get('hook');
  const idxActive = idx.get('is_active');
  if (idxHook === undefined) { console.error('hook column not found'); process.exit(1); }

  const outRows: string[] = [header.join(',')];
  let kept = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const hook = (row[idxHook] || '').toLowerCase();
    if (!hook.includes(hookSub)) continue;
    if (activeOnly && idxActive !== undefined) {
      const v = (row[idxActive] || '').trim().toLowerCase();
      const isActive = v === '1' || v === 'true' || v === 'yes';
      if (!isActive) continue;
    }
    outRows.push(toCsvRow(row));
    kept++;
  }

  fs.writeFileSync(outCsv, outRows.join('\n'));
  console.log('Kept rows:', kept);
  console.log('Wrote', outCsv);
}

main().catch(err => { console.error(err); process.exit(1); });


