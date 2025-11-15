import { vectorSearch } from './search';

function getArg(name: string, def?: string): string | undefined {
  const flag = `--${name}=`;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(flag)) return a.substring(flag.length);
  }
  return def;
}

async function main() {
  const q = getArg('q');
  const k = getArg('k');
  const angle = getArg('angle');
  const category = getArg('category');
  const runDate = getArg('runDate');
  const minRevenue = getArg('minRevenue');
  if (!q) {
    console.error('Usage: ts-node src/scripts/vector/test_search.ts --q "nissan rogue lease" [--k 100] [--runDate YYYY-MM-DD]');
    process.exit(1);
  }
  const res = await vectorSearch({
    q,
    k: k ? parseInt(k, 10) : 100,
    angle: angle || undefined,
    category: category || undefined,
    runDate: runDate || undefined,
    minRevenue: minRevenue ? Number(minRevenue) : undefined,
  });
  console.log(JSON.stringify(res, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});


