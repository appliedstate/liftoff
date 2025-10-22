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

function toCsvRow(fields: (string | number | undefined | null)[]): string {
  return fields.map((v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',');
}

function resolveRunDir(arg?: string): string {
  if (!arg) throw new Error('Usage: ts-node src/scripts/competitorPages.ts <run_dir|run_name>');
  const base = process.cwd();
  const p = path.isAbsolute(arg) ? arg : path.resolve(base, arg.startsWith('runs/') ? arg : path.join('runs', arg));
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) throw new Error('Run directory not found: ' + p);
  return p;
}

// Split CSV into records, respecting quoted newlines
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
    if ((c === '\n') && !inQ) {
      if (cur.length > 0) { records.push(cur); cur = ''; }
      continue;
    }
    cur += c;
  }
  if (cur.length > 0) records.push(cur);
  return records.filter(Boolean);
}

async function main() {
  const [, , runArg] = process.argv;
  const runDir = resolveRunDir(runArg);
  const adsPath = path.join(runDir, 'ads.csv');
  if (!fs.existsSync(adsPath)) throw new Error('ads.csv not found in ' + runDir);

  const content = fs.readFileSync(adsPath, 'utf-8');
  const lines = splitCsvRecords(content);
  const header = parseCsvLine(lines[0]);
  const idx = new Map<string, number>();
  header.forEach((h, i) => idx.set(h, i));
  const compIdx = idx.get('competitor_id');
  const pageIdx = idx.get('page_id');
  if (compIdx === undefined || pageIdx === undefined) throw new Error('Required columns not found');

  const compToPages = new Map<string, Set<string>>();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const cid = (row[compIdx] || '').trim();
    const page = (row[pageIdx] || '').trim();
    if (!cid || !page) continue;
    if (!compToPages.has(cid)) compToPages.set(cid, new Set());
    compToPages.get(cid)!.add(page);
  }

  const rows = [['competitor_id','page_count','page_ids'].join(',')];
  const sorted = Array.from(compToPages.entries())
    .map(([cid, pages]) => ({ cid, count: pages.size, pages: Array.from(pages).sort() }))
    .sort((a, b) => b.count - a.count || a.cid.localeCompare(b.cid));
  for (const e of sorted) rows.push(toCsvRow([e.cid, e.count, e.pages.join('|')]));

  const outPath = path.join(runDir, 'competitor_pages.csv');
  fs.writeFileSync(outPath, rows.join('\n'));

  console.log('Unique competitors:', sorted.length);
  console.log('Wrote', outPath);
}

main().catch((err) => { console.error(err?.message || err); process.exit(1); });


