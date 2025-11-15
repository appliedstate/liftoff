import fs from 'fs';
import path from 'path';
import DuckDB from 'duckdb';

export interface SlugMatch {
  slug: string;
  revenue: number;
  clicks: number;
  searches: number;
  rpc: number;
  rps: number;
  matching_keywords: string[];
}

export interface ManualMapping {
  keywords: string[];
  slugs: string[];
}

/**
 * Query System1 CSV to find slugs that match given keywords
 * This does a reverse lookup: keywords → slugs
 */
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

/**
 * Find System1 slugs that match the given keywords using manual mappings
 * @param manualMappings Array of manual keyword→slug mappings
 * @returns Array of matching slugs with metrics
 */
export async function findSlugsByManualMapping(manualMappings: ManualMapping[]): Promise<SlugMatch[]> {
  if (!manualMappings || manualMappings.length === 0) {
    return [];
  }

  // Find the most recent System1 CSV file
  const sourceDir = path.resolve(process.cwd(), 'data', 'system1', 'incoming');
  if (!fs.existsSync(sourceDir)) {
    console.warn(`[system1SlugMatcher] System1 data directory not found: ${sourceDir}`);
    return [];
  }

  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.warn(`[system1SlugMatcher] No CSV files found in ${sourceDir}`);
    return [];
  }

  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);

  // Build conditions for manual mappings
  // Match if keyword matches AND slug matches
  const conditions: string[] = [];
  for (const mapping of manualMappings) {
    if (mapping.keywords.length === 0 || mapping.slugs.length === 0) continue;

    const keywordConditions = mapping.keywords
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0)
      .map(k => {
        const escaped = k.replace(/'/g, "''");
        return `LOWER(TRIM("SERP_KEYWORD")) LIKE LOWER('%${escaped}%')`;
      });

    const slugConditions = mapping.slugs
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => {
        const escaped = s.replace(/'/g, "''");
        // Normalize slug (with/without trailing slash)
        return `(LOWER(TRIM("CONTENT_SLUG")) = LOWER('${escaped}') OR LOWER(TRIM("CONTENT_SLUG")) = LOWER('${escaped}/') OR LOWER(TRIM("CONTENT_SLUG")) = LOWER('${escaped.replace(/\/$/, '')}'))`;
      });

    if (keywordConditions.length > 0 && slugConditions.length > 0) {
      conditions.push(`(${keywordConditions.join(' OR ')}) AND (${slugConditions.join(' OR ')})`);
    }
  }

  if (conditions.length === 0) {
    return [];
  }

  const whereClause = conditions.join(' OR ');

  try {
    const results = await queryCsv(csvPath, `
      SELECT 
        TRIM("CONTENT_SLUG") as slug,
        TRIM("SERP_KEYWORD") as keyword,
        SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
        SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
        SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_SEARCHES", ''), ',', '') AS DOUBLE)) as searches
      FROM t
      WHERE (${whereClause})
        AND TRIM("CONTENT_SLUG") != ''
        AND TRIM("SERP_KEYWORD") != ''
        AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
      GROUP BY slug, keyword
      ORDER BY revenue DESC
    `);

    return aggregateSlugMatches(results);
  } catch (error: any) {
    console.error(`[system1SlugMatcher] Error querying System1 data:`, error.message);
    return [];
  }
}

/**
 * Find System1 slugs that match the given keywords
 * @param keywords Array of keywords extracted from Facebook ad URLs
 * @returns Array of matching slugs with metrics
 */
export async function findSlugsByKeywords(keywords: string[]): Promise<SlugMatch[]> {
  if (!keywords || keywords.length === 0) {
    return [];
  }

  // Find the most recent System1 CSV file
  const sourceDir = path.resolve(process.cwd(), 'data', 'system1', 'incoming');
  if (!fs.existsSync(sourceDir)) {
    console.warn(`[system1SlugMatcher] System1 data directory not found: ${sourceDir}`);
    return [];
  }

  const csvFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.warn(`[system1SlugMatcher] No CSV files found in ${sourceDir}`);
    return [];
  }

  const csvPath = path.join(sourceDir, csvFiles.sort().reverse()[0]);

  // Normalize keywords for matching (case-insensitive, trimmed)
  const normalizedKeywords = keywords
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0);

  if (normalizedKeywords.length === 0) {
    return [];
  }

  // Build WHERE clause to match keywords
  // Match if SERP_KEYWORD contains any of the normalized keywords (case-insensitive)
  const keywordConditions = normalizedKeywords.map(k => {
    const escaped = k.replace(/'/g, "''");
    return `LOWER(TRIM("SERP_KEYWORD")) LIKE LOWER('%${escaped}%')`;
  }).join(' OR ');

  try {
    // Query for slugs that have these keywords
    const results = await queryCsv(csvPath, `
      SELECT 
        TRIM("CONTENT_SLUG") as slug,
        TRIM("SERP_KEYWORD") as keyword,
        SUM(TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE)) as revenue,
        SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_CLICKS_NETWORK", ''), ',', '') AS DOUBLE)) as clicks,
        SUM(TRY_CAST(REPLACE(COALESCE("SELLSIDE_SEARCHES", ''), ',', '') AS DOUBLE)) as searches
      FROM t
      WHERE (${keywordConditions})
        AND TRIM("CONTENT_SLUG") != ''
        AND TRIM("SERP_KEYWORD") != ''
        AND TRY_CAST(REPLACE(COALESCE("EST_NET_REVENUE", ''), ',', '') AS DOUBLE) > 0
      GROUP BY slug, keyword
      ORDER BY revenue DESC
    `);

    // Group by slug and aggregate metrics
    const slugMap = new Map<string, {
      slug: string;
      revenue: number;
      clicks: number;
      searches: number;
      keywords: Set<string>;
    }>();

    for (const row of results) {
      const slug = (row.slug || '').trim();
      if (!slug) continue;

      const revenue = parseFloat(row.revenue || '0') || 0;
      const clicks = parseFloat(row.clicks || '0') || 0;
      const searches = parseFloat(row.searches || '0') || 0;
      const keyword = (row.keyword || '').trim();

      if (!slugMap.has(slug)) {
        slugMap.set(slug, {
          slug,
          revenue: 0,
          clicks: 0,
          searches: 0,
          keywords: new Set<string>()
        });
      }

      const entry = slugMap.get(slug)!;
      entry.revenue += revenue;
      entry.clicks += clicks;
      entry.searches += searches;
      if (keyword) {
        entry.keywords.add(keyword);
      }
    }

    // Convert to SlugMatch format
    const matches: SlugMatch[] = Array.from(slugMap.values()).map(entry => {
      const rpc = entry.clicks > 0 ? entry.revenue / entry.clicks : 0;
      const rps = entry.searches > 0 ? entry.revenue / entry.searches : 0;

      return {
        slug: entry.slug,
        revenue: Math.round(entry.revenue * 100) / 100,
        clicks: Math.round(entry.clicks * 100) / 100,
        searches: Math.round(entry.searches * 100) / 100,
        rpc: Math.round(rpc * 100) / 100,
        rps: Math.round(rps * 100) / 100,
        matching_keywords: Array.from(entry.keywords).sort()
      };
    });

    // Sort by revenue descending
    return matches.sort((a, b) => b.revenue - a.revenue);
  } catch (error: any) {
    console.error(`[system1SlugMatcher] Error querying System1 data:`, error.message);
    return [];
  }
}

function aggregateSlugMatches(results: any[]): SlugMatch[] {
  // Group by slug and aggregate metrics
  const slugMap = new Map<string, {
    slug: string;
    revenue: number;
    clicks: number;
    searches: number;
    keywords: Set<string>;
  }>();

  for (const row of results) {
    const slug = (row.slug || '').trim();
    if (!slug) continue;

    const revenue = parseFloat(row.revenue || '0') || 0;
    const clicks = parseFloat(row.clicks || '0') || 0;
    const searches = parseFloat(row.searches || '0') || 0;
    const keyword = (row.keyword || '').trim();

    if (!slugMap.has(slug)) {
      slugMap.set(slug, {
        slug,
        revenue: 0,
        clicks: 0,
        searches: 0,
        keywords: new Set<string>()
      });
    }

    const entry = slugMap.get(slug)!;
    entry.revenue += revenue;
    entry.clicks += clicks;
    entry.searches += searches;
    if (keyword) {
      entry.keywords.add(keyword);
    }
  }

  // Convert to SlugMatch format
  const matches: SlugMatch[] = Array.from(slugMap.values()).map(entry => {
    const rpc = entry.clicks > 0 ? entry.revenue / entry.clicks : 0;
    const rps = entry.searches > 0 ? entry.revenue / entry.searches : 0;

    return {
      slug: entry.slug,
      revenue: Math.round(entry.revenue * 100) / 100,
      clicks: Math.round(entry.clicks * 100) / 100,
      searches: Math.round(entry.searches * 100) / 100,
      rpc: Math.round(rpc * 100) / 100,
      rps: Math.round(rps * 100) / 100,
      matching_keywords: Array.from(entry.keywords).sort()
    };
  });

  // Sort by revenue descending
  return matches.sort((a, b) => b.revenue - a.revenue);
}

