import fs from 'fs';
import path from 'path';

export type UrlMapping = {
  // Optional per-page mapping
  pages?: Record<string, { keywordsFromParams?: string[]; keywordsFromPath?: string[] }>;
  // Global patterns
  global?: { keywordsFromParams?: string[]; keywordsFromPath?: string[] };
};

let cached: UrlMapping | null = null;

export function loadUrlMapping(mappingPath?: string): UrlMapping {
  if (cached) return cached;
  const file = mappingPath || path.resolve(process.cwd(), 'url-mapping.json');
  if (!fs.existsSync(file)) return (cached = { global: {} });
  const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as UrlMapping;
  cached = data;
  return data;
}

export function extractKeywordsFromUrl(linkUrl?: string, pageId?: string, mapping?: UrlMapping): string[] {
  if (!linkUrl) return [];
  try {
    const m = mapping || loadUrlMapping();
    const url = new URL(linkUrl);
    const paramsKeywords = new Set<string>();
    const pathKeywords = new Set<string>();

    const pageCfg = (pageId && m.pages && m.pages[pageId]) ? m.pages[pageId] : undefined;
    const paramsList = [ ...(m.global?.keywordsFromParams || []), ...(pageCfg?.keywordsFromParams || []) ];
    const pathList = [ ...(m.global?.keywordsFromPath || []), ...(pageCfg?.keywordsFromPath || []) ];

    for (const key of paramsList) {
      const v = url.searchParams.get(key);
      if (v) paramsKeywords.add(v);
    }
    const pathParts = url.pathname.split('/').filter(Boolean);
    for (const key of pathList) {
      for (const part of pathParts) {
        if (part.toLowerCase().includes(key.toLowerCase())) pathKeywords.add(part);
      }
    }
    return Array.from(new Set([ ...paramsKeywords, ...pathKeywords ]));
  } catch {
    return [];
  }
}


