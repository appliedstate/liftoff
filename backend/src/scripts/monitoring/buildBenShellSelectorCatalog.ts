import fs from 'fs';
import path from 'path';
import {
  buildBenShellSelectorCatalog,
  writeBenShellSelectorCatalog,
} from '../../lib/benShellSelectorCatalog';
import { CampaignShellProfileReport } from '../../lib/campaignShellProfilesCompat';
import { FacebookSettingsProfileReport } from '../../lib/facebookSettingsProfilesCompat';

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
  if (!value) throw new Error(`Missing required flag --${name}`);
  return value;
}

async function main() {
  const shellReportPath = path.resolve(requiredFlag('shell-report'));
  const facebookReportPath = path.resolve(requiredFlag('facebook-report'));
  const outputDir = path.resolve(
    getFlag('output-dir') ||
      path.join(process.cwd(), '.local', 'strategis', 'ben-shell-selector-catalog')
  );

  const shellReport = JSON.parse(fs.readFileSync(shellReportPath, 'utf8')) as CampaignShellProfileReport;
  const facebookReport = JSON.parse(fs.readFileSync(facebookReportPath, 'utf8')) as FacebookSettingsProfileReport;

  const catalog = buildBenShellSelectorCatalog({
    shellReport,
    facebookReport,
  });

  writeBenShellSelectorCatalog(outputDir, catalog);

  console.log(`[ben-shell-selector-catalog] Wrote ${path.join(outputDir, 'catalog.json')}`);
  console.log(`[ben-shell-selector-catalog] Wrote ${path.join(outputDir, 'catalog.md')}`);
  console.log(`[ben-shell-selector-catalog] Profiles: ${catalog.profiles.length}`);
}

main().catch((err) => {
  console.error('ben shell selector catalog failed:', err?.message || err);
  process.exitCode = 1;
});
