import 'dotenv/config';
import { csvToManualMappings } from '../services/csvToMappings';
import { getPageIdsFromDiscoveryRuns } from '../services/discoveryPageIndex';
import { fetchAdsForPages } from '../services/metaAdsService';

async function main() {
  const csvPath = process.argv[2] || 'runs/system1/2025-11-07/top_rps_keywords_by_slug_no_leadgen.csv';
  const discoveryRun = process.argv[3] || '2025-10-21_40libs';
  const limitRows = process.argv[4] ? parseInt(process.argv[4], 10) : 31; // Default to first 31 rows

  console.log(`\n=== Testing Slug Connections ===\n`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Discovery Run: ${discoveryRun}`);
  console.log(`Limiting to first ${limitRows} rows\n`);

  // Convert CSV to mappings
  console.log('Converting CSV to mappings...');
  let mappings = csvToManualMappings(csvPath);
  
  // Limit to first N rows if specified
  if (limitRows > 0) {
    // Read CSV to get first N rows
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.resolve(process.cwd(), csvPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n').filter((l: string) => l.trim());
    const limitedLines = lines.slice(0, limitRows + 1); // +1 for header
    
    // Write temp CSV
    const tempPath = path.join(process.cwd(), 'temp_mappings.csv');
    fs.writeFileSync(tempPath, limitedLines.join('\n'));
    
    // Re-read with limited rows
    mappings = csvToManualMappings(tempPath);
    fs.unlinkSync(tempPath);
  }

  console.log(`Created ${mappings.length} slug mappings`);
  console.log(`Total keywords: ${mappings.reduce((sum, m) => sum + m.keywords.length, 0)}\n`);

  // Show sample mappings
  console.log('Sample mappings (first 5):');
  mappings.slice(0, 5).forEach((m, i) => {
    console.log(`  ${i + 1}. Slug: ${m.slugs[0]}`);
    console.log(`     Keywords (${m.keywords.length}): ${m.keywords.slice(0, 3).join(', ')}${m.keywords.length > 3 ? '...' : ''}`);
  });
  console.log('');

  // Get page IDs from discovery run
  console.log(`Extracting page IDs from discovery run: ${discoveryRun}...`);
  const pageIds = getPageIdsFromDiscoveryRuns(discoveryRun);
  console.log(`Found ${pageIds.length} page IDs\n`);

  if (pageIds.length === 0) {
    console.error('No page IDs found!');
    process.exit(1);
  }

  // Fetch ads with manual mappings
  console.log('Fetching ads with manual mappings...');
  console.log('(This may take a while depending on number of pages)\n');
  
  const ads = await fetchAdsForPages({
    discoveryRun,
    active_status: 'active',
    platforms: 'facebook,instagram',
    manualMappings: mappings
  });

  console.log(`\n=== Results ===\n`);
  console.log(`Total ads fetched: ${ads.length}`);
  
  // Count ads with matching slugs
  const adsWithSlugs = ads.filter(ad => ad.matching_slugs && ad.matching_slugs.length > 0);
  console.log(`Ads with matching slugs: ${adsWithSlugs.length}\n`);

  // Show slug connections summary
  const slugConnections: Record<string, {
    slug: string;
    ads: any[];
    pageIds: Set<string>;
    keywords: Set<string>;
  }> = {};

  for (const ad of adsWithSlugs) {
    if (ad.matching_slugs) {
      for (const slugMatch of ad.matching_slugs) {
        if (!slugConnections[slugMatch.slug]) {
          slugConnections[slugMatch.slug] = {
            slug: slugMatch.slug,
            ads: [],
            pageIds: new Set(),
            keywords: new Set(slugMatch.matching_keywords)
          };
        }
        slugConnections[slugMatch.slug].ads.push(ad);
        slugConnections[slugMatch.slug].pageIds.add(ad.page_id);
      }
    }
  }

  const sortedSlugs = Object.values(slugConnections)
    .sort((a, b) => b.ads.length - a.ads.length);

  console.log(`\n=== Slug Connections (${sortedSlugs.length} slugs found) ===\n`);
  sortedSlugs.slice(0, 10).forEach((conn, i) => {
    console.log(`${i + 1}. ${conn.slug}`);
    console.log(`   Ads: ${conn.ads.length} | Pages: ${conn.pageIds.size}`);
    console.log(`   Sample keywords: ${Array.from(conn.keywords).slice(0, 3).join(', ')}`);
    if (conn.ads.length > 0) {
      const sampleAd = conn.ads[0];
      console.log(`   Sample ad: ${sampleAd.page_name || sampleAd.page_id} - ${sampleAd.hook || 'No hook'}`);
    }
    console.log('');
  });

  if (sortedSlugs.length === 0) {
    console.log('No matching slugs found. This could mean:');
    console.log('  - The keywords from CSV don\'t match keywords extracted from ad URLs');
    console.log('  - The slugs don\'t exist in the System1 data');
    console.log('  - The ads don\'t have matching keywords in their URLs');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

