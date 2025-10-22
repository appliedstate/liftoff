import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseRetryAfter(h?: string): number | undefined {
  if (!h) return undefined;
  const s = Number(h);
  if (!isNaN(s) && s >= 0) return s * 1000;
  const d = Date.parse(h);
  if (!isNaN(d)) return Math.max(0, d - Date.now());
  return undefined;
}

function summarizeError(err: any): string {
  const status = err?.response?.status;
  const statusText = err?.response?.statusText;
  const code = err?.code;
  const msg = err?.message;
  const reqId = err?.response?.headers?.['x-request-id'] || err?.response?.headers?.['openai-request-id'];
  return `status=${status||''} ${statusText||''} code=${code||''} msg=${msg||''} req=${reqId||''}`.trim();
}

async function transcribeBuffer(buf: Buffer, filename = 'audio.mp4'): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  const maxAttempts = 6;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const form = new FormData();
      form.append('file', buf, { filename });
      form.append('model', 'whisper-1');
      const resp = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
        timeout: 120000
      });
      return (resp.data?.text as string) || '';
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429 || (status >= 500 && status <= 599)) {
        const retryAfterMs = parseRetryAfter(err?.response?.headers?.['retry-after']);
        const backoff = retryAfterMs !== undefined ? retryAfterMs : Math.min(60000, 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500));
        await sleep(backoff);
        continue;
      }
      throw new Error(summarizeError(err));
    }
  }
  throw new Error('Transcription failed after retries');
}

async function main() {
  const [,, assetsDir = 'assets'] = process.argv;
  const base = path.resolve(assetsDir);
  if (!fs.existsSync(base)) {
    console.error('Assets dir not found:', base);
    process.exit(1);
  }
  const manifest = path.join(base, 'assets_manifest.csv');
  if (!fs.existsSync(manifest)) {
    console.error('assets_manifest.csv not found in', base);
    process.exit(1);
  }
  const lines = fs.readFileSync(manifest, 'utf-8').split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',');
  const idxAd = header.indexOf('ad_archive_id');
  const idxVidPaths = header.indexOf('video_paths');
  const idxVidUrls = header.indexOf('video_urls');
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const adId = cols[idxAd];
    const vidPaths = (cols[idxVidPaths] || '').split('|').filter(Boolean);
    const vidUrls = idxVidUrls >= 0 ? (cols[idxVidUrls] || '').split('|').filter(Boolean) : [];

    // Prefer local files; throttle between calls
    for (const vp of vidPaths) {
      const fp = path.resolve(vp);
      const out = fp.replace(/\.mp4$/i, '.transcript.txt');
      if (fs.existsSync(out)) continue;
      try {
        const buf = fs.readFileSync(fp);
        const text = await transcribeBuffer(buf);
        fs.writeFileSync(out, text);
        console.log('Wrote transcript for', adId, '->', out);
        await sleep(500);
      } catch (e: any) {
        console.warn('Failed to transcribe file', fp, '-', summarizeError(e));
      }
    }

    // If no local video files, attempt direct URL fetch with retry, then transcribe
    if (vidPaths.length === 0 && vidUrls.length > 0) {
      const adDir = path.join(base, adId);
      if (!fs.existsSync(adDir)) fs.mkdirSync(adDir, { recursive: true });
      let n = 1;
      for (const vu of vidUrls) {
        const maxFetchAttempts = 4;
        let fetched: Buffer | null = null;
        for (let a = 0; a < maxFetchAttempts; a++) {
          try {
            const r = await axios.get(vu, { responseType: 'arraybuffer', timeout: 60000 });
            fetched = Buffer.from(r.data);
            break;
          } catch (e: any) {
            const status = e?.response?.status;
            if (status === 429 || (status >= 500 && status <= 599) || e?.code === 'ENOTFOUND') {
              const back = Math.min(60000, 1000 * Math.pow(2, a) + Math.floor(Math.random() * 500));
              await sleep(back);
              continue;
            }
            console.warn('Fetch failed for URL', vu, '-', summarizeError(e));
            break;
          }
        }
        if (!fetched) continue;
        try {
          const out = path.join(adDir, `video_url_${n++}.transcript.txt`);
          const text = await transcribeBuffer(fetched);
          fs.writeFileSync(out, text);
          console.log('Wrote transcript for', adId, '->', out);
          await sleep(500);
        } catch (e: any) {
          console.warn('Transcribe failed for URL', vu, '-', summarizeError(e));
        }
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });


