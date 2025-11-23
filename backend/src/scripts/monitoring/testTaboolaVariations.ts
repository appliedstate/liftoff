#!/usr/bin/env ts-node

/**
 * Test script to try different parameter combinations for Taboola endpoint
 * Based on Devin's recommendations to diagnose the 502 Bad Gateway error
 */

import 'dotenv/config';
import { StrategisApi } from '../../lib/strategisApi';
import { StrategistClient } from '../../lib/strategistClient';

async function testTaboolaVariation(
  name: string,
  testFn: () => Promise<any[]>
): Promise<{ success: boolean; rows: number; error?: string; httpStatus?: number }> {
  try {
    const rows = await testFn();
    return { success: true, rows: rows.length };
  } catch (err: any) {
    const httpStatus = err?.response?.status;
    const errorMsg = err?.response?.statusText || err?.message || String(err).substring(0, 200);
    return { success: false, rows: 0, error: errorMsg, httpStatus };
  }
}

async function main() {
  const date = process.argv[2] || '2025-11-16'; // Default to historical date
  const api = new StrategisApi();
  
  console.log(`\n=== Testing Taboola Endpoint Variations for ${date} ===\n`);
  console.log('Based on Devin\'s recommendations:\n');
  
  const tests: Array<{ name: string; test: () => Promise<any[]> }> = [
    // Test 1: Current implementation (baseline)
    {
      name: 'Current: dimension (singular)',
      test: async () => {
        const params = {
          dateStart: date,
          dateEnd: date,
          organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
          adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
          dimension: 'date-strategisCampaignId',
        };
        const client = (api as any).client as StrategistClient;
        const payload = await client.get('/api/taboola/report', params);
        return Array.isArray(payload) ? payload : payload?.data || payload?.rows || [];
      },
    },
    
    // Test 2: Try dimensions (plural)
    {
      name: 'Try: dimensions (plural)',
      test: async () => {
        const params = {
          dateStart: date,
          dateEnd: date,
          organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
          adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
          dimensions: 'date-strategisCampaignId', // plural
        };
        const client = (api as any).client as StrategistClient;
        const payload = await client.get('/api/taboola/report', params);
        return Array.isArray(payload) ? payload : payload?.data || payload?.rows || [];
      },
    },
    
    // Test 3: Without adSource
    {
      name: 'Try: without adSource',
      test: async () => {
        const params = {
          dateStart: date,
          dateEnd: date,
          organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
          dimension: 'date-strategisCampaignId',
          // No adSource
        };
        const client = (api as any).client as StrategistClient;
        const payload = await client.get('/api/taboola/report', params);
        return Array.isArray(payload) ? payload : payload?.data || payload?.rows || [];
      },
    },
    
    // Test 4: With dbSource=ch (explicit ClickHouse)
    {
      name: 'Try: with dbSource=ch',
      test: async () => {
        const params = {
          dateStart: date,
          dateEnd: date,
          organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
          adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
          dimension: 'date-strategisCampaignId',
          dbSource: 'ch',
        };
        const client = (api as any).client as StrategistClient;
        const payload = await client.get('/api/taboola/report', params);
        return Array.isArray(payload) ? payload : payload?.data || payload?.rows || [];
      },
    },
    
    // Test 5: With dbSource=level (LevelDB fallback)
    {
      name: 'Try: with dbSource=level',
      test: async () => {
        const params = {
          dateStart: date,
          dateEnd: date,
          organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
          adSource: process.env.STRATEGIS_AD_SOURCE || 'rsoc',
          dimension: 'date-strategisCampaignId',
          dbSource: 'level',
        };
        const client = (api as any).client as StrategistClient;
        const payload = await client.get('/api/taboola/report', params);
        return Array.isArray(payload) ? payload : payload?.data || payload?.rows || [];
      },
    },
    
    // Test 6: Minimal parameters
    {
      name: 'Try: minimal params (date + org only)',
      test: async () => {
        const params = {
          dateStart: date,
          dateEnd: date,
          organization: process.env.STRATEGIS_ORGANIZATION || 'Interlincx',
        };
        const client = (api as any).client as StrategistClient;
        const payload = await client.get('/api/taboola/report', params);
        return Array.isArray(payload) ? payload : payload?.data || payload?.rows || [];
      },
    },
  ];
  
  const results: Array<{ name: string; success: boolean; rows: number; error?: string; httpStatus?: number }> = [];
  
  for (const test of tests) {
    const result = await testTaboolaVariation(test.name, test.test);
    results.push({ ...result, name: test.name });
    const status = result.success ? '✅' : '❌';
    const info = result.success 
      ? `${result.rows} rows`
      : `HTTP ${result.httpStatus || 'unknown'}: ${result.error}`;
    console.log(`${status} ${test.name.padEnd(45)} ${info}`);
  }
  
  console.log('\n=== Summary ===\n');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Total variations tested: ${results.length}`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ Working variations:');
    successful.forEach(r => {
      console.log(`  - ${r.name}: ${r.rows} rows`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed variations:');
    failed.forEach(r => {
      console.log(`  - ${r.name}: HTTP ${r.httpStatus || 'unknown'} - ${r.error}`);
    });
  }
  
  console.log('\n💡 Recommendations:');
  if (successful.length > 0) {
    console.log('  - Update ingestCampaignIndex.ts to use the working parameter combination');
  } else {
    console.log('  - All variations failed - likely upstream Taboola API issue or Strategis application error');
    console.log('  - Check Strategis application logs for detailed error messages');
    console.log('  - Verify Taboola upstream API status');
  }
  
  console.log('\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

