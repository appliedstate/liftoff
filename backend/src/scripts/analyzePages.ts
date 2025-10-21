import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fetchAdsForPages, groupAdsByCategory } from '../services/metaAdsService';
import { normalizeCategory } from '../lib/categoryMap';

function readPages(filePath: string): string[] {
  const full = path.resolve(filePath);
  const content = fs.readFileSync(full, 'utf-8').trim();
  if (filePath.endsWith('.json')) {
    const arr = JSON.parse(content);
    if (!Array.isArray(arr)) throw new Error('JSON must be an array of pageIds');
    return arr.map(String);
  }
  // CSV or newline
  return content.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function toCsvRow(fields: (string|number|undefined|null)[]): string {
  return fields.map(v => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(',');
}

async function main() {
  const [,, pagesFile, outFile = 'ads.csv', country, start_date, end_date, min_days_arg, platforms_min_arg, out_dir] = process.argv;
  if (!pagesFile) {
    console.error('Usage: ts-node src/scripts/analyzePages.ts <pages.json|csv|txt> [out.csv] [country] [start_date] [end_date] [min_days] [platforms_min]');
    process.exit(1);
  }
  const pageIds = readPages(pagesFile);
  const minDays = isNaN(Number(min_days_arg)) ? 7 : Number(min_days_arg);
  const platformsMin = isNaN(Number(platforms_min_arg)) ? 1 : Number(platforms_min_arg);
  const adsAll = await fetchAdsForPages({ pageIds, country, start_date, end_date, platforms: 'facebook,instagram', active_status: 'all' });

  // Filter by persistence (active days) and platform breadth
  const endDateForCalc = end_date ? new Date(end_date) : new Date();
  const ads = adsAll.filter(a => {
    try {
      if (!a.start_date) return false;
      const start = new Date(a.start_date);
      const rawEnd = a.end_date ? new Date(a.end_date) : endDateForCalc;
      const days = (rawEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      const platformsCount = (a.publisher_platform || []).length;
      return days >= minDays && platformsCount >= platformsMin;
    } catch {
      return false;
    }
  });

  // Determine output directory
  const baseDir = out_dir ? path.resolve(out_dir) : process.cwd();
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  const outCsv = path.resolve(baseDir, path.basename(outFile));

  // Dedup already done; output CSV
  const headers = ['ad_archive_id','page_id','page_name','is_active','start_date','end_date','publisher_platform','total_active_time','categories','link_url','media_type','hook','ad_copy','extracted_keywords','param_keys','competitor_id','forcekeys','forcekeyA','forcekeyB','forcekeyC','forcekeyD','forcekeyE'];
  const rows = [headers.join(',')];
  for (const ad of ads) {
    const fkMap = new Map<string, string>();
    if (ad.forcekeys) {
      for (const fk of ad.forcekeys) fkMap.set(fk.key.toUpperCase(), fk.value);
    }
    const paramKeys = (ad.extracted_param_keys || []).join('|');
    // Competitor ID heuristic: hash of paramKeys signature (or fallback to host)
    let competitorId = '';
    try {
      const sig = paramKeys || (ad.link_url ? new URL(ad.link_url).hostname : '');
      competitorId = Buffer.from(sig).toString('base64').slice(0, 12);
    } catch { competitorId = ''; }

    rows.push(toCsvRow([
      ad.ad_archive_id,
      ad.page_id,
      ad.page_name,
      ad.is_active ? 1 : 0,
      ad.start_date,
      ad.end_date,
      (ad.publisher_platform || []).join('|'),
      ad.total_active_time ?? '',
      (ad.categories || []).join('|'),
      ad.link_url,
      ad.media_type,
      ad.hook,
      ad.ad_copy,
      (ad.extracted_keywords || []).join('|'),
      paramKeys,
      competitorId,
      (ad.forcekeys || []).map(f => `${f.key}:${f.value}`).join('|'),
      fkMap.get('FORCEKEYA') || '',
      fkMap.get('FORCEKEYB') || '',
      fkMap.get('FORCEKEYC') || '',
      fkMap.get('FORCEKEYD') || '',
      fkMap.get('FORCEKEYE') || ''
    ]));
  }
  fs.writeFileSync(outCsv, rows.join('\n'));
  const grouped = groupAdsByCategory(ads);
  console.log('Wrote', outCsv, 'Categories:', Object.keys(grouped).length);

  // Write categories.csv with one row per hook (category, hook, count)
  const catRows = [['category','hook','count'].join(',')];
  for (const [cat, list] of Object.entries(grouped)) {
    const norm = normalizeCategory(cat);
    const hookCounts = new Map<string, number>();
    for (const a of list) {
      const h = (a.hook || '').trim();
      if (!h) continue;
      hookCounts.set(h, (hookCounts.get(h) || 0) + 1);
    }
    // If no hooks found, still emit UNKNOWN hook with total count
    if (hookCounts.size === 0) {
      catRows.push(toCsvRow([norm, 'UNKNOWN', list.length]));
    } else {
      for (const [hook, count] of hookCounts.entries()) {
        catRows.push(toCsvRow([norm, hook, count]));
      }
    }
  }
  const catFile = path.resolve(baseDir, 'categories.csv');
  fs.writeFileSync(catFile, catRows.join('\n'));
  console.log('Wrote', catFile);

  // Write hooks.csv with unique ad counts per hook across all categories
  const hookToAds = new Map<string, Set<string>>();
  for (const a of ads) {
    const h = (a.hook || '').trim();
    if (!h) continue;
    if (!hookToAds.has(h)) hookToAds.set(h, new Set());
    hookToAds.get(h)!.add(a.ad_archive_id);
  }
  const hooksRows = [['hook','unique_ad_count'].join(',')];
  for (const [hook, set] of hookToAds.entries()) {
    hooksRows.push(toCsvRow([hook, set.size]));
  }
  const hooksFile = path.resolve(baseDir, 'hooks.csv');
  fs.writeFileSync(hooksFile, hooksRows.join('\n'));
  console.log('Wrote', hooksFile);

  // Write hook_forcekeys.csv: hook, forcekey_key, forcekey_value, unique_ad_count
  const hookForcekey = new Map<string, Set<string>>(); // key = `${hook}||${fk.key}||${fk.value}`
  for (const a of ads) {
    const h = (a.hook || '').trim();
    if (!h || !a.forcekeys || a.forcekeys.length === 0) continue;
    for (const fk of a.forcekeys) {
      const key = `${h}||${fk.key}||${fk.value}`;
      if (!hookForcekey.has(key)) hookForcekey.set(key, new Set());
      hookForcekey.get(key)!.add(a.ad_archive_id);
    }
  }
  const hfRows = [['hook','forcekey_key','forcekey_value','unique_ad_count'].join(',')];
  for (const [k, set] of hookForcekey.entries()) {
    const [hook, fkKey, fkValue] = k.split('||');
    hfRows.push(toCsvRow([hook, fkKey, fkValue, set.size]));
  }
  const hfFile = path.resolve(baseDir, 'hook_forcekeys.csv');
  fs.writeFileSync(hfFile, hfRows.join('\n'));
  console.log('Wrote', hfFile);

  // Write hook_forcekeys_summary.csv: hook, unique_ad_count, forcekeys (unique key:value pairs)
  const hookToAdsAll = new Map<string, Set<string>>();
  const hookToFkPairs = new Map<string, Set<string>>();
  for (const a of ads) {
    const h = (a.hook || '').trim();
    if (!h) continue;
    if (!hookToAdsAll.has(h)) hookToAdsAll.set(h, new Set());
    hookToAdsAll.get(h)!.add(a.ad_archive_id);
    if (a.forcekeys && a.forcekeys.length > 0) {
      if (!hookToFkPairs.has(h)) hookToFkPairs.set(h, new Set());
      for (const fk of a.forcekeys) {
        hookToFkPairs.get(h)!.add(`${fk.key}:${fk.value}`);
      }
    }
  }
  const hfsRows = [['hook','unique_ad_count','forcekeys'].join(',')];
  for (const [hook, idSet] of hookToAdsAll.entries()) {
    const fkSet = hookToFkPairs.get(hook) || new Set<string>();
    const fkList = Array.from(fkSet).join(' | ');
    hfsRows.push(toCsvRow([hook, idSet.size, fkList]));
  }
  const hfsFile = path.resolve(baseDir, 'hook_forcekeys_summary.csv');
  fs.writeFileSync(hfsFile, hfsRows.join('\n'));
  console.log('Wrote', hfsFile);

  // Write hook_forcekey_sets.csv: hook, forcekeyA, forcekeyB, forcekeyC, forcekeyD, forcekeyE, unique_ad_count
  const setMap = new Map<string, Set<string>>();
  for (const a of ads) {
    const h = (a.hook || '').trim();
    if (!h) continue;
    const fkm = new Map<string, string>();
    if (a.forcekeys) for (const fk of a.forcekeys) fkm.set(fk.key.toUpperCase(), fk.value);
    const A = fkm.get('FORCEKEYA') || '';
    const B = fkm.get('FORCEKEYB') || '';
    const C = fkm.get('FORCEKEYC') || '';
    const D = fkm.get('FORCEKEYD') || '';
    const E = fkm.get('FORCEKEYE') || '';
    const key = `${h}||${A}||${B}||${C}||${D}||${E}`;
    if (!setMap.has(key)) setMap.set(key, new Set<string>());
    setMap.get(key)!.add(a.ad_archive_id);
  }
  const setRows = [['hook','forcekeyA','forcekeyB','forcekeyC','forcekeyD','forcekeyE','unique_ad_count'].join(',')];
  for (const [k, idSet] of setMap.entries()) {
    const [h,A,B,C,D,E] = k.split('||');
    setRows.push(toCsvRow([h,A,B,C,D,E,idSet.size]));
  }
  const setFile = path.resolve(baseDir, 'hook_forcekey_sets.csv');
  fs.writeFileSync(setFile, setRows.join('\n'));
  console.log('Wrote', setFile);

  // competitors.csv summarizing param_keys signature to competitor_id
  const compMap = new Map<string, { competitor_id: string; count: number }>();
  for (const line of rows.slice(1)) {
    const cols = line.split(',');
    const pk = cols[14] || '';
    const cid = cols[15] || '';
    if (!cid) continue;
    const key = `${cid}||${pk}`;
    if (!compMap.has(key)) compMap.set(key, { competitor_id: cid, count: 0 });
    compMap.get(key)!.count++;
  }
  const compRows = [['competitor_id','param_keys','ad_count'].join(',')];
  for (const [k, v] of compMap.entries()) {
    const [, pk] = k.split('||');
    compRows.push(toCsvRow([v.competitor_id, pk, v.count]));
  }
  const compFile = path.resolve(baseDir, 'competitors.csv');
  fs.writeFileSync(compFile, compRows.join('\n'));
  console.log('Wrote', compFile);

  // Write manifest.json
  const manifest = {
    generated_at: new Date().toISOString(),
    country, start_date, end_date, min_days: minDays, platforms_min: platformsMin,
    pages: pageIds
  };
  fs.writeFileSync(path.resolve(baseDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


