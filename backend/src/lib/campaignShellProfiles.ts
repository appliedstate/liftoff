import fs from 'fs';
import path from 'path';

export type CampaignShellExportRow = {
  id: string;
  status: number;
  body: {
    raw: {
      id: string;
      name: string;
      category?: string;
      template?: {
        id?: string;
        [key: string]: any;
      };
      redirectDomain?: string | null;
      organizations?: string[];
      properties?: Record<string, any>;
      [key: string]: any;
    };
  } | null;
};

type ValueCount = {
  value: string;
  count: number;
  pct: number;
};

export type FieldSummary = {
  field: string;
  presentCount: number;
  coveragePct: number;
  distinctValues: number;
  topValues: ValueCount[];
};

export type NamingFamily = {
  pattern: string;
  count: number;
  pct: number;
  example: string;
};

export type CategoryShellProfile = {
  category: string;
  campaignCount: number;
  dominantValues: Record<string, ValueCount | null>;
  namingFamilies: NamingFamily[];
  exampleCampaigns: string[];
};

export type ShellRecommendation = {
  autoPopulateAlways: Record<string, string>;
  defaultButOverride: Record<string, ValueCount>;
  categoryScopedFields: string[];
  buyerInputFields: string[];
  missingForFacebookShell: string[];
  notes: string[];
};

export type CampaignShellProfileReport = {
  scope: {
    buyer: string;
    campaignCount: number;
  };
  generatedAt: string;
  fields: FieldSummary[];
  namingFamilies: NamingFamily[];
  categoryProfiles: CategoryShellProfile[];
  recommendation: ShellRecommendation;
};

type NormalizedCampaign = {
  id: string;
  name: string;
  category: string;
  templateId: string;
  redirectDomain: string;
  organizations: string[];
  properties: Record<string, any>;
};

const STRATEGIS_FIELDS = [
  'buyer',
  'networkName',
  'country',
  'language',
  'rsocSite',
  'subdirectory',
  'headline',
  'article',
  'fbAdAccount',
  'networkAccountId',
  'forcekeyA',
  'forcekeyB',
  'forcekeyC',
  'forcekeyD',
  'forcekeyE',
  'forcekeyF',
  'forcekeyG',
  'forcekeyH',
  'forcekeyI',
  'forcekeyJ',
];

const FACEBOOK_SHELL_FIELDS = [
  'facebookCampaignName',
  'facebookObjective',
  'facebookPage',
  'dailyBudget',
  'optimizationGoal',
  'billingEvent',
  'bidStrategy',
  'targeting',
  'placementProfile',
  'promotedObject.pixelId',
  'promotedObject.customEventType',
];

function asString(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeCampaigns(rows: CampaignShellExportRow[]): NormalizedCampaign[] {
  return rows
    .filter((row) => row.status === 200 && row.body?.raw)
    .map((row) => {
      const raw = row.body!.raw;
      return {
        id: raw.id || row.id,
        name: raw.name || row.id,
        category: asString(raw.category) || 'Uncategorized',
        templateId: asString(raw.template?.id),
        redirectDomain: asString(raw.redirectDomain),
        organizations: Array.isArray(raw.organizations) ? raw.organizations.map((v) => asString(v)).filter(Boolean) : [],
        properties: raw.properties || {},
      };
    });
}

function countValues(campaigns: NormalizedCampaign[], getValue: (campaign: NormalizedCampaign) => string): ValueCount[] {
  const counter = new Map<string, number>();

  for (const campaign of campaigns) {
    const value = asString(getValue(campaign));
    if (!value) continue;
    counter.set(value, (counter.get(value) || 0) + 1);
  }

  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({
      value,
      count,
      pct: campaigns.length > 0 ? count / campaigns.length : 0,
    }));
}

function buildFieldSummary(campaigns: NormalizedCampaign[], field: string): FieldSummary {
  let presentCount = 0;
  const values = new Map<string, number>();

  for (const campaign of campaigns) {
    const value = asString(campaign.properties[field]);
    if (!value) continue;
    presentCount += 1;
    values.set(value, (values.get(value) || 0) + 1);
  }

  const topValues = Array.from(values.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([value, count]) => ({
      value,
      count,
      pct: presentCount > 0 ? count / presentCount : 0,
    }));

  return {
    field,
    presentCount,
    coveragePct: campaigns.length > 0 ? presentCount / campaigns.length : 0,
    distinctValues: values.size,
    topValues,
  };
}

function normalizeNamingToken(token: string): string {
  const trimmed = asString(token);
  if (!trimmed) return '';
  if (/^\d{4}$/.test(trimmed)) return '<date>';
  return trimmed;
}

function deriveNamingFamily(name: string): string {
  const parts = name.split('_').map((part) => part.trim()).filter(Boolean);
  const withoutId = parts[0]?.startsWith('si') ? parts.slice(1) : parts;
  const normalized = withoutId.map(normalizeNamingToken);
  const tags = normalized.filter((token) => {
    if (token === '<date>') return true;
    if (/^(FB|BH|SBU|KW|HB|TL|IF|WSI|TBH|PBBH|SP|COPY\d+)$/.test(token)) return true;
    if (/^Daypart\d*$/.test(token)) return true;
    if (token === 'Simp') return true;
    return false;
  });
  return tags.length > 0 ? tags.join('|') : '(unclassified)';
}

function buildNamingFamilies(campaigns: NormalizedCampaign[]): NamingFamily[] {
  const counter = new Map<string, { count: number; example: string }>();

  for (const campaign of campaigns) {
    const pattern = deriveNamingFamily(campaign.name);
    const current = counter.get(pattern);
    if (current) {
      current.count += 1;
    } else {
      counter.set(pattern, { count: 1, example: campaign.name });
    }
  }

  return Array.from(counter.entries())
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([pattern, entry]) => ({
      pattern,
      count: entry.count,
      pct: campaigns.length > 0 ? entry.count / campaigns.length : 0,
      example: entry.example,
    }));
}

function dominantValue(campaigns: NormalizedCampaign[], getValue: (campaign: NormalizedCampaign) => string): ValueCount | null {
  const values = countValues(campaigns, getValue);
  return values[0] || null;
}

function buildCategoryProfiles(campaigns: NormalizedCampaign[]): CategoryShellProfile[] {
  const grouped = new Map<string, NormalizedCampaign[]>();
  for (const campaign of campaigns) {
    const list = grouped.get(campaign.category) || [];
    list.push(campaign);
    grouped.set(campaign.category, list);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([category, items]) => ({
      category,
      campaignCount: items.length,
      dominantValues: {
        rsocSite: dominantValue(items, (campaign) => campaign.properties.rsocSite),
        subdirectory: dominantValue(items, (campaign) => campaign.properties.subdirectory),
        fbAdAccount: dominantValue(items, (campaign) => campaign.properties.fbAdAccount),
        networkAccountId: dominantValue(items, (campaign) => campaign.properties.networkAccountId),
        language: dominantValue(items, (campaign) => campaign.properties.language),
        headline: dominantValue(items, (campaign) => campaign.properties.headline),
        templateId: dominantValue(items, (campaign) => campaign.templateId),
        redirectDomain: dominantValue(items, (campaign) => campaign.redirectDomain),
      },
      namingFamilies: buildNamingFamilies(items).slice(0, 6),
      exampleCampaigns: items.slice(0, 5).map((item) => item.name),
    }));
}

function buildRecommendation(campaigns: NormalizedCampaign[], fields: FieldSummary[]): ShellRecommendation {
  const autoPopulateAlways: Record<string, string> = {};
  const defaultButOverride: Record<string, ValueCount> = {};

  for (const field of fields) {
    if (field.coveragePct === 1 && field.distinctValues === 1 && field.topValues[0]) {
      autoPopulateAlways[field.field] = field.topValues[0].value;
      continue;
    }
    if (field.coveragePct >= 0.8 && field.topValues[0] && field.topValues[0].pct >= 0.7) {
      defaultButOverride[field.field] = field.topValues[0];
    }
  }

  const organizations = countValues(campaigns, (campaign) => campaign.organizations[0] || '');
  if (organizations[0] && organizations[0].pct === 1) {
    autoPopulateAlways.organization = organizations[0].value;
  }

  return {
    autoPopulateAlways,
    defaultButOverride,
    categoryScopedFields: [
      'rsocSite',
      'subdirectory',
      'fbAdAccount',
      'networkAccountId',
      'headline',
      'article',
      'redirectDomain',
    ],
    buyerInputFields: [
      'category',
      'article',
      'headline',
      'forcekeyA-forcekeyL',
      'language',
      'facebookCreativeAssets',
      'facebookCampaignObjective',
      'facebookPage',
      'dailyBudget',
      'targetingProfile',
    ],
    missingForFacebookShell: FACEBOOK_SHELL_FIELDS,
    notes: [
      'Current Strategis campaign exports are strong enough to prefill most tracking-shell fields, but they do not contain the complete Facebook creation payload.',
      'The live Ben sample is effectively all Facebook, US, and mostly English, so those should be hard defaults rather than free-form inputs.',
      'The biggest category-scoped decisions are site/subdirectory/ad-account bundles and the forcekey/article/headline combination.',
      'Facebook page, objective, budgets, targeting, and promoted-object settings still need a dedicated source of truth or a locked profile catalog.',
    ],
  };
}

export function buildCampaignShellProfileReport(rows: CampaignShellExportRow[], buyer: string): CampaignShellProfileReport {
  const campaigns = normalizeCampaigns(rows);
  const fields = STRATEGIS_FIELDS.map((field) => buildFieldSummary(campaigns, field));
  const namingFamilies = buildNamingFamilies(campaigns);
  const categoryProfiles = buildCategoryProfiles(campaigns);
  const recommendation = buildRecommendation(campaigns, fields);

  return {
    scope: {
      buyer,
      campaignCount: campaigns.length,
    },
    generatedAt: new Date().toISOString(),
    fields,
    namingFamilies,
    categoryProfiles,
    recommendation,
  };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function renderCampaignShellProfileMarkdown(report: CampaignShellProfileReport): string {
  const lines: string[] = [];

  lines.push(`# ${report.scope.buyer} Campaign Shell Profile`);
  lines.push('');
  lines.push(`- Campaigns analyzed: ${report.scope.campaignCount}`);
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push('');

  lines.push('## Locked Defaults');
  for (const [field, value] of Object.entries(report.recommendation.autoPopulateAlways)) {
    lines.push(`- \`${field}\`: \`${value}\``);
  }
  lines.push('');

  lines.push('## Default With Override');
  for (const [field, value] of Object.entries(report.recommendation.defaultButOverride)) {
    lines.push(`- \`${field}\`: default \`${value.value}\` (${value.count}/${report.scope.campaignCount}, ${pct(value.pct)})`);
  }
  lines.push('');

  lines.push('## Buyer Input Fields');
  for (const field of report.recommendation.buyerInputFields) {
    lines.push(`- \`${field}\``);
  }
  lines.push('');

  lines.push('## Missing For Facebook Shell');
  for (const field of report.recommendation.missingForFacebookShell) {
    lines.push(`- \`${field}\``);
  }
  lines.push('');

  lines.push('## Top Naming Families');
  for (const family of report.namingFamilies.slice(0, 10)) {
    lines.push(`- \`${family.pattern}\`: ${family.count} campaigns (${pct(family.pct)}) — example \`${family.example}\``);
  }
  lines.push('');

  lines.push('## Category Profiles');
  for (const profile of report.categoryProfiles.slice(0, 12)) {
    lines.push(`### ${profile.category}`);
    lines.push(`- Campaigns: ${profile.campaignCount}`);
    for (const [field, value] of Object.entries(profile.dominantValues)) {
      if (!value) continue;
      lines.push(`- ${field}: \`${value.value}\` (${value.count}/${profile.campaignCount}, ${pct(value.pct)})`);
    }
    const family = profile.namingFamilies[0];
    if (family) {
      lines.push(`- top naming family: \`${family.pattern}\` (${family.count}/${profile.campaignCount})`);
    }
    lines.push(`- examples: ${profile.exampleCampaigns.map((example) => `\`${example}\``).join(', ')}`);
    lines.push('');
  }

  lines.push('## Notes');
  for (const note of report.recommendation.notes) {
    lines.push(`- ${note}`);
  }
  lines.push('');

  return lines.join('\n');
}

export function writeCampaignShellProfileReport(outputDir: string, report: CampaignShellProfileReport) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outputDir, 'report.md'), renderCampaignShellProfileMarkdown(report));
}
