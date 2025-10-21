import fs from 'fs';
import path from 'path';

type Manifest = {
  pages?: string[];
  generated_at?: string;
};

function safeReadJSON(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function main() {
  const runsDir = path.resolve(process.cwd(), 'runs');
  if (!fs.existsSync(runsDir)) {
    console.error('No runs directory at', runsDir);
    process.exit(0);
  }
  const runDirs = fs.readdirSync(runsDir).filter(d => fs.statSync(path.join(runsDir, d)).isDirectory());

  type Entry = {
    competitor_id: string;
    param_keys: string;
    total_ad_count: number;
    run_dirs: Set<string>;
    page_ids: Set<string>;
  };
  const compMap = new Map<string, Entry>(); // key = competitor_id||param_keys

  for (const rd of runDirs) {
    const folder = path.join(runsDir, rd);
    const manifest: Manifest = safeReadJSON(path.join(folder, 'manifest.json')) || {};
    const pageIds = new Set<string>(manifest.pages || []);
    const compCsv = path.join(folder, 'competitors.csv');
    if (!fs.existsSync(compCsv)) continue;
    const lines = fs.readFileSync(compCsv, 'utf-8').split(/\r?\n/).filter(Boolean);
    // header: competitor_id,param_keys,ad_count
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = [] as string[];
      // simple CSV split (no complex quoting expected for our fields)
      let cur = '';
      let inQ = false;
      for (let c of line) {
        if (c === '"') { inQ = !inQ; continue; }
        if (c === ',' && !inQ) { parts.push(cur); cur = ''; continue; }
        cur += c;
      }
      parts.push(cur);
      const competitor_id = (parts[0] || '').trim();
      const param_keys = (parts[1] || '').trim();
      const ad_count = Number(parts[2] || '0') || 0;
      if (!competitor_id) continue;
      const key = competitor_id + '||' + param_keys;
      if (!compMap.has(key)) compMap.set(key, { competitor_id, param_keys, total_ad_count: 0, run_dirs: new Set(), page_ids: new Set() });
      const e = compMap.get(key)!;
      e.total_ad_count += ad_count;
      e.run_dirs.add(`backend/runs/${rd}/`);
      for (const pid of pageIds) e.page_ids.add(pid);
    }
  }

  const rows = [['competitor_id','param_keys','total_ad_count','run_dirs','page_ids'].join(',')];
  for (const e of compMap.values()) {
    const rd = Array.from(e.run_dirs).join(' | ');
    const pids = Array.from(e.page_ids).join(' | ');
    const esc = (s: string) => (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
    rows.push([esc(e.competitor_id), esc(e.param_keys), String(e.total_ad_count), esc(rd), esc(pids)].join(','));
  }
  const out = path.join(runsDir, 'competitors_index.csv');
  fs.writeFileSync(out, rows.join('\n'));
  console.log('Wrote', out);
}

main();


