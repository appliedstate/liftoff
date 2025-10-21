import fs from 'fs';
import path from 'path';

function readHooks(file: string): string[] {
  const p = path.resolve(file);
  const txt = fs.readFileSync(p, 'utf-8').split(/\r?\n/);
  const out: string[] = [];
  for (let i = 1; i < txt.length; i++) {
    const line = txt[i];
    if (!line) continue;
    // naive CSV split for first column
    const firstComma = line.indexOf(',');
    const hook = firstComma >= 0 ? line.slice(0, firstComma) : line;
    const cleaned = hook.replace(/^"|"$/g, '');
    if (cleaned.trim()) out.push(cleaned.trim());
  }
  return out;
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[[^\]]*\]|\{[^}]*\}/g, ' ') // remove placeholders like [city]
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const inter = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return inter.size / union.size;
}

function main() {
  const [,, hooksAPath, hooksBPath, thresholdArg] = process.argv;
  if (!hooksAPath || !hooksBPath) {
    console.error('Usage: ts-node src/scripts/compareHooks.ts <hooksA.csv> <hooksB.csv> [threshold=0.6]');
    process.exit(1);
  }
  const threshold = Number(thresholdArg ?? '0.6');
  const hooksA = readHooks(hooksAPath);
  const hooksB = readHooks(hooksBPath);
  const normA = hooksA.map(h => ({ raw: h, tokens: normalize(h) }));
  const normB = hooksB.map(h => ({ raw: h, tokens: normalize(h) }));

  const exact = new Set(hooksA).has.bind(new Set(hooksA));
  const exactOverlaps = hooksB.filter(h => exact(h));

  const near: { a: string; b: string; score: number }[] = [];
  for (const a of normA) {
    for (const b of normB) {
      const score = jaccard(a.tokens, b.tokens);
      if (score >= threshold && a.raw !== b.raw) near.push({ a: a.raw, b: b.raw, score });
    }
  }
  near.sort((x, y) => y.score - x.score);

  const result = {
    counts: { hooksA: hooksA.length, hooksB: hooksB.length, exactOverlaps: exactOverlaps.length, nearMatches: near.length },
    exactOverlaps,
    topNearMatches: near.slice(0, 20)
  };
  console.log(JSON.stringify(result, null, 2));
}

main();


