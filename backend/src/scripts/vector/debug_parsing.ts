import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

async function main() {
  const runDate = process.argv[2] || '2025-11-06';
  const angleFull = path.resolve(`./runs/system1/${runDate}/angle_full.csv`);
  
  console.log('\n=== Debugging CSV Parsing ===\n');

  let rowCount = 0;
  let lastKeyword = '';
  let errors: any[] = [];

  await new Promise<void>((resolve, reject) => {
    const rs = fs.createReadStream(angleFull);
    const parser = parse({
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_records_with_error: false, // Don't skip, we want to see errors
    });
    let header: string[] | null = null;
    
    parser.on('data', (row: any) => {
      rowCount++;
      const arr: string[] = row as string[];
      
      if (!header) {
        header = arr;
        console.log('Header:', header);
        return;
      }

      if (arr.length >= 3) {
        lastKeyword = String(arr[2] || '').trim();
      }

      // Log every 5000 rows
      if (rowCount % 5000 === 0) {
        console.log(`Processed ${rowCount} rows, last keyword: ${lastKeyword.substring(0, 50)}...`);
      }
    });
    
    parser.on('error', (err) => {
      console.error('Parser error:', err);
      errors.push(err);
      // Don't reject, just log
    });
    
    parser.on('end', () => {
      console.log(`\n✅ Parsing completed. Total rows: ${rowCount}`);
      console.log(`Errors encountered: ${errors.length}`);
      resolve();
    });

    rs.on('error', (err) => {
      console.error('Stream error:', err);
      reject(err);
    });

    rs.pipe(parser);
  });

  console.log(`\nFinal row count: ${rowCount}`);
}

main().catch(console.error);

