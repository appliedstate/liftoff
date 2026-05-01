export type StrategisShellRow = {
  id: string;
  status: number;
  body: {
    raw: {
      id: string;
      name: string;
      category?: string;
      properties?: Record<string, any>;
    };
  } | null;
};

export type FacebookCampaignRow = Record<string, any>;
export type FacebookAdSetRow = Record<string, any>;
export type FacebookAdRow = Record<string, any>;

type ValueCount = {
  value: string;
  count: number;
  pct: number;
};

type SelectorFamily = {
  key: string;
  count: number;
  pct: number;
  sampleCampaignIds: string[];
};

type CategorySelectorProfile = {
  category: string;
  campaignCount: number;
  dominantAccountId: ValueCount | null;
  dominantPixelId: ValueCount | null;
  dominantPageId: ValueCount | null;
  selectorFamilies: SelectorFamily[];
};

export type FacebookSettingsProfileReport = {
  scope: {
    buyer: string;
    matchedCampaigns: number;
    matchedAdSets: number;
    matchedAds: number;
  };
  generatedAt: string;
  campaignFields: Record<string, ValueCount[]>;
  adSetFields: Record<string, ValueCount[]>;
  selectorFamilies: SelectorFamily[];
  categoryProfiles: CategorySelectorProfile[];
  recommendations: {
    lockedSelectors: string[];
    profileSelectors: string[];
    manualFields: string[];
    notes: string[];
  };
};

type MatchedCampaign = {
  strategisId: string;
  strategisName: string;
  category: string;
  facebookCampaign: FacebookCampaignRow;
};

function asString(value: unknown): string {
  return String(value ?? '').trim();
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function countValues<T>(rows: T[], getValue: (row: T) => string): ValueCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = asString(getValue(row));
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({
      value,
      count,
      pct: rows.length > 0 ? count / rows.length : 0,
    }));
}

function simplifyTargeting(targeting: Record<string, any> | null | undefined) {
  const t = targeting || {};
  const geo = t.geo_locations || {};
  const automation = t.targeting_automation || {};
  return {
    ageMin: t.age_min ?? null,
    ageMax: t.age_max ?? null,
    countries: Array.isArray(geo.countries) ? geo.countries : [],
    locationTypes: Array.isArray(geo.location_types) ? geo.location_types : [],
    publisherPlatforms: Array.isArray(t.publisher_platforms) ? t.publisher_platforms : [],
    facebookPositions: Array.isArray(t.facebook_positions) ? t.facebook_positions : [],
    instagramPositions: Array.isArray(t.instagram_positions) ? t.instagram_positions : [],
    advantageAudience: automation.advantage_audience ?? null,
  };
}

function buildSelectorKey(adset: FacebookAdSetRow): string {
  const targeting = simplifyTargeting(adset.targeting);
  const promoted = adset.promoted_object || {};
  return stableStringify({
    optimizationGoal: adset.optimization_goal || '',
    billingEvent: adset.billing_event || '',
    bidStrategy: adset.bid_strategy || '',
    bidAmount: adset.bid_amount || '',
    targeting,
    promotedObject: {
      pixelId: promoted.pixel_id || '',
      event: promoted.custom_event_type || '',
    },
  });
}

function sampleCampaignIds(ids: string[]): string[] {
  return Array.from(new Set(ids)).sort().slice(0, 5);
}

export function buildFacebookSettingsProfileReport(args: {
  buyer: string;
  strategisCampaigns: StrategisShellRow[];
  facebookCampaigns: FacebookCampaignRow[];
  facebookAdSets: FacebookAdSetRow[];
  facebookAds: FacebookAdRow[];
}): FacebookSettingsProfileReport {
  const strategisRows = args.strategisCampaigns
    .filter((row) => row.status === 200 && row.body?.raw)
    .map((row) => row.body!.raw);

  const strategisById = new Map(
    strategisRows.map((row) => [row.id, { id: row.id, name: row.name, category: asString(row.category) || 'Uncategorized' }])
  );
  const strategisNames = new Map(strategisRows.map((row) => [row.name, row.id]));

  const matchedCampaigns: MatchedCampaign[] = [];
  for (const campaign of args.facebookCampaigns) {
    const name = asString(campaign.name);
    const prefix = name.split('_', 1)[0];
    const strategisId = strategisById.has(prefix) ? prefix : strategisNames.get(name);
    if (!strategisId) continue;
    const base = strategisById.get(strategisId)!;
    matchedCampaigns.push({
      strategisId,
      strategisName: base.name,
      category: base.category,
      facebookCampaign: campaign,
    });
  }

  const matchedCampaignIds = new Set(matchedCampaigns.map((row) => asString(row.facebookCampaign.id)));
  const matchedCampaignMeta = new Map(matchedCampaigns.map((row) => [asString(row.facebookCampaign.id), row]));

  const matchedAdSets = args.facebookAdSets.filter((row) => matchedCampaignIds.has(asString(row.campaign_id)));
  const matchedAdSetIds = new Set(matchedAdSets.map((row) => asString(row.id)));
  const matchedAds = args.facebookAds.filter(
    (row) => matchedCampaignIds.has(asString(row.campaign_id)) || matchedAdSetIds.has(asString(row.adset_id))
  );

  const campaignFields = {
    account_id: countValues(matchedCampaigns, (row) => row.facebookCampaign.account_id),
    status: countValues(matchedCampaigns, (row) => row.facebookCampaign.status),
    daily_budget: countValues(matchedCampaigns, (row) => row.facebookCampaign.daily_budget),
    bid_strategy: countValues(matchedCampaigns, (row) => row.facebookCampaign.bid_strategy),
  };

  const adSetFields = {
    status: countValues(matchedAdSets, (row) => row.status),
    effective_status: countValues(matchedAdSets, (row) => row.effective_status),
    daily_budget: countValues(matchedAdSets, (row) => row.daily_budget),
    optimization_goal: countValues(matchedAdSets, (row) => row.optimization_goal),
    billing_event: countValues(matchedAdSets, (row) => row.billing_event),
    bid_strategy: countValues(matchedAdSets, (row) => row.bid_strategy),
    bid_amount: countValues(matchedAdSets, (row) => row.bid_amount),
    pixel_id: countValues(matchedAdSets, (row) => row.promoted_object?.pixel_id),
    custom_event_type: countValues(matchedAdSets, (row) => row.promoted_object?.custom_event_type),
    age_range: countValues(matchedAdSets, (row) => {
      const t = row.targeting || {};
      return `${t.age_min ?? ''}-${t.age_max ?? ''}`;
    }),
    geo_signature: countValues(matchedAdSets, (row) => {
      const t = simplifyTargeting(row.targeting);
      return stableStringify({ countries: t.countries, locationTypes: t.locationTypes });
    }),
    publisher_platforms: countValues(matchedAdSets, (row) => stableStringify(simplifyTargeting(row.targeting).publisherPlatforms)),
    facebook_positions: countValues(matchedAdSets, (row) => stableStringify(simplifyTargeting(row.targeting).facebookPositions)),
    instagram_positions: countValues(matchedAdSets, (row) => stableStringify(simplifyTargeting(row.targeting).instagramPositions)),
    advantage_audience: countValues(matchedAdSets, (row) => String(simplifyTargeting(row.targeting).advantageAudience)),
  };

  const selectorCounts = new Map<string, { count: number; campaignIds: string[] }>();
  for (const adset of matchedAdSets) {
    const key = buildSelectorKey(adset);
    const existing = selectorCounts.get(key) || { count: 0, campaignIds: [] };
    existing.count += 1;
    existing.campaignIds.push(asString(adset.campaign_id));
    selectorCounts.set(key, existing);
  }
  const selectorFamilies = Array.from(selectorCounts.entries())
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([key, value]) => ({
      key,
      count: value.count,
      pct: matchedAdSets.length > 0 ? value.count / matchedAdSets.length : 0,
      sampleCampaignIds: sampleCampaignIds(value.campaignIds),
    }));

  const pageIdsByCampaign = new Map<string, string[]>();
  for (const ad of matchedAds) {
    const creative = ad.creative || {};
    const spec = creative.object_story_spec || {};
    const pageId =
      spec.page_id ||
      spec.video_data?.page_id ||
      spec.link_data?.page_id ||
      null;
    if (!pageId) continue;
    const campaignId = asString(ad.campaign_id);
    const current = pageIdsByCampaign.get(campaignId) || [];
    current.push(asString(pageId));
    pageIdsByCampaign.set(campaignId, current);
  }

  const groupedAdSets = new Map<string, FacebookAdSetRow[]>();
  for (const adset of matchedAdSets) {
    const meta = matchedCampaignMeta.get(asString(adset.campaign_id));
    if (!meta) continue;
    const current = groupedAdSets.get(meta.category) || [];
    current.push(adset);
    groupedAdSets.set(meta.category, current);
  }

  const categoryProfiles = Array.from(groupedAdSets.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([category, adsets]) => {
      const campaignIds = Array.from(new Set(adsets.map((row) => asString(row.campaign_id))));
      const pages: string[] = [];
      for (const campaignId of campaignIds) {
        pages.push(...(pageIdsByCampaign.get(campaignId) || []));
      }
      const localSelectorCounts = new Map<string, number>();
      for (const adset of adsets) {
        const key = buildSelectorKey(adset);
        localSelectorCounts.set(key, (localSelectorCounts.get(key) || 0) + 1);
      }
      const localFamilies = Array.from(localSelectorCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([key, count]) => ({
          key,
          count,
          pct: adsets.length > 0 ? count / adsets.length : 0,
          sampleCampaignIds: sampleCampaignIds(campaignIds),
        }));
      return {
        category,
        campaignCount: campaignIds.length,
        dominantAccountId: countValues(adsets, (row) => row.account_id)[0] || null,
        dominantPixelId: countValues(adsets, (row) => row.promoted_object?.pixel_id)[0] || null,
        dominantPageId: countValues(pages, (row) => row)[0] || null,
        selectorFamilies: localFamilies.slice(0, 6),
      };
    });

  return {
    scope: {
      buyer: args.buyer,
      matchedCampaigns: matchedCampaigns.length,
      matchedAdSets: matchedAdSets.length,
      matchedAds: matchedAds.length,
    },
    generatedAt: new Date().toISOString(),
    campaignFields,
    adSetFields,
    selectorFamilies: selectorFamilies.slice(0, 12),
    categoryProfiles,
    recommendations: {
      lockedSelectors: [
        'optimization_goal = OFFSITE_CONVERSIONS',
        'billing_event = IMPRESSIONS',
        'promoted_object.custom_event_type = LEAD',
      ],
      profileSelectors: [
        'adAccountId',
        'pixelId',
        'pageId',
        'age range',
        'geo signature (countries + location_types)',
        'placement family',
        'advantage audience on/off',
        'campaign/adset bid strategy',
      ],
      manualFields: [
        'creative upload',
        'headline/article/forcekeys',
        'budget amount',
        'whether to use bid cap',
      ],
      notes: [
        'The current Facebook campaign endpoint does not expose objective/effective_status cleanly in the sample, but ad set settings are rich enough to build useful selector families.',
        'Selector families should be built from repeated ad set targeting + promoted-object combinations, not single-field defaults.',
        'Page IDs can be mined from ad creatives and attached to selector families even when the campaign/ad set payload does not return a friendly page name.',
      ],
    },
  };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function renderFacebookSettingsProfileMarkdown(report: FacebookSettingsProfileReport): string {
  const lines: string[] = [];
  lines.push(`# ${report.scope.buyer} Facebook Settings Profile`);
  lines.push('');
  lines.push(`- Matched campaigns: ${report.scope.matchedCampaigns}`);
  lines.push(`- Matched ad sets: ${report.scope.matchedAdSets}`);
  lines.push(`- Matched ads: ${report.scope.matchedAds}`);
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push('');

  lines.push('## Locked Selectors');
  for (const item of report.recommendations.lockedSelectors) lines.push(`- ${item}`);
  lines.push('');

  lines.push('## Selector Families');
  for (const item of report.recommendations.profileSelectors) lines.push(`- ${item}`);
  lines.push('');

  lines.push('## Manual Fields');
  for (const item of report.recommendations.manualFields) lines.push(`- ${item}`);
  lines.push('');

  lines.push('## Campaign Fields');
  for (const [field, values] of Object.entries(report.campaignFields)) {
    const top = values.slice(0, 5).map((value) => `\`${value.value || '(blank)'}\` ${value.count}/${report.scope.matchedCampaigns} (${pct(value.pct)})`).join(', ');
    lines.push(`- ${field}: ${top}`);
  }
  lines.push('');

  lines.push('## Ad Set Fields');
  for (const [field, values] of Object.entries(report.adSetFields)) {
    const top = values.slice(0, 5).map((value) => `\`${value.value || '(blank)'}\` ${value.count}/${report.scope.matchedAdSets} (${pct(value.pct)})`).join(', ');
    lines.push(`- ${field}: ${top}`);
  }
  lines.push('');

  lines.push('## Top Selector Families');
  for (const family of report.selectorFamilies) {
    lines.push(`- ${family.count}/${report.scope.matchedAdSets} (${pct(family.pct)}) ad sets`);
    lines.push(`  selector: \`${family.key}\``);
    lines.push(`  campaigns: ${family.sampleCampaignIds.map((id) => `\`${id}\``).join(', ')}`);
  }
  lines.push('');

  lines.push('## Category Profiles');
  for (const profile of report.categoryProfiles.slice(0, 12)) {
    lines.push(`### ${profile.category}`);
    lines.push(`- campaigns: ${profile.campaignCount}`);
    if (profile.dominantAccountId) lines.push(`- dominant account: \`${profile.dominantAccountId.value}\` (${profile.dominantAccountId.count}/${profile.campaignCount}, ${pct(profile.dominantAccountId.pct)})`);
    if (profile.dominantPixelId) lines.push(`- dominant pixel: \`${profile.dominantPixelId.value}\``);
    if (profile.dominantPageId) lines.push(`- dominant page id: \`${profile.dominantPageId.value}\``);
    if (profile.selectorFamilies[0]) {
      lines.push(`- top selector family: \`${profile.selectorFamilies[0].key}\``);
    }
    lines.push('');
  }

  lines.push('## Notes');
  for (const note of report.recommendations.notes) lines.push(`- ${note}`);
  lines.push('');
  return lines.join('\n');
}
