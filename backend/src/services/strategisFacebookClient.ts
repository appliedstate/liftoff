/**
 * Strategis Facebook API Relay Client
 * 
 * Client for interacting with Strategis Facebook API relay endpoints:
 * - POST /api/facebook/campaigns/create
 * - POST /api/facebook/adsets/create
 * - POST /api/facebook/adcreatives/create
 * - POST /api/facebook/ads/create
 * 
 * Note: These endpoints need to be built by Strategis engineering first.
 */

import axios from 'axios';

export interface StrategisFacebookConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface CreateCampaignRequest {
  organization: string;
  adAccountId: string;
  name: string;
  objective: string;
  status?: 'PAUSED' | 'ACTIVE';
  special_ad_categories?: string[];
  buying_type?: string;
  is_campaign_budget_optimized?: boolean;
  daily_budget?: string;
  clientRequestKey?: string;
  [key: string]: any;
}

export interface CreateCampaignResponse {
  id: string;
  name: string;
}

export interface CreateAdSetRequest {
  organization: string;
  campaign_id: string;
  name: string;
  optimization_goal: string;
  billing_event: string;
  targeting: Record<string, any>;
  status?: 'PAUSED' | 'ACTIVE';
  start_time?: string;
  promoted_object?: {
    pixel_id: string;
    custom_event_type: string;
  };
  daily_budget?: string;
  bid_strategy?: string;
  clientRequestKey?: string;
  [key: string]: any;
}

export interface CreateAdSetResponse {
  id: string;
  name: string;
}

export interface CreateCreativeRequest {
  organization: string;
  object_story_spec: Record<string, any>;
  clientRequestKey?: string;
  [key: string]: any;
}

export interface CreateCreativeResponse {
  id: string;
}

export interface CreateAdRequest {
  organization: string;
  adset_id: string;
  name: string;
  creative: {
    creative_id: string;
  };
  status?: 'PAUSED' | 'ACTIVE';
  clientRequestKey?: string;
  [key: string]: any;
}

export interface CreateAdResponse {
  id: string;
  name: string;
}

export class StrategisFacebookClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: StrategisFacebookConfig) {
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
        const errorData = error.response.data || { message: error.response.statusText };
        throw new Error(
          `Strategis Facebook API error (${error.response.status}): ${JSON.stringify(errorData)}`
        );
      }
      throw error;
    }
  }

  /**
   * Create Facebook campaign via Strategis relay
   * POST /api/facebook/campaigns/create
   */
  async createCampaign(
    request: CreateCampaignRequest
  ): Promise<CreateCampaignResponse> {
    return this.request<CreateCampaignResponse>(
      'POST',
      '/api/facebook/campaigns/create',
      request
    );
  }

  /**
   * Create Facebook ad set via Strategis relay
   * POST /api/facebook/adsets/create
   */
  async createAdSet(
    request: CreateAdSetRequest
  ): Promise<CreateAdSetResponse> {
    return this.request<CreateAdSetResponse>(
      'POST',
      '/api/facebook/adsets/create',
      request
    );
  }

  /**
   * Create Facebook creative via Strategis relay
   * POST /api/facebook/adcreatives/create
   */
  async createCreative(
    request: CreateCreativeRequest
  ): Promise<CreateCreativeResponse> {
    return this.request<CreateCreativeResponse>(
      'POST',
      '/api/facebook/adcreatives/create',
      request
    );
  }

  /**
   * Create Facebook ad via Strategis relay
   * POST /api/facebook/ads/create
   */
  async createAd(request: CreateAdRequest): Promise<CreateAdResponse> {
    return this.request<CreateAdResponse>(
      'POST',
      '/api/facebook/ads/create',
      request
    );
  }
}

