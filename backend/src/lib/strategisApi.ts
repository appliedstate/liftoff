import { StrategistClient, createStrategisApiClient } from './strategistClient';

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

  async fetchS1Daily(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      networkId: this.networkId,
      timezone: this.timezone,
      dbSource: DEFAULT_DB_SOURCE,
      dimensions: 'date-strategisCampaignId',
    };
    const payload = await this.client.get('/api/s1/report/daily-v3', params);
    return extractRows(payload);
  }

  async fetchS1Hourly(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      networkId: this.networkId,
      timezone: this.timezone,
      dbSource: DEFAULT_DB_SOURCE,
      dimensions: 'date-hour-strategisCampaignId',
    };
    const payload = await this.client.get('/api/s1/report/hourly-v3', params);
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

  async fetchStrategisMetrics(date: string): Promise<any[]> {
    const params = {
      ...this.singleDayRange(date),
      organization: this.organization,
      adSource: this.adSource,
      networkName: 'facebook',
      dbSource: DEFAULT_DB_SOURCE,
      timezone: this.timezone,
      dimensions: 'date-strategisCampaignId',
    };
    const payload = await this.client.get('/api/strategis-report', params);
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
