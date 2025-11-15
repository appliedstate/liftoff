/**
 * Naming Generator Service
 * 
 * Generates campaign, ad set, and ad names according to naming conventions:
 * - Campaign: {Brand} | {Objective} | {HookSet} | {Market} | {Channel} | {YYYY-MM-DD}
 * - Ad Set: {AudienceKey} | {PlacementKey} | {OptimizationEvent} | {BudgetType} | v{N}
 * - Ad: {CreativeType} | {HookId} | {Variant} | {Format} | {Lang}
 */

export interface CampaignNamingInputs {
  brand: string;
  objective: string;
  hookSetId: string;
  market: string;
  channel: string;
  date: string; // YYYY-MM-DD format
}

export interface AdSetNamingInputs {
  audienceKey: string;
  placementKey: string;
  optimizationEvent: string;
  budgetType: 'CBO' | 'ABO';
  version: number;
}

export interface AdNamingInputs {
  creativeType: 'IMG' | 'VID';
  hookId: string;
  variant: string;
  format: '1x1' | '4x5' | '9x16';
  lang: string;
}

export interface StrategisCampaignNamingInputs extends CampaignNamingInputs {
  adSetName: string; // Combined campaign + ad set name
}

/**
 * Generate campaign name
 * Format: {Brand} | {Objective} | {HookSet} | {Market} | {Channel} | {YYYY-MM-DD}
 * Example: BrandX | CONVERSIONS | hookset_juvederm_2025_10_21 | US | FB | 2025-10-22
 */
export function generateCampaignName(inputs: CampaignNamingInputs): string {
  const { brand, objective, hookSetId, market, channel, date } = inputs;
  
  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
  }
  
  return `${brand} | ${objective} | ${hookSetId} | ${market} | ${channel} | ${date}`;
}

/**
 * Generate ad set name
 * Format: {AudienceKey} | {PlacementKey} | {OptimizationEvent} | {BudgetType} | v{N}
 * Example: ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1
 */
export function generateAdSetName(inputs: AdSetNamingInputs): string {
  const { audienceKey, placementKey, optimizationEvent, budgetType, version } = inputs;
  
  if (version < 1) {
    throw new Error(`Invalid version: ${version}. Must be >= 1`);
  }
  
  return `${audienceKey} | ${placementKey} | ${optimizationEvent} | ${budgetType} | v${version}`;
}

/**
 * Generate ad name
 * Format: {CreativeType} | {HookId} | {Variant} | {Format} | {Lang}
 * Example: VID | H123 | A | 4x5 | EN
 */
export function generateAdName(inputs: AdNamingInputs): string {
  const { creativeType, hookId, variant, format, lang } = inputs;
  
  return `${creativeType} | ${hookId} | ${variant} | ${format} | ${lang}`;
}

/**
 * Generate Strategis campaign name (combined campaign + ad set)
 * Format: {CampaignName} - {AdSetName}
 * Example: BrandX | CONVERSIONS | hookset_juvederm | US | FB | 2025-10-22 - ll_2p_purchasers_180 | advplus_all_auto | PURCHASE | CBO | v1
 */
export function generateStrategisCampaignName(
  campaignName: string,
  adSetName: string
): string {
  return `${campaignName} - ${adSetName}`;
}

/**
 * Parse campaign name back into components
 */
export function parseCampaignName(campaignName: string): CampaignNamingInputs {
  const parts = campaignName.split(' | ');
  
  if (parts.length !== 6) {
    throw new Error(`Invalid campaign name format: ${campaignName}`);
  }
  
  return {
    brand: parts[0],
    objective: parts[1],
    hookSetId: parts[2],
    market: parts[3],
    channel: parts[4],
    date: parts[5],
  };
}

/**
 * Parse ad set name back into components
 */
export function parseAdSetName(adSetName: string): AdSetNamingInputs {
  const parts = adSetName.split(' | ');
  
  if (parts.length !== 5) {
    throw new Error(`Invalid ad set name format: ${adSetName}`);
  }
  
  // Extract version from "v{N}"
  const versionMatch = parts[4].match(/^v(\d+)$/);
  if (!versionMatch) {
    throw new Error(`Invalid version format: ${parts[4]}`);
  }
  
  return {
    audienceKey: parts[0],
    placementKey: parts[1],
    optimizationEvent: parts[2],
    budgetType: parts[3] as 'CBO' | 'ABO',
    version: parseInt(versionMatch[1], 10),
  };
}

/**
 * Parse ad name back into components
 */
export function parseAdName(adName: string): AdNamingInputs {
  const parts = adName.split(' | ');
  
  if (parts.length !== 5) {
    throw new Error(`Invalid ad name format: ${adName}`);
  }
  
  return {
    creativeType: parts[0] as 'IMG' | 'VID',
    hookId: parts[1],
    variant: parts[2],
    format: parts[3] as '1x1' | '4x5' | '9x16',
    lang: parts[4],
  };
}

