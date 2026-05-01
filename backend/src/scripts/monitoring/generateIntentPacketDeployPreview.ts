import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { buildIntentPacketDeployPreview } from '../../lib/intentPacketDeploy';

async function main() {
  const outputDir = path.resolve(process.cwd(), '.local/strategis/facebook/intent-packet-deploy-preview');
  const preview = buildIntentPacketDeployPreview(
    {
      primaryKeyword: 'auto insurance quotes',
      supportingKeywords: [
        'free auto insurance quote',
        'compare auto insurance quotes',
        'cheap car insurance near me',
      ],
      rsocSite: 'wesoughtit.com',
      buyer: 'Cook',
      market: 'US',
      keywordEvidence: [
        { keyword: 'free auto insurance quote', rpc: 1.93, clicks: 120, revenue: 231.6 },
        { keyword: 'compare auto insurance quotes', rpc: 1.77, clicks: 95, revenue: 168.15 },
      ],
    },
    {
      deployMode: 'packet_new_campaign',
      creativeMode: 'link',
      organization: 'Interlincx',
      buyer: 'Edge',
      sourceBuyer: 'Cook',
      category: 'Finance > Insurance > Car',
      adAccountId: 'act_1128468608576096',
      domain: 'wesoughtit.com',
      destination: 'S1',
      strategisTemplateId: 'template-preview',
      fbPage: '233217303206930',
      rsocSite: 'wesoughtit.com',
    }
  );

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'preview.json'), `${JSON.stringify(preview, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
