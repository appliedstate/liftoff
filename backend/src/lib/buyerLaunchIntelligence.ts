import type { BenCampaignCatalog, BenCampaignCatalogItem } from './benCampaignCatalog';
import type { StrategisCampaignSchema, StrategisSchemaProperty } from '../services/strategisClient';
import { LincxProxyFacebookClient } from '../services/lincxProxyFacebookClient';

export type LaunchAssociationOption = {
  value: string;
  label: string;
  support: {
    count: number;
    pct: number;
  };
  sampleCampaignIds: string[];
  sampleCampaignNames: string[];
  source: 'history' | 'schema_only' | 'history_not_in_schema';
};

export type SiteAssociation = {
  site: string;
  campaignCount: number;
  redirectDomains: LaunchAssociationOption[];
  adAccounts: LaunchAssociationOption[];
  pages: LaunchAssociationOption[];
  networkAccounts: LaunchAssociationOption[];
};

export type BuyerLaunchIntelligence = {
  scope: {
    buyer: string;
    organization: string;
    historicalCampaigns: number;
  };
  generatedAt: string;
  options: {
    sites: LaunchAssociationOption[];
    redirectDomains: LaunchAssociationOption[];
    adAccounts: LaunchAssociationOption[];
    pages: LaunchAssociationOption[];
    networkAccounts: LaunchAssociationOption[];
  };
  siteAssociations: SiteAssociation[];
  notes: string[];
};

type CounterEntry = {
  count: number;
  sampleCampaignIds: string[];
  sampleCampaignNames: string[];
};

function asNonEmptyString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function isNumericId(value: string | null | undefined): value is string {
  return Boolean(value && /^\d+$/.test(value));
}

function schemaProperties(schema: StrategisCampaignSchema | null | undefined): Record<string, StrategisSchemaProperty> {
  return ((schema?.properties?.properties as any)?.properties || {}) as Record<string, StrategisSchemaProperty>;
}

function schemaEnumEntries(schema: StrategisCampaignSchema | null | undefined, key: string): unknown[] {
  const property = schemaProperties(schema)[key];
  return Array.isArray(property?.enum) ? property!.enum : [];
}

function buildSchemaLabelMap(schema: StrategisCampaignSchema, key: string): Map<string, string> {
  const entries = schemaEnumEntries(schema, key);
  const map = new Map<string, string>();

  for (const entry of entries) {
    if (entry === null || entry === undefined) continue;

    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      const value = String(entry).trim();
      if (value) map.set(value, value);
      continue;
    }

    if (typeof entry === 'object') {
      const raw = entry as Record<string, any>;
      const value = asNonEmptyString(raw.id) || asNonEmptyString(raw.value) || asNonEmptyString(raw.key) || null;
      if (!value) continue;

      if (key === 'fbAdAccount') {
        const accountName = asNonEmptyString(raw.name);
        const businessName = asNonEmptyString(raw.business?.name);
        const label = [accountName, value, businessName].filter(Boolean).join(' · ');
        map.set(value, label || value);
        continue;
      }

      const name = asNonEmptyString(raw.name);
      const domain = asNonEmptyString(raw.domain);
      map.set(value, name || domain || value);
    }
  }

  return map;
}

async function resolvePageLabelMap(args: {
  pageIds: string[];
  organization: string;
  authToken?: string | null;
}): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(args.pageIds.filter(isNumericId)));
  if (!ids.length) return map;

  const client = new LincxProxyFacebookClient({
    baseUrl:
      process.env.STRATEGIS_API_BASE_URL ||
      process.env.STRATEGIS_WRITE_BASE_URL ||
      'https://strategis.lincx.in',
    authToken: args.authToken || undefined,
  });

  await Promise.all(
    ids.map(async (pageId) => {
      try {
        const payload = await client.getObject(args.organization, pageId, 'id,name');
        const name = asNonEmptyString(payload?.name);
        map.set(pageId, name ? `${name} · ${pageId}` : pageId);
      } catch {
        map.set(pageId, pageId);
      }
    })
  );

  return map;
}

function collectCounts(
  items: BenCampaignCatalogItem[],
  valuesForItem: (item: BenCampaignCatalogItem) => string[]
): Map<string, CounterEntry> {
  const counter = new Map<string, CounterEntry>();

  for (const item of items) {
    const values = Array.from(new Set(valuesForItem(item).map((value) => String(value || '').trim()).filter(Boolean)));
    for (const value of values) {
      const current = counter.get(value) || {
        count: 0,
        sampleCampaignIds: [],
        sampleCampaignNames: [],
      };
      current.count += 1;
      if (item.campaignId && current.sampleCampaignIds.length < 4) current.sampleCampaignIds.push(item.campaignId);
      if (item.campaignName && current.sampleCampaignNames.length < 4) current.sampleCampaignNames.push(item.campaignName);
      counter.set(value, current);
    }
  }

  return counter;
}

function toAssociationOptions(args: {
  counts: Map<string, CounterEntry>;
  total: number;
  labelMap?: Map<string, string>;
  fallbackLabel?: (value: string) => string;
  schemaValues?: Set<string>;
  includeSchemaOnly?: boolean;
}): LaunchAssociationOption[] {
  const values = new Set<string>(args.counts.keys());
  if (args.includeSchemaOnly && args.schemaValues) {
    for (const value of args.schemaValues) values.add(value);
  }

  return Array.from(values)
    .map((value) => {
      const entry = args.counts.get(value) || {
        count: 0,
        sampleCampaignIds: [],
        sampleCampaignNames: [],
      };
      const inSchema = args.schemaValues ? args.schemaValues.has(value) : true;
      const label =
        args.labelMap?.get(value) ||
        args.fallbackLabel?.(value) ||
        value;
      return {
        value,
        label,
        support: {
          count: entry.count,
          pct: args.total > 0 ? entry.count / args.total : 0,
        },
        sampleCampaignIds: entry.sampleCampaignIds,
        sampleCampaignNames: entry.sampleCampaignNames,
        source:
          entry.count === 0
            ? 'schema_only'
            : inSchema
              ? 'history'
              : 'history_not_in_schema',
      } satisfies LaunchAssociationOption;
    })
    .sort((a, b) => {
      if (b.support.count !== a.support.count) return b.support.count - a.support.count;
      return a.label.localeCompare(b.label);
    });
}

function uniqueSchemaValues(schema: StrategisCampaignSchema, key: string): Set<string> {
  const values = new Set<string>();
  for (const entry of schemaEnumEntries(schema, key)) {
    if (entry === null || entry === undefined) continue;
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      const value = String(entry).trim();
      if (value) values.add(value);
      continue;
    }
    if (typeof entry === 'object') {
      const raw = entry as Record<string, any>;
      const value = asNonEmptyString(raw.id) || asNonEmptyString(raw.value) || asNonEmptyString(raw.key) || null;
      if (value) values.add(value);
    }
  }
  return values;
}

function adAccountValues(item: BenCampaignCatalogItem): string[] {
  return [item.fbAdAccount, item.facebook.adAccountId].filter((value): value is string => isNumericId(value));
}

function pageValues(item: BenCampaignCatalogItem): string[] {
  return [item.fbPage, item.facebook.pageId].filter((value): value is string => isNumericId(value));
}

function networkAccountValues(item: BenCampaignCatalogItem): string[] {
  return [item.networkAccountId].filter((value): value is string => Boolean(asNonEmptyString(value)));
}

function redirectValues(item: BenCampaignCatalogItem): string[] {
  return [item.redirectDomain].filter((value): value is string => Boolean(asNonEmptyString(value)));
}

function siteValues(item: BenCampaignCatalogItem): string[] {
  return [item.rsocSite].filter((value): value is string => Boolean(asNonEmptyString(value)));
}

export async function buildBuyerLaunchIntelligence(args: {
  catalog: BenCampaignCatalog;
  schema: StrategisCampaignSchema;
  organization?: string;
  authToken?: string | null;
}): Promise<BuyerLaunchIntelligence> {
  const organization = args.organization || args.catalog.scope.organization || 'Interlincx';
  const historyItems = args.catalog.items;

  const siteCounts = collectCounts(historyItems, siteValues);
  const redirectCounts = collectCounts(historyItems, redirectValues);
  const adAccountCounts = collectCounts(historyItems, adAccountValues);
  const pageCounts = collectCounts(historyItems, pageValues);
  const networkAccountCounts = collectCounts(historyItems, networkAccountValues);

  const siteSchemaValues = uniqueSchemaValues(args.schema, 'rsocSite');
  const adAccountSchemaValues = uniqueSchemaValues(args.schema, 'fbAdAccount');
  const pageSchemaValues = uniqueSchemaValues(args.schema, 'fbPage');
  const networkAccountSchemaValues = uniqueSchemaValues(args.schema, 'networkAccountId');

  const adAccountLabelMap = buildSchemaLabelMap(args.schema, 'fbAdAccount');
  const schemaPageLabelMap = buildSchemaLabelMap(args.schema, 'fbPage');
  const livePageLabelMap = await resolvePageLabelMap({
    pageIds: [...pageCounts.keys(), ...pageSchemaValues],
    organization,
    authToken: args.authToken,
  });
  const pageLabelMap = new Map<string, string>();
  for (const [key, value] of schemaPageLabelMap.entries()) pageLabelMap.set(key, value);
  for (const [key, value] of livePageLabelMap.entries()) pageLabelMap.set(key, value);

  const globalSites = toAssociationOptions({
    counts: siteCounts,
    total: historyItems.length,
    schemaValues: siteSchemaValues,
    includeSchemaOnly: true,
  });
  const globalRedirects = toAssociationOptions({
    counts: redirectCounts,
    total: historyItems.length,
  });
  const globalAdAccounts = toAssociationOptions({
    counts: adAccountCounts,
    total: historyItems.length,
    labelMap: adAccountLabelMap,
    fallbackLabel: (value) => value,
    schemaValues: adAccountSchemaValues,
    includeSchemaOnly: true,
  });
  const globalPages = toAssociationOptions({
    counts: pageCounts,
    total: historyItems.length,
    labelMap: pageLabelMap,
    fallbackLabel: (value) => `Page · ${value}`,
    schemaValues: pageSchemaValues,
    includeSchemaOnly: true,
  });
  const globalNetworkAccounts = toAssociationOptions({
    counts: networkAccountCounts,
    total: historyItems.length,
    schemaValues: networkAccountSchemaValues,
    includeSchemaOnly: true,
  });

  const siteAssociations = Array.from(siteCounts.entries())
    .map(([site, meta]) => {
      const siteItems = historyItems.filter((item) => item.rsocSite === site);
      return {
        site,
        campaignCount: meta.count,
        redirectDomains: toAssociationOptions({
          counts: collectCounts(siteItems, redirectValues),
          total: siteItems.length,
        }),
        adAccounts: toAssociationOptions({
          counts: collectCounts(siteItems, adAccountValues),
          total: siteItems.length,
          labelMap: adAccountLabelMap,
          fallbackLabel: (value) => value,
          schemaValues: adAccountSchemaValues,
        }),
        pages: toAssociationOptions({
          counts: collectCounts(siteItems, pageValues),
          total: siteItems.length,
          labelMap: pageLabelMap,
          fallbackLabel: (value) => `Page · ${value}`,
          schemaValues: pageSchemaValues,
        }),
        networkAccounts: toAssociationOptions({
          counts: collectCounts(siteItems, networkAccountValues),
          total: siteItems.length,
          schemaValues: networkAccountSchemaValues,
        }),
      } satisfies SiteAssociation;
    })
    .sort((a, b) => b.campaignCount - a.campaignCount || a.site.localeCompare(b.site));

  const notes: string[] = [
    'Site recommendations are ranked from historical buyer campaign associations first, with Strategis schema options appended where available.',
    'Facebook ad account labels come from the current Strategis schema. Page labels are resolved live when Facebook Graph metadata is available.',
  ];

  const historyOnlyPages = globalPages.filter((option) => option.source === 'history_not_in_schema');
  if (historyOnlyPages.length) {
    notes.push(
      `${historyOnlyPages.length} historically used page IDs are not currently present in the Strategis schema and may need manual handling on create.`
    );
  }

  return {
    scope: {
      buyer: args.catalog.scope.buyer,
      organization,
      historicalCampaigns: historyItems.length,
    },
    generatedAt: new Date().toISOString(),
    options: {
      sites: globalSites,
      redirectDomains: globalRedirects,
      adAccounts: globalAdAccounts,
      pages: globalPages,
      networkAccounts: globalNetworkAccounts,
    },
    siteAssociations,
    notes,
  };
}
