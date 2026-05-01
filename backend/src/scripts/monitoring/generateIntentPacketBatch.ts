import fs from 'fs';
import path from 'path';
import { generateIntentPacketBatch, IntentPacketInput } from '../../lib/intentPacket';

type Args = {
  outputDir: string;
  rsocSite: string | null;
  market: string;
  buyer: string | null;
  vertical: string | null;
  packets: IntentPacketInput[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    outputDir: path.resolve(process.cwd(), '.local/strategis/facebook/intent-packets'),
    rsocSite: null,
    market: 'US',
    buyer: null,
    vertical: null,
    packets: [],
  };

  for (const raw of argv) {
    const [flag, value = ''] = raw.split('=');
    if (flag === '--output-dir' && value) args.outputDir = path.resolve(process.cwd(), value);
    if (flag === '--rsoc-site' && value) args.rsocSite = value;
    if (flag === '--market' && value) args.market = value;
    if (flag === '--buyer' && value) args.buyer = value;
    if (flag === '--vertical' && value) args.vertical = value;
    if (flag === '--packet' && value) {
      const [primaryKeyword, ...rest] = value.split('|').map((part) => part.trim()).filter(Boolean);
      if (primaryKeyword) {
        args.packets.push({
          primaryKeyword,
          supportingKeywords: rest,
          rsocSite: args.rsocSite,
          market: args.market,
          buyer: args.buyer,
          vertical: (args.vertical as any) || undefined,
        });
      }
    }
  }

  if (!args.packets.length) {
    args.packets = [
      {
        primaryKeyword: 'gold ira kits',
        supportingKeywords: ['best gold ira kits', 'investing in gold ira', 'gold retirement options'],
        rsocSite: args.rsocSite,
        market: args.market,
        buyer: args.buyer,
        vertical: (args.vertical as any) || undefined,
      },
      {
        primaryKeyword: 'dental implant trials',
        supportingKeywords: ['participants needed for dental implant studies', 'compare dental implant options'],
        rsocSite: args.rsocSite,
        market: args.market,
        buyer: args.buyer,
        vertical: (args.vertical as any) || undefined,
      },
      {
        primaryKeyword: 'free phones for seniors',
        supportingKeywords: ['best no cost phone plans', 'senior phone options'],
        rsocSite: args.rsocSite,
        market: args.market,
        buyer: args.buyer,
        vertical: (args.vertical as any) || undefined,
      },
    ];
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = generateIntentPacketBatch(args.packets);
  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.writeFileSync(path.join(args.outputDir, 'batch.json'), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(args.outputDir, 'summary.json'), `${JSON.stringify(result.summary, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
