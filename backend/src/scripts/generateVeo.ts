import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

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
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else { q = !q; } continue; }
    if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  // Args: winnersCsv outDir [model=veo-3.1-generate-preview]
  const [,, winnersCsvArg, outDirArg, modelArg] = process.argv;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY');
    process.exit(1);
  }
  if (!winnersCsvArg) {
    console.error('Usage: ts-node src/scripts/generateVeo.ts <winnersCsv> [outDir=runs/iterate/<latest>/generated] [model=veo-3.1-generate-preview]');
    process.exit(1);
  }
  const winnersCsv = path.resolve(winnersCsvArg);
  const winnersContent = fs.readFileSync(winnersCsv, 'utf-8');
  const lines = splitCsvRecords(winnersContent);
  const header = parseCsvLine(lines[0] || '');
  const data = lines.slice(1).map(parseCsvLine);
  const idxHook = header.indexOf('hook');
  const hook = (idxHook >= 0 && data[0]) ? (data[0][idxHook] || '').trim() : '';
  const prompt = hook ? `${hook}. 7-8 second 16:9 promo video. Brand-safe, clean, realistic.` : 'Create a 7-8 second 16:9 promo video. Brand-safe, clean, realistic.';

  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  const model = modelArg || 'veo-3.1-generate-preview';

  // Kick off long-running operation
  const start = await axios.post(
    `${BASE_URL}/models/${model}:predictLongRunning`,
    { instances: [{ prompt }] },
    { headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  const opName = start.data?.name;
  if (!opName) throw new Error('No operation name returned');

  // Poll until done
  let done = false;
  let statusResp: any = null;
  for (let i = 0; i < 60; i++) { // up to ~10 minutes @10s
    await new Promise(r => setTimeout(r, 10000));
    const poll = await axios.get(`${BASE_URL}/${opName}`, { headers: { 'x-goog-api-key': apiKey }, timeout: 30000 });
    statusResp = poll.data;
    if (statusResp?.done) { done = true; break; }
  }
  if (!done) throw new Error('Veo operation did not complete in time');

  // Extract download URI
  const uri = statusResp?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) throw new Error('No video URI in operation response');

  const outDir = outDirArg ? path.resolve(outDirArg) : path.resolve('runs/iterate', (fs.readdirSync('runs/iterate').sort().pop() || ''), 'generated');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `veo_${Date.now()}.mp4`);

  // Download with API key and follow redirects
  const videoResp = await axios.get(uri, { headers: { 'x-goog-api-key': apiKey }, responseType: 'arraybuffer', maxRedirects: 5, timeout: 300000 });
  fs.writeFileSync(outFile, Buffer.from(videoResp.data));
  console.log('Saved video:', outFile);
}

main().catch((err) => { console.error(err?.message || err); process.exit(1); });


