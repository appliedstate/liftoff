import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

async function main() {
  const runDate = process.argv[2] || '2025-11-06';
  const angleFull = path.resolve(`./runs/system1/${runDate}/angle_full.csv`);
  
  if (!fs.existsSync(angleFull)) {
    console.error(`File not found: ${angleFull}`);
    process.exit(1);
  }

  console.log('\n=== Checking Row Parsing ===\n');

  let totalRows = 0;
  let headerRows = 0;
  let validRows = 0;
  let skippedRows = 0;
  let columnCounts: Record<number, number> = {};

  await new Promise<void>((resolve, reject) => {
    const rs = fs.createReadStream(angleFull);
    const parser = parse({
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_records_with_error: true,
    });
    let header: string[] | null = null;
    
    parser.on('data', (row: any) => {
      const arr: string[] = row as string[];
      totalRows++;
      
      if (!header) {
        header = arr.map((s) => String(s || '').trim().toLowerCase());
        headerRows++;
        columnCounts[arr.length] = (columnCounts[arr.length] || 0) + 1;
        return;
      }

      columnCounts[arr.length] = (columnCounts[arr.length] || 0) + 1;
      
      const expected = 9;
      if (arr.length < expected) {
        skippedRows++;
        return;
      }

      let keyword: string;
      if (arr.length === expected) {
        keyword = arr[2];
      } else {
        const extra = arr.length - expected;
        keyword = arr.slice(2, 3 + extra).join(',').trim();
      }

      const rawKeyword = String(keyword || '').trim();
      if (!rawKeyword) {
        skippedRows++;
        return;
      }

      validRows++;
    });
    
    parser.on('error', reject);
    parser.on('end', () => resolve());
    rs.pipe(parser);
  });

  console.log('📊 PARSING STATS:');
  console.log(JSON.stringify({
    total_rows: totalRows,
    header_rows: headerRows,
    valid_rows: validRows,
    skipped_rows: skippedRows,
    column_distribution: columnCounts
  }, null, 2));

  console.log(`\n⚠️  ${skippedRows} rows were skipped during parsing!`);
  console.log(`   Expected ${totalRows - headerRows} data rows, but only ${validRows} were processed.`);
}

main().catch(console.error);

