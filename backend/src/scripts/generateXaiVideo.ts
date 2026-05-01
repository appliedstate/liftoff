import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {
  xaiCreateJob,
  xaiDownloadResult,
  xaiWaitForCompletion,
} from '../services/xaiVideo';

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
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else { q = !q; }
      continue;
    }
    if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  // Args: winnersCsv outDir [model=grok-imagine-video] [promptOverride]
  const [, , winnersCsvArg, outDirArg, modelArg, promptOverrideArg] = process.argv;
  if (!winnersCsvArg) {
    // eslint-disable-next-line no-console
    console.error(
      'Usage: ts-node src/scripts/generateXaiVideo.ts <winnersCsv> [outDir=runs/iterate/<latest>/generated] [model=grok-imagine-video] [promptOverride]'
    );
    process.exit(1);
  }

  const winnersCsv = path.resolve(winnersCsvArg);
  const content = fs.readFileSync(winnersCsv, 'utf-8');
  const lines = splitCsvRecords(content);
  const header = parseCsvLine(lines[0] || '');
  const data = lines.slice(1).map(parseCsvLine);

  const idxHook = header.indexOf('hook');
  const idxCopy = header.indexOf('ad_copy');
  const copy = (idxCopy >= 0 && data[0]) ? (data[0][idxCopy] || '').trim() : '';
  const hook = (idxHook >= 0 && data[0]) ? (data[0][idxHook] || '').trim() : '';
  const text = copy || hook;

  const duration = process.env.XAI_VIDEO_DURATION ? Number(process.env.XAI_VIDEO_DURATION) : 8;
  const aspect_ratio = process.env.XAI_VIDEO_ASPECT_RATIO || '9:16';
  const resolution = process.env.XAI_VIDEO_RESOLUTION || '720p';
  const model = modelArg || process.env.XAI_VIDEO_MODEL || 'grok-imagine-video';

  const basePrompt = text
    ? `${text}. Create a ${duration}-second ${aspect_ratio} UGC-style vertical promo video that visualizes this copy. Keep it brand-safe, informational, clean, and realistic with clear typography. Include a 4-cut max pacing.`
    : `Create a ${duration}-second ${aspect_ratio} UGC-style vertical promo video. Brand-safe, informational, clean, realistic.`;

  const prompt = (promptOverrideArg && promptOverrideArg.length > 0)
    ? (text ? `${text}. ${promptOverrideArg}` : promptOverrideArg)
    : basePrompt;

  // eslint-disable-next-line no-console
  console.log('Submitting xAI video job...');
  const job = await xaiCreateJob({
    prompt,
    model,
    duration,
    aspect_ratio: aspect_ratio as any,
    resolution: resolution as any,
  });

  // eslint-disable-next-line no-console
  console.log('requestId:', job.id);
  const final = await xaiWaitForCompletion({
    requestId: job.id,
    pollMs: 5_000,
    maxWaitMs: 20 * 60 * 1000,
  });

  if (final.status !== 'completed') {
    throw new Error(`xAI job ended with status=${final.status}`);
  }

  const dl = await xaiDownloadResult({ requestId: job.id });

  const outDir = outDirArg
    ? path.resolve(outDirArg)
    : path.resolve(
        'runs/iterate',
        (fs.existsSync('runs/iterate') ? (fs.readdirSync('runs/iterate').sort().pop() || '') : ''),
        'generated'
      );

  ensureDir(outDir);

  const outFile = path.join(outDir, `xai_${Date.now()}.mp4`);
  fs.copyFileSync(dl.filePath, outFile);

  // Write a small provenance record next to the copied MP4.
  const meta = {
    provider: 'xai',
    requestId: job.id,
    model,
    duration,
    aspect_ratio,
    resolution,
    winnersCsv,
    prompt,
    downloadedFrom: dl.url,
    copiedTo: outFile,
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(outFile.replace(/\.mp4$/i, '.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  // eslint-disable-next-line no-console
  console.log('Saved video:', outFile);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message || err);
  process.exit(1);
});

