import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

type ClipSpec = {
  id: string;
  durationSec: number;
  prompt: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function stringifyAxiosError(err: any): string {
  const status = err?.response?.status;
  const statusText = err?.response?.statusText;
  const data = err?.response?.data;
  let dataStr = '';
  try {
    dataStr = data ? JSON.stringify(data, null, 2) : '';
  } catch {
    dataStr = String(data || '');
  }
  return [
    `status=${status ?? 'n/a'}${statusText ? ` ${statusText}` : ''}`,
    dataStr ? `response=${dataStr}` : ''
  ].filter(Boolean).join('\n');
}

async function generateVeoClip(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  maxPolls?: number;
  pollMs?: number;
}) {
  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  let start: any;
  try {
    start = await axios.post(
      `${BASE_URL}/models/${opts.model}:predictLongRunning`,
      { instances: [{ prompt: opts.prompt }] },
      {
        headers: { 'x-goog-api-key': opts.apiKey, 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
  } catch (err: any) {
    throw new Error(`Veo start request failed.\nmodel=${opts.model}\n${stringifyAxiosError(err)}`);
  }

  const opName = start.data?.name;
  if (!opName) throw new Error('No operation name returned');

  const maxPolls = opts.maxPolls ?? 90; // ~15 minutes @10s
  const pollMs = opts.pollMs ?? 10000;

  let statusResp: any = null;
  for (let i = 0; i < maxPolls; i++) {
    await sleep(pollMs);
    const poll = await axios.get(`${BASE_URL}/${opName}`, {
      headers: { 'x-goog-api-key': opts.apiKey },
      timeout: 30000
    });
    statusResp = poll.data;
    if (statusResp?.done) break;
  }

  if (!statusResp?.done) throw new Error('Veo operation did not complete in time');

  const uri = statusResp?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) throw new Error('No video URI in operation response');

  return { opName, uri, rawOperation: statusResp };
}

async function downloadVideo(opts: { apiKey: string; uri: string; outFile: string }) {
  let resp: any;
  try {
    resp = await axios.get(opts.uri, {
      headers: { 'x-goog-api-key': opts.apiKey },
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 300000
    });
  } catch (err: any) {
    throw new Error(`Veo download failed.\n${stringifyAxiosError(err)}`);
  }
  fs.writeFileSync(opts.outFile, Buffer.from(resp.data));
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function parseArgs(argv: string[]) {
  // Supported:
  // 1) Positional (legacy-ish):
  //    ts-node ... <outDir?> <keyword words...> [--model <model>]
  // 2) Flags:
  //    ts-node ... --outDir <dir> --keyword "<phrase>" --model <model>
  const out: { outDir?: string; keyword?: string; model?: string } = {};

  const tokens = argv.slice(2);
  const positional: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--outDir') { out.outDir = tokens[i + 1]; i++; continue; }
    if (t.startsWith('--outDir=')) { out.outDir = t.split('=', 2)[1]; continue; }
    if (t === '--keyword') { out.keyword = tokens[i + 1]; i++; continue; }
    if (t.startsWith('--keyword=')) { out.keyword = t.split('=', 2)[1]; continue; }
    if (t === '--model') { out.model = tokens[i + 1]; i++; continue; }
    if (t.startsWith('--model=')) { out.model = t.split('=', 2)[1]; continue; }
    positional.push(t);
  }

  // If flags not provided, fall back to positionals:
  // - first positional: outDir
  // - remaining: keyword words (joined)
  if (!out.outDir && positional[0]) out.outDir = positional[0];
  if (!out.keyword && positional.length > 1) out.keyword = positional.slice(1).join(' ');

  return out;
}

async function main() {
  const args = parseArgs(process.argv);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY');
    process.exit(1);
  }

  const keyword = (args.keyword && args.keyword.trim().length > 0) ? args.keyword.trim() : 'fatigue blood test panel';
  const model = (args.model && args.model.trim().length > 0) ? args.model.trim() : 'veo-3.1-generate-preview';

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = args.outDir
    ? path.resolve(args.outDir)
    : path.resolve('runs/veo/rsoc-fatigue-v1', ts);

  ensureDir(outDir);

  console.log(`Using model: ${model}`);
  console.log(`Using keyword: ${keyword}`);
  console.log(`Output dir: ${outDir}`);

  const globalStyle = [
    'Vertical 9:16 mobile ad.',
    'Designed for sound-off: ALL key words must appear as large on-screen captions / text overlays.',
    'High-contrast kinetic typography + simple motion graphics.',
    'No brand logos, no medical imagery, no needles, no blood, no doctors, no claims of diagnosis or treatment.',
    'Modern clean UI aesthetic, readable, punchy cuts.',
    'Text must match exactly as written in quotes.'
  ].join(' ');

  const clips: ClipSpec[] = [
    {
      id: '01_hook',
      durationSec: 2,
      prompt: `${globalStyle} Duration ~2s. Pattern interrupt. Big text: "ALWAYS TIRED?" then snap to "STOP GUESSING." Bold white background, black text with one electric-blue accent. Fast zoom-in and a subtle shake.`
    },
    {
      id: '02_belief',
      durationSec: 3,
      prompt: `${globalStyle} Duration ~3s. Minimal animated checklist. Large text: "Fatigue is often a baseline problem." Subtext: "If you don't know your numbers, you're guessing." Clean, calm motion.`
    },
    {
      id: '03_proof',
      durationSec: 5,
      prompt: `${globalStyle} Duration ~5s. Dashboard-style cards slide in, one per beat: "Fasting glucose", "A1C", "Triglycerides", "HDL", "Cholesterol ratio". Add a small timeline label: "baseline to retest". No medical conclusions, just a tracking vibe.`
    },
    {
      id: '04_cta',
      durationSec: 3,
      prompt: `${globalStyle} Duration ~3s. Stylized search bar animation typing: "${keyword}". Then generic shopping-style product cards appear (no real brands). Big CTA text: "Compare options. Pick one. Get your baseline."`
    }
  ];

  const manifest: any = {
    createdAt: new Date().toISOString(),
    model,
    keyword,
    outDir,
    clips: [] as any[]
  };

  for (const clip of clips) {
    const outFile = path.join(outDir, `${clip.id}.mp4`);
    console.log(`Generating ${clip.id}...`);
    const { opName, uri } = await generateVeoClip({
      apiKey,
      model,
      prompt: clip.prompt
    });

    console.log(`Downloading ${clip.id}...`);
    await downloadVideo({ apiKey, uri, outFile });

    manifest.clips.push({
      id: clip.id,
      durationSec: clip.durationSec,
      prompt: clip.prompt,
      opName,
      uri,
      file: outFile
    });
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }

  console.log('Done. Output folder:', outDir);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

