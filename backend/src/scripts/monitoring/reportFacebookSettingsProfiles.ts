import fs from 'fs';
import path from 'path';
import {
  buildFacebookSettingsProfileReport,
  renderFacebookSettingsProfileMarkdown,
  FacebookAdRow,
  FacebookAdSetRow,
  FacebookCampaignRow,
  StrategisShellRow,
} from '../../lib/facebookSettingsProfiles';

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
  const buyer = requiredFlag('buyer');
  const strategisInput = path.resolve(requiredFlag('strategis-input'));
  const campaignsInput = path.resolve(requiredFlag('facebook-campaigns'));
  const adsetsInput = path.resolve(requiredFlag('facebook-adsets'));
  const adsInput = path.resolve(requiredFlag('facebook-ads'));
  const outputDir = path.resolve(
    getFlag('output-dir') ||
      path.join(process.cwd(), '.local', 'strategis', 'facebook-settings-profiles', buyer.toLowerCase())
  );

  const strategisCampaigns = JSON.parse(fs.readFileSync(strategisInput, 'utf8')) as StrategisShellRow[];
  const facebookCampaigns = JSON.parse(fs.readFileSync(campaignsInput, 'utf8')) as FacebookCampaignRow[];
  const facebookAdSets = JSON.parse(fs.readFileSync(adsetsInput, 'utf8')) as FacebookAdSetRow[];
  const facebookAds = JSON.parse(fs.readFileSync(adsInput, 'utf8')) as FacebookAdRow[];

  const report = buildFacebookSettingsProfileReport({
    buyer,
    strategisCampaigns,
    facebookCampaigns,
    facebookAdSets,
    facebookAds,
  });

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outputDir, 'report.md'), renderFacebookSettingsProfileMarkdown(report));

  console.log(`[facebook-settings-profiles] Wrote ${path.join(outputDir, 'report.json')}`);
  console.log(`[facebook-settings-profiles] Wrote ${path.join(outputDir, 'report.md')}`);
  console.log(`[facebook-settings-profiles] Matched campaigns: ${report.scope.matchedCampaigns}`);
  console.log(`[facebook-settings-profiles] Matched ad sets: ${report.scope.matchedAdSets}`);
  console.log(`[facebook-settings-profiles] Selector families: ${report.selectorFamilies.length}`);
}

main().catch((err) => {
  console.error('facebook settings profile report failed:', err?.message || err);
  process.exitCode = 1;
});
