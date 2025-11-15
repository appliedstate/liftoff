import fs from 'fs';
import path from 'path';
import DuckDB from 'duckdb';

function getArg(name: string, def?: string): string | undefined {
  const flag = `--${name}=`;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(flag)) return a.substring(flag.length);
  }
  return def;
}

async function queryCsv(csvPath: string, sql: string): Promise<any[]> {
  const db = new DuckDB.Database(':memory:');
  const conn = db.connect();
  
  return new Promise((resolve, reject) => {
    const escaped = csvPath.replace(/'/g, "''");
    conn.all(`
      CREATE TABLE t AS SELECT * FROM read_csv_auto('${escaped}', header=true, all_varchar=true, ignore_errors=true, delim=',', quote='"');
    `, (err: any) => {
      if (err) {
        conn.close();
        db.close();
        reject(err);
        return;
      }
      
      conn.all(sql, (err2: any, rows: any[]) => {
        conn.close();
        db.close();
        if (err2) {
          reject(err2);
        } else {
          resolve(rows || []);
        }
      });
    });
  });
}

async function main() {
  const clusterName = process.argv[2] || 'health/paid-depression-clinical-trials-up-to-3000-en-us';
  const runDate = process.argv[3] || '2025-11-07';
  const topN = parseInt(process.argv[4] || '20', 10);
  
  console.log(`\n=== Slug RPC & RPS Analysis ===\n`);
  console.log(`Cluster: ${clusterName}\n`);
  
  const baseDir = path.resolve(`./runs/system1/${runDate}`);
  const clusterMembersPath = path.join(baseDir, 'slug_clusters_by_embedding_members.csv');
  
  if (!fs.existsSync(clusterMembersPath)) {
    console.error(`Cluster members file not found: ${clusterMembersPath}`);
    process.exit(1);
  }
  
  // Get slugs for this cluster
  const clusterMembers = await queryCsv(clusterMembersPath, `
    SELECT slug FROM t WHERE cluster_name = '${clusterName.replace(/'/g, "''")}'
  `);
  const slugs = clusterMembers.map((r: any) => r.slug);
  
  console.log(`Found ${slugs.length} slugs in cluster\n`);
  
  // Find source CSV file
  const sourceDir = path.resolve(`./data/system1/incoming`);
  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${sourceDir}`);
    process.exit(1);
  }
  
  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);
  console.log(`Using source file: ${csvFiles.sort().reverse()[0]}\n`);
  
  // Normalize slugs (try with and without trailing slash)
  const normalizedSlugs = slugs.map(s => {
    const trimmed = s.trim();
    return [trimmed, trimmed + '/', trimmed.replace(/\/$/, '')];
  }).flat();
  
  // Build WHERE clause
  const slugConditions = normalizedSlugs.map(s => {
    const escaped = s.replace(/'/g, "''");
    return `(LOWER(TRIM("CONTENT_SLUG")) = LOWER('${escaped}') OR LOWER(TRIM("CONTENT_SLUG")) = LOWER('${escaped}/'))`;
  }).join(' OR ');
  
  // Query slug metrics
  const slugMetrics = await queryCsv(csvPath, `
    SELECT 
      TRIM("CONTENT_SLUG") as slug,
      SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
      SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
      CAST(COUNT(*) AS INTEGER) as searches
    FROM t
    WHERE (${slugConditions})
      AND TRIM("CONTENT_SLUG") != ''
      AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
    GROUP BY slug
    HAVING SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) > 0
      AND COUNT(*) > 0
    ORDER BY revenue DESC
  `);
  
  console.log(`Found ${slugMetrics.length} slugs with revenue\n`);
  
  // Process and calculate RPC/RPS
  const slugsWithMetrics: Array<{
    slug: string;
    revenue: number;
    clicks: number;
    searches: number;
    rpc: number;
    rps: number;
  }> = slugMetrics.map((r: any) => {
    const revenue = Number(r.revenue || 0);
    const clicks = Number(r.clicks || 0);
    const searches = Number(r.searches || 0);
    const rpc = clicks > 0 ? revenue / clicks : 0;
    const rps = searches > 0 ? revenue / searches : 0;
    
    return {
      slug: String(r.slug || '').trim(),
      revenue,
      clicks,
      searches,
      rpc,
      rps,
    };
  });
  
  // Sort by RPC
  const sortedByRPC = [...slugsWithMetrics].sort((a, b) => b.rpc - a.rpc);
  
  // Sort by RPS
  const sortedByRPS = [...slugsWithMetrics].sort((a, b) => b.rps - a.rps);
  
  console.log(`\n🏆 TOP ${topN} SLUGS BY RPC (Revenue Per Click):\n`);
  console.log('Rank | Slug | Revenue | Clicks | Searches | RPC | RPS');
  console.log('-----|------|---------|--------|----------|-----|-----');
  
  sortedByRPC.slice(0, topN).forEach((s, idx) => {
    const rank = (idx + 1).toString().padStart(4);
    const slug = s.slug.length > 50 ? s.slug.substring(0, 47) + '...' : s.slug;
    const revenue = `$${s.revenue.toFixed(2)}`.padStart(8);
    const clicks = s.clicks.toFixed(0).padStart(6);
    const searches = s.searches.toString().padStart(8);
    const rpc = `$${s.rpc.toFixed(4)}`.padStart(5);
    const rps = `$${s.rps.toFixed(4)}`.padStart(5);
    console.log(`${rank} | ${slug.padEnd(50)} | ${revenue} | ${clicks} | ${searches} | ${rpc} | ${rps}`);
  });
  
  console.log(`\n\n🏆 TOP ${topN} SLUGS BY RPS (Revenue Per Search):\n`);
  console.log('Rank | Slug | Revenue | Clicks | Searches | RPC | RPS');
  console.log('-----|------|---------|--------|----------|-----|-----');
  
  sortedByRPS.slice(0, topN).forEach((s, idx) => {
    const rank = (idx + 1).toString().padStart(4);
    const slug = s.slug.length > 50 ? s.slug.substring(0, 47) + '...' : s.slug;
    const revenue = `$${s.revenue.toFixed(2)}`.padStart(8);
    const clicks = s.clicks.toFixed(0).padStart(6);
    const searches = s.searches.toString().padStart(8);
    const rpc = `$${s.rpc.toFixed(4)}`.padStart(5);
    const rps = `$${s.rps.toFixed(4)}`.padStart(5);
    console.log(`${rank} | ${slug.padEnd(50)} | ${revenue} | ${clicks} | ${searches} | ${rpc} | ${rps}`);
  });
  
  // Summary stats
  const totalRevenue = slugsWithMetrics.reduce((sum, s) => sum + s.revenue, 0);
  const totalClicks = slugsWithMetrics.reduce((sum, s) => sum + s.clicks, 0);
  const totalSearches = slugsWithMetrics.reduce((sum, s) => sum + s.searches, 0);
  const avgRPC = totalClicks > 0 ? totalRevenue / totalClicks : 0;
  const avgRPS = totalSearches > 0 ? totalRevenue / totalSearches : 0;
  
  console.log(`\n\n📊 SUMMARY STATISTICS:\n`);
  console.log(`Total Slugs: ${slugsWithMetrics.length}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Total Clicks: ${totalClicks.toFixed(0)}`);
  console.log(`Total Searches: ${totalSearches}`);
  console.log(`Average RPC: $${avgRPC.toFixed(4)}`);
  console.log(`Average RPS: $${avgRPS.toFixed(4)}`);
  
  // Top performers in both metrics
  console.log(`\n\n⭐ TOP PERFORMERS (High RPC AND High RPS):\n`);
  const topPerformers = slugsWithMetrics
    .filter(s => s.rpc >= avgRPC && s.rps >= avgRPS)
    .sort((a, b) => (b.rpc + b.rps) - (a.rpc + a.rps))
    .slice(0, 10);
  
  topPerformers.forEach((s, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${s.slug}`);
    console.log(`    RPC: $${s.rpc.toFixed(4)} | RPS: $${s.rps.toFixed(4)} | Revenue: $${s.revenue.toFixed(2)}`);
  });
}

main().catch((err) => {
  console.error('slug_rpc_rps_analysis failed', err);
  process.exit(1);
});



