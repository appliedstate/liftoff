import fs from 'fs';
import path from 'path';
import {
  CampaignShellProfileReport,
  NamingFamily,
  ValueCount as CampaignValueCount,
} from './campaignShellProfilesCompat';
import {
  FacebookSettingsProfileReport,
  ValueCount as FacebookValueCount,
} from './facebookSettingsProfilesCompat';

type SelectorTargeting = {
  ageMin: number | null;
  ageMax: number | null;
  countries: string[];
  locationTypes: string[];
  publisherPlatforms: string[];
  facebookPositions: string[];
  instagramPositions: string[];
  advantageAudience: number | null;
};

type ParsedSelector = {
  optimizationGoal: string;
  billingEvent: string;
  bidStrategy: string;
  bidAmount: string | number;
  promotedObject: {
    pixelId: string;
    event: string;
  };
  targeting: SelectorTargeting;
};

type CatalogField<T = string> = {
  value: T;
  support: {
    count: number;
    pct: number;
  };
};

type SelectorOption = {
  label: string;
  support: {
    count: number;
    pct: number;
  };
  selector: ParsedSelector;
  sampleCampaignIds: string[];
};

export type BenShellSelectorCatalogProfile = {
  profileId: string;
  label: string;
  category: string;
  strategist: {
    rsocSite: CatalogField | null;
    subdirectory: CatalogField | null;
    fbAdAccount: CatalogField | null;
    networkAccountId: CatalogField | null;
    language: CatalogField | null;
    headline: CatalogField | null;
    templateId: CatalogField | null;
    redirectDomain: CatalogField | null;
    namingFamily: CatalogField | null;
  };
  facebook: {
    adAccountId: CatalogField | null;
    pixelId: CatalogField | null;
    pageId: CatalogField | null;
    locked: {
      optimizationGoal: string;
      billingEvent: string;
      customEventType: string;
    };
    primarySelector: SelectorOption | null;
    alternateSelectors: SelectorOption[];
  };
  workflow: {
    lockedInputs: string[];
    buyerInputs: string[];
    optionalOverrides: string[];
  };
  notes: string[];
};

export type BenShellSelectorCatalog = {
  scope: {
    buyer: string;
    strategistCampaigns: number;
    matchedFacebookCampaigns: number;
    matchedFacebookAdSets: number;
    matchedFacebookAds: number;
  };
  generatedAt: string;
  lockedDefaults: Record<string, string>;
  namingFamilies: NamingFamily[];
  selectorFamilies: string[];
  manualFields: string[];
  profiles: BenShellSelectorCatalogProfile[];
  notes: string[];
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseSelectorKey(input: string): ParsedSelector | null {
  try {
    return JSON.parse(input) as ParsedSelector;
  } catch {
    return null;
  }
}

function toCatalogField(
  value: CampaignValueCount | FacebookValueCount | null | undefined
): CatalogField | null {
  if (!value) return null;
  return {
    value: value.value,
    support: {
      count: value.count,
      pct: value.pct,
    },
  };
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function selectorLabel(selector: ParsedSelector): string {
  const countries = selector.targeting.countries.length > 0 ? selector.targeting.countries.join('+') : 'open-country';
  const age =
    selector.targeting.ageMin !== null && selector.targeting.ageMax !== null
      ? `${selector.targeting.ageMin}-${selector.targeting.ageMax}`
      : 'open-age';
  const aa =
    selector.targeting.advantageAudience === 1
      ? 'AA on'
      : selector.targeting.advantageAudience === 0
        ? 'AA off'
        : 'AA unknown';
  const placements =
    selector.targeting.publisherPlatforms.length > 0 ||
    selector.targeting.facebookPositions.length > 0 ||
    selector.targeting.instagramPositions.length > 0
      ? 'manual placements'
      : 'auto placements';
  const bid = selector.bidStrategy
    ? selector.bidAmount
      ? `${selector.bidStrategy} @ ${selector.bidAmount}`
      : selector.bidStrategy
    : 'default bid';
  return `${age} / ${countries} / ${aa} / ${placements} / ${bid}`;
}

function selectorOption(family: {
  key: string;
  count: number;
  pct: number;
  sampleCampaignIds: string[];
}): SelectorOption | null {
  const parsed = parseSelectorKey(family.key);
  if (!parsed) return null;
  return {
    label: selectorLabel(parsed),
    support: {
      count: family.count,
      pct: family.pct,
    },
    selector: parsed,
    sampleCampaignIds: family.sampleCampaignIds,
  };
}

function addConfidenceNotes(
  notes: string[],
  field: string,
  value: CatalogField | null,
  threshold: number
) {
  if (!value) {
    notes.push(`${field} needs manual selection because no dominant value was observed.`);
    return;
  }
  if (value.support.pct < threshold) {
    notes.push(
      `${field} is only moderately stable (${formatPct(value.support.pct)} support), so it should stay overridable.`
    );
  }
}

export function buildBenShellSelectorCatalog(args: {
  shellReport: CampaignShellProfileReport;
  facebookReport: FacebookSettingsProfileReport;
}): BenShellSelectorCatalog {
  const shellByCategory = new Map(args.shellReport.categoryProfiles.map((profile) => [profile.category, profile]));
  const facebookByCategory = new Map(args.facebookReport.categoryProfiles.map((profile) => [profile.category, profile]));
  const categories = Array.from(new Set([...shellByCategory.keys(), ...facebookByCategory.keys()])).sort();

  const lockedDefaults: Record<string, string> = {
    ...args.shellReport.recommendation.autoPopulateAlways,
  };

  const languageDefault = args.shellReport.recommendation.defaultButOverride.language;
  if (languageDefault && !lockedDefaults.language) {
    lockedDefaults.language = languageDefault.value;
  }

  const profiles = categories
    .map((category) => {
      const shell = shellByCategory.get(category) || null;
      const facebook = facebookByCategory.get(category) || null;
      const notes: string[] = [];

      const namingFamily = shell?.namingFamilies?.[0]
        ? {
            value: shell.namingFamilies[0].pattern,
            support: {
              count: shell.namingFamilies[0].count,
              pct: shell.namingFamilies[0].pct,
            },
          }
        : null;

      const primarySelector = facebook?.selectorFamilies?.[0]
        ? selectorOption(facebook.selectorFamilies[0])
        : null;
      const alternateSelectors = (facebook?.selectorFamilies || [])
        .slice(1, 4)
        .map(selectorOption)
        .filter((value): value is SelectorOption => value !== null);

      const profile: BenShellSelectorCatalogProfile = {
        profileId: slugify(category),
        label: category.split(' > ').slice(-1)[0] || category,
        category,
        strategist: {
          rsocSite: toCatalogField(shell?.dominantValues.rsocSite),
          subdirectory: toCatalogField(shell?.dominantValues.subdirectory),
          fbAdAccount: toCatalogField(shell?.dominantValues.fbAdAccount),
          networkAccountId: toCatalogField(shell?.dominantValues.networkAccountId),
          language: toCatalogField(shell?.dominantValues.language),
          headline: toCatalogField(shell?.dominantValues.headline),
          templateId: toCatalogField(shell?.dominantValues.templateId),
          redirectDomain: toCatalogField(shell?.dominantValues.redirectDomain),
          namingFamily,
        },
        facebook: {
          adAccountId: toCatalogField(facebook?.dominantAccountId),
          pixelId: toCatalogField(facebook?.dominantPixelId),
          pageId: toCatalogField(facebook?.dominantPageId),
          locked: {
            optimizationGoal: 'OFFSITE_CONVERSIONS',
            billingEvent: 'IMPRESSIONS',
            customEventType: 'LEAD',
          },
          primarySelector,
          alternateSelectors,
        },
        workflow: {
          lockedInputs: [
            'buyer',
            'networkName',
            'country',
            'organization',
            'optimizationGoal',
            'billingEvent',
            'customEventType',
          ],
          buyerInputs: [
            'article',
            'headline',
            'forcekeyA-forcekeyL',
            'creativeAssets',
          ],
          optionalOverrides: [
            'language',
            'redirectDomain',
            'pageId',
            'adAccountId',
            'budgetAmount',
            'bidCap',
            'selectorVariant',
          ],
        },
        notes,
      };

      addConfidenceNotes(notes, 'rsocSite', profile.strategist.rsocSite, 0.7);
      addConfidenceNotes(notes, 'templateId', profile.strategist.templateId, 0.7);
      addConfidenceNotes(notes, 'redirectDomain', profile.strategist.redirectDomain, 0.7);
      addConfidenceNotes(notes, 'Facebook ad account', profile.facebook.adAccountId, 0.7);
      addConfidenceNotes(notes, 'Facebook page', profile.facebook.pageId, 0.7);

      if (primarySelector) {
        if (primarySelector.support.pct < 0.2) {
          notes.push(
            `Top Facebook selector family is fragmented (${formatPct(primarySelector.support.pct)} of matched ad sets), so Ben should be able to pick from alternates.`
          );
        }
      } else {
        notes.push('No Facebook selector family was resolved for this category, so targeting must remain manual.');
      }

      return profile;
    })
    .sort((a, b) => a.category.localeCompare(b.category));

  return {
    scope: {
      buyer: args.shellReport.scope.buyer,
      strategistCampaigns: args.shellReport.scope.campaignCount,
      matchedFacebookCampaigns: args.facebookReport.scope.matchedCampaigns,
      matchedFacebookAdSets: args.facebookReport.scope.matchedAdSets,
      matchedFacebookAds: args.facebookReport.scope.matchedAds,
    },
    generatedAt: new Date().toISOString(),
    lockedDefaults,
    namingFamilies: args.shellReport.namingFamilies.slice(0, 10),
    selectorFamilies: args.facebookReport.recommendations.profileSelectors,
    manualFields: [
      'article',
      'headline',
      'forcekeyA-forcekeyL',
      'creative upload',
      'budget amount',
      'bid cap decision',
    ],
    profiles,
    notes: [
      'This catalog is intended to drive a Ben-specific campaign shell wizard where most fields are preset from prior launches.',
      'Strategis-side defaults should come from category profiles, while Facebook-side defaults should come from repeated ad set selector families.',
      'Facebook objective is still not modeled cleanly from the current campaign endpoint, so the selector catalog anchors on ad set settings rather than campaign objective.',
    ],
  };
}

export function renderBenShellSelectorCatalogMarkdown(catalog: BenShellSelectorCatalog): string {
  const lines: string[] = [];
  lines.push(`# ${catalog.scope.buyer} Shell Selector Catalog`);
  lines.push('');
  lines.push(`- Strategis campaigns analyzed: ${catalog.scope.strategistCampaigns}`);
  lines.push(`- Matched Facebook campaigns: ${catalog.scope.matchedFacebookCampaigns}`);
  lines.push(`- Matched Facebook ad sets: ${catalog.scope.matchedFacebookAdSets}`);
  lines.push(`- Matched Facebook ads: ${catalog.scope.matchedFacebookAds}`);
  lines.push(`- Generated at: ${catalog.generatedAt}`);
  lines.push('');

  lines.push('## Locked Defaults');
  for (const [field, value] of Object.entries(catalog.lockedDefaults)) {
    lines.push(`- ${field}: \`${value}\``);
  }
  lines.push('');

  lines.push('## Manual Fields');
  for (const field of catalog.manualFields) {
    lines.push(`- ${field}`);
  }
  lines.push('');

  lines.push('## Category Presets');
  for (const profile of catalog.profiles) {
    lines.push(`### ${profile.category}`);
    lines.push(`- profile id: \`${profile.profileId}\``);
    if (profile.strategist.rsocSite) {
      lines.push(
        `- rsocSite: \`${profile.strategist.rsocSite.value}\` (${profile.strategist.rsocSite.support.count}, ${formatPct(profile.strategist.rsocSite.support.pct)})`
      );
    }
    if (profile.strategist.subdirectory) {
      lines.push(
        `- subdirectory: \`${profile.strategist.subdirectory.value}\` (${profile.strategist.subdirectory.support.count}, ${formatPct(profile.strategist.subdirectory.support.pct)})`
      );
    }
    if (profile.strategist.templateId) {
      lines.push(
        `- templateId: \`${profile.strategist.templateId.value}\` (${profile.strategist.templateId.support.count}, ${formatPct(profile.strategist.templateId.support.pct)})`
      );
    }
    if (profile.strategist.redirectDomain) {
      lines.push(
        `- redirectDomain: \`${profile.strategist.redirectDomain.value}\` (${profile.strategist.redirectDomain.support.count}, ${formatPct(profile.strategist.redirectDomain.support.pct)})`
      );
    }
    if (profile.facebook.adAccountId) {
      lines.push(
        `- facebook ad account: \`${profile.facebook.adAccountId.value}\` (${profile.facebook.adAccountId.support.count}, ${formatPct(profile.facebook.adAccountId.support.pct)})`
      );
    }
    if (profile.facebook.pageId) {
      lines.push(
        `- facebook page id: \`${profile.facebook.pageId.value}\` (${profile.facebook.pageId.support.count}, ${formatPct(profile.facebook.pageId.support.pct)})`
      );
    }
    if (profile.facebook.primarySelector) {
      lines.push(
        `- primary selector: ${profile.facebook.primarySelector.label} (${profile.facebook.primarySelector.support.count}, ${formatPct(profile.facebook.primarySelector.support.pct)})`
      );
    }
    if (profile.strategist.namingFamily) {
      lines.push(
        `- naming family: \`${profile.strategist.namingFamily.value}\` (${profile.strategist.namingFamily.support.count}, ${formatPct(profile.strategist.namingFamily.support.pct)})`
      );
    }
    if (profile.notes.length > 0) {
      lines.push(`- notes: ${profile.notes.join(' ')}`);
    }
    lines.push('');
  }

  lines.push('## Notes');
  for (const note of catalog.notes) {
    lines.push(`- ${note}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function writeBenShellSelectorCatalog(outputDir: string, catalog: BenShellSelectorCatalog) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'catalog.json'), JSON.stringify(catalog, null, 2));
  fs.writeFileSync(path.join(outputDir, 'catalog.md'), renderBenShellSelectorCatalogMarkdown(catalog));
}
