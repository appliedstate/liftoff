import path from 'path';
import { loadBenArticleCatalogFromSnapshot, writeBenArticleCatalog } from '../../lib/benArticleCatalog';

function getFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return null;
}

async function main() {
  const buyer = getFlag('buyer') || 'Ben';
  const outputDir = path.resolve(
    getFlag('output-dir') ||
      path.join(process.cwd(), '.local', 'strategis', 'ben-article-catalog', `${buyer.toLowerCase()}-live`)
  );
  const catalog = loadBenArticleCatalogFromSnapshot(buyer);
  writeBenArticleCatalog(outputDir, catalog);
  console.log(`[ben-article-catalog] Wrote ${path.join(outputDir, 'catalog.json')}`);
  console.log(`[ben-article-catalog] Articles: ${catalog.scope.articles}`);
}

main().catch((err) => {
  console.error('ben article catalog failed:', err?.message || err);
  process.exitCode = 1;
});
