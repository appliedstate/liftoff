import axios from 'axios';
import { StrategistClient } from './strategistClient';

export type StrategisCampaignRecord = {
  id: string;
  name?: string;
  category?: string;
  redirectDomain?: string;
  properties?: Record<string, any>;
  template?: {
    id?: string;
    value?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function replaceSections(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{#([\w.-]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, body) => {
    return data[key] ? body : '';
  });
}

function replaceVariables(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{([\w.-]+)\}\}/g, (_match, key) => data[key] ?? '');
}

export function cleanupRenderedUrl(rendered: string): string {
  if (!rendered) return rendered;
  try {
    const url = new URL(rendered);
    const next = new URL(url.origin + url.pathname.replace(/\/{2,}/g, '/'));
    const params = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (value === '' || value === 'undefined' || value === 'null') continue;
      params.append(key, value);
    }
    next.search = params.toString();
    return next.toString();
  } catch {
    return rendered;
  }
}

export function renderStrategisTemplate(templateValue: string, data: Record<string, unknown>): string {
  const normalized = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, toStringValue(value)])
  ) as Record<string, string>;
  const withSections = replaceSections(templateValue, normalized);
  const withVariables = replaceVariables(withSections, normalized);
  return cleanupRenderedUrl(withVariables);
}

export function buildCampaignRenderData(
  campaign: StrategisCampaignRecord,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  const properties = campaign.properties || {};
  const redirectDomain = campaign.redirectDomain || '';
  const redirectHost = redirectDomain ? new URL(redirectDomain).hostname : '';

  return {
    campaignId: campaign.id,
    redirectDomain,
    domain: properties.domain || redirectHost,
    rsocSite: properties.rsocSite || properties.domain || redirectHost,
    article: properties.article || '',
    subdirectory: properties.subdirectory || '',
    headline: properties.headline || '',
    fbAdAccount: properties.fbAdAccount || '',
    forcekeyA: properties.forcekeyA || '',
    forcekeyB: properties.forcekeyB || '',
    forcekeyC: properties.forcekeyC || '',
    forcekeyD: properties.forcekeyD || '',
    forcekeyE: properties.forcekeyE || '',
    forcekeyF: properties.forcekeyF || '',
    forcekeyG: properties.forcekeyG || '',
    forcekeyH: properties.forcekeyH || '',
    fbclid: '',
    pl: '',
    ag: '',
    sessionId: '',
    ...properties,
    ...extras,
  };
}

export function renderIntendedDestinationUrl(
  campaign: StrategisCampaignRecord,
  extras: Record<string, unknown> = {}
): string | null {
  const templateValue = campaign.template?.value;
  if (!templateValue) return null;
  return renderStrategisTemplate(templateValue, buildCampaignRenderData(campaign, extras));
}

export async function fetchStrategisCampaign(
  campaignId: string,
  opts: {
    apiBaseUrl: string;
    authToken?: string | null;
    strategistClient?: StrategistClient | null;
  }
): Promise<StrategisCampaignRecord> {
  if (opts.authToken) {
    const resp = await axios.get(`${opts.apiBaseUrl.replace(/\/$/, '')}/api/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${opts.authToken}` },
      timeout: 60000,
    });
    return resp.data as StrategisCampaignRecord;
  }

  if (!opts.strategistClient) {
    throw new Error(`No auth available to load Strategis campaign ${campaignId}`);
  }

  const payload = await opts.strategistClient.get(`/api/campaigns/${campaignId}`);
  return payload as StrategisCampaignRecord;
}
