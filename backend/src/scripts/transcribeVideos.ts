import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

async function transcribeBuffer(buf: Buffer, filename = 'audio.mp4'): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  const form = new FormData();
  form.append('file', buf, { filename });
  form.append('model', 'whisper-1');
  const resp = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...form.getHeaders()
    },
    timeout: 120000
  });
  return (resp.data?.text as string) || '';
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
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const adId = cols[idxAd];
    const vidPaths = (cols[idxVidPaths] || '').split('|').filter(Boolean);
    const idxVidUrls = header.indexOf('video_urls');
    const vidUrls = idxVidUrls >= 0 ? (cols[idxVidUrls] || '').split('|').filter(Boolean) : [];
    for (const vp of vidPaths) {
      const fp = path.resolve(vp);
      const out = fp.replace(/\.mp4$/i, '.transcript.txt');
      if (fs.existsSync(out)) continue;
      try {
        const buf = fs.readFileSync(fp);
        const text = await transcribeBuffer(buf);
        fs.writeFileSync(out, text);
        console.log('Wrote transcript for', adId, '->', out);
      } catch (e) {
        console.warn('Failed to transcribe', fp, e);
      }
    }

    // If no local video files, attempt direct URL fetch and transcribe
    if (vidPaths.length === 0 && vidUrls.length > 0) {
      const adDir = path.join(base, adId);
      if (!fs.existsSync(adDir)) fs.mkdirSync(adDir, { recursive: true });
      let n = 1;
      for (const vu of vidUrls) {
        try {
          const r = await axios.get(vu, { responseType: 'arraybuffer', timeout: 60000 });
          const buf = Buffer.from(r.data);
          const out = path.join(adDir, `video_url_${n++}.transcript.txt`);
          const text = await transcribeBuffer(buf);
          fs.writeFileSync(out, text);
          console.log('Wrote transcript for', adId, '->', out);
        } catch (e) {
          console.warn('Failed to fetch/transcribe URL', vu, e);
        }
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });


