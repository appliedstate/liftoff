import 'dotenv/config';
import { queryArticleBuyerAttribution } from '../../lib/articleBuyerAttribution';

function getFlag(name: string, fallback = ''): string {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function main() {
  const result = await queryArticleBuyerAttribution({
    organization: getFlag('organization') || null,
    domain: getFlag('domain') || null,
    articleUrl: getFlag('article-url') || null,
    articleSlug: getFlag('article-slug') || null,
    authToken: getFlag('auth-token') || process.env.STRATEGIS_AUTH_TOKEN || process.env.STRATEGIST_AUTH_TOKEN || null,
    includeSystem1Failed: getFlag('include-failed').toLowerCase() === 'true',
    maxArticlesPerDomain: Number(getFlag('max-articles-per-domain') || 100),
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
