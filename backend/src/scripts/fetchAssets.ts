import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { searchMetaAdLibrary } from '../lib/searchapi';

async function download(url: string, outPath: string) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  fs.writeFileSync(outPath, resp.data);
}

function collectVideoUrls(obj: any, out: Set<string>) {
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    try {
      if (typeof v === 'string' && /video/i.test(k) && /^https?:\/\//i.test(v)) {
        out.add(v);
      } else if (typeof v === 'object') {
        collectVideoUrls(v as any, out);
      }
    } catch {}
  }
}

async function main() {
  const [,, adListFile, outDir = 'assets'] = process.argv;
  if (!adListFile) {
    console.error('Usage: ts-node src/scripts/fetchAssets.ts <ad_ids.txt> [outDir]');
    process.exit(1);
  }
  const adIds = fs.readFileSync(path.resolve(adListFile), 'utf-8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const base = path.resolve(outDir);
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });

  const rows = [['ad_archive_id','media_type','image_paths','video_urls','video_paths'].join(',')];
  for (const adId of adIds) {
    const data = await searchMetaAdLibrary({ q: adId, active_status: 'all' as any });
    const ad = (data?.ads || [])[0];
    if (!ad) continue;
    const snapshot = ad.snapshot || {};
    const media: string[] = [];
    const videoUrlsSet: Set<string> = new Set();
    // Collect images from snapshot and cards
    const imgFields = ['original_image_url','resized_image_url'];
    for (const f of imgFields) {
      if (snapshot[f]) media.push(snapshot[f]);
    }
    if (Array.isArray(snapshot.cards)) {
      for (const c of snapshot.cards) {
        for (const f of imgFields) if (c?.[f]) media.push(c[f]);
        collectVideoUrls(c, videoUrlsSet);
      }
    }
    // Heuristic: collect any video-like URLs anywhere in snapshot
    collectVideoUrls(snapshot, videoUrlsSet);

    const adFolder = path.join(base, adId);
    if (!fs.existsSync(adFolder)) fs.mkdirSync(adFolder, { recursive: true });
    const imagePaths: string[] = [];
    let idx = 1;
    for (const url of Array.from(new Set(media))) {
      try {
        const file = path.join(adFolder, `image_${idx++}.jpg`);
        await download(url, file);
        imagePaths.push(file);
      } catch {}
    }
    const videoUrls = Array.from(videoUrlsSet);
    const videoPaths: string[] = [];
    let vidx = 1;
    for (const vurl of videoUrls) {
      try {
        const vfile = path.join(adFolder, `video_${vidx++}.mp4`);
        await download(vurl, vfile);
        videoPaths.push(vfile);
      } catch {}
    }
    rows.push([adId, videoUrls.length > 0 ? 'video' : (imagePaths.length > 0 ? 'image' : 'unknown'), imagePaths.join('|'), videoUrls.join('|'), videoPaths.join('|')].join(','));
  }
  fs.writeFileSync(path.join(base, 'assets_manifest.csv'), rows.join('\n'));
  console.log('Wrote', path.join(base, 'assets_manifest.csv'));
}

main().catch(err => { console.error(err); process.exit(1); });


