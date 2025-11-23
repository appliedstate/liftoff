#!/usr/bin/env ts-node

import 'dotenv/config';
import { StrategisApi } from '../../lib/strategisApi';

async function testEndpoint(name: string, fetchFn: () => Promise<any[]>): Promise<{ success: boolean; rows: number; error?: string }> {
  try {
    const rows = await fetchFn();
    return { success: true, rows: rows.length };
  } catch (err: any) {
    const errorMsg = err?.response?.status 
      ? `HTTP ${err.response.status}: ${err.response.statusText}`
      : err?.message || String(err).substring(0, 200);
    return { success: false, rows: 0, error: errorMsg };
  }
}

async function main() {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  console.log(`\n=== Testing All Strategis API Endpoints for ${date} ===\n`);
  
  const api = new StrategisApi();
  
  const tests: Array<{ name: string; fetch: () => Promise<any[]> }> = [
    // S1 Revenue & Metadata (Critical)
    { name: 'S1 Daily (all networks)', fetch: () => api.fetchS1Daily(date, true) },
    { name: 'S1 Reconciled (all networks)', fetch: () => api.fetchS1Reconciled(date, true) },
    { name: 'S1 RPC Average', fetch: () => api.fetchS1RpcAverage(date) },
    
    // Facebook Data
    { name: 'Facebook Report', fetch: () => api.fetchFacebookReport(date) },
    { name: 'Facebook Campaigns', fetch: () => api.fetchFacebookCampaigns(date) },
    { name: 'Facebook Adsets', fetch: () => api.fetchFacebookAdsets(date) },
    { name: 'Facebook Pixel', fetch: () => api.fetchFacebookPixelReport(date) },
    { name: 'Strategis Metrics (FB)', fetch: () => api.fetchStrategisMetrics(date, 'facebook') },
    
    // Platform Spend Data
    { name: 'Taboola Report', fetch: () => api.fetchTaboolaReport(date) },
    { name: 'Outbrain Hourly', fetch: () => api.fetchOutbrainHourlyReport(date) },
    { name: 'NewsBreak Report', fetch: () => api.fetchNewsbreakReport(date) },
    { name: 'MediaGo Report', fetch: () => api.fetchMediaGoReport(date) },
    { name: 'Zemanta Reconciled', fetch: () => api.fetchZemantaReconciledReport(date) },
    { name: 'SmartNews Report', fetch: () => api.fetchSmartNewsReport(date) },
    { name: 'GoogleAds Report', fetch: () => api.fetchGoogleAdsReport(date) },
  ];
  
  const results: Array<{ name: string; success: boolean; rows: number; error?: string }> = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test.name, test.fetch);
    results.push({ ...result, name: test.name });
    const status = result.success ? '✅' : '❌';
    const info = result.success 
      ? `${result.rows} rows`
      : `ERROR: ${result.error}`;
    console.log(`${status} ${test.name.padEnd(35)} ${info}`);
  }
  
  console.log('\n=== Summary ===\n');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Total endpoints: ${results.length}`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log('\nFailed endpoints:');
    failed.forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
  }
  
  console.log('\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

