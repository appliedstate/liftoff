import { StrategistClient, createStrategisApiClient } from './strategistClient';
import { getPlatformFromNetworkId } from './networkIds';

const DEFAULT_ORG = process.env.STRATEGIS_ORGANIZATION || 'Interlincx';
const DEFAULT_AD_SOURCE = process.env.STRATEGIS_AD_SOURCE || 'rsoc';
const DEFAULT_NETWORK_ID = process.env.STRATEGIS_NETWORK_ID || '112';
const DEFAULT_TIMEZONE = process.env.STRATEGIS_TIMEZONE || 'UTC';
const DEFAULT_RPC_DAYS = Number(process.env.STRATEGIS_RPC_DAYS || '3');
const DEFAULT_DB_SOURCE = process.env.STRATEGIS_DB_SOURCE || 'ch';

export class StrategisApi {
  private readonly client: StrategistClient;
  private readonly organization: string;
  private readonly adSource: string;
  private readonly networkId: string;
  private readonly timezone: string;

  constructor(opts: { organization?: string; adSource?: string; networkId?: string; timezone?: string } = {}) {
    this.client = createStrategisApiClient();
    this.organization = opts.organization || DEFAULT_ORG;
    this.adSource = opts.adSource || DEFAULT_AD_SOURCE;
    this.networkId = opts.networkId || DEFAULT_NETWORK_ID;
    this.timezone = opts.timezone || DEFAULT_TIMEZONE;
  }

  private singleDayRange(date: string) {
    return { dateStart: date, dateEnd: date };
  }

  async fetchFacebookReport(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      networkName: 'facebook',
      level: 'campaign',
      dimensions: 'campaignId',
      cached: 1,
      dbSource: DEFAULT_DB_SOURCE,
    };
    const payload = await this.client.get('/api/facebook/report', params);
    return extractRows(payload);
  }

  async fetchFacebookCampaigns(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      dbSource: DEFAULT_DB_SOURCE,
    };
    const payload = await this.client.get('/api/facebook/campaigns', params);
    return extractRows(payload);
  }

  async fetchFacebookAdsets(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      dbSource: DEFAULT_DB_SOURCE,
    };
    const payload = await this.client.get('/api/facebook/adsets/day', params);
    return extractRows(payload);
  }

  async fetchS1Daily(date: string, includeAllNetworks: boolean = false): Promise<any[]> {
    const params: Record<string, any> = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      timezone: this.timezone,
      dbSource: DEFAULT_DB_SOURCE,
      // Include buyer in dimensions to get lane/buyer field
      dimensions: 'date-strategisCampaignId-buyer',
    };
    // Only include networkId filter if we want a specific network (default behavior)
    // If includeAllNetworks=true, omit networkId to get all platforms
    if (!includeAllNetworks && this.networkId) {
      params.networkId = this.networkId;
    }
    const payload = await this.client.get('/api/s1/report/daily-v3', params);
    return extractRows(payload);
  }

  /**
   * Fetch S1 reconciled report (high-level) which includes buyer field directly
   */
  async fetchS1Reconciled(date: string, includeAllNetworks: boolean = false): Promise<any[]> {
    const params: Record<string, any> = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      timezone: this.timezone,
      dbSource: DEFAULT_DB_SOURCE,
      dimensions: 'date-strategisCampaignId',
    };
    // Only include networkId filter if we want a specific network
    if (!includeAllNetworks && this.networkId) {
      params.networkId = this.networkId;
    }
    const payload = await this.client.get('/api/s1/high-level-report', params);
    return extractRows(payload);
  }

  async fetchS1Hourly(date: string, includeAllNetworks: boolean = false): Promise<any[]> {
    const params: Record<string, any> = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      timezone: this.timezone,
      dbSource: DEFAULT_DB_SOURCE,
      dimensions: 'date-hour-strategisCampaignId',
    };
    // Only include networkId filter if we want a specific network (default behavior)
    // If includeAllNetworks=true, omit networkId to get all platforms
    if (!includeAllNetworks && this.networkId) {
      params.networkId = this.networkId;
    }
    const payload = await this.client.get('/api/s1/report/hourly-v3', params);
    return extractRows(payload);
  }

  async fetchS1HourlyWithKeywords(date: string, includeAllNetworks: boolean = false): Promise<any[]> {
    const params: Record<string, any> = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      timezone: this.timezone,
      dbSource: DEFAULT_DB_SOURCE,
      dimensions: 'date-hour-strategisCampaignId-keyword',
    };
    // Only include networkId filter if we want a specific network (default behavior)
    // If includeAllNetworks=true, omit networkId to get all platforms
    if (!includeAllNetworks && this.networkId) {
      params.networkId = this.networkId;
    }
    const payload = await this.client.get('/api/s1/report/hourly-v3', params);
    return extractRows(payload);
  }

  /**
   * Fetch S1 session-level revenue data (includes keywords)
   * @param date Date string (YYYY-MM-DD)
   * @param filterZero Whether to filter out zero-revenue sessions (default: false)
   * @returns Array of session records with keyword, campaign_id, revenue, etc.
   */
  async fetchS1SessionRevenue(date: string, filterZero: boolean = false): Promise<any[]> {
    const params: Record<string, any> = {
      date,
      filterZero: filterZero ? '1' : '0',
      incremental: '1',
      limit: '-1',
      offset: '0',
      output: 'json',
    };
    const payload = await this.client.get('/api/s1/report/get-session-rev', params);
    return extractRows(payload);
  }

  async fetchS1RpcAverage(date: string): Promise<any[]> {
    const params = {
      date,
      days: DEFAULT_RPC_DAYS,
      organization: this.organization,
      adSource: this.adSource,
      networkId: this.networkId,
      timezone: this.timezone,
      dimensions: 'strategisCampaignId',
    };
    const payload = await this.client.get('/api/s1/rpc-average', params);
    return extractRows(payload);
  }

  async fetchFacebookPixelReport(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      networkName: 'facebook',
      dimensions: 'date-strategisCampaignId',
      timezone: this.timezone,
    };
    const payload = await this.client.get('/api/facebook-pixel-report', params);
    return extractRows(payload);
  }

  async fetchStrategisMetrics(date: string, networkName?: string): Promise<any[]> {
    const params: Record<string, any> = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      timezone: this.timezone,
      dimensions: 'date-strategisCampaignId',
    };
    if (networkName) {
      params.networkName = networkName;
    }
    const payload = await this.client.get('/api/strategis-report', params);
    return extractRows(payload);
  }

  // Platform-specific spend endpoints

  async fetchTaboolaReport(date: string): Promise<any[]> {
    /**
     * Taboola spend data
     *
     * NOTE:
     * - We intentionally call Strategis' cached campaign summary endpoint instead of the
     *   low-level Taboola proxy to avoid 502s from Taboola and to let Strategis own the
     *   dimension mapping.
     * - Do NOT pass Taboola-specific `dimension` strings like `date-strategisCampaignId`
     *   here – the Strategis backend will choose appropriate dimensions based on this
     *   summary endpoint.
     *
     * Upstream reference: Taboola dimensions cheat sheet
     * (see Strategis backend for exact mapping).
     */
    const params: Record<string, any> = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      cached: 1,
    };
    const payload = await this.client.get('/api/taboola/campaign-summary-report', params);
    return extractRows(payload);
  }

  async fetchOutbrainHourlyReport(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
    };
    const payload = await this.client.get('/api/outbrain-hourly-report', params);
    return extractRows(payload);
  }

  async fetchNewsbreakReport(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      dimensions: 'date-strategisCampaignId',
    };
    const payload = await this.client.get('/api/newsbreak/report', params);
    return extractRows(payload);
  }

  async fetchMediaGoReport(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      timezone: this.timezone,
      dimensions: 'date-strategisCampaignId',
    };
    const payload = await this.client.get('/api/mediago/report', params);
    return extractRows(payload);
  }

  async fetchZemantaReconciledReport(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      dimensions: 'date-strategisCampaignId',
      dbSource: 'level', // Zemanta uses level DB
    };
    const payload = await this.client.get('/api/zemanta/reconciled-report', params);
    return extractRows(payload);
  }

  async fetchSmartNewsReport(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      dimensions: 'date-strategisCampaignId',
    };
    const payload = await this.client.get('/api/smartnews/report', params);
    return extractRows(payload);
  }

  async fetchGoogleAdsReport(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      timezone: this.timezone,
      dimensions: 'date-strategisCampaignId',
    };
    const payload = await this.client.get('/api/googleads/report', params);
    return extractRows(payload);
  }
}

export function extractRows(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
  return [];
}
