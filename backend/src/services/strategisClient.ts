/**
 * Strategis API Client
 *
 * Client for interacting with Strategis API endpoints using Authentic JWT auth.
 * - Templates: POST /api/templates, GET /api/templates
 * - Campaigns: POST /api/campaigns, GET /api/campaigns/:id
 */

import { StrategistClient as AuthenticatedStrategistClient } from '../lib/strategistClient';

export interface StrategisConfig {
  baseUrl: string;
  apiKey?: string;
  authToken?: string;
  email?: string;
  password?: string;
  ixIdBaseUrl?: string;
}

export interface StrategisTemplate extends Record<string, any> {
  id: string;
  key?: string;
  value?: string;
  organization?: string;
  notes?: string;
}

export interface StrategisCampaign {
  id: string;
  name: string;
  category: string;
  template: StrategisTemplate | { id: string };
  properties: Record<string, any>;
  organizations: string[];
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface StrategisSchemaProperty {
  type?: string;
  enum?: unknown[];
  items?: StrategisSchemaProperty;
  properties?: Record<string, StrategisSchemaProperty>;
  additionalProperties?: boolean;
  [key: string]: any;
}

export interface StrategisCampaignSchema extends Record<string, any> {
  type?: string;
  properties?: Record<string, StrategisSchemaProperty>;
  additionalProperties?: boolean;
}

export interface CreateTemplateRequest {
  key: string;
  value: string;
  organization: string;
  notes?: string;
}

export interface CreateCampaignRequest {
  name: string;
  category: string;
  template: StrategisTemplate | { id: string };
  id?: string;
  redirectDomain?: string;
  properties: Record<string, any>;
  organizations: string[];
}

export class StrategisClient {
  private baseUrl: string;
  private client: AuthenticatedStrategistClient;

  constructor(config: StrategisConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.client = new AuthenticatedStrategistClient({
      apiBaseUrl: this.baseUrl,
      ixIdBaseUrl:
        config.ixIdBaseUrl ||
        process.env.STRATEGIS_AUTH_BASE_URL ||
        process.env.IX_ID_BASE_URL ||
        'https://ix-id.lincx.la',
      authToken:
        config.authToken ||
        config.apiKey ||
        process.env.STRATEGIS_AUTH_TOKEN ||
        process.env.STRATEGIST_AUTH_TOKEN,
      email: config.email || process.env.STRATEGIS_EMAIL || process.env.IX_ID_EMAIL,
      password: config.password || process.env.STRATEGIS_PASSWORD || process.env.IX_ID_PASSWORD,
      allowSelfSigned:
        process.env.STRATEGIS_ALLOW_SELF_SIGNED === '1' ||
        process.env.STRATEGIST_ALLOW_SELF_SIGNED === '1',
    });
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    try {
      const response = await this.client.request<T>({
        method: method as any,
        url: path,
        data: body,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Strategis API error (${error.response.status}): ${JSON.stringify(error.response.data)}`
        );
      }
      throw error;
    }
  }

  /**
   * Create a template
   * POST /api/templates
   */
  async createTemplate(
    request: CreateTemplateRequest
  ): Promise<StrategisTemplate> {
    return this.request<StrategisTemplate>('POST', '/api/templates', request);
  }

  /**
   * Get template by ID
   * GET /api/templates/:id
   */
  async getTemplate(id: string): Promise<StrategisTemplate> {
    return this.request<StrategisTemplate>('GET', `/api/templates/${id}`);
  }

  /**
   * List templates by organization
   * GET /api/templates?organization=...
   */
  async listTemplates(organization: string): Promise<StrategisTemplate[]> {
    return this.request<StrategisTemplate[]>(
      'GET',
      `/api/templates?organization=${encodeURIComponent(organization)}`
    );
  }

  /**
   * Get campaign schema by organization
   * GET /api/schemas/campaign?organization=...&cached=true
   */
  async getCampaignSchema(
    organization: string,
    opts: { cached?: boolean } = {}
  ): Promise<StrategisCampaignSchema> {
    const cached = opts.cached !== false;
    return this.request<StrategisCampaignSchema>(
      'GET',
      `/api/schemas/campaign?organization=${encodeURIComponent(organization)}&cached=${cached ? 'true' : 'false'}`
    );
  }

  /**
   * Create a campaign
   * POST /api/campaigns
   */
  async createCampaign(
    request: CreateCampaignRequest
  ): Promise<StrategisCampaign> {
    const created = await this.request<StrategisCampaign>('POST', '/api/campaigns', request);
    if (created?.id) return created;
    const recovered = await this.findCampaignByName(
      request.organizations?.[0] || 'Interlincx',
      request.name
    );
    if (recovered) return recovered;
    throw new Error(
      `Strategis browser-auth create returned no campaign id for "${request.name}".`
    );
  }

  /**
   * Get campaign by ID
   * GET /api/campaigns/:id
   */
  async getCampaign(id: string): Promise<StrategisCampaign> {
    return this.request<StrategisCampaign>('GET', `/api/campaigns/${id}`);
  }

  /**
   * Update campaign
   * POST /api/campaigns/:id
   */
  async updateCampaign(
    id: string,
    updates: Record<string, any>
  ): Promise<StrategisCampaign> {
    const updated = await this.request<StrategisCampaign>(
      'POST',
      `/api/campaigns/${id}`,
      updates
    );
    if (updated?.id) return updated;
    return this.getCampaign(id);
  }

  async listCampaigns(organization: string): Promise<StrategisCampaign[]> {
    return this.request<StrategisCampaign[]>(
      'GET',
      `/api/campaigns?organization=${encodeURIComponent(organization)}`
    );
  }

  async createIdenticalCampaigns(
    campaign: StrategisCampaign | string,
    amount: number
  ): Promise<string[]> {
    const sourceCampaign =
      typeof campaign === 'string' ? await this.getCampaign(campaign) : campaign;
    const response = await this.request<any>('POST', '/api/identical-campaigns', {
      campaign: sourceCampaign,
      amount,
    });
    if (Array.isArray(response)) {
      return response.map((entry) => String(entry)).filter(Boolean);
    }
    if (Array.isArray(response?.campaignIds)) {
      return response.campaignIds.map((entry: unknown) => String(entry)).filter(Boolean);
    }
    if (Array.isArray(response?.ids)) {
      return response.ids.map((entry: unknown) => String(entry)).filter(Boolean);
    }
    throw new Error('Strategis identical-campaigns response did not include clone ids');
  }

  private async findCampaignByName(
    organization: string,
    campaignName: string
  ): Promise<StrategisCampaign | null> {
    try {
      const rows = await this.listCampaigns(organization);
      const match = rows.find((row: any) => String(row?.name || '').trim() === campaignName);
      return match || null;
    } catch {
      return null;
    }
  }
}
