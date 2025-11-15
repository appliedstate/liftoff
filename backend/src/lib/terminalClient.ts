/**
 * Terminal HTTP Client
 * 
 * Client for interacting with Terminal execution service in strategis-api:
 * - POST /api/terminal/execute - Execute Decision objects
 * - GET /api/terminal/state - Get cooldowns and policy state
 * - POST /api/terminal/simulate - Dry-run validation
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Decision } from './decisions';
import crypto from 'crypto';

export interface TerminalExecuteRequest {
  decisions: Decision[];
  idempotencyKey: string;
  dryRun?: boolean;
  correlationId?: string;
}

export interface TerminalExecuteResponse {
  executionId: string;
  acceptedCount: number;
  rejectedCount: number;
  results: Array<{
    decision_id: string;
    status: 'success' | 'failed' | 'rejected';
    error?: string;
    guard_type?: 'cooldown' | 'freeze' | 'learning' | 'portfolio_cap' | 'validation';
    changes?: {
      current_budget?: number;
      new_budget?: number;
      current_bid_cap?: number;
      new_bid_cap?: number;
    };
  }>;
}

export interface TerminalStateResponse {
  cooldowns: Array<{
    level: 'adset' | 'campaign';
    id: string;
    action: string;
    expires_at: string;
  }>;
  policyVersion: string;
  lastUpdated: string;
}

export interface TerminalSimulateResponse {
  simulated: boolean;
  results: TerminalExecuteResponse['results'];
}

/**
 * Generate idempotency key from decisions
 */
export function generateIdempotencyKey(decisions: Decision[]): string {
  const key = decisions
    .map(d => `${d.account_id}:${d.level}:${d.id}:${d.action}:${d.date}`)
    .sort()
    .join('|');
  return crypto.createHash('sha256').update(key).digest('hex');
}

export class TerminalClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.TERMINAL_API_BASE_URL || 'https://api.strategis.internal';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${process.env.TERMINAL_API_KEY || ''}`,
        'Content-Type': 'application/json',
      },
      timeout: Number(process.env.TERMINAL_API_TIMEOUT || 30000),
    });

    // Add retry interceptor for network errors and 5xx
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as any;
        if (!config || !config.retry) config.retry = 0;
        config.retryCount = config.retryCount || 0;

        // Retry on network errors and 5xx
        if (
          (!error.response || error.response.status >= 500) &&
          config.retryCount < 3
        ) {
          config.retryCount += 1;
          const delay = Math.min(1000 * Math.pow(2, config.retryCount - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.client(config);
        }

        // Handle rate limits
        if (error.response?.status === 429) {
          const retryAfter = Number(error.response.headers['retry-after'] || 60);
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Execute Decision objects via Terminal
   */
  async executeDecisions(request: TerminalExecuteRequest): Promise<TerminalExecuteResponse> {
    try {
      const response = await this.client.post<TerminalExecuteResponse>(
        '/api/terminal/execute',
        request
      );
      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Terminal API error (${error.response?.status}): ${JSON.stringify(error.response?.data)}`
        );
      }
      throw error;
    }
  }

  /**
   * Get current Terminal state (cooldowns, policy)
   */
  async getState(): Promise<TerminalStateResponse> {
    try {
      const response = await this.client.get<TerminalStateResponse>('/api/terminal/state');
      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Terminal API error (${error.response?.status}): ${JSON.stringify(error.response?.data)}`
        );
      }
      throw error;
    }
  }

  /**
   * Simulate execution (dry-run validation)
   */
  async simulate(decisions: Decision[], correlationId?: string): Promise<TerminalSimulateResponse> {
    try {
      const response = await this.client.post<TerminalSimulateResponse>(
        '/api/terminal/simulate',
        {
          decisions,
          correlationId: correlationId || `simulate-${Date.now()}`,
        }
      );
      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Terminal API error (${error.response?.status}): ${JSON.stringify(error.response?.data)}`
        );
      }
      throw error;
    }
  }
}

// Export singleton instance
export const terminalClient = new TerminalClient();

