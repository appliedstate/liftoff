import path from 'path';
import fs from 'fs';
import {
  buildCampaignShellProfileReport,
  CampaignShellExportRow,
  writeCampaignShellProfileReport,
} from '../../lib/campaignShellProfiles';

function getFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return null;
}

function requiredFlag(name: string): string {
  const value = getFlag(name);
  if (!value) {
    throw new Error(`Missing required flag --${name}`);
  }
  return value;
}

async function main() {
  const input = path.resolve(requiredFlag('input'));
  const buyer = requiredFlag('buyer');
  const outputDir = path.resolve(
    getFlag('output-dir') ||
      path.join(process.cwd(), '.local', 'strategis', 'campaign-shell-profiles', buyer.toLowerCase())
  );

  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const rows = JSON.parse(fs.readFileSync(input, 'utf8')) as CampaignShellExportRow[];
  const report = buildCampaignShellProfileReport(rows, buyer);
  writeCampaignShellProfileReport(outputDir, report);

  console.log(`[campaign-shell-profiles] Wrote ${path.join(outputDir, 'report.json')}`);
  console.log(`[campaign-shell-profiles] Wrote ${path.join(outputDir, 'report.md')}`);
  console.log(`[campaign-shell-profiles] Campaigns analyzed: ${report.scope.campaignCount}`);
  console.log(
    `[campaign-shell-profiles] Locked defaults: ${Object.keys(report.recommendation.autoPopulateAlways).length}`
  );
  console.log(
    `[campaign-shell-profiles] Category profiles: ${report.categoryProfiles.length}`
  );
}

main().catch((err) => {
  console.error('campaign shell profile report failed:', err?.message || err);
  process.exitCode = 1;
});
