#!/usr/bin/env ts-node

import 'dotenv/config';
import { StrategisApi } from '../../lib/strategisApi';

async function main() {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  const api = new StrategisApi();
  
  console.log(`\n=== Inspecting Strategis API Responses for ${date} ===\n`);
  
  // Test Facebook Report
  console.log('1. Facebook Report (/api/facebook/report):');
  try {
    const fbReport = await api.fetchFacebookReport(date);
    if (fbReport.length > 0) {
      console.log(`   Rows: ${fbReport.length}`);
      console.log('   Sample row keys:', Object.keys(fbReport[0]));
      console.log('   Sample row:', JSON.stringify(fbReport[0], null, 2));
    } else {
      console.log('   No data returned');
    }
  } catch (err: any) {
    console.error('   Error:', err.message);
  }
  
  // Test Facebook Campaigns
  console.log('\n2. Facebook Campaigns (/api/facebook/campaigns):');
  try {
    const fbCampaigns = await api.fetchFacebookCampaigns(date);
    if (fbCampaigns.length > 0) {
      console.log(`   Rows: ${fbCampaigns.length}`);
      console.log('   Sample row keys:', Object.keys(fbCampaigns[0]));
      console.log('   Sample row:', JSON.stringify(fbCampaigns[0], null, 2));
      // Check for owner/lane/category
      const hasOwner = fbCampaigns.some((r: any) => r.owner || r.buyer);
      const hasLane = fbCampaigns.some((r: any) => r.lane);
      const hasCategory = fbCampaigns.some((r: any) => r.category);
      console.log(`   Has owner/buyer: ${hasOwner}`);
      console.log(`   Has lane: ${hasLane}`);
      console.log(`   Has category: ${hasCategory}`);
    } else {
      console.log('   No data returned');
    }
  } catch (err: any) {
    console.error('   Error:', err.message);
  }
  
  // Test S1 Daily (check for source/networkName)
  console.log('\n3. S1 Daily (/api/s1/report/daily-v3):');
  try {
    const s1Daily = await api.fetchS1Daily(date);
    if (s1Daily.length > 0) {
      console.log(`   Rows: ${s1Daily.length}`);
      console.log('   Sample row keys:', Object.keys(s1Daily[0]));
      console.log('   Sample row:', JSON.stringify(s1Daily[0], null, 2));
      // Check for source/networkName
      const hasSource = s1Daily.some((r: any) => r.source || r.networkName || r.network_name);
      console.log(`   Has source/networkName: ${hasSource}`);
      if (hasSource) {
        const sources = new Set(s1Daily.map((r: any) => r.source || r.networkName || r.network_name).filter(Boolean));
        console.log(`   Unique sources: ${Array.from(sources).join(', ')}`);
      }
    } else {
      console.log('   No data returned');
    }
  } catch (err: any) {
    console.error('   Error:', err.message);
  }
  
  // Test S1 Hourly (check for source/networkName)
  console.log('\n4. S1 Hourly (/api/s1/report/hourly-v3):');
  try {
    const s1Hourly = await api.fetchS1Hourly(date);
    if (s1Hourly.length > 0) {
      console.log(`   Rows: ${s1Hourly.length}`);
      console.log('   Sample row keys:', Object.keys(s1Hourly[0]));
      console.log('   Sample row:', JSON.stringify(s1Hourly[0], null, 2));
      // Check for source/networkName
      const hasSource = s1Hourly.some((r: any) => r.source || r.networkName || r.network_name);
      console.log(`   Has source/networkName: ${hasSource}`);
      if (hasSource) {
        const sources = new Set(s1Hourly.map((r: any) => r.source || r.networkName || r.network_name).filter(Boolean));
        console.log(`   Unique sources: ${Array.from(sources).join(', ')}`);
      }
    } else {
      console.log('   No data returned');
    }
  } catch (err: any) {
    console.error('   Error:', err.message);
  }
  
  console.log('\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

