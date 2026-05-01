import fs from 'fs';
import path from 'path';
import { warmS1KeywordCache } from '../../lib/s1Keywords';

type Args = {
  start: string;
  end: string;
  forceRefresh: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    start: '',
    end: '',
    forceRefresh: false,
  };

  for (const part of argv) {
    if (part.startsWith('--start=')) args.start = part.split('=')[1];
    else if (part.startsWith('--end=')) args.end = part.split('=')[1];
    else if (part === '--force-refresh=true' || part === '--forceRefresh=true') args.forceRefresh = true;
  }

  if (!args.start || !args.end) {
    throw new Error('Provide --start=YYYY-MM-DD and --end=YYYY-MM-DD');
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await warmS1KeywordCache(args.start, args.end, {
    forceRefresh: args.forceRefresh,
    includeDesktop: true,
  });

  const outputDir = path.resolve(process.cwd(), '.local/strategis/s1/keywords');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'warm-summary.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
