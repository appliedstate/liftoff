import DuckDB from 'duckdb';
import path from 'path';

const csvPath = path.resolve('./data/system1/incoming/System Keyword with Slug_2025-10-30-1645 (1) 2.csv');
const db = new DuckDB.Database(':memory:');
const conn = db.connect();

conn.all(`
  CREATE TABLE t AS SELECT * FROM read_csv_auto('${csvPath.replace(/'/g, "''")}', header=true, all_varchar=true, ignore_errors=true, delim=',', quote='"');
`, (err: any) => {
  if (err) {
    console.error(err);
    conn.close();
    db.close();
    return;
  }
  
  conn.all('SELECT * FROM t LIMIT 3', (err2: any, rows: any[]) => {
    if (err2) {
      console.error(err2);
    } else {
      console.log('\n=== CSV STRUCTURE ===\n');
      console.log('Columns:', Object.keys(rows[0] || {}));
      console.log('\nSample row:');
      console.log(JSON.stringify(rows[0], null, 2));
      
      // Check if there's a search volume column
      const cols = Object.keys(rows[0] || {});
      const searchCols = cols.filter(c => 
        c.toLowerCase().includes('search') || 
        c.toLowerCase().includes('query') ||
        c.toLowerCase().includes('impression')
      );
      
      console.log('\n\nColumns that might represent search volume:');
      console.log(searchCols.length > 0 ? searchCols : 'None found');
      
      // Check a specific keyword to understand the data structure
      conn.all(`
        SELECT 
          "SERP_KEYWORD" as keyword,
          "CONTENT_SLUG" as slug,
          "REGION_CODE" as state,
          "EST_NET_REVENUE" as revenue,
          "SELLSIDE_CLICKS_NETWORK" as clicks,
          COUNT(*) as row_count
        FROM t
        WHERE LOWER("SERP_KEYWORD") LIKE '%instant cash for opening bank account%'
        GROUP BY keyword, slug, state, revenue, clicks
        LIMIT 5
      `, (err3: any, sampleRows: any[]) => {
        console.log('\n\nSample data for "instant cash for opening bank account":');
        console.log(JSON.stringify(sampleRows, null, 2));
        
        conn.close();
        db.close();
      });
    }
  });
});



