import 'dotenv/config';
import { resolveFinalUrl } from '../lib/urlResolve';
import { extractForcekeys } from '../lib/forcekeys';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: ts-node src/scripts/debugForcekeys.ts <url>');
    process.exit(1);
  }
  const finalUrl = await resolveFinalUrl(url);
  const fks = extractForcekeys(finalUrl);
  console.log(JSON.stringify({ input_url: url, final_url: finalUrl, forcekeys: fks }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });


