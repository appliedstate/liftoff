import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { generateImageWithNanoBanana } from '../lib/nanobanana';
import { generateImageWithGemini } from '../lib/gemini';

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
  // Args: winnersCsv iterateRunDir brandImage [max=10]
  const [,, winnersCsvArg, iterateRunDirArg, brandImageArg, maxArg] = process.argv;
  if (!winnersCsvArg || !iterateRunDirArg) {
    console.error('Usage: ts-node src/scripts/generate.ts <winnersCsv> <iterateRunDir> <brandImage|""> [max=10]');
    process.exit(1);
  }
  const winnersCsv = path.resolve(winnersCsvArg);
  const iterateRunDir = path.resolve(iterateRunDirArg);
  const brandImage = brandImageArg ? path.resolve(brandImageArg) : '';
  const genDir = path.join(iterateRunDir, 'generated');
  if (!fs.existsSync(genDir)) fs.mkdirSync(genDir, { recursive: true });

  const content = fs.readFileSync(winnersCsv, 'utf-8');
  const lines = splitCsvRecords(content);
  const header = parseCsvLine(lines[0] || '');
  const data = lines.slice(1).map(parseCsvLine);
  const idxAd = header.indexOf('ad_archive_id');
  const idxHook = header.indexOf('hook');
  const idxLink = header.indexOf('link_url');

  let produced = 0;
  const max = isNaN(Number(maxArg)) ? 10 : Number(maxArg);
  for (const r of data) {
    if (produced >= max) break;
    const adId = (idxAd >= 0 ? (r[idxAd] || '') : '').trim();
    const hook = (idxHook >= 0 ? (r[idxHook] || '') : '').trim();
    const link = (idxLink >= 0 ? (r[idxLink] || '') : '').trim();

    // Try to find a source image saved by fetchAssets
    const assetsDir = path.resolve('assets');
    const adDirCandidates = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).map((d) => path.join(assetsDir, d)).filter((p) => fs.statSync(p).isDirectory())
      : [];
    let sourceImagePath = '';
    for (const aDir of adDirCandidates) {
      const p = path.join(aDir, adId);
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        const imgs = (fs.readdirSync(p).filter((f) => f.startsWith('image_') && f.endsWith('.jpg'))).map((f) => path.join(p, f));
        if (imgs.length > 0) { sourceImagePath = imgs[0]; break; }
      }
    }

    const prompt = `Recreate this ad image with our brand while preserving layout and concept. Hook: ${hook}. Destination: ${link || 'n/a'}. Style: clean, high-contrast, legible text, brand-safe.`;
    try {
      let buf: Buffer;
      if (process.env.GEMINI_API_KEY) {
        buf = await generateImageWithGemini({ prompt, sourceImagePath, brandImagePath: brandImage || undefined, aspectRatio: '1:1' });
      } else {
        buf = await generateImageWithNanoBanana({ prompt, sourceImagePath, brandImagePath: brandImage || undefined });
      }
      const outfile = path.join(genDir, `${adId || 'noid'}_gen.jpg`);
      fs.writeFileSync(outfile, buf);
      console.log('Generated', outfile);
      produced++;
      await new Promise(r => setTimeout(r, 500));
    } catch (e: any) {
      console.warn('Generate failed for', adId, e?.message || e);
    }
  }
  console.log('Generated images:', produced);
}

main().catch((err) => { console.error(err); process.exit(1); });


