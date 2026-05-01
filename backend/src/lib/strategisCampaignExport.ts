import axios, { AxiosRequestConfig } from 'axios';
import { StrategistClient, createStrategisApiClient } from './strategistClient';

export type FacebookCampaignExportQuery = {
  organization?: string;
  adAccountId?: string;
  campaignIds?: string[] | string;
  status?: string;
  dateStart?: string;
  dateEnd?: string;
  updatedSince?: string;
  includeAssets?: boolean;
  includePerformance?: boolean;
  performanceDateStart?: string;
  performanceDateEnd?: string;
  performanceTimeIncrement?: string;
  performanceAttribution?: string;
  format?: string;
};

export type FacebookAssetsManifestQuery = {
  organization?: string;
  adAccountId?: string;
  campaignIds?: string[] | string;
  format?: string;
};

const DEFAULT_ORG = process.env.STRATEGIS_ORGANIZATION || 'Interlincx';

function normalizeParams<T extends Record<string, any>>(params: T): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) out[key] = value.join(',');
      continue;
    }
    out[key] = value;
  }
  return out;
}

function isMissingRouteError(err: any): boolean {
  const status = err?.response?.status;
  const raw = err?.response?.data;
  const message =
    typeof raw === 'string'
      ? raw
      : raw?.message || raw?.error?.message || err?.message || '';
  return status === 404 || /cannot get|not found|route/i.test(String(message));
}

export class StrategisCampaignExportClient {
  private readonly strategistClient: StrategistClient | null;
  private readonly authToken: string | null;
  private readonly apiBaseUrl: string;
  private readonly organization: string;

  constructor(
    opts: {
      organization?: string;
      strategistClient?: StrategistClient;
      authToken?: string;
      apiBaseUrl?: string;
      ixIdBaseUrl?: string;
      email?: string;
      password?: string;
      allowSelfSigned?: boolean;
    } = {}
  ) {
    this.organization = opts.organization || DEFAULT_ORG;
    this.authToken = opts.authToken || null;
    this.apiBaseUrl = opts.apiBaseUrl || process.env.STRATEGIS_API_BASE_URL || 'https://strategis.lincx.in';
    this.strategistClient = this.authToken
      ? null
      : opts.strategistClient ||
        new StrategistClient({
          apiBaseUrl: this.apiBaseUrl,
          ixIdBaseUrl: opts.ixIdBaseUrl || process.env.STRATEGIS_AUTH_BASE_URL || process.env.IX_ID_BASE_URL,
          email: opts.email || process.env.STRATEGIS_EMAIL || process.env.IX_ID_EMAIL,
          password: opts.password || process.env.STRATEGIS_PASSWORD || process.env.IX_ID_PASSWORD,
          allowSelfSigned:
            typeof opts.allowSelfSigned === 'boolean'
              ? opts.allowSelfSigned
              : process.env.STRATEGIS_ALLOW_SELF_SIGNED === '1' || process.env.STRATEGIST_ALLOW_SELF_SIGNED === '1',
        });
  }

  private async get<T>(
    path: string,
    params?: Record<string, any>,
    responseType: AxiosRequestConfig['responseType'] = 'json'
  ): Promise<T> {
    if (this.authToken) {
      const response = await axios.get<T>(`${this.apiBaseUrl.replace(/\/$/, '')}${path}`, {
        params,
        responseType,
        timeout: 120000,
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });
      return response.data;
    }

    if (!this.strategistClient) {
      throw new Error('Strategis campaign export client is missing both authToken and strategistClient');
    }

    return this.strategistClient.get<T>(path, params, responseType);
  }

  private async getWithFallback<T>(
    paths: string[],
    params?: Record<string, any>,
    responseType: AxiosRequestConfig['responseType'] = 'json'
  ): Promise<T> {
    let lastErr: any = null;
    for (const path of paths) {
      try {
        return await this.get<T>(path, params, responseType);
      } catch (err: any) {
        lastErr = err;
        if (isMissingRouteError(err)) continue;
        throw err;
      }
    }

    const attempted = paths.join(', ');
    const reason = lastErr?.message || 'route unavailable';
    throw new Error(`Strategis campaign export endpoint unavailable. Tried ${attempted}. Root cause: ${reason}`);
  }

  private buildExportParams(query: FacebookCampaignExportQuery = {}): Record<string, any> {
    return normalizeParams({
      organization: query.organization || this.organization,
      adAccountId: query.adAccountId,
      campaignIds: query.campaignIds,
      status: query.status,
      dateStart: query.dateStart,
      dateEnd: query.dateEnd,
      updatedSince: query.updatedSince,
      includeAssets: query.includeAssets,
      includePerformance: query.includePerformance,
      performanceDateStart: query.performanceDateStart,
      performanceDateEnd: query.performanceDateEnd,
      performanceTimeIncrement: query.performanceTimeIncrement,
      performanceAttribution: query.performanceAttribution,
      format: query.format,
    });
  }

  private buildAssetsParams(query: FacebookAssetsManifestQuery = {}): Record<string, any> {
    return normalizeParams({
      organization: query.organization || this.organization,
      adAccountId: query.adAccountId,
      campaignIds: query.campaignIds,
      format: query.format,
    });
  }

  async fetchCampaignExport(query: FacebookCampaignExportQuery = {}): Promise<any> {
    return this.getWithFallback<any>(
      ['/api/v1/facebook/campaigns/export', '/api/facebook/campaigns/export'],
      this.buildExportParams(query)
    );
  }

  async fetchCampaignExportById(campaignId: string, query: Omit<FacebookCampaignExportQuery, 'campaignIds'> = {}): Promise<any> {
    const encodedCampaignId = encodeURIComponent(campaignId);
    return this.getWithFallback<any>(
      [
        `/api/v1/facebook/campaigns/${encodedCampaignId}/export`,
        `/api/facebook/campaigns/${encodedCampaignId}/export`,
      ],
      this.buildExportParams(query)
    );
  }

  async fetchTextExport(query: FacebookCampaignExportQuery = {}): Promise<any> {
    return this.getWithFallback<any>(
      ['/api/v1/facebook/campaigns/text-export', '/api/facebook/campaigns/text-export'],
      this.buildExportParams(query)
    );
  }

  async fetchAssetsManifest(query: FacebookAssetsManifestQuery = {}): Promise<any> {
    return this.getWithFallback<any>(
      ['/api/v1/facebook/creatives/assets-manifest', '/api/facebook/creatives/assets-manifest'],
      this.buildAssetsParams(query)
    );
  }
}
