import { getPgPool } from '../../lib/pg';
import fs from 'fs';
import path from 'path';

function getArg(name: string, def?: string): string | undefined {
  const flag = `--${name}=`;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(flag)) return a.substring(flag.length);
  }
  return def;
}

function getOutputDir(): string {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const out = path.resolve(__dirname, '../../../runs/system1', iso);
  if (!fs.existsSync(out)) {
    fs.mkdirSync(out, { recursive: true });
  }
  return out;
}

// Cluster naming strategies
type ClusterNamingStrategy = 'top_revenue' | 'representative' | 'semantic_label';

function nameCluster(
  slugs: Array<{ slug: string; revenue: number; clicks: number; keyword_count: number }>,
  strategy: ClusterNamingStrategy = 'top_revenue'
): string {
  if (slugs.length === 0) return 'Unnamed Cluster';
  if (slugs.length === 1) return slugs[0].slug;

  switch (strategy) {
    case 'top_revenue':
      // Use the slug with highest revenue as cluster name
      const topByRevenue = slugs.slice().sort((a, b) => b.revenue - a.revenue)[0];
      return topByRevenue.slug;

    case 'representative':
      // Use the shortest slug (often most general/representative)
      const shortest = slugs.slice().sort((a, b) => a.slug.length - b.slug.length)[0];
      return shortest.slug;

    case 'semantic_label':
      // Extract common prefix/suffix patterns
      // For now, use top revenue but could be enhanced with NLP
      const top = slugs.slice().sort((a, b) => b.revenue - a.revenue)[0];
      // Extract domain/category from slug (e.g., "health/botox" from "health/botox-treatments")
      const parts = top.slug.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
      return top.slug;

    default:
      return slugs[0].slug;
  }
}

async function main() {
  const runDate = getArg('runDate');
  const similarityThreshold = parseFloat(getArg('threshold') || '0.7');
  const minClusterSize = parseInt(getArg('minSize') || '2', 10);
  const namingStrategy = (getArg('naming') || 'top_revenue') as ClusterNamingStrategy;

  if (!runDate) {
    console.error('Missing --runDate (YYYY-MM-DD)');
    process.exit(1);
  }

  console.log(`\n=== Slug Clustering by Embedding ===\n`);
  console.log(`Run Date: ${runDate}`);
  console.log(`Similarity Threshold: ${similarityThreshold}`);
  console.log(`Min Cluster Size: ${minClusterSize}`);
  console.log(`Naming Strategy: ${namingStrategy}\n`);

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // Get all slugs with their embeddings and metrics
    const slugsResult = await client.query(`
      SELECT 
        slug,
        slug_norm,
        revenue,
        clicks,
        keyword_count,
        embedding
      FROM s1_slug_embeddings
      WHERE run_date = $1
      ORDER BY revenue DESC
    `, [runDate]);

    const slugs = slugsResult.rows;
    console.log(`Loaded ${slugs.length} slugs from database\n`);

    if (slugs.length === 0) {
      console.error('No slugs found. Run vector:embed-slugs first.');
      process.exit(1);
    }

    // Build similarity matrix and cluster using a simple approach:
    // 1. For each slug, find all other slugs with similarity > threshold
    // 2. Use Union-Find to merge connected slugs
    // 3. But this time, we require actual similarity, not just keyword overlap

    type UF = { parent: Map<string, string>; rank: Map<string, number> };
    
    function ufFind(x: string, uf: UF): string {
      const p = uf.parent.get(x) || x;
      if (p !== x) {
        const r = ufFind(p, uf);
        uf.parent.set(x, r);
        return r;
      }
      return x;
    }

    function ufUnion(a: string, b: string, uf: UF): void {
      const ra = ufFind(a, uf);
      const rb = ufFind(b, uf);
      if (ra === rb) return;
      const raRank = uf.rank.get(ra) || 0;
      const rbRank = uf.rank.get(rb) || 0;
      if (raRank < rbRank) {
        uf.parent.set(ra, rb);
      } else if (raRank > rbRank) {
        uf.parent.set(rb, ra);
      } else {
        uf.parent.set(rb, ra);
        uf.rank.set(ra, raRank + 1);
      }
    }

    const uf: UF = { parent: new Map(), rank: new Map() };
    const slugMap = new Map<string, typeof slugs[0]>();
    
    // Initialize Union-Find
    for (const slug of slugs) {
      const key = slug.slug_norm;
      uf.parent.set(key, key);
      slugMap.set(key, slug);
    }

    // Use PostgreSQL's vector similarity search efficiently
    // For each slug, find all similar slugs above threshold
    console.log('Finding similar slugs using vector similarity...');
    let connections = 0;
    const distanceThreshold = 1 - similarityThreshold; // Cosine distance threshold

    for (let i = 0; i < slugs.length; i++) {
      if (i % 100 === 0) {
        console.log(`  Progress: ${i}/${slugs.length} slugs processed...`);
      }

      const slug = slugs[i];
      const key = slug.slug_norm;

      // Find all slugs with cosine similarity > threshold
      // Cosine distance = 1 - cosine similarity
      // So: embedding <=> other_embedding < (1 - threshold) means similarity > threshold
      const similarResult = await client.query(`
        SELECT s2.slug_norm
        FROM s1_slug_embeddings s1
        CROSS JOIN s1_slug_embeddings s2
        WHERE s1.run_date = $1
          AND s2.run_date = $1
          AND s1.slug_norm = $2
          AND s2.slug_norm != $2
          AND s1.embedding <=> s2.embedding < $3
      `, [runDate, key, distanceThreshold]);

      for (const row of similarResult.rows) {
        const otherKey = row.slug_norm;
        ufUnion(key, otherKey, uf);
        connections++;
      }
    }

    console.log(`\nCompleted: ${connections} connections made\n`);

    // Aggregate clusters
    const clusterMap = new Map<string, Array<typeof slugs[0]>>();
    
    for (const slug of slugs) {
      const key = slug.slug_norm;
      const clusterId = ufFind(key, uf);
      
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      clusterMap.get(clusterId)!.push(slug);
    }

    // Filter clusters by minimum size
    const clusters = Array.from(clusterMap.entries())
      .filter(([_, slugs]) => slugs.length >= minClusterSize)
      .map(([clusterId, slugs]) => ({
        clusterId,
        slugs,
        clusterName: nameCluster(slugs, namingStrategy),
        totalRevenue: slugs.reduce((sum, s) => sum + (Number(s.revenue) || 0), 0),
        totalClicks: slugs.reduce((sum, s) => sum + (Number(s.clicks) || 0), 0),
        totalKeywords: slugs.reduce((sum, s) => sum + (Number(s.keyword_count) || 0), 0),
      }));

    // Sort by revenue
    clusters.sort((a, b) => b.totalRevenue - a.totalRevenue);

    console.log(`Found ${clusters.length} clusters (min size: ${minClusterSize})`);
    console.log(`Total slugs in clusters: ${clusters.reduce((sum, c) => sum + c.slugs.length, 0)}`);
    console.log(`Total revenue in clusters: $${clusters.reduce((sum, c) => sum + c.totalRevenue, 0).toFixed(2)}\n`);

    // Generate output files
    const outDir = getOutputDir();

    // 1. Cluster summary (cluster name, slug count, revenue, etc.)
    const summaryRows = clusters.map(c => ({
      cluster_name: c.clusterName,
      cluster_id: c.clusterId,
      slug_count: c.slugs.length,
      total_revenue: c.totalRevenue.toFixed(2),
      total_clicks: c.totalClicks.toFixed(2),
      total_keywords: c.totalKeywords,
      avg_revenue_per_slug: (c.totalRevenue / c.slugs.length).toFixed(2),
    }));

    // 2. Cluster members (cluster name, slug) - the requested format
    const memberRows: Array<{ cluster_name: string; slug: string }> = [];
    for (const cluster of clusters) {
      for (const slug of cluster.slugs) {
        memberRows.push({
          cluster_name: cluster.clusterName,
          slug: slug.slug,
        });
      }
    }

    // Write CSV files
    const writeCsv = (rows: any[], filename: string) => {
      if (rows.length === 0) {
        fs.writeFileSync(path.join(outDir, filename), '');
        return;
      }
      const keys = Object.keys(rows[0]);
      const lines = [keys.join(',')].concat(
        rows.map(r => keys.map(k => {
          const val = r[k];
          // Escape commas and quotes in CSV
          if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(','))
      );
      fs.writeFileSync(path.join(outDir, filename), lines.join('\n'));
    };

    writeCsv(summaryRows, 'slug_clusters_by_embedding_summary.csv');
    writeCsv(memberRows, 'slug_clusters_by_embedding_members.csv');

    console.log(`\n✅ Output files written to ${outDir}:`);
    console.log(`   - slug_clusters_by_embedding_summary.csv (${summaryRows.length} clusters)`);
    console.log(`   - slug_clusters_by_embedding_members.csv (${memberRows.length} slug-cluster pairs)`);

    // Display top 10 clusters
    console.log(`\n📊 TOP 10 CLUSTERS BY REVENUE:\n`);
    console.log('Cluster Name | Slug Count | Revenue | Clicks | Keywords');
    console.log('-------------|------------|---------|--------|----------');
    clusters.slice(0, 10).forEach(c => {
      const name = c.clusterName.length > 50 ? c.clusterName.substring(0, 47) + '...' : c.clusterName;
      console.log(`${name.padEnd(50)} | ${c.slugs.length.toString().padStart(10)} | $${c.totalRevenue.toFixed(2).padStart(7)} | ${c.totalClicks.toFixed(0).padStart(6)} | ${c.totalKeywords.toString().padStart(8)}`);
    });

    // Show sample cluster members
    if (clusters.length > 0) {
      console.log(`\n📋 SAMPLE CLUSTER: "${clusters[0].clusterName}"`);
      console.log(`   Contains ${clusters[0].slugs.length} slugs:\n`);
      clusters[0].slugs.slice(0, 10).forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.slug} (Revenue: $${Number(s.revenue).toFixed(2)})`);
      });
      if (clusters[0].slugs.length > 10) {
        console.log(`   ... and ${clusters[0].slugs.length - 10} more`);
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('cluster_slugs_by_embedding failed', err);
  process.exit(1);
});

