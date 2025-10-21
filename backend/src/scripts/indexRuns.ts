import fs from 'fs';
import path from 'path';

type Manifest = {
  generated_at?: string;
  country?: string;
  start_date?: string;
  end_date?: string;
  min_days?: number;
  platforms_min?: number;
  pages?: string[];
};

function main() {
  const runsDir = path.resolve(process.cwd(), 'runs');
  if (!fs.existsSync(runsDir)) {
    console.error('No runs directory found at', runsDir);
    process.exit(0);
  }
  const entries = fs.readdirSync(runsDir).filter((d) => fs.statSync(path.join(runsDir, d)).isDirectory());
  const rows: any[] = [];
  for (const dir of entries) {
    const p = path.join(runsDir, dir);
    const manifestPath = path.join(p, 'manifest.json');
    let m: Manifest = {};
    if (fs.existsSync(manifestPath)) {
      try { m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch {}
    }
    const files = fs.readdirSync(p).filter((f) => f.endsWith('.csv'));
    rows.push({
      run_dir: `backend/runs/${dir}/`,
      generated_at: m.generated_at || '',
      country: m.country || '',
      start_date: m.start_date || '',
      end_date: m.end_date || '',
      min_days: m.min_days ?? '',
      platforms_min: m.platforms_min ?? '',
      page_ids: (m.pages || []).join('|'),
      files: files.join('|')
    });
  }

  // Write JSON
  const outJson = path.join(runsDir, 'index.json');
  fs.writeFileSync(outJson, JSON.stringify(rows, null, 2));

  // Write CSV
  const headers = ['run_dir','generated_at','country','start_date','end_date','min_days','platforms_min','page_ids','files'];
  const outCsv = [headers.join(',')];
  for (const r of rows) {
    const row = headers.map((h) => {
      const v = r[h] ?? '';
      const s = String(v);
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g,'""') + '"' : s;
    }).join(',');
    outCsv.push(row);
  }
  fs.writeFileSync(path.join(runsDir, 'index.csv'), outCsv.join('\n'));
  console.log('Indexed', rows.length, 'runs');
}

main();


