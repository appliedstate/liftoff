import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import https from 'https';

type StrategistClientOptions = {
  apiBaseUrl?: string;
  ixIdBaseUrl?: string;
  email?: string;
  password?: string;
  allowSelfSigned?: boolean;
};

function decodeJwtExpiration(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }
  return null;
}

export class StrategistClient {
  private readonly apiBaseUrl: string;
  private readonly ixIdBaseUrl: string;
  private readonly email: string;
  private readonly password: string;
  private readonly http: AxiosInstance;
  private authToken: string | null = null;
  private authExpiry: number | null = null;

  constructor(opts: StrategistClientOptions = {}) {
    this.apiBaseUrl = opts.apiBaseUrl || process.env.STRATEGIST_API_BASE_URL || 'https://strategist.lincx.la';
    this.ixIdBaseUrl = opts.ixIdBaseUrl || process.env.IX_ID_BASE_URL || 'https://ix-id.lincx.la';
    this.email = opts.email || process.env.IX_ID_EMAIL || '';
    this.password = opts.password || process.env.IX_ID_PASSWORD || '';
    if (!this.email || !this.password) {
      throw new Error('IX_ID_EMAIL and IX_ID_PASSWORD must be set (env or options) to use StrategistClient');
    }
    const allowSelfSigned =
      typeof opts.allowSelfSigned === 'boolean'
        ? opts.allowSelfSigned
        : process.env.STRATEGIST_ALLOW_SELF_SIGNED === '1';
    this.http = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 120000,
      httpsAgent: allowSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : undefined,
    });
  }

  private isTokenValid(): boolean {
    if (!this.authToken) return false;
    if (!this.authExpiry) return true;
    return Date.now() + 30_000 < this.authExpiry; // refresh 30s before expiry
  }

  private async login(): Promise<void> {
    const url = `${this.ixIdBaseUrl}/auth/login`;
    const payload = { email: this.email, password: this.password };
    const resp = await axios.post(url, payload, { timeout: 60000 });
    const token = resp.data?.data?.authToken || resp.data?.authToken;
    if (!token || typeof token !== 'string') {
      throw new Error('StrategistClient login failed: authToken missing in response');
    }
    this.authToken = token;
    this.authExpiry = decodeJwtExpiration(token);
  }

  private async ensureToken(): Promise<void> {
    if (this.isTokenValid()) return;
    await this.login();
  }

  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    await this.ensureToken();
    const headers = Object.assign({}, config.headers, {
      Authorization: `Bearer ${this.authToken}`,
    });
    return this.http.request<T>({ ...config, headers });
  }

  async get<T = any>(path: string, params?: Record<string, any>, responseType: AxiosRequestConfig['responseType'] = 'json'): Promise<T> {
    const resp = await this.request<T>({
      method: 'GET',
      url: path,
      params,
      responseType,
    });
    return resp.data;
  }
}

export function createStrategistClient(): StrategistClient {
  return new StrategistClient();
}

export function createStrategisApiClient(): StrategistClient {
  return new StrategistClient({
    apiBaseUrl: process.env.STRATEGIS_API_BASE_URL || 'https://strategis.lincx.in',
    ixIdBaseUrl: process.env.STRATEGIS_AUTH_BASE_URL || process.env.IX_ID_BASE_URL || 'https://ix-id.lincx.la',
    allowSelfSigned:
      process.env.STRATEGIS_ALLOW_SELF_SIGNED === '1' ||
      process.env.STRATEGIST_ALLOW_SELF_SIGNED === '1',
  });
}

