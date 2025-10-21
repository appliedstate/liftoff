import fs from 'fs';
import path from 'path';

function readCSV(file: string): string[][] {
  const txt = fs.readFileSync(file, 'utf-8');
  const lines = txt.split(/\r?\n/).filter(Boolean);
  return lines.map(l => {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (const ch of l) {
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  });
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[[^\]]*\]|\{[^}]*\}/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a), sb = new Set(b);
  const inter = new Set([...sa].filter(x => sb.has(x)));
  const uni = new Set([...sa, ...sb]);
  return uni.size === 0 ? 0 : inter.size / uni.size;
}

function main() {
  const runsDir = path.resolve(process.cwd(), 'runs');
  const runDirs = fs.readdirSync(runsDir).filter(d => fs.statSync(path.join(runsDir, d)).isDirectory());

  type HookRow = { hook: string; hook_norm: string; forcekeys: string; run_dir: string; count: number };
  const hooks: HookRow[] = [];
  for (const rd of runDirs) {
    const folder = path.join(runsDir, rd);
    const hf = path.join(folder, 'hook_forcekey_sets.csv');
    if (!fs.existsSync(hf)) continue;
    const rows = readCSV(hf);
    const header = rows[0] || [];
    const hIdx = header.indexOf('hook');
    const fkIdx = header.indexOf('forcekeyA');
    const cIdx = header.indexOf('unique_ad_count');
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[hIdx]) continue;
      const hook = r[hIdx];
      const fks = r.slice(fkIdx, fkIdx + 5).filter(Boolean).join(' | ');
      const norm = normalize(hook).join(' ');
      const count = cIdx >= 0 ? (parseInt(r[cIdx] || '0', 10) || 0) : 0;
      hooks.push({ hook, hook_norm: norm, forcekeys: fks, run_dir: `backend/runs/${rd}/`, count });
    }
  }

  // Write hooks_master.csv
  const master = [['hook','forcekeys','unique_ad_count','run_dir'].join(',')];
  for (const h of hooks) {
    const esc = (s: string) => (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g,'""') + '"' : s;
    master.push([esc(h.hook), esc(h.forcekeys), String(h.count), esc(h.run_dir)].join(','));
  }
  fs.writeFileSync(path.join(runsDir, 'hooks_master.csv'), master.join('\n'));

  // Cluster hooks by similarity
  const clusters: HookRow[][] = [];
  const used = new Set<number>();
  const threshold = 0.6; // can tune
  for (let i = 0; i < hooks.length; i++) {
    if (used.has(i)) continue;
    const cluster = [hooks[i]];
    used.add(i);
    for (let j = i + 1; j < hooks.length; j++) {
      if (used.has(j)) continue;
      const s = jaccard(hooks[i].hook_norm.split(' '), hooks[j].hook_norm.split(' '));
      if (s >= threshold) { cluster.push(hooks[j]); used.add(j); }
    }
    clusters.push(cluster);
  }

  const clusterRows = [['cluster_id','hook','forcekeys','unique_ad_count','run_dir'].join(',')];
  clusters.forEach((cluster, idx) => {
    for (const h of cluster) {
      const esc = (s: string) => (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g,'""') + '"' : s;
      clusterRows.push([String(idx+1), esc(h.hook), esc(h.forcekeys), String(h.count), esc(h.run_dir)].join(','));
    }
  });
  fs.writeFileSync(path.join(runsDir, 'hooks_clusters.csv'), clusterRows.join('\n'));
  console.log('Wrote hooks_master.csv and hooks_clusters.csv');
}

main();


