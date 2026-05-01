import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { buildIntentPacketLaunchPreview } from '../../lib/intentPacketLaunch';

async function main() {
  const outputDir = path.resolve(process.cwd(), '.local/strategis/facebook/intent-packet-launch-preview');
  const preview = buildIntentPacketLaunchPreview(
    {
      primaryKeyword: 'gold ira kits',
      supportingKeywords: ['best gold ira kits', 'investing in gold ira', 'gold retirement options'],
      rsocSite: 'wesoughtit.com',
      buyer: 'ben',
      market: 'US',
      keywordEvidence: [
        { keyword: 'gold ira kits', rpc: 2.1, clicks: 80, revenue: 168 },
        { keyword: 'best gold ira kits', rpc: 1.8, clicks: 55, revenue: 99 },
      ],
    },
    {
      brand: 'Edge',
      sourceBuyer: 'ben',
      adAccountId: 'act_1580328626119374',
      organization: 'Interlincx',
      domain: 'wesoughtit.com',
      destination: 'S1',
      strategisTemplateId: 'template-preview',
      fbPage: 'Hidden Bonus: Retirement Life',
    }
  );

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'preview.json'), `${JSON.stringify(preview, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
