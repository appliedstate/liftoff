import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
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

async function main() {
  // Args: runName hookSubstring [brandImage] [assetsOutDir]
  const [, , runArg, hookArg, brandImageArg, assetsOutArg] = process.argv;
  if (!runArg || !hookArg) {
    console.error('Usage: ts-node src/scripts/iterateHook.ts <run_name> <hook_substring> [brandImage] [assetsOutDir]');
    process.exit(1);
  }
  const backendDir = process.cwd();
  const runDir = path.resolve(path.join('runs', runArg));
  const adsCsv = path.join(runDir, 'ads.csv');
  if (!fs.existsSync(adsCsv)) { console.error('ads.csv not found in', runDir); process.exit(1); }

  const stamp = timestamp();
  const iterateBase = path.resolve('runs/iterate');
  ensureDir(iterateBase);
  const iterRunDir = path.join(iterateBase, stamp + '_hook');
  ensureDir(iterRunDir);

  // 1) Select winners by hook (active only)
  const winnersCsv = path.join(runDir, 'winners_auto.csv');
  execSync(`npx ts-node src/scripts/selectByHook.ts ${runArg} ${JSON.stringify(hookArg)} ${JSON.stringify(winnersCsv)} 1`, { stdio: 'inherit', cwd: backendDir });

  // 2) Iterate scaffold from winners (creates a new subfolder in iterateBase)
  const brandArg = brandImageArg ? JSON.stringify(path.resolve(brandImageArg)) : '""';
  execSync(`npx ts-node src/scripts/iterate.ts ${JSON.stringify(winnersCsv)} ${brandArg} ${JSON.stringify(iterateBase)}`, { stdio: 'inherit', cwd: backendDir });

  // Locate the most recent iterate run folder
  const subdirs = fs.readdirSync(iterateBase)
    .map((d) => ({ d, p: path.join(iterateBase, d) }))
    .filter(({ p }) => fs.statSync(p).isDirectory())
    .sort((a, b) => fs.statSync(b.p).mtimeMs - fs.statSync(a.p).mtimeMs);
  const latestIterDir = subdirs.length > 0 ? subdirs[0].p : iterRunDir;

  // 3) Extract ad IDs
  const content = fs.readFileSync(winnersCsv, 'utf-8');
  const lines = splitCsvRecords(content);
  const header = parseCsvLine(lines[0]);
  const adIdx = header.indexOf('ad_archive_id');
  const ids: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const id = (row[adIdx] || '').trim();
    if (id) ids.push(id);
  }
  const adList = path.join(iterRunDir, 'ad_ids.txt');
  fs.writeFileSync(adList, ids.join('\n'));

  // 4) Fetch assets for those ads
  const assetsOut = path.resolve(assetsOutArg || path.join('assets', stamp + '_hook'));
  ensureDir(assetsOut);
  execSync(`npx ts-node src/scripts/fetchAssets.ts ${JSON.stringify(adList)} ${JSON.stringify(assetsOut)}`, { stdio: 'inherit', cwd: backendDir });

  // 5) Transcribe videos if API key present
  if (process.env.OPENAI_API_KEY) {
    execSync(`npx ts-node src/scripts/transcribeVideos.ts ${JSON.stringify(assetsOut)}`, { stdio: 'inherit', cwd: backendDir });
  } else {
    console.warn('Skipping transcription (missing OPENAI_API_KEY).');
  }

  // 6) Generate images via Nano Banana
  if (process.env.NANO_BANANA_URL && process.env.NANO_BANANA_API_KEY) {
    execSync(`npx ts-node src/scripts/generate.ts ${JSON.stringify(winnersCsv)} ${JSON.stringify(latestIterDir)} ${brandArg} 5`, { stdio: 'inherit', cwd: backendDir });
  } else {
    console.warn('Skipping generation (missing NANO_BANANA_URL or NANO_BANANA_API_KEY).');
  }

  console.log('Done. Winners:', winnersCsv);
  console.log('Iterate run dir:', latestIterDir);
  console.log('Assets dir:', assetsOut);
}

main().catch((err) => { console.error(err?.message || err); process.exit(1); });


