#!/usr/bin/env ts-node

/**
 * Edge: Create Campaign Packet
 *
 * Creates a campaign packet folder under docs/edge/campaigns/ with 5 template files:
 * 01_category.md, 02_ad_script.md, 03_keywords.md, 04_video_ad.md, 05_setup.md
 *
 * Usage:
 *   cd backend
 *   npm run edge:packet -- --campaign-name="sige41p0612_012026_SeniorInternet_US_Facebook_Edge" --vertical=internet
 *
 * Optional:
 *   --date=YYYY-MM-DD  (defaults to today PST)
 *   --platform=facebook (default)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getTodayPST } from '../../lib/dateUtils';

function getFlag(name: string): string | undefined {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return undefined;
  return arg.slice(key.length);
}

function die(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(msg);
  process.exit(1);
}

function inferStrategisIdFromCampaignName(campaignName: string): string | null {
  const first = String(campaignName || '').trim().split('_')[0]?.trim();
  if (!first) return null;
  if (first.length > 3 && first.length < 20 && !/^\d+$/.test(first)) return first;
  return null;
}

function safeSlug(input: string): string {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function readTemplate(relPathFromRepoRoot: string): string {
  const repoRoot = path.resolve(__dirname, '../../../../');
  const fullPath = path.join(repoRoot, relPathFromRepoRoot);
  if (!fs.existsSync(fullPath)) die(`Missing template file: ${relPathFromRepoRoot}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function writeFileIfMissing(filePath: string, contents: string): void {
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, contents, 'utf8');
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

async function main(): Promise<void> {
  const campaignName = getFlag('campaign-name');
  const vertical = getFlag('vertical');
  const platform = getFlag('platform') || 'facebook';
  const date = getFlag('date') || getTodayPST();

  if (!campaignName) die('Missing --campaign-name="<full name>"');
  if (!vertical) die('Missing --vertical=<vertical slug> (e.g. internet)');

  const strategisId = inferStrategisIdFromCampaignName(campaignName);
  if (!strategisId) die(`Could not infer Strategis ID from campaign name: ${campaignName}`);

  const repoRoot = path.resolve(__dirname, '../../../../');
  const campaignsRoot = path.join(repoRoot, 'docs', 'edge', 'campaigns');
  const folderName = `${date}__${safeSlug(vertical)}__${safeSlug(platform)}__${safeSlug(strategisId)}`;
  const packetDir = path.join(campaignsRoot, folderName);

  ensureDir(packetDir);

  const templatesBase = path.join('docs', 'edge', 'templates', 'campaign-packet');
  const t1 = readTemplate(path.join(templatesBase, '01_category.md'));
  const t2 = readTemplate(path.join(templatesBase, '02_ad_script.md'));
  const t3 = readTemplate(path.join(templatesBase, '03_keywords.md'));
  const t4 = readTemplate(path.join(templatesBase, '04_video_ad.md'));
  const t5 = readTemplate(path.join(templatesBase, '05_setup.md'));

  const header = `# Campaign Packet\n\n- **Campaign**: ${campaignName}\n- **Strategis ID**: ${strategisId}\n- **Vertical**: ${vertical}\n- **Platform**: ${platform}\n- **Date (PST)**: ${date}\n\n`;
  writeFileIfMissing(path.join(packetDir, 'README.md'), header);
  writeFileIfMissing(path.join(packetDir, '01_category.md'), t1);
  writeFileIfMissing(path.join(packetDir, '02_ad_script.md'), t2);
  writeFileIfMissing(path.join(packetDir, '03_keywords.md'), t3);
  writeFileIfMissing(path.join(packetDir, '04_video_ad.md'), t4);
  writeFileIfMissing(path.join(packetDir, '05_setup.md'), t5);

  // eslint-disable-next-line no-console
  console.log(`Created campaign packet: ${path.relative(repoRoot, packetDir)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message || err);
  process.exit(1);
});

