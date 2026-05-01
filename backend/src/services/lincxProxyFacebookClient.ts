import { StrategistClient as AuthenticatedStrategistClient } from '../lib/strategistClient';

export type LincxProxyFacebookConfig = {
  baseUrl: string;
  authToken?: string;
  ixIdBaseUrl?: string;
  email?: string;
  password?: string;
};

type ProxyRequestOptions = {
  organization: string;
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  body?: Record<string, any>;
};

function unwrap<T = any>(value: any): T {
  if (value && typeof value === 'object' && 'data' in value) return value.data as T;
  return value as T;
}

function graphUrl(path: string): string {
  const version = process.env.FACEBOOK_GRAPH_VERSION || 'v25.0';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `https://graph.facebook.com/${version}${normalized}`;
}

function normalizeAdAccountId(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

export class LincxProxyFacebookClient {
  private client: AuthenticatedStrategistClient;

  constructor(config: LincxProxyFacebookConfig) {
    this.client = new AuthenticatedStrategistClient({
      apiBaseUrl: config.baseUrl.replace(/\/$/, ''),
      ixIdBaseUrl:
        config.ixIdBaseUrl ||
        process.env.STRATEGIS_AUTH_BASE_URL ||
        process.env.IX_ID_BASE_URL ||
        'https://ix-id.lincx.la',
      authToken:
        config.authToken ||
        process.env.STRATEGIS_AUTH_TOKEN ||
        process.env.STRATEGIST_AUTH_TOKEN,
      email: config.email || process.env.STRATEGIS_EMAIL || process.env.IX_ID_EMAIL,
      password: config.password || process.env.STRATEGIS_PASSWORD || process.env.IX_ID_PASSWORD,
      allowSelfSigned:
        process.env.STRATEGIS_ALLOW_SELF_SIGNED === '1' ||
        process.env.STRATEGIST_ALLOW_SELF_SIGNED === '1',
    });
  }

  async request<T = any>(options: ProxyRequestOptions): Promise<T> {
    const response = await this.client.request<any>({
      method: 'POST',
      url: '/api/lincx-proxy',
      data: {
        organization: options.organization,
        network: 'Facebook',
        method: options.method,
        url: options.url,
        body: options.body || {},
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return unwrap<T>(response.data);
  }

  async listAds(args: {
    organization: string;
    adAccountId: string;
    fields?: string;
  }): Promise<any[]> {
    const payload = await this.client.get<any>('/api/facebook/ads', {
      organization: args.organization,
      adAccountId: normalizeAdAccountId(args.adAccountId),
      ...(args.fields ? { fields: args.fields } : {}),
    });
    return Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  }

  async listCampaigns(args: {
    organization: string;
    adAccountId: string;
    fields?: string;
  }): Promise<any[]> {
    const payload = await this.client.get<any>('/api/facebook/campaigns', {
      organization: args.organization,
      adAccountId: normalizeAdAccountId(args.adAccountId),
      ...(args.fields ? { fields: args.fields } : {}),
    });
    return Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  }

  async listAdSets(args: {
    organization: string;
    adAccountId: string;
    fields?: string;
  }): Promise<any[]> {
    const payload = await this.client.get<any>('/api/facebook/adsets', {
      organization: args.organization,
      adAccountId: normalizeAdAccountId(args.adAccountId),
      ...(args.fields ? { fields: args.fields } : {}),
    });
    return Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  }

  async getObject(
    organization: string,
    objectId: string,
    fields?: string
  ): Promise<any> {
    return this.request({
      organization,
      method: 'GET',
      url: graphUrl(`/${objectId}${fields ? `?fields=${encodeURIComponent(fields)}` : ''}`),
    });
  }

  async updateObject(
    organization: string,
    objectId: string,
    body: Record<string, any>
  ): Promise<any> {
    return this.request({
      organization,
      method: 'POST',
      url: graphUrl(`/${objectId}`),
      body,
    });
  }

  async cloneCampaign(
    organization: string,
    sourceCampaignId: string,
    body: Record<string, any>
  ): Promise<any> {
    return this.request({
      organization,
      method: 'POST',
      url: graphUrl(`/${sourceCampaignId}/copies`),
      body,
    });
  }

  async uploadImage(
    organization: string,
    adAccountId: string,
    imageUrl: string
  ): Promise<any> {
    return this.request({
      organization,
      method: 'POST',
      url: graphUrl(`/${normalizeAdAccountId(adAccountId)}/adimages`),
      body: {
        url: imageUrl,
      },
    });
  }

  async uploadVideo(
    organization: string,
    adAccountId: string,
    videoUrl: string
  ): Promise<any> {
    return this.request({
      organization,
      method: 'POST',
      url: graphUrl(`/${normalizeAdAccountId(adAccountId)}/advideos`),
      body: {
        file_url: videoUrl,
      },
    });
  }

  async createCreative(
    organization: string,
    adAccountId: string,
    body: Record<string, any>
  ): Promise<any> {
    return this.request({
      organization,
      method: 'POST',
      url: graphUrl(`/${normalizeAdAccountId(adAccountId)}/adcreatives`),
      body,
    });
  }
}
