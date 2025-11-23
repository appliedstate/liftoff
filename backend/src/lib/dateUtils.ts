/**
 * Date utility functions for consistent timezone handling
 * 
 * IMPORTANT: Strategis API uses UTC timezone, so all dates stored in campaign_index
 * are UTC dates. When querying, we need to convert PST dates to UTC dates.
 */

/**
 * Get today's date in UTC (YYYY-MM-DD)
 * This matches what the Strategis API uses and what's stored in campaign_index
 */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get yesterday's date in UTC (YYYY-MM-DD)
 */
export function yesterdayUtc(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Get a date N days ago in UTC (YYYY-MM-DD)
 */
export function getDaysAgoUtc(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Convert a PST date string (YYYY-MM-DD) to UTC date string (YYYY-MM-DD)
 * 
 * Example: If it's Nov 22 PST (8am PST = 4pm UTC), we need to check both
 * Nov 22 UTC and Nov 23 UTC because PST is UTC-8
 */
export function pstToUtcDate(pstDate: string): string[] {
  // Parse PST date
  const [year, month, day] = pstDate.split('-').map(Number);
  
  // Create date at midnight PST
  const pstMidnight = new Date(Date.UTC(year, month - 1, day, 8, 0, 0)); // PST is UTC-8, so midnight PST = 8am UTC
  
  // Get UTC date
  const utcDate = pstMidnight.toISOString().slice(0, 10);
  
  // Also check the previous UTC date (in case PST date spans two UTC days)
  const prevUtcDate = new Date(pstMidnight);
  prevUtcDate.setUTCDate(prevUtcDate.getUTCDate() - 1);
  const prevUtcDateStr = prevUtcDate.toISOString().slice(0, 10);
  
  // Return both dates (most data will be in the main UTC date)
  return [utcDate, prevUtcDateStr];
}

/**
 * Get PST date from a Date object (for display purposes)
 */
export function getPSTDate(date: Date): string {
  const pstDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return pstDate.toISOString().slice(0, 10);
}

/**
 * Get today's date in PST (for display/input purposes)
 */
export function getTodayPST(): string {
  return getPSTDate(new Date());
}

/**
 * Get yesterday's date in PST (for display/input purposes)
 */
export function getYesterdayPST(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return getPSTDate(date);
}

/**
 * Get date N days ago in PST (for display/input purposes)
 */
export function getDaysAgoPST(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getPSTDate(date);
}

