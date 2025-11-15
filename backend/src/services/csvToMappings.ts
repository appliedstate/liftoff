import fs from 'fs';
import path from 'path';

export interface ManualMapping {
  keywords: string[];
  slugs: string[];
}

/**
 * Convert CSV file with keyword,slug columns into manual mappings
 * Groups keywords by slug
 */
export function csvToManualMappings(csvPath: string): ManualMapping[] {
  const fullPath = path.isAbsolute(csvPath) 
    ? csvPath 
    : path.resolve(process.cwd(), csvPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`CSV file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    throw new Error('CSV file must have header and at least one data row');
  }

  // Parse header
  const header = parseCsvLine(lines[0]);
  const keywordIdx = header.findIndex(h => h.toLowerCase() === 'keyword');
  const slugIdx = header.findIndex(h => h.toLowerCase() === 'slug');

  if (keywordIdx === -1 || slugIdx === -1) {
    throw new Error('CSV must have "keyword" and "slug" columns');
  }

  // Group keywords by slug
  const slugToKeywords = new Map<string, Set<string>>();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const keyword = (row[keywordIdx] || '').trim().replace(/^"|"$/g, '');
    const slug = (row[slugIdx] || '').trim().replace(/^"|"$/g, '');

    if (!keyword || !slug) continue;

    if (!slugToKeywords.has(slug)) {
      slugToKeywords.set(slug, new Set());
    }
    slugToKeywords.get(slug)!.add(keyword);
  }

  // Convert to ManualMapping format
  const mappings: ManualMapping[] = Array.from(slugToKeywords.entries()).map(([slug, keywords]) => ({
    slugs: [slug],
    keywords: Array.from(keywords)
  }));

  return mappings;
}

function parseCsvLine(line: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (c === ',' && !inQ) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

