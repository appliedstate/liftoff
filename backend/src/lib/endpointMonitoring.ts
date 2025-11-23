/**
 * Endpoint monitoring utilities based on Devin's recommendations:
 * - Retry logic for transient failures
 * - Data quality checks (row counts, non-zero values)
 * - Completeness tracking
 */

export type EndpointStatus = 'OK' | 'PARTIAL' | 'FAILED';

export interface EndpointResult {
  success: boolean;
  rows: any[];
  rowCount: number;
  hasRevenue: boolean;
  hasSpend: boolean;
  error?: string;
  httpStatus?: number;
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [502, 503, 504, 408], // Bad Gateway, Service Unavailable, Gateway Timeout, Request Timeout
};

/**
 * Retry a function with exponential backoff for transient failures
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const httpStatus = err?.response?.status;
      
      // Don't retry if it's not a retryable status
      if (httpStatus && !opts.retryableStatuses.includes(httpStatus)) {
        throw err;
      }
      
      // Don't retry on last attempt
      if (attempt >= opts.maxRetries) {
        throw err;
      }
      
      // Exponential backoff: delay = initialDelay * 2^attempt, capped at maxDelay
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(2, attempt),
        opts.maxDelayMs
      );
      
      console.warn(
        `[endpointMonitoring] Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms (HTTP ${httpStatus || 'unknown'})`
      );
      
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Retry exhausted');
}

/**
 * Check data quality of endpoint results
 */
export function checkDataQuality(
  rows: any[],
  endpointName: string,
  expectedMinRows?: number
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Check row count
  if (rows.length === 0) {
    warnings.push(`${endpointName}: Zero rows returned (may indicate data gap or API issue)`);
  } else if (expectedMinRows && rows.length < expectedMinRows * 0.5) {
    warnings.push(
      `${endpointName}: Row count (${rows.length}) is <50% of expected minimum (${expectedMinRows})`
    );
  }
  
  // Check for required fields
  const hasCampaignId = rows.some((r) => r.strategisCampaignId || r.campaignId || r.campaign_id);
  if (!hasCampaignId && rows.length > 0) {
    warnings.push(`${endpointName}: No campaign IDs found in response`);
  }
  
  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

/**
 * Extract revenue and spend indicators from rows
 */
export function extractFinancialIndicators(rows: any[]): {
  hasRevenue: boolean;
  hasSpend: boolean;
} {
  const revenueFields = ['revenue', 'revenue_usd', 'estimated_revenue', 'revenueUsd'];
  const spendFields = ['spend', 'spend_usd', 'spent', 'cost', 'cost_usd'];
  
  const hasRevenue = rows.some((r) =>
    revenueFields.some((field) => {
      const val = r[field];
      return val !== null && val !== undefined && Number(val) > 0;
    })
  );
  
  const hasSpend = rows.some((r) =>
    spendFields.some((field) => {
      const val = r[field];
      return val !== null && val !== undefined && Number(val) > 0;
    })
  );
  
  return { hasRevenue, hasSpend };
}

/**
 * Determine endpoint status based on result
 */
export function determineStatus(result: EndpointResult, isCritical: boolean): EndpointStatus {
  if (!result.success) {
    return 'FAILED';
  }
  
  if (result.rowCount === 0) {
    // Zero rows might be OK for optional endpoints, but PARTIAL for critical
    return isCritical ? 'PARTIAL' : 'OK';
  }
  
  return 'OK';
}

/**
 * Get platform name from endpoint label
 */
export function getPlatformFromEndpoint(endpointLabel: string): string | null {
  const platformMap: Record<string, string> = {
    taboola_report: 'taboola',
    outbrain_report: 'outbrain',
    newsbreak_report: 'newsbreak',
    mediago_report: 'mediago',
    zemanta_report: 'zemanta',
    smartnews_report: 'smartnews',
    facebook_report: 'facebook',
    facebook_campaigns: 'facebook',
    facebook_adsets: 'facebook',
    facebook_pixel: 'facebook',
    strategis_metrics_fb: 'facebook',
    s1_daily_v3: 'all',
    s1_reconciled: 'all',
    s1_rpc_average: 'all',
  };
  
  return platformMap[endpointLabel] || null;
}

