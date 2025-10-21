import 'dotenv/config';
import fs from 'fs';
import path from 'path';

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function readCSV(file: string): string[][] {
  const txt = fs.readFileSync(file, 'utf-8');
  const lines = txt.split(/\r?\n/).filter(l => l.length > 0);
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

async function main() {
  // Args: winnersCsv brandImage outBase
  const [,, winnersCsvArg, brandImageArg, outBaseArg] = process.argv;
  if (!winnersCsvArg) {
    console.error('Usage: ts-node src/scripts/iterate.ts <winnersCsv=ads.csv> [brandImage] [outBase=runs/iterate]');
    process.exit(1);
  }
  const winnersCsv = path.resolve(winnersCsvArg);
  const brandImage = brandImageArg ? path.resolve(brandImageArg) : '';
  const outBase = path.resolve(outBaseArg || 'runs/iterate');

  const runId = timestamp();
  const runDir = path.join(outBase, runId);
  const srcDir = path.join(runDir, 'source');
  const genDir = path.join(runDir, 'generated');
  ensureDir(srcDir);
  ensureDir(genDir);

  // Read winners CSV (expected headers include ad_archive_id, hook, forcekeys, link_url if ads.csv)
  const rows = readCSV(winnersCsv);
  const header = rows[0] || [];
  const data = rows.slice(1);
  const idxAd = header.indexOf('ad_archive_id');
  const idxHook = header.indexOf('hook');
  const idxLink = header.indexOf('link_url');

  // Copy brand image if provided
  let brandImageCopied = '';
  if (brandImage && fs.existsSync(brandImage)) {
    const dest = path.join(runDir, path.basename(brandImage));
    fs.copyFileSync(brandImage, dest);
    brandImageCopied = dest;
  }

  // Write manifest.json
  const manifest = {
    run_id: runId,
    created_at: new Date().toISOString(),
    inputs: { winnersCsv, brandImage: brandImageCopied },
    counts: { total_rows: data.length },
    files: { runDir, srcDir, genDir }
  };
  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Create a simple gallery.md stub
  const listItems = data.slice(0, 50).map(r => {
    const ad = idxAd >= 0 ? r[idxAd] : '';
    const hook = idxHook >= 0 ? r[idxHook] : '';
    const link = idxLink >= 0 ? r[idxLink] : '';
    return `- ad_id: ${ad}  hook: ${hook || '(n/a)'}  link: ${link || '(n/a)'}`;
  }).join('\n');

  const gallery = `# Iterate Run ${runId}\n\nInputs:\n- winnersCsv: ${winnersCsv}\n- brandImage: ${brandImageCopied || '(none)'}\n\n## Candidates (first 50)\n${listItems}\n`;
  fs.writeFileSync(path.join(runDir, 'gallery.md'), gallery);

  console.log('Iterate scaffold created at', runDir);
}

main().catch(err => { console.error(err); process.exit(1); });



