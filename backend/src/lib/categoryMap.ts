export function normalizeCategory(raw: string): string {
  const s = (raw || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) return 'UNKNOWN';
  const map: Record<string, string> = {
    'DENTAL': 'DENTAL_IMPLANTS',
    'DENTAL_IMPLANT': 'DENTAL_IMPLANTS',
    'DENTAL_IMPLANTS': 'DENTAL_IMPLANTS',
    'HEARING': 'HEARING_AIDS',
    'HEARING_AID': 'HEARING_AIDS',
    'HEARING_AIDS': 'HEARING_AIDS',
    'SOLAR': 'SOLAR',
    'AUTO_WARRANTY': 'AUTO_WARRANTY',
    'MEDICARE': 'MEDICARE',
    'HOUSING': 'HOUSING',
    'UNKNOWN': 'UNKNOWN'
  };
  return map[s] || s;
}

export function normalizeCategories(list?: string[]): string[] {
  if (!Array.isArray(list) || list.length === 0) return ['UNKNOWN'];
  const out = new Set<string>();
  for (const c of list) out.add(normalizeCategory(c));
  return Array.from(out);
}

// Very simple keyword → category mapping to backstop missing categories
const KEYWORD_TO_CATEGORY: Array<{pattern: RegExp; category: string}> = [
  { pattern: /DENTAL\s+IMPLANT/i, category: 'DENTAL_IMPLANTS' },
  { pattern: /DENTAL/i, category: 'DENTAL_IMPLANTS' },
  { pattern: /HEARING\s+AID/i, category: 'HEARING_AIDS' },
  { pattern: /HEARING/i, category: 'HEARING_AIDS' },
  { pattern: /SOLAR/i, category: 'SOLAR' },
  { pattern: /MEDICARE/i, category: 'MEDICARE' },
  { pattern: /AUTO\s+WARRANTY/i, category: 'AUTO_WARRANTY' },
  { pattern: /WARRANTY/i, category: 'AUTO_WARRANTY' },
  { pattern: /HOUSING|APARTMENT|RENT|HOME\s+LOAN|MORTGAGE/i, category: 'HOUSING' }
];

export function inferCategoriesFromText(text: string): string[] {
  const found = new Set<string>();
  for (const { pattern, category } of KEYWORD_TO_CATEGORY) {
    if (pattern.test(text)) found.add(category);
  }
  if (found.size === 0) return ['UNKNOWN'];
  return Array.from(found);
}



