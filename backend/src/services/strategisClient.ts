/**
 * Strategis API Client
 * 
 * Client for interacting with Strategis API endpoints:
 * - Templates: POST /api/templates, GET /api/templates
 * - Campaigns: POST /api/campaigns, GET /api/campaigns/:id
 */

import axios from 'axios';

export interface StrategisConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface StrategisTemplate {
  id: string;
  key: string;
  value: string;
  organization: string;
  notes?: string;
}

export interface StrategisCampaign {
  id: string;
  name: string;
  category: string;
  template: {
    id: string;
  };
  properties: Record<string, any>;
  organizations: string[];
  created_at?: string;
  updated_at?: string;
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
  template: {
    id: string;
  };
  properties: {
    buyer: string;
    networkName: string;
    destination: string;
    domain: string;
    networkAccountId?: string;
    article?: string;
    fbPage?: string;
    fbAdAccount?: string;
    fbCampaignId?: string;
    fbAdSetId?: string;
    [key: string]: any;
  };
  organizations: string[];
}

export class StrategisClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: StrategisConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await axios.request<T>({
        method: method as any,
        url,
        headers,
        data: body,
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
   * Create a campaign
   * POST /api/campaigns
   */
  async createCampaign(
    request: CreateCampaignRequest
  ): Promise<StrategisCampaign> {
    return this.request<StrategisCampaign>('POST', '/api/campaigns', request);
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
   * PUT /api/campaigns/:id
   */
  async updateCampaign(
    id: string,
    updates: Partial<CreateCampaignRequest>
  ): Promise<StrategisCampaign> {
    return this.request<StrategisCampaign>(
      'PUT',
      `/api/campaigns/${id}`,
      updates
    );
  }
}

